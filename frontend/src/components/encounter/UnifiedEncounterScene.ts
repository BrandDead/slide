import Phaser from 'phaser';
import { advanceCombat, createCombatSession, dispatchCombatCommand, getCombatSnapshot } from '../../game/combat/combatSession';
import type { CombatCommand, CombatSnapshot, Combatant, EncounterPreparation, GridPoint } from '../../game/combat/types';
import { getWorldActor } from '../../render/worldActorResolver';

const CANVAS_W = 960;
const CANVAS_H = 600;
const GRID_COLS = 8;
const GRID_ROWS = 8;
const PLAYFIELD_TOP = 86;
const PLAYFIELD_BOTTOM = 72;
const CELL_W = CANVAS_W / GRID_COLS;
const CELL_H = (CANVAS_H - PLAYFIELD_TOP - PLAYFIELD_BOTTOM) / GRID_ROWS;

interface ActorView {
  sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Arc;
  healthBack: Phaser.GameObjects.Rectangle;
  healthFill: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  selectedRing: Phaser.GameObjects.Arc;
}

interface TransientEffect {
  line: Phaser.GameObjects.Line | Phaser.GameObjects.Arc;
  expiresAt: number;
}

type CommandWithoutSequence<T extends CombatCommand = CombatCommand> =
  T extends CombatCommand ? Omit<T, 'sequence'> : never;

export class UnifiedEncounterScene extends Phaser.Scene {
  private preparation!: EncounterPreparation;
  private session = createCombatSession({
    sessionId: 'placeholder', seed: 1, sceneLabel: 'Loading', locationReference: 'Loading', fictionNotice: '',
    terrain: [], crew: [], opposition: [], heatAtStart: 0, moraleAtStart: 0,
    objective: { kind: 'extract', label: 'Loading', extraction: { x: 0, y: 0 }, requiredCrew: 1, progress: 0, target: 1 },
    tacticalBrief: [],
  });
  private actorViews = new Map<string, ActorView>();
  private effects: TransientEffect[] = [];
  private lastEventId: string | null = null;
  private selectedCrewId: string | null = null;
  private sequence = 0;
  private accumulator = 0;
  private reducedMotion = false;
  private objectiveText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private ammoText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private terrainLayer!: Phaser.GameObjects.Container;
  private actorLayer!: Phaser.GameObjects.Container;
  private uiLayer!: Phaser.GameObjects.Container;
  private backgroundKey = 'encounter-background';

  constructor() {
    super({ key: 'UnifiedEncounterScene' });
  }

  configure(preparation: EncounterPreparation, reducedMotion: boolean): void {
    this.preparation = preparation;
    this.reducedMotion = reducedMotion;
    this.session = createCombatSession(preparation);
    this.selectedCrewId = preparation.crew[0]?.id ?? null;
  }

  preload(): void {
    if (this.preparation.backgroundUrl) this.load.image(this.backgroundKey, this.preparation.backgroundUrl);
    const loaded = new Set<string>();
    for (const actor of [...this.preparation.crew, ...this.preparation.opposition]) {
      if (actor.team !== 'crew') continue;
      const resolved = getWorldActor(actor.role, 'idle', 'topdown');
      if (!resolved || loaded.has(resolved.url)) continue;
      const key = this.textureKey(actor);
      this.load.image(key, resolved.url);
      loaded.add(resolved.url);
    }
  }

  create(): void {
    this.terrainLayer = this.add.container(0, 0);
    this.actorLayer = this.add.container(0, 0);
    this.uiLayer = this.add.container(0, 0);
    this.drawBackground();
    this.drawTerrain();
    this.createHud();
    this.syncViews();
    this.bindInput();
    this.events.emit('ready');
    this.emitSnapshot();
  }

  update(_time: number, delta: number): void {
    if (this.session.phase === 'active') {
      this.accumulator += Math.min(delta, 180);
      while (this.accumulator >= 100) {
        this.accumulator -= 100;
        this.session = advanceCombat(this.session, 2);
        this.handleNewEvents();
      }
    }
    this.clearExpiredEffects();
    this.syncViews();
    this.updateHud();
  }

  dispatch(command: CommandWithoutSequence): void {
    this.sequence += 1;
    this.session = dispatchCombatCommand(this.session, { ...command, sequence: this.sequence } as CombatCommand);
    this.handleNewEvents();
    this.syncViews();
    this.emitSnapshot();
  }

  reloadSelected(): void {
    this.withSelected((actor) => this.dispatch({ type: 'reload', actorId: actor.id }));
  }

  interactSelected(): void {
    this.withSelected((actor) => this.dispatch({ type: 'interact', actorId: actor.id }));
  }

  retreatSelected(): void {
    this.withSelected((actor) => this.dispatch({ type: 'retreat', actorId: actor.id }));
  }

  fireNearestSelected(): void {
    this.fireNearest();
  }

  private drawBackground(): void {
    this.add.rectangle(CANVAS_W / 2, CANVAS_H / 2, CANVAS_W, CANVAS_H, 0x07111d, 1);
    if (this.textures.exists(this.backgroundKey)) {
      this.add.image(CANVAS_W / 2, CANVAS_H / 2, this.backgroundKey)
        .setDisplaySize(CANVAS_W, CANVAS_H)
        .setAlpha(0.52);
    } else {
      const background = this.add.graphics();
      background.fillGradientStyle(0x162436, 0x162436, 0x080d16, 0x080d16, 1);
      background.fillRect(0, 0, CANVAS_W, CANVAS_H);
      for (let index = 0; index < 20; index += 1) {
        const x = (index * 89) % CANVAS_W;
        const y = 120 + ((index * 53) % 390);
        background.fillStyle(index % 2 ? 0x173146 : 0x222b3a, 0.42);
        background.fillRect(x, y, 55 + (index % 4) * 24, 26 + (index % 3) * 18);
      }
    }
    this.add.rectangle(CANVAS_W / 2, 42, CANVAS_W, 84, 0x07111d, 0.94);
    this.add.rectangle(CANVAS_W / 2, CANVAS_H - 35, CANVAS_W, 70, 0x07111d, 0.94);
  }

  private drawTerrain(): void {
    const tint: Record<string, number> = {
      street: 0x273245, curb: 0x6b6f67, sidewalk: 0x2c4658, storefront: 0x31414c,
      alley: 0x192c2d, parking: 0x45413d, rooftop: 0x3e3154, building: 0x101722,
    };
    this.preparation.terrain.flat().forEach((cell) => {
      const { x, y } = this.pointToPixel(cell);
      const fill = tint[cell.zoneType] ?? 0x233142;
      const alpha = cell.passable ? 0.74 : 0.92;
      const rectangle = this.add.rectangle(x, y, CELL_W - 4, CELL_H - 4, fill, alpha)
        .setStrokeStyle(1, cell.cover >= 0.6 ? 0x83d5d0 : 0x314c5d, 0.7);
      this.terrainLayer.add(rectangle);
      if (cell.cover >= 0.6) {
        const coverMark = this.add.rectangle(x, y - CELL_H * 0.25, CELL_W * 0.52, 5, 0x83d5d0, 0.85);
        this.terrainLayer.add(coverMark);
      }
    });
    const exit = this.pointToPixel(this.session.objective.extraction);
    const extraction = this.add.rectangle(exit.x, exit.y, CELL_W - 13, CELL_H - 13, 0x4ade80, 0.22)
      .setStrokeStyle(2, 0x4ade80, 0.95);
    const exitLabel = this.add.text(exit.x, exit.y, 'EXIT', { fontSize: '12px', color: '#d1fae5', fontStyle: 'bold' }).setOrigin(0.5);
    this.terrainLayer.add([extraction, exitLabel]);
  }

  private createHud(): void {
    const title = this.add.text(22, 13, this.preparation.sceneLabel.toUpperCase(), {
      fontFamily: 'monospace', fontSize: '18px', fontStyle: 'bold', color: '#f5f7ff',
    });
    const location = this.add.text(22, 39, 'FICTIONALIZED LOCAL REFERENCE · TACTICAL SIMULATION', {
      fontFamily: 'monospace', fontSize: '10px', color: '#8ea8bd',
    });
    this.objectiveText = this.add.text(CANVAS_W / 2, 13, '', { fontFamily: 'monospace', fontSize: '13px', color: '#b9f6f1', align: 'center' }).setOrigin(0.5, 0);
    this.statusText = this.add.text(CANVAS_W / 2, 39, '', { fontFamily: 'monospace', fontSize: '10px', color: '#f1c77d', align: 'center' }).setOrigin(0.5, 0);
    this.ammoText = this.add.text(CANVAS_W - 20, 13, '', { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff', align: 'right' }).setOrigin(1, 0);
    this.timerText = this.add.text(CANVAS_W - 20, 38, '', { fontFamily: 'monospace', fontSize: '10px', color: '#9db0bf', align: 'right' }).setOrigin(1, 0);
    const controls = this.add.text(20, CANVAS_H - 54, 'TAP/CICK: move or target · WASD/ARROWS: move · SPACE: fire · R: reload · E: exit · Q: retreat', {
      fontFamily: 'monospace', fontSize: '10px', color: '#9db0bf', wordWrap: { width: CANVAS_W - 40 },
    });
    this.uiLayer.add([title, location, this.objectiveText, this.statusText, this.ammoText, this.timerText, controls]);
  }

  private bindInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.y < PLAYFIELD_TOP || pointer.y > CANVAS_H - PLAYFIELD_BOTTOM || this.session.phase !== 'active') return;
      const point = this.pixelToPoint(pointer.x, pointer.y);
      const hit = this.session.combatants.find((actor) => !actor.isDown && actor.position.x === point.x && actor.position.y === point.y);
      if (hit?.team === 'crew') {
        this.selectedCrewId = hit.id;
        this.syncViews();
        return;
      }
      const actor = this.selectedCrew();
      if (!actor) return;
      if (hit?.team === 'opposition') {
        this.dispatch({ type: 'aim-fire', actorId: actor.id, targetId: hit.id });
      } else {
        this.dispatch({ type: 'move', actorId: actor.id, destination: point });
      }
    });
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    keyboard.on('keydown-W', () => this.moveSelected(0, -1));
    keyboard.on('keydown-A', () => this.moveSelected(-1, 0));
    keyboard.on('keydown-S', () => this.moveSelected(0, 1));
    keyboard.on('keydown-D', () => this.moveSelected(1, 0));
    keyboard.on('keydown-UP', () => this.moveSelected(0, -1));
    keyboard.on('keydown-LEFT', () => this.moveSelected(-1, 0));
    keyboard.on('keydown-DOWN', () => this.moveSelected(0, 1));
    keyboard.on('keydown-RIGHT', () => this.moveSelected(1, 0));
    keyboard.on('keydown-R', () => this.withSelected((actor) => this.dispatch({ type: 'reload', actorId: actor.id })));
    keyboard.on('keydown-E', () => this.withSelected((actor) => this.dispatch({ type: 'interact', actorId: actor.id })));
    keyboard.on('keydown-Q', () => this.withSelected((actor) => this.dispatch({ type: 'retreat', actorId: actor.id })));
    keyboard.on('keydown-SPACE', () => this.fireNearest());
    this.input.gamepad?.on('down', (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
      if (button.index === 0) this.fireNearest();
      if (button.index === 1) this.withSelected((actor) => this.dispatch({ type: 'reload', actorId: actor.id }));
      if (button.index === 9) this.withSelected((actor) => this.dispatch({ type: 'retreat', actorId: actor.id }));
    });
  }

  private withSelected(fn: (actor: Combatant) => void): void {
    const actor = this.selectedCrew();
    if (actor) fn(actor);
  }

  private moveSelected(dx: number, dy: number): void {
    this.withSelected((actor) => this.dispatch({ type: 'move', actorId: actor.id, destination: { x: actor.position.x + dx, y: actor.position.y + dy } }));
  }

  private fireNearest(): void {
    const actor = this.selectedCrew();
    if (!actor) return;
    const target = this.session.combatants
      .filter((candidate) => candidate.team === 'opposition' && !candidate.isDown)
      .sort((left, right) => this.manhattan(actor.position, left.position) - this.manhattan(actor.position, right.position))[0];
    if (target) this.dispatch({ type: 'aim-fire', actorId: actor.id, targetId: target.id });
  }

  private selectedCrew(): Combatant | undefined {
    const selected = this.session.combatants.find((actor) => actor.id === this.selectedCrewId && actor.team === 'crew' && !actor.isDown);
    return selected ?? this.session.combatants.find((actor) => actor.team === 'crew' && !actor.isDown);
  }

  private syncViews(): void {
    const activeIds = new Set(this.session.combatants.map((actor) => actor.id));
    for (const [id, view] of this.actorViews) {
      if (!activeIds.has(id)) {
        view.sprite.destroy(); view.healthBack.destroy(); view.healthFill.destroy(); view.label.destroy(); view.selectedRing.destroy();
        this.actorViews.delete(id);
      }
    }
    this.session.combatants.forEach((actor) => {
      const point = this.pointToPixel(actor.position);
      const hpRatio = Math.max(0, actor.health / actor.maxHealth);
      let view = this.actorViews.get(actor.id);
      if (!view) {
        view = this.createActorView(actor, point);
        this.actorViews.set(actor.id, view);
      }
      view.sprite.setPosition(point.x, point.y - 8).setAlpha(actor.isDown ? 0.36 : 1);
      view.healthBack.setPosition(point.x, point.y - CELL_H * 0.34);
      view.healthFill.setPosition(point.x - 24 + 24 * hpRatio, point.y - CELL_H * 0.34).setSize(48 * hpRatio, 5);
      view.label.setPosition(point.x, point.y + CELL_H * 0.31).setText(actor.isDown ? `${actor.name} · DOWN` : actor.name);
      view.selectedRing.setPosition(point.x, point.y).setVisible(actor.id === this.selectedCrewId && !actor.isDown);
    });
  }

  private createActorView(actor: Combatant, point: { x: number; y: number }): ActorView {
    const actorTexture = this.textureKey(actor);
    const hasTexture = actor.team === 'crew' && this.textures.exists(actorTexture);
    const sprite = hasTexture
      ? this.add.image(point.x, point.y, actorTexture).setScale(0.32)
      : this.add.circle(point.x, point.y, 15, actor.team === 'crew' ? 0x54d6d0 : 0xef7777, 1);
    const healthBack = this.add.rectangle(point.x, point.y - 24, 50, 6, 0x111827, 0.9);
    const healthFill = this.add.rectangle(point.x, point.y - 24, 48, 5, actor.team === 'crew' ? 0x4ade80 : 0xfb7185, 1);
    const label = this.add.text(point.x, point.y + 25, actor.name, { fontFamily: 'monospace', fontSize: '9px', color: actor.team === 'crew' ? '#d9fffb' : '#ffd8d8', align: 'center' }).setOrigin(0.5);
    const selectedRing = this.add.circle(point.x, point.y, 22, 0x9cf5ed, 0).setStrokeStyle(2, 0x9cf5ed, 0.95).setVisible(false);
    this.actorLayer.add([sprite, healthBack, healthFill, label, selectedRing]);
    return { sprite, healthBack, healthFill, label, selectedRing };
  }

  private handleNewEvents(): void {
    const latestEvents = this.lastEventId
      ? this.session.events.slice(this.session.events.findIndex((item) => item.id === this.lastEventId) + 1)
      : this.session.events;
    if (latestEvents.length === 0) return;
    latestEvents.forEach((item) => this.renderEvent(item));
    this.lastEventId = latestEvents.at(-1)?.id ?? this.lastEventId;
    this.emitSnapshot();
  }

  private renderEvent(item: CombatSnapshot['events'][number]): void {
    if (item.type === 'weapon-fired' && item.actorId && item.targetId) {
      const source = this.session.combatants.find((actor) => actor.id === item.actorId);
      const target = this.session.combatants.find((actor) => actor.id === item.targetId);
      if (source && target) {
        const from = this.pointToPixel(source.position);
        const to = this.pointToPixel(target.position);
        const line = this.add.line(0, 0, from.x, from.y, to.x, to.y, 0xfacc15, 0.95).setLineWidth(2, 2);
        this.effects.push({ line, expiresAt: this.time.now + (this.reducedMotion ? 65 : 125) });
      }
    }
    if ((item.type === 'impact-actor' || item.type === 'actor-downed') && item.targetId) {
      const target = this.session.combatants.find((actor) => actor.id === item.targetId);
      if (target) {
        const point = this.pointToPixel(target.position);
        const impact = this.add.circle(point.x, point.y, item.type === 'actor-downed' ? 27 : 17, 0xf97316, 0.24).setStrokeStyle(2, 0xfef3c7, 0.8);
        this.effects.push({ line: impact, expiresAt: this.time.now + 190 });
        if (!this.reducedMotion) this.cameras.main.shake(70, 0.0025);
      }
    }
    if (item.type === 'resolved') this.events.emit('combatResult', this.session.result);
  }

  private clearExpiredEffects(): void {
    const now = this.time.now;
    this.effects = this.effects.filter((effect) => {
      if (effect.expiresAt > now) return true;
      effect.line.destroy();
      return false;
    });
  }

  private updateHud(): void {
    const selected = this.selectedCrew();
    const latest = this.session.events.at(-1);
    this.objectiveText.setText(`OBJECTIVE: ${this.session.objective.label.toUpperCase()}`);
    this.statusText.setText(latest?.message ?? 'Choose a crew member, then move or target.');
    this.ammoText.setText(selected ? `${selected.name.toUpperCase()} · ${selected.ammo}/${selected.maxAmmo} AMMO` : 'NO ACTIVE CREW');
    this.timerText.setText(`TICK ${this.session.tick} · HEAT ${this.session.heatAtStart}/5`);
  }

  private emitSnapshot(): void {
    this.events.emit('snapshot', getCombatSnapshot(this.session));
  }

  private pointToPixel(point: GridPoint): { x: number; y: number } {
    return { x: (point.x + 0.5) * CELL_W, y: PLAYFIELD_TOP + (point.y + 0.5) * CELL_H };
  }

  private pixelToPoint(x: number, y: number): GridPoint {
    return {
      x: Math.max(0, Math.min(GRID_COLS - 1, Math.floor(x / CELL_W))),
      y: Math.max(0, Math.min(GRID_ROWS - 1, Math.floor((y - PLAYFIELD_TOP) / CELL_H))),
    };
  }

  private manhattan(a: GridPoint, b: GridPoint): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  private textureKey(actor: Combatant): string {
    return `encounter-actor-${actor.role}`;
  }
}
