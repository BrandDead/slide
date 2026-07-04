// ═══════════════════════════════════════════════════════════════════════════
// DEALT/SLIDE — Reinforcements ("Call Backup")
// Pillar 1: mid-fight deployment of idle members into an active combat grid.
//
// Pure functions + a thin Zustand store slice so BlockDriveByEngine.tsx
// and BlockModeView.tsx can both consume it.
//
// ENGINE INTEGRATION (BlockDriveByEngine.tsx):
//
//   import { useReinforcementStore } from '../../systems/reinforcements';
//
//   // In the combat tick loop:
//   const arrivals = useReinforcementStore.getState().processTick(tick);
//   for (const { units } of arrivals) {
//     scene.spawnUnits(units);             // render them rolling in
//     combatState.defenders.push(...units); // they join the resolver pool
//   }
//
//   // "CALL BACKUP" button onClick:
//   useReinforcementStore.getState().callBackup(
//     session.id, block.id, selectedMemberIds, tick,
//     members, ownedBlocks, updateBlock
//   );
// ═══════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import type { BackupRequest, BackupArrival } from '../types/economy.types';
import type { Block, GangMember, Unit, Tile } from '../types/game.types';

// ── Tuning ────────────────────────────────────────────────────────────────────

/** Base arrival delay in combat ticks; a driver in the party halves it. */
const BASE_ETA_TICKS = 6;
const DRIVER_ETA_TICKS = 3;

/** Max members per backup call — one car load. */
export const MAX_BACKUP_SQUAD = 4;

/** Cooldown between backup calls within one combat session (ticks). */
export const BACKUP_COOLDOWN_TICKS = 10;

// ── Availability ─────────────────────────────────────────────────────────────

/**
 * Members eligible for backup: active, not already deployed anywhere,
 * not locked up, and not already assigned to another task.
 */
export function getAvailableBackup(
  members: GangMember[],
  ownedBlocks: Block[]
): GangMember[] {
  const deployed = new Set<string>();
  for (const block of ownedBlocks) {
    for (const unit of block.units) deployed.add(unit.gangMemberId);
  }
  return members.filter(
    (m) =>
      m.status === 'active' &&
      !deployed.has(m.id) &&
      m.currentAssignment === null
  );
}

// ── Spawn logic ──────────────────────────────────────────────────────────────

/**
 * Backup arrives street-side: they roll up in a car, so they spawn on
 * street/sidewalk edge tiles that are unoccupied. High exposure — arriving
 * mid-firefight is dangerous by design.
 */
export function assignEntryTiles(
  block: Block,
  count: number
): { x: number; y: number }[] {
  const candidates: Tile[] = [];
  for (const row of block.grid.tiles) {
    for (const tile of row) {
      const isEdge =
        tile.x === 0 ||
        tile.y === 0 ||
        tile.x === block.grid.width - 1 ||
        tile.y === block.grid.height - 1;
      if (
        isEdge &&
        !tile.occupied &&
        (tile.type === 'street' || tile.type === 'sidewalk')
      ) {
        candidates.push(tile);
      }
    }
  }
  // Prefer street rows (car pulls up there), then shuffle for spread
  candidates.sort(
    (a, b) =>
      (a.type === 'street' ? -1 : 1) - (b.type === 'street' ? -1 : 1)
  );
  return candidates.slice(0, count).map((t) => ({ x: t.x, y: t.y }));
}

/** Build combat-ready Units from members for injection into the session. */
export function buildBackupUnits(
  members: GangMember[],
  block: Block,
  entries: { x: number; y: number }[]
): Unit[] {
  return members.slice(0, entries.length).map((m, i) => ({
    id: `unit-backup-${m.id}-${Date.now().toString(36)}`,
    type: inferCombatRole(m),
    gangMemberId: m.id,
    memberId: m.id,
    blockId: block.id,
    position: entries[i],
    health: 100,
    maxHealth: 100,
    accuracy: Math.min(0.95, 0.4 + m.stats.agility / 200 + m.level * 0.02),
    nerve: Math.min(1, 0.3 + m.stats.intimidation / 150 + m.morale / 250),
    speed: 1 + m.stats.agility / 100,
    weaponId: null, // engine equips from armory on arrival
    armorLevel: 0,
    status: 'combat' as const,
    assignedTask: 'reinforce',
  }));
}

function inferCombatRole(m: GangMember): 'shooter' | 'driver' | 'lookout' | 'enforcer' {
  if (!m.skills || m.skills.length === 0) return 'enforcer';
  const top = [...m.skills].sort((a, b) => b.level - a.level)[0];
  if (top?.category === 'combat') return 'shooter';
  if (top?.category === 'driving') return 'driver';
  if (top?.category === 'stealth') return 'lookout';
  return 'enforcer';
}

// ── Store slice ──────────────────────────────────────────────────────────────

interface ReinforcementState {
  pendingRequests: BackupRequest[];
  arrivals: BackupArrival[];
  lastCallTick: number;

  /**
   * Call backup during an active fight. Returns the request (with ETA) or
   * null if invalid (cooldown, no eligible members, no entry tiles).
   *
   * @param updateMember - from useGangStore to lock members in transit
   */
  callBackup: (
    combatSessionId: string,
    blockId: string,
    memberIds: string[],
    currentTick: number,
    members: GangMember[],
    ownedBlocks: Block[],
    updateMember: (id: string, updates: Partial<GangMember>) => void
  ) => BackupRequest | null;

  /**
   * Engine calls this each combat tick; resolves due arrivals into Units.
   *
   * @param updateBlock - from useTerritoryStore to register arriving units
   */
  processTick: (
    currentTick: number,
    members: GangMember[],
    ownedBlocks: Block[],
    updateBlock: (id: string, updates: Partial<Block>) => void
  ) => { request: BackupRequest; units: Unit[] }[];

  clear: () => void;
}

export const useReinforcementStore = create<ReinforcementState>()((set, get) => ({
  pendingRequests: [],
  arrivals: [],
  lastCallTick: -Infinity,

  callBackup: (
    combatSessionId,
    blockId,
    memberIds,
    currentTick,
    members,
    ownedBlocks,
    updateMember
  ) => {
    const state = get();
    if (currentTick - state.lastCallTick < BACKUP_COOLDOWN_TICKS) return null;
    if (memberIds.length === 0 || memberIds.length > MAX_BACKUP_SQUAD) return null;

    const available = getAvailableBackup(members, ownedBlocks);
    const availableIds = new Set(available.map((m) => m.id));
    const validIds = memberIds.filter((id) => availableIds.has(id));
    if (validIds.length === 0) return null;

    // A driver in the squad halves the ETA — that's what he's for
    const squad = members.filter((m) => validIds.includes(m.id));
    const hasDriver = squad.some((m) => inferCombatRole(m) === 'driver');

    const request: BackupRequest = {
      combatSessionId,
      blockId,
      memberIds: validIds,
      etaTicks: hasDriver ? DRIVER_ETA_TICKS : BASE_ETA_TICKS,
      requestedAt: new Date().toISOString(),
    };

    // Lock members so they can't be double-booked while in transit
    for (const id of validIds) {
      updateMember(id, { currentAssignment: `backup:${combatSessionId}` });
    }

    set((s) => ({
      pendingRequests: [
        ...s.pendingRequests,
        { ...request, etaTicks: currentTick + request.etaTicks },
      ],
      lastCallTick: currentTick,
    }));

    return request;
  },

  processTick: (currentTick, members, ownedBlocks, updateBlock) => {
    const due = get().pendingRequests.filter((r) => currentTick >= r.etaTicks);
    if (due.length === 0) return [];

    const results: { request: BackupRequest; units: Unit[] }[] = [];

    for (const request of due) {
      const block = ownedBlocks.find((b) => b.id === request.blockId);
      if (!block) continue;

      const squad = members.filter((m) => request.memberIds.includes(m.id));
      const entries = assignEntryTiles(block, squad.length);
      if (entries.length === 0) continue; // grid edge is full — car circles the block

      const units = buildBackupUnits(squad, block, entries);

      // Register units on the block + mark tiles occupied
      updateBlock(block.id, {
        units: [...block.units, ...units],
      });

      set((s) => ({
        arrivals: [
          ...s.arrivals,
          ...units.map((u) => ({
            memberId: u.gangMemberId,
            entryTile: u.position!,
            arrivedAtTick: currentTick,
          })),
        ],
      }));

      results.push({ request, units });
    }

    set((s) => ({
      pendingRequests: s.pendingRequests.filter(
        (r) => currentTick < r.etaTicks
      ),
    }));

    return results;
  },

  clear: () =>
    set({ pendingRequests: [], arrivals: [], lastCallTick: -Infinity }),
}));
