import { HEAT_CONFIG } from '../../utils/heatSystem';
import type { CombatResult, RivalIncident, RivalResolution, ThreatRoute } from './blockLoopTypes';

export interface LoopThreat {
  route: ThreatRoute;
  reason: string;
}

/**
 * Name the threat a finished deal pulls onto the Strip.
 *
 * Priority: police heat first (a raid ignores who else is on the block), then
 * a visible Ghost Crew attack on this block, then generic street pressure.
 */
export function resolveThreatRoute(input: {
  playerHeat: number;
  dealerExposure: number;
  rivalIncident?: RivalIncident | null;
  blockLabel?: string;
}): LoopThreat & { rival: RivalIncident | null } {
  if (input.playerHeat >= HEAT_CONFIG.RAID_THRESHOLD_LOW) {
    return {
      route: 'raid',
      rival: null,
      reason: `Heat ${input.playerHeat} crossed the raid threshold (${HEAT_CONFIG.RAID_THRESHOLD_LOW}). The raid route opens from this block's crew and stash.`,
    };
  }
  if (input.rivalIncident) {
    const where = input.blockLabel ?? 'the block';
    return {
      route: 'slide',
      rival: input.rivalIncident,
      reason: `${input.rivalIncident.crewName} is sliding on ${where}. The deal put your dealer at ${input.dealerExposure} street exposure — hold the strip or get the crew out.`,
    };
  }
  return {
    route: 'slide',
    rival: null,
    reason: `Heat is under the raid line, but ${input.dealerExposure} street exposure draws a crew sliding through. Defend the block.`,
  };
}

/** Player-facing line for how a named rival attack ended. */
export function rivalResolutionFor(
  incident: RivalIncident,
  result: Pick<CombatResult, 'outcome' | 'crewDown'>,
  blockLabel: string,
): RivalResolution {
  const line = result.outcome === 'secured'
    ? `You held ${blockLabel} against ${incident.crewName}. They lost a shooter and will want it back.`
    : result.outcome === 'overrun'
      ? `${incident.crewName} overran ${blockLabel}${result.crewDown.length ? ` and left ${result.crewDown.length} of your crew hurt` : ''}. They got their payback — for now.`
      : `Your crew backed off ${blockLabel}. ${incident.crewName} is still circling.`;
  return {
    receiptKey: incident.receiptKey,
    crewId: incident.crewId,
    crewName: incident.crewName,
    outcome: result.outcome,
    line,
  };
}

export function createDeterministicLoopResult(input: {
  blockId: string;
  dealerId: string;
  route: ThreatRoute;
  outcome?: 'overrun' | 'secured' | 'retreated';
  /** Distinguishes a named rival attack so a later incident is not deduped. */
  incidentKey?: string | null;
  /** Shift 1 keeps the original key; later shifts get their own ticket. */
  shiftIndex?: number;
}) {
  const outcome = input.outcome ?? 'overrun';
  const routeTag = input.route === 'raid' ? 'raid' : 'slide';
  const incidentTag = input.incidentKey ? `:${input.incidentKey}` : '';
  const shiftTag = input.shiftIndex && input.shiftIndex > 1 ? `:shift-${input.shiftIndex}` : '';
  return {
    idempotencyKey: `loop:${input.blockId}:${routeTag}:${outcome}${incidentTag}${shiftTag}`,
    outcome,
    crewDown: outcome === 'overrun' ? [input.dealerId] : [],
    oppositionDown: outcome === 'secured' ? ['opposition-1'] : [],
    objectiveProgress: outcome === 'secured' ? 1 : 0,
    heatDelta: outcome === 'secured' ? 1 : outcome === 'overrun' ? 2 : 0,
    moraleDelta: outcome === 'secured' ? 4 : outcome === 'overrun' ? -12 : -4,
    pendingIncomeDelta: outcome === 'secured' ? 75 : outcome === 'overrun' ? -50 : -15,
    summary: outcome === 'overrun'
      ? 'Lil Dre took a wound holding the strip.'
      : outcome === 'secured'
        ? 'The crew held the block and got out clean.'
        : 'The crew disengaged before the slide closed.',
  };
}
