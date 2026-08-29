import type {
  CombatCommand,
  CombatEvent,
  CombatResult,
  CombatSession,
  CombatSnapshot,
  Combatant,
  EncounterPreparation,
  GridPoint,
} from './types';

const RELOAD_TICKS = 20;
const FIRE_INTERVAL_TICKS = 5;
const MAX_EVENT_LOG = 30;

function nextRandom(session: CombatSession): [CombatSession, number] {
  const nextState = (Math.imul(session.rngState, 1664525) + 1013904223) >>> 0;
  return [{ ...session, rngState: nextState }, nextState / 0x1_0000_0000];
}

function event(session: CombatSession, type: CombatEvent['type'], message: string, actorId?: string, targetId?: string, amount?: number): CombatEvent {
  return {
    id: `${session.id}:${session.tick}:${session.events.length}:${type}`,
    tick: session.tick,
    type,
    actorId,
    targetId,
    amount,
    message,
  };
}

function appendEvents(session: CombatSession, events: CombatEvent[]): CombatSession {
  return { ...session, events: [...session.events, ...events].slice(-MAX_EVENT_LOG) };
}

function cellAt(session: CombatSession, point: GridPoint) {
  return session.terrain[point.y]?.[point.x];
}

function distance(a: GridPoint, b: GridPoint): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function isOccupied(session: CombatSession, point: GridPoint, ignoredId?: string): boolean {
  return session.combatants.some((actor) => !actor.isDown && actor.id !== ignoredId && actor.position.x === point.x && actor.position.y === point.y);
}

function updateCombatant(session: CombatSession, combatant: Combatant): CombatSession {
  return {
    ...session,
    combatants: session.combatants.map((current) => current.id === combatant.id ? combatant : current),
  };
}

function getActor(session: CombatSession, id: string): Combatant | undefined {
  return session.combatants.find((actor) => actor.id === id);
}

function lineOfSight(session: CombatSession, start: GridPoint, end: GridPoint): boolean {
  const steps = Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y));
  for (let index = 1; index < steps; index += 1) {
    const x = Math.round(start.x + ((end.x - start.x) * index) / steps);
    const y = Math.round(start.y + ((end.y - start.y) * index) / steps);
    if (!cellAt(session, { x, y })?.passable) return false;
  }
  return true;
}

function resolveResult(session: CombatSession, outcome: CombatResult['outcome']): CombatSession {
  if (session.result) return session;
  const crewDown = session.combatants.filter((actor) => actor.team === 'crew' && actor.isDown).map((actor) => actor.id);
  const oppositionDown = session.combatants.filter((actor) => actor.team === 'opposition' && actor.isDown).map((actor) => actor.id);
  const secured = outcome === 'secured';
  const result: CombatResult = {
    idempotencyKey: `${session.id}:${outcome}`,
    outcome,
    crewDown,
    oppositionDown,
    objectiveProgress: session.objective.progress,
    heatDelta: secured ? 1 : outcome === 'overrun' ? 2 : 0,
    moraleDelta: secured ? 4 : outcome === 'overrun' ? -12 : -4,
    pendingIncomeDelta: secured ? 75 : outcome === 'overrun' ? -50 : -15,
    summary: secured
      ? 'Secure exit reached. The crew held together under pressure.'
      : outcome === 'retreated'
        ? 'The crew disengaged and kept the situation from escalating.'
        : 'The crew was overrun and needs time to recover.',
  };
  const resolved = { ...session, phase: 'resolved' as const, result };
  return appendEvents(resolved, [event(resolved, 'resolved', result.summary)]);
}

function applyDamage(session: CombatSession, source: Combatant, target: Combatant, random: number): CombatSession {
  const targetCell = cellAt(session, target.position);
  const rangePenalty = Math.max(0, distance(source.position, target.position) - 1) * 0.045;
  const hitChance = Math.max(0.18, Math.min(0.9, 0.76 + source.level * 0.025 - (targetCell?.cover ?? 0) * 0.35 - rangePenalty));
  const fired = appendEvents(session, [event(session, 'weapon-fired', `${source.name} fires.`, source.id, target.id)]);
  if (random > hitChance) {
    return appendEvents(fired, [event(fired, 'impact-cover', 'Shot strikes cover.', source.id, target.id)]);
  }
  const damage = source.team === 'opposition'
    ? Math.max(4, 6 + source.level - target.armor * 2)
    : Math.max(6, 18 + source.level * 2 - target.armor * 3);
  const updatedTarget = { ...target, health: Math.max(0, target.health - damage) };
  let updated = updateCombatant(fired, updatedTarget);
  updated = appendEvents(updated, [event(updated, 'impact-actor', `${target.name} takes ${damage} damage.`, source.id, target.id, damage)]);
  if (updatedTarget.health <= 0) {
    updated = updateCombatant(updated, { ...updatedTarget, isDown: true });
    updated = appendEvents(updated, [event(updated, 'actor-downed', `${target.name} is down.`, source.id, target.id)]);
  }
  return updated;
}

function takeStepToward(session: CombatSession, actor: Combatant, target: Combatant): CombatSession {
  const choices: GridPoint[] = [
    { x: actor.position.x + Math.sign(target.position.x - actor.position.x), y: actor.position.y },
    { x: actor.position.x, y: actor.position.y + Math.sign(target.position.y - actor.position.y) },
  ].filter((point, index, array) => point.x !== actor.position.x || point.y !== actor.position.y)
    .filter((point, index, array) => array.findIndex((candidate) => candidate.x === point.x && candidate.y === point.y) === index);
  const candidate = choices.find((point) => cellAt(session, point)?.passable && !isOccupied(session, point, actor.id));
  if (!candidate) return session;
  const moved = updateCombatant(session, { ...actor, position: candidate });
  return appendEvents(moved, [event(moved, 'moved', `${actor.name} repositions.`, actor.id)]);
}

function runOppositionTurn(session: CombatSession): CombatSession {
  let next = session;
  const crew = next.combatants.filter((actor) => actor.team === 'crew' && !actor.isDown);
  for (const oppositionId of next.combatants.filter((actor) => actor.team === 'opposition' && !actor.isDown).map((actor) => actor.id)) {
    const actor = getActor(next, oppositionId);
    if (!actor || crew.length === 0) continue;
    const target = [...crew].sort((a, b) => distance(actor.position, a.position) - distance(actor.position, b.position))[0];
    if (!target) continue;
    if (actor.reloadUntilTick !== null || actor.nextFireTick > next.tick || actor.ammo <= 0) {
      if (actor.ammo <= 0 && actor.reloadUntilTick === null) {
        next = updateCombatant(next, { ...actor, reloadUntilTick: next.tick + RELOAD_TICKS });
        next = appendEvents(next, [event(next, 'reload-start', `${actor.name} reloads.`, actor.id)]);
      }
      continue;
    }
    if (distance(actor.position, target.position) > 4 || !lineOfSight(next, actor.position, target.position)) {
      next = takeStepToward(next, actor, target);
      continue;
    }
    const [randomized, random] = nextRandom(next);
    next = applyDamage(randomized, actor, target, random);
    const current = getActor(next, actor.id);
    if (current) next = updateCombatant(next, { ...current, ammo: current.ammo - 1, nextFireTick: next.tick + FIRE_INTERVAL_TICKS });
  }
  return next;
}

export function createCombatSession(preparation: EncounterPreparation): CombatSession {
  return {
    id: preparation.sessionId,
    seed: preparation.seed,
    rngState: preparation.seed || 1,
    tick: 0,
    phase: 'active',
    terrain: preparation.terrain,
    combatants: [...preparation.crew, ...preparation.opposition],
    objective: preparation.objective,
    heatAtStart: preparation.heatAtStart,
    moraleAtStart: preparation.moraleAtStart,
    events: [],
    result: null,
  };
}

export function advanceCombat(session: CombatSession, steps = 1): CombatSession {
  let next = session;
  for (let index = 0; index < steps && next.phase === 'active'; index += 1) {
    next = { ...next, tick: next.tick + 1 };
    const reloaded: Combatant[] = next.combatants.map((actor) => {
      if (actor.reloadUntilTick !== null && actor.reloadUntilTick <= next.tick) {
        return { ...actor, ammo: actor.maxAmmo, reloadUntilTick: null };
      }
      return actor;
    });
    const completedReloads = next.combatants.filter((actor) => actor.reloadUntilTick !== null && actor.reloadUntilTick <= next.tick);
    next = { ...next, combatants: reloaded };
    if (completedReloads.length > 0) {
      next = appendEvents(next, completedReloads.map((actor) => event(next, 'reload-complete', `${actor.name} is ready.`, actor.id)));
    }
    if (next.tick % 20 === 0) next = runOppositionTurn(next);
    const livingCrew = next.combatants.filter((actor) => actor.team === 'crew' && !actor.isDown);
    if (livingCrew.length === 0) next = resolveResult(next, 'overrun');
  }
  return next;
}

export function dispatchCombatCommand(session: CombatSession, command: CombatCommand): CombatSession {
  if (session.phase !== 'active') return session;
  const actor = getActor(session, command.actorId);
  if (!actor || actor.isDown || actor.team !== 'crew' || command.sequence <= actor.lastSequence) {
    return appendEvents(session, [event(session, 'blocked', 'Command was not accepted.', command.actorId)]);
  }
  let next = updateCombatant(session, { ...actor, lastSequence: command.sequence });
  if (command.type === 'move') {
    const targetCell = cellAt(next, command.destination);
    if (!targetCell?.passable || distance(actor.position, command.destination) !== 1 || isOccupied(next, command.destination, actor.id)) {
      return appendEvents(next, [event(next, 'blocked', 'Route blocked. Choose an adjacent open tile.', actor.id)]);
    }
    next = updateCombatant(next, { ...getActor(next, actor.id)!, position: command.destination });
    return appendEvents(next, [event(next, 'moved', `${actor.name} moves into ${targetCell.zoneType} cover.`, actor.id)]);
  }
  if (command.type === 'reload') {
    const current = getActor(next, actor.id)!;
    if (current.reloadUntilTick !== null || current.ammo === current.maxAmmo) return next;
    next = updateCombatant(next, { ...current, reloadUntilTick: next.tick + RELOAD_TICKS });
    return appendEvents(next, [event(next, 'reload-start', `${actor.name} starts reloading.`, actor.id)]);
  }
  if (command.type === 'aim-fire') {
    const source = getActor(next, actor.id)!;
    const target = getActor(next, command.targetId);
    if (!target || target.isDown || target.team !== 'opposition' || source.ammo <= 0 || source.reloadUntilTick !== null || source.nextFireTick > next.tick || distance(source.position, target.position) > 6 || !lineOfSight(next, source.position, target.position)) {
      return appendEvents(next, [event(next, 'blocked', 'No clean line of sight. Reposition or reload.', actor.id)]);
    }
    const [randomized, random] = nextRandom(next);
    next = applyDamage(randomized, source, target, random);
    const current = getActor(next, source.id);
    if (current) next = updateCombatant(next, { ...current, ammo: current.ammo - 1, nextFireTick: next.tick + FIRE_INTERVAL_TICKS });
    return next;
  }
  if (command.type === 'interact') {
    const current = getActor(next, actor.id)!;
    if (current.position.x !== next.objective.extraction.x || current.position.y !== next.objective.extraction.y) {
      return appendEvents(next, [event(next, 'blocked', 'Move to the secure exit to extract.', actor.id)]);
    }
    const objective = { ...next.objective, progress: Math.min(next.objective.target, next.objective.progress + 1) };
    next = { ...next, objective };
    next = appendEvents(next, [event(next, 'objective-progress', 'Secure exit reached.', actor.id, undefined, objective.progress)]);
    if (objective.progress >= objective.target) next = resolveResult(next, 'secured');
    return next;
  }
  return resolveResult(next, 'retreated');
}

export function getCombatSnapshot(session: CombatSession): CombatSnapshot {
  return {
    tick: session.tick,
    phase: session.phase,
    combatants: session.combatants,
    objective: session.objective,
    events: session.events,
    result: session.result,
  };
}
