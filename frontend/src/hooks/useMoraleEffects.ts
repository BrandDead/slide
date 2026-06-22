// ============================================================
// useMoraleEffects — React hook
// Applies morale consequences when a member is deployed to a block.
// Called by BlockModeView / TopDownBlock before confirming placement.
// Sprint: morale-heat-photo-batch2
// ============================================================

import { useCallback } from 'react';
import { useBlockStore } from '../stores/blockStore';
import { useGangStore } from '../stores/gameStore';
import {
  getMoraleConsequences,
  rollMoraleConsequences,
  type MoraleConsequence,
} from '../utils/moraleSystem';

export interface MoraleCheckResult {
  /** Whether the member actually shows up */
  memberShowsUp: boolean;
  /** Whether the member fires on friendlies */
  friendlyFire: boolean;
  /** Whether the member deserts */
  deserts: boolean;
  /** Whether the member betrays (triggers a raid) */
  betrays: boolean;
  /** All triggered consequences */
  triggered: MoraleConsequence[];
  /** Human-readable warning messages */
  warnings: string[];
}

export function useMoraleEffects() {
  const { blocks } = useBlockStore();
  const { updateMember } = useGangStore();

  /**
   * Run morale check before placing a member on a block.
   * Returns what actually happens and any warnings to show the player.
   */
  const checkMoraleOnDeploy = useCallback(
    (blockId: string, memberId: string, memberName: string): MoraleCheckResult => {
      const block = blocks[blockId];
      const morale = block?.morale ?? 80;

      const possible = getMoraleConsequences(morale, memberId);
      const triggered = rollMoraleConsequences(possible);

      const result: MoraleCheckResult = {
        memberShowsUp: true,
        friendlyFire: false,
        deserts: false,
        betrays: false,
        triggered,
        warnings: [],
      };

      for (const c of triggered) {
        switch (c.type) {
          case 'no_show':
            result.memberShowsUp = false;
            result.warnings.push(`${memberName} didn't show up. Morale is too low.`);
            break;
          case 'friendly_fire':
            result.friendlyFire = true;
            result.warnings.push(`${memberName} opened fire on the crew! Morale critical.`);
            break;
          case 'desertion':
            result.deserts = true;
            result.warnings.push(`${memberName} walked off the block. He's done.`);
            updateMember(memberId, { status: 'active', loyalty: 0 });
            break;
          case 'betrayal':
            result.betrays = true;
            result.warnings.push(`${memberName} snitched. Expect a raid soon.`);
            break;
          case 'mutiny':
            result.memberShowsUp = false;
            result.warnings.push('The crew is in mutiny. Nobody is following orders.');
            break;
        }
      }

      return result;
    },
    [blocks, updateMember]
  );

  return { checkMoraleOnDeploy };
}
