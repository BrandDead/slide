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

function generateDefaultGrid(): BlockZone[][] {
  return ZONE_LAYOUT.map((row, y) =>
    row.map((zoneType, x) => {
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

/** Roles that generate income when placed on a block */
const INCOME_ROLES = new Set<string>(['dealer', 'chemist', 'runner']);

function calcPlacementIncome(placement: BlockPlacement, grid: BlockZone[][]): number {
  const zone = grid[placement.y]?.[placement.x];
  if (!zone || !INCOME_ROLES.has(placement.role)) return 0;
  const base = zone.incomeModifier;
  const levelBonus = 1 + (placement.level - 1) * 0.12; // +12% per level
  // chemist and runner earn at 70% of dealer rate (indirect income)
  const roleMult = placement.role === 'dealer' ? 1.0 : 0.7;
  return Math.round(base * levelBonus * roleMult);
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
          set((state) => ({
            blocks: { ...state.blocks, [block.id]: block },
          })),

        selectBlock: (blockId) =>
          set({ selectedBlockId: blockId }),

        getBlock: (blockId) => get().blocks[blockId],

        placeMember: (blockId, placement) => {
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

            // Recalculate income for this placement
            const income = calcPlacementIncome(placement, newGrid);
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

          // Gate 0B — persist placements to Flask (best-effort)
          void (async () => {
            try {
              const { blocksApi } = await import('../services/api.service');
              const { placementsToApiPayload } = await import('../utils/blockMappers');
              const latest = get().blocks[blockId];
              if (!latest) return;
              const result = await blocksApi.placeMembers(
                blockId,
                placementsToApiPayload(latest.placements),
              );
              set((state) => {
                const b = state.blocks[blockId];
                if (!b) return state;
                return {
                  blocks: {
                    ...state.blocks,
                    [blockId]: {
                      ...b,
                      incomePerTick: result.incomePerTick ?? b.incomePerTick,
                    },
                  },
                };
              });
            } catch (err) {
              console.warn('[blockStore] place sync skipped:', err);
            }
          })();
        },

        removeMemberFromBlock: (blockId, memberId) =>
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
          }),

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

        applyEncounterResult: (blockId, result) =>
          set((state) => {
            const block = state.blocks[blockId];
            if (!block) return state;
            const applied = block.appliedEncounterResultKeys ?? [];
            if (applied.includes(result.idempotencyKey)) return state;
            const downed = new Set(result.crewDown);
            const placements = block.placements.map((placement) =>
              downed.has(placement.memberId) ? { ...placement, health: 0 } : placement
            );
            return {
              blocks: {
                ...state.blocks,
                [blockId]: {
                  ...block,
                  placements,
                  heat: Math.max(0, Math.min(5, block.heat + result.heatDelta)),
                  morale: Math.max(0, Math.min(100, block.morale + result.moraleDelta)),
                  pendingIncome: Math.max(0, block.pendingIncome + result.pendingIncomeDelta),
                  appliedEncounterResultKeys: [...applied, result.idempotencyKey].slice(-24),
                },
              },
            };
          }),

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
