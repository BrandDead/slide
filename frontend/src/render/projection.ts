// ============================================================
// SLIDE — Scene Projection Layer
// frontend/src/render/projection.ts
//
// THE single grid → scene transform. (#77)
//
// Gameplay stays on the integer 8×8 grid from config/gridConfig.ts.
// Renderers NEVER compute their own coordinates; they call project()
// and draw what comes back.
//
// Replaces three divergent systems on main-tL2525 @ d971f18:
//   • CanvasStreetRendererV3  `((member.x + 0.5) / 8) * width`
//   • SecurityCamRenderer     toScreenX / toScreenY / toScreenScale
//   • TopDownBlock            CSS grid cells
//
// Camera model: pinhole. The camera sits above and behind the street,
// pitched down at the storefronts.
//
//   row 0 STREET      ← nearest, bottom of screen, scale 1.0
//   row 7 ROOFTOP     ← farthest, top of screen, smallest
//
// Depth foreshortening is a true perspective divide (scale = zNear / z).
// x-convergence, y-placement and actor scale all derive from that ONE
// number, so they cannot drift apart the way three hand-tuned constants do.
// ============================================================

import { GRID, clampToGrid, type GridCoordinate, type SceneCoordinate } from '../config/gridConfig';

// ─── Profile ─────────────────────────────────────────────────

export interface ProjectionProfile {
  /** Camera distance to row 0, scene units. Lower = stronger perspective. */
  zNear: number;
  /** Scene-unit depth added per grid row. */
  rowDepth: number;
  /** Column spacing at row 0, as a fraction of scene width. */
  cellWidthRatio: number;
  /** Screen y of row 0's ground line, as a fraction of scene height. */
  groundYRatio: number;
  /** Screen y of the vanishing horizon, as a fraction of scene height. */
  horizonYRatio: number;
  /** Block centre line, as a fraction of scene width. */
  centerXRatio: number;
  /** Actor height at row 0, as a fraction of scene height. */
  actorHeightRatio: number;
  /** Key-light direction, degrees. 0 = from screen-right. */
  lightAngleDeg: number;
  /** Ground-shadow length as a multiple of actor height. */
  shadowLengthRatio: number;
}

/**
 * Las Olas hero-block camera — the approved visual target
 * (docs/concept-art/1208_w_las_olas_block.webp).
 *
 * Tuned so row 7 lands at scale ≈ 0.45: far enough to read as depth,
 * near enough that a rooftop shooter is still a legible silhouette.
 */
export const DEFAULT_PROFILE: ProjectionProfile = {
  zNear: 3.4,
  rowDepth: 0.60,
  cellWidthRatio: 0.105,
  groundYRatio: 0.94,
  horizonYRatio: 0.28,
  centerXRatio: 0.5,
  actorHeightRatio: 0.26,
  lightAngleDeg: 205,
  shadowLengthRatio: 0.42,
};

/** Block DNA supplies partial overrides; anything omitted inherits. */
export function makeProfile(overrides: Partial<ProjectionProfile> = {}): ProjectionProfile {
  return { ...DEFAULT_PROFILE, ...overrides };
}

// ─── Viewport ────────────────────────────────────────────────

export interface SceneViewport {
  /** Logical width in CSS px — NOT canvas backing-store px. */
  width: number;
  /** Logical height in CSS px. */
  height: number;
}

export interface ScenePoint extends SceneCoordinate {
  /** Rendered actor height, CSS px, already depth-scaled. */
  actorHeight: number;
  /** Rendered cell width at this depth, CSS px. */
  cellWidth: number;
  /** Ground shadow ellipse centred on the contact point. */
  shadow: { cx: number; cy: number; rx: number; ry: number; opacity: number };
}

// ─── Core ────────────────────────────────────────────────────

function depthAt(row: number, p: ProjectionProfile): number {
  return p.zNear + row * p.rowDepth;
}

/**
 * Project an authoritative grid coordinate into scene space.
 * `col`/`row` may be fractional — pass interpolated values to animate a
 * member walking between cells without leaving the contract.
 */
export function project(
  coord: GridCoordinate,
  view: SceneViewport,
  p: ProjectionProfile = DEFAULT_PROFILE,
): ScenePoint {
  const z = depthAt(coord.row, p);
  const scale = p.zNear / z;

  const groundY = view.height * p.groundYRatio;
  const horizonY = view.height * p.horizonYRatio;
  const centerX = view.width * p.centerXRatio;

  // Same divide as x, so nothing can drift.
  const y = groundY - (1 - scale) * (groundY - horizonY);

  const cellWidth = view.width * p.cellWidthRatio * scale;
  const x = centerX + (coord.col - (GRID.cols - 1) / 2) * cellWidth;

  const actorHeight = view.height * p.actorHeightRatio * scale;

  const rad = (p.lightAngleDeg * Math.PI) / 180;
  const shadowLen = actorHeight * p.shadowLengthRatio;

  return {
    x,
    y,
    scale,
    // Painter's key. Far rows have a SMALLER scale, so ascending sort
    // emits them first and near actors overdraw them. Column breaks ties
    // so same-row actors stack stably instead of flickering on re-sort.
    depth: scale * 1000 + coord.col * 0.001,
    actorHeight,
    cellWidth,
    shadow: {
      cx: x + Math.cos(rad) * shadowLen * 0.35,
      cy: y + Math.sin(rad) * shadowLen * 0.08,
      rx: cellWidth * 0.42,
      ry: cellWidth * 0.42 * 0.34,
      opacity: 0.30 + 0.18 * scale,
    },
  };
}

/**
 * Screen tap → grid coordinate. Exact inverse of project().
 * Required for placement and SLIDE target selection.
 * Returns fractional coords; call snapToCell() to commit.
 */
export function unproject(
  screenX: number,
  screenY: number,
  view: SceneViewport,
  p: ProjectionProfile = DEFAULT_PROFILE,
): GridCoordinate {
  const groundY = view.height * p.groundYRatio;
  const horizonY = view.height * p.horizonYRatio;
  const centerX = view.width * p.centerXRatio;

  const u = (groundY - screenY) / (groundY - horizonY); // 0 ground → 1 horizon
  const scale = Math.max(1e-4, 1 - u);
  const z = p.zNear / scale;
  const row = (z - p.zNear) / p.rowDepth;

  const cellWidth = view.width * p.cellWidthRatio * scale;
  const col = (screenX - centerX) / cellWidth + (GRID.cols - 1) / 2;

  return { col, row };
}

/** Did the tap land on the playable block rather than sky or margin? */
export function isTapOnBlock(coord: GridCoordinate): boolean {
  return (
    coord.col >= -0.5 && coord.col <= GRID.cols - 0.5 &&
    coord.row >= -0.5 && coord.row <= GRID.rows - 0.5
  );
}

// ─── Cache ───────────────────────────────────────────────────
// 64 cells is small enough that a full precompute per viewport beats
// memoising individual calls. Build on resize; never inside rAF.

export interface ProjectionTable {
  view: SceneViewport;
  profile: ProjectionProfile;
  /** Row-major, length cols × rows. */
  points: ScenePoint[];
  at(coord: GridCoordinate): ScenePoint;
  /** Occupied cells pre-sorted far → near. Draw in returned order. */
  drawOrder<T extends { col: number; row: number }>(items: T[]): Array<T & { point: ScenePoint }>;
}

const tableCache = new Map<string, ProjectionTable>();

function cacheKey(view: SceneViewport, p: ProjectionProfile): string {
  return [
    Math.round(view.width), Math.round(view.height),
    p.zNear, p.rowDepth, p.cellWidthRatio, p.groundYRatio,
    p.horizonYRatio, p.centerXRatio, p.actorHeightRatio,
  ].join('|');
}

export function getProjectionTable(
  view: SceneViewport,
  profile: ProjectionProfile = DEFAULT_PROFILE,
): ProjectionTable {
  const key = cacheKey(view, profile);
  const hit = tableCache.get(key);
  if (hit) return hit;

  const points: ScenePoint[] = [];
  for (let row = 0; row < GRID.rows; row++) {
    for (let col = 0; col < GRID.cols; col++) {
      points.push(project({ col, row }, view, profile));
    }
  }

  const table: ProjectionTable = {
    view,
    profile,
    points,
    at(coord) {
      const c = clampToGrid(coord);
      return points[Math.round(c.row) * GRID.cols + Math.round(c.col)];
    },
    drawOrder(items) {
      return items
        .map((item) => ({ ...item, point: table.at(item) }))
        .sort((a, b) => a.point.depth - b.point.depth);
    },
  };

  if (tableCache.size > 12) tableCache.clear(); // bound across orientation changes
  tableCache.set(key, table);
  return table;
}

/** Test/HMR hook. */
export function clearProjectionCache(): void {
  tableCache.clear();
}

// ─── Canvas helpers ──────────────────────────────────────────

/**
 * Size a canvas for DPR and return the logical viewport.
 * DPR is clamped to 2 — uncapped 3× on a phone triples fill cost for no
 * visible gain at this art scale.
 */
export function setupCanvas(
  canvas: HTMLCanvasElement,
  maxDpr = 2,
): { ctx: CanvasRenderingContext2D | null; view: SceneViewport; dpr: number } {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(maxDpr, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS px hereafter
  return { ctx, view: { width: rect.width, height: rect.height }, dpr };
}

/**
 * Draw an actor so its FOOT-CONTACT POINT lands exactly on the projected
 * ground position. This is the single fix for floating feet: sprites are
 * authored with pivot (0.5, 1.0) and drawn only through here.
 */
export function drawActor(
  ctx: CanvasRenderingContext2D,
  sprite: CanvasImageSource,
  spriteW: number,
  spriteH: number,
  point: ScenePoint,
  opts: { flipX?: boolean; alpha?: number; drawShadow?: boolean } = {},
): void {
  if (!spriteW || !spriteH) return;
  const h = point.actorHeight;
  const w = h * (spriteW / spriteH);
  const alpha = opts.alpha ?? 1;

  ctx.save();

  if (opts.drawShadow !== false) {
    ctx.globalAlpha = alpha * point.shadow.opacity;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(point.shadow.cx, point.shadow.cy, point.shadow.rx, point.shadow.ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = alpha;
  if (opts.flipX) {
    ctx.translate(point.x, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(sprite, -w / 2, point.y - h, w, h);
  } else {
    ctx.drawImage(sprite, point.x - w / 2, point.y - h, w, h);
  }
  ctx.restore();
}

/** Vehicles sit on the road plane with a wider, flatter shadow. */
export function drawVehicle(
  ctx: CanvasRenderingContext2D,
  sprite: CanvasImageSource,
  spriteW: number,
  spriteH: number,
  point: ScenePoint,
  lengthInCells = 2.6,
  opts: { flipX?: boolean; alpha?: number } = {},
): void {
  if (!spriteW || !spriteH) return;
  const w = point.cellWidth * lengthInCells;
  const h = w * (spriteH / spriteW);
  const alpha = opts.alpha ?? 1;

  ctx.save();
  ctx.globalAlpha = alpha * (point.shadow.opacity + 0.1);
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(point.x, point.y - h * 0.04, w * 0.46, h * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = alpha;
  if (opts.flipX) {
    ctx.translate(point.x, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(sprite, -w / 2, point.y - h, w, h);
  } else {
    ctx.drawImage(sprite, point.x - w / 2, point.y - h, w, h);
  }
  ctx.restore();
}

/**
 * Selection / target marker drawn as a ground-plane ellipse, so it sits
 * under the actor's feet instead of floating as a screen-space square.
 */
export function drawGroundMarker(
  ctx: CanvasRenderingContext2D,
  point: ScenePoint,
  color: string,
  opts: { dashed?: boolean; lineWidth?: number; alpha?: number } = {},
): void {
  ctx.save();
  ctx.globalAlpha = opts.alpha ?? 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = (opts.lineWidth ?? 2) * Math.max(0.6, point.scale);
  if (opts.dashed) ctx.setLineDash([6 * point.scale, 5 * point.scale]);
  ctx.beginPath();
  ctx.ellipse(point.x, point.y, point.cellWidth * 0.46, point.cellWidth * 0.46 * 0.36, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/**
 * Impact/damage effects must resolve to the SAME point the actor was
 * drawn at, or blood lands next to the body. Effects call this, never
 * their own math.
 */
export function effectAnchor(
  point: ScenePoint,
  part: 'feet' | 'torso' | 'head' = 'torso',
): { x: number; y: number; scale: number } {
  const lift = part === 'feet' ? 0 : part === 'torso' ? point.actorHeight * 0.55 : point.actorHeight * 0.88;
  return { x: point.x, y: point.y - lift, scale: point.scale };
}
