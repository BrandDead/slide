import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ReconBlock } from '../../utils/nearbyBlocks';
import {
  formatDistance,
  projectToScreen,
  screenDeltaToLatLng,
} from '../../utils/geo';
import './TacticalHoodMap.css';

export interface HoodMapController {
  flyTo: (opts: { center: [number, number]; zoom?: number; duration?: number }) => void;
}

interface TacticalHoodMapProps {
  center: [number, number];
  zoom?: number;
  blocks: ReconBlock[];
  selectedId?: string | null;
  onMapLoad?: (map: HoodMapController) => void;
  onBlockClick?: (block: ReconBlock) => void;
}

const PIN: Record<ReconBlock['owner'], string> = {
  player: '#00d64f',
  npc: '#ff2d55',
  unclaimed: '#8e8e93',
};

const TacticalHoodMap: React.FC<TacticalHoodMapProps> = ({
  center,
  zoom = 15,
  blocks,
  selectedId,
  onMapLoad,
  onBlockClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ lng: center[0], lat: center[1], zoom });
  const viewRef = useRef(view);
  viewRef.current = view;
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const drag = useRef<{ x: number; y: number; lng: number; lat: number } | null>(null);
  const animRef = useRef<number>(0);

  const sizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return { w: 0, h: 0, ctx: null as CanvasRenderingContext2D | null };
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h, ctx };
  }, []);

  const draw = useCallback(() => {
    const { w, h, ctx } = sizeCanvas();
    if (!ctx || w < 8 || h < 8) return;
    const { lat, lng, zoom: z } = viewRef.current;

    ctx.fillStyle = '#07080d';
    ctx.fillRect(0, 0, w, h);

    const gradient = ctx.createRadialGradient(w * 0.5, h * 0.42, 20, w * 0.5, h * 0.5, Math.max(w, h) * 0.7);
    gradient.addColorStop(0, '#12151f');
    gradient.addColorStop(1, '#07080d');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    const corners = [
      screenDeltaToLatLng(-w / 2, -h / 2, lat, lng, z),
      screenDeltaToLatLng(w / 2, h / 2, lat, lng, z),
    ];
    const minLat = Math.min(corners[0].lat, corners[1].lat);
    const maxLat = Math.max(corners[0].lat, corners[1].lat);
    const minLng = Math.min(corners[0].lng, corners[1].lng);
    const maxLng = Math.max(corners[0].lng, corners[1].lng);

    const step = z >= 16 ? 0.0012 : z >= 14.5 ? 0.0024 : 0.0048;
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(80, 92, 120, 0.22)';
    ctx.beginPath();
    for (let la = Math.floor(minLat / step) * step; la <= maxLat; la += step) {
      const a = projectToScreen(la, minLng, lat, lng, z, w, h);
      const b = projectToScreen(la, maxLng, lat, lng, z, w, h);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    for (let ln = Math.floor(minLng / step) * step; ln <= maxLng; ln += step) {
      const a = projectToScreen(minLat, ln, lat, lng, z, w, h);
      const b = projectToScreen(maxLat, ln, lat, lng, z, w, h);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();

    const olas = projectToScreen(26.1224, minLng, lat, lng, z, w, h);
    const olas2 = projectToScreen(26.1224, maxLng, lat, lng, z, w, h);
    ctx.strokeStyle = 'rgba(255, 214, 10, 0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(olas.x, olas.y);
    ctx.lineTo(olas2.x, olas2.y);
    ctx.stroke();

    const us1 = projectToScreen(minLat, -80.1436, lat, lng, z, w, h);
    const us12 = projectToScreen(maxLat, -80.1436, lat, lng, z, w, h);
    ctx.strokeStyle = 'rgba(100, 210, 255, 0.22)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(us1.x, us1.y);
    ctx.lineTo(us12.x, us12.y);
    ctx.stroke();

    ctx.fillStyle = 'rgba(10, 132, 255, 0.55)';
    ctx.font = '700 10px -apple-system, BlinkMacSystemFont, sans-serif';
    const label = projectToScreen(26.1224, lng, lat, lng, z, w, h);
    ctx.fillText('LAS OLAS BLVD', Math.max(12, label.x - 46), label.y - 8);

    const you = projectToScreen(lat, lng, lat, lng, z, w, h);
    ctx.fillStyle = 'rgba(10, 132, 255, 0.18)';
    ctx.beginPath();
    ctx.arc(you.x, you.y, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0a84ff';
    ctx.beginPath();
    ctx.arc(you.x, you.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    for (const block of blocksRef.current) {
      const p = projectToScreen(block.lat, block.lng, lat, lng, z, w, h);
      if (p.x < -40 || p.y < -40 || p.x > w + 40 || p.y > h + 40) continue;
      const color = PIN[block.owner];
      const selected = selectedRef.current === block.id;
      const r = selected ? 11 : 8;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = selected ? '#fff' : 'rgba(0,0,0,0.55)';
      ctx.lineWidth = selected ? 3 : 1.5;
      ctx.stroke();

      ctx.fillStyle = 'rgba(0,0,0,0.62)';
      const labelText = block.owner === 'npc'
        ? (block.gangName ?? 'Rival')
        : block.owner === 'player' ? 'You' : 'Open';
      const tw = ctx.measureText(labelText).width;
      ctx.fillRect(p.x + 10, p.y - 16, tw + 10, 16);
      ctx.fillStyle = '#f5f5f7';
      ctx.font = '600 11px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(labelText, p.x + 15, p.y - 4);

      if (block.owner === 'npc') {
        ctx.fillStyle = 'rgba(255,45,85,0.9)';
        ctx.font = '700 9px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillText(`$${block.income}/hr · ${formatDistance(block.distanceMeters)}`, p.x + 15, p.y + 12);
      }
    }
  }, [sizeCanvas]);

  useEffect(() => {
    draw();
  }, [draw, view, blocks, selectedId]);

  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [draw]);

  useEffect(() => {
    const controller: HoodMapController = {
      flyTo: ({ center: next, zoom: nextZoom, duration = 700 }) => {
        window.cancelAnimationFrame(animRef.current);
        const start = { ...viewRef.current };
        const end = { lng: next[0], lat: next[1], zoom: nextZoom ?? start.zoom };
        const t0 = performance.now();
        const step = (now: number) => {
          const t = Math.min(1, (now - t0) / duration);
          const e = 1 - (1 - t) ** 3;
          setView({
            lng: start.lng + (end.lng - start.lng) * e,
            lat: start.lat + (end.lat - start.lat) * e,
            zoom: start.zoom + (end.zoom - start.zoom) * e,
          });
          if (t < 1) animRef.current = window.requestAnimationFrame(step);
        };
        animRef.current = window.requestAnimationFrame(step);
      },
    };
    onMapLoad?.(controller);
    return () => window.cancelAnimationFrame(animRef.current);
  }, [onMapLoad]);

  const hitTest = (clientX: number, clientY: number): ReconBlock | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const { lat, lng, zoom: z } = viewRef.current;
    let best: { block: ReconBlock; d: number } | null = null;
    for (const block of blocksRef.current) {
      const p = projectToScreen(block.lat, block.lng, lat, lng, z, rect.width, rect.height);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < 22 && (!best || d < best.d)) best = { block, d };
    }
    return best?.block ?? null;
  };

  return (
    <div ref={wrapRef} className="tactical-hood" data-testid="tactical-hood-map">
      <canvas
        ref={canvasRef}
        onPointerDown={(e) => {
          drag.current = {
            x: e.clientX,
            y: e.clientY,
            lng: viewRef.current.lng,
            lat: viewRef.current.lat,
          };
          (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const moved = screenDeltaToLatLng(
            e.clientX - drag.current.x,
            e.clientY - drag.current.y,
            drag.current.lat,
            drag.current.lng,
            viewRef.current.zoom,
          );
          setView((v) => ({ ...v, lat: moved.lat, lng: moved.lng }));
        }}
        onPointerUp={(e) => {
          const start = drag.current;
          drag.current = null;
          if (!start) return;
          const dist = Math.hypot(e.clientX - start.x, e.clientY - start.y);
          if (dist > 8) return;
          const hit = hitTest(e.clientX, e.clientY);
          if (hit) onBlockClick?.(hit);
        }}
        onWheel={(e) => {
          e.preventDefault();
          setView((v) => ({
            ...v,
            zoom: Math.max(12, Math.min(18, v.zoom + (e.deltaY > 0 ? -0.35 : 0.35))),
          }));
        }}
      />
      <div className="tactical-hood-hint">Drag to pan · tap a pin · search like Maps</div>
    </div>
  );
};

export default TacticalHoodMap;
