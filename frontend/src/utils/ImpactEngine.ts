// ============================================================
// ImpactEngine.ts — Canvas destruction & impact particle system
// High-performance object-pooled particle engine for:
//   - Blood splatter (directional, dark-red, gravity + fade)
//   - Blood pools (static ground decals that expand slowly)
//   - Glass shards (blue-white angular fragments)
//   - Concrete dust (grey puffs for missed shots)
//   - Metallic sparks (high-velocity yellow/orange)
//
// Usage:
//   const engine = new ImpactEngine(width, height);
//   engine.spawnBlood(x, y, angle, intensity);
//   engine.spawnGlass(x, y, angle);
//   engine.spawnSparks(x, y, angle);
//   // In render loop:
//   engine.update(dt);
//   engine.draw(ctx);
//   // On event reset:
//   engine.clear();
//
// Sprint: impact-engine-sound-perf
// ============================================================

// ─── Pool sizes ──────────────────────────────────────────────
const POOL_SIZE = 2048; // max simultaneous particles
const POOL_FIELDS = 10; // x, y, vx, vy, life, maxLife, r, g, b, radius

// ─── Blood pool decal ────────────────────────────────────────
interface BloodPool {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
}

// ─── Glass shard ─────────────────────────────────────────────
interface GlassShard {
  x: number; y: number;
  vx: number; vy: number;
  rotation: number; rotSpeed: number;
  size: number;
  life: number; maxLife: number;
  r: number; g: number; b: number;
}

export class ImpactEngine {
  private width: number;
  private height: number;

  // ── Particle pool (Float32Array for GC-free updates) ──
  // Layout per particle: [x, y, vx, vy, life, maxLife, r, g, b, radius]
  private pool: Float32Array;
  private poolCount: number = 0;

  // ── Blood pools (static decals) ──
  private bloodPools: BloodPool[] = [];

  // ── Glass shards ──
  private glassShards: GlassShard[] = [];

  constructor(width: number, height: number) {
    this.width  = width;  // used in spawnBlood ground-pool Y calc
    this.height = height;
    this.pool   = new Float32Array(POOL_SIZE * POOL_FIELDS);
  }

  // ─── Public API ──────────────────────────────────────────

  resize(width: number, height: number): void {
    this.width  = width;
    this.height = height;
  }

  clear(): void {
    this.poolCount  = 0;
    this.bloodPools = [];
    this.glassShards = [];
  }

  /**
   * Spawn directional blood splatter + a ground pool decal.
   * @param x - canvas X
   * @param y - canvas Y
   * @param angle - direction of impact (radians)
   * @param intensity - 0.0–1.0 (scales particle count and pool size)
   */
  spawnBlood(x: number, y: number, angle: number, intensity: number): void {
    const count = Math.round(8 + intensity * 16);
    const spread = Math.PI * 0.6;

    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const speed = (1 + Math.random() * 4) * intensity;
      this._addParticle(
        x, y,
        Math.cos(a) * speed,
        Math.sin(a) * speed - 1.5,
        0.3 + Math.random() * 0.5,
        // Dark red, slight variation
        0.45 + Math.random() * 0.1,  // r
        0.02 + Math.random() * 0.04, // g
        0.02 + Math.random() * 0.04, // b
        1.5 + Math.random() * 2,
      );
    }

    // Ground pool decal
    const groundY = this.height * 0.78; // approximate curb/sidewalk level
    this.bloodPools.push({
      x,
      y: Math.min(y + 20, groundY),
      radius: 0,
      maxRadius: 6 + intensity * 14,
      alpha: 0.6 + intensity * 0.3,
    });
  }

  /**
   * Spawn glass / concrete debris (used for misses hitting environment).
   * Blue-white for glass, grey for concrete.
   */
  spawnGlass(x: number, y: number, angle: number): void {
    const count = 6 + Math.floor(Math.random() * 8);
    // Above sidewalk (62% height) and not at the far edges = glass; otherwise concrete
    const isGlass = y < this.height * 0.65 && x > 0 && x < this.width;

    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * Math.PI * 0.8;
      const speed = 2 + Math.random() * 5;
      if (isGlass) {
        // Glass shard (angular, blue-white)
        this.glassShards.push({
          x, y,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed - 2,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.3,
          size: 3 + Math.random() * 5,
          life: 1, maxLife: 0.6 + Math.random() * 0.4,
          r: 0.7 + Math.random() * 0.3,
          g: 0.85 + Math.random() * 0.15,
          b: 1.0,
        });
      } else {
        // Concrete dust (grey particles)
        this._addParticle(
          x, y,
          Math.cos(a) * speed * 0.6,
          Math.sin(a) * speed * 0.6 - 1,
          0.4 + Math.random() * 0.3,
          0.4 + Math.random() * 0.2,
          0.4 + Math.random() * 0.2,
          0.4 + Math.random() * 0.2,
          3 + Math.random() * 4,
        );
      }
    }
  }

  /**
   * Spawn high-velocity metallic sparks (car / pole hits).
   */
  spawnSparks(x: number, y: number, angle: number): void {
    const count = 12 + Math.floor(Math.random() * 10);
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * Math.PI * 0.5;
      const speed = 3 + Math.random() * 8;
      this._addParticle(
        x, y,
        Math.cos(a) * speed,
        Math.sin(a) * speed - 2,
        0.2 + Math.random() * 0.3,
        1.0,                          // r — bright yellow/orange
        0.7 + Math.random() * 0.3,   // g
        0.0 + Math.random() * 0.1,   // b
        1 + Math.random() * 1.5,
      );
    }
  }

  // ─── Update ──────────────────────────────────────────────

  update(dt: number): void {
    const p = this.pool;
    let writeIdx = 0;

    for (let i = 0; i < this.poolCount; i++) {
      const base = i * POOL_FIELDS;
      let life = p[base + 4];
      const maxLife = p[base + 5];

      life -= dt / maxLife;
      if (life <= 0) continue;

      // Physics
      p[base + 0] += p[base + 2];       // x += vx
      p[base + 1] += p[base + 3];       // y += vy
      p[base + 3] += 0.18;              // gravity
      p[base + 2] *= 0.98;              // air friction
      p[base + 4]  = life;

      // Compact surviving particles
      if (writeIdx !== i) {
        const wb = writeIdx * POOL_FIELDS;
        for (let f = 0; f < POOL_FIELDS; f++) p[wb + f] = p[base + f];
      }
      writeIdx++;
    }
    this.poolCount = writeIdx;

    // Blood pools — slowly expand then fade
    for (const pool of this.bloodPools) {
      if (pool.radius < pool.maxRadius) {
        pool.radius += dt * 8;
      } else {
        pool.alpha -= dt * 0.08;
      }
    }
    this.bloodPools = this.bloodPools.filter(p => p.alpha > 0.01);

    // Glass shards
    const survivingShards: GlassShard[] = [];
    for (const shard of this.glassShards) {
      shard.life -= dt / shard.maxLife;
      if (shard.life <= 0) continue;
      shard.x += shard.vx;
      shard.y += shard.vy;
      shard.vy += 0.2;
      shard.vx *= 0.97;
      shard.rotation += shard.rotSpeed;
      survivingShards.push(shard);
    }
    this.glassShards = survivingShards;
  }

  // ─── Draw ────────────────────────────────────────────────

  draw(ctx: CanvasRenderingContext2D): void {
    // 1. Blood pools (drawn first, under everything)
    for (const pool of this.bloodPools) {
      if (pool.radius <= 0) continue;
      const grad = ctx.createRadialGradient(pool.x, pool.y, 0, pool.x, pool.y, pool.radius);
      grad.addColorStop(0, `rgba(100,5,5,${pool.alpha})`);
      grad.addColorStop(0.6, `rgba(80,3,3,${pool.alpha * 0.7})`);
      grad.addColorStop(1, `rgba(60,2,2,0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(pool.x, pool.y, pool.radius, pool.radius * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Particles (blood drops, concrete dust, sparks)
    const p = this.pool;
    for (let i = 0; i < this.poolCount; i++) {
      const base = i * POOL_FIELDS;
      const life   = p[base + 4];
      const maxLife = p[base + 5];
      const alpha  = Math.max(0, life);
      const r      = Math.round(p[base + 6] * 255);
      const g      = Math.round(p[base + 7] * 255);
      const b      = Math.round(p[base + 8] * 255);
      const radius = p[base + 9] * (life / maxLife);

      ctx.globalAlpha = alpha;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.beginPath();
      ctx.arc(p[base + 0], p[base + 1], Math.max(0.5, radius), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 3. Glass shards (angular polygons)
    for (const shard of this.glassShards) {
      const alpha = Math.max(0, shard.life);
      ctx.globalAlpha = alpha * 0.85;
      ctx.save();
      ctx.translate(shard.x, shard.y);
      ctx.rotate(shard.rotation);
      ctx.fillStyle = `rgba(${Math.round(shard.r * 255)},${Math.round(shard.g * 255)},${Math.round(shard.b * 255)},${alpha})`;
      ctx.beginPath();
      // Irregular triangle shard
      ctx.moveTo(0, -shard.size);
      ctx.lineTo(shard.size * 0.6, shard.size * 0.8);
      ctx.lineTo(-shard.size * 0.8, shard.size * 0.5);
      ctx.closePath();
      ctx.fill();
      // Highlight edge
      ctx.strokeStyle = `rgba(200,230,255,${alpha * 0.6})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // ─── Private helpers ─────────────────────────────────────

  private _addParticle(
    x: number, y: number,
    vx: number, vy: number,
    maxLife: number,
    r: number, g: number, b: number,
    radius: number,
  ): void {
    if (this.poolCount >= POOL_SIZE) return; // pool full — drop particle
    const base = this.poolCount * POOL_FIELDS;
    const p = this.pool;
    p[base + 0] = x;
    p[base + 1] = y;
    p[base + 2] = vx;
    p[base + 3] = vy;
    p[base + 4] = 1.0;     // life (starts full)
    p[base + 5] = maxLife;
    p[base + 6] = r;
    p[base + 7] = g;
    p[base + 8] = b;
    p[base + 9] = radius;
    this.poolCount++;
  }
}
