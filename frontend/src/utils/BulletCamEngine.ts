/**
 * Deterministic presentation engine for SLIDE's drive-by bullet camera.
 *
 * Combat is resolved before this engine starts. It never changes gameplay time,
 * health, damage, or projectile state; it only creates replay frames for the
 * canvas renderer in BulletCamReplay.tsx.
 */

export type BulletCamPhase = 'idle' | 'travel' | 'impact' | 'xray' | 'resolved';

/** RSB-style camera stages. Travel stages advance by projectile path percent. */
export type BulletCamStage =
  | 'idle'
  | 'launch'
  | 'chase'
  | 'terminal'
  | 'impact'
  | 'xray'
  | 'resolved';

export type BulletCamPreset = 'brief' | 'cinematic';

export interface BulletCamDurations {
  travel: number;
  impact: number;
  xray: number;
}

export interface DriveByShot {
  /** Stable replay/debug identifier supplied by the authoritative shot owner. */
  shotId?: string;
  shooterId: string;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  hit: boolean;
  damage: number;
  /** Wall-clock timestamp used only by the optional CCTV treatment. */
  timestamp: number;
  isLethal?: boolean;
  isCritical?: boolean;
  /** Canonical visual seed. Falls back to a stable hash of the shot fields. */
  fxSeed?: number;
  /** Optional authored quadratic Bezier control point. */
  controlX?: number;
  controlY?: number;
  preset?: BulletCamPreset;
}

/** A frame is mutable scratch state. Consumers must read it synchronously. */
export interface BulletCamFrameState {
  phase: BulletCamPhase;
  stage: BulletCamStage;
  elapsed: number;
  totalDuration: number;
  progress: number;
  phaseProgress: number;
  /** 0-1 projectile progress along the replay trajectory. */
  pathProgress: number;

  bulletX: number;
  bulletY: number;
  bulletAngle: number;
  bulletVisible: boolean;

  cameraX: number;
  cameraY: number;
  zoom: number;
  cameraRotation: number;
  /** Presentation metadata only. The gameplay simulation is never time-scaled. */
  timeDilation: number;

  speedLineIntensity: number;
  flashIntensity: number;
  shockwaveRadius: number;
  xrayOpacity: number;

  damage: number;
  isLethal: boolean;
  isCritical: boolean;

  /** x, y, age-in-frames, intensity per point. */
  trail: Float32Array;
  trailCount: number;
  /** x1, y1, x2, y2 per fracture. */
  fractures: Float32Array;
  fractureCount: number;
}

export const BULLET_CAM_PRESETS: Record<BulletCamPreset, BulletCamDurations> = {
  brief: { travel: 760, impact: 130, xray: 460 },
  cinematic: { travel: 1_300, impact: 180, xray: 1_100 },
};

/** Backwards-compatible exports use the default cinematic profile. */
export const PHASE_DURATIONS = BULLET_CAM_PRESETS.cinematic;
export const TOTAL_DURATION =
  PHASE_DURATIONS.travel + PHASE_DURATIONS.impact + PHASE_DURATIONS.xray;

const TRAIL_MAX = 64;
const TRAIL_FLOATS = 4;
const FRACTURE_MAX = 12;
const FRACTURE_FLOATS = 4;
const LAUNCH_END = 0.10;
const TERMINAL_START = 0.90;

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function easeInQuad(t: number): number {
  return t * t;
}

function stageProgress(value: number, start: number, end: number): number {
  return clamp01((value - start) / Math.max(0.0001, end - start));
}

function quadraticBezier(a: number, control: number, b: number, t: number): number {
  const inverse = 1 - t;
  return inverse * inverse * a + 2 * inverse * t * control + t * t * b;
}

function quadraticBezierDerivative(a: number, control: number, b: number, t: number): number {
  return 2 * (1 - t) * (control - a) + 2 * t * (b - control);
}

function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value: string, seed = 2166136261): number {
  let hash = seed >>> 0;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function fallbackFxSeed(shot: DriveByShot): number {
  const identity = [
    shot.shotId ?? '',
    shot.shooterId,
    shot.startX.toFixed(3),
    shot.startY.toFixed(3),
    shot.targetX.toFixed(3),
    shot.targetY.toFixed(3),
    String(shot.damage),
    String(shot.timestamp),
  ].join('|');
  return hashString(identity) || 1;
}

function currentTime(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

export class BulletCamEngine {
  private shot: DriveByShot | null = null;
  private startTime = 0;
  private active = false;
  private durations: BulletCamDurations = PHASE_DURATIONS;
  private totalDuration = TOTAL_DURATION;

  private trailHead = 0;
  private trailFilled = 0;
  private readonly trailBuffer = new Float32Array(TRAIL_MAX * TRAIL_FLOATS);
  private readonly fractureBuffer = new Float32Array(FRACTURE_MAX * FRACTURE_FLOATS);

  private dx = 0;
  private dy = 0;
  private distance = 1;
  private controlX = 0;
  private controlY = 0;
  private directionSign = 1;

  private fractureSeed = 1;
  private fracturesGenerated = false;

  private readonly frame: BulletCamFrameState;

  constructor() {
    this.frame = {
      phase: 'idle',
      stage: 'idle',
      elapsed: 0,
      totalDuration: TOTAL_DURATION,
      progress: 0,
      phaseProgress: 0,
      pathProgress: 0,
      bulletX: 0,
      bulletY: 0,
      bulletAngle: 0,
      bulletVisible: false,
      cameraX: 0,
      cameraY: 0,
      zoom: 1,
      cameraRotation: 0,
      timeDilation: 1,
      speedLineIntensity: 0,
      flashIntensity: 0,
      shockwaveRadius: 0,
      xrayOpacity: 0,
      damage: 0,
      isLethal: false,
      isCritical: false,
      trail: this.trailBuffer,
      trailCount: 0,
      fractures: this.fractureBuffer,
      fractureCount: 0,
    };
  }

  /** Begin a replay after the gameplay owner has already resolved the hit. */
  start(shot: DriveByShot, now = currentTime()): void {
    this.shot = shot;
    this.startTime = now;
    this.active = true;
    this.trailHead = 0;
    this.trailFilled = 0;

    this.durations = BULLET_CAM_PRESETS[shot.preset ?? 'cinematic'];
    this.totalDuration =
      this.durations.travel + this.durations.impact + this.durations.xray;

    this.dx = shot.targetX - shot.startX;
    this.dy = shot.targetY - shot.startY;
    this.distance = Math.hypot(this.dx, this.dy) || 1;

    this.fractureSeed = (shot.fxSeed ?? fallbackFxSeed(shot)) >>> 0 || 1;
    this.directionSign = (this.fractureSeed & 1) === 0 ? -1 : 1;

    const midpointX = (shot.startX + shot.targetX) * 0.5;
    const midpointY = (shot.startY + shot.targetY) * 0.5;
    const curveAmount = Math.min(48, Math.max(14, this.distance * 0.07));
    const normalX = -this.dy / this.distance;
    const normalY = this.dx / this.distance;
    this.controlX = shot.controlX ?? midpointX + normalX * curveAmount * this.directionSign;
    this.controlY = shot.controlY ?? midpointY + normalY * curveAmount * this.directionSign;

    this.fracturesGenerated = false;
    this.trailBuffer.fill(0);
    this.fractureBuffer.fill(0);
    this.resetFrame();
  }

  stop(): void {
    this.active = false;
    this.shot = null;
  }

  isActive(): boolean {
    return this.active;
  }

  getShot(): DriveByShot | null {
    return this.shot;
  }

  getTotalDuration(): number {
    return this.totalDuration;
  }

  private resetFrame(): void {
    const shot = this.shot;
    const frame = this.frame;
    frame.phase = 'idle';
    frame.stage = 'idle';
    frame.elapsed = 0;
    frame.totalDuration = this.totalDuration;
    frame.progress = 0;
    frame.phaseProgress = 0;
    frame.pathProgress = 0;
    frame.bulletX = shot?.startX ?? 0;
    frame.bulletY = shot?.startY ?? 0;
    frame.bulletAngle = Math.atan2(this.dy, this.dx);
    frame.bulletVisible = false;
    frame.cameraX = shot?.startX ?? 0;
    frame.cameraY = shot?.startY ?? 0;
    frame.zoom = 1;
    frame.cameraRotation = 0;
    frame.timeDilation = 1;
    frame.speedLineIntensity = 0;
    frame.flashIntensity = 0;
    frame.shockwaveRadius = 0;
    frame.xrayOpacity = 0;
    frame.damage = shot?.damage ?? 0;
    frame.isLethal = shot?.isLethal ?? false;
    frame.isCritical = shot?.isCritical ?? false;
    frame.trailCount = 0;
    frame.fractureCount = 0;
  }

  private sampleX(t: number): number {
    if (!this.shot) return 0;
    return quadraticBezier(this.shot.startX, this.controlX, this.shot.targetX, t);
  }

  private sampleY(t: number): number {
    if (!this.shot) return 0;
    return quadraticBezier(this.shot.startY, this.controlY, this.shot.targetY, t);
  }

  private sampleAngle(t: number): number {
    if (!this.shot) return 0;
    const tangentX = quadraticBezierDerivative(
      this.shot.startX,
      this.controlX,
      this.shot.targetX,
      t,
    );
    const tangentY = quadraticBezierDerivative(
      this.shot.startY,
      this.controlY,
      this.shot.targetY,
      t,
    );
    return Math.atan2(tangentY, tangentX);
  }

  private pushTrail(x: number, y: number, intensity: number): void {
    const index = this.trailHead * TRAIL_FLOATS;
    this.trailBuffer[index] = x;
    this.trailBuffer[index + 1] = y;
    this.trailBuffer[index + 2] = 0;
    this.trailBuffer[index + 3] = intensity;
    this.trailHead = (this.trailHead + 1) % TRAIL_MAX;
    if (this.trailFilled < TRAIL_MAX) this.trailFilled++;
  }

  private updateTrailAges(): void {
    for (let i = 0; i < this.trailFilled; i++) {
      this.trailBuffer[i * TRAIL_FLOATS + 2] += 1;
    }
  }

  private generateFractures(): void {
    if (this.fracturesGenerated || !this.shot) return;
    const random = mulberry32(this.fractureSeed);
    const count = this.shot.isLethal ? FRACTURE_MAX : Math.max(4, FRACTURE_MAX >> 1);

    for (let i = 0; i < count; i++) {
      const index = i * FRACTURE_FLOATS;
      const angle = random() * Math.PI * 2;
      const startOffset = random() * 4;
      const endOffset = startOffset + 8 + random() * 28;
      this.fractureBuffer[index] = this.shot.targetX + Math.cos(angle) * startOffset;
      this.fractureBuffer[index + 1] = this.shot.targetY + Math.sin(angle) * startOffset;
      this.fractureBuffer[index + 2] = this.shot.targetX + Math.cos(angle) * endOffset;
      this.fractureBuffer[index + 3] = this.shot.targetY + Math.sin(angle) * endOffset;
    }
    this.fracturesGenerated = true;
  }

  update(now: number): BulletCamFrameState | null {
    if (!this.active || !this.shot) return null;

    const shot = this.shot;
    const elapsed = Math.max(0, now - this.startTime);
    const impactStart = this.durations.travel;
    const xrayStart = impactStart + this.durations.impact;

    let phase: BulletCamPhase;
    let phaseStart: number;
    let phaseDuration: number;
    if (elapsed < impactStart) {
      phase = 'travel';
      phaseStart = 0;
      phaseDuration = this.durations.travel;
    } else if (elapsed < xrayStart) {
      phase = 'impact';
      phaseStart = impactStart;
      phaseDuration = this.durations.impact;
    } else if (elapsed < this.totalDuration) {
      phase = 'xray';
      phaseStart = xrayStart;
      phaseDuration = this.durations.xray;
    } else {
      phase = 'resolved';
      phaseStart = this.totalDuration;
      phaseDuration = 1;
    }

    const phaseProgress = clamp01((elapsed - phaseStart) / phaseDuration);
    const pathProgress = phase === 'travel' ? easeInOutCubic(phaseProgress) : 1;
    const frame = this.frame;

    let stage: BulletCamStage = 'idle';
    let bulletX = shot.targetX;
    let bulletY = shot.targetY;
    let bulletVisible = false;
    let cameraX = shot.targetX;
    let cameraY = shot.targetY;
    let zoom = 1;
    let cameraRotation = 0;
    let timeDilation = 1;
    let speedLineIntensity = 0;
    let flashIntensity = 0;
    let shockwaveRadius = 0;
    let xrayOpacity = 0;

    if (phase === 'travel') {
      bulletX = this.sampleX(pathProgress);
      bulletY = this.sampleY(pathProgress);
      bulletVisible = true;

      let cameraPathProgress: number;
      if (pathProgress < LAUNCH_END) {
        stage = 'launch';
        const local = stageProgress(pathProgress, 0, LAUNCH_END);
        cameraPathProgress = Math.max(0, pathProgress - 0.025);
        zoom = lerp(1.05, 1.4, easeOutExpo(local));
        cameraRotation = this.directionSign * lerp(0.008, 0.022, local);
        timeDilation = 0.07;
        speedLineIntensity = lerp(0.15, 0.55, local);
      } else if (pathProgress < TERMINAL_START) {
        stage = 'chase';
        const local = stageProgress(pathProgress, LAUNCH_END, TERMINAL_START);
        cameraPathProgress = Math.max(0, pathProgress - 0.12);
        zoom = lerp(1.4, 2.2, easeInQuad(local));
        cameraRotation = this.directionSign * lerp(0.022, 0.04, local);
        timeDilation = lerp(0.18, 0.24, local);
        speedLineIntensity = Math.sin(local * Math.PI) * 0.85 + 0.1;
      } else {
        stage = 'terminal';
        const local = stageProgress(pathProgress, TERMINAL_START, 1);
        const trailingProgress = Math.max(0, pathProgress - 0.07);
        cameraPathProgress = lerp(trailingProgress, 1, easeInQuad(local) * 0.82);
        zoom = lerp(2.2, 3.05, easeOutExpo(local));
        cameraRotation = this.directionSign * lerp(0.04, 0.012, local);
        timeDilation = 0.045;
        speedLineIntensity = lerp(0.75, 0.2, local);
      }

      cameraX = this.sampleX(cameraPathProgress);
      cameraY = this.sampleY(cameraPathProgress);
      this.pushTrail(bulletX, bulletY, speedLineIntensity);
      this.updateTrailAges();
    } else if (phase === 'impact') {
      stage = 'impact';
      zoom = lerp(3.05, 3.5, easeOutExpo(phaseProgress));
      cameraRotation = this.directionSign * 0.012;
      timeDilation = 0.02;
      flashIntensity = (1 - easeOutExpo(phaseProgress)) * 0.9;
      shockwaveRadius = easeOutExpo(phaseProgress) * 0.6;
      this.updateTrailAges();
    } else if (phase === 'xray') {
      stage = 'xray';
      zoom = lerp(3.5, 3, easeOutExpo(phaseProgress));
      timeDilation = 0.3;
      if (phaseProgress < 0.15) {
        xrayOpacity = easeOutExpo(phaseProgress / 0.15);
      } else if (phaseProgress > 0.8) {
        xrayOpacity = 1 - easeInOutCubic((phaseProgress - 0.8) / 0.2);
      } else {
        xrayOpacity = 1;
      }
      flashIntensity = Math.max(0, 0.3 - phaseProgress * 0.3);
      this.generateFractures();
      this.updateTrailAges();
    } else {
      stage = 'resolved';
      zoom = 3;
      this.active = false;
    }

    frame.phase = phase;
    frame.stage = stage;
    frame.elapsed = elapsed;
    frame.totalDuration = this.totalDuration;
    frame.progress = clamp01(elapsed / this.totalDuration);
    frame.phaseProgress = phaseProgress;
    frame.pathProgress = pathProgress;
    frame.bulletX = bulletX;
    frame.bulletY = bulletY;
    frame.bulletAngle = this.sampleAngle(pathProgress);
    frame.bulletVisible = bulletVisible;
    frame.cameraX = cameraX;
    frame.cameraY = cameraY;
    frame.zoom = zoom;
    frame.cameraRotation = cameraRotation;
    frame.timeDilation = timeDilation;
    frame.speedLineIntensity = speedLineIntensity;
    frame.flashIntensity = flashIntensity;
    frame.shockwaveRadius = shockwaveRadius;
    frame.xrayOpacity = xrayOpacity;
    frame.damage = shot.damage;
    frame.isLethal = shot.isLethal ?? false;
    frame.isCritical = shot.isCritical ?? false;
    frame.trailCount = this.trailFilled;
    frame.fractureCount = this.fracturesGenerated
      ? (shot.isLethal ? FRACTURE_MAX : Math.max(4, FRACTURE_MAX >> 1))
      : 0;
    return frame;
  }
}

export const bulletCamEngine = new BulletCamEngine();
