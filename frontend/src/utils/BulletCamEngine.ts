/**
 * BulletCamEngine.ts
 * ---------------------------------------------------------------------------
 * Pure math/physics engine for the cinematic "bullet-cam" slow-motion replay.
 * No rendering — this module only computes frame states. The React component
 * (BulletCamReplay.tsx) consumes these states and draws to <canvas>.
 *
 * Design goals:
 *   - Zero per-frame allocations (object pooling, flat arrays).
 *   - Deterministic timeline: idle → travel → impact → xray → resolved.
 *   - Easing-driven time dilation and camera zoom.
 * ---------------------------------------------------------------------------
 */

// ── Types ───────────────────────────────────────────────────────────────────

export type BulletCamPhase =
  | 'idle'
  | 'travel'
  | 'impact'
  | 'xray'
  | 'resolved';

export interface DriveByShot {
  shooterId: string;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  hit: boolean;
  damage: number;
  timestamp: number;
  isLethal?: boolean;
}

/** A single immutable-ish snapshot consumed by the renderer each frame. */
export interface BulletCamFrameState {
  phase: BulletCamPhase;
  /** Elapsed time since the replay started (ms). */
  elapsed: number;
  /** Total expected duration of the replay (ms). */
  totalDuration: number;
  /** 0–1 progress through the *entire* timeline. */
  progress: number;
  /** 0–1 progress through the current phase. */
  phaseProgress: number;

  // Bullet
  bulletX: number;
  bulletY: number;
  /** Angle of travel in radians. */
  bulletAngle: number;
  bulletVisible: boolean;

  // Camera
  cameraX: number;
  cameraY: number;
  zoom: number;
  /** Rotation in radians (slight Dutch tilt for cinematic feel). */
  cameraRotation: number;

  // Time
  /** 1.0 = real time. 0.1 = 10× slow motion. */
  timeDilation: number;

  // Effects
  /** 0–1 strength of radial blur / speed lines. */
  speedLineIntensity: number;
  /** 0–1 white flash intensity on impact. */
  flashIntensity: number;
  /** 0–1 shockwave ring radius (0 = not active). */
  shockwaveRadius: number;
  /** 0–1 x-ray overlay opacity. */
  xrayOpacity: number;

  // Damage
  damage: number;
  isLethal: boolean;

  // Trail (pre-allocated ring buffer — see BulletCamEngine)
  trail: Float32Array;
  trailCount: number;

  // Fracture lines (pre-allocated — x-ray phase)
  fractures: Float32Array;
  fractureCount: number;
}

// ── Tunable Constants ──────────────────────────────────────────────────────

/** Duration of each phase in milliseconds (real wall-clock, not dilated). */
export const PHASE_DURATIONS = {
  travel: 1_600,
  impact: 250,
  xray: 2_200,
} as const;

export const TOTAL_DURATION =
  PHASE_DURATIONS.travel + PHASE_DURATIONS.impact + PHASE_DURATIONS.xray;

const TRAIL_MAX = 64;        // max trail segments stored
const TRAIL_FLOATS = 4;      // x, y, age, intensity per segment
const FRACTURE_MAX = 12;     // max fracture lines
const FRACTURE_FLOATS = 4;   // x1, y1, x2, y2 per fracture

// ── Easing Functions (pure, no allocations) ────────────────────────────────

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function easeInQuad(t: number): number {
  return t * t;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ── Seeded RNG (deterministic fracture patterns per shot) ─────────────────

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Pre-allocated scratch objects ──────────────────────────────────────────

const TRAIL_BUFFER = new Float32Array(TRAIL_MAX * TRAIL_FLOATS);
const FRACTURE_BUFFER = new Float32Array(FRACTURE_MAX * FRACTURE_FLOATS);

// Reusable frame state — the engine returns the *same* object every call,
// so the renderer must read it synchronously (no storing references across frames).
const SCRATCH_FRAME: BulletCamFrameState = {
  phase: 'idle',
  elapsed: 0,
  totalDuration: TOTAL_DURATION,
  progress: 0,
  phaseProgress: 0,
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
  trail: TRAIL_BUFFER,
  trailCount: 0,
  fractures: FRACTURE_BUFFER,
  fractureCount: 0,
};

// ── Engine ─────────────────────────────────────────────────────────────────

export class BulletCamEngine {
  private shot: DriveByShot | null = null;
  private startTime: number = 0;
  private active: boolean = false;

  // Trail ring buffer head index
  private trailHead: number = 0;
  private trailFilled: number = 0;

  // Pre-computed trajectory values
  private dx: number = 0;
  private dy: number = 0;
  private distance: number = 0;
  private angle: number = 0;

  // Pre-generated fractures (seeded from shot data)
  private fractureSeed: number = 0;
  private fracturesGenerated: boolean = false;

  // ── Lifecycle ───────────────────────────────────────────────────────────

  /** Begin a new replay. Call once when a critical/lethal shot is detected. */
  start(shot: DriveByShot): void {
    this.shot = shot;
    this.startTime = performance.now();
    this.active = true;
    this.trailHead = 0;
    this.trailFilled = 0;

    this.dx = shot.targetX - shot.startX;
    this.dy = shot.targetY - shot.startY;
    this.distance = Math.hypot(this.dx, this.dy) || 1;
    this.angle = Math.atan2(this.dy, this.dx);

    // Deterministic seed from shot data
    this.fractureSeed =
      (Math.abs(shot.shooterId.charCodeAt(0) || 1) * 2654435761) ^
      ((shot.timestamp * 40503) >>> 0);
    this.fracturesGenerated = false;

    // Clear buffers
    TRAIL_BUFFER.fill(0);
    FRACTURE_BUFFER.fill(0);
  }

  /** Stop the replay immediately. */
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

  // ── Trail management ─────────────────────────────────────────────────────

  private pushTrail(x: number, y: number, intensity: number): void {
    const idx = this.trailHead * TRAIL_FLOATS;
    TRAIL_BUFFER[idx] = x;
    TRAIL_BUFFER[idx + 1] = y;
    TRAIL_BUFFER[idx + 2] = 0; // age, incremented each frame
    TRAIL_BUFFER[idx + 3] = intensity;

    this.trailHead = (this.trailHead + 1) % TRAIL_MAX;
    if (this.trailFilled < TRAIL_MAX) this.trailFilled++;
  }

  private updateTrailAges(): void {
    for (let i = 0; i < this.trailFilled; i++) {
      const idx = i * TRAIL_FLOATS;
      TRAIL_BUFFER[idx + 2] += 1; // age++
    }
  }

  // ── Fracture generation (deterministic, once per shot) ───────────────────

  private generateFractures(): void {
    if (this.fracturesGenerated || !this.shot) return;

    const rng = mulberry32(this.fractureSeed);
    const tx = this.shot.targetX;
    const ty = this.shot.targetY;
    const count = this.shot.isLethal ? FRACTURE_MAX : Math.max(4, FRACTURE_MAX >> 1);

    for (let i = 0; i < count; i++) {
      const idx = i * FRACTURE_FLOATS;
      // Radial fracture lines emanating from impact point
      const a = rng() * Math.PI * 2;
      const len = 8 + rng() * 28; // px in "xray space"

      // Start slightly offset from center, end further out
      const startOffset = rng() * 4;
      const endOffset = startOffset + len;

      FRACTURE_BUFFER[idx]     = tx + Math.cos(a) * startOffset;
      FRACTURE_BUFFER[idx + 1] = ty + Math.sin(a) * startOffset;
      FRACTURE_BUFFER[idx + 2] = tx + Math.cos(a) * endOffset;
      FRACTURE_BUFFER[idx + 3] = ty + Math.sin(a) * endOffset;
    }

    this.fracturesGenerated = true;
  }

  // ── Core update ──────────────────────────────────────────────────────────

  /**
   * Compute the current frame state. Returns a reference to an internal
   * scratch object — do NOT store it. Read values synchronously.
   *
   * @param now Current high-resolution timestamp (performance.now()).
   * @returns BulletCamFrameState or null if replay is inactive.
   */
  update(now: number): BulletCamFrameState | null {
    if (!this.active || !this.shot) return null;

    const shot = this.shot;
    const elapsed = now - this.startTime;

    // Determine phase
    let phase: BulletCamPhase;
    let phaseStart: number;
    let phaseDur: number;

    if (elapsed < PHASE_DURATIONS.travel) {
      phase = 'travel';
      phaseStart = 0;
      phaseDur = PHASE_DURATIONS.travel;
    } else if (elapsed < PHASE_DURATIONS.travel + PHASE_DURATIONS.impact) {
      phase = 'impact';
      phaseStart = PHASE_DURATIONS.travel;
      phaseDur = PHASE_DURATIONS.impact;
    } else if (elapsed < TOTAL_DURATION) {
      phase = 'xray';
      phaseStart = PHASE_DURATIONS.travel + PHASE_DURATIONS.impact;
      phaseDur = PHASE_DURATIONS.xray;
    } else {
      phase = 'resolved';
      phaseStart = TOTAL_DURATION;
      phaseDur = 1; // avoid div-by-zero
    }

    const phaseElapsed = elapsed - phaseStart;
    const phaseProgress = clamp01(phaseElapsed / phaseDur);
    const totalProgress = clamp01(elapsed / TOTAL_DURATION);

    // ── Per-phase computation ──────────────────────────────────────────────

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

    switch (phase) {
      case 'travel': {
        // Bullet travels from shooter → target with easeInOutCubic
        const t = easeInOutCubic(phaseProgress);
        bulletX = lerp(shot.startX, shot.targetX, t);
        bulletY = lerp(shot.startY, shot.targetY, t);
        bulletVisible = true;

        // Camera trails slightly behind the bullet
        const camLag = 0.18;
        cameraX = lerp(shot.startX, shot.targetX, Math.max(0, t - camLag));
        cameraY = lerp(shot.startY, shot.targetY, Math.max(0, t - camLag));

        // Zoom ramps from 1.0 → 2.2 as bullet nears target
        zoom = lerp(1.0, 2.2, easeInQuad(phaseProgress));

        // Slight Dutch tilt increasing as we approach impact
        cameraRotation = lerp(0, 0.04, phaseProgress) * (this.dx < 0 ? -1 : 1);

        // Time dilation: start very slow, slightly accelerate
        timeDilation = lerp(0.12, 0.22, phaseProgress);

        // Speed lines intensify as bullet moves faster (mid-flight peak)
        speedLineIntensity = Math.sin(phaseProgress * Math.PI) * 0.85;

        // Push trail
        this.pushTrail(bulletX, bulletY, speedLineIntensity);
        this.updateTrailAges();
        break;
      }

      case 'impact': {
        // Bullet is at target; camera snaps to impact point
        bulletX = shot.targetX;
        bulletY = shot.targetY;
        bulletVisible = false; // bullet "enters" the body
        cameraX = shot.targetX;
        cameraY = shot.targetY;

        // Zoom punch: quick zoom-in then settle
        zoom = lerp(2.2, 3.5, easeOutExpo(phaseProgress));

        cameraRotation = 0.04 * (this.dx < 0 ? -1 : 1);

        // Freeze time almost completely
        timeDilation = 0.05;

        // White flash — strongest at start, fades fast
        flashIntensity = (1 - easeOutExpo(phaseProgress)) * 0.9;

        // Shockwave ring expands
        shockwaveRadius = easeOutExpo(phaseProgress) * 0.6;

        // Keep updating trail ages (trail fades)
        this.updateTrailAges();
        break;
      }

      case 'xray': {
        // Camera locked on impact, slight zoom settle
        bulletX = shot.targetX;
        bulletY = shot.targetY;
        bulletVisible = false;
        cameraX = shot.targetX;
        cameraY = shot.targetY;
        zoom = lerp(3.5, 3.0, easeOutExpo(phaseProgress));
        cameraRotation = 0;
        timeDilation = 0.3;

        // X-ray fades in during first 15% of phase, stays, fades out last 20%
        if (phaseProgress < 0.15) {
          xrayOpacity = easeOutExpo(phaseProgress / 0.15);
        } else if (phaseProgress > 0.8) {
          xrayOpacity = 1 - easeInOutCubic((phaseProgress - 0.8) / 0.2);
        } else {
          xrayOpacity = 1;
        }

        // Linger flash in early xray
        flashIntensity = Math.max(0, 0.3 - phaseProgress * 0.3);

        // Generate fractures once
        this.generateFractures();

        // Update trail (it should be fully faded by now)
        this.updateTrailAges();
        break;
      }

      case 'resolved': {
        this.active = false;
        // Fall through with final values
        break;
      }
    }

    // ── Populate scratch frame ────────────────────────────────────────────

    const f = SCRATCH_FRAME;
    f.phase = phase;
    f.elapsed = elapsed;
    f.totalDuration = TOTAL_DURATION;
    f.progress = totalProgress;
    f.phaseProgress = phaseProgress;
    f.bulletX = bulletX;
    f.bulletY = bulletY;
    f.bulletAngle = this.angle;
    f.bulletVisible = bulletVisible;
    f.cameraX = cameraX;
    f.cameraY = cameraY;
    f.zoom = zoom;
    f.cameraRotation = cameraRotation;
    f.timeDilation = timeDilation;
    f.speedLineIntensity = speedLineIntensity;
    f.flashIntensity = flashIntensity;
    f.shockwaveRadius = shockwaveRadius;
    f.xrayOpacity = xrayOpacity;
    f.damage = shot.damage;
    f.isLethal = shot.isLethal ?? false;
    f.trail = TRAIL_BUFFER;
    f.trailCount = this.trailFilled;
    f.fractures = FRACTURE_BUFFER;
    f.fractureCount = this.fracturesGenerated
      ? (shot.isLethal ? FRACTURE_MAX : Math.max(4, FRACTURE_MAX >> 1))
      : 0;

    return f;
  }
}

// ── Singleton convenience (optional — you can also instantiate per-replay) ─

export const bulletCamEngine = new BulletCamEngine();
