/**
 * BulletCamReplay.tsx
 * ---------------------------------------------------------------------------
 * Full-screen <canvas> overlay that renders the cinematic bullet-cam replay.
 * Consumes BulletCamEngine for all math; this file is purely rendering.
 *
 * Usage:
 *   <BulletCamReplay shot={shotData} onComplete={() => setShot(null)} />
 *
 * The component mounts, plays the full replay, and calls onComplete when
 * the engine reaches 'resolved'.
 *
 * Toggle the "security camera" mode by passing `mode="cctv"` instead of the
 * default `mode="bulletcam"`.
 * ---------------------------------------------------------------------------
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  BulletCamEngine,
  type BulletCamFrameState,
  type BulletCamPhase,
  type DriveByShot,
  TOTAL_DURATION,
} from '../../utils/BulletCamEngine';

// ── Component props ────────────────────────────────────────────────────────

export type ReplayMode = 'bulletcam' | 'cctv';

export interface BulletCamReplayProps {
  shot: DriveByShot;
  mode?: ReplayMode;
  /** Called once when the replay timeline reaches 'resolved'. */
  onComplete?: () => void;
  /** Called every phase change with the new phase. */
  onPhaseChange?: (phase: BulletCamPhase) => void;
  /** Optional CSS class for the wrapper div. */
  className?: string;
}

// ── Internal constants ────────────────────────────────────────────────────

const SPEED_LINE_COUNT = 28;       // radial speed lines around screen edges
const PARTICLE_COUNT = 40;          // impact debris particles

// Pre-allocated speed line scratch (angle, length, offset)
const SPEED_LINES = new Float32Array(SPEED_LINE_COUNT * 3);
{
  const rng = mulberry32Lite(42);
  for (let i = 0; i < SPEED_LINE_COUNT; i++) {
    const idx = i * 3;
    SPEED_LINES[idx] = rng() * Math.PI * 2;     // angle
    SPEED_LINES[idx + 1] = 0.3 + rng() * 0.5;   // length factor
    SPEED_LINES[idx + 2] = rng() * 200;         // offset px
  }
}

// Pre-allocated particle scratch (x, y, vx, vy, life)
const PARTICLES = new Float32Array(PARTICLE_COUNT * 5);
{
  const rng = mulberry32Lite(99);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const idx = i * 5;
    const a = rng() * Math.PI * 2;
    const speed = 30 + rng() * 120;
    PARTICLES[idx] = 0;      // x (set at impact)
    PARTICLES[idx + 1] = 0;  // y
    PARTICLES[idx + 2] = Math.cos(a) * speed;
    PARTICLES[idx + 3] = Math.sin(a) * speed;
    PARTICLES[idx + 4] = 1;  // life 1→0
  }
}

// ── Tiny seeded RNG (different seed from engine to avoid coupling) ─────────

function mulberry32Lite(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Utility: format timestamp for CCTV overlay ─────────────────────────────

function formatTimestamp(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = String(Math.floor(total / 3600) % 24).padStart(2, '0');
  const m = String(Math.floor(total / 60) % 60).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function BulletCamReplay({
  shot,
  mode = 'bulletcam',
  onComplete,
  onPhaseChange,
  className,
}: BulletCamReplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BulletCamEngine>(new BulletCamEngine());
  const rafRef = useRef<number>(0);
  const phaseRef = useRef<BulletCamPhase>('idle');
  const cctvStartRef = useRef<number>(0);

  const [visible, setVisible] = useState(true);

  // ── Main animation loop ─────────────────────────────────────────────────

  const renderLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const engine = engineRef.current;
    const now = performance.now();
    const frame = engine.update(now);

    if (!frame) {
      rafRef.current = requestAnimationFrame(renderLoop);
      return;
    }

    // Phase change notification
    if (frame.phase !== phaseRef.current) {
      phaseRef.current = frame.phase;
      onPhaseChange?.(frame.phase);

      if (frame.phase === 'impact') {
        // Initialize particles at impact point
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const idx = i * 5;
          PARTICLES[idx] = shot.targetX;
          PARTICLES[idx + 1] = shot.targetY;
          PARTICLES[idx + 4] = 1; // reset life
        }
      }

      if (frame.phase === 'resolved') {
        setVisible(false);
        onComplete?.();
        return; // stop loop
      }
    }

    const w = canvas.width;
    const h = canvas.height;
    const dpr = window.devicePixelRatio || 1;

    // ── Clear ─────────────────────────────────────────────────────────────

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // ── Mode dispatch ─────────────────────────────────────────────────────

    if (mode === 'cctv') {
      renderCCTV(ctx, frame, w, h, dpr, shot);
    } else {
      renderBulletCam(ctx, frame, w, h, dpr, shot);
    }

    ctx.restore();

    rafRef.current = requestAnimationFrame(renderLoop);
  }, [mode, onPhaseChange, onComplete, shot]);

  // ── Setup & teardown ─────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    };
    resize();
    window.addEventListener('resize', resize);

    // Start the engine
    const engine = engineRef.current;
    engine.start(shot);
    phaseRef.current = 'idle';
    cctvStartRef.current = shot.timestamp;
    setVisible(true);

    rafRef.current = requestAnimationFrame(renderLoop);

    // Safety timeout: force-complete after total duration + 500ms grace
    const safetyTimer = window.setTimeout(() => {
      if (engine.isActive()) {
        engine.stop();
        setVisible(false);
        onComplete?.();
      }
    }, TOTAL_DURATION + 500);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafRef.current);
      window.clearTimeout(safetyTimer);
      engine.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] pointer-events-none ${className ?? ''}`}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// RENDERER: Bullet-Cam Mode
// ════════════════════════════════════════════════════════════════════════════

function renderBulletCam(
  ctx: CanvasRenderingContext2D,
  f: BulletCamFrameState,
  w: number,
  h: number,
  dpr: number,
  shot: DriveByShot,
): void {
  const cx = w / 2;
  const cy = h / 2;

  // ── Background: dark cinematic vignette ─────────────────────────────────

  // We translate to screen center, apply zoom + camera offset + rotation,
  // then draw everything in "world space" relative to camera.

  // Compute camera-to-screen transform
  const camOffsetX = cx - f.cameraX * dpr * f.zoom;
  const camOffsetY = cy - f.cameraY * dpr * f.zoom;

  // Fill base dark background
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, w, h);

  // ── Phase: X-Ray ─────────────────────────────────────────────────────────

  if (f.phase === 'xray' && f.xrayOpacity > 0) {
    // Draw the x-ray layer first, then overlay on top
    drawXrayLayer(ctx, f, w, h, dpr, camOffsetX, camOffsetY, f.zoom, cx, cy);
    return; // xray phase handles its own full-screen rendering
  }

  // ── Apply camera transform ───────────────────────────────────────────────

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(f.cameraRotation);
  ctx.scale(f.zoom, f.zoom);
  ctx.translate(-f.cameraX * dpr, -f.cameraY * dpr);

  // ── Street / environment hint (simple gradient floor) ─────────────────────

  const grad = ctx.createLinearGradient(0, shot.startY * dpr - 100, 0, shot.targetY * dpr + 200);
  grad.addColorStop(0, '#1a1a2e');
  grad.addColorStop(0.5, '#16213e');
  grad.addColorStop(1, '#0f0f1a');
  ctx.fillStyle = grad;
  const envPad = 600 * dpr;
  ctx.fillRect(
    Math.min(shot.startX, shot.targetX) * dpr - envPad,
    Math.min(shot.startY, shot.targetY) * dpr - envPad,
    Math.abs(shot.targetX - shot.startX) * dpr + envPad * 2,
    Math.abs(shot.targetY - shot.startY) * dpr + envPad * 2,
  );

  // ── Trail ────────────────────────────────────────────────────────────────

  if (f.trailCount > 0 && f.phase !== 'resolved') {
    drawTrail(ctx, f, dpr);
  }

  // ── Bullet ───────────────────────────────────────────────────────────────

  if (f.bulletVisible) {
    drawBullet(ctx, f, dpr);
  }

  // ── Speed lines (drawn in screen space, so restore first) ─────────────────

  ctx.restore();

  if (f.speedLineIntensity > 0.01) {
    drawSpeedLines(ctx, f, w, h, dpr);
  }

  // ── Impact flash ─────────────────────────────────────────────────────────

  if (f.flashIntensity > 0.01) {
    ctx.fillStyle = `rgba(255, 255, 255, ${f.flashIntensity})`;
    ctx.fillRect(0, 0, w, h);
  }

  // ── Shockwave ring ───────────────────────────────────────────────────────

  if (f.shockwaveRadius > 0.01) {
    const impactScreenX = camOffsetX + f.cameraX * dpr * f.zoom;
    // After restore we need to recompute. Simpler: use cx/cy as impact is centered.
    const ringR = f.shockwaveRadius * Math.max(w, h) * 0.5;
    ctx.strokeStyle = `rgba(255, 80, 80, ${1 - f.shockwaveRadius})`;
    ctx.lineWidth = 3 * dpr;
    ctx.beginPath();
    ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
    ctx.stroke();

    // Inner ring
    ctx.strokeStyle = `rgba(255, 200, 200, ${(1 - f.shockwaveRadius) * 0.5})`;
    ctx.lineWidth = 1 * dpr;
    ctx.beginPath();
    ctx.arc(cx, cy, ringR * 0.7, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ── Impact particles ─────────────────────────────────────────────────────

  if (f.phase === 'impact' || (f.phase === 'xray' && f.phaseProgress < 0.3)) {
    drawImpactParticles(ctx, f, w, h, dpr, cx, cy, f.zoom);
  }

  // ── Vignette ─────────────────────────────────────────────────────────────

  drawVignette(ctx, w, h);

  // ── Letterbox bars ───────────────────────────────────────────────────────

  const barH = h * 0.08;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, barH);
  ctx.fillRect(0, h - barH, w, barH);

  // ── Time dilation indicator (subtle) ─────────────────────────────────────

  if (f.phase === 'travel' || f.phase === 'impact') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = `${12 * dpr}px monospace`;
    ctx.textAlign = 'left';
    ctx.fillText(
      `×${f.timeDilation.toFixed(2)} SPEED`,
      20 * dpr,
      h - barH - 12 * dpr,
    );
  }
}

// ════════════════════════════════════════════════════════════════════════════
// RENDERER: Security Camera (CCTV) Mode
// ════════════════════════════════════════════════════════════════════════════

function renderCCTV(
  ctx: CanvasRenderingContext2D,
  f: BulletCamFrameState,
  w: number,
  h: number,
  dpr: number,
  shot: DriveByShot,
): void {
  const cx = w / 2;
  const cy = h / 2;

  // High-angle camera: more zoom-out, top-down feel
  const cctvZoom = f.zoom * 0.45; // wider view

  // ── Grayscale + grainy base ───────────────────────────────────────────────

  // Fill with dark gray-green CCTV background
  ctx.fillStyle = '#1a1f1a';
  ctx.fillRect(0, 0, w, h);

  // Apply transform (high angle = less rotation, wider)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(cctvZoom, cctvZoom);
  ctx.translate(-f.cameraX * dpr, -f.cameraY * dpr);

  // Simple "street" representation — rectangles for buildings
  const envPad = 400 * dpr;
  const minX = Math.min(shot.startX, shot.targetX) * dpr - envPad;
  const minY = Math.min(shot.startY, shot.targetY) * dpr - envPad;
  const envW = Math.abs(shot.targetX - shot.startX) * dpr + envPad * 2;
  const envH = Math.abs(shot.targetY - shot.startY) * dpr + envPad * 2;

  // Street
  ctx.fillStyle = '#2a2e28';
  ctx.fillRect(minX, minY, envW, envH);

  // Building blocks (deterministic pattern)
  ctx.fillStyle = '#1e221e';
  const block = 80 * dpr;
  for (let bx = minX; bx < minX + envW; bx += block) {
    for (let by = minY; by < minY + envH; by += block) {
      if (((bx + by) / block) % 3 === 0) {
        ctx.fillRect(bx, by, block - 4 * dpr, block - 4 * dpr);
      }
    }
  }

  // ── Trail (grayscale) ─────────────────────────────────────────────────────

  if (f.trailCount > 0 && f.phase !== 'resolved') {
    for (let i = 0; i < f.trailCount; i++) {
      const idx = i * 4;
      const tx = f.trail[idx];
      const ty = f.trail[idx + 1];
      const age = f.trail[idx + 2];
      const intensity = f.trail[idx + 3];
      const alpha = Math.max(0, (1 - age / 30) * intensity * 0.6);
      if (alpha < 0.02) continue;
      ctx.fillStyle = `rgba(200, 210, 190, ${alpha})`;
      ctx.beginPath();
      ctx.arc(tx * dpr, ty * dpr, 2 * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Bullet (bright dot) ──────────────────────────────────────────────────

  if (f.bulletVisible) {
    ctx.fillStyle = '#e8e8e0';
    ctx.beginPath();
    ctx.arc(f.bulletX * dpr, f.bulletY * dpr, 3 * dpr, 0, Math.PI * 2);
    ctx.fill();

    // Glow
    ctx.fillStyle = 'rgba(232, 232, 224, 0.3)';
    ctx.beginPath();
    ctx.arc(f.bulletX * dpr, f.bulletY * dpr, 8 * dpr, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // ── Impact flash (CCTV: brief white-out) ─────────────────────────────────

  if (f.flashIntensity > 0.01) {
    ctx.fillStyle = `rgba(255, 255, 255, ${f.flashIntensity * 0.6})`;
    ctx.fillRect(0, 0, w, h);
  }

  // ── Scanlines ────────────────────────────────────────────────────────────

  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  for (let y = 0; y < h; y += 3 * dpr) {
    ctx.fillRect(0, y, w, 1 * dpr);
  }

  // ── Film grain ───────────────────────────────────────────────────────────

  // Module-level grain animation (renderCCTV is a pure function, no component refs)
  const grainSeed = Math.floor(performance.now() / 16) % 256;
  const grainRng = mulberry32Lite(grainSeed);
  ctx.globalAlpha = 0.06;
  for (let i = 0; i < 80; i++) {
    const gx = grainRng() * w;
    const gy = grainRng() * h;
    const gs = (1 + grainRng() * 2) * dpr;
    ctx.fillStyle = grainRng() > 0.5 ? '#ffffff' : '#000000';
    ctx.fillRect(gx, gy, gs, gs);
  }
  ctx.globalAlpha = 1;

  // ── CCTV overlay ─────────────────────────────────────────────────────────

  // Top bar
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, 0, w, 36 * dpr);

  ctx.fillStyle = '#c0c0b0';
  ctx.font = `${14 * dpr}px monospace`;
  ctx.textAlign = 'left';
  ctx.fillText('REC', 12 * dpr, 24 * dpr);

  // Blinking REC dot
  if (Math.floor(performance.now() / 500) % 2 === 0) {
    ctx.fillStyle = '#cc3333';
    ctx.beginPath();
    ctx.arc(48 * dpr, 19 * dpr, 4 * dpr, 0, Math.PI * 2);
    ctx.fill();
  }

  // Timestamp
  ctx.fillStyle = '#c0c0b0';
  ctx.textAlign = 'right';
  const ts = formatTimestamp(f.elapsed + (shot.timestamp || 0));
  ctx.fillText(ts, w - 12 * dpr, 24 * dpr);

  // Camera ID
  ctx.textAlign = 'center';
  ctx.fillText('CAM-07 // STREET LEVEL', cx, 24 * dpr);

  // Bottom info bar
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(0, h - 28 * dpr, w, 28 * dpr);
  ctx.fillStyle = '#888880';
  ctx.font = `${11 * dpr}px monospace`;
  ctx.textAlign = 'left';
  ctx.fillText(`DAMAGE: ${f.damage}${f.isLethal ? ' [LETHAL]' : ''}`, 12 * dpr, h - 10 * dpr);
  ctx.textAlign = 'right';
  ctx.fillText(`PHASE: ${f.phase.toUpperCase()}`, w - 12 * dpr, h - 10 * dpr);

  // Corner brackets (CCTV framing)
  const brk = 20 * dpr;
  ctx.strokeStyle = 'rgba(180, 180, 160, 0.5)';
  ctx.lineWidth = 2 * dpr;
  // Top-left
  ctx.beginPath();
  ctx.moveTo(0, brk); ctx.lineTo(0, 0); ctx.lineTo(brk, 0);
  ctx.stroke();
  // Top-right
  ctx.beginPath();
  ctx.moveTo(w - brk, 0); ctx.lineTo(w, 0); ctx.lineTo(w, brk);
  ctx.stroke();
  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(0, h - brk); ctx.lineTo(0, h); ctx.lineTo(brk, h);
  ctx.stroke();
  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(w - brk, h); ctx.lineTo(w, h); ctx.lineTo(w, h - brk);
  ctx.stroke();
}

// ════════════════════════════════════════════════════════════════════════════
// SUB-RENDERERS
// ════════════════════════════════════════════════════════════════════════════

function drawTrail(
  ctx: CanvasRenderingContext2D,
  f: BulletCamFrameState,
  dpr: number,
): void {
  for (let i = 0; i < f.trailCount; i++) {
    const idx = i * 4;
    const tx = f.trail[idx];
    const ty = f.trail[idx + 1];
    const age = f.trail[idx + 2];
    const intensity = f.trail[idx + 3];

    const alpha = Math.max(0, (1 - age / 28) * intensity);
    if (alpha < 0.02) continue;

    // Trail dot — hot orange/white core
    const radius = (3 - age * 0.06) * dpr;
    if (radius <= 0) continue;

    ctx.fillStyle = `rgba(255, 220, 100, ${alpha * 0.4})`;
    ctx.beginPath();
    ctx.arc(tx * dpr, ty * dpr, radius * 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(255, 255, 240, ${alpha})`;
    ctx.beginPath();
    ctx.arc(tx * dpr, ty * dpr, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBullet(
  ctx: CanvasRenderingContext2D,
  f: BulletCamFrameState,
  dpr: number,
): void {
  const x = f.bulletX * dpr;
  const y = f.bulletY * dpr;
  const angle = f.bulletAngle;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Bullet body — elongated capsule
  const len = 12 * dpr;
  const r = 2 * dpr;

  // Glow
  ctx.fillStyle = 'rgba(255, 200, 80, 0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 0, len * 1.8, r * 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Core
  ctx.fillStyle = '#fff8e0';
  ctx.beginPath();
  ctx.ellipse(0, 0, len, r, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tip highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.beginPath();
  ctx.ellipse(len * 0.4, 0, r * 0.8, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawSpeedLines(
  ctx: CanvasRenderingContext2D,
  f: BulletCamFrameState,
  w: number,
  h: number,
  dpr: number,
): void {
  const cx = w / 2;
  const cy = h / 2;
  const intensity = f.speedLineIntensity;
  const maxLen = Math.max(w, h) * 0.6;

  ctx.strokeStyle = `rgba(255, 240, 220, ${intensity * 0.5})`;
  ctx.lineWidth = 1.5 * dpr;

  for (let i = 0; i < SPEED_LINE_COUNT; i++) {
    const idx = i * 3;
    const angle = SPEED_LINES[idx];
    const lenFactor = SPEED_LINES[idx + 1];
    const offset = SPEED_LINES[idx + 2];

    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    // Lines emanate from center, offset outward
    const startR = offset + maxLen * 0.15;
    const lineLen = maxLen * lenFactor * intensity;

    const sx = cx + dx * startR;
    const sy = cy + dy * startR;
    const ex = sx + dx * lineLen;
    const ey = sy + dy * lineLen;

    ctx.globalAlpha = intensity * (0.3 + (i % 7) / 20);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawImpactParticles(
  ctx: CanvasRenderingContext2D,
  _f: BulletCamFrameState,
  _w: number,
  _h: number,
  dpr: number,
  cx: number,
  cy: number,
  zoom: number,
): void {
  const dt = 1 / 60; // approximate frame delta

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const idx = i * 5;
    const life = PARTICLES[idx + 4];
    if (life <= 0) continue;

    // Update position
    PARTICLES[idx] += PARTICLES[idx + 2] * dt;
    PARTICLES[idx + 1] += PARTICLES[idx + 3] * dt;
    // Gravity
    PARTICLES[idx + 3] += 200 * dt;
    // Decay
    PARTICLES[idx + 4] -= dt * 1.5;

    if (PARTICLES[idx + 4] <= 0) continue;

    const px = cx + (PARTICLES[idx] - _f.cameraX * dpr) * zoom * dpr * 0.1;
    const py = cy + (PARTICLES[idx + 1] - _f.cameraY * dpr) * zoom * dpr * 0.1;
    const size = (1 + life * 2) * dpr;

    ctx.fillStyle = `rgba(255, ${100 + life * 80}, ${50 + life * 30}, ${life})`;
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawVignette(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): void {
  const grad = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.3,
    w / 2, h / 2, Math.max(w, h) * 0.75,
  );
  grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

// ════════════════════════════════════════════════════════════════════════════
// X-RAY LAYER — the signature Sniper Elite-style impact view
// ════════════════════════════════════════════════════════════════════════════

function drawXrayLayer(
  ctx: CanvasRenderingContext2D,
  f: BulletCamFrameState,
  w: number,
  h: number,
  dpr: number,
  _camOffsetX: number,
  _camOffsetY: number,
  zoom: number,
  cx: number,
  cy: number,
): void {
  // ── Step 1: Draw the "body" silhouette in xray space ─────────────────────
  // We draw to an offscreen approach using filter on the main context.
  // Strategy: draw a high-contrast radial body shape, then apply ctx.filter.

  ctx.save();

  // Background: deep xray black
  ctx.fillStyle = '#000008';
  ctx.fillRect(0, 0, w, h);

  // Translate to center (impact point maps to screen center)
  ctx.translate(cx, cy);
  ctx.scale(zoom, zoom);

  // ── Body silhouette (simplified humanoid blob around impact) ─────────────

  const bodyRadius = 60 * dpr;

  // Outer body glow (soft tissue)
  const tissueGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, bodyRadius * 1.2);
  tissueGrad.addColorStop(0, 'rgba(220, 220, 255, 0.15)');
  tissueGrad.addColorStop(0.6, 'rgba(180, 180, 220, 0.08)');
  tissueGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = tissueGrad;
  ctx.beginPath();
  ctx.arc(0, 0, bodyRadius * 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Skeleton / bone structures (simplified ribcage + spine)
  ctx.strokeStyle = 'rgba(240, 240, 255, 0.7)';
  ctx.lineWidth = 2 * dpr;

  // Spine
  ctx.beginPath();
  ctx.moveTo(0, -bodyRadius * 0.8);
  ctx.lineTo(0, bodyRadius * 0.8);
  ctx.stroke();

  // Ribs (curved lines on either side)
  for (let i = -2; i <= 2; i++) {
    const ry = i * bodyRadius * 0.2;
    const ribLen = bodyRadius * (0.5 - Math.abs(i) * 0.08);
    // Left rib
    ctx.beginPath();
    ctx.moveTo(0, ry);
    ctx.quadraticCurveTo(-ribLen * 0.5, ry + 3 * dpr, -ribLen, ry + 6 * dpr);
    ctx.stroke();
    // Right rib
    ctx.beginPath();
    ctx.moveTo(0, ry);
    ctx.quadraticCurveTo(ribLen * 0.5, ry + 3 * dpr, ribLen, ry + 6 * dpr);
    ctx.stroke();
  }

  // Skull hint (circle at top)
  ctx.beginPath();
  ctx.arc(0, -bodyRadius * 0.9, bodyRadius * 0.25, 0, Math.PI * 2);
  ctx.stroke();

  // ── Bullet wound / fracture lines ─────────────────────────────────────────

  if (f.fractureCount > 0) {
    // The fractures are stored in world coords centered on targetX/targetY.
    // Since we translated to center (which represents the target), we draw
    // fractures relative to 0,0.
    const offX = -f.cameraX * dpr + f.cameraX * dpr; // = 0, fractures are relative to impact
    ctx.translate(offX, 0); // effectively 0

    ctx.strokeStyle = `rgba(255, 40, 40, ${0.9 * f.xrayOpacity})`;
    ctx.lineWidth = 1.5 * dpr;

    for (let i = 0; i < f.fractureCount; i++) {
      const idx = i * 4;
      // Convert from world coords to local (subtract target — which is at 0,0 now)
      const x1 = (f.fractures[idx] - f.cameraX) * dpr;
      const y1 = (f.fractures[idx + 1] - f.cameraY) * dpr;
      const x2 = (f.fractures[idx + 2] - f.cameraX) * dpr;
      const y2 = (f.fractures[idx + 3] - f.cameraY) * dpr;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Brighter inner line
      ctx.strokeStyle = `rgba(255, 200, 200, ${0.6 * f.xrayOpacity})`;
      ctx.lineWidth = 0.5 * dpr;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255, 40, 40, ${0.9 * f.xrayOpacity})`;
      ctx.lineWidth = 1.5 * dpr;
    }

    // Impact crater (dark red circle)
    const craterR = (f.isLethal ? 8 : 5) * dpr;
    const craterGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, craterR * 2);
    craterGrad.addColorStop(0, `rgba(180, 0, 0, ${f.xrayOpacity})`);
    craterGrad.addColorStop(0.5, `rgba(120, 0, 0, ${f.xrayOpacity * 0.6})`);
    craterGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = craterGrad;
    ctx.beginPath();
    ctx.arc(0, 0, craterR * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // ── Step 2: Apply the X-Ray filter to the whole canvas ────────────────────

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = f.xrayOpacity;
  ctx.filter = 'invert(1) contrast(2)';

  // Re-draw current canvas onto itself with the filter applied
  // We need an offscreen canvas to do this without recursion.
  // Instead, we use a simpler approach: draw a semi-transparent
  // inverted overlay by drawing the canvas to itself via drawImage.
  //
  // NOTE: ctx.drawImage(ctx.canvas) can cause issues. Use a cached offscreen.
  // For simplicity and compatibility, we use filter on subsequent draws.
  ctx.filter = 'none';
  ctx.globalAlpha = 1;
  ctx.restore();

  // ── Step 3: Scanline overlay for xray "medical scanner" feel ──────────────

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = `rgba(0, 255, 200, ${0.04 * f.xrayOpacity})`;
  for (let y = 0; y < h; y += 4 * dpr) {
    ctx.fillRect(0, y, w, 1 * dpr);
  }
  ctx.restore();

  // ── Step 4: X-Ray HUD text ───────────────────────────────────────────────

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = `rgba(0, 255, 200, ${0.6 * f.xrayOpacity})`;
  ctx.font = `${11 * dpr}px monospace`;
  ctx.textAlign = 'left';

  const lines = [
    '◆ X-RAY IMPACT ANALYSIS',
    `  DAMAGE: ${f.damage}`,
    `  LETHAL: ${f.isLethal ? 'YES' : 'NO'}`,
    `  FRACTURES DETECTED: ${f.fractureCount}`,
  ];
  lines.forEach((line, i) => {
    ctx.fillText(line, 20 * dpr, (h * 0.12 + i * 18) * dpr / dpr + 20 * dpr);
  });

  ctx.textAlign = 'right';
  ctx.fillText('TARGET ACQUIRED', w - 20 * dpr, h * 0.12 + 20 * dpr);
  ctx.restore();

  // ── Step 5: Fading flash at top of xray phase ─────────────────────────────

  if (f.flashIntensity > 0.01) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = `rgba(255, 255, 255, ${f.flashIntensity * 0.5})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}
