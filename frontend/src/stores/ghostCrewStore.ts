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
import { useEffect, useRef, useCallback } from 'react';
import {
  DEFAULT_GHOST_CREWS,
  decideGhostAction,
  applyGhostAction,
  buildGhostBlock,
  pickClaimTarget,
  addGrudge,
  type GhostCrew,
  type GhostAction,
  type GhostTickContext,
} from '../utils/ghostCrewEngine';
import { getDNAById } from '../config/blockDNA';
import { useBlockStore } from './blockStore';
import { useNotificationStore } from './gameStore';

// ─── Types ───────────────────────────────────────────────────

export interface GhostFeedEvent {
  id: string;
  crewId: string;
  crewName: string;
  action: GhostAction['type'];
  description: string;
  targetBlockId?: string;
  timestamp: number;
}

export interface GhostStoreState {
  crews: Record<string, GhostCrew>;
  feed: GhostFeedEvent[];
  tickActive: boolean;
  tickIndex: number;
}

export interface GhostStoreActions {
  /** Seed the default crews if the store is empty (first run). */
  seedCrews(): void;
  /** Run one world tick across all crews. */
  runTick(): void;
  /** Record a player attack on a ghost block → raises that crew's grudge. */
  recordPlayerAttack(crewId: string, blockId: string): void;
  /** The crew that owns a given block, if any. */
  crewForBlock(blockId: string): GhostCrew | undefined;
  setTickActive(active: boolean): void;
}

type GhostStore = GhostStoreState & GhostStoreActions;

// ─── Store ───────────────────────────────────────────────────

const FEED_LIMIT = 50;

export const useGhostStore = create<GhostStore>()(
  persist(
    devtools(
      (set, get) => ({
        crews: {},
        feed: [],
        tickActive: false,
        tickIndex: 0,

        seedCrews() {
          if (Object.keys(get().crews).length > 0) return;
          const crews: Record<string, GhostCrew> = {};
          for (const crew of DEFAULT_GHOST_CREWS) crews[crew.id] = crew;
          set({ crews }, false, 'ghost/seedCrews');
        },

        crewForBlock(blockId) {
          return Object.values(get().crews).find((c) => c.ownedBlockIds.includes(blockId));
        },

        recordPlayerAttack(crewId, blockId) {
          set(
            (state) => {
              const crew = state.crews[crewId];
              if (!crew) return state;
              const updated = addGrudge(crew, blockId, 25);
              const feed: GhostFeedEvent = {
                id: `grudge-${Date.now()}`,
                crewId,
                crewName: crew.name,
                action: 'attack',
                description: `${crew.name} will remember what you did on their block.`,
                targetBlockId: blockId,
                timestamp: Date.now(),
              };
              useNotificationStore.getState().addNotification({
                type: 'warning',
                title: `${crew.name} holds a grudge`,
                message: `Your hit on their turf raised their grudge to ${updated.grudge.score}. Expect payback.`,
                priority: 'high',
              });
              return {
                crews: { ...state.crews, [crewId]: updated },
                feed: [feed, ...state.feed].slice(0, FEED_LIMIT),
              };
            },
            false,
            'ghost/recordPlayerAttack',
          );
        },

        runTick() {
          const state = get();
          const tickIndex = state.tickIndex + 1;
          const blockStore = useBlockStore.getState();
          const playerBlocks = Object.values(blockStore.blocks).filter((b) => b.owner === 'player');
          const ghostOwnedBlockIds = new Set(
            Object.values(state.crews).flatMap((c) => c.ownedBlockIds),
          );
          const ctx: GhostTickContext = { playerBlocks, ghostOwnedBlockIds, tickIndex };

          const crews = { ...state.crews };
          const newFeed: GhostFeedEvent[] = [];

          for (const crew of Object.values(state.crews)) {
            const action = decideGhostAction(crew, ctx);
            const updated = applyGhostAction(crew, action);
            crews[crew.id] = updated;

            // Surface claims into blockStore so the map shows new ghost turf.
            if (action.type === 'claim' && action.claimedDnaId) {
              const dna = getDNAById(action.claimedDnaId);
              if (dna) {
                blockStore.upsertBlock(buildGhostBlock(updated, dna));
                ctx.ghostOwnedBlockIds.add(`ghost-${dna.id}`);
              }
            }

            // Feed + City Feed notification.
            const feedEvent: GhostFeedEvent = {
              id: `feed-${tickIndex}-${crew.id}`,
              crewId: crew.id,
              crewName: crew.name,
              action: action.type,
              description: action.description,
              targetBlockId: action.targetBlockId,
              timestamp: Date.now(),
            };
            newFeed.push(feedEvent);

            if (action.threatensPlayer) {
              useNotificationStore.getState().addNotification({
                type: 'danger',
                title: `${crew.name} is moving on you`,
                message: action.description,
                priority: 'high',
              });
            } else if (action.type === 'claim') {
              useNotificationStore.getState().addNotification({
                type: 'info',
                title: `${crew.name} expanded`,
                message: action.description,
                priority: 'normal',
              });
            }
          }

          set(
            (s) => ({
              crews,
              tickIndex,
              feed: [...newFeed.reverse(), ...s.feed].slice(0, FEED_LIMIT),
            }),
            false,
            'ghost/runTick',
          );
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
export function useGhostTick(): void {
  const { crews, seedCrews, runTick, setTickActive } = useGhostStore();

  // Seed once on first mount.
  useEffect(() => {
    if (Object.keys(crews).length === 0) seedCrews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tick = useCallback(() => useGhostStore.getState().runTick(), []);

  useEffect(() => {
    setTickActive(true);
    // First tick is delayed so the player isn't ambushed on load.
    const interval = setInterval(tick, GHOST_TICK_MS);
    return () => {
      clearInterval(interval);
      setTickActive(false);
    };
  }, [tick, setTickActive]);

  // Keep a live ref so other systems can read the latest crews without
  // subscribing.
  const crewsRef = useRef(crews);
  useEffect(() => {
    crewsRef.current = crews;
  }, [crews]);
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
