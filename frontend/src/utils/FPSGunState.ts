// ============================================================
// FPSGunState.ts — Gun mechanics state machine
// Manages: ammo count, firing, reloading, bullet eject animation
// Used by FPSOverlay canvas renderer and DriveByEngine FPS mode
// Sprint: sfx-fps-ollama-assets
// ============================================================

export type GunState = 'idle' | 'firing' | 'ejecting' | 'empty' | 'reloading' | 'ready';

export interface BulletCasing {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotSpeed: number;
  life: number;
  maxLife: number;
}

export interface GunConfig {
  name: string;
  magazineSize: number;
  reloadTimeMs: number;
  fireRateMs: number;       // min ms between shots
  ejectDuration: number;    // ms casing is visible
  recoilX: number;          // px kick-back on fire
  recoilY: number;          // px kick-up on fire
}

export const GUN_CONFIGS: Record<string, GunConfig> = {
  compact: {
    name: 'Compact Prop',
    magazineSize: 15,
    reloadTimeMs: 1800,
    fireRateMs: 120,
    ejectDuration: 600,
    recoilX: 2,
    recoilY: 8,
  },
  long: {
    name: 'Drum Prop',
    magazineSize: 30,
    reloadTimeMs: 2800,
    fireRateMs: 80,
    ejectDuration: 500,
    recoilX: 4,
    recoilY: 14,
  },
};

export class FPSGunState {
  private config: GunConfig;
  private _ammo: number;
  private _state: GunState = 'idle';
  private _recoilX = 0;
  private _recoilY = 0;
  private lastFireTime = 0;
  private reloadTimer: ReturnType<typeof setTimeout> | null = null;

  // Bullet casings for eject animation
  casings: BulletCasing[] = [];

  // Callbacks
  onFire?: (x: number, y: number) => void;
  onEmpty?: () => void;
  onReloadStart?: () => void;
  onReloadComplete?: () => void;

  constructor(gunType: keyof typeof GUN_CONFIGS = 'compact') {
    this.config = GUN_CONFIGS[gunType] ?? GUN_CONFIGS.compact;
    this._ammo = this.config.magazineSize;
  }

  get ammo(): number { return this._ammo; }
  get magazineSize(): number { return this.config.magazineSize; }
  get state(): GunState { return this._state; }
  get recoilX(): number { return this._recoilX; }
  get recoilY(): number { return this._recoilY; }
  get isReloading(): boolean { return this._state === 'reloading'; }
  get isEmpty(): boolean { return this._ammo <= 0; }

  /**
   * Attempt to fire. Returns true if a shot was fired.
   * @param screenX - canvas X of aim point (for casing spawn)
   * @param screenY - canvas Y of aim point
   */
  fire(screenX: number, screenY: number): boolean {
    const now = Date.now();
    if (this._state === 'reloading') return false;
    if (this._ammo <= 0) {
      this._state = 'empty';
      this.onEmpty?.();
      return false;
    }
    if (now - this.lastFireTime < this.config.fireRateMs) return false;

    this.lastFireTime = now;
    this._ammo--;
    this._state = 'firing';

    // Recoil
    this._recoilX = (Math.random() - 0.5) * this.config.recoilX;
    this._recoilY = -this.config.recoilY;

    // Spawn ejected casing (top-right of gun position)
    this.casings.push({
      x: screenX + 20,
      y: screenY - 10,
      vx: 3 + Math.random() * 3,
      vy: -(2 + Math.random() * 3),
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: 0.2 + Math.random() * 0.3,
      life: 1,
      maxLife: this.config.ejectDuration / 1000,
    });

    this.onFire?.(screenX, screenY);

    // Return to idle after eject
    setTimeout(() => {
      if (this._state === 'firing') this._state = this._ammo > 0 ? 'idle' : 'empty';
    }, 80);

    return true;
  }

  /**
   * Start reload sequence.
   */
  reload(): void {
    if (this._state === 'reloading') return;
    if (this._ammo === this.config.magazineSize) return;
    this._state = 'reloading';
    this.onReloadStart?.();

    this.reloadTimer = setTimeout(() => {
      this._ammo = this.config.magazineSize;
      this._state = 'ready';
      this.onReloadComplete?.();
      setTimeout(() => { if (this._state === 'ready') this._state = 'idle'; }, 200);
    }, this.config.reloadTimeMs);
  }

  cancelReload(): void {
    if (this.reloadTimer) clearTimeout(this.reloadTimer);
    this._state = this._ammo > 0 ? 'idle' : 'empty';
  }

  /**
   * Update casings physics. Call every frame with dt in seconds.
   */
  updateCasings(dt: number): void {
    const surviving: BulletCasing[] = [];
    for (const c of this.casings) {
      c.life -= dt / c.maxLife;
      if (c.life <= 0) continue;
      c.x += c.vx;
      c.y += c.vy;
      c.vy += 0.3; // gravity
      c.vx *= 0.96;
      c.rotation += c.rotSpeed;
      surviving.push(c);
    }
    this.casings = surviving;

    // Decay recoil
    this._recoilX *= 0.85;
    this._recoilY *= 0.80;
    if (Math.abs(this._recoilY) < 0.1) this._recoilY = 0;
  }

  /**
   * Draw casings onto canvas.
   */
  drawCasings(ctx: CanvasRenderingContext2D): void {
    for (const c of this.casings) {
      const alpha = Math.max(0, c.life);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rotation);
      // Brass casing — small rectangle
      ctx.fillStyle = '#c8a84b';
      ctx.fillRect(-2, -5, 4, 10);
      ctx.fillStyle = '#e8c86b';
      ctx.fillRect(-1.5, -5, 3, 3);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  destroy(): void {
    if (this.reloadTimer) clearTimeout(this.reloadTimer);
  }
}
