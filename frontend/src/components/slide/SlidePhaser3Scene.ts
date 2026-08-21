// ============================================================
// SlidePhaser3Scene.ts — Phaser 3 visual layer for SLIDE combat
//
// Renders the 8x8 block grid, member sprites, car, bullets, hits.
// Pure visual layer — game logic lives in slideGameEngine.ts.
// ============================================================

import Phaser from 'phaser';
import {
  BLOCK_COLS,
  BLOCK_ROWS,
  STREET_ROW,
  type SlideGameState,
  type SlideMember,
} from '../../utils/slideGameEngine';

// Re-export all pure coordinate helpers from the Phaser-free module
export {
  CELL_SIZE,
  GRID_WIDTH,
  GRID_HEIGHT,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GRID_OFFSET_X,
  GRID_OFFSET_Y,
  colToX,
  rowToY,
  xToCol,
  yToRow,
  isInGrid,
  ROLE_COLORS,
  ROLE_LABELS,
  rowTint,
} from './slidePhaser3Coords';

import {
  CELL_SIZE,
  GRID_WIDTH,
  GRID_HEIGHT,
  GRID_OFFSET_X,
  GRID_OFFSET_Y,
  colToX,
  rowToY,
  xToCol,
  yToRow,
  isInGrid,
  ROLE_COLORS,
  ROLE_LABELS,
  rowTint,
} from './slidePhaser3Coords';
import { PhaserReadyGate } from '../../utils/phaserSceneReady';

// ─── Scene ──────────────────────────────────────────────────

export interface SlidePhaser3SceneEvents {
  shot_fired: { col: number; row: number; isDefender: boolean };
  cell_hover: { col: number; row: number };
  cell_click: { col: number; row: number };
  ready: void;
}

export class SlidePhaser3Scene extends Phaser.Scene {
  private gridGraphics!: Phaser.GameObjects.Graphics;
  private overlayGraphics!: Phaser.GameObjects.Graphics;
  private memberContainer!: Phaser.GameObjects.Container;
  private effectsContainer!: Phaser.GameObjects.Container;
  private carSprite?: Phaser.GameObjects.Container;
  private lastStateHash = '';
  private currentState: SlideGameState | null = null;
  readonly readyGate = new PhaserReadyGate();

  constructor() {
    super({ key: 'SlidePhaser3Scene' });
  }

  whenReady(cb: () => void): void {
    this.readyGate.whenReady(cb);
  }

  create(): void {
    // Background
    this.cameras.main.setBackgroundColor('#0a0a0a');

    this.gridGraphics = this.add.graphics();
    this.overlayGraphics = this.add.graphics();
    this.memberContainer = this.add.container(0, 0);
    this.effectsContainer = this.add.container(0, 0);

    this.drawGrid();
    this.setupInput();

    this.readyGate.markReady();
    this.events.emit('ready');
  }

  private drawGrid(): void {
    const g = this.gridGraphics;
    g.clear();

    for (let row = 0; row < BLOCK_ROWS; row++) {
      for (let col = 0; col < BLOCK_COLS; col++) {
        const x = GRID_OFFSET_X + col * CELL_SIZE;
        const y = GRID_OFFSET_Y + row * CELL_SIZE;
        const tint = rowTint(row);

        g.fillStyle(tint, 0.35);
        g.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);

        g.lineStyle(1, 0x374151, 0.7);
        g.strokeRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);
      }
    }
  }

  private setupInput(): void {
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const col = xToCol(pointer.x);
      const row = yToRow(pointer.y);
      if (isInGrid(col, row)) {
        this.events.emit('cell_hover', { col, row });
      }
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const col = xToCol(pointer.x);
      const row = yToRow(pointer.y);
      if (isInGrid(col, row)) {
        this.events.emit('cell_click', { col, row });
      }
    });
  }

  // ─── Public API ────────────────────────────────────────────

  updateState(state: SlideGameState): void {
    const hash = this.hashState(state);
    if (hash === this.lastStateHash) return;
    this.lastStateHash = hash;
    this.currentState = state;

    this.renderMembers(state);
    this.renderCar(state);
    this.renderShotOverlay(state);
  }

  private hashState(state: SlideGameState): string {
    // Cheap, deterministic snapshot of what affects visuals.
    const defenders = (state.defenders ?? [])
      .map((m) => `${m.id}:${m.row},${m.col}:${m.hp}:${m.isAlive ? 1 : 0}:${m.isRevealed ? 1 : 0}`)
      .join('|');
    const vehicleStops = (state.vehicle?.stopPositions ?? []).join(',');
    const vehicleHp = state.vehicle?.hp ?? 0;
    const phase = state.phase ?? '';
    return `${phase}#${defenders}#${vehicleStops}#${vehicleHp}`;
  }

  private renderMembers(state: SlideGameState): void {
    this.memberContainer.removeAll(true);

    const defenders: SlideMember[] = state.defenders ?? [];
    for (const m of defenders) {
      if (!m.isAlive) continue;
      const shouldShow = m.isRevealed || this.shouldShowFromDefenderPOV(state);
      if (!shouldShow) continue;

      const x = colToX(m.col);
      const y = rowToY(m.row);
      const color = ROLE_COLORS[m.role] ?? 0xffffff;

      const rect = this.add.rectangle(x, y, CELL_SIZE - 10, CELL_SIZE - 10, color, 0.85);
      rect.setStrokeStyle(2, 0x000000, 1);

      const label = this.add.text(x, y - 2, ROLE_LABELS[m.role] ?? '?', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#ffffff',
        fontStyle: 'bold',
      });
      label.setOrigin(0.5, 0.5);

      // HP bar
      const hpPct = Math.max(0, m.hp / Math.max(1, m.maxHp));
      const hpBg = this.add.rectangle(x, y + 16, CELL_SIZE - 14, 4, 0x1f2937, 1);
      const hpFill = this.add.rectangle(
        x - (CELL_SIZE - 14) / 2 + 1,
        y + 16,
        (CELL_SIZE - 14) * hpPct,
        3,
        hpPct > 0.5 ? 0x22c55e : hpPct > 0.25 ? 0xeab308 : 0xef4444,
        1
      );
      hpFill.setOrigin(0, 0.5);

      this.memberContainer.add([rect, label, hpBg, hpFill]);
    }
  }

  private shouldShowFromDefenderPOV(_state: SlideGameState): boolean {
    // Always show defenders — no fog-of-war in current engine version.
    return true;
  }

  private renderCar(state: SlideGameState): void {
    const stops = state.vehicle?.stopPositions ?? [];
    if (stops.length === 0) {
      if (this.carSprite) {
        this.carSprite.destroy();
        this.carSprite = undefined;
      }
      return;
    }

    // Show the most recent stop position
    const col = stops[stops.length - 1];
    const targetX = colToX(col);
    const targetY = rowToY(STREET_ROW);

    if (!this.carSprite) {
      const rect = this.add.rectangle(0, 0, CELL_SIZE - 8, CELL_SIZE - 16, 0x4b5563, 1);
      rect.setStrokeStyle(2, 0x111827, 1);
      const label = this.add.text(0, 0, 'CAR', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#ffffff',
        fontStyle: 'bold',
      });
      label.setOrigin(0.5, 0.5);
      this.carSprite = this.add.container(targetX, targetY, [rect, label]);
    } else {
      this.tweens.add({
        targets: this.carSprite,
        x: targetX,
        y: targetY,
        duration: 400,
        ease: 'Cubic.easeOut',
      });
    }
  }

  private renderShotOverlay(state: SlideGameState): void {
    this.overlayGraphics.clear();

    // Highlight spotter events from the kill feed
    const lastKill = state.killFeed[state.killFeed.length - 1];
    if (lastKill?.type === 'spotter') {
      const match = lastKill.message.match(/col\s*(\d+)/i);
      if (match) {
        const centerCol = parseInt(match[1], 10);
        const startCol = Math.max(0, centerCol - 1);
        const endCol = Math.min(BLOCK_COLS - 1, centerCol + 1);
        for (let c = startCol; c <= endCol; c++) {
          const x = GRID_OFFSET_X + c * CELL_SIZE;
          this.overlayGraphics.lineStyle(2, 0xfbbf24, 0.7);
          this.overlayGraphics.strokeRect(x + 1, GRID_OFFSET_Y + 1, CELL_SIZE - 2, GRID_HEIGHT - 2);
        }
      }
    }
  }

  // ─── Effects (called externally via events) ────────────────

  playShot(fromCol: number, fromRow: number, toCol: number, toRow: number, isDefender: boolean): void {
    const color = isDefender ? 0x22c55e : 0xef4444;
    const fx = this.add.graphics();
    fx.lineStyle(2, color, 1);
    fx.beginPath();
    fx.moveTo(colToX(fromCol), rowToY(fromRow));
    fx.lineTo(colToX(toCol), rowToY(toRow));
    fx.strokePath();
    this.effectsContainer.add(fx);

    this.tweens.add({
      targets: fx,
      alpha: 0,
      duration: 350,
      onComplete: () => fx.destroy(),
    });

    this.events.emit('shot_fired', { col: toCol, row: toRow, isDefender });
  }

  playHit(col: number, row: number): void {
    const x = colToX(col);
    const y = rowToY(row);
    const flash = this.add.circle(x, y, 6, 0xff0000, 1);
    this.effectsContainer.add(flash);

    this.tweens.add({
      targets: flash,
      radius: 24,
      alpha: 0,
      duration: 500,
      onComplete: () => flash.destroy(),
    });

    // Screen shake
    this.cameras.main.shake(120, 0.006);
  }

  playMiss(col: number, row: number): void {
    const x = colToX(col);
    const y = rowToY(row);
    const puff = this.add.circle(x, y, 4, 0x9ca3af, 0.8);
    this.effectsContainer.add(puff);

    this.tweens.add({
      targets: puff,
      radius: 14,
      alpha: 0,
      duration: 380,
      onComplete: () => puff.destroy(),
    });
  }

  getCurrentState(): SlideGameState | null {
    return this.currentState;
  }
}
