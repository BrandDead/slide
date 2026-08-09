/**
 * DEALT/SLIDE — NPC Ghost Crew Store
 * Manages rival NPC gangs: their state, territory, AI tick, and threat events.
 *
 * Architecture:
 *  - npcStore holds all NPC gang state in Zustand (persisted to localStorage)
 *  - useNPCTick() hook drives the AI tick every 30 s (game time)
 *  - NPCBehaviorEngine mirrors the Python backend logic for offline play
 *  - When the backend is connected, tickNPCGangs() calls /api/npc/tick
 *    and merges the response; the hook falls back to local logic if offline.
 */

import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import { useEffect, useRef, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────

export type NPCFaction = 'eastside' | 'westside' | 'northside' | 'southside' | 'downtown';
export type NPCMemberRole = 'shooter' | 'dealer' | 'enforcer';
export type NPCActionType = 'patrol' | 'expand' | 'retaliate' | 'raid' | 'defend';

export interface NPCMember {
  id: string;
  name: string;
  role: NPCMemberRole;
  level: number;
  health: number;
  maxHealth: number;
  shooting: number;
  dealing: number;
  alive: boolean;
}

export interface NPCGang {
  id: string;
  name: string;
  faction: NPCFaction;
  /** 1 = pushover, 5 = end-game boss crew */
  difficulty: number;
  /** 0-100: how likely to attack vs patrol */
  aggression: number;
  /** 0-100: how many members / upgrades they can afford */
  wealth: number;
  /** Number of blocks controlled */
  territoryCount: number;
  /** Block IDs this gang controls */
  controlledBlocks: string[];
  members: NPCMember[];
  /** ISO timestamp of last AI tick */
  lastTickAt: string;
  lastAction?: string;
  lastActionType?: NPCActionType;
  /** Block ID they last attacked */
  lastTargetBlockId?: string;
  /** Whether they are currently threatening the player */
  threatening: boolean;
}

export interface NPCThreatEvent {
  id: string;
  gangId: string;
  gangName: string;
  type: NPCActionType;
  targetBlockId?: string;
  description: string;
  timestamp: number;
  /** Has the player acknowledged this threat? */
  acknowledged: boolean;
}

export interface NPCStoreState {
  gangs: Record<string, NPCGang>;
  threatEvents: NPCThreatEvent[];
  /** Whether the AI tick is running */
  tickActive: boolean;
}

export interface NPCStoreActions {
  /** Seed the store with the default 5 rival gangs */
  seedDefaultGangs(): void;
  /** Apply an AI tick result to a gang */
  applyTick(gangId: string, action: NPCActionType, description: string, targetBlockId?: string): void;
  /** Mark a gang as threatening the player */
  setThreatening(gangId: string, threatening: boolean): void;
  /** Add a threat event notification */
  addThreatEvent(event: Omit<NPCThreatEvent, 'id' | 'acknowledged'>): void;
  /** Acknowledge a threat event */
  acknowledgeThreat(eventId: string): void;
  /** Apply damage to an NPC gang after the player retaliates */
  applyPlayerDamage(gangId: string, membersKilled: number, wealthLost: number): void;
  /** Clear all threat events older than 10 minutes */
  pruneOldEvents(): void;
  setTickActive(active: boolean): void;
}

type NPCStore = NPCStoreState & NPCStoreActions;

// ─── Default Gang Roster ─────────────────────────────────────

function makeNPCMember(
  id: string,
  name: string,
  role: NPCMemberRole,
  level: number,
): NPCMember {
  return {
    id,
    name,
    role,
    level,
    health: 100,
    maxHealth: 100,
    shooting: 20 + level * 12,
    dealing: 20 + level * 10,
    alive: true,
  };
}

const DEFAULT_GANGS: NPCGang[] = [
  {
    id: 'npc-12ocho',
    name: '12Ocho / Twelve-O',
    faction: 'southside',
    difficulty: 2,
    aggression: 65,
    wealth: 40,
    territoryCount: 3,
    controlledBlocks: [],
    threatening: false,
    lastTickAt: new Date(Date.now() - 600_000).toISOString(),
    lastAction: 'Patrolling Las Olas',
    lastActionType: 'patrol',
    members: [
      makeNPCMember('12-1', 'Ocho', 'shooter', 3),
      makeNPCMember('12-2', 'Lil 12', 'dealer', 2),
      makeNPCMember('12-3', 'V-Twelve', 'enforcer', 4),
    ],
  },
  {
    id: 'npc-nofed',
    name: 'No Fed, All Fed',
    faction: 'eastside',
    difficulty: 4,
    aggression: 85,
    wealth: 65,
    territoryCount: 5,
    controlledBlocks: [],
    threatening: false,
    lastTickAt: new Date(Date.now() - 1_800_000).toISOString(),
    lastAction: 'Monitoring Federal Hwy',
    lastActionType: 'expand',
    members: [
      makeNPCMember('nf-1', 'Fed Buster', 'enforcer', 5),
      makeNPCMember('nf-2', 'All-Day', 'shooter', 4),
      makeNPCMember('nf-3', 'Zero Fed', 'shooter', 4),
    ],
  },
  {
    id: 'npc-sevendown',
    name: 'Seven Down / 7DWN',
    faction: 'westside',
    difficulty: 3,
    aggression: 70,
    wealth: 50,
    territoryCount: 4,
    controlledBlocks: [],
    threatening: false,
    lastTickAt: new Date(Date.now() - 3_600_000).toISOString(),
    lastAction: 'Holding SW 7th Ave',
    lastActionType: 'defend',
    members: [
      makeNPCMember('7d-1', 'Lucky 7', 'shooter', 3),
      makeNPCMember('7d-2', 'Down-Low', 'dealer', 3),
      makeNPCMember('7d-3', 'Seven-Up', 'enforcer', 3),
    ],
  },
  {
    id: 'npc-nineside',
    name: 'Nine Side / N9NE',
    faction: 'westside',
    difficulty: 2,
    aggression: 60,
    wealth: 35,
    territoryCount: 2,
    controlledBlocks: [],
    threatening: false,
    lastTickAt: new Date(Date.now() - 900_000).toISOString(),
    lastAction: 'Tagging N9 on the block',
    lastActionType: 'patrol',
    members: [
      makeNPCMember('n9-1', 'Cloud 9', 'shooter', 2),
      makeNPCMember('n9-2', 'Nine-Life', 'dealer', 2),
      makeNPCMember('n9-3', 'Lil Niner', 'enforcer', 2),
    ],
  },
  {
    id: 'npc-olasboys',
    name: 'Olas Boys / OLB',
    faction: 'downtown',
    difficulty: 5,
    aggression: 95,
    wealth: 90,
    territoryCount: 8,
    controlledBlocks: [],
    threatening: false,
    lastTickAt: new Date(Date.now() - 300_000).toISOString(),
    lastAction: 'Controlling downtown Las Olas',
    lastActionType: 'raid',
    members: [
      makeNPCMember('ol-1', 'Olas King', 'enforcer', 5),
      makeNPCMember('ol-2', 'Strip Boss', 'shooter', 5),
      makeNPCMember('ol-3', 'Beach Boy', 'dealer', 4),
    ],
  },
];

// ─── Local AI Tick Engine ─────────────────────────────────────
// Mirrors the Python NPCBehaviorEngine for offline / dev play.

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 43758.5453;
  return x - Math.floor(x);
}

interface TickResult {
  action: NPCActionType;
  description: string;
  targetBlockId?: string;
  threatening: boolean;
}

function localNPCTick(
  gang: NPCGang,
  playerBlockIds: string[],
  seed: number,
): TickResult {
  const r = seededRandom(seed);
  const aliveCount = gang.members.filter((m) => m.alive).length;

  // Low member count → defend
  if (aliveCount <= 1) {
    return { action: 'defend', description: `${gang.name} is regrouping.`, threatening: false };
  }

  // Decide action based on aggression + wealth
  const aggressionNorm = gang.aggression / 100;
  const wealthNorm = gang.wealth / 100;

  let action: NPCActionType;
  if (r < 0.25) {
    action = 'patrol';
  } else if (r < 0.25 + wealthNorm * 0.2) {
    action = 'expand';
  } else if (r < 0.55 + aggressionNorm * 0.25 && playerBlockIds.length > 0) {
    action = 'retaliate';
  } else if (r < 0.75 + aggressionNorm * 0.2 && playerBlockIds.length > 0) {
    action = 'raid';
  } else {
    action = 'defend';
  }

  const targetBlockId =
    (action === 'retaliate' || action === 'raid') && playerBlockIds.length > 0
      ? playerBlockIds[Math.floor(seededRandom(seed + 1) * playerBlockIds.length)]
      : undefined;

  const descriptions: Record<NPCActionType, string> = {
    patrol: `${gang.name} is patrolling their turf.`,
    expand: `${gang.name} is moving on unclaimed blocks.`,
    retaliate: `${gang.name} is retaliating — watch your block!`,
    raid: `${gang.name} is raiding your operation!`,
    defend: `${gang.name} is reinforcing their defenses.`,
  };

  return {
    action,
    description: descriptions[action],
    targetBlockId,
    threatening: action === 'retaliate' || action === 'raid',
  };
}

// ─── Store ───────────────────────────────────────────────────

export const useNPCStore = create<NPCStore>()(
  persist(
    devtools(
      (set, get) => ({
        gangs: {},
        threatEvents: [],
        tickActive: false,

        seedDefaultGangs() {
          const gangs: Record<string, NPCGang> = {};
          for (const gang of DEFAULT_GANGS) {
            gangs[gang.id] = gang;
          }
          set({ gangs }, false, 'npc/seedDefaultGangs');
        },

        applyTick(gangId, action, description, targetBlockId) {
          set(
            (state) => {
              const gang = state.gangs[gangId];
              if (!gang) return state;
              return {
                gangs: {
                  ...state.gangs,
                  [gangId]: {
                    ...gang,
                    lastTickAt: new Date().toISOString(),
                    lastAction: description,
                    lastActionType: action,
                    lastTargetBlockId: targetBlockId,
                    threatening: action === 'retaliate' || action === 'raid',
                  },
                },
              };
            },
            false,
            'npc/applyTick',
          );
        },

        setThreatening(gangId, threatening) {
          set(
            (state) => {
              const gang = state.gangs[gangId];
              if (!gang) return state;
              return {
                gangs: {
                  ...state.gangs,
                  [gangId]: { ...gang, threatening },
                },
              };
            },
            false,
            'npc/setThreatening',
          );
        },

        addThreatEvent(event) {
          const id = `threat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          set(
            (state) => ({
              threatEvents: [
                ...state.threatEvents.slice(-49), // keep last 50
                { ...event, id, acknowledged: false },
              ],
            }),
            false,
            'npc/addThreatEvent',
          );
        },

        acknowledgeThreat(eventId) {
          set(
            (state) => ({
              threatEvents: state.threatEvents.map((e) =>
                e.id === eventId ? { ...e, acknowledged: true } : e,
              ),
            }),
            false,
            'npc/acknowledgeThreat',
          );
        },

        applyPlayerDamage(gangId, membersKilled, wealthLost) {
          set(
            (state) => {
              const gang = state.gangs[gangId];
              if (!gang) return state;
              let killed = membersKilled;
              const members = gang.members.map((m) => {
                if (killed > 0 && m.alive) {
                  killed--;
                  return { ...m, alive: false, health: 0 };
                }
                return m;
              });
              return {
                gangs: {
                  ...state.gangs,
                  [gangId]: {
                    ...gang,
                    members,
                    wealth: Math.max(0, gang.wealth - wealthLost),
                  },
                },
              };
            },
            false,
            'npc/applyPlayerDamage',
          );
        },

        pruneOldEvents() {
          const cutoff = Date.now() - 10 * 60 * 1000;
          set(
            (state) => ({
              threatEvents: state.threatEvents.filter(
                (e) => e.timestamp > cutoff || !e.acknowledged,
              ),
            }),
            false,
            'npc/pruneOldEvents',
          );
        },

        setTickActive(active) {
          set({ tickActive: active }, false, 'npc/setTickActive');
        },
      }),
      { name: 'NPCStore' },
    ),
    {
      name: 'slide-npc-store',
      version: 1,
    },
  ),
);

// ─── NPC Tick Hook ────────────────────────────────────────────

const NPC_TICK_INTERVAL_MS = 30_000; // 30 s real time = one game tick

/**
 * Drop this hook in a top-level component (e.g. App.tsx) to start the NPC AI.
 * It runs a local tick every 30 s and optionally syncs with the backend.
 *
 * @param playerBlockIds - IDs of blocks the player currently controls
 * @param backendUrl - Optional backend base URL; if omitted, runs local AI only
 */
export function useNPCTick(
  playerBlockIds: string[],
  backendUrl?: string,
): void {
  const { gangs, seedDefaultGangs, applyTick, addThreatEvent, pruneOldEvents, setTickActive } =
    useNPCStore();
  const tickCountRef = useRef(0);
  const playerBlockIdsRef = useRef(playerBlockIds);

  useEffect(() => {
    playerBlockIdsRef.current = playerBlockIds;
  }, [playerBlockIds]);

  // Seed gangs on first mount if empty
  useEffect(() => {
    if (Object.keys(gangs).length === 0) {
      seedDefaultGangs();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const runTick = useCallback(async () => {
    tickCountRef.current += 1;
    const seed = tickCountRef.current * 1337 + Date.now() * 0.001;
    const currentGangs = useNPCStore.getState().gangs;
    const blockIds = playerBlockIdsRef.current;

    // Try backend first
    if (backendUrl) {
      try {
        const res = await fetch(`${backendUrl}/api/npc/tick`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ player_block_ids: blockIds }),
        });
        if (res.ok) {
          const data = await res.json();
          // Backend returns array of { gang_id, action, description, target_block_id }
          for (const result of data.results ?? []) {
            applyTick(result.gang_id, result.action, result.description, result.target_block_id);
            if (result.action === 'retaliate' || result.action === 'raid') {
              addThreatEvent({
                gangId: result.gang_id,
                gangName: currentGangs[result.gang_id]?.name ?? 'Unknown Gang',
                type: result.action,
                targetBlockId: result.target_block_id,
                description: result.description,
                timestamp: Date.now(),
              });
            }
          }
          pruneOldEvents();
          return;
        }
      } catch {
        // Fall through to local AI
      }
    }

    // Local AI fallback
    let localSeed = seed;
    for (const gang of Object.values(currentGangs)) {
      const result = localNPCTick(gang, blockIds, localSeed);
      localSeed += 17.3;
      applyTick(gang.id, result.action, result.description, result.targetBlockId);
      if (result.threatening && result.targetBlockId) {
        addThreatEvent({
          gangId: gang.id,
          gangName: gang.name,
          type: result.action,
          targetBlockId: result.targetBlockId,
          description: result.description,
          timestamp: Date.now(),
        });
      }
    }
    pruneOldEvents();
  }, [applyTick, addThreatEvent, pruneOldEvents, backendUrl]);

  useEffect(() => {
    setTickActive(true);
    // Run immediately on mount, then every 30 s
    runTick();
    const interval = setInterval(runTick, NPC_TICK_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      setTickActive(false);
    };
  }, [runTick, setTickActive]);
}

// ─── Selectors ───────────────────────────────────────────────

export const selectNPCGangList = (state: NPCStoreState): NPCGang[] =>
  Object.values(state.gangs);

export const selectThreateningGangs = (state: NPCStoreState): NPCGang[] =>
  Object.values(state.gangs).filter((g) => g.threatening);

export const selectUnacknowledgedThreats = (state: NPCStoreState): NPCThreatEvent[] =>
  state.threatEvents.filter((e) => !e.acknowledged);
