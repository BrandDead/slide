/**
 * useDrugInventory.ts
 * ---------------------------------------------------------------------------
 * The connective tissue between AlchemyLab, BlockModeView, and DealtMode.
 *
 * Data flow:
 *   AlchemyLab → addDrug() → inventory
 *   DrugAssignmentPanel → assignDrug(dealerId, drugId) → assignments
 *   BlockModeView tick → consumeAssignedDrugs() → quantity decreases
 *   BlockModeView income → getDealerStats() → multiplied income + heat
 *   DealtMode → heatModifiers.ts uses getBlockDrugTier() + external heat
 *
 * Zone restriction:
 *   Only dealers in 'street' or 'mid' zones can be assigned drugs.
 *   Alley dealers are stuck at base income — this kills the turtle exploit
 *   by making the drug multiplier (the primary income escalator) unavailable
 *   to anyone hiding in the back rows.
 * ---------------------------------------------------------------------------
 */

import { create } from 'zustand';
import type { BlockZoneType } from '../types/block.types';

// ── Types ───────────────────────────────────────────────────────────────────

export type DrugTier = 'street' | 'pure' | 'exotic' | 'legendary';

export type BlockZone = 'street' | 'mid' | 'alley';

export interface CraftedDrug {
  id: string;
  name: string;
  tier: DrugTier;
  /** 0–100, affects DealtMode customer satisfaction and payout. */
  quality: number;
  /** Current supply. Consumed per-tick by assigned dealers. */
  quantity: number;
  /** ISO timestamp of creation (for save/load, sorting). */
  craftedAt: number;
  /** Optional status effect tags for DealtMode flavor. */
  effects: string[];
}

/** Minimal dealer shape the store needs from BlockModeView. */
export interface BlockDealer {
  id: string;
  name: string;
  gridX: number;
  gridY: number;
  zone: BlockZone;
  baseIncome: number;
  baseHeat: number;
}

export interface DealerStats {
  income: number;
  heat: number;
  drugName: string | null;
  drugTier: DrugTier | null;
  drugQuality: number | null;
  supplyRemaining: number | null;
  /** Estimated ticks before the drug runs out (null if unassigned). */
  ticksRemaining: number | null;
}

// ── Tier configuration ─────────────────────────────────────────────────────

export interface TierConfig {
  label: string;
  incomeMultiplier: number;
  heatMultiplier: number;
  /** Higher = better customers in DealtMode. */
  dealtModeQuality: number;
  /** Units consumed per tick per assigned dealer. */
  consumptionRate: number;
  /** Tailwind color token for UI. */
  colorClass: string;
  badgeClass: string;
}

export const TIER_CONFIG: Record<DrugTier, TierConfig> = {
  street: {
    label: 'Street',
    incomeMultiplier: 1.3,
    heatMultiplier: 1.0,
    dealtModeQuality: 1,
    consumptionRate: 0.3,
    colorClass: 'text-zinc-400',
    badgeClass: 'bg-zinc-700/40 text-zinc-400 border-zinc-600/30',
  },
  pure: {
    label: 'Pure',
    incomeMultiplier: 2.0,
    heatMultiplier: 1.6,
    dealtModeQuality: 2,
    consumptionRate: 0.4,
    colorClass: 'text-sky-400',
    badgeClass: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  },
  exotic: {
    label: 'Exotic',
    incomeMultiplier: 3.0,
    heatMultiplier: 2.4,
    dealtModeQuality: 3,
    consumptionRate: 0.5,
    colorClass: 'text-purple-400',
    badgeClass: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  },
  legendary: {
    label: 'Legendary',
    incomeMultiplier: 5.0,
    heatMultiplier: 4.0,
    dealtModeQuality: 4,
    consumptionRate: 0.7,
    colorClass: 'text-amber-400',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
};

export function getTierConfig(tier: DrugTier): TierConfig {
  return TIER_CONFIG[tier];
}

// ── Zone rules ────────────────────────────────────────────────────────────

/** Map block grid zone types to drug-assignment zones. */
export function blockZoneToDrugZone(zone: BlockZoneType): BlockZone {
  switch (zone) {
    case 'street':
    case 'curb':
      return 'street';
    case 'sidewalk':
    case 'storefront':
      return 'mid';
    case 'alley':
    case 'parking':
    case 'building':
    case 'rooftop':
      return 'alley';
  }
}

/**
 * Only street and mid zones can have drug assignments.
 * This is the anti-turtle mechanism: the income multiplier from drugs
 * (the primary way to scale revenue) is simply unavailable in the alley.
 */
export function canZoneAssignDrugs(zone: BlockZone): boolean {
  return zone !== 'alley';
}

// ── Store ──────────────────────────────────────────────────────────────────

interface DrugInventoryState {
  inventory: Record<string, CraftedDrug>;
  /** dealerId → drugId */
  assignments: Record<string, string>;

  addDrug: (drug: Omit<CraftedDrug, 'id'> & { id?: string }) => string;
  addDrugs: (drugs: Array<Omit<CraftedDrug, 'id'> & { id?: string }>) => void;
  removeDrug: (drugId: string) => void;
  restockDrug: (drugId: string, amount: number) => void;

  assignDrug: (dealerId: string, dealerZone: BlockZone, drugId: string) => boolean;
  unassignDrug: (dealerId: string) => void;
  unassignAllForDrug: (drugId: string) => void;

  consumeAssignedDrugs: (ticks: number) => ConsumedDrugsResult;
  getDealerDrug: (dealerId: string) => CraftedDrug | null;
  getDealerStats: (dealerId: string, baseIncome: number, baseHeat: number) => DealerStats;
  getBlockDrugTier: () => DrugTier | null;
  getTotalIncome: (dealers: BlockDealer[]) => number;
  getTotalHeat: (dealers: BlockDealer[]) => number;

  getInventoryList: () => CraftedDrug[];
  getAssignedDealerIds: (drugId: string) => string[];
  hasDrugs: () => boolean;
}

export interface ConsumedDrugsResult {
  /** Drugs that ran out this tick (auto-unassigned). */
  depleted: string[];
  /** Total units consumed this tick. */
  totalConsumed: number;
}

export const useDrugInventory = create<DrugInventoryState>((set, get) => ({
  inventory: {},
  assignments: {},

  addDrug: (drug) => {
    const id = drug.id ?? `drug_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const fullDrug: CraftedDrug = {
      id,
      name: drug.name,
      tier: drug.tier,
      quality: drug.quality,
      quantity: drug.quantity,
      craftedAt: drug.craftedAt,
      effects: drug.effects,
    };

    set((state) => ({
      inventory: { ...state.inventory, [id]: fullDrug },
    }));

    return id;
  },

  addDrugs: (drugs) => {
    const newEntries: Record<string, CraftedDrug> = {};
    for (const drug of drugs) {
      const id = drug.id ?? `drug_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      newEntries[id] = {
        id,
        name: drug.name,
        tier: drug.tier,
        quality: drug.quality,
        quantity: drug.quantity,
        craftedAt: drug.craftedAt,
        effects: drug.effects,
      };
    }
    set((state) => ({
      inventory: { ...state.inventory, ...newEntries },
    }));
  },

  removeDrug: (drugId) => {
    set((state) => {
      const newInventory = { ...state.inventory };
      delete newInventory[drugId];

      const newAssignments: Record<string, string> = {};
      for (const [dealerId, dId] of Object.entries(state.assignments)) {
        if (dId !== drugId) {
          newAssignments[dealerId] = dId;
        }
      }

      return { inventory: newInventory, assignments: newAssignments };
    });
  },

  restockDrug: (drugId, amount) => {
    set((state) => {
      const drug = state.inventory[drugId];
      if (!drug) return state;
      return {
        inventory: {
          ...state.inventory,
          [drugId]: { ...drug, quantity: drug.quantity + amount },
        },
      };
    });
  },

  assignDrug: (dealerId, dealerZone, drugId) => {
    if (!canZoneAssignDrugs(dealerZone)) {
      return false;
    }

    const drug = get().inventory[drugId];
    if (!drug || drug.quantity <= 0) {
      return false;
    }

    set((state) => ({
      assignments: { ...state.assignments, [dealerId]: drugId },
    }));

    return true;
  },

  unassignDrug: (dealerId) => {
    set((state) => {
      const newAssignments = { ...state.assignments };
      delete newAssignments[dealerId];
      return { assignments: newAssignments };
    });
  },

  unassignAllForDrug: (drugId) => {
    set((state) => {
      const newAssignments: Record<string, string> = {};
      for (const [dealerId, dId] of Object.entries(state.assignments)) {
        if (dId !== drugId) {
          newAssignments[dealerId] = dId;
        }
      }
      return { assignments: newAssignments };
    });
  },

  consumeAssignedDrugs: (ticks) => {
    const state = get();
    const assignments = state.assignments;
    const inventory = state.inventory;

    const usage: Record<string, number> = {};
    for (const drugId of Object.values(assignments)) {
      usage[drugId] = (usage[drugId] ?? 0) + 1;
    }

    const depleted: string[] = [];
    let totalConsumed = 0;

    const newInventory: Record<string, CraftedDrug> = { ...inventory };

    for (const [drugId, dealerCount] of Object.entries(usage)) {
      const drug = newInventory[drugId];
      if (!drug) {
        depleted.push(drugId);
        continue;
      }

      const tierCfg = TIER_CONFIG[drug.tier];
      const consumed = tierCfg.consumptionRate * dealerCount * ticks;
      totalConsumed += consumed;

      const newQty = drug.quantity - consumed;

      if (newQty <= 0) {
        depleted.push(drugId);
        delete newInventory[drugId];
      } else {
        newInventory[drugId] = { ...drug, quantity: newQty };
      }
    }

    let newAssignments = assignments;
    if (depleted.length > 0) {
      newAssignments = {};
      for (const [dealerId, drugId] of Object.entries(assignments)) {
        if (!depleted.includes(drugId)) {
          newAssignments[dealerId] = drugId;
        }
      }
    }

    if (depleted.length > 0 || totalConsumed > 0) {
      set({ inventory: newInventory, assignments: newAssignments });
    }

    return { depleted, totalConsumed };
  },

  getDealerDrug: (dealerId) => {
    const state = get();
    const drugId = state.assignments[dealerId];
    if (!drugId) return null;
    return state.inventory[drugId] ?? null;
  },

  getDealerStats: (dealerId, baseIncome, baseHeat) => {
    const drug = get().getDealerDrug(dealerId);

    if (!drug) {
      return {
        income: baseIncome,
        heat: baseHeat,
        drugName: null,
        drugTier: null,
        drugQuality: null,
        supplyRemaining: null,
        ticksRemaining: null,
      };
    }

    const cfg = TIER_CONFIG[drug.tier];
    const qualityMod = 0.5 + (drug.quality / 100) * 0.5;

    const income = baseIncome * cfg.incomeMultiplier * qualityMod;
    const heat = baseHeat * cfg.heatMultiplier * qualityMod;
    const soloTicks = drug.quantity / cfg.consumptionRate;

    return {
      income,
      heat,
      drugName: drug.name,
      drugTier: drug.tier,
      drugQuality: drug.quality,
      supplyRemaining: drug.quantity,
      ticksRemaining: Math.floor(soloTicks),
    };
  },

  getBlockDrugTier: () => {
    const state = get();
    let highest: DrugTier | null = null;
    const tierOrder: DrugTier[] = ['street', 'pure', 'exotic', 'legendary'];

    for (const drugId of Object.values(state.assignments)) {
      const drug = state.inventory[drugId];
      if (!drug) continue;
      if (highest === null) {
        highest = drug.tier;
      } else if (tierOrder.indexOf(drug.tier) > tierOrder.indexOf(highest)) {
        highest = drug.tier;
      }
    }

    return highest;
  },

  getTotalIncome: (dealers) => {
    let total = 0;
    for (const dealer of dealers) {
      const stats = get().getDealerStats(dealer.id, dealer.baseIncome, dealer.baseHeat);
      total += stats.income;
    }
    return total;
  },

  getTotalHeat: (dealers) => {
    let total = 0;
    for (const dealer of dealers) {
      const stats = get().getDealerStats(dealer.id, dealer.baseIncome, dealer.baseHeat);
      total += stats.heat;
    }
    return total;
  },

  getInventoryList: () => {
    return Object.values(get().inventory).sort((a, b) => {
      const tierOrder: DrugTier[] = ['street', 'pure', 'exotic', 'legendary'];
      const tierDiff = tierOrder.indexOf(b.tier) - tierOrder.indexOf(a.tier);
      if (tierDiff !== 0) return tierDiff;
      return b.quality - a.quality;
    });
  },

  getAssignedDealerIds: (drugId) => {
    const assignments = get().assignments;
    return Object.entries(assignments)
      .filter(([, dId]) => dId === drugId)
      .map(([dealerId]) => dealerId);
  },

  hasDrugs: () => Object.keys(get().inventory).length > 0,
}));

export default useDrugInventory;
