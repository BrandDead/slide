// ============================================================
// DEALT/SLIDE — Ghost Crew Store (#81)
// Persistent rival crews + world-tick driver + City Feed surfacing.
//
// This store is the single owner of ghost-crew state. It:
//   - persists crews to localStorage (zustand/persist) so a named rival
//     keeps its roster, treasury, grudges, and turf across sessions
//   - runs one world-tick decision per crew every GHOST_TICK_MS
//   - writes ghost-owned territory into useBlockStore.blocks (owner:'npc')
//     so the map, recon ring, and encounter pipeline all see ghost turf
//   - pushes every visible move to the City Feed (notification store)
//   - folds in retaliation: player attacks on ghost turf raise a grudge,
//     which biases the crew's next decision toward revenge
// ============================================================

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { useEffect, useCallback } from 'react';
import {
  DEFAULT_GHOST_CREWS,
  decideGhostAction,
  applyGhostActionChecked,
  buildGhostBlock,
  pickClaimTarget,
  addGrudge,
  validateGhostCrewState,
  type GhostCrew,
  type GhostAction,
  type GhostTickContext,
} from '../utils/ghostCrewEngine';
import { getDNAById } from '../config/blockDNA';
import { useBlockStore } from './blockStore';
import { useNotificationStore } from './gameStore';
import type { BlockData } from '../types/block.types';

// ─── Types ───────────────────────────────────────────────────

export interface GhostFeedEvent {
  id: string;
  crewId: string;
  crewName: string;
  action: GhostAction['type'];
  description: string;
  targetBlockId?: string;
  timestamp: number;
  /** Replay identity for a world tick, when this was produced locally. */
  tickKey?: string;
  /** Stable per-crew action identity within a tick. */
  actionKey?: string;
  /** Pure-policy explanation, useful in deterministic acceptance tests. */
  reason?: GhostAction['reason'];
  /** Seed used by the trusted local/mock tick boundary. */
  seed?: number;
}

export interface GhostStoreState {
  crews: Record<string, GhostCrew>;
  feed: GhostFeedEvent[];
  tickActive: boolean;
  tickIndex: number;
  /** Bounded exactly-once ledger for local/mock world ticks. */
  appliedTickKeys: string[];
  /** Bounded exactly-once ledger for encounter-driven rival responses. */
  appliedResponseKeys: string[];
}

export interface GhostTickOptions {
  tickKey?: string;
  seed?: number;
  occurredAt?: number;
}

export interface GhostTickReceipt {
  applied: boolean;
  tickKey: string;
  tickIndex: number;
  actions: GhostAction[];
  eventIds: string[];
  reason?: 'duplicate-tick' | 'invalid-tick-key' | 'no-crews' | GhostAction['reason'] | 'action-rejected';
}

export interface GhostStoreActions {
  /** Seed the default crews if the store is empty (first run). */
  seedCrews(): void;
  /** Run one world tick across all crews. */
  runTick(options?: GhostTickOptions): GhostTickReceipt;
  /** Record a player attack on a ghost block → raises that crew's grudge. */
  recordPlayerAttack(crewId: string, blockId: string, responseKey?: string, occurredAt?: number): boolean;
  /** The crew that owns a given block, if any. */
  crewForBlock(blockId: string): GhostCrew | undefined;
  /** Overlay the latest durable state fetched from the authoritative world. */
  replaceAuthoritativeState(crews: GhostCrew[], feed: GhostFeedEvent[]): void;
  setTickActive(active: boolean): void;
}

type GhostStore = GhostStoreState & GhostStoreActions;

// ─── Store ───────────────────────────────────────────────────

const FEED_LIMIT = 50;
const RECEIPT_LIMIT = 64;

function isValidFeedEvent(event: GhostFeedEvent): boolean {
  return Boolean(
    event
    && typeof event.id === 'string'
    && event.id
    && typeof event.crewId === 'string'
    && typeof event.crewName === 'string'
    && typeof event.description === 'string'
    && ['claim', 'reinforce', 'attack', 'lay-low'].includes(event.action)
    && Number.isFinite(event.timestamp),
  );
}

/**
 * Restore the rival-owned Block DNA projection into the same Block Store used
 * by the map and encounters. Rival state remains the authority; this is only
 * its shared-world projection, not another store.
 */
function reconcileGhostTerritory(
  crews: Record<string, GhostCrew>,
  removeStale: boolean,
): void {
  const blockState = useBlockStore.getState();
  const nextBlocks = { ...blockState.blocks };
  const expectedBlockIds = new Set<string>();
  let changed = false;

  for (const crew of Object.values(crews)) {
    if (validateGhostCrewState(crew)) continue;
    for (const dnaId of crew.claimedDnaIds) {
      const blockId = `ghost-${dnaId}`;
      if (!crew.ownedBlockIds.includes(blockId)) continue;
      expectedBlockIds.add(blockId);
      const dna = getDNAById(dnaId);
      if (!dna) continue;
      const playerOwnsDNA = Object.values(nextBlocks).some(
        (block) => block.owner === 'player' && block.dnaId === dnaId,
      );
      const existing = nextBlocks[blockId];
      if (playerOwnsDNA || existing?.owner === 'player') continue;
      if (!existing) {
        nextBlocks[blockId] = buildGhostBlock(crew, dna);
        changed = true;
      }
    }
  }

  if (removeStale) {
    for (const [blockId, block] of Object.entries(nextBlocks)) {
      if (
        block.owner === 'npc'
        && blockId.startsWith('ghost-')
        && !expectedBlockIds.has(blockId)
      ) {
        delete nextBlocks[blockId];
        changed = true;
      }
    }
  }

  if (changed) useBlockStore.setState({ blocks: nextBlocks });
}

export const useGhostStore = create<GhostStore>()(
  persist(
    devtools(
      (set, get) => ({
        crews: {},
        feed: [],
        tickActive: false,
        tickIndex: 0,
        appliedTickKeys: [],
        appliedResponseKeys: [],

        seedCrews() {
          if (Object.keys(get().crews).length === 0) {
            const crews: Record<string, GhostCrew> = {};
            for (const crew of DEFAULT_GHOST_CREWS) crews[crew.id] = crew;
            set({ crews }, false, 'ghost/seedCrews');
          }
          reconcileGhostTerritory(get().crews, false);
        },

        crewForBlock(blockId) {
          return Object.values(get().crews).find((c) => c.ownedBlockIds.includes(blockId));
        },

        recordPlayerAttack(crewId, blockId, responseKey, occurredAt = Date.now()) {
          // Read + derive first, then set, then notify — keep the Zustand
          // updater pure (no side effects inside set()).
          const state = get();
          const crew = state.crews[crewId];
          const sharedBlock = useBlockStore.getState().blocks[blockId];
          if (
            !crew
            || !crew.ownedBlockIds.includes(blockId)
            || sharedBlock?.owner !== 'npc'
            || sharedBlock.ownerGangName !== crew.name
          ) return false;
          const stableResponseKey = responseKey?.trim()
            || `local-response:${crewId}:${blockId}:${occurredAt}`;
          if ((state.appliedResponseKeys ?? []).includes(stableResponseKey)) return false;

          const updated = addGrudge(crew, blockId, 25, occurredAt);
          const feedEvent: GhostFeedEvent = {
            id: `response-${stableResponseKey}`,
            crewId,
            crewName: crew.name,
            action: 'attack',
            description: `${crew.name} will remember what you did on their block.`,
            targetBlockId: blockId,
            timestamp: occurredAt,
            actionKey: stableResponseKey,
          };
          set(
            (current) => ({
              crews: { ...current.crews, [crewId]: updated },
              feed: [feedEvent, ...current.feed].slice(0, FEED_LIMIT),
              appliedResponseKeys: [
                ...(current.appliedResponseKeys ?? []),
                stableResponseKey,
              ].slice(-RECEIPT_LIMIT),
            }),
            false,
            'ghost/recordPlayerAttack',
          );
          useNotificationStore.getState().addNotification({
            type: 'warning',
            title: `${crew.name} holds a grudge`,
            message: `Your hit on their turf raised their grudge to ${updated.grudge.score}. Expect payback.`,
            priority: 'high',
          });
          return true;
        },

        runTick(options = {}) {
          const state = get();
          const tickIndex = state.tickIndex + 1;
          const tickKey = options.tickKey?.trim() ?? `local:${tickIndex}`;
          if (!tickKey || tickKey.length > 220) {
            return { applied: false, tickKey, tickIndex: state.tickIndex, actions: [], eventIds: [], reason: 'invalid-tick-key' };
          }
          if ((state.appliedTickKeys ?? []).includes(tickKey)) {
            return { applied: false, tickKey, tickIndex: state.tickIndex, actions: [], eventIds: [], reason: 'duplicate-tick' };
          }

          const crewList = Object.values(state.crews).sort((left, right) => left.id.localeCompare(right.id));
          if (crewList.length === 0) {
            return { applied: false, tickKey, tickIndex: state.tickIndex, actions: [], eventIds: [], reason: 'no-crews' };
          }
          if (crewList.some((crew) => validateGhostCrewState(crew))) {
            return { applied: false, tickKey, tickIndex: state.tickIndex, actions: [], eventIds: [], reason: 'malformed-state' };
          }

          const seed = Number.isFinite(options.seed) ? Math.trunc(options.seed!) : tickIndex;
          const requestedOccurredAt = Number.isFinite(options.occurredAt)
            ? Math.trunc(options.occurredAt!)
            : Date.now();
          const occurredAt = Number.isFinite(new Date(requestedOccurredAt).getTime())
            ? requestedOccurredAt
            : Date.now();
          const blockStore = useBlockStore.getState();
          const workingBlocks = { ...blockStore.blocks };
          const playerBlocks = Object.values(workingBlocks).filter((b) => b.owner === 'player');
          const ghostOwnedBlockIds = new Set(
            Object.values(state.crews).flatMap((c) => c.ownedBlockIds),
          );

          const crews = { ...state.crews };
          const newFeed: GhostFeedEvent[] = [];
          const actions: GhostAction[] = [];
          const blockUpserts: BlockData[] = [];

          for (const crew of crewList) {
            const crewHeat = crew.ownedBlockIds.reduce(
              (highest, blockId) => Math.max(highest, workingBlocks[blockId]?.heat ?? 0),
              0,
            );
            const ctx: GhostTickContext = {
              playerBlocks,
              ghostOwnedBlockIds,
              tickIndex,
              tickKey,
              seed,
              crewHeat,
            };
            const action = decideGhostAction(crew, ctx);
            const application = applyGhostActionChecked(crew, action, {
              blocks: workingBlocks,
              occurredAt,
            });
            if (!application.applied) {
              return {
                applied: false,
                tickKey,
                tickIndex: state.tickIndex,
                actions: [],
                eventIds: [],
                reason: application.reason === 'malformed-state' ? 'malformed-state' : 'action-rejected',
              };
            }
            actions.push(action);
            crews[crew.id] = application.crew;

            if (application.blockUpsert) {
              workingBlocks[application.blockUpsert.id] = application.blockUpsert;
              blockUpserts.push(application.blockUpsert);
              ghostOwnedBlockIds.add(application.blockUpsert.id);
            }

            const actionKey = `${tickKey}:${crew.id}:${action.type}`;
            const feedEvent: GhostFeedEvent = {
              id: `feed-${actionKey}`,
              crewId: crew.id,
              crewName: crew.name,
              action: action.type,
              description: action.description,
              targetBlockId: action.targetBlockId,
              timestamp: occurredAt,
              tickKey,
              actionKey,
              reason: action.reason,
              seed,
            };
            newFeed.push(feedEvent);
          }

          for (const block of blockUpserts) blockStore.upsertBlock(block);
          set(
            (s) => ({
              crews,
              tickIndex,
              feed: [...newFeed.reverse(), ...s.feed].slice(0, FEED_LIMIT),
              appliedTickKeys: [...(s.appliedTickKeys ?? []), tickKey].slice(-RECEIPT_LIMIT),
            }),
            false,
            'ghost/runTick',
          );

          for (const action of actions) {
            if (action.threatensPlayer) {
              useNotificationStore.getState().addNotification({
                type: 'danger',
                title: `${action.crewName} is moving on you`,
                message: action.description,
                priority: 'high',
              });
            } else if (action.type === 'claim') {
              useNotificationStore.getState().addNotification({
                type: 'info',
                title: `${action.crewName} expanded`,
                message: action.description,
                priority: 'normal',
              });
            }
          }

          return {
            applied: true,
            tickKey,
            tickIndex,
            actions,
            eventIds: newFeed.map((event) => event.id),
          };
        },

        replaceAuthoritativeState(crews, feed) {
          const validCrews = crews.filter((crew) => !validateGhostCrewState(crew));
          const validFeed = feed.filter(isValidFeedEvent);
          set(
            (state) => {
              if (validCrews.length === 0 && validFeed.length === 0) return state;

              const nextCrews = { ...state.crews };
              for (const remoteCrew of validCrews) {
                // Authenticated sessions are server-led. A persisted local
                // demo timestamp must never outrank the server snapshot.
                nextCrews[remoteCrew.id] = remoteCrew;
              }

              const seen = new Set<string>();
              const mergedFeed = [...validFeed, ...state.feed].filter((event) => {
                if (seen.has(event.id)) return false;
                seen.add(event.id);
                return true;
              }).sort((left, right) => right.timestamp - left.timestamp).slice(0, FEED_LIMIT);

              return { crews: nextCrews, feed: mergedFeed };
            },
            false,
            'ghost/replaceAuthoritativeState',
          );
          reconcileGhostTerritory(get().crews, true);
        },

        setTickActive(active) {
          set({ tickActive: active }, false, 'ghost/setTickActive');
        },
      }),
      { name: 'ghost-store' },
    ),
    {
      name: 'slide-ghost-crews',
      version: 1,
    },
  ),
);

// ─── Tick hook ───────────────────────────────────────────────

const GHOST_TICK_MS = 30_000; // 30 s real time = one world tick

/**
 * Drop this hook in a top-level component (App.tsx) to start the ghost-crew
 * world tick. Crews are seeded once on first run, then decide a move every
 * tick. The store persists, so rivals keep their turf and grudges across
 * sessions.
 */
export function useGhostTick(enabled = true): void {
  const { seedCrews, setTickActive } = useGhostStore();

  // Seed once on first mount, or restore persisted rival territory into the
  // shared Block Store when the crew state already exists.
  useEffect(() => {
    seedCrews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tick = useCallback(() => useGhostStore.getState().runTick(), []);

  useEffect(() => {
    if (!enabled) {
      setTickActive(false);
      return;
    }
    setTickActive(true);
    // First tick is delayed so the player isn't ambushed on load.
    const interval = setInterval(tick, GHOST_TICK_MS);
    return () => {
      clearInterval(interval);
      setTickActive(false);
    };
  }, [enabled, tick, setTickActive]);
}

// ─── Selectors ───────────────────────────────────────────────

export const selectGhostCrewList = (s: GhostStoreState): GhostCrew[] => Object.values(s.crews);

export const selectGhostFeed = (s: GhostStoreState): GhostFeedEvent[] => s.feed;

export const selectThreateningCrews = (s: GhostStoreState): GhostCrew[] =>
  Object.values(s.crews).filter((c) => c.grudge.score >= 50);

/** Pick the DNA card a crew would claim next (for UI previews). */
export function previewNextClaim(crew: GhostCrew, tickIndex: number) {
  const blockStore = useBlockStore.getState();
  const playerBlocks = Object.values(blockStore.blocks).filter((b) => b.owner === 'player');
  const ghostOwnedBlockIds = new Set(
    Object.values(useGhostStore.getState().crews).flatMap((c) => c.ownedBlockIds),
  );
  return pickClaimTarget(crew, { playerBlocks, ghostOwnedBlockIds, tickIndex });
}
