import { HEAT_CONFIG } from '../../utils/heatSystem';
import type { ThreatRoute } from './blockLoopTypes';

export function resolveThreatRoute(input: {
  playerHeat: number;
  dealerExposure: number;
}): { route: ThreatRoute; reason: string } {
  if (input.playerHeat >= HEAT_CONFIG.RAID_THRESHOLD_LOW) {
    return {
      route: 'raid',
      reason: `Heat ${input.playerHeat} crossed the raid threshold (${HEAT_CONFIG.RAID_THRESHOLD_LOW}). The raid route opens from this block's crew and stash.`,
    };
  }
  return {
    route: 'slide',
    reason: `Heat stays under raid threshold, but ${input.dealerExposure} street exposure pulls a SLIDE defense on this DNA board.`,
  };
}

export function createDeterministicLoopResult(input: {
  blockId: string;
  dealerId: string;
  route: ThreatRoute;
  outcome?: 'overrun' | 'secured' | 'retreated';
}) {
  const outcome = input.outcome ?? 'overrun';
  const routeTag = input.route === 'raid' ? 'raid' : 'slide';
  return {
    idempotencyKey: `loop:${input.blockId}:${routeTag}:${outcome}`,
    outcome,
    crewDown: outcome === 'overrun' ? [input.dealerId] : [],
    oppositionDown: outcome === 'secured' ? ['opposition-1'] : [],
    objectiveProgress: outcome === 'secured' ? 1 : 0,
    heatDelta: outcome === 'secured' ? 1 : outcome === 'overrun' ? 2 : 0,
    moraleDelta: outcome === 'secured' ? 4 : outcome === 'overrun' ? -12 : -4,
    pendingIncomeDelta: outcome === 'secured' ? 75 : outcome === 'overrun' ? -50 : -15,
    summary: outcome === 'overrun'
      ? 'Lil Dre took a wound holding the strip. The books record one seizure-risk hit.'
      : outcome === 'secured'
        ? 'The crew held the DNA board and extracted.'
        : 'The crew disengaged before the slide closed.',
  };
}
