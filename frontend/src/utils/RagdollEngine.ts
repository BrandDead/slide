// ============================================================
// SLIDE / DEALT — Lightweight articulated 2D ragdoll engine
// Verlet integration + distance constraints keeps this browser-safe
// while still providing directional hit reactions and grounded bodies.
// ============================================================

interface RagdollPoint {
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  radius: number;
}

interface RagdollConstraint {
  a: number;
  b: number;
  length: number;
  stiffness: number;
}

interface RagdollBody {
  id: string;
  points: RagdollPoint[];
  constraints: RagdollConstraint[];
  baseX: number;
  baseY: number;
  scale: number;
  clothingColor: string;
  skinColor: string;
  active: boolean;
  downed: boolean;
  recoveryTimer: number;
  opacity: number;
}

export interface RagdollHitOptions {
  hitX: number;
  hitY: number;
  directionX: number;
  directionY: number;
  force: number;
  lethal: boolean;
}

const HEAD = 0;
const NECK = 1;
const SHOULDER_LEFT = 2;
const SHOULDER_RIGHT = 3;
const ELBOW_LEFT = 4;
const ELBOW_RIGHT = 5;
const HAND_LEFT = 6;
const HAND_RIGHT = 7;
const HIP_LEFT = 8;
const HIP_RIGHT = 9;
const KNEE_LEFT = 10;
const KNEE_RIGHT = 11;
const FOOT_LEFT = 12;
const FOOT_RIGHT = 13;

const STANDING_POSE: ReadonlyArray<readonly [number, number, number]> = [
  [0, -31, 7],
  [0, -20, 3],
  [-8, -17, 3],
  [8, -17, 3],
  [-12, -4, 3],
  [12, -4, 3],
  [-13, 10, 3],
  [13, 10, 3],
  [-5, 3, 4],
  [5, 3, 4],
  [-6, 19, 4],
  [6, 19, 4],
  [-7, 35, 4],
  [7, 35, 4],
];

const CONSTRAINT_PAIRS: ReadonlyArray<readonly [number, number, number]> = [
  [HEAD, NECK, 11],
  [NECK, SHOULDER_LEFT, 8],
  [NECK, SHOULDER_RIGHT, 8],
  [SHOULDER_LEFT, SHOULDER_RIGHT, 16],
  [SHOULDER_LEFT, ELBOW_LEFT, 14],
  [ELBOW_LEFT, HAND_LEFT, 14],
  [SHOULDER_RIGHT, ELBOW_RIGHT, 14],
  [ELBOW_RIGHT, HAND_RIGHT, 14],
  [NECK, HIP_LEFT, 24],
  [NECK, HIP_RIGHT, 24],
  [HIP_LEFT, HIP_RIGHT, 10],
  [HIP_LEFT, KNEE_LEFT, 17],
  [KNEE_LEFT, FOOT_LEFT, 17],
  [HIP_RIGHT, KNEE_RIGHT, 17],
  [KNEE_RIGHT, FOOT_RIGHT, 17],
  [SHOULDER_LEFT, HIP_LEFT, 22],
  [SHOULDER_RIGHT, HIP_RIGHT, 22],
  [SHOULDER_LEFT, HIP_RIGHT, 25],
  [SHOULDER_RIGHT, HIP_LEFT, 25],
];

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

function addRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export class RagdollEngine {
  private bodies = new Map<string, RagdollBody>();

  clear(): void {
    this.bodies.clear();
  }

  ensure(
    id: string,
    x: number,
    y: number,
    scale = 1,
    clothingColor = '#303846',
    skinColor = '#9a6648',
  ): void {
    const existing = this.bodies.get(id);
    if (existing) {
      existing.baseX = x;
      existing.baseY = y;
      existing.scale = scale;
      existing.clothingColor = clothingColor;
      existing.skinColor = skinColor;
      if (!existing.active) this.snapToStandingPose(existing);
      return;
    }

    const points = STANDING_POSE.map(([offsetX, offsetY, radius]) => ({
      x: x + offsetX * scale,
      y: y + offsetY * scale,
      previousX: x + offsetX * scale,
      previousY: y + offsetY * scale,
      radius: radius * scale,
    }));

    const constraints = CONSTRAINT_PAIRS.map(([a, b, length], index) => ({
      a,
      b,
      length: length * scale,
      stiffness: index < 4 ? 1 : 0.92,
    }));

    this.bodies.set(id, {
      id,
      points,
      constraints,
      baseX: x,
      baseY: y,
      scale,
      clothingColor,
      skinColor,
      active: false,
      downed: false,
      recoveryTimer: 0,
      opacity: 1,
    });
  }

  removeMissing(activeIds: ReadonlySet<string>): void {
    for (const id of this.bodies.keys()) {
      if (!activeIds.has(id)) this.bodies.delete(id);
    }
  }

  isActive(id: string): boolean {
    return this.bodies.get(id)?.active ?? false;
  }

  isDowned(id: string): boolean {
    return this.bodies.get(id)?.downed ?? false;
  }

  setDowned(id: string, downed: boolean): void {
    const body = this.bodies.get(id);
    if (!body) return;
    body.downed = downed;
    body.active = downed || body.active;
    if (!downed) body.recoveryTimer = 0.35;
  }

  applyHit(id: string, options: RagdollHitOptions): void {
    const body = this.bodies.get(id);
    if (!body) return;

    body.active = true;
    body.downed = options.lethal || body.downed;
    body.recoveryTimer = options.lethal ? Number.POSITIVE_INFINITY : 0.48;

    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    body.points.forEach((point, index) => {
      const dx = point.x - options.hitX;
      const dy = point.y - options.hitY;
      const distance = dx * dx + dy * dy;
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    const directionLength = Math.hypot(options.directionX, options.directionY) || 1;
    const nx = options.directionX / directionLength;
    const ny = options.directionY / directionLength;
    const force = clamp(options.force, 40, 520) * body.scale;

    const impacted = body.points[nearestIndex];
    impacted.previousX -= nx * force * 0.016;
    impacted.previousY -= ny * force * 0.016;

    // Transfer part of the impulse into the torso so the body reacts as one mass.
    for (const index of [NECK, SHOULDER_LEFT, SHOULDER_RIGHT, HIP_LEFT, HIP_RIGHT]) {
      const point = body.points[index];
      const attenuation = index === nearestIndex ? 1 : 0.28;
      point.previousX -= nx * force * 0.016 * attenuation;
      point.previousY -= ny * force * 0.016 * attenuation;
    }
  }

  update(dt: number, floorY: number, width: number, height: number): void {
    const safeDt = clamp(dt, 0, 0.033);
    const gravityStep = 920 * safeDt * safeDt;

    for (const body of this.bodies.values()) {
      if (!body.active) continue;

      if (!body.downed) body.recoveryTimer -= safeDt;

      for (const point of body.points) {
        const velocityX = (point.x - point.previousX) * 0.985;
        const velocityY = (point.y - point.previousY) * 0.985;
        point.previousX = point.x;
        point.previousY = point.y;
        point.x += velocityX;
        point.y += velocityY + gravityStep;
      }

      for (let iteration = 0; iteration < 6; iteration++) {
        for (const constraint of body.constraints) {
          const a = body.points[constraint.a];
          const b = body.points[constraint.b];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distance = Math.hypot(dx, dy) || 0.0001;
          const difference = ((distance - constraint.length) / distance) * 0.5 * constraint.stiffness;
          const offsetX = dx * difference;
          const offsetY = dy * difference;
          a.x += offsetX;
          a.y += offsetY;
          b.x -= offsetX;
          b.y -= offsetY;
        }

        for (const point of body.points) {
          if (point.y + point.radius > floorY) {
            const velocityX = point.x - point.previousX;
            point.y = floorY - point.radius;
            point.previousY = point.y + Math.abs(point.y - point.previousY) * 0.08;
            point.previousX = point.x - velocityX * 0.58;
          }
          point.x = clamp(point.x, point.radius, width - point.radius);
          point.y = clamp(point.y, point.radius, height + 80);
        }
      }

      if (!body.downed && body.recoveryTimer <= 0) {
        let totalDistance = 0;
        body.points.forEach((point, index) => {
          const [offsetX, offsetY] = STANDING_POSE[index];
          const targetX = body.baseX + offsetX * body.scale;
          const targetY = body.baseY + offsetY * body.scale;
          point.x += (targetX - point.x) * 0.22;
          point.y += (targetY - point.y) * 0.22;
          point.previousX += (targetX - point.previousX) * 0.22;
          point.previousY += (targetY - point.previousY) * 0.22;
          totalDistance += Math.hypot(targetX - point.x, targetY - point.y);
        });

        if (totalDistance / body.points.length < 1.2) {
          body.active = false;
          this.snapToStandingPose(body);
        }
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const body of this.bodies.values()) {
      if (!body.active) continue;

      const p = body.points;
      ctx.save();
      ctx.globalAlpha = body.opacity;

      // Grounding shadow.
      const footMidX = (p[FOOT_LEFT].x + p[FOOT_RIGHT].x) * 0.5;
      const footMidY = Math.max(p[FOOT_LEFT].y, p[FOOT_RIGHT].y) + 3;
      ctx.fillStyle = 'rgba(0,0,0,0.34)';
      ctx.beginPath();
      ctx.ellipse(footMidX, footMidY, 16 * body.scale, 4.5 * body.scale, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Legs.
      ctx.strokeStyle = '#1d232c';
      ctx.lineWidth = 7 * body.scale;
      this.drawChain(ctx, p, [HIP_LEFT, KNEE_LEFT, FOOT_LEFT]);
      this.drawChain(ctx, p, [HIP_RIGHT, KNEE_RIGHT, FOOT_RIGHT]);

      // Torso as a filled quad.
      ctx.fillStyle = body.clothingColor;
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 1.3 * body.scale;
      ctx.beginPath();
      ctx.moveTo(p[SHOULDER_LEFT].x, p[SHOULDER_LEFT].y);
      ctx.lineTo(p[SHOULDER_RIGHT].x, p[SHOULDER_RIGHT].y);
      ctx.lineTo(p[HIP_RIGHT].x, p[HIP_RIGHT].y);
      ctx.lineTo(p[HIP_LEFT].x, p[HIP_LEFT].y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Arms.
      ctx.strokeStyle = body.clothingColor;
      ctx.lineWidth = 6 * body.scale;
      this.drawChain(ctx, p, [SHOULDER_LEFT, ELBOW_LEFT]);
      this.drawChain(ctx, p, [SHOULDER_RIGHT, ELBOW_RIGHT]);
      ctx.strokeStyle = body.skinColor;
      ctx.lineWidth = 5 * body.scale;
      this.drawChain(ctx, p, [ELBOW_LEFT, HAND_LEFT]);
      this.drawChain(ctx, p, [ELBOW_RIGHT, HAND_RIGHT]);

      // Shoes.
      ctx.fillStyle = '#090b0e';
      for (const footIndex of [FOOT_LEFT, FOOT_RIGHT]) {
        const foot = p[footIndex];
        addRoundedRect(
          ctx,
          foot.x - 5 * body.scale,
          foot.y - 2.5 * body.scale,
          10 * body.scale,
          5 * body.scale,
          2 * body.scale,
        );
        ctx.fill();
      }

      // Head.
      ctx.fillStyle = body.skinColor;
      ctx.beginPath();
      ctx.arc(p[HEAD].x, p[HEAD].y, p[HEAD].radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1 * body.scale;
      ctx.stroke();

      ctx.restore();
    }
  }

  private drawChain(
    ctx: CanvasRenderingContext2D,
    points: RagdollPoint[],
    indexes: number[],
  ): void {
    if (indexes.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[indexes[0]].x, points[indexes[0]].y);
    for (let i = 1; i < indexes.length; i++) {
      ctx.lineTo(points[indexes[i]].x, points[indexes[i]].y);
    }
    ctx.stroke();
  }

  private snapToStandingPose(body: RagdollBody): void {
    body.points.forEach((point, index) => {
      const [offsetX, offsetY] = STANDING_POSE[index];
      const x = body.baseX + offsetX * body.scale;
      const y = body.baseY + offsetY * body.scale;
      point.x = x;
      point.y = y;
      point.previousX = x;
      point.previousY = y;
    });
  }
}

export default RagdollEngine;
