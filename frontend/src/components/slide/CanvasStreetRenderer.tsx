// ============================================================
// CanvasStreetRenderer — HTML5 canvas drive-by renderer
// Original output by GLM-5.2; fixed for SLIDE repo:
//   - Import path: ../../types/block.types (not ../../types/slide)
//   - Sprite frame dimensions: 688×1536 (actual sheet size / 4 cols)
//   - Fallback car drawn with canvas shapes (no external car sprite needed)
//   - PHASE_CAR_X uses passed `width` prop instead of window.innerWidth
//   - drawBackground/drawMembers/drawCar/etc. moved to stable useCallback refs
//     so the RAF loop doesn't re-subscribe on every render
//   - Added React import for JSX
// Sprint: canvas-destruction-tutorial-triggers
// ============================================================

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type {
  BlockPlacement,
  DriveByEvent,
  DriveByPhase,
  DriveByShot,
} from '../../types/block.types';

// ─── Types ───────────────────────────────────────────────────

export interface CanvasStreetRendererProps {
  placements: BlockPlacement[];
  activeDriveBy?: DriveByEvent;
  width: number;
  height: number;
  onDefendShot: (x: number, y: number) => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  radius: number;
}

interface MuzzleFlash {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  angle: number;
}

// ─── Constants ───────────────────────────────────────────────

const MEMBER_FRAMES: Record<string, number> = {
  dealer: 0, shooter: 1, enforcer: 2, lookout: 3,
};

const SPRITE_SHEET_COLS = 4;
// Actual gang_members.png sheet: 4 cols × 1 row, each frame 688×1536
const SPRITE_FRAME_W = 688;
const SPRITE_FRAME_H = 1536;
// Render at a sensible in-game size (scale down from master)
const RENDER_MEMBER_W = 40;
const RENDER_MEMBER_H = Math.round(RENDER_MEMBER_W * (SPRITE_FRAME_H / SPRITE_FRAME_W));

const SPRITE_URL = '/assets/sprites/gang_members.png';

const CAR_W = 160;
const CAR_H = 70;

const ZONE_Y_MAP: Record<string, number> = {
  rooftop:    0.12,
  building:   0.20,
  storefront: 0.48,
  alley:      0.55,
  sidewalk:   0.62,
  parking:    0.70,
  curb:       0.75,
  street:     0.82,
};

// ─── Component ───────────────────────────────────────────────

export function CanvasStreetRenderer({
  placements,
  activeDriveBy,
  width,
  height,
  onDefendShot,
}: CanvasStreetRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(performance.now());
  const phaseStartRef = useRef<number>(performance.now());
  const lastPhaseRef = useRef<DriveByPhase>('idle');

  // Image cache
  const spriteImgRef = useRef<HTMLImageElement | null>(null);
  const spriteReadyRef = useRef(false);

  // Particle / effect state
  const particlesRef = useRef<Particle[]>([]);
  const muzzleFlashesRef = useRef<MuzzleFlash[]>([]);

  // Latest props refs — the RAF loop reads these without re-subscribing
  const placementsRef = useRef<BlockPlacement[]>(placements);
  const driveByRef = useRef<DriveByEvent | undefined>(activeDriveBy);
  const onDefendShotRef = useRef(onDefendShot);
  const widthRef = useRef(width);
  const heightRef = useRef(height);

  // Track processed shots to avoid double-spawning particles
  const processedShotsRef = useRef<Set<string>>(new Set());

  const [dpr, setDpr] = useState(1);

  // ── Image preloading ──
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) {
        spriteImgRef.current = img;
        spriteReadyRef.current = true;
      }
    };
    img.onerror = () => console.warn('[CanvasStreetRenderer] sprite sheet not found, using fallback');
    img.src = SPRITE_URL;
    return () => { cancelled = true; };
  }, []);

  // ── DPR ──
  useEffect(() => { setDpr(window.devicePixelRatio || 1); }, []);

  // ── Sync props refs ──
  useEffect(() => { placementsRef.current = placements; }, [placements]);
  useEffect(() => { driveByRef.current = activeDriveBy; }, [activeDriveBy]);
  useEffect(() => { onDefendShotRef.current = onDefendShot; }, [onDefendShot]);
  useEffect(() => { widthRef.current = width; heightRef.current = height; }, [width, height]);

  // ── Phase change detection ──
  useEffect(() => {
    const driveBy = activeDriveBy;
    if (!driveBy) { lastPhaseRef.current = 'idle'; return; }
    if (driveBy.phase !== lastPhaseRef.current) {
      lastPhaseRef.current = driveBy.phase;
      phaseStartRef.current = performance.now();
    }
  }, [activeDriveBy]);

  // ── Click → onDefendShot ──
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / dpr / rect.width;
      const scaleY = canvas.height / dpr / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      onDefendShotRef.current(x, y);
      // Spawn a muzzle flash at click point
      muzzleFlashesRef.current.push({ x, y, life: 1, maxLife: 0.15, angle: Math.random() * Math.PI * 2 });
    },
    [dpr],
  );

  // ── Particle helpers ──
  const spawnHitSpark = useCallback((x: number, y: number) => {
    const count = 10 + Math.floor(Math.random() * 8);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      particlesRef.current.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        life: 1,
        maxLife: 0.4 + Math.random() * 0.4,
        color: Math.random() > 0.5 ? '#ffcc00' : '#ff6600',
        radius: 2 + Math.random() * 2,
      });
    }
    muzzleFlashesRef.current.push({ x, y, life: 1, maxLife: 0.15, angle: Math.random() * Math.PI * 2 });
  }, []);

  // ── Process new shots → spawn particles ──
  const processShots = useCallback(() => {
    const driveBy = driveByRef.current;
    if (!driveBy) return;

    const allShots: { shot: DriveByShot; kind: 'attack' | 'defend' }[] = [
      ...driveBy.shots.map(s => ({ shot: s, kind: 'attack' as const })),
      ...driveBy.defenderShots.map(s => ({ shot: s, kind: 'defend' as const })),
    ];

    for (const { shot, kind } of allShots) {
      const key = `${kind}-${shot.timestamp}-${shot.targetX}-${shot.targetY}`;
      if (processedShotsRef.current.has(key)) continue;
      processedShotsRef.current.add(key);
      if (shot.hit) spawnHitSpark(shot.targetX, shot.targetY);
    }

    if (processedShotsRef.current.size > 500) {
      const arr = Array.from(processedShotsRef.current);
      processedShotsRef.current = new Set(arr.slice(-300));
    }
  }, [spawnHitSpark]);

  // ── Draw background ──
  const drawBackground = useCallback((ctx: CanvasRenderingContext2D, elapsed: number, w: number, h: number) => {
    // Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.55);
    skyGrad.addColorStop(0, '#1a1a2e');
    skyGrad.addColorStop(0.5, '#16213e');
    skyGrad.addColorStop(1, '#2c2c44');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h * 0.55);

    // Distant skyline — parallax layer 1
    const offset1 = (elapsed * 0.005) % w;
    ctx.fillStyle = '#0d0d1a';
    for (let i = -1; i < Math.ceil(w / 120) + 1; i++) {
      const bx = i * 120 - offset1;
      const bh = 80 + ((i * 37) % 60);
      ctx.fillRect(bx, h * 0.35 - bh, 100, bh);
    }

    // Building silhouettes — parallax layer 2
    const offset2 = (elapsed * 0.02) % w;
    for (let i = -1; i < Math.ceil(w / 90) + 1; i++) {
      const bx = i * 90 - offset2;
      const bh = 120 + ((i * 53) % 80);
      ctx.fillStyle = '#15151f';
      ctx.fillRect(bx, h * 0.5 - bh, 70, bh);
      // Lit windows
      ctx.fillStyle = 'rgba(255,200,80,0.08)';
      for (let wy = 0; wy < bh - 20; wy += 18) {
        for (let wx = 0; wx < 50; wx += 16) {
          if ((i + wx + wy) % 3 === 0) ctx.fillRect(bx + 10 + wx, h * 0.5 - bh + 10 + wy, 6, 8);
        }
      }
    }

    // Storefront strip — parallax layer 3
    ctx.fillStyle = '#1e1e2a';
    ctx.fillRect(0, h * 0.5, w, h * 0.12);
    // Neon sign accents
    const offset3 = (elapsed * 0.04) % w;
    const neonColors = ['#4ade80', '#60a5fa', '#f97316', '#a78bfa'];
    for (let i = -1; i < Math.ceil(w / 80) + 1; i++) {
      const sx = i * 80 - offset3;
      ctx.fillStyle = neonColors[Math.abs(i) % neonColors.length] + '33';
      ctx.fillRect(sx + 5, h * 0.5 + 4, 50, 6);
    }

    // Sidewalk
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, h * 0.62, w, h * 0.1);

    // Curb line
    ctx.fillStyle = '#374151';
    ctx.fillRect(0, h * 0.72, w, 4);

    // Street / road
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, h * 0.724, w, h * 0.276);

    // Lane markings
    ctx.strokeStyle = 'rgba(255,200,60,0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([24, 16]);
    ctx.beginPath();
    ctx.moveTo(0, h * 0.88);
    ctx.lineTo(w, h * 0.88);
    ctx.stroke();
    ctx.setLineDash([]);
  }, []);

  // ── Draw members ──
  const drawMembers = useCallback((ctx: CanvasRenderingContext2D, members: BlockPlacement[], w: number, h: number) => {
    const sprite = spriteImgRef.current;
    for (const member of members) {
      const yRatio = ZONE_Y_MAP[member.zoneType] ?? 0.65;
      const drawY = h * yRatio;
      // X: distribute across 8 columns
      const drawX = ((member.x + 0.5) / 8) * w;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(drawX, drawY + RENDER_MEMBER_H * 0.5 + 4, 14, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Sprite or fallback
      if (sprite && spriteReadyRef.current) {
        const frameIdx = MEMBER_FRAMES[member.role] ?? 0;
        const sx = (frameIdx % SPRITE_SHEET_COLS) * SPRITE_FRAME_W;
        ctx.drawImage(
          sprite,
          sx, 0, SPRITE_FRAME_W, SPRITE_FRAME_H,
          drawX - RENDER_MEMBER_W / 2, drawY - RENDER_MEMBER_H / 2,
          RENDER_MEMBER_W, RENDER_MEMBER_H,
        );
      } else {
        const colors: Record<string, string> = {
          dealer: '#4ade80', shooter: '#ef4444', enforcer: '#f97316',
          lookout: '#3b82f6', driver: '#a855f7', chemist: '#06b6d4',
          runner: '#eab308', boss: '#ec4899',
        };
        ctx.fillStyle = colors[member.role] ?? '#888';
        ctx.fillRect(drawX - 12, drawY - 20, 24, 40);
      }

      // Health bar
      const barW = 28;
      const healthRatio = Math.max(0, member.health) / 100;
      ctx.fillStyle = '#333';
      ctx.fillRect(drawX - barW / 2, drawY - RENDER_MEMBER_H / 2 - 8, barW, 4);
      ctx.fillStyle = healthRatio > 0.5 ? '#22c55e' : healthRatio > 0.25 ? '#eab308' : '#ef4444';
      ctx.fillRect(drawX - barW / 2, drawY - RENDER_MEMBER_H / 2 - 8, barW * healthRatio, 4);

      // Name label
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(member.memberName, drawX, drawY - RENDER_MEMBER_H / 2 - 12);
    }
    ctx.textAlign = 'left';
  }, []);

  // ── Draw car ──
  const drawCar = useCallback((ctx: CanvasRenderingContext2D, driveBy: DriveByEvent | undefined, phaseElapsed: number, w: number, h: number) => {
    const phase = driveBy?.phase ?? 'idle';
    const carY = h * 0.82;

    let carX: number;
    switch (phase) {
      case 'incoming': {
        const progress = Math.min(phaseElapsed / 2000, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        carX = -CAR_W + eased * (w * 0.25 + CAR_W);
        break;
      }
      case 'active':
        carX = w * 0.25;
        break;
      case 'retreating': {
        const progress = Math.min(phaseElapsed / 1500, 1);
        const eased = progress * progress; // ease-in
        carX = w * 0.25 + eased * (w + CAR_W);
        break;
      }
      default:
        return; // idle / resolved — don't draw
    }

    // Car body (canvas fallback — no external sprite needed)
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.roundRect(carX, carY - 20, CAR_W, 35, 6);
    ctx.fill();

    // Roof
    ctx.fillStyle = '#0d0d1a';
    ctx.beginPath();
    ctx.roundRect(carX + 28, carY - 36, 90, 20, 4);
    ctx.fill();

    // Windows
    ctx.fillStyle = 'rgba(96,165,250,0.2)';
    ctx.fillRect(carX + 32, carY - 34, 38, 16);
    ctx.fillRect(carX + 74, carY - 34, 38, 16);

    // Wheels
    ctx.fillStyle = '#111';
    const wheelY = carY + Math.round(CAR_H * 0.22);
    [carX + 30, carX + CAR_W - 30].forEach(wx => {
      ctx.beginPath();
      ctx.arc(wx, wheelY, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(wx, wheelY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
    });

    // Headlight beam
    if (phase === 'incoming' || phase === 'active') {
      const grad = ctx.createRadialGradient(carX + CAR_W, carY, 5, carX + CAR_W, carY, 200);
      grad.addColorStop(0, 'rgba(255,240,180,0.25)');
      grad.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(carX + CAR_W, carY);
      ctx.lineTo(carX + CAR_W + 200, carY - 60);
      ctx.lineTo(carX + CAR_W + 200, carY + 60);
      ctx.closePath();
      ctx.fill();
    }
  }, []);

  // ── Draw muzzle flashes ──
  const drawMuzzleFlashes = useCallback((ctx: CanvasRenderingContext2D, dt: number) => {
    const surviving: MuzzleFlash[] = [];
    for (const flash of muzzleFlashesRef.current) {
      flash.life -= dt / flash.maxLife;
      if (flash.life <= 0) continue;
      const alpha = Math.max(0, flash.life);
      const radius = 20 * flash.life;
      const grad = ctx.createRadialGradient(flash.x, flash.y, 0, flash.x, flash.y, radius * 2);
      grad.addColorStop(0, `rgba(255,240,120,${alpha})`);
      grad.addColorStop(0.4, `rgba(255,160,40,${alpha * 0.6})`);
      grad.addColorStop(1, 'rgba(255,80,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(flash.x, flash.y, radius * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,255,220,${alpha})`;
      ctx.beginPath();
      ctx.arc(flash.x, flash.y, radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
      surviving.push(flash);
    }
    muzzleFlashesRef.current = surviving;
  }, []);

  // ── Draw particles ──
  const drawParticles = useCallback((ctx: CanvasRenderingContext2D, dt: number) => {
    const surviving: Particle[] = [];
    for (const p of particlesRef.current) {
      p.life -= dt / p.maxLife;
      if (p.life <= 0) continue;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15; // gravity
      const alpha = Math.max(0, p.life);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * alpha, 0, Math.PI * 2);
      ctx.fill();
      surviving.push(p);
    }
    ctx.globalAlpha = 1;
    particlesRef.current = surviving;
  }, []);

  // ── Main render loop ──
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const now = performance.now();
    const elapsed = now - startTimeRef.current;
    const phaseElapsed = now - phaseStartRef.current;
    const dt = 1 / 60;

    const w = widthRef.current;
    const h = heightRef.current;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    drawBackground(ctx, elapsed, w, h);
    drawMembers(ctx, placementsRef.current, w, h);
    drawCar(ctx, driveByRef.current, phaseElapsed, w, h);
    processShots();
    drawMuzzleFlashes(ctx, dt);
    drawParticles(ctx, dt);

    rafRef.current = requestAnimationFrame(draw);
  }, [dpr, drawBackground, drawMembers, drawCar, processShots, drawMuzzleFlashes, drawParticles]);

  // ── Start / stop render loop ──
  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      width={width * dpr}
      height={height * dpr}
      style={{ width: `${width}px`, height: `${height}px`, cursor: 'crosshair', display: 'block' }}
      onClick={handleCanvasClick}
      data-testid="canvas-street-renderer"
    />
  );
}

export default CanvasStreetRenderer;
