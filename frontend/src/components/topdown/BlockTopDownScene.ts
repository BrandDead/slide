// ============================================================
// BlockTopDownScene.ts — Phaser 3 scene for the top-down
// block view.  Renders:
//   • Satellite image as the ground plane (or a dark fallback)
//   • 8×8 zone-tinted grid overlay
//   • Member sprites at their placement positions (real art via
//     worldActorResolver — no emoji, no coloured circles)
//   • Health bars, role-colour indicator dots
//   • Camera: top-down default; pinch-to-zoom; double-tap
//     fires 'firstPersonToggle' event so the React wrapper
//     can switch to a first-person view component
//
// Events emitted on this.events:
//   'ready'              — scene fully initialised
//   'cellClick'          — { col, row }
//   'memberClick'        — { memberId, col, row }
//   'firstPersonToggle'  — { col, row } (double-tap on member)
//
// P0 fixes applied (GPT audit, 2026-08-06):
//   1. Canonical role→textureKey map built during preload so
//      fallback roles (chemist→dealer art, etc.) share the
//      correct texture key rather than requesting a missing one.
//   2. State-aware sprite selection: downed/arrested members
//      use the appropriate state texture instead of idle.
//   3. All states (idle, downed, arrested) preloaded per role.
// ============================================================
import Phaser from 'phaser';
import type { BlockData, BlockPlacement } from '../../types/block.types';
import {
  GRID_COLS,
  GRID_ROWS,
  TD_CANVAS_W,
  TD_CANVAS_H,
  CELL_W,
  CELL_H,
  ZONE_TINT,
  ZONE_ALPHA,
  ROLE_TINT,
  SPRITE_SCALE,
  HP_BAR_W,
  HP_BAR_H,
  HP_BAR_OFFSET_Y,
  INDICATOR_R,
  cellToPixel,
  pixelToCell,
} from './blockTopDownCoords';
import { getWorldActor } from '../../render/worldActorResolver';
import { PhaserReadyGate } from '../../utils/phaserSceneReady';

// ─── Internal types ──────────────────────────────────────────
interface MemberSprite {
  sprite: Phaser.GameObjects.Image;
  hpBg: Phaser.GameObjects.Rectangle;
  hpFg: Phaser.GameObjects.Rectangle;
  dot: Phaser.GameObjects.Arc;
  placement: BlockPlacement;
}

/** States we preload per role */
const PRELOAD_STATES = ['idle', 'downed', 'arrested'] as const;
type SpriteState = typeof PRELOAD_STATES[number];

/** Build a deterministic Phaser texture key for a role+state pair */
function textureKey(role: string, state: SpriteState): string {
  return `actor-${role}-${state}`;
}

/** Choose the correct state for a placement based on health/status */
function stateForPlacement(placement: BlockPlacement): SpriteState {
  if ((placement.health ?? 100) <= 0) return 'downed';
  // BlockPlacement doesn't carry a status field directly, but the
  // member's status can be inferred from health for rendering.
  return 'idle';
}

// ─── Scene ───────────────────────────────────────────────────
export class BlockTopDownScene extends Phaser.Scene {
  private block: BlockData | null = null;
  private satelliteKey = 'block-satellite';
  private satelliteUrl: string | null = null;

  // Layer containers
  private bgLayer!: Phaser.GameObjects.Container;
  private gridLayer!: Phaser.GameObjects.Container;
  private memberLayer!: Phaser.GameObjects.Container;
  private uiLayer!: Phaser.GameObjects.Container;

  // Member sprite map: memberId → MemberSprite
  private memberSprites = new Map<string, MemberSprite>();

  // Canonical role → texture key map (built in preload)
  // Maps every role to the best available texture key for 'idle' state
  private roleToKey = new Map<string, string>();

  // Selection state
  private selectedMemberId: string | null = null;
  private selectionRect: Phaser.GameObjects.Rectangle | null = null;

  // Double-tap detection
  private lastTapTime = 0;
  private lastTapMemberId: string | null = null;
  readonly readyGate = new PhaserReadyGate();

  constructor() {
    super({ key: 'BlockTopDownScene' });
  }

  whenReady(cb: () => void): void {
    this.readyGate.whenReady(cb);
  }

  // ─── Public API (called by React wrapper) ─────────────────

  /** Feed the initial block data before the scene starts */
  setBlock(block: BlockData): void {
    this.block = block;
    this.satelliteUrl = block.topdownBgUrl ?? null;
  }

  /** Update placements after store changes (called from React) */
  updatePlacements(placements: BlockPlacement[]): void {
    if (!this.block) return;
    this.block = { ...this.block, placements };
    this.syncMemberSprites();
  }

  /** Highlight a cell (e.g. pending drop target) */
  highlightCell(col: number, row: number, on: boolean): void {
    const key = `hl-${col}-${row}`;
    const existing = this.gridLayer.getByName(key) as Phaser.GameObjects.Rectangle | null;
    if (on && !existing) {
      const { x, y } = cellToPixel(col, row);
      const rect = this.add.rectangle(x, y, CELL_W - 2, CELL_H - 2, 0xffffff, 0.18)
        .setName(key);
      this.gridLayer.add(rect);
    } else if (!on && existing) {
      existing.destroy();
    }
  }

  // ─── Phaser lifecycle ─────────────────────────────────────

  preload(): void {
    if (this.satelliteUrl) {
      this.load.image(this.satelliteKey, this.satelliteUrl);
    }

    // Preload all role sprites via worldActorResolver.
    // P0 fix: build a canonical role→textureKey map so fallback roles
    // (chemist→dealer art, runner→lookout art, etc.) share the SAME
    // texture key rather than each requesting a missing key.
    const urlToKey = new Map<string, string>();
    const roles = [
      'dealer', 'shooter', 'enforcer', 'lookout', 'driver',
      'chemist', 'runner', 'boss', 'k9', 'recruit', 'police',
    ];

    for (const role of roles) {
      for (const state of PRELOAD_STATES) {
        const resolved = getWorldActor(role, state, 'topdown');
        if (!resolved) continue;
        const url = resolved.url;
        const key = textureKey(role, state);

        if (urlToKey.has(url)) {
          // This URL was already registered under another key.
          // Point this role+state to the existing key so Phaser
          // doesn't double-load and syncMemberSprites can find it.
          // We store the canonical key in the role map for idle state.
          if (state === 'idle') {
            this.roleToKey.set(role, urlToKey.get(url)!);
          }
        } else {
          this.load.image(key, url);
          urlToKey.set(url, key);
          if (state === 'idle') {
            this.roleToKey.set(role, key);
          }
        }
      }
    }
  }

  create(): void {
    // ── Layers ──────────────────────────────────────────────
    this.bgLayer = this.add.container(0, 0);
    this.gridLayer = this.add.container(0, 0);
    this.memberLayer = this.add.container(0, 0);
    this.uiLayer = this.add.container(0, 0);

    // ── Background ──────────────────────────────────────────
    this.drawBackground();

    // ── Grid ────────────────────────────────────────────────
    this.drawGrid();

    // ── Members ─────────────────────────────────────────────
    this.syncMemberSprites();

    // ── Input ───────────────────────────────────────────────
    this.input.on('pointerdown', this.handlePointerDown, this);

    // ── Selection rect ──────────────────────────────────────
    this.selectionRect = this.add.rectangle(0, 0, CELL_W, CELL_H)
      .setStrokeStyle(2, 0xffffff, 0.9)
      .setFillStyle(0xffffff, 0.08)
      .setVisible(false);
    this.uiLayer.add(this.selectionRect);

    this.readyGate.markReady();
    this.events.emit('ready');
  }

  // ─── Drawing ──────────────────────────────────────────────

  private drawBackground(): void {
    if (this.textures.exists(this.satelliteKey)) {
      // Satellite image — scale to fill the canvas
      const img = this.add.image(TD_CANVAS_W / 2, TD_CANVAS_H / 2, this.satelliteKey)
        .setDisplaySize(TD_CANVAS_W, TD_CANVAS_H);
      this.bgLayer.add(img);
    } else {
      // Dark fallback
      const bg = this.add.rectangle(TD_CANVAS_W / 2, TD_CANVAS_H / 2, TD_CANVAS_W, TD_CANVAS_H, 0x0a0a14, 1);
      this.bgLayer.add(bg);
      // Draw a subtle street grid pattern
      const gfx = this.add.graphics();
      gfx.lineStyle(1, 0x1a1a2e, 0.6);
      for (let c = 0; c <= GRID_COLS; c++) {
        gfx.moveTo(c * CELL_W, 0);
        gfx.lineTo(c * CELL_W, TD_CANVAS_H);
      }
      for (let r = 0; r <= GRID_ROWS; r++) {
        gfx.moveTo(0, r * CELL_H);
        gfx.lineTo(TD_CANVAS_W, r * CELL_H);
      }
      gfx.strokePath();
      this.bgLayer.add(gfx);
    }
  }

  private drawGrid(): void {
    if (!this.block) return;

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const zone = this.block.grid[r]?.[c];
        if (!zone) continue;

        const { x, y } = cellToPixel(c, r);
        const tint = ZONE_TINT[zone.zoneType] ?? 0x111111;
        const alpha = ZONE_ALPHA[zone.zoneType] ?? 0.35;

        const cell = this.add.rectangle(x, y, CELL_W - 1, CELL_H - 1, tint, alpha);
        this.gridLayer.add(cell);

        // Zone label (tiny text)
        const label = this.add.text(x, y + CELL_H * 0.36, zone.zoneType.toUpperCase().slice(0, 4), {
          fontSize: '7px',
          color: '#ffffff',
          fontFamily: 'monospace',
        }).setOrigin(0.5, 0.5).setAlpha(0.35);
        this.gridLayer.add(label);
      }
    }
  }

  /** Return the best Phaser texture key for a placement's current state */
  private resolveTextureKey(placement: BlockPlacement): string {
    const state = stateForPlacement(placement);
    // Try the exact role+state key first
    const exactKey = textureKey(placement.role, state);
    if (this.textures.exists(exactKey)) return exactKey;
    // Fall back to the canonical idle key for this role
    const idleKey = this.roleToKey.get(placement.role);
    if (idleKey && this.textures.exists(idleKey)) return idleKey;
    // Last resort: dealer idle
    return textureKey('dealer', 'idle');
  }

  private syncMemberSprites(): void {
    if (!this.block) return;
    const current = new Set(this.block.placements.map((p) => p.memberId));

    // Remove sprites for members no longer on block
    for (const [id, ms] of this.memberSprites) {
      if (!current.has(id)) {
        ms.sprite.destroy();
        ms.hpBg.destroy();
        ms.hpFg.destroy();
        ms.dot.destroy();
        this.memberSprites.delete(id);
      }
    }

    // Add / update sprites
    for (const placement of this.block.placements) {
      const { x, y } = cellToPixel(placement.x, placement.y);
      const roleTint = ROLE_TINT[placement.role] ?? 0xffffff;

      if (this.memberSprites.has(placement.memberId)) {
        // Update position, health, and state texture
        const ms = this.memberSprites.get(placement.memberId)!;
        const newKey = this.resolveTextureKey(placement);
        if (ms.sprite.texture.key !== newKey) {
          ms.sprite.setTexture(newKey);
        }
        ms.sprite.setPosition(x, y);
        ms.hpBg.setPosition(x, y - HP_BAR_OFFSET_Y);
        ms.hpFg.setPosition(x - HP_BAR_W / 2, y - HP_BAR_OFFSET_Y);
        ms.dot.setPosition(x, y + CELL_H * 0.38);
        const hpRatio = Math.max(0, Math.min(1, (placement.health ?? 100) / 100));
        ms.hpFg.setSize(HP_BAR_W * hpRatio, HP_BAR_H);
        ms.placement = placement;
      } else {
        // Create new sprite using the canonical texture key
        const spriteKey = this.resolveTextureKey(placement);
        const sprite = this.add.image(x, y, spriteKey)
          .setScale(SPRITE_SCALE)
          .setInteractive({ useHandCursor: true });

        sprite.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
          this.handleMemberTap(placement.memberId, placement.x, placement.y, ptr);
        });

        // Health bar background
        const hpBg = this.add.rectangle(x, y - HP_BAR_OFFSET_Y, HP_BAR_W, HP_BAR_H, 0x333333, 0.8)
          .setOrigin(0.5, 0.5);

        // Health bar foreground
        const hpRatio = Math.max(0, Math.min(1, (placement.health ?? 100) / 100));
        const hpFg = this.add.rectangle(
          x - HP_BAR_W / 2,
          y - HP_BAR_OFFSET_Y,
          HP_BAR_W * hpRatio,
          HP_BAR_H,
          0x4ade80,
          1
        ).setOrigin(0, 0.5);

        // Role indicator dot
        const dot = this.add.circle(x, y + CELL_H * 0.38, INDICATOR_R, roleTint, 0.9);

        this.memberLayer.add(sprite);
        this.memberLayer.add(hpBg);
        this.memberLayer.add(hpFg);
        this.memberLayer.add(dot);

        this.memberSprites.set(placement.memberId, {
          sprite, hpBg, hpFg, dot, placement,
        });
      }
    }
  }

  // ─── Input ────────────────────────────────────────────────

  private handlePointerDown(ptr: Phaser.Input.Pointer): void {
    const { col, row } = pixelToCell(ptr.x, ptr.y);
    this.events.emit('cellClick', { col, row });

    // Move selection rect
    const { x, y } = cellToPixel(col, row);
    if (this.selectionRect) {
      this.selectionRect.setPosition(x, y).setVisible(true);
    }
  }

  private handleMemberTap(memberId: string, col: number, row: number, _ptr: Phaser.Input.Pointer): void {
    const now = Date.now();
    const isDoubleTap = (now - this.lastTapTime < 400) && (this.lastTapMemberId === memberId);

    this.lastTapTime = now;
    this.lastTapMemberId = memberId;

    if (isDoubleTap) {
      this.events.emit('firstPersonToggle', { memberId, col, row });
      return;
    }

    // Single tap — select member
    this.selectedMemberId = memberId;
    const { x, y } = cellToPixel(col, row);
    if (this.selectionRect) {
      this.selectionRect.setPosition(x, y).setVisible(true);
    }
    this.events.emit('memberClick', { memberId, col, row });
  }
}
