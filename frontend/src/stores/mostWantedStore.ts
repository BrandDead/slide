// ============================================================
// mostWantedStore — the Most Wanted board and ally ledger
// Sprint 15-B
//
// Players post bounties on members or on a member's special people.
// Any other player can take the contract, upload proof, and cash out.
// The payer's balance is debited, the hunter is saved as an ally, and
// the payout is public record — which is exactly how the next war
// starts.
//
// Verification is intentionally trust-first: proof is a screenshot and
// the payout is automatic. A dispute path would need a server-side
// referee, so instead the receipt is public and reputation does the
// policing.
// ============================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MostWantedPoster, BountyStatus, Ally } from '../types/game.types';

// ─── Tuning ──────────────────────────────────────────────────

export const BOUNTY_CONFIG = {
  MIN_REWARD: 500,
  MAX_REWARD: 500_000,

  /** How long a poster stays up before it expires unfulfilled. */
  DEFAULT_DURATION_MS: 7 * 24 * 60 * 60 * 1000, // 7 days

  /** Board takes a cut when a bounty is posted. Non-refundable on expiry. */
  LISTING_FEE_RATE: 0.05,

  /** Hits on a member's people cost more — it's uglier work. */
  SPECIAL_PERSON_PREMIUM: 1.5,

  /** Heat the hunter picks up for cashing a bounty. */
  HUNTER_HEAT: 8,

  /** Heat the poster picks up. Ordering it is a paper trail too. */
  POSTER_HEAT: 4,

  /** Standing a fresh ally starts at. */
  ALLY_STARTING_STANDING: 55,

  /** Standing gained per completed job together. */
  ALLY_STANDING_PER_JOB: 8,

  MAX_ALLY_STANDING: 100,

  /** Paid/expired posters drop off the board after this long. */
  HISTORY_RETENTION_MS: 30 * 24 * 60 * 60 * 1000,
} as const;

// ─── Pure helpers (exported for testing) ─────────────────────

/** Listing fee charged up front when posting. */
export function listingFee(reward: number): number {
  return Math.ceil(reward * BOUNTY_CONFIG.LISTING_FEE_RATE);
}

/** Total debited from the poster at the moment of posting. */
export function totalPostingCost(reward: number): number {
  return reward + listingFee(reward);
}

/**
 * Minimum reward the board will accept for a target.
 *
 * Scales with the target's level so nobody posts a $500 bounty on a level 10
 * shooter and expects takers. Special-person contracts carry a premium.
 */
export function minimumReward(
  targetLevel: number,
  targetKind: 'member' | 'special_person',
): number {
  const base = BOUNTY_CONFIG.MIN_REWARD * Math.max(1, targetLevel);
  const scaled =
    targetKind === 'special_person'
      ? base * BOUNTY_CONFIG.SPECIAL_PERSON_PREMIUM
      : base;
  return Math.min(Math.ceil(scaled), BOUNTY_CONFIG.MAX_REWARD);
}

export function isExpired(p: MostWantedPoster, now: number = Date.now()): boolean {
  if (p.status !== 'open') return false;
  return new Date(p.expiresAt).getTime() <= now;
}

export function remainingMs(p: MostWantedPoster, now: number = Date.now()): number {
  return Math.max(0, new Date(p.expiresAt).getTime() - now);
}

/** Days-and-hours label for a poster's remaining life. */
export function formatRemaining(ms: number): string {
  if (ms <= 0) return 'EXPIRED';
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h left`;
  }
  if (hours >= 1) return `${hours}h left`;
  return `${Math.max(1, Math.floor(ms / 60_000))}m left`;
}

export function canFulfil(
  p: MostWantedPoster,
  hunterPlayerId: string,
  now: number = Date.now(),
): { allowed: boolean; reason?: string } {
  if (p.status !== 'open') return { allowed: false, reason: 'This contract is closed.' };
  if (isExpired(p, now)) return { allowed: false, reason: 'This contract expired.' };
  if (p.postedBy === hunterPlayerId) {
    return { allowed: false, reason: "You can't cash your own contract." };
  }
  return { allowed: true };
}

/** Standing after crediting one more completed job. */
export function bumpStanding(current: number): number {
  return Math.min(
    BOUNTY_CONFIG.MAX_ALLY_STANDING,
    current + BOUNTY_CONFIG.ALLY_STANDING_PER_JOB,
  );
}

// ─── Store ───────────────────────────────────────────────────

export interface PostBountyInput {
  postedBy: string;
  postedByGangName: string;
  targetKind: 'member' | 'special_person';
  targetId: string;
  targetName: string;
  targetGangName: string;
  targetOwnerMemberId?: string;
  targetOwnerName?: string;
  lastKnownBlockId?: string;
  lastKnownAddress?: string;
  posterImageUrl?: string;
  note?: string;
  reward: number;
  durationMs?: number;
}

export interface FulfilInput {
  posterId: string;
  hunterPlayerId: string;
  hunterGangName: string;
  proofImageUrl: string;
}

export interface PayoutReceipt {
  poster: MostWantedPoster;
  reward: number;
  /** Player who gets paid. */
  paidTo: string;
  paidToGangName: string;
  /** Player who pays. */
  paidBy: string;
  /** Ally record created or updated on the poster's side. */
  ally: Ally;
}

interface MostWantedState {
  posters: MostWantedPoster[];
  allies: Ally[];

  postBounty: (input: PostBountyInput) => MostWantedPoster;
  cancelBounty: (posterId: string) => boolean;

  /**
   * Submit proof and cash out. Returns the receipt so the caller can debit the
   * poster's balance, credit the hunter, log the shoebox transaction, and fire
   * the inbox message. Returns null when the contract can't be fulfilled.
   */
  fulfilBounty: (input: FulfilInput) => PayoutReceipt | null;

  sweepExpired: (now?: number) => MostWantedPoster[];

  openPosters: (now?: number) => MostWantedPoster[];
  postersBy: (playerId: string) => MostWantedPoster[];
  postersAgainstGang: (gangName: string) => MostWantedPoster[];
  bountyOnTarget: (targetId: string) => MostWantedPoster | null;
  isTargetWanted: (targetId: string) => boolean;

  addAlly: (ally: Omit<Ally, 'id'>) => Ally;
  recordAllyJob: (playerId: string, money: number) => void;
  getAlly: (playerId: string) => Ally | null;

  pruneHistory: (now?: number) => void;
  clearAll: () => void;
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useMostWantedStore = create<MostWantedState>()(
  persist(
    (set, get) => ({
      posters: [],
      allies: [],

      postBounty: (input) => {
        const now = Date.now();
        const duration = input.durationMs ?? BOUNTY_CONFIG.DEFAULT_DURATION_MS;
        const poster: MostWantedPoster = {
          id: makeId('mw'),
          postedBy: input.postedBy,
          postedByGangName: input.postedByGangName,
          postedAt: new Date(now).toISOString(),
          expiresAt: new Date(now + duration).toISOString(),
          targetKind: input.targetKind,
          targetId: input.targetId,
          targetName: input.targetName,
          targetGangName: input.targetGangName,
          targetOwnerMemberId: input.targetOwnerMemberId,
          targetOwnerName: input.targetOwnerName,
          lastKnownBlockId: input.lastKnownBlockId,
          lastKnownAddress: input.lastKnownAddress,
          posterImageUrl: input.posterImageUrl,
          note: input.note,
          reward: Math.min(
            BOUNTY_CONFIG.MAX_REWARD,
            Math.max(BOUNTY_CONFIG.MIN_REWARD, Math.floor(input.reward)),
          ),
          status: 'open',
        };
        set((state) => ({ posters: [poster, ...state.posters] }));
        return poster;
      },

      cancelBounty: (posterId) => {
        const p = get().posters.find((x) => x.id === posterId);
        if (!p || p.status !== 'open') return false;
        set((state) => ({
          posters: state.posters.map((x) =>
            x.id === posterId ? { ...x, status: 'cancelled' as BountyStatus } : x,
          ),
        }));
        return true;
      },

      fulfilBounty: ({ posterId, hunterPlayerId, hunterGangName, proofImageUrl }) => {
        const poster = get().posters.find((p) => p.id === posterId);
        if (!poster) return null;

        const check = canFulfil(poster, hunterPlayerId);
        if (!check.allowed) return null;

        const now = Date.now();
        const paid: MostWantedPoster = {
          ...poster,
          status: 'paid',
          claimedBy: hunterPlayerId,
          claimedByGangName: hunterGangName,
          claimedAt: new Date(now).toISOString(),
          proofImageUrl,
          paidAt: new Date(now).toISOString(),
        };

        set((state) => ({
          posters: state.posters.map((p) => (p.id === posterId ? paid : p)),
        }));

        // The hunter becomes an ally of the poster. Business, not friendship.
        const existing = get().allies.find((a) => a.playerId === hunterPlayerId);
        let ally: Ally;
        if (existing) {
          ally = {
            ...existing,
            standing: bumpStanding(existing.standing),
            jobsCompleted: existing.jobsCompleted + 1,
            moneyExchanged: existing.moneyExchanged + poster.reward,
          };
          set((state) => ({
            allies: state.allies.map((a) => (a.playerId === hunterPlayerId ? ally : a)),
          }));
        } else {
          ally = {
            id: makeId('ally'),
            playerId: hunterPlayerId,
            gangName: hunterGangName,
            origin: 'bounty_fulfilled',
            since: new Date(now).toISOString(),
            standing: BOUNTY_CONFIG.ALLY_STARTING_STANDING,
            jobsCompleted: 1,
            moneyExchanged: poster.reward,
          };
          set((state) => ({ allies: [ally, ...state.allies] }));
        }

        return {
          poster: paid,
          reward: poster.reward,
          paidTo: hunterPlayerId,
          paidToGangName: hunterGangName,
          paidBy: poster.postedBy,
          ally,
        };
      },

      sweepExpired: (now = Date.now()) => {
        const lapsed = get().posters.filter((p) => isExpired(p, now));
        if (lapsed.length === 0) return [];
        const ids = new Set(lapsed.map((p) => p.id));
        set((state) => ({
          posters: state.posters.map((p) =>
            ids.has(p.id) ? { ...p, status: 'expired' as BountyStatus } : p,
          ),
        }));
        return lapsed.map((p) => ({ ...p, status: 'expired' as BountyStatus }));
      },

      openPosters: (now = Date.now()) =>
        get().posters.filter((p) => p.status === 'open' && !isExpired(p, now)),

      postersBy: (playerId) => get().posters.filter((p) => p.postedBy === playerId),

      postersAgainstGang: (gangName) =>
        get().posters.filter(
          (p) => p.targetGangName === gangName && p.status === 'open',
        ),

      bountyOnTarget: (targetId) =>
        get()
          .openPosters()
          .find((p) => p.targetId === targetId) ?? null,

      isTargetWanted: (targetId) => get().bountyOnTarget(targetId) !== null,

      addAlly: (input) => {
        const ally: Ally = { ...input, id: makeId('ally') };
        set((state) => ({ allies: [ally, ...state.allies] }));
        return ally;
      },

      recordAllyJob: (playerId, money) =>
        set((state) => ({
          allies: state.allies.map((a) =>
            a.playerId === playerId
              ? {
                  ...a,
                  standing: bumpStanding(a.standing),
                  jobsCompleted: a.jobsCompleted + 1,
                  moneyExchanged: a.moneyExchanged + money,
                }
              : a,
          ),
        })),

      getAlly: (playerId) =>
        get().allies.find((a) => a.playerId === playerId) ?? null,

      pruneHistory: (now = Date.now()) =>
        set((state) => ({
          posters: state.posters.filter((p) => {
            if (p.status === 'open') return true;
            const settled = new Date(p.paidAt ?? p.expiresAt).getTime();
            return settled > now - BOUNTY_CONFIG.HISTORY_RETENTION_MS;
          }),
        })),

      clearAll: () => set({ posters: [], allies: [] }),
    }),
    { name: 'slide-mostwanted-store' },
  ),
);
