// ============================================================
// driveByStreetRenderer — passenger-seat FPS street (Sprint 17)
//
// Draws the procedurally generated street sliding past the
// passenger window. Replaces the static AI backdrop plate.
//
// Camera model: the player sits in the passenger seat looking
// sideways (90° to travel). The car moves along +X, so buildings
// translate right-to-left across the window. A single vanishing
// axis at the horizon gives the facades their rake — near edges
// of a facade are taller than far edges, which reads as real
// perspective without a full 3D pipeline.
//
// Everything is canvas 2D and deterministic. No image assets are
// required for the street itself; the car interior frame is the
// only bitmap and it is a UI overlay, not generated scenery.
// ============================================================

import type { StreetSceneProjection, StreetSegment } from './proceduralStreet';
import { stripLengthM } from './proceduralStreet';

// ─── Camera constants ────────────────────────────────────────

/** Metres from the passenger window to the building line. */
export const CURB_DISTANCE_M = 9;
/** Vertical placement of the horizon (0 = top of canvas). */
export const HORIZON_RATIO = 0.46;
/** Pixels per metre at the building line. Sets apparent scale. */
export const PX_PER_M = 26;

export interface StreetCamera {
  /** Distance travelled along the street, in metres. */
  offsetM: number;
  /** Canvas dimensions. */
  width: number;
  height: number;
  /** Block DNA depth layers projected far → near outside the render loop. */
  projection?: StreetSceneProjection;
}

/** Project an along-street metre position to a screen X. */
function projectX(alongM: number, offsetM: number, width: number): number {
  return width * 0.5 + (alongM - offsetM) * PX_PER_M;
}

// ─── Sky + road bed ──────────────────────────────────────────

function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const horizon = h * HORIZON_RATIO;
  const g = ctx.createLinearGradient(0, 0, 0, horizon);
  g.addColorStop(0, '#05060d');
  g.addColorStop(0.55, '#0b0d1a');
  g.addColorStop(1, '#1b1024');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, horizon);

  // City glow smeared along the horizon
  const glow = ctx.createLinearGradient(0, horizon - h * 0.1, 0, horizon);
  glow.addColorStop(0, 'transparent');
  glow.addColorStop(1, 'rgba(255, 120, 60, 0.16)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, horizon - h * 0.1, w, h * 0.1);
}

function drawRoad(ctx: CanvasRenderingContext2D, cam: StreetCamera) {
  const { width: w, height: h, offsetM } = cam;
  const horizon = h * HORIZON_RATIO;
  // The road is the nearest depth layer, so it is drawn after facades and
  // starts at the same ground line used by drawSegment().
  const roadTop = horizon + (h - horizon) * 0.1;

  // Asphalt
  const g = ctx.createLinearGradient(0, roadTop, 0, h);
  g.addColorStop(0, '#1b1d24');
  g.addColorStop(0.35, '#15171d');
  g.addColorStop(1, '#0d0e12');
  ctx.fillStyle = g;
  ctx.fillRect(0, roadTop, w, h - roadTop);

  // Wet-asphalt sheen streaks (rain-slick look from the concept art)
  ctx.save();
  ctx.globalAlpha = 0.16;
  for (let i = 0; i < 22; i++) {
    const t = i / 22;
    const y = roadTop + Math.pow(t, 1.7) * (h - roadTop);
    ctx.fillStyle = i % 2 ? '#3a4256' : '#232833';
    ctx.fillRect(0, y, w, Math.max(1, (1 - t) * 3));
  }
  ctx.restore();

  // Curb line
  ctx.fillStyle = '#2c3038';
  ctx.fillRect(0, roadTop, w, 3);

  // Lane dashes scrolling with travel
  ctx.fillStyle = 'rgba(240, 220, 140, 0.22)';
  const dashSpacing = 6; // metres
  const startM = Math.floor(offsetM / dashSpacing) * dashSpacing;
  for (let i = -2; i < 40; i++) {
    const m = startM + i * dashSpacing;
    const x = projectX(m, offsetM, w);
    if (x < -60 || x > w + 60) continue;
    ctx.fillRect(x, h * 0.86, 34, 4);
  }
}

// ─── Block DNA depth backdrops ─────────────────────────────────

/**
 * Draw the far skyline and recessed-layer silhouettes from the explicit Block
 * DNA depth contract. Facade lots remain horizontal segments; these backdrops
 * make the retained depth rows visible without turning them into columns.
 */
function drawDepthBackdrops(ctx: CanvasRenderingContext2D, cam: StreetCamera) {
  const layers = cam.projection?.depthLayers ?? [];
  if (!layers.length) return;

  const { width: w, height: h } = cam;
  const horizon = h * HORIZON_RATIO;
  for (const layer of layers) {
    if (layer.pass === 'skyline') {
      const top = horizon - h * (0.08 + layer.row * 0.008);
      ctx.fillStyle = 'rgba(17, 19, 29, 0.92)';
      for (let x = -24; x < w + 36; x += 56) {
        const rise = 16 + ((x / 56 + layer.row * 3) % 4) * 13;
        ctx.fillRect(x, top - rise, 42, rise + 2);
      }
    }

    if (layer.pass === 'setback') {
      const depth = Math.max(1, layer.row);
      const top = horizon - depth * 5;
      ctx.fillStyle = 'rgba(7, 9, 14, 0.72)';
      ctx.fillRect(0, top, w, horizon - top + 4);
    }
  }
}

// ─── Facade drawing ──────────────────────────────────────────

function drawSegment(
  ctx: CanvasRenderingContext2D,
  seg: StreetSegment,
  startM: number,
  cam: StreetCamera,
) {
  const { width: w, height: h, offsetM } = cam;
  const horizon = h * HORIZON_RATIO;

  const xNear = projectX(startM, offsetM, w);
  const xFar = projectX(startM + seg.widthM, offsetM, w);
  if (xFar < -80 || xNear > w + 80) return; // offscreen

  const segW = xFar - xNear;
  const baseY = horizon + (h - horizon) * 0.1;   // where facade meets sidewalk
  const topY = baseY - seg.heightM * PX_PER_M * 0.55;

  if (seg.kind === 'alley') {
    // Dark recess — reads as a gap between buildings
    const g = ctx.createLinearGradient(xNear, topY, xNear, baseY);
    g.addColorStop(0, '#0a0b0f');
    g.addColorStop(1, '#050608');
    ctx.fillStyle = g;
    ctx.fillRect(xNear, topY, segW, baseY - topY);
    // Dumpster silhouette
    ctx.fillStyle = '#1d2a22';
    ctx.fillRect(xNear + segW * 0.25, baseY - 26, segW * 0.5, 26);
    return;
  }

  if (seg.kind === 'parking' || seg.kind === 'lot') {
    // Chain-link fence over an empty lot
    ctx.fillStyle = '#0a0c10';
    ctx.fillRect(xNear, baseY - seg.heightM * PX_PER_M * 0.55, segW, seg.heightM * PX_PER_M * 0.55);
    ctx.strokeStyle = 'rgba(150, 160, 175, 0.22)';
    ctx.lineWidth = 1;
    const fenceTop = baseY - 52;
    for (let x = xNear; x < xFar; x += 9) {
      ctx.beginPath();
      ctx.moveTo(x, fenceTop);
      ctx.lineTo(x + 9, baseY);
      ctx.moveTo(x + 9, fenceTop);
      ctx.lineTo(x, baseY);
      ctx.stroke();
    }
    return;
  }

  // Facade body
  ctx.fillStyle = seg.facadeTone;
  ctx.fillRect(xNear, topY, segW, baseY - topY);

  // Vertical edge shading gives the block depth
  const shade = ctx.createLinearGradient(xNear, 0, xFar, 0);
  shade.addColorStop(0, 'rgba(0,0,0,0.45)');
  shade.addColorStop(0.5, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = shade;
  ctx.fillRect(xNear, topY, segW, baseY - topY);

  // Windows
  for (const win of seg.windows) {
    const wx = xNear + win.x * segW;
    const wy = topY + win.y * (baseY - topY);
    const ww = win.w * segW;
    const wh = win.h * (baseY - topY);
    ctx.fillStyle = win.lit ? 'rgba(255, 196, 120, 0.55)' : 'rgba(18, 22, 32, 0.85)';
    ctx.fillRect(wx, wy, ww, wh);
    if (win.lit) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.shadowColor = '#ffbe70';
      ctx.shadowBlur = 12;
      ctx.fillRect(wx, wy, ww, wh);
      ctx.restore();
    }
  }

  // Awning
  if (seg.awning) {
    const ay = baseY - (baseY - topY) * 0.34;
    ctx.fillStyle = seg.awningTone;
    ctx.beginPath();
    ctx.moveTo(xNear, ay);
    ctx.lineTo(xFar, ay);
    ctx.lineTo(xFar - segW * 0.06, ay + 16);
    ctx.lineTo(xNear + segW * 0.06, ay + 16);
    ctx.closePath();
    ctx.fill();
  }

  // Roll-down security gate
  if (seg.shuttered) {
    ctx.fillStyle = 'rgba(90, 96, 108, 0.5)';
    const gateTop = baseY - (baseY - topY) * 0.3;
    for (let y = gateTop; y < baseY; y += 5) {
      ctx.fillRect(xNear + 3, y, segW - 6, 2.5);
    }
  }

  // Neon sign
  if (seg.neonTone && seg.sign && segW > 46) {
    const sy = topY + (baseY - topY) * 0.2;
    ctx.save();
    ctx.font = `700 ${Math.min(19, Math.max(10, segW * 0.11))}px 'Rajdhani', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = seg.neonTone;
    ctx.shadowBlur = 16;
    ctx.fillStyle = seg.neonTone;
    ctx.fillText(seg.sign, xNear + segW / 2, sy);
    ctx.restore();

    // Neon spill onto the wet street below
    ctx.save();
    ctx.globalAlpha = 0.2;
    const spill = ctx.createLinearGradient(0, baseY, 0, h);
    spill.addColorStop(0, seg.neonTone);
    spill.addColorStop(1, 'transparent');
    ctx.fillStyle = spill;
    ctx.fillRect(xNear, baseY, segW, h - baseY);
    ctx.restore();
  }

  // Graffiti wash on the lower facade
  if (seg.graffiti > 0.25) {
    ctx.save();
    ctx.globalAlpha = seg.graffiti * 0.3;
    ctx.fillStyle = '#8a4bd6';
    ctx.fillRect(xNear + segW * 0.1, baseY - 26, segW * 0.55, 18);
    ctx.restore();
  }
}

// ─── Public draw ─────────────────────────────────────────────

/**
 * Render one frame of the street from the passenger window.
 * Call before drawing targets so actors composite on top.
 */
export function drawProceduralStreet(
  ctx: CanvasRenderingContext2D,
  segments: readonly StreetSegment[],
  cam: StreetCamera,
): void {
  if (!segments.length) return;
  const loopM = stripLengthM(segments);
  const { offsetM, width: w } = cam;

  drawSky(ctx, w, cam.height);
  drawDepthBackdrops(ctx, cam);

  // Lay the separate frontage strip down after far skyline/setback passes.
  // The visible window is ~w/PX_PER_M metres wide, well under one loop.
  const firstLoop = Math.floor((offsetM - w / PX_PER_M) / loopM) * loopM;
  for (let loop = 0; loop < 3; loop++) {
    let cursorM = firstLoop + loop * loopM;
    for (const seg of segments) {
      drawSegment(ctx, seg, cursorM, cam);
      cursorM += seg.widthM;
    }
  }

  // Street and curb are nearest, so they overlay the bottom of the facades.
  drawRoad(ctx, cam);
}

// ─── Passenger window glass ──────────────────────────────────

/**
 * Overlay the passenger window glass. `openRatio` 0 = fully up
 * (shooting blocked, glass tint + reflections), 1 = fully down.
 * Drawn after the street and actors, before the HUD.
 */
export function drawWindowGlass(
  ctx: CanvasRenderingContext2D,
  openRatio: number,
  width: number,
  height: number,
): void {
  const closed = 1 - Math.max(0, Math.min(1, openRatio));
  if (closed <= 0.001) return;

  // Glass pane descends from the top of the window aperture.
  const paneH = height * 0.78 * closed;

  ctx.save();
  // Tint
  ctx.fillStyle = `rgba(120, 150, 180, ${0.1 * closed})`;
  ctx.fillRect(0, 0, width, paneH);

  // Diagonal reflection streaks
  ctx.globalAlpha = 0.14 * closed;
  ctx.fillStyle = '#cfe3ff';
  ctx.beginPath();
  ctx.moveTo(width * 0.1, 0);
  ctx.lineTo(width * 0.34, 0);
  ctx.lineTo(width * 0.12, paneH);
  ctx.lineTo(-width * 0.06, paneH);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 0.08 * closed;
  ctx.beginPath();
  ctx.moveTo(width * 0.62, 0);
  ctx.lineTo(width * 0.72, 0);
  ctx.lineTo(width * 0.52, paneH);
  ctx.lineTo(width * 0.42, paneH);
  ctx.closePath();
  ctx.fill();

  // Bottom edge of the glass — the visible lip as it rolls
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(180, 200, 225, 0.5)';
  ctx.fillRect(0, paneH - 2, width, 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, paneH, width, 3);
  ctx.restore();
}
