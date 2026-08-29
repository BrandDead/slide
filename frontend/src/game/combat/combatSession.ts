import type {
  CombatAimRay,
  CombatCommand,
  CombatEvent,
  CombatHitZone,
  CombatImpactCandidate,
  CombatResult,
  CombatSession,
  CombatSnapshot,
  Combatant,
  EncounterPreparation,
  EncounterVector3,
  GridPoint,
} from './types';

const RELOAD_TICKS = 20;
const FIRE_INTERVAL_TICKS = 5;
const MAX_EVENT_LOG = 30;
const MAX_RAY_DISTANCE = 40;
const MAX_CLIENT_TICK_DRIFT = 40;
const RAY_DIRECTION_TOLERANCE = 0.05;
const RAY_POINT_TOLERANCE_METERS = 1.5;

const HIT_ZONE_MULTIPLIER: Record<CombatHitZone, number> = {
  head: 1.55,
  torso: 1,
  arm: 0.78,
  leg: 0.72,
};

function nextRandom(session: CombatSession): [CombatSession, number] {
  const nextState = (Math.imul(session.rngState, 1664525) + 1013904223) >>> 0;
  return [{ ...session, rngState: nextState }, nextState / 0x1_0000_0000];
}

function event(
  session: CombatSession,
  type: CombatEvent['type'],
  message: string,
  actorId?: string,
  targetId?: string,
  amount?: number,
  impact?: CombatImpactCandidate,
  hitZone?: CombatHitZone,
): CombatEvent {
  return {
    id: `${session.id}:${session.tick}:${session.events.length}:${type}`,
    tick: session.tick,
    type,
    actorId,
    targetId,
    amount,
    impact,
    hitZone,
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

function vectorLength(vector: EncounterVector3): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function subtractVector(left: EncounterVector3, right: EncounterVector3): EncounterVector3 {
  return { x: left.x - right.x, y: left.y - right.y, z: left.z - right.z };
}

function dotVector(left: EncounterVector3, right: EncounterVector3): number {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function isFiniteVector(vector: EncounterVector3): boolean {
  return Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z);
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

function rayGeometryIsValid(ray: CombatAimRay, candidate: CombatImpactCandidate): boolean {
  if (!isFiniteVector(ray.origin) || !isFiniteVector(ray.direction) || !isFiniteVector(candidate.point)) return false;
  if (!Number.isFinite(ray.maxDistance) || ray.maxDistance <= 0 || ray.maxDistance > MAX_RAY_DISTANCE) return false;
  if (!Number.isFinite(candidate.distance) || candidate.distance < 0 || candidate.distance > ray.maxDistance) return false;

  const directionLength = vectorLength(ray.direction);
  if (Math.abs(directionLength - 1) > RAY_DIRECTION_TOLERANCE) return false;

  const originToPoint = subtractVector(candidate.point, ray.origin);
  const measuredDistance = vectorLength(originToPoint);
  if (Math.abs(measuredDistance - candidate.distance) > RAY_POINT_TOLERANCE_METERS) return false;

  const forwardDistance = dotVector(originToPoint, ray.direction);
  if (forwardDistance < -RAY_POINT_TOLERANCE_METERS || forwardDistance > ray.maxDistance + RAY_POINT_TOLERANCE_METERS) return false;

  const lateralSquared = Math.max(0, measuredDistance * measuredDistance - forwardDistance * forwardDistance);
  return Math.sqrt(lateralSquared) <= RAY_POINT_TOLERANCE_METERS;
}

function validateAimFireRay(
  session: CombatSession,
  source: Combatant,
  ray: CombatAimRay,
  candidate: CombatImpactCandidate,
): { valid: true; target?: Combatant } | { valid: false; message: string } {
  if (!Number.isInteger(ray.clientTick) || Math.abs(session.tick - ray.clientTick) > MAX_CLIENT_TICK_DRIFT) {
    return { valid: false, message: 'Shot timing was not accepted.' };
  }
  if (!rayGeometryIsValid(ray, candidate)) {
    return { valid: false, message: 'Shot trajectory was not accepted.' };
  }
  if (candidate.kind !== 'actor') return { valid: true };
  if (!candidate.entityId || !candidate.hitZone) {
    return { valid: false, message: 'Actor impact is missing target metadata.' };
  }
  const target = getActor(session, candidate.entityId);
  if (!target || target.isDown || target.team !== 'opposition') {
    return { valid: false, message: 'Shot target was not accepted.' };
  }
  if (distance(source.position, target.position) > 6 || !lineOfSight(session, source.position, target.position)) {
    return { valid: false, message: 'No clean line of sight. Reposition or reload.' };
  }
  return { valid: true, target };
}

function applyConfirmedActorImpact(
  session: CombatSession,
  source: Combatant,
  target: Combatant,
  candidate: CombatImpactCandidate,
  random: number,
): CombatSession {
  const hitZone = candidate.hitZone ?? 'torso';
  const variance = 0.92 + random * 0.16;
  const unarmoredDamage = (18 + source.level * 2) * HIT_ZONE_MULTIPLIER[hitZone] * variance;
  const armorReduction = target.armor * (hitZone === 'head' ? 1.5 : 3);
  const damage = Math.max(5, Math.round(unarmoredDamage - armorReduction));
  const updatedTarget = { ...target, health: Math.max(0, target.health - damage) };
  let updated = updateCombatant(session, updatedTarget);
  updated = appendEvents(updated, [event(
    updated,
    'impact-actor',
    `${target.name} takes ${damage} ${hitZone} damage.`,
    source.id,
    target.id,
    damage,
    candidate,
    hitZone,
  )]);
  if (updatedTarget.health <= 0) {
    updated = updateCombatant(updated, { ...updatedTarget, isDown: true });
    updated = appendEvents(updated, [event(
      updated,
      'actor-downed',
      `${target.name} is down.`,
      source.id,
      target.id,
      undefined,
      candidate,
      hitZone,
    )]);
  }
  return updated;
}

function applyNonActorImpact(
  session: CombatSession,
  source: Combatant,
  candidate: CombatImpactCandidate,
): CombatSession {
  let impact: { type: CombatEvent['type']; message: string };
  switch (candidate.kind) {
    case 'cover':
      impact = { type: 'impact-cover', message: 'Shot strikes physical cover.' };
      break;
    case 'vehicle':
      impact = { type: 'impact-vehicle', message: 'Shot strikes a vehicle.' };
      break;
    case 'environment':
      impact = { type: 'impact-environment', message: 'Shot strikes the environment.' };
      break;
    case 'miss':
      impact = { type: 'impact-miss', message: 'Shot misses.' };
      break;
    case 'actor':
      return session;
  }
  return appendEvents(session, [event(
    session,
    impact.type,
    impact.message,
    source.id,
    candidate.entityId,
    undefined,
    candidate,
  )]);
}

function resolveAimFireRay(
  session: CombatSession,
  source: Combatant,
  ray: CombatAimRay,
  candidate: CombatImpactCandidate,
): CombatSession {
  const validation = validateAimFireRay(session, source, ray, candidate);
  if (!validation.valid) {
    return appendEvents(session, [event(session, 'blocked', validation.message, source.id, candidate.entityId)]);
  }

  let next = appendEvents(session, [event(
    session,
    'weapon-fired',
    `${source.name} fires.`,
    source.id,
    validation.target?.id ?? candidate.entityId,
    undefined,
    candidate,
    candidate.hitZone,
  )]);

  if (validation.target) {
    const [randomized, random] = nextRandom(next);
    next = applyConfirmedActorImpact(randomized, source, validation.target, candidate, random);
  } else {
    next = applyNonActorImpact(next, source, candidate);
  }

  const current = getActor(next, source.id);
  if (current) {
    next = updateCombatant(next, {
      ...current,
      ammo: current.ammo - 1,
      nextFireTick: next.tick + FIRE_INTERVAL_TICKS,
    });
  }
  return next;
}

function takeStepToward(session: CombatSession, actor: Combatant, target: Combatant): CombatSession {
  const choices: GridPoint[] = [
    { x: actor.position.x + Math.sign(target.position.x - actor.position.x), y: actor.position.y },
    { x: actor.position.x, y: actor.position.y + Math.sign(target.position.y - actor.position.y) },
  ].filter((point) => point.x !== actor.position.x || point.y !== actor.position.y)
    .filter((point, index, array) => array.findIndex((candidate) => candidate.x === point.x && candidate.y === point.y) === index);
  const candidate = choices.find((point) => cellAt(session, point)?.passable && !isOccupied(session, point, actor.id));
  if (!candidate) return session;
  const moved = updateCombatant(session, { ...actor, position: candidate });
  return appendEvents(moved, [event(moved, 'moved', `${actor.name} repositions.`, actor.id)]);
}

function runOppositionTurn(session: CombatSession): CombatSession {
  let next = session;
  for (const oppositionId of next.combatants.filter((actor) => actor.team === 'opposition' && !actor.isDown).map((actor) => actor.id)) {
    const actor = getActor(next, oppositionId);
    const crew = next.combatants.filter((candidate) => candidate.team === 'crew' && !candidate.isDown);
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
  if (command.type === 'aim-fire' || command.type === 'aim-fire-ray') {
    const source = getActor(next, actor.id)!;
    if (source.ammo <= 0 || source.reloadUntilTick !== null || source.nextFireTick > next.tick) {
      return appendEvents(next, [event(next, 'blocked', 'Weapon is not ready. Reposition or reload.', actor.id)]);
    }
    if (command.type === 'aim-fire-ray') {
      return resolveAimFireRay(next, source, command.ray, command.candidate);
    }
    const target = getActor(next, command.targetId);
    if (!target || target.isDown || target.team !== 'opposition' || distance(source.position, target.position) > 6 || !lineOfSight(next, source.position, target.position)) {
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
