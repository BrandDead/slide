// ============================================================
// SLIDE / DEALT — Block Store (Zustand)
// Manages block state, member placements, and drive-by events
// Sprint: block-mode-combat-assets
// ============================================================

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
  BlockStore,
  BlockZone,
  BlockZoneType,
  BlockPlacement,
  BlockData,
  DriveByEvent,
} from '../types/block.types';

// ─── Zone layout template (8×8) ─────────────────────────────
// Row 0: street (drive-by lane — top)
// Row 1: curb
// Row 2-3: sidewalk
// Row 4-5: storefront / alley
// Row 6: curb
// Row 7: street (drive-by lane — bottom)

const ZONE_LAYOUT: BlockZoneType[][] = [
  ['street',     'street',     'street',     'street',     'street',     'street',     'street',     'street'],
  ['curb',       'curb',       'curb',       'curb',       'curb',       'curb',       'curb',       'curb'],
  ['sidewalk',   'sidewalk',   'sidewalk',   'sidewalk',   'sidewalk',   'sidewalk',   'sidewalk',   'sidewalk'],
  ['storefront', 'storefront', 'alley',      'storefront', 'storefront', 'alley',      'storefront', 'storefront'],
  ['storefront', 'storefront', 'alley',      'storefront', 'storefront', 'alley',      'storefront', 'storefront'],
  ['sidewalk',   'sidewalk',   'sidewalk',   'sidewalk',   'sidewalk',   'sidewalk',   'sidewalk',   'sidewalk'],
  ['curb',       'curb',       'curb',       'curb',       'curb',       'curb',       'curb',       'curb'],
  ['street',     'street',     'street',     'street',     'street',     'street',     'street',     'street'],
];

const ZONE_STATS: Record<BlockZoneType, { income: number; exposure: number; cover: number; passable: boolean }> = {
  street:     { income: 100, exposure: 95, cover: 0.05, passable: false },
  curb:       { income: 80,  exposure: 80, cover: 0.15, passable: true  },
  sidewalk:   { income: 60,  exposure: 50, cover: 0.30, passable: true  },
  storefront: { income: 40,  exposure: 25, cover: 0.60, passable: true  },
  alley:      { income: 20,  exposure: 10, cover: 0.80, passable: true  },
  parking:    { income: 30,  exposure: 40, cover: 0.35, passable: true  },
  rooftop:    { income: 0,   exposure: 5,  cover: 0.90, passable: true  },
  building:   { income: 0,   exposure: 0,  cover: 1.00, passable: false },
};

/**
 * Build the canonical 8×8 placement grid from an optional per-row Block DNA
 * layout. Unknown or absent rows retain the default placement contract.
 */
export function generateGridForZoneLayout(zoneLayout?: readonly BlockZoneType[]): BlockZone[][] {
  return ZONE_LAYOUT.map((row, y) =>
    row.map((defaultZoneType, x) => {
      const zoneType = zoneLayout?.[y] ?? defaultZoneType;
      const stats = ZONE_STATS[zoneType];
      return {
        x,
        y,
        zoneType,
        incomeModifier: stats.income,
        exposureRisk: stats.exposure,
        coverScore: stats.cover,
        passable: stats.passable,
        occupantId: null,
      };
    })
  );
}

function generateDefaultGrid(): BlockZone[][] {
  return generateGridForZoneLayout();
}

/** Roles that generate income when placed on a block */
const INCOME_ROLES = new Set<string>(['dealer', 'chemist', 'runner']);

export function calculatePlacementIncome(placement: BlockPlacement, grid: BlockZone[][], incomeMultiplier = 1): number {
  const zone = grid[placement.y]?.[placement.x];
  if (!zone || !INCOME_ROLES.has(placement.role)) return 0;
  const base = zone.incomeModifier;
  const levelBonus = 1 + (placement.level - 1) * 0.12; // +12% per level
  // chemist and runner earn at 70% of dealer rate (indirect income)
  const roleMult = placement.role === 'dealer' ? 1.0 : 0.7;
  return Math.round(base * levelBonus * roleMult * incomeMultiplier);
}

const calcPlacementIncome = calculatePlacementIncome;

function mergeEncounterResultKeys(
  existing: readonly string[] | undefined,
  incoming: readonly string[] | undefined,
): string[] | undefined {
  const current = [...new Set(existing ?? [])];
  const hydrated = [...new Set(incoming ?? [])];
  const isOrderedSubset = (subset: readonly string[], full: readonly string[]) => {
    let cursor = 0;
    for (const key of full) {
      if (key === subset[cursor]) cursor += 1;
    }
    return cursor === subset.length;
  };
  const suffixPrefixOverlap = (left: readonly string[], right: readonly string[]) => {
    for (let size = Math.min(left.length, right.length); size > 0; size -= 1) {
      if (left.slice(-size).every((key, index) => key === right[index])) return size;
    }
    return 0;
  };
  let merged: string[];
  const hydrationExtendsCurrent = suffixPrefixOverlap(current, hydrated);
  const currentExtendsHydration = suffixPrefixOverlap(hydrated, current);
  if (hydrationExtendsCurrent > 0 && hydrationExtendsCurrent >= currentExtendsHydration) {
    merged = [...current, ...hydrated.slice(hydrationExtendsCurrent)];
  } else if (currentExtendsHydration > 0) {
    merged = [...hydrated, ...current.slice(currentExtendsHydration)];
  } else if (isOrderedSubset(current, hydrated)) {
    // The server/projection ledger extends what this client already knew.
    merged = hydrated;
  } else if (isOrderedSubset(hydrated, current)) {
    // The hydration payload is stale; keep the newer in-memory ordering.
    merged = current;
  } else {
    // With unrelated histories, preserve the running client's receipts at the
    // capped tail and prepend only incoming keys it does not already contain.
    const currentSet = new Set(current);
    merged = [...hydrated.filter((key) => !currentSet.has(key)), ...current];
  }
  merged = merged.slice(-24);
  return merged.length > 0 ? merged : undefined;
}

function placementStateKey(placements: readonly BlockPlacement[]): string {
  return JSON.stringify(placements
    .map((placement) => [
      placement.memberId,
      placement.x,
      placement.y,
      placement.role,
      placement.level,
      placement.health,
    ])
    .sort(([left], [right]) => {
      const leftId = String(left);
      const rightId = String(right);
      return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
    }));
}

type PlacementProjection = Pick<
  BlockData,
  'placements' | 'incomePerTick' | 'members' | 'liveRevision'
>;

interface PlacementSyncQueue {
  tail: Promise<void>;
  confirmed: PlacementProjection;
  latestOperation: number;
  protectEncounterProjection: boolean;
}

function copyPlacementProjection(block: BlockData): PlacementProjection {
  return {
    placements: block.placements.map((placement) => ({ ...placement })),
    incomePerTick: block.incomePerTick,
    members: block.members,
    liveRevision: block.liveRevision,
  };
}

function gridWithPlacementOccupants(
  grid: readonly (readonly BlockZone[])[],
  placements: readonly BlockPlacement[],
): BlockZone[][] {
  const occupants = new Map(
    placements.map((placement) => [`${placement.x}:${placement.y}`, placement.memberId]),
  );
  return grid.map((row) => row.map((zone) => ({
    ...zone,
    occupantId: occupants.get(`${zone.x}:${zone.y}`) ?? null,
  })));
}

function applyPlacementProjection(
  block: BlockData,
  projection: PlacementProjection,
): BlockData {
  const currentRevision = block.liveRevision;
  const projectedRevision = projection.liveRevision;
  const liveRevision = Number.isFinite(currentRevision) && Number.isFinite(projectedRevision)
    ? Math.max(currentRevision!, projectedRevision!)
    : Number.isFinite(currentRevision)
      ? currentRevision
      : projectedRevision;
  return {
    ...block,
    ...projection,
    ...(liveRevision !== undefined ? { liveRevision } : {}),
    // Reconcile occupants onto the latest hydrated board. A response from an
    // older request must never restore the grid object captured at enqueue.
    grid: gridWithPlacementOccupants(block.grid, projection.placements),
  };
}

const placementSyncQueues = new Map<string, PlacementSyncQueue>();
const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === '1';

/** Use only server-confirmed defenders while a replacement request is pending. */
export function getEncounterPlacements(block: BlockData): BlockPlacement[] {
  const pending = placementSyncQueues.get(block.id);
  if (!pending) return block.placements.map((placement) => ({ ...placement }));
  const currentByMember = new Map(
    block.placements.map((placement) => [placement.memberId, placement]),
  );
  return pending.confirmed.placements.map((placement) => ({
    ...placement,
    // Pending additions/moves use confirmed coordinates, while an encounter
    // injury is monotonic and must take effect immediately for crew fitness.
    health: Math.min(
      placement.health,
      currentByMember.get(placement.memberId)?.health ?? placement.health,
    ),
  }));
}

function enqueuePlacementSnapshot(
  blockId: string,
  previousBlock: BlockData,
  optimisticBlock: BlockData,
  getCurrentBlock: () => BlockData | undefined,
  applyProjection: (optimisticKey: string, projection: PlacementProjection) => void,
  protectEncounterProjection = false,
): void {
  // The seeded demo is intentionally backend-free and uses local persistence.
  // Its stable id prefix also keeps tests/previews safe when env replacement
  // is not available to the module runner.
  if (IS_DEMO_MODE || blockId.startsWith('demo-')) return;
  const optimisticKey = placementStateKey(optimisticBlock.placements);
  const requestedPlacements = optimisticBlock.placements.map((item) => ({ ...item }));
  let placementQueue = placementSyncQueues.get(blockId);
  if (!placementQueue) {
    placementQueue = {
      tail: Promise.resolve(),
      confirmed: copyPlacementProjection(previousBlock),
      latestOperation: 0,
      protectEncounterProjection: false,
    };
    placementSyncQueues.set(blockId, placementQueue);
  }
  const queue = placementQueue;
  if (protectEncounterProjection) queue.protectEncounterProjection = true;
  const operation = queue.latestOperation + 1;
  queue.latestOperation = operation;

  const syncPlacement = async () => {
    try {
      const { blocksApi } = await import('../services/api.service');
      const {
        apiPlacementsToBlockPlacements,
        placementsToApiPayload,
      } = await import('../utils/blockMappers');
      const result = await blocksApi.placeMembers(
        blockId,
        placementsToApiPayload(requestedPlacements),
      );
      const currentBlock = getCurrentBlock() ?? optimisticBlock;
      const serverGrid = currentBlock.grid.map((row) => row.map((zone) => ({
        ...zone,
        occupantId: null,
      })));
      const serverPlacements = apiPlacementsToBlockPlacements(
        result.placements,
        serverGrid,
        currentBlock.incomeMultiplier ?? 1,
      );
      queue.confirmed = {
        placements: serverPlacements,
        incomePerTick: result.incomePerTick ?? optimisticBlock.incomePerTick,
        members: serverPlacements.length,
        liveRevision: result.liveRevision ?? currentBlock.liveRevision,
      };
    } catch (err) {
      console.warn('[blockStore] place sync skipped:', err);
    }
    // Only the newest queued replacement may reconcile or roll back. This is
    // distinct from the placement-content key because two user actions can
    // intentionally submit identical snapshots.
    if (operation === queue.latestOperation) {
      applyProjection(optimisticKey, queue.confirmed);
    }
  };

  // Replace requests are destructive snapshots. Serialize them per block so
  // an older response cannot commit after a newer placement/remove action.
  const queuedSync = queue.tail.catch(() => undefined).then(syncPlacement);
  queue.tail = queuedSync;
  void queuedSync.finally(() => {
    if (
      placementSyncQueues.get(blockId) === queue
      && queue.tail === queuedSync
    ) {
      placementSyncQueues.delete(blockId);
    }
  });
}

// ─── Store ───────────────────────────────────────────────────

export const useBlockStore = create<BlockStore>()(
  persist(
    devtools(
      (set, get) => ({
        // ── State ──
        blocks: {},
        selectedBlockId: null,
        activeDriveBys: {},
        isPlacementMode: false,
        pendingPlacementMemberId: null,
        pendingPlacementMember: null,

        // ── Actions ──
        generateDefaultGrid,

        upsertBlock: (block) =>
          set((state) => {
            const existing = state.blocks[block.id];
            const mergedKeys = mergeEncounterResultKeys(
              existing?.appliedEncounterResultKeys,
              block.appliedEncounterResultKeys,
            );
            const incomingKeys = new Set(block.appliedEncounterResultKeys ?? []);
            const currentReceiptTail = existing?.appliedEncounterResultKeys?.at(-1);
            // A capped server ledger may legitimately omit old keys, so only
            // the running client's newest receipt determines staleness.
            const missesCurrentReceipt = Boolean(
              currentReceiptTail && !incomingKeys.has(currentReceiptTail),
            );
            const currentRevision = existing?.liveRevision;
            const incomingRevision = block.liveRevision;
            const hasCurrentRevision = Number.isFinite(currentRevision);
            const hasIncomingRevision = Number.isFinite(incomingRevision);
            const stalePlacementRevision = Boolean(
              existing
              && hasCurrentRevision
              && (!hasIncomingRevision || incomingRevision! < currentRevision!),
            );
            // Hydration is allowed to refresh the immutable board while a
            // replacement is pending, but cannot overwrite its optimistic
            // roster. Once the request lands, liveRevision rejects any late
            // older projection even after the in-memory queue is released.
            const preservePlacementProjection = Boolean(
              existing
              && (
                placementSyncQueues.has(block.id)
                || stalePlacementRevision
                || missesCurrentReceipt
              ),
            );
            const preserveEncounterProjection = Boolean(
              existing
              && currentReceiptTail
              && (
                missesCurrentReceipt
                || stalePlacementRevision
                || placementSyncQueues.get(block.id)?.protectEncounterProjection
              ),
            );
            const placements = preservePlacementProjection && existing
              ? existing.placements
              : block.placements;
            const liveRevision = hasCurrentRevision && hasIncomingRevision
              ? Math.max(currentRevision!, incomingRevision!)
              : hasCurrentRevision
                ? currentRevision
                : incomingRevision;
            return {
              blocks: {
                ...state.blocks,
                [block.id]: {
                  ...block,
                  ...(liveRevision !== undefined ? { liveRevision } : {}),
                  ...(preservePlacementProjection && existing ? {
                    placements,
                    incomePerTick: existing.incomePerTick,
                    members: existing.members,
                    grid: gridWithPlacementOccupants(block.grid, placements),
                  } : {}),
                  ...(preserveEncounterProjection && existing ? {
                    heat: existing.heat,
                    morale: existing.morale,
                    pendingIncome: existing.pendingIncome,
                  } : {}),
                  appliedEncounterResultKeys: mergedKeys,
                },
              },
            };
          }),

        selectBlock: (blockId) =>
          set({ selectedBlockId: blockId }),

        getBlock: (blockId) => get().blocks[blockId],

        placeMember: (blockId, placement) => {
          const previousBlock = get().blocks[blockId];
          if (!previousBlock) return;
          set((state) => {
            const block = state.blocks[blockId];
            if (!block) return state;

            // Remove any existing placement for this member
            const filtered = block.placements.filter(
              (p) => p.memberId !== placement.memberId
            );

            // Mark zone as occupied
            const newGrid = block.grid.map((row) =>
              row.map((zone) => {
                if (zone.x === placement.x && zone.y === placement.y) {
                  return { ...zone, occupantId: placement.memberId };
                }
                // Clear old occupation by this member
                if (zone.occupantId === placement.memberId) {
                  return { ...zone, occupantId: null };
                }
                return zone;
              })
            );

            // Recalculate income for this placement, scaled by the block's
            // DNA income multiplier (#80).
            const income = calcPlacementIncome(placement, newGrid, block.incomeMultiplier ?? 1);
            const finalPlacement = { ...placement, incomePerTick: income };

            const newPlacements = [...filtered, finalPlacement];
            const totalIncome = newPlacements.reduce((sum, p) => sum + p.incomePerTick, 0);

            return {
              blocks: {
                ...state.blocks,
                [blockId]: {
                  ...block,
                  grid: newGrid,
                  placements: newPlacements,
                  incomePerTick: totalIncome,
                  members: newPlacements.length,
                },
              },
            };
          });

          const optimisticBlock = get().blocks[blockId];
          if (!optimisticBlock) return;
          // Gate 0B — persist the full replacement through Flask and reconcile
          // its authoritative health/roster fields.
          enqueuePlacementSnapshot(
            blockId,
            previousBlock,
            optimisticBlock,
            () => get().blocks[blockId],
            (key, projection) => {
              set((state) => {
                const b = state.blocks[blockId];
                if (!b || placementStateKey(b.placements) !== key) return state;
                return {
                  blocks: {
                    ...state.blocks,
                    [blockId]: applyPlacementProjection(b, projection),
                  },
                };
              });
            },
          );
        },

        removeMemberFromBlock: (blockId, memberId) => {
          const previousBlock = get().blocks[blockId];
          if (!previousBlock) return;
          set((state) => {
            const block = state.blocks[blockId];
            if (!block) return state;

            const newGrid = block.grid.map((row) =>
              row.map((zone) =>
                zone.occupantId === memberId ? { ...zone, occupantId: null } : zone
              )
            );
            const newPlacements = block.placements.filter((p) => p.memberId !== memberId);
            const totalIncome = newPlacements.reduce((sum, p) => sum + p.incomePerTick, 0);

            return {
              blocks: {
                ...state.blocks,
                [blockId]: {
                  ...block,
                  grid: newGrid,
                  placements: newPlacements,
                  incomePerTick: totalIncome,
                  members: newPlacements.length,
                },
              },
            };
          });
          const optimisticBlock = get().blocks[blockId];
          if (!optimisticBlock) return;
          enqueuePlacementSnapshot(
            blockId,
            previousBlock,
            optimisticBlock,
            () => get().blocks[blockId],
            (key, projection) => {
              set((state) => {
                const b = state.blocks[blockId];
                if (!b || placementStateKey(b.placements) !== key) return state;
                return {
                  blocks: {
                    ...state.blocks,
                    [blockId]: applyPlacementProjection(b, projection),
                  },
                };
              });
            },
          );
        },

        moveMember: (blockId, memberId, newX, newY) => {
          const block = get().blocks[blockId];
          if (!block) return;
          const placement = block.placements.find((p) => p.memberId === memberId);
          if (!placement) return;
          const targetZone = block.grid[newY]?.[newX];
          if (!targetZone || !targetZone.passable || targetZone.occupantId) return;
          get().placeMember(blockId, { ...placement, x: newX, y: newY, zoneType: targetZone.zoneType });
        },

        setBlockViewMode: (blockId, mode) =>
          set((state) => {
            const block = state.blocks[blockId];
            if (!block) return state;
            return {
              blocks: { ...state.blocks, [blockId]: { ...block, viewMode: mode } },
            };
          }),

        startDriveBy: (event) =>
          set((state) => ({
            activeDriveBys: { ...state.activeDriveBys, [event.blockId]: event },
          })),

        recordShot: (blockId, shot, isDefender) =>
          set((state) => {
            const event = state.activeDriveBys[blockId];
            if (!event) return state;
            return {
              activeDriveBys: {
                ...state.activeDriveBys,
                [blockId]: {
                  ...event,
                  shots: isDefender
                    ? event.shots
                    : [...event.shots, shot],
                  defenderShots: isDefender
                    ? [...event.defenderShots, shot]
                    : event.defenderShots,
                },
              },
            };
          }),

        resolveDriveBy: (blockId, outcome) =>
          set((state) => {
            const event = state.activeDriveBys[blockId];
            if (!event) return state;

            // Apply casualties to block placements
            const block = state.blocks[blockId];
            let updatedBlock = block;
            if (block && event.casualties.length > 0) {
              const newPlacements = block.placements.map((p) => {
                if (event.casualties.includes(p.memberId)) {
                  return { ...p, health: 0 };
                }
                return p;
              });
              updatedBlock = { ...block, placements: newPlacements };
            }

            const { [blockId]: _removed, ...remainingDriveBys } = state.activeDriveBys;
            return {
              activeDriveBys: {
                ...remainingDriveBys,
                [blockId]: { ...event, phase: 'resolved', outcome, resolvedAt: Date.now() },
              },
              blocks: block ? { ...state.blocks, [blockId]: updatedBlock } : state.blocks,
            };
          }),

        applyEncounterResult: (blockId, result) => {
          const previousBlock = get().blocks[blockId];
          if (!previousBlock) return;
          const previousKey = placementStateKey(previousBlock.placements);
          // This is the exact roster used by prepareEncounter. If a removal is
          // still pending, a downed confirmed defender must be restored into
          // the next serialized snapshot instead of disappearing mid-fight.
          const encounterPlacements = getEncounterPlacements(previousBlock);
          set((state) => {
            const block = state.blocks[blockId];
            if (!block) return state;
            const applied = block.appliedEncounterResultKeys ?? [];
            const wasApplied = applied.includes(result.idempotencyKey);
            const downed = new Set(result.crewDown);
            const updatedPlacements = block.placements.map((placement) =>
              downed.has(placement.memberId) ? { ...placement, health: 0 } : placement
            );
            const currentIds = new Set(updatedPlacements.map((placement) => placement.memberId));
            const restoredDownedPlacements = encounterPlacements
              .filter((placement) => downed.has(placement.memberId) && !currentIds.has(placement.memberId))
              .map((placement) => ({ ...placement, health: 0 }));
            const placements = [...updatedPlacements, ...restoredDownedPlacements];
            if (wasApplied && placementStateKey(placements) === placementStateKey(block.placements)) {
              return state;
            }
            return {
              blocks: {
                ...state.blocks,
                [blockId]: {
                  ...block,
                  placements,
                  heat: wasApplied ? block.heat : Math.max(0, Math.min(5, block.heat + result.heatDelta)),
                  morale: wasApplied ? block.morale : Math.max(0, Math.min(100, block.morale + result.moraleDelta)),
                  pendingIncome: wasApplied
                    ? block.pendingIncome
                    : Math.max(0, block.pendingIncome + result.pendingIncomeDelta),
                  appliedEncounterResultKeys: wasApplied
                    ? applied
                    : [...applied, result.idempotencyKey].slice(-24),
                },
              },
            };
          });

          const optimisticBlock = get().blocks[blockId];
          if (!optimisticBlock || placementStateKey(optimisticBlock.placements) === previousKey) return;
          // Persist monotonic crew-down health through the same serialized,
          // owner-checked Flask replacement path used by placement itself.
          enqueuePlacementSnapshot(
            blockId,
            previousBlock,
            optimisticBlock,
            () => get().blocks[blockId],
            (key, projection) => {
              set((state) => {
                const block = state.blocks[blockId];
                if (!block || placementStateKey(block.placements) !== key) return state;
                return {
                  blocks: {
                    ...state.blocks,
                    [blockId]: applyPlacementProjection(block, projection),
                  },
                };
              });
            },
            true,
          );
        },

        collectIncome: (blockId) => {
          const block = get().blocks[blockId];
          if (!block || block.pendingIncome <= 0) return 0;
          const amount = block.pendingIncome;
          set((state) => ({
            blocks: {
              ...state.blocks,
              [blockId]: {
                ...block,
                pendingIncome: 0,
                lastCollectedAt: new Date().toISOString(),
              },
            },
          }));
          return amount;
        },

        tickIncome: () =>
          set((state) => {
            const updatedBlocks = { ...state.blocks };
            Object.keys(updatedBlocks).forEach((id) => {
              const block = updatedBlocks[id];
              if (block.owner === 'player' && block.incomePerTick > 0) {
                updatedBlocks[id] = {
                  ...block,
                  pendingIncome: block.pendingIncome + block.incomePerTick,
                };
              }
            });
            return { blocks: updatedBlocks };
          }),

        setPlacementMode: (active, member) =>
          set({
            isPlacementMode: active,
            pendingPlacementMemberId: active ? member?.memberId ?? null : null,
            pendingPlacementMember: active ? member ?? null : null,
          }),

        getResolvedDriveBys: () => {
          const events = Object.values(get().activeDriveBys);
          return events
            .filter((e) => e.phase === 'resolved' && e.resolvedAt != null)
            .sort((a, b) => (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0));
        },
      }),
      { name: 'block-store' }
    ),
    {
      name: 'dealt-slide-blocks',
      partialize: (state) => ({
        blocks: state.blocks,
        selectedBlockId: state.selectedBlockId,
      }),
    }
  )
);

export default useBlockStore;
