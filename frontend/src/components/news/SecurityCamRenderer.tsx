/**
 * SecurityCamRenderer.tsx
 * ---------------------------------------------------------------------------
 * A CCTV-style canvas replay component for the SLIDE / DEALT RPG.
 * Takes a DriveByEvent and replays the entire sequence from a high-angle
 * security-camera perspective with film grain, scanlines, and VHS jitter.
 *
 * Usage:
 *   <SecurityCamRenderer event={event} onComplete={() => setShow(false)} />
 *
 * Performance notes:
 *   - Film grain is generated ONCE on a 128×128 offscreen canvas and tiled
 *     via CanvasPattern. Each frame it is drawn with globalAlpha=0.1 at a
 *     random translate offset — zero per-pixel work per frame.
 *   - Bullet positions are computed analytically from the timeline (no
 *     physics simulation, no per-frame allocations).
 *   - All scratch state lives in refs or closure-local variables.
 * ---------------------------------------------------------------------------
 */

import { useEffect, useRef } from 'react';

// ── Types (re-exported for consumers) ──────────────────────────────────────

export interface DriveByShot {
  shooterId: string;
  targetX: number;
  targetY: number;
  hit: boolean;
  damage: number;
  timestamp: number;
}

export interface DriveByEvent {
  id: string;
  blockId: string;
  attackerGangName: string;
  vehicleType: 'sedan' | 'suv' | 'coupe' | 'van';
  phase: 'resolved';
  shots: DriveByShot[];
  defenderShots: DriveByShot[];
  casualties: string[];
  startedAt: number;
  resolvedAt: number;
  outcome: 'repelled' | 'successful' | 'fled';
}

export interface SecurityCamRendererProps {
  event: DriveByEvent;
  /** Override the auto-generated camera ID (e.g. "CAM-04"). */
  cameraId?: string;
  /** Override the auto-generated location label. */
  cameraLocation?: string;
  /** Loop the replay when it finishes (default: true). */
  loop?: boolean;
  /** Called once when the replay finishes and loop is false. */
  onComplete?: () => void;
  /** Optional extra className on the wrapper div. */
  className?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const NOISE_CANVAS_SIZE = 128;
const BULLET_TRAIL_SEGMENTS = 4;
const MIN_REPLAY_DURATION = 4_000;  // ms — stretch very short events
const MAX_REPLAY_DURATION = 30_000; // ms — compress very long events
const SCANLINE_SPACING = 3;          // px (in CSS pixels, scaled by dpr)

// Vehicle dimensions in world units (for top-down rendering)
const VEHICLE_DIMS: Record<DriveByEvent['vehicleType'], { w: number; h: number }> = {
  sedan: { w: 28, h: 14 },
  suv:   { w: 34, h: 18 },
  coupe: { w: 26, h: 12 },
  van:   { w: 42, h: 22 },
};

// ── Math helpers ───────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Deterministic seeded RNG for building layouts. */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash a string to a 32-bit int (for deterministic camera IDs). */
function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Format a timestamp as HH:MM:SS for the CCTV overlay. */
function formatTimecode(ms: number): string {
  const date = new Date(ms);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

/** Format a timestamp as YYYY-MM-DD HH:MM:SS. */
function formatFullTimestamp(ms: number): string {
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mo}-${da} ${formatTimecode(ms)}`;
}

// ── Noise canvas (created once per mount) ──────────────────────────────────

function createNoiseCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

// ── Scene computation ──────────────────────────────────────────────────────

interface SceneBounds {
  worldMinX: number;
  worldMaxX: number;
  worldMinY: number;
  worldMaxY: number;
  vehicleStartX: number;
  vehicleEndX: number;
  vehicleY: number;
  targetCentroidX: number;
  targetCentroidY: number;
  scale: number;
  screenOffsetX: number;
  screenOffsetY: number;
  buildingSeed: number;
}

function computeScene(
  event: DriveByEvent,
  canvasW: number,
  canvasH: number,
  dpr: number,
): SceneBounds {
  // Collect all target points from attacker shots
  const allX: number[] = [];
  const allY: number[] = [];

  for (const s of event.shots) {
    allX.push(s.targetX);
    allY.push(s.targetY);
  }
  for (const s of event.defenderShots) {
    allX.push(s.targetX);
    allY.push(s.targetY);
  }

  // Fallback if no shots at all
  if (allX.length === 0) {
    allX.push(0, 100);
    allY.push(0, 100);
  }

  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);

  const span = Math.max(maxX - minX, maxY - minY, 60);
  const margin = span * 0.35;

  // Vehicle path: drives horizontally across the top of the scene
  const vehicleStartX = minX - margin * 1.5;
  const vehicleEndX = maxX + margin * 1.5;
  const vehicleY = (minY + maxY) / 2 - span * 0.45;

  // Target centroid (where defenders stand)
  const targetCentroidX = allX.reduce((a, b) => a + b, 0) / allX.length;
  const targetCentroidY = allY.reduce((a, b) => a + b, 0) / allY.length;

  // World bounds (include vehicle path)
  const worldMinX = vehicleStartX - margin * 0.3;
  const worldMaxX = vehicleEndX + margin * 0.3;
  const worldMinY = Math.min(vehicleY, minY) - margin * 0.5;
  const worldMaxY = maxY + margin * 0.5;

  const worldW = worldMaxX - worldMinX;
  const worldH = worldMaxY - worldMinY;

  // Scale to fit canvas with padding
  const pad = 50 * dpr;
  const scaleX = (canvasW - pad * 2) / worldW;
  const scaleY = (canvasH - pad * 2) / worldH;
  const scale = Math.min(scaleX, scaleY);

  const screenOffsetX = (canvasW - worldW * scale) / 2;
  const screenOffsetY = (canvasH - worldH * scale) / 2;

  return {
    worldMinX,
    worldMaxX,
    worldMinY,
    worldMaxY,
    vehicleStartX,
    vehicleEndX,
    vehicleY,
    targetCentroidX,
    targetCentroidY,
    scale,
    screenOffsetX,
    screenOffsetY,
    buildingSeed: hashString(event.blockId),
  };
}

/** World → screen coordinate transform. */
function toScreenX(scene: SceneBounds, worldX: number, dpr: number): number {
  return (scene.screenOffsetX + (worldX - scene.worldMinX) * scene.scale) * dpr;
}

function toScreenY(scene: SceneBounds, worldY: number, dpr: number): number {
  return (scene.screenOffsetY + (worldY - scene.worldMinY) * scene.scale) * dpr;
}

function toScreenScale(scene: SceneBounds, worldUnits: number, dpr: number): number {
  return worldUnits * scene.scale * dpr;
}

// ── Bullet preparation ─────────────────────────────────────────────────────

interface BulletState {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  fireTime: number;       // event-time ms when bullet spawns
  travelDuration: number;  // ms for bullet to reach target
  isDefender: boolean;
  damage: number;
  hit: boolean;
  spawned: boolean;
  impacted: boolean;
}

function prepareBullets(event: DriveByEvent, scene: SceneBounds): BulletState[] {
  const bullets: BulletState[] = [];
  const realDuration = event.resolvedAt - event.startedAt || 1;

  // Attacker shots — fired from the vehicle
  for (const shot of event.shots) {
    const progress = clamp((shot.timestamp - event.startedAt) / realDuration, 0, 1);
    const startX = lerp(scene.vehicleStartX, scene.vehicleEndX, progress);
    const startY = scene.vehicleY;
    const dist = Math.hypot(shot.targetX - startX, shot.targetY - startY);
    const travelDuration = clamp(dist * 0.25, 60, 400);

    bullets.push({
      startX,
      startY,
      targetX: shot.targetX,
      targetY: shot.targetY,
      fireTime: shot.timestamp,
      travelDuration,
      isDefender: false,
      damage: shot.damage,
      hit: shot.hit,
      spawned: false,
      impacted: false,
    });
  }

  // Defender shots — fired from the sidewalk (near target cluster)
  const defenderCount = event.defenderShots.length;
  for (let i = 0; i < defenderCount; i++) {
    const shot = event.defenderShots[i];
    // Spread defenders along the sidewalk
    const spreadOffset = defenderCount > 1
      ? (i / (defenderCount - 1) - 0.5) * 40
      : 0;
    const startX = scene.targetCentroidX + spreadOffset;
    const startY = scene.targetCentroidY + 10;
    const dist = Math.hypot(shot.targetX - startX, shot.targetY - startY);
    const travelDuration = clamp(dist * 0.25, 60, 400);

    bullets.push({
      startX,
      startY,
      targetX: shot.targetX,
      targetY: shot.targetY,
      fireTime: shot.timestamp,
      travelDuration,
      isDefender: true,
      damage: shot.damage,
      hit: shot.hit,
      spawned: false,
      impacted: false,
    });
  }

  // Sort by fire time for deterministic processing
  bullets.sort((a, b) => a.fireTime - b.fireTime);
  return bullets;
}

function resetBullets(bullets: BulletState[]): void {
  for (const b of bullets) {
    b.spawned = false;
    b.impacted = false;
  }
}

// ── Drawing: Scene ─────────────────────────────────────────────────────────

function drawScene(
  ctx: CanvasRenderingContext2D,
  scene: SceneBounds,
  w: number,
  h: number,
  dpr: number,
  jitterX: number,
  jitterY: number,
): void {
  // Background: dark asphalt
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, w, h);

  // Apply jitter to scene elements only
  ctx.save();
  ctx.translate(jitterX, jitterY);

  // Street (horizontal band where vehicle drives)
  const streetY1 = toScreenY(scene, scene.vehicleY - 18, dpr);
  const streetY2 = toScreenY(scene, scene.vehicleY + 18, dpr);
  const streetH = streetY2 - streetY1;
  ctx.fillStyle = '#222';
  ctx.fillRect(0, streetY1, w, streetH);

  // Lane markings (dashed center line)
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1 * dpr;
  ctx.setLineDash([12 * dpr, 10 * dpr]);
  ctx.beginPath();
  const laneY = (streetY1 + streetY2) / 2;
  ctx.moveTo(0, laneY);
  ctx.lineTo(w, laneY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Buildings (deterministic grid based on seed)
  const rng = mulberry32(scene.buildingSeed);
  const blockSize = 35; // world units
  const buildingColor = '#2a2a28';
  const buildingColor2 = '#262624';

  const worldStartX = scene.worldMinX;
  const worldEndX = scene.worldMaxX;
  const worldStartY = scene.worldMaxY; // bottom of scene
  const sidewalkY = scene.targetCentroidY + 25;

  // Draw buildings below the street (in screen space, that's lower Y values
  // if we consider top-down with north = up; but in our mapping, higher
  // world Y = lower on screen. Let's draw buildings at world Y > sidewalkY.)
  for (let bx = worldStartX; bx < worldEndX; bx += blockSize) {
    for (let by = sidewalkY; by < worldStartY + blockSize * 2; by += blockSize * 0.7) {
      const skip = rng() < 0.25;
      if (skip) continue;

      const sx = toScreenX(scene, bx, dpr);
      const sy = toScreenY(scene, by, dpr);
      const sw = toScreenScale(scene, blockSize - 4, dpr);
      const sh = toScreenScale(scene, blockSize * 0.65, dpr);

      ctx.fillStyle = rng() < 0.5 ? buildingColor : buildingColor2;
      ctx.fillRect(sx, sy, sw, sh);

      // Roof outline
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 0.5 * dpr;
      ctx.strokeRect(sx, sy, sw, sh);
    }
  }

  // Sidewalk band (between street and buildings)
  const swY1 = toScreenY(scene, scene.vehicleY + 18, dpr);
  const swY2 = toScreenY(scene, sidewalkY, dpr);
  ctx.fillStyle = '#2c2c2a';
  ctx.fillRect(0, swY1, w, swY2 - swY1);

  ctx.restore();
}

// ── Drawing: Vehicle ──────────────────────────────────────────────────────

function drawVehicle(
  ctx: CanvasRenderingContext2D,
  scene: SceneBounds,
  event: DriveByEvent,
  vehicleX: number,
  vehicleY: number,
  dpr: number,
): void {
  const dims = VEHICLE_DIMS[event.vehicleType];
  const sx = toScreenX(scene, vehicleX, dpr);
  const sy = toScreenY(scene, vehicleY, dpr);
  const sw = toScreenScale(scene, dims.w, dpr);
  const sh = toScreenScale(scene, dims.h, dpr);

  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(sx - sw / 2 + 2 * dpr, sy - sh / 2 + 2 * dpr, sw, sh);

  // Body
  ctx.fillStyle = '#3a3a38';
  ctx.fillRect(sx - sw / 2, sy - sh / 2, sw, sh);

  // Windshield (lighter rectangle in front portion)
  const wsW = sw * 0.3;
  const wsH = sh * 0.7;
  ctx.fillStyle = '#4a4a48';
  ctx.fillRect(sx + sw * 0.1, sy - wsH / 2, wsW, wsH);

  // Roof
  ctx.fillStyle = '#2e2e2c';
  ctx.fillRect(sx - sw * 0.15, sy - sh * 0.35, sw * 0.25, sh * 0.7);

  // Outline
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 0.5 * dpr;
  ctx.strokeRect(sx - sw / 2, sy - sh / 2, sw, sh);
}

// ── Drawing: Targets (pedestrians on sidewalk) ─────────────────────────────

interface TargetMarker {
  x: number;
  y: number;
  hit: boolean;
  hitTime: number;
}

function prepareTargets(event: DriveByEvent, _scene: SceneBounds): TargetMarker[] {
  const targets: TargetMarker[] = [];
  const seen = new Set<string>();

  for (const shot of event.shots) {
    const key = `${shot.targetX},${shot.targetY}`;
    if (seen.has(key)) {
      // Update existing: mark as hit if this shot hit
      if (shot.hit) {
        const existing = targets.find(t =>
          t.x === shot.targetX && t.y === shot.targetY,
        );
        if (existing && !existing.hit) {
          existing.hit = true;
          existing.hitTime = shot.timestamp;
        }
      }
      continue;
    }
    seen.add(key);
    targets.push({
      x: shot.targetX,
      y: shot.targetY,
      hit: shot.hit,
      hitTime: shot.hit ? shot.timestamp : 0,
    });
  }

  return targets;
}

function drawTargets(
  ctx: CanvasRenderingContext2D,
  scene: SceneBounds,
  targets: TargetMarker[],
  eventTime: number,
  dpr: number,
): void {
  for (const t of targets) {
    const sx = toScreenX(scene, t.x, dpr);
    const sy = toScreenY(scene, t.y, dpr);
    const r = 3 * dpr;

    // Flinch effect: expand briefly after being hit
    let radius = r;
    let alpha = 0.7;

    if (t.hit && eventTime >= t.hitTime) {
      const timeSinceHit = eventTime - t.hitTime;
      if (timeSinceHit < 300) {
        const flinch = 1 - timeSinceHit / 300;
        radius = r * (1 + flinch * 0.8);
        alpha = 0.7 + flinch * 0.3;
      } else {
        // Fallen (smaller, darker)
        radius = r * 0.6;
        alpha = 0.4;
      }
    }

    ctx.fillStyle = `rgba(180, 180, 175, ${alpha})`;
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fill();

    // If fallen, draw a small elongated shape (body on ground)
    if (t.hit && eventTime >= t.hitTime + 300) {
      ctx.fillStyle = 'rgba(120, 120, 115, 0.5)';
      ctx.beginPath();
      ctx.ellipse(sx, sy, r * 1.8, r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ── Drawing: Bullets ──────────────────────────────────────────────────────

function drawBullets(
  ctx: CanvasRenderingContext2D,
  bullets: BulletState[],
  scene: SceneBounds,
  eventTime: number,
  dpr: number,
): void {
  for (const b of bullets) {
    if (!b.spawned || b.impacted) continue;

    const progress = clamp((eventTime - b.fireTime) / b.travelDuration, 0, 1);

    // Current bullet position
    const bx = lerp(b.startX, b.targetX, progress);
    const by = lerp(b.startY, b.targetY, progress);
    const sx = toScreenX(scene, bx, dpr);
    const sy = toScreenY(scene, by, dpr);

    // Trail (computed analytically — no stored history)
    for (let i = BULLET_TRAIL_SEGMENTS; i >= 1; i--) {
      const tp = clamp(progress - i * 0.04, 0, 1);
      const tx = lerp(b.startX, b.targetX, tp);
      const ty = lerp(b.startY, b.targetY, tp);
      const ssx = toScreenX(scene, tx, dpr);
      const ssy = toScreenY(scene, ty, dpr);
      const trailAlpha = (1 - i / BULLET_TRAIL_SEGMENTS) * 0.4;

      ctx.fillStyle = `rgba(220, 220, 200, ${trailAlpha})`;
      ctx.beginPath();
      ctx.arc(ssx, ssy, 1 * dpr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bullet head — bright dot
    ctx.fillStyle = 'rgba(240, 240, 220, 0.95)';
    ctx.beginPath();
    ctx.arc(sx, sy, 2 * dpr, 0, Math.PI * 2);
    ctx.fill();

    // Glow
    ctx.fillStyle = 'rgba(240, 240, 220, 0.2)';
    ctx.beginPath();
    ctx.arc(sx, sy, 5 * dpr, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Drawing: Muzzle flashes ────────────────────────────────────────────────

function drawMuzzleFlashes(
  ctx: CanvasRenderingContext2D,
  bullets: BulletState[],
  scene: SceneBounds,
  eventTime: number,
  dpr: number,
): void {
  const FLASH_DURATION = 120; // ms

  for (const b of bullets) {
    if (!b.spawned) continue;
    const timeSinceSpawn = eventTime - b.fireTime;
    if (timeSinceSpawn > FLASH_DURATION) continue;

    const intensity = 1 - timeSinceSpawn / FLASH_DURATION;
    const sx = toScreenX(scene, b.startX, dpr);
    const sy = toScreenY(scene, b.startY, dpr);
    const r = (4 + intensity * 6) * dpr;

    // Bright flash
    ctx.fillStyle = `rgba(255, 255, 230, ${intensity * 0.8})`;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();

    // Dimmer glow
    ctx.fillStyle = `rgba(255, 255, 230, ${intensity * 0.2})`;
    ctx.beginPath();
    ctx.arc(sx, sy, r * 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Drawing: Impacts ───────────────────────────────────────────────────────

function drawImpacts(
  ctx: CanvasRenderingContext2D,
  bullets: BulletState[],
  scene: SceneBounds,
  eventTime: number,
  dpr: number,
): void {
  const IMPACT_DURATION = 600; // ms

  for (const b of bullets) {
    if (!b.impacted) continue;

    const impactTime = b.fireTime + b.travelDuration;
    const timeSinceImpact = eventTime - impactTime;
    if (timeSinceImpact > IMPACT_DURATION) {
      // Persistent blood splatter (dark stain on ground)
      const sx = toScreenX(scene, b.targetX, dpr);
      const sy = toScreenY(scene, b.targetY, dpr);
      ctx.fillStyle = 'rgba(30, 30, 30, 0.5)';
      ctx.beginPath();
      ctx.arc(sx, sy, 2.5 * dpr, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    const progress = timeSinceImpact / IMPACT_DURATION;
    const fade = 1 - progress;

    const sx = toScreenX(scene, b.targetX, dpr);
    const sy = toScreenY(scene, b.targetY, dpr);

    // Expanding shockwave ring
    const ringR = lerp(3, 14, easeOutCubic(progress)) * dpr;
    ctx.strokeStyle = `rgba(200, 200, 190, ${fade * 0.6})`;
    ctx.lineWidth = 1.5 * dpr;
    ctx.beginPath();
    ctx.arc(sx, sy, ringR, 0, Math.PI * 2);
    ctx.stroke();

    // Bright center
    ctx.fillStyle = `rgba(230, 230, 210, ${fade * 0.7})`;
    ctx.beginPath();
    ctx.arc(sx, sy, 3 * dpr * fade, 0, Math.PI * 2);
    ctx.fill();

    // Debris particles (deterministic from position)
    const seed = Math.floor(b.targetX * 1000 + b.targetY);
    const rng = mulberry32(seed);
    for (let i = 0; i < 6; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = lerp(0, 12, easeOutCubic(progress)) * dpr;
      const px = sx + Math.cos(angle) * dist;
      const py = sy + Math.sin(angle) * dist;
      const ps = (1.5 * fade) * dpr;
      ctx.fillStyle = `rgba(180, 180, 170, ${fade * 0.5})`;
      ctx.beginPath();
      ctx.arc(px, py, ps, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ── Drawing: Scanlines ────────────────────────────────────────────────────

function drawScanlines(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  dpr: number,
): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
  const step = SCANLINE_SPACING * dpr;
  for (let y = 0; y < h; y += step) {
    ctx.fillRect(0, y, w, 1 * dpr);
  }
}

// ── Drawing: Film grain (from pre-generated noise canvas) ──────────────────

function drawGrain(
  ctx: CanvasRenderingContext2D,
  pattern: CanvasPattern | null,
  w: number,
  h: number,
): void {
  if (!pattern) return;
  ctx.save();
  ctx.globalAlpha = 0.1;
  const ox = Math.random() * NOISE_CANVAS_SIZE;
  const oy = Math.random() * NOISE_CANVAS_SIZE;
  ctx.translate(-ox, -oy);
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, w + ox, h + oy);
  ctx.restore();
}

// ── Drawing: VHS tracking error ────────────────────────────────────────────

function drawTrackingError(
  ctx: CanvasRenderingContext2D,
  _canvas: HTMLCanvasElement,
  w: number,
  h: number,
  dpr: number,
): void {
  if (Math.random() > 0.015) return; // ~1.5% chance per frame

  const bandY = Math.random() * h;
  const bandH = (8 + Math.random() * 12) * dpr;
  const shift = (Math.random() - 0.5) * 24 * dpr;

  // Capture the band and redraw it shifted
  try {
    const band = ctx.getImageData(0, bandY, w, bandH);
    // Clear the original band area
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, bandY, w, bandH);
    // Redraw shifted
    ctx.putImageData(band, shift, bandY);
  } catch {
    // getImageData can fail if canvas is tainted; silently skip
  }
}

// ── Drawing: CCTV overlays ────────────────────────────────────────────────

function drawOverlays(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  dpr: number,
  cameraId: string,
  cameraLocation: string,
  eventTime: number,
  progress: number,
): void {
  // Top bar background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(0, 0, w, 32 * dpr);

  // REC indicator (blinking)
  const blink = Math.floor(performance.now() / 600) % 2 === 0;
  ctx.font = `${13 * dpr}px monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  if (blink) {
    ctx.fillStyle = '#cc3333';
    ctx.beginPath();
    ctx.arc(14 * dpr, 16 * dpr, 4 * dpr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#b0b0a8';
  ctx.fillText(`REC`, 26 * dpr, 16 * dpr);

  // Camera ID + location (center top)
  ctx.fillStyle = '#b0b0a8';
  ctx.textAlign = 'center';
  ctx.fillText(`${cameraId}: ${cameraLocation}`, w / 2, 16 * dpr);

  // Timestamp (right top)
  ctx.textAlign = 'right';
  ctx.fillText(formatTimecode(eventTime), w - 14 * dpr, 16 * dpr);

  // Bottom bar background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(0, h - 24 * dpr, w, 24 * dpr);

  // Bottom: full timestamp (left)
  ctx.font = `${10 * dpr}px monospace`;
  ctx.fillStyle = '#888880';
  ctx.textAlign = 'left';
  ctx.fillText(formatFullTimestamp(eventTime), 14 * dpr, h - 12 * dpr);

  // Bottom: playback label (right)
  ctx.textAlign = 'right';
  ctx.fillText('PLAYBACK', w - 14 * dpr, h - 12 * dpr);

  // Progress bar (bottom edge)
  const barY = h - 2 * dpr;
  const barH = 2 * dpr;
  ctx.fillStyle = 'rgba(60, 60, 60, 0.8)';
  ctx.fillRect(0, barY, w, barH);
  ctx.fillStyle = '#88aaff';
  ctx.fillRect(0, barY, w * progress, barH);
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function SecurityCamRenderer({
  event,
  cameraId,
  cameraLocation,
  loop = true,
  onComplete,
  className,
}: SecurityCamRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Use refs for props the animation loop needs to avoid re-triggering the effect
  const loopRef = useRef(loop);
  const onCompleteRef = useRef(onComplete);
  loopRef.current = loop;
  onCompleteRef.current = onComplete;

  // Auto-generate camera info if not provided
  const camInfo = { id: cameraId, location: cameraLocation };
  if (!camInfo.id || !camInfo.location) {
    const hash = hashString(event.blockId);
    const num = String((hash % 98) + 1).padStart(2, '0');
    if (!camInfo.id) camInfo.id = `CAM-${num}`;
    if (!camInfo.location) camInfo.location = event.blockId.replace(/[-_]/g, ' ').toUpperCase();
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // ── Setup: noise canvas + pattern ──────────────────────────────────────

    const noiseCanvas = createNoiseCanvas(NOISE_CANVAS_SIZE);
    let noisePattern: CanvasPattern | null = ctx.createPattern(noiseCanvas, 'repeat');

    // ── Setup: resize handler ─────────────────────────────────────────────

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      // Recreate pattern after resize (context state may have been reset)
      noisePattern = ctx.createPattern(noiseCanvas, 'repeat');
    };
    resize();
    window.addEventListener('resize', resize);

    // ── Setup: timeline scaling ────────────────────────────────────────────

    const realDuration = event.resolvedAt - event.startedAt || 1;
    const replayDuration = clamp(realDuration, MIN_REPLAY_DURATION, MAX_REPLAY_DURATION);
    const timeScale = realDuration / replayDuration; // <1 = slow-mo, >1 = fast-forward

    // ── Setup: scene + bullets + targets (computed once) ───────────────────

    let scene: SceneBounds;
    let bullets: BulletState[];
    let targets: TargetMarker[];

    const recomputeScene = () => {
      const dpr = window.devicePixelRatio || 1;
      scene = computeScene(event, canvas.width, canvas.height, dpr);
      bullets = prepareBullets(event, scene);
      targets = prepareTargets(event, scene);
    };
    recomputeScene();

    // Also recompute scene on resize (scale changes)
    const onResizeRecompute = () => recomputeScene();
    window.addEventListener('resize', onResizeRecompute);

    // ── Animation loop ─────────────────────────────────────────────────────

    let rafId = 0;
    let replayStartTime = performance.now();
    let stopped = false;

    const render = () => {
      if (stopped) return;

      const now = performance.now();
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width;
      const h = canvas.height;

      // Map replay time → event time
      const elapsed = now - replayStartTime;
      const eventElapsed = elapsed * timeScale;
      const eventTime = event.startedAt + eventElapsed;
      const progress = clamp(elapsed / replayDuration, 0, 1);

      // Check for completion
      if (elapsed >= replayDuration) {
        if (loopRef.current) {
          // Loop: reset
          replayStartTime = now;
          resetBullets(bullets);
        } else {
          // Finish: draw final frame, call onComplete
          onCompleteRef.current?.();
          return;
        }
      }

      // Update bullet states
      for (const b of bullets) {
        if (!b.spawned && eventTime >= b.fireTime) {
          b.spawned = true;
        }
        if (b.spawned && !b.impacted && eventTime >= b.fireTime + b.travelDuration) {
          b.impacted = true;
        }
      }

      // ── Compute vehicle position ──────────────────────────────────────────

      const vehicleProgress = clamp(eventElapsed / realDuration, 0, 1);
      const vehicleX = lerp(scene.vehicleStartX, scene.vehicleEndX, vehicleProgress);
      const vehicleY = scene.vehicleY;

      // If outcome is 'fled', speed up vehicle near the end
      let actualVehicleX = vehicleX;
      if (event.outcome === 'fled' && vehicleProgress > 0.75) {
        const boost = (vehicleProgress - 0.75) / 0.25;
        actualVehicleX = lerp(vehicleX, scene.vehicleEndX * 1.15, boost);
      }

      // ── Camera shake on impacts ───────────────────────────────────────────

      let shakeX = 0;
      let shakeY = 0;
      for (const b of bullets) {
        if (!b.impacted) continue;
        const impactTime = b.fireTime + b.travelDuration;
        const since = eventTime - impactTime;
        if (since >= 0 && since < 150) {
          const strength = (1 - since / 150) * 3 * dpr;
          shakeX = (Math.random() - 0.5) * strength;
          shakeY = (Math.random() - 0.5) * strength;
          break;
        }
      }

      // ── VHS jitter ─────────────────────────────────────────────────────────

      let jitterX = 0;
      const jitterY = 0;
      if (Math.random() < 0.04) {
        jitterX = (Math.random() - 0.5) * 5 * dpr;
      }

      // ── Clear ──────────────────────────────────────────────────────────────

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, w, h);

      // ── Draw scene (with jitter + shake) ───────────────────────────────────

      ctx.save();
      ctx.translate(shakeX, shakeY);
      drawScene(ctx, scene, w, h, dpr, jitterX, jitterY);

      // ── Draw targets ──────────────────────────────────────────────────────

      drawTargets(ctx, scene, targets, eventTime, dpr);

      // ── Draw vehicle ──────────────────────────────────────────────────────

      // Only draw vehicle if it's within the scene timeline
      if (vehicleProgress <= 1.05) {
        drawVehicle(ctx, scene, event, actualVehicleX, vehicleY, dpr);
      }

      // ── Draw bullets ──────────────────────────────────────────────────────

      drawBullets(ctx, bullets, scene, eventTime, dpr);

      // ── Draw muzzle flashes ───────────────────────────────────────────────

      drawMuzzleFlashes(ctx, bullets, scene, eventTime, dpr);

      // ── Draw impacts ──────────────────────────────────────────────────────

      drawImpacts(ctx, bullets, scene, eventTime, dpr);

      ctx.restore();

      // ── Post-processing: tracking error (VHS glitch) ──────────────────────

      drawTrackingError(ctx, canvas, w, h, dpr);

      // ── Film grain ─────────────────────────────────────────────────────────

      drawGrain(ctx, noisePattern, w, h);

      // ── Scanlines ─────────────────────────────────────────────────────────

      drawScanlines(ctx, w, h, dpr);

      // ── Vignette ───────────────────────────────────────────────────────────

      const vignette = ctx.createRadialGradient(
        w / 2, h / 2, Math.min(w, h) * 0.35,
        w / 2, h / 2, Math.max(w, h) * 0.7,
      );
      vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vignette.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);

      // ── Overlays (REC, timestamp, camera ID, progress) ─────────────────────

      drawOverlays(ctx, w, h, dpr, camInfo.id!, camInfo.location!, eventTime, progress);

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);

    // ── Cleanup ────────────────────────────────────────────────────────────

    return () => {
      stopped = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('resize', onResizeRecompute);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);

  return (
    <div className={`fixed inset-0 z-[9999] bg-black ${className ?? ''}`}>
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}
