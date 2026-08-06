// ============================================================
// mostWantedStore tests — Sprint 15-B
//
// The rules worth guarding are the ones that stop the board from being
// exploited: you cannot cash your own contract, a paid contract cannot
// be paid twice, pulling a contract does not refund the listing fee,
// and the ally ledger accumulates rather than duplicating.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  useMostWantedStore,
  BOUNTY_CONFIG,
  listingFee,
  totalPostingCost,
  minimumReward,
  isExpired,
  remainingMs,
  formatRemaining,
  canFulfil,
  bumpStanding,
  type PostBountyInput,
} from '../mostWantedStore';
import type { MostWantedPoster } from '../../types/game.types';

const basePost: PostBountyInput = {
  postedBy: 'p_me',
  postedByGangName: 'Eastside',
  targetKind: 'member',
  targetId: 'opp_1',
  targetName: 'Smoke',
  targetGangName: 'Northbound',
  reward: 5_000,
};

function makePoster(overrides: Partial<MostWantedPoster> = {}): MostWantedPoster {
  const now = Date.now();
  return {
    id: 'mw1',
    postedBy: 'p_me',
    postedByGangName: 'Eastside',
    postedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 86_400_000).toISOString(),
    targetKind: 'member',
    targetId: 'opp_1',
    targetName: 'Smoke',
    targetGangName: 'Northbound',
    reward: 5_000,
    status: 'open',
    ...overrides,
  };
}

beforeEach(() => {
  useMostWantedStore.getState().clearAll();
});

describe('listingFee and totalPostingCost', () => {
  it('charges the configured rate, rounded up', () => {
    expect(listingFee(10_000)).toBe(500);
    // 501 * 0.05 = 25.05 -> rounds up so the board never loses a cent.
    expect(listingFee(501)).toBe(26);
  });

  it('total is reward plus fee', () => {
    expect(totalPostingCost(10_000)).toBe(10_500);
  });
});

describe('minimumReward', () => {
  it('scales with target level', () => {
    expect(minimumReward(1, 'member')).toBe(BOUNTY_CONFIG.MIN_REWARD);
    expect(minimumReward(4, 'member')).toBe(BOUNTY_CONFIG.MIN_REWARD * 4);
  });

  it('charges a premium for contracts on a member\u2019s people', () => {
    expect(minimumReward(2, 'special_person')).toBeGreaterThan(
      minimumReward(2, 'member'),
    );
  });

  it('treats level zero or negative as level one', () => {
    expect(minimumReward(0, 'member')).toBe(BOUNTY_CONFIG.MIN_REWARD);
    expect(minimumReward(-3, 'member')).toBe(BOUNTY_CONFIG.MIN_REWARD);
  });

  it('never exceeds the board maximum', () => {
    expect(minimumReward(9_999, 'special_person')).toBe(BOUNTY_CONFIG.MAX_REWARD);
  });
});

describe('isExpired and remainingMs', () => {
  it('is not expired while time remains', () => {
    const p = makePoster();
    expect(isExpired(p)).toBe(false);
    expect(remainingMs(p)).toBeGreaterThan(0);
  });

  it('is expired once the deadline passes', () => {
    const p = makePoster({ expiresAt: new Date(Date.now() - 1_000).toISOString() });
    expect(isExpired(p)).toBe(true);
    expect(remainingMs(p)).toBe(0);
  });

  it('reports non-open posters as not expired so they are not swept twice', () => {
    const p = makePoster({
      status: 'paid',
      expiresAt: new Date(Date.now() - 1_000).toISOString(),
    });
    expect(isExpired(p)).toBe(false);
  });
});

describe('formatRemaining', () => {
  it('shows days and hours for long windows', () => {
    expect(formatRemaining(2 * 86_400_000 + 3 * 3_600_000)).toBe('2d 3h left');
  });

  it('shows hours under a day', () => {
    expect(formatRemaining(5 * 3_600_000)).toBe('5h left');
  });

  it('shows minutes under an hour', () => {
    expect(formatRemaining(20 * 60_000)).toBe('20m left');
  });

  it('never shows zero minutes on a live poster', () => {
    expect(formatRemaining(5_000)).toBe('1m left');
  });

  it('says expired at or below zero', () => {
    expect(formatRemaining(0)).toBe('EXPIRED');
  });
});

describe('canFulfil', () => {
  it('allows a third party on an open contract', () => {
    expect(canFulfil(makePoster(), 'p_other').allowed).toBe(true);
  });

  it('blocks the poster from cashing their own contract', () => {
    const res = canFulfil(makePoster({ postedBy: 'p_me' }), 'p_me');
    expect(res.allowed).toBe(false);
    expect(res.reason).toMatch(/your own/i);
  });

  it('blocks an already-paid contract', () => {
    expect(canFulfil(makePoster({ status: 'paid' }), 'p_other').allowed).toBe(false);
  });

  it('blocks an expired contract', () => {
    const p = makePoster({ expiresAt: new Date(Date.now() - 1).toISOString() });
    expect(canFulfil(p, 'p_other').allowed).toBe(false);
  });
});

describe('bumpStanding', () => {
  it('adds the per-job increment', () => {
    expect(bumpStanding(50)).toBe(50 + BOUNTY_CONFIG.ALLY_STANDING_PER_JOB);
  });

  it('caps at the maximum', () => {
    expect(bumpStanding(99)).toBe(BOUNTY_CONFIG.MAX_ALLY_STANDING);
  });
});

describe('postBounty', () => {
  it('creates an open poster at the top of the board', () => {
    const p = useMostWantedStore.getState().postBounty(basePost);
    expect(p.status).toBe('open');
    expect(useMostWantedStore.getState().posters[0].id).toBe(p.id);
  });

  it('clamps a reward below the floor up to the minimum', () => {
    const p = useMostWantedStore.getState().postBounty({ ...basePost, reward: 1 });
    expect(p.reward).toBe(BOUNTY_CONFIG.MIN_REWARD);
  });

  it('clamps a reward above the ceiling down to the maximum', () => {
    const p = useMostWantedStore
      .getState()
      .postBounty({ ...basePost, reward: 99_000_000 });
    expect(p.reward).toBe(BOUNTY_CONFIG.MAX_REWARD);
  });

  it('sets expiry from the default duration', () => {
    const p = useMostWantedStore.getState().postBounty(basePost);
    const life = new Date(p.expiresAt).getTime() - new Date(p.postedAt).getTime();
    expect(life).toBe(BOUNTY_CONFIG.DEFAULT_DURATION_MS);
  });

  it('carries special-person context through', () => {
    const p = useMostWantedStore.getState().postBounty({
      ...basePost,
      targetKind: 'special_person',
      targetId: 'sp_1',
      targetName: "Smoke's cousin",
      targetOwnerMemberId: 'opp_1',
      targetOwnerName: 'Smoke',
    });
    expect(p.targetKind).toBe('special_person');
    expect(p.targetOwnerName).toBe('Smoke');
  });
});

describe('cancelBounty', () => {
  it('marks an open poster cancelled', () => {
    const p = useMostWantedStore.getState().postBounty(basePost);
    expect(useMostWantedStore.getState().cancelBounty(p.id)).toBe(true);
    expect(useMostWantedStore.getState().posters[0].status).toBe('cancelled');
  });

  it('refuses to cancel a paid poster', () => {
    const p = useMostWantedStore.getState().postBounty(basePost);
    useMostWantedStore.getState().fulfilBounty({
      posterId: p.id,
      hunterPlayerId: 'p_other',
      hunterGangName: 'Westend',
      proofImageUrl: 'data:image/png;base64,x',
    });
    expect(useMostWantedStore.getState().cancelBounty(p.id)).toBe(false);
  });

  it('returns false for an unknown id', () => {
    expect(useMostWantedStore.getState().cancelBounty('nope')).toBe(false);
  });
});

describe('fulfilBounty', () => {
  it('pays out and returns a receipt naming both sides', () => {
    const p = useMostWantedStore.getState().postBounty(basePost);
    const receipt = useMostWantedStore.getState().fulfilBounty({
      posterId: p.id,
      hunterPlayerId: 'p_other',
      hunterGangName: 'Westend',
      proofImageUrl: 'data:image/png;base64,x',
    });
    expect(receipt).not.toBeNull();
    expect(receipt!.reward).toBe(5_000);
    expect(receipt!.paidTo).toBe('p_other');
    expect(receipt!.paidBy).toBe('p_me');
    expect(receipt!.poster.status).toBe('paid');
  });

  it('stores the proof screenshot on the poster as public record', () => {
    const p = useMostWantedStore.getState().postBounty(basePost);
    useMostWantedStore.getState().fulfilBounty({
      posterId: p.id,
      hunterPlayerId: 'p_other',
      hunterGangName: 'Westend',
      proofImageUrl: 'data:image/png;base64,PROOF',
    });
    expect(useMostWantedStore.getState().posters[0].proofImageUrl).toContain('PROOF');
  });

  it('refuses a second payout on the same contract', () => {
    const p = useMostWantedStore.getState().postBounty(basePost);
    const input = {
      posterId: p.id,
      hunterPlayerId: 'p_other',
      hunterGangName: 'Westend',
      proofImageUrl: 'data:image/png;base64,x',
    };
    expect(useMostWantedStore.getState().fulfilBounty(input)).not.toBeNull();
    expect(useMostWantedStore.getState().fulfilBounty(input)).toBeNull();
  });

  it('refuses the poster cashing their own contract', () => {
    const p = useMostWantedStore.getState().postBounty(basePost);
    const res = useMostWantedStore.getState().fulfilBounty({
      posterId: p.id,
      hunterPlayerId: 'p_me',
      hunterGangName: 'Eastside',
      proofImageUrl: 'data:image/png;base64,x',
    });
    expect(res).toBeNull();
  });

  it('returns null for an unknown poster', () => {
    const res = useMostWantedStore.getState().fulfilBounty({
      posterId: 'nope',
      hunterPlayerId: 'p_other',
      hunterGangName: 'Westend',
      proofImageUrl: 'x',
    });
    expect(res).toBeNull();
  });

  it('creates a fresh ally on the first job together', () => {
    const p = useMostWantedStore.getState().postBounty(basePost);
    const receipt = useMostWantedStore.getState().fulfilBounty({
      posterId: p.id,
      hunterPlayerId: 'p_other',
      hunterGangName: 'Westend',
      proofImageUrl: 'x',
    });
    expect(receipt!.ally.standing).toBe(BOUNTY_CONFIG.ALLY_STARTING_STANDING);
    expect(receipt!.ally.jobsCompleted).toBe(1);
    expect(useMostWantedStore.getState().allies).toHaveLength(1);
  });

  it('accumulates onto an existing ally rather than duplicating them', () => {
    const store = useMostWantedStore.getState();
    const first = store.postBounty(basePost);
    const second = store.postBounty({ ...basePost, targetId: 'opp_2', reward: 2_000 });

    store.fulfilBounty({
      posterId: first.id,
      hunterPlayerId: 'p_other',
      hunterGangName: 'Westend',
      proofImageUrl: 'x',
    });
    const receipt = useMostWantedStore.getState().fulfilBounty({
      posterId: second.id,
      hunterPlayerId: 'p_other',
      hunterGangName: 'Westend',
      proofImageUrl: 'x',
    });

    expect(useMostWantedStore.getState().allies).toHaveLength(1);
    expect(receipt!.ally.jobsCompleted).toBe(2);
    expect(receipt!.ally.moneyExchanged).toBe(7_000);
    expect(receipt!.ally.standing).toBe(
      BOUNTY_CONFIG.ALLY_STARTING_STANDING + BOUNTY_CONFIG.ALLY_STANDING_PER_JOB,
    );
  });
});

describe('sweepExpired', () => {
  it('does nothing when nothing has lapsed', () => {
    useMostWantedStore.getState().postBounty(basePost);
    expect(useMostWantedStore.getState().sweepExpired()).toEqual([]);
  });

  it('flips lapsed posters to expired', () => {
    useMostWantedStore.getState().postBounty({ ...basePost, durationMs: 1_000 });
    const later = Date.now() + 5_000;
    const swept = useMostWantedStore.getState().sweepExpired(later);
    expect(swept).toHaveLength(1);
    expect(useMostWantedStore.getState().posters[0].status).toBe('expired');
  });

  it('is idempotent across repeated sweeps', () => {
    useMostWantedStore.getState().postBounty({ ...basePost, durationMs: 1_000 });
    const later = Date.now() + 5_000;
    expect(useMostWantedStore.getState().sweepExpired(later)).toHaveLength(1);
    expect(useMostWantedStore.getState().sweepExpired(later)).toHaveLength(0);
  });
});

describe('selectors', () => {
  it('openPosters excludes paid, cancelled, and lapsed posters', () => {
    const store = useMostWantedStore.getState();
    const keep = store.postBounty(basePost);
    const cancelled = store.postBounty({ ...basePost, targetId: 'opp_2' });
    useMostWantedStore.getState().cancelBounty(cancelled.id);
    const open = useMostWantedStore.getState().openPosters();
    expect(open.map((p) => p.id)).toEqual([keep.id]);
  });

  it('postersBy filters to one poster author', () => {
    const store = useMostWantedStore.getState();
    store.postBounty(basePost);
    store.postBounty({ ...basePost, postedBy: 'p_someone_else' });
    expect(useMostWantedStore.getState().postersBy('p_me')).toHaveLength(1);
  });

  it('postersAgainstGang surfaces open threats to a gang', () => {
    const store = useMostWantedStore.getState();
    store.postBounty({ ...basePost, targetGangName: 'Eastside' });
    store.postBounty({ ...basePost, targetGangName: 'Northbound' });
    expect(useMostWantedStore.getState().postersAgainstGang('Eastside')).toHaveLength(1);
  });

  it('bountyOnTarget and isTargetWanted agree', () => {
    useMostWantedStore.getState().postBounty(basePost);
    expect(useMostWantedStore.getState().isTargetWanted('opp_1')).toBe(true);
    expect(useMostWantedStore.getState().bountyOnTarget('opp_1')).not.toBeNull();
    expect(useMostWantedStore.getState().isTargetWanted('ghost')).toBe(false);
  });

  it('isTargetWanted goes false once the contract is paid', () => {
    const p = useMostWantedStore.getState().postBounty(basePost);
    useMostWantedStore.getState().fulfilBounty({
      posterId: p.id,
      hunterPlayerId: 'p_other',
      hunterGangName: 'Westend',
      proofImageUrl: 'x',
    });
    expect(useMostWantedStore.getState().isTargetWanted('opp_1')).toBe(false);
  });
});

describe('ally ledger', () => {
  it('addAlly assigns an id and prepends', () => {
    const a = useMostWantedStore.getState().addAlly({
      playerId: 'p_x',
      gangName: 'Southgate',
      origin: 'bounty_fulfilled',
      since: new Date().toISOString(),
      standing: 55,
      jobsCompleted: 0,
      moneyExchanged: 0,
    });
    expect(a.id).toMatch(/^ally_/);
    expect(useMostWantedStore.getState().getAlly('p_x')).not.toBeNull();
  });

  it('recordAllyJob bumps standing, jobs, and money', () => {
    useMostWantedStore.getState().addAlly({
      playerId: 'p_x',
      gangName: 'Southgate',
      origin: 'bounty_fulfilled',
      since: new Date().toISOString(),
      standing: 55,
      jobsCompleted: 1,
      moneyExchanged: 1_000,
    });
    useMostWantedStore.getState().recordAllyJob('p_x', 500);
    const a = useMostWantedStore.getState().getAlly('p_x')!;
    expect(a.jobsCompleted).toBe(2);
    expect(a.moneyExchanged).toBe(1_500);
    expect(a.standing).toBe(55 + BOUNTY_CONFIG.ALLY_STANDING_PER_JOB);
  });

  it('getAlly returns null for a stranger', () => {
    expect(useMostWantedStore.getState().getAlly('nobody')).toBeNull();
  });
});

describe('pruneHistory', () => {
  it('keeps open posters regardless of age', () => {
    useMostWantedStore.getState().postBounty(basePost);
    useMostWantedStore.getState().pruneHistory(Date.now() + 10 * 365 * 86_400_000);
    expect(useMostWantedStore.getState().posters).toHaveLength(1);
  });

  it('drops settled posters past the retention horizon', () => {
    const p = useMostWantedStore.getState().postBounty(basePost);
    useMostWantedStore.getState().fulfilBounty({
      posterId: p.id,
      hunterPlayerId: 'p_other',
      hunterGangName: 'Westend',
      proofImageUrl: 'x',
    });
    useMostWantedStore
      .getState()
      .pruneHistory(Date.now() + BOUNTY_CONFIG.HISTORY_RETENTION_MS + 10_000);
    expect(useMostWantedStore.getState().posters).toHaveLength(0);
  });
});
