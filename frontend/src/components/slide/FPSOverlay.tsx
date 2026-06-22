// ============================================================
// FPSOverlay.tsx — First-person gun overlay
// Renders on top of CanvasStreetRenderer during active drive-by.
// Shows: gloved hands + gun, crosshair, ammo counter,
//        bullet casings ejecting, reload bar, recoil animation.
// Sprint: sfx-fps-ollama-assets
// ============================================================

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { FPSGunState } from '../../utils/FPSGunState';
import { soundManager } from '../../utils/SoundManager';
import './FPSOverlay.css';

export interface FPSOverlayProps {
  width: number;
  height: number;
  isActive: boolean;
  onShot: (x: number, y: number, hit: boolean) => void;
  /** 0-100: accuracy modifier from member level */
  accuracy?: number;
  gunType?: 'compact' | 'long';
}

// ─── Crosshair ───────────────────────────────────────────────
function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  spread: number,
  isActive: boolean,
) {
  const color = isActive ? 'rgba(239,68,68,0.9)' : 'rgba(255,255,255,0.7)';
  const gap = 6 + spread;
  const len = 14;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.shadowBlur = isActive ? 6 : 0;
  ctx.shadowColor = '#ef4444';

  // Horizontal
  ctx.beginPath();
  ctx.moveTo(cx - gap - len, cy);
  ctx.lineTo(cx - gap, cy);
  ctx.moveTo(cx + gap, cy);
  ctx.lineTo(cx + gap + len, cy);
  ctx.stroke();

  // Vertical
  ctx.beginPath();
  ctx.moveTo(cx, cy - gap - len);
  ctx.lineTo(cx, cy - gap);
  ctx.moveTo(cx, cy + gap);
  ctx.lineTo(cx, cy + gap + len);
  ctx.stroke();

  // Center dot
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
}

// ─── Gun hand (canvas fallback) ──────────────────────────────
function drawGunHand(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  recoilX: number,
  recoilY: number,
  isReloading: boolean,
  gunType: 'compact' | 'long',
) {
  const baseX = w * 0.55 + recoilX;
  const baseY = h * 0.72 + recoilY + (isReloading ? 20 : 0);

  // Gloved hand
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.roundRect?.(baseX - 10, baseY + 20, 60, 35, 6) ?? ctx.fillRect(baseX - 10, baseY + 20, 60, 35);
  ctx.fill();

  // Gun body
  const gunW = gunType === 'long' ? 120 : 80;
  const gunH = gunType === 'long' ? 18 : 22;
  ctx.fillStyle = '#2d2d3d';
  ctx.beginPath();
  ctx.roundRect?.(baseX - 20, baseY, gunW, gunH, 4) ?? ctx.fillRect(baseX - 20, baseY, gunW, gunH);
  ctx.fill();

  // Barrel
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(baseX + gunW - 20, baseY + 4, 30, 8);

  // Magazine
  ctx.fillStyle = '#333';
  ctx.fillRect(baseX + 10, baseY + gunH, 16, 20);

  // Trigger guard
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(baseX + 25, baseY + gunH + 5, 10, 0, Math.PI);
  ctx.stroke();

  // Drum magazine for long gun
  if (gunType === 'long') {
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.arc(baseX + 15, baseY + gunH + 12, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Muzzle flash position indicator (subtle glow)
  ctx.fillStyle = 'rgba(255,200,80,0.05)';
  ctx.beginPath();
  ctx.arc(baseX + gunW + 10, baseY + 9, 8, 0, Math.PI * 2);
  ctx.fill();
}

// ─── Reload bar ──────────────────────────────────────────────
function drawReloadBar(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  progress: number,
) {
  const barW = 160;
  const barH = 6;
  const x = (w - barW) / 2;
  const y = h - 80;

  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.roundRect?.(x - 2, y - 2, barW + 4, barH + 4, 4) ?? ctx.fillRect(x - 2, y - 2, barW + 4, barH + 4);
  ctx.fill();

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(x, y, barW, barH);

  const grad = ctx.createLinearGradient(x, y, x + barW * progress, y);
  grad.addColorStop(0, '#4ade80');
  grad.addColorStop(1, '#22c55e');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, barW * progress, barH);

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('RELOADING', w / 2, y - 6);
  ctx.textAlign = 'left';
}

// ─── Component ───────────────────────────────────────────────

export const FPSOverlay: React.FC<FPSOverlayProps> = ({
  width,
  height,
  isActive,
  onShot,
  accuracy = 70,
  gunType = 'compact',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef    = useRef<number>(0);
  const gunRef    = useRef<FPSGunState>(new FPSGunState(gunType));
  const reloadProgressRef = useRef(0);
  const reloadStartRef    = useRef(0);
  const [dpr, setDpr]     = useState(1);

  useEffect(() => { setDpr(window.devicePixelRatio || 1); }, []);

  // Gun callbacks
  useEffect(() => {
    const gun = gunRef.current;
    gun.onFire = (x, y) => {
      soundManager.play('gunshot');
      const hitChance = accuracy / 100;
      const hit = Math.random() < hitChance;
      onShot(x, y, hit);
    };
    gun.onEmpty = () => soundManager.play('ui_tap');
    gun.onReloadStart = () => {
      reloadStartRef.current = Date.now();
      soundManager.play('card_flip');
    };
    gun.onReloadComplete = () => {
      soundManager.play('cash_register');
    };
  }, [accuracy, onShot]);

  // Click to fire
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isActive) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width / dpr / rect.width);
      const y = (e.clientY - rect.top) * (canvas.height / dpr / rect.height);
      gunRef.current.fire(x, y);
    },
    [isActive, dpr],
  );

  // R key to reload
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') gunRef.current.reload();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Render loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const now = Date.now();
    const dt = 1 / 60;
    const gun = gunRef.current;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    if (!isActive) {
      rafRef.current = requestAnimationFrame(draw);
      return;
    }

    // Crosshair
    const spread = gun.state === 'firing' ? 8 : 2;
    drawCrosshair(ctx, width / 2, height / 2, spread, gun.state === 'firing');

    // Gun hand
    gun.updateCasings(dt);
    drawGunHand(ctx, width, height, gun.recoilX, gun.recoilY, gun.isReloading, gunType);

    // Bullet casings
    gun.drawCasings(ctx);

    // Reload progress bar
    if (gun.isReloading) {
      const elapsed = now - reloadStartRef.current;
      const config = gun['config' as keyof typeof gun] as any;
      const reloadMs = config?.reloadTimeMs ?? 1800;
      reloadProgressRef.current = Math.min(elapsed / reloadMs, 1);
      drawReloadBar(ctx, width, height, reloadProgressRef.current);
    }

    // Ammo counter (bottom left)
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.roundRect?.(12, height - 52, 80, 40, 6) ?? ctx.fillRect(12, height - 52, 80, 40);
    ctx.fill();

    ctx.fillStyle = gun.isEmpty ? '#ef4444' : '#e2e8f0';
    ctx.font = 'bold 22px monospace';
    ctx.fillText(`${gun.ammo}`, 20, height - 22);

    ctx.fillStyle = '#64748b';
    ctx.font = '11px monospace';
    ctx.fillText(`/ ${gun.magazineSize}`, 46, height - 22);

    // State label
    if (gun.state === 'empty') {
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('EMPTY — TAP R TO RELOAD', width / 2, height - 20);
      ctx.textAlign = 'left';
    }

    rafRef.current = requestAnimationFrame(draw);
  }, [dpr, width, height, isActive, gunType]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      gunRef.current.destroy();
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      width={Math.round(width * dpr)}
      height={Math.round(height * dpr)}
      style={{
        position: 'absolute', inset: 0,
        width: `${width}px`, height: `${height}px`,
        cursor: isActive ? 'crosshair' : 'default',
        pointerEvents: isActive ? 'auto' : 'none',
      }}
      onClick={handleClick}
      data-testid="fps-overlay"
    />
  );
};

export default FPSOverlay;
