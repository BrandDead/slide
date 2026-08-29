import {
  advanceCombat,
  createCombatSession,
  dispatchCombatCommand,
  getCombatSnapshot,
} from './combatSession';
import type {
  CombatAimRay,
  CombatCommand,
  CombatImpactCandidate,
  CombatSession,
  CombatSnapshot,
  Combatant,
  EncounterPreparation,
  GridPoint,
} from './types';

export type ActionCameraMode = 'tactical' | 'first-person' | 'third-person';

export type ControlAuthority =
  | { kind: 'player'; playerId: string }
  | { kind: 'squad-ai'; orderId?: string }
  | { kind: 'inactive'; reason: 'downed' | 'arrested' | 'unavailable' };

export type CombatCommandWithoutSequence<T extends CombatCommand = CombatCommand> =
  T extends CombatCommand ? Omit<T, 'sequence'> : never;

export interface CombatHudState {
  cameraMode: ActionCameraMode;
  paused: boolean;
  tick: number;
  selectedId: string | null;
  controlledActorId: string | null;
  controlMode: 'commander' | 'possessed';
  selectedName: string;
  health: number;
  maxHealth: number;
  ammo: number;
  maxAmmo: number;
  activeCrew: number;
  activeOpposition: number;
  objectiveProgress: number;
  objectiveTarget: number;
  latestMessage: string;
}

export interface CombatControllerState {
  snapshot: CombatSnapshot;
  hud: CombatHudState;
}

type ControllerListener = (state: CombatControllerState) => void;

function manhattan(a: GridPoint, b: GridPoint): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Presentation-neutral owner of one deterministic combat session.
 *
 * Renderers may select actors, switch cameras, and submit commands, but they
 * never mutate authoritative combat state directly. Camera state is deliberately
 * kept outside CombatSession so switching presentation cannot reset or alter the
 * outcome.
 */
export class CombatSessionController {
  private session: CombatSession;
  private selectedCrewId: string | null;
  private sequence = 0;
  private paused = false;
  private cameraMode: ActionCameraMode;
  private listeners = new Set<ControllerListener>();

  constructor(
    preparation: EncounterPreparation,
    initialCameraMode: ActionCameraMode = 'tactical',
  ) {
    this.session = createCombatSession(preparation);
    this.selectedCrewId = preparation.crew.find((actor) => !actor.isDown)?.id ?? null;
    this.cameraMode = initialCameraMode;
  }

  subscribe(listener: ControllerListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.listeners.clear();
  }

  getSnapshot(): CombatSnapshot {
    return getCombatSnapshot(this.session);
  }

  getState(): CombatControllerState {
    return {
      snapshot: this.getSnapshot(),
      hud: this.getHudState(),
    };
  }

  getCameraMode(): ActionCameraMode {
    return this.cameraMode;
  }

  getControlledCrewId(): string | null {
    if (this.cameraMode === 'tactical') return null;
    return this.getSelectedCrew()?.id ?? null;
  }

  getControlAuthority(actorId: string): ControlAuthority {
    const actor = this.session.combatants.find((candidate) => candidate.id === actorId);
    if (!actor || actor.isDown) return { kind: 'inactive', reason: actor?.isDown ? 'downed' : 'unavailable' };
    if (actor.team !== 'crew') return { kind: 'squad-ai' };
    return this.getControlledCrewId() === actor.id
      ? { kind: 'player', playerId: 'local-player' }
      : { kind: 'squad-ai' };
  }

  setCameraMode(mode: ActionCameraMode): void {
    if (mode === this.cameraMode) return;
    this.cameraMode = mode;
    this.emit();
  }

  cycleCameraMode(): ActionCameraMode {
    const modes: ActionCameraMode[] = ['tactical', 'first-person', 'third-person'];
    const currentIndex = modes.indexOf(this.cameraMode);
    const next = modes[(currentIndex + 1) % modes.length];
    this.setCameraMode(next);
    return next;
  }

  isPaused(): boolean {
    return this.paused;
  }

  setPaused(paused: boolean): void {
    if (paused === this.paused) return;
    this.paused = paused;
    this.emit();
  }

  selectCrew(actorId: string): boolean {
    const actor = this.session.combatants.find(
      (candidate) => candidate.id === actorId && candidate.team === 'crew' && !candidate.isDown,
    );
    if (!actor) return false;
    this.selectedCrewId = actor.id;
    this.emit();
    return true;
  }

  cycleSelectedCrew(direction = 1): Combatant | undefined {
    const livingCrew = this.session.combatants.filter((actor) => actor.team === 'crew' && !actor.isDown);
    if (livingCrew.length === 0) {
      this.selectedCrewId = null;
      this.emit();
      return undefined;
    }
    const currentIndex = livingCrew.findIndex((actor) => actor.id === this.selectedCrewId);
    const step = direction < 0 ? -1 : 1;
    const nextIndex = currentIndex < 0
      ? 0
      : (currentIndex + step + livingCrew.length) % livingCrew.length;
    this.selectedCrewId = livingCrew[nextIndex].id;
    this.emit();
    return livingCrew[nextIndex];
  }

  getSelectedCrew(): Combatant | undefined {
    const selected = this.session.combatants.find(
      (actor) => actor.id === this.selectedCrewId && actor.team === 'crew' && !actor.isDown,
    );
    if (selected) return selected;

    const fallback = this.session.combatants.find((actor) => actor.team === 'crew' && !actor.isDown);
    this.selectedCrewId = fallback?.id ?? null;
    return fallback;
  }

  advance(steps = 1): CombatSnapshot {
    if (this.paused || this.session.phase !== 'active' || steps <= 0) return this.getSnapshot();
    for (let index = 0; index < steps && this.session.phase === 'active'; index += 1) {
      this.session = advanceCombat(this.session, 1);
      if (this.session.tick % 20 === 0) this.runSquadAiTurn();
    }
    this.ensureSelectedCrew();
    this.emit();
    return this.getSnapshot();
  }

  dispatch(command: CombatCommandWithoutSequence): CombatSnapshot {
    if (this.paused || this.session.phase !== 'active') return this.getSnapshot();
    this.sequence += 1;
    this.session = dispatchCombatCommand(
      this.session,
      { ...command, sequence: this.sequence } as CombatCommand,
    );
    this.ensureSelectedCrew();
    this.emit();
    return this.getSnapshot();
  }

  moveSelected(dx: number, dy: number): CombatSnapshot {
    const actor = this.getSelectedCrew();
    if (!actor) return this.getSnapshot();
    return this.dispatch({
      type: 'move',
      actorId: actor.id,
      destination: { x: actor.position.x + dx, y: actor.position.y + dy },
    });
  }

  fireAt(targetId: string): CombatSnapshot {
    const actor = this.getSelectedCrew();
    if (!actor) return this.getSnapshot();
    return this.dispatch({ type: 'aim-fire', actorId: actor.id, targetId });
  }

  fireRay(ray: CombatAimRay, candidate: CombatImpactCandidate): CombatSnapshot {
    const actor = this.getSelectedCrew();
    if (!actor) return this.getSnapshot();
    return this.dispatch({ type: 'aim-fire-ray', actorId: actor.id, ray, candidate });
  }

  fireNearest(): CombatSnapshot {
    const actor = this.getSelectedCrew();
    if (!actor) return this.getSnapshot();
    const target = this.session.combatants
      .filter((candidate) => candidate.team === 'opposition' && !candidate.isDown)
      .sort((left, right) => manhattan(actor.position, left.position) - manhattan(actor.position, right.position))[0];
    return target ? this.fireAt(target.id) : this.getSnapshot();
  }

  reloadSelected(): CombatSnapshot {
    const actor = this.getSelectedCrew();
    if (!actor) return this.getSnapshot();
    return this.dispatch({ type: 'reload', actorId: actor.id });
  }

  interactSelected(): CombatSnapshot {
    const actor = this.getSelectedCrew();
    if (!actor) return this.getSnapshot();
    return this.dispatch({ type: 'interact', actorId: actor.id });
  }

  retreatSelected(): CombatSnapshot {
    const actor = this.getSelectedCrew();
    if (!actor) return this.getSnapshot();
    return this.dispatch({ type: 'retreat', actorId: actor.id });
  }

  getHudState(): CombatHudState {
    const selected = this.getSelectedCrew();
    const activeCrew = this.session.combatants.filter((actor) => actor.team === 'crew' && !actor.isDown).length;
    const activeOpposition = this.session.combatants.filter((actor) => actor.team === 'opposition' && !actor.isDown).length;
    return {
      cameraMode: this.cameraMode,
      paused: this.paused,
      tick: this.session.tick,
      selectedId: selected?.id ?? null,
      controlledActorId: this.cameraMode === 'tactical' ? null : selected?.id ?? null,
      controlMode: this.cameraMode === 'tactical' ? 'commander' : 'possessed',
      selectedName: selected?.name ?? 'No active crew',
      health: selected?.health ?? 0,
      maxHealth: selected?.maxHealth ?? 0,
      ammo: selected?.ammo ?? 0,
      maxAmmo: selected?.maxAmmo ?? 0,
      activeCrew,
      activeOpposition,
      objectiveProgress: this.session.objective.progress,
      objectiveTarget: this.session.objective.target,
      latestMessage: this.session.events.at(-1)?.message ?? 'Move through cover and secure the exit.',
    };
  }

  private runSquadAiTurn(): void {
    const controlledId = this.getControlledCrewId();
    const activeOpposition = this.session.combatants.filter(
      (actor) => actor.team === 'opposition' && !actor.isDown,
    );
    if (activeOpposition.length === 0) return;

    const aiCrewIds = this.session.combatants
      .filter((actor) => actor.team === 'crew' && !actor.isDown && actor.id !== controlledId)
      .map((actor) => actor.id);

    aiCrewIds.forEach((actorId) => {
      const actor = this.session.combatants.find((candidate) => candidate.id === actorId);
      if (!actor || actor.ammo <= 0 || actor.reloadUntilTick !== null || actor.nextFireTick > this.session.tick) return;
      const target = this.session.combatants
        .filter((candidate) => candidate.team === 'opposition' && !candidate.isDown)
        .sort((left, right) => manhattan(actor.position, left.position) - manhattan(actor.position, right.position))[0];
      if (!target) return;
      this.sequence += 1;
      this.session = dispatchCombatCommand(this.session, {
        type: 'aim-fire',
        actorId,
        targetId: target.id,
        sequence: this.sequence,
      });
    });
  }

  private ensureSelectedCrew(): void {
    this.getSelectedCrew();
  }

  private emit(): void {
    if (this.listeners.size === 0) return;
    const state = this.getState();
    this.listeners.forEach((listener) => listener(state));
  }
}
