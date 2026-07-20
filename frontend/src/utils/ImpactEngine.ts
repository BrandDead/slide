// ============================================================
// SLIDE / DEALT — Persistent canvas destruction engine
// Object-pooled transient particles + persistent surface damage.
// Supports glass, metal, concrete, wood, asphalt, foliage, blood,
// smoke, sparks, bullet holes, cracks, dents, and broken states.
// ============================================================

export type ImpactSurfaceKind =
  | 'glass'
  | 'metal'
  | 'concrete'
  | 'wood'
  | 'asphalt'
  | 'foliage';

export interface ImpactSurface {
  id: string;
  kind: ImpactSurfaceKind;
  x: number;
  y: number;
  width: number;
  height: number;
  integrity: number;
}

export interface SurfaceDamageState {
  integrity: number;
  maxIntegrity: number;
  hitCount: number;
  broken: boolean;
}

export interface SurfaceImpactResult {
  surfaceId: string;
  kind: ImpactSurfaceKind;
  broken: boolean;
  newlyBroken: boolean;
  integrity: number;
}

type DecalKind = 'bullet-hole' | 'glass-crack' | 'dent' | 'chip' | 'splinter' | 'scorch';

interface DamageDecal {
  id: number;
  surfaceId: string;
  kind: DecalKind;
  surfaceKind: ImpactSurfaceKind;
  x: number;
  y: number;
  radius: number;
  rotation: number;
  alpha: number;
  seed: number;
}

interface BloodPool {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
}

interface AngularShard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationVelocity: number;
  size: number;
  life: number;
  maxLife: number;
  red: number;
  green: number;
  blue: number;
}

interface SmokePuff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
  maxLife: number;
  darkness: number;
}

const PARTICLE_CAPACITY = 4096;
const PARTICLE_FIELDS = 11;
const MAX_DECALS = 600;

const PX = 0;
const PY = 1;
const VX = 2;
const VY = 3;
const LIFE = 4;
const MAX_LIFE = 5;
const RED = 6;
const GREEN = 7;
const BLUE = 8;
const RADIUS = 9;
const DRAG = 10;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const seededUnit = (seed: number): number => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export class ImpactEngine {
  private width: number;
  private height: number;
  private particles = new Float32Array(PARTICLE_CAPACITY * PARTICLE_FIELDS);
  private particleCount = 0;
  private bloodPools: BloodPool[] = [];
  private shards: AngularShard[] = [];
  private smoke: SmokePuff[] = [];
  private decals: DamageDecal[] = [];
  private surfaces = new Map<string, ImpactSurface>();
  private surfaceStates = new Map<string, SurfaceDamageState>();
  private nextDecalId = 1;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  registerSurfaces(surfaces: readonly ImpactSurface[]): void {
    for (const surface of surfaces) {
      this.surfaces.set(surface.id, surface);
      if (!this.surfaceStates.has(surface.id)) {
        this.surfaceStates.set(surface.id, {
          integrity: surface.integrity,
          maxIntegrity: surface.integrity,
          hitCount: 0,
          broken: false,
        });
      }
    }
  }

  clear(): void {
    this.particleCount = 0;
    this.bloodPools = [];
    this.shards = [];
    this.smoke = [];
    this.decals = [];
    this.nextDecalId = 1;
    this.surfaceStates.clear();
    for (const surface of this.surfaces.values()) {
      this.surfaceStates.set(surface.id, {
        integrity: surface.integrity,
        maxIntegrity: surface.integrity,
        hitCount: 0,
        broken: false,
      });
    }
  }

  clearTransient(): void {
    this.particleCount = 0;
    this.bloodPools = [];
    this.shards = [];
    this.smoke = [];
  }

  getSurfaceState(surfaceId: string): SurfaceDamageState | undefined {
    const state = this.surfaceStates.get(surfaceId);
    return state ? { ...state } : undefined;
  }

  isSurfaceBroken(surfaceId: string): boolean {
    return this.surfaceStates.get(surfaceId)?.broken ?? false;
  }

  hitSurface(
    surface: ImpactSurface,
    x: number,
    y: number,
    angle: number,
    energy = 32,
  ): SurfaceImpactResult {
    if (!this.surfaces.has(surface.id)) this.registerSurfaces([surface]);

    const state = this.surfaceStates.get(surface.id) ?? {
      integrity: surface.integrity,
      maxIntegrity: surface.integrity,
      hitCount: 0,
      broken: false,
    };

    const previousBroken = state.broken;
    const materialMultiplier: Record<ImpactSurfaceKind, number> = {
      glass: 1.65,
      metal: 0.45,
      concrete: 0.38,
      wood: 0.85,
      asphalt: 0.32,
      foliage: 1.2,
    };

    state.hitCount += 1;
    state.integrity = Math.max(0, state.integrity - energy * materialMultiplier[surface.kind]);
    state.broken = state.integrity <= 0;
    this.surfaceStates.set(surface.id, state);

    switch (surface.kind) {
      case 'glass':
        this.addDecal(surface.id, 'glass-crack', surface.kind, x, y, 9 + Math.min(18, energy * 0.25));
        this.spawnGlass(x, y, angle, state.broken ? 1.8 : 0.65);
        if (state.broken && !previousBroken) {
          for (let i = 0; i < 3; i++) {
            this.spawnGlass(x + (Math.random() - 0.5) * surface.width * 0.5, y, angle, 1.5);
          }
          this.spawnSmoke(x, y, 0.35, 4);
        }
        break;
      case 'metal':
        this.addDecal(surface.id, 'bullet-hole', surface.kind, x, y, 3 + energy * 0.025);
        this.addDecal(surface.id, 'dent', surface.kind, x, y, 9 + energy * 0.08);
        this.spawnSparks(x, y, angle, 1 + energy / 90);
        break;
      case 'concrete':
        this.addDecal(surface.id, 'chip', surface.kind, x, y, 5 + energy * 0.05);
        this.spawnConcrete(x, y, angle, 1 + energy / 120);
        break;
      case 'wood':
        this.addDecal(surface.id, 'splinter', surface.kind, x, y, 7 + energy * 0.06);
        this.spawnWood(x, y, angle, 1 + energy / 100);
        break;
      case 'asphalt':
        this.addDecal(surface.id, 'chip', surface.kind, x, y, 4 + energy * 0.04);
        this.spawnConcrete(x, y, angle, 0.75);
        break;
      case 'foliage':
        this.spawnFoliage(x, y, angle, 1 + energy / 140);
        break;
    }

    return {
      surfaceId: surface.id,
      kind: surface.kind,
      broken: state.broken,
      newlyBroken: state.broken && !previousBroken,
      integrity: state.integrity,
    };
  }

  spawnBlood(x: number, y: number, angle: number, intensity = 1): void {
    const safeIntensity = clamp(intensity, 0.2, 2.2);
    const count = Math.round(10 + safeIntensity * 18);
    const spread = Math.PI * 0.65;

    for (let i = 0; i < count; i++) {
      const direction = angle + (Math.random() - 0.5) * spread;
      const speed = (80 + Math.random() * 230) * safeIntensity;
      this.addParticle(
        x,
        y,
        Math.cos(direction) * speed,
        Math.sin(direction) * speed - 70,
        0.32 + Math.random() * 0.52,
        0.28 + Math.random() * 0.18,
        0.008 + Math.random() * 0.025,
        0.008 + Math.random() * 0.02,
        1.2 + Math.random() * 2.5,
        0.986,
      );
    }

    this.bloodPools.push({
      x,
      y: Math.min(this.height * 0.76, y + 24),
      radius: 0,
      maxRadius: 7 + safeIntensity * 12,
      alpha: clamp(0.5 + safeIntensity * 0.2, 0.5, 0.88),
    });
  }

  spawnGlass(x: number, y: number, angle: number, intensity = 1): void {
    const count = Math.round(7 + clamp(intensity, 0.4, 2.5) * 11);
    for (let i = 0; i < count; i++) {
      const direction = angle + (Math.random() - 0.5) * Math.PI * 0.95;
      const speed = (95 + Math.random() * 260) * intensity;
      this.shards.push({
        x,
        y,
        vx: Math.cos(direction) * speed,
        vy: Math.sin(direction) * speed - 65,
        rotation: Math.random() * Math.PI * 2,
        rotationVelocity: (Math.random() - 0.5) * 12,
        size: 2.5 + Math.random() * 5.5,
        life: 0.55 + Math.random() * 0.75,
        maxLife: 0.55 + Math.random() * 0.75,
        red: 0.7 + Math.random() * 0.25,
        green: 0.84 + Math.random() * 0.14,
        blue: 1,
      });
    }
  }

  spawnSparks(x: number, y: number, angle: number, intensity = 1): void {
    const count = Math.round(12 + clamp(intensity, 0.5, 2.8) * 10);
    for (let i = 0; i < count; i++) {
      const direction = angle + (Math.random() - 0.5) * Math.PI * 0.55;
      const speed = (180 + Math.random() * 460) * intensity;
      this.addParticle(
        x,
        y,
        Math.cos(direction) * speed,
        Math.sin(direction) * speed - 90,
        0.16 + Math.random() * 0.34,
        1,
        0.45 + Math.random() * 0.5,
        Math.random() * 0.08,
        0.8 + Math.random() * 1.6,
        0.994,
      );
    }
  }

  spawnConcrete(x: number, y: number, angle: number, intensity = 1): void {
    const count = Math.round(9 + intensity * 10);
    for (let i = 0; i < count; i++) {
      const direction = angle + (Math.random() - 0.5) * Math.PI;
      const speed = (45 + Math.random() * 150) * intensity;
      const tone = 0.32 + Math.random() * 0.28;
      this.addParticle(
        x,
        y,
        Math.cos(direction) * speed,
        Math.sin(direction) * speed - 25,
        0.35 + Math.random() * 0.48,
        tone,
        tone,
        tone * 0.95,
        1.8 + Math.random() * 4.2,
        0.972,
      );
    }
    this.spawnSmoke(x, y, 0.55 * intensity, 3);
  }

  spawnSmoke(x: number, y: number, intensity = 1, count = 5): void {
    const amount = Math.max(1, Math.round(count * clamp(intensity, 0.25, 2.5)));
    for (let i = 0; i < amount; i++) {
      const maxLife = 0.7 + Math.random() * 1.1;
      this.smoke.push({
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 18,
        vy: -18 - Math.random() * 32,
        radius: 5 + Math.random() * 11 * intensity,
        life: maxLife,
        maxLife,
        darkness: 0.1 + Math.random() * 0.22,
      });
    }
  }

  update(dt: number): void {
    const safeDt = clamp(dt, 0, 0.05);
    const pool = this.particles;
    let writeIndex = 0;

    for (let i = 0; i < this.particleCount; i++) {
      const base = i * PARTICLE_FIELDS;
      let life = pool[base + LIFE] - safeDt;
      if (life <= 0) continue;

      pool[base + LIFE] = life;
      pool[base + PX] += pool[base + VX] * safeDt;
      pool[base + PY] += pool[base + VY] * safeDt;
      pool[base + VY] += 620 * safeDt;
      const drag = Math.pow(pool[base + DRAG], safeDt * 60);
      pool[base + VX] *= drag;
      pool[base + VY] *= Math.max(0.94, drag);

      if (pool[base + PY] > this.height * 0.94) {
        pool[base + PY] = this.height * 0.94;
        pool[base + VY] *= -0.18;
        pool[base + VX] *= 0.66;
      }

      if (writeIndex !== i) {
        const writeBase = writeIndex * PARTICLE_FIELDS;
        for (let field = 0; field < PARTICLE_FIELDS; field++) {
          pool[writeBase + field] = pool[base + field];
        }
      }
      writeIndex += 1;
    }
    this.particleCount = writeIndex;

    for (const bloodPool of this.bloodPools) {
      if (bloodPool.radius < bloodPool.maxRadius) {
        bloodPool.radius = Math.min(bloodPool.maxRadius, bloodPool.radius + safeDt * 11);
      } else {
        bloodPool.alpha -= safeDt * 0.018;
      }
    }
    this.bloodPools = this.bloodPools.filter((pool) => pool.alpha > 0.08);

    const liveShards: AngularShard[] = [];
    for (const shard of this.shards) {
      shard.life -= safeDt;
      if (shard.life <= 0) continue;
      shard.x += shard.vx * safeDt;
      shard.y += shard.vy * safeDt;
      shard.vy += 760 * safeDt;
      shard.vx *= Math.pow(0.985, safeDt * 60);
      shard.rotation += shard.rotationVelocity * safeDt;
      if (shard.y > this.height * 0.94) {
        shard.y = this.height * 0.94;
        shard.vy *= -0.22;
        shard.vx *= 0.58;
        shard.rotationVelocity *= 0.7;
      }
      liveShards.push(shard);
    }
    this.shards = liveShards;

    const liveSmoke: SmokePuff[] = [];
    for (const puff of this.smoke) {
      puff.life -= safeDt;
      if (puff.life <= 0) continue;
      puff.x += puff.vx * safeDt;
      puff.y += puff.vy * safeDt;
      puff.vx *= Math.pow(0.98, safeDt * 60);
      puff.radius += safeDt * 10;
      liveSmoke.push(puff);
    }
    this.smoke = liveSmoke;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    this.drawDecals(ctx);
    this.drawBloodPools(ctx);
    this.drawParticles(ctx);
    this.drawShards(ctx);
    this.drawSmoke(ctx);
  }

  drawDecals(ctx: CanvasRenderingContext2D): void {
    for (const decal of this.decals) {
      ctx.save();
      ctx.globalAlpha = decal.alpha;
      ctx.translate(decal.x, decal.y);
      ctx.rotate(decal.rotation);

      switch (decal.kind) {
        case 'bullet-hole':
          this.drawBulletHole(ctx, decal);
          break;
        case 'glass-crack':
          this.drawGlassCrack(ctx, decal);
          break;
        case 'dent':
          this.drawDent(ctx, decal);
          break;
        case 'chip':
          this.drawChip(ctx, decal);
          break;
        case 'splinter':
          this.drawSplinter(ctx, decal);
          break;
        case 'scorch':
          this.drawScorch(ctx, decal);
          break;
      }
      ctx.restore();
    }
  }

  private addDecal(
    surfaceId: string,
    kind: DecalKind,
    surfaceKind: ImpactSurfaceKind,
    x: number,
    y: number,
    radius: number,
  ): void {
    this.decals.push({
      id: this.nextDecalId,
      surfaceId,
      kind,
      surfaceKind,
      x,
      y,
      radius,
      rotation: Math.random() * Math.PI * 2,
      alpha: 0.95,
      seed: this.nextDecalId * 17.31 + x * 0.13 + y * 0.07,
    });
    this.nextDecalId += 1;
    if (this.decals.length > MAX_DECALS) this.decals.splice(0, this.decals.length - MAX_DECALS);
  }

  private spawnWood(x: number, y: number, angle: number, intensity: number): void {
    const count = Math.round(8 + intensity * 10);
    for (let i = 0; i < count; i++) {
      const direction = angle + (Math.random() - 0.5) * Math.PI * 0.8;
      const speed = (70 + Math.random() * 190) * intensity;
      this.addParticle(
        x,
        y,
        Math.cos(direction) * speed,
        Math.sin(direction) * speed - 45,
        0.32 + Math.random() * 0.5,
        0.35 + Math.random() * 0.25,
        0.18 + Math.random() * 0.12,
        0.06 + Math.random() * 0.05,
        1.4 + Math.random() * 3.5,
        0.978,
      );
    }
  }

  private spawnFoliage(x: number, y: number, angle: number, intensity: number): void {
    const count = Math.round(9 + intensity * 12);
    for (let i = 0; i < count; i++) {
      const direction = angle + (Math.random() - 0.5) * Math.PI * 1.25;
      const speed = (45 + Math.random() * 140) * intensity;
      this.addParticle(
        x,
        y,
        Math.cos(direction) * speed,
        Math.sin(direction) * speed - 40,
        0.45 + Math.random() * 0.7,
        0.08 + Math.random() * 0.08,
        0.3 + Math.random() * 0.28,
        0.07 + Math.random() * 0.1,
        1.8 + Math.random() * 3.2,
        0.965,
      );
    }
  }

  private addParticle(
    x: number,
    y: number,
    vx: number,
    vy: number,
    maxLife: number,
    red: number,
    green: number,
    blue: number,
    radius: number,
    drag: number,
  ): void {
    if (this.particleCount >= PARTICLE_CAPACITY) return;
    const base = this.particleCount * PARTICLE_FIELDS;
    const pool = this.particles;
    pool[base + PX] = x;
    pool[base + PY] = y;
    pool[base + VX] = vx;
    pool[base + VY] = vy;
    pool[base + LIFE] = maxLife;
    pool[base + MAX_LIFE] = maxLife;
    pool[base + RED] = red;
    pool[base + GREEN] = green;
    pool[base + BLUE] = blue;
    pool[base + RADIUS] = radius;
    pool[base + DRAG] = drag;
    this.particleCount += 1;
  }

  private drawBloodPools(ctx: CanvasRenderingContext2D): void {
    for (const pool of this.bloodPools) {
      if (pool.radius <= 0) continue;
      const gradient = ctx.createRadialGradient(pool.x, pool.y, 0, pool.x, pool.y, pool.radius);
      gradient.addColorStop(0, `rgba(92,2,8,${pool.alpha})`);
      gradient.addColorStop(0.62, `rgba(60,1,5,${pool.alpha * 0.75})`);
      gradient.addColorStop(1, 'rgba(38,0,3,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(pool.x, pool.y, pool.radius, pool.radius * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    const pool = this.particles;
    for (let i = 0; i < this.particleCount; i++) {
      const base = i * PARTICLE_FIELDS;
      const lifeRatio = clamp(pool[base + LIFE] / pool[base + MAX_LIFE], 0, 1);
      const red = Math.round(pool[base + RED] * 255);
      const green = Math.round(pool[base + GREEN] * 255);
      const blue = Math.round(pool[base + BLUE] * 255);
      const radius = Math.max(0.45, pool[base + RADIUS] * (0.55 + lifeRatio * 0.45));
      ctx.globalAlpha = Math.min(1, lifeRatio * 1.25);
      ctx.fillStyle = `rgb(${red},${green},${blue})`;
      ctx.beginPath();
      ctx.arc(pool[base + PX], pool[base + PY], radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawShards(ctx: CanvasRenderingContext2D): void {
    for (const shard of this.shards) {
      const lifeRatio = clamp(shard.life / shard.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = lifeRatio * 0.9;
      ctx.translate(shard.x, shard.y);
      ctx.rotate(shard.rotation);
      ctx.fillStyle = `rgb(${Math.round(shard.red * 255)},${Math.round(shard.green * 255)},${Math.round(shard.blue * 255)})`;
      ctx.beginPath();
      ctx.moveTo(0, -shard.size);
      ctx.lineTo(shard.size * 0.72, shard.size * 0.82);
      ctx.lineTo(-shard.size * 0.82, shard.size * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = `rgba(225,245,255,${lifeRatio * 0.7})`;
      ctx.lineWidth = 0.6;
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawSmoke(ctx: CanvasRenderingContext2D): void {
    for (const puff of this.smoke) {
      const lifeRatio = clamp(puff.life / puff.maxLife, 0, 1);
      const gradient = ctx.createRadialGradient(puff.x, puff.y, 0, puff.x, puff.y, puff.radius);
      const alpha = lifeRatio * puff.darkness;
      gradient.addColorStop(0, `rgba(18,20,23,${alpha})`);
      gradient.addColorStop(0.55, `rgba(35,38,42,${alpha * 0.65})`);
      gradient.addColorStop(1, 'rgba(60,62,66,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(puff.x, puff.y, puff.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawBulletHole(ctx: CanvasRenderingContext2D, decal: DamageDecal): void {
    const rim = ctx.createRadialGradient(0, 0, 0, 0, 0, decal.radius * 1.8);
    rim.addColorStop(0, 'rgba(0,0,0,0.98)');
    rim.addColorStop(0.34, 'rgba(10,10,10,0.95)');
    rim.addColorStop(0.55, 'rgba(118,104,90,0.55)');
    rim.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(0, 0, decal.radius * 1.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#020203';
    ctx.beginPath();
    ctx.ellipse(0, 0, decal.radius * 0.55, decal.radius * 0.43, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawGlassCrack(ctx: CanvasRenderingContext2D, decal: DamageDecal): void {
    ctx.strokeStyle = 'rgba(220,242,255,0.82)';
    ctx.lineWidth = 0.72;
    const rays = 7 + Math.floor(seededUnit(decal.seed) * 5);
    for (let i = 0; i < rays; i++) {
      const angle = (Math.PI * 2 * i) / rays + seededUnit(decal.seed + i) * 0.32;
      const length = decal.radius * (0.5 + seededUnit(decal.seed + i * 3) * 0.75);
      const bend = (seededUnit(decal.seed + i * 7) - 0.5) * decal.radius * 0.4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(
        Math.cos(angle) * length * 0.45 - Math.sin(angle) * bend,
        Math.sin(angle) * length * 0.45 + Math.cos(angle) * bend,
        Math.cos(angle) * length,
        Math.sin(angle) * length,
      );
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(178,222,242,0.45)';
    ctx.beginPath();
    ctx.arc(0, 0, decal.radius * 0.28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(5,12,18,0.72)';
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(1.2, decal.radius * 0.1), 0, Math.PI * 2);
    ctx.fill();
  }

  private drawDent(ctx: CanvasRenderingContext2D, decal: DamageDecal): void {
    const gradient = ctx.createRadialGradient(
      -decal.radius * 0.25,
      -decal.radius * 0.25,
      0,
      0,
      0,
      decal.radius,
    );
    gradient.addColorStop(0, 'rgba(255,255,255,0.2)');
    gradient.addColorStop(0.32, 'rgba(0,0,0,0.02)');
    gradient.addColorStop(0.7, 'rgba(0,0,0,0.42)');
    gradient.addColorStop(1, 'rgba(255,255,255,0.08)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, decal.radius, decal.radius * 0.66, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawChip(ctx: CanvasRenderingContext2D, decal: DamageDecal): void {
    const points = 7;
    ctx.fillStyle = decal.surfaceKind === 'asphalt' ? 'rgba(2,3,4,0.9)' : 'rgba(35,32,29,0.84)';
    ctx.beginPath();
    for (let i = 0; i < points; i++) {
      const angle = (Math.PI * 2 * i) / points;
      const radius = decal.radius * (0.62 + seededUnit(decal.seed + i) * 0.5);
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(185,176,164,0.42)';
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }

  private drawSplinter(ctx: CanvasRenderingContext2D, decal: DamageDecal): void {
    ctx.strokeStyle = 'rgba(58,28,10,0.92)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) {
      const y = (i - 2.5) * decal.radius * 0.22;
      ctx.beginPath();
      ctx.moveTo(-decal.radius * (0.2 + seededUnit(decal.seed + i) * 0.4), y);
      ctx.lineTo(decal.radius * (0.55 + seededUnit(decal.seed + i * 2) * 0.45), y + (seededUnit(decal.seed + i * 4) - 0.5) * 4);
      ctx.stroke();
    }
  }

  private drawScorch(ctx: CanvasRenderingContext2D, decal: DamageDecal): void {
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, decal.radius);
    gradient.addColorStop(0, 'rgba(0,0,0,0.72)');
    gradient.addColorStop(0.5, 'rgba(20,10,5,0.4)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, decal.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

export default ImpactEngine;
