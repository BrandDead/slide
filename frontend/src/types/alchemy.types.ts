// ============================================================
// alchemy.types.ts - Types for the COOK LAB (Alchemy) drug crafting system
// Little Alchemy-style combining mechanics
// ============================================================

// ============ BASE ELEMENTS ============
export type BaseElement =
  | 'baking_soda'
  | 'acetone'
  | 'pseudoephedrine'
  | 'lithium'
  | 'iodine'
  | 'red_phosphorus'
  | 'ether'
  | 'coca_leaf'
  | 'poppy'
  | 'cannabis_plant'
  | 'ergot_fungus'
  | 'psilocybin_mushroom'
  | 'codeine_syrup'
  | 'jolly_rancher'
  | 'sprite'
  | 'mdma_precursor'
  | 'lye'
  | 'ammonia'
  | 'heat'
  | 'water';

// ============ CRAFTED DRUGS ============
export type CraftedDrug =
  | 'weed'
  | 'hash'
  | 'edibles'
  | 'coke'
  | 'crack'
  | 'freebase'
  | 'meth'
  | 'crystal_meth'
  | 'blue_sky'       // Super drug - very potent
  | 'heroin'
  | 'black_tar'
  | 'china_white'    // Super drug - OD risk
  | 'lean'
  | 'double_cup'
  | 'pills'
  | 'lsd'
  | 'shrooms'
  | 'molly'
  | 'pure_mdma';

// ============ RECIPE ============
export interface AlchemyRecipe {
  id: string;
  name: string;
  description: string;
  ingredients: AlchemyIngredient[];
  result: CraftedDrug;
  resultTier: 1 | 2 | 3 | 4 | 5;
  baseSuccessRate: number;       // 0-100
  purityRange: [number, number]; // min-max purity %
  potencyRange: [number, number];
  craftTime: number;             // seconds
  discovered: boolean;
  heatGenerated: number;         // How much heat crafting adds
  odRisk: number;                // 0-100, chance of customer OD
}

export interface AlchemyIngredient {
  element: BaseElement | CraftedDrug;
  amount: number;
}

// ============ CRAFTING SESSION ============
export interface CraftingSession {
  id: string;
  recipeId: string;
  chemistId?: string;           // Gang member doing the cooking
  chemistSkillBonus: number;    // 0-50 bonus to success rate
  startTime: number;
  endTime: number;
  status: 'in_progress' | 'success' | 'failed' | 'exploded';
  result?: CraftingResult;
}

export interface CraftingResult {
  drug: CraftedDrug;
  quantity: number;
  purity: number;
  potency: number;
  tier: number;
  isSuperDrug: boolean;
  // Super drug effects
  odRisk: number;              // Higher purity = higher OD risk
  heatMultiplier: number;      // Super drugs attract more heat
  priceMultiplier: number;     // But they sell for much more
  customerKillChance: number;  // Chance of killing a customer (OD)
}

// ============ ELEMENT DISCOVERY ============
export interface ElementDiscovery {
  element: BaseElement | CraftedDrug;
  discoveredAt: number;        // timestamp
  discoveredBy: string;        // player ID
  timesUsed: number;
}

// ============ SUPER DRUG EFFECTS ============
/**
 * Super drugs have extreme effects:
 * - blue_sky: 5x price, 40% OD risk, massive heat
 * - china_white: 8x price, 70% OD risk, cops come fast
 * - pure_mdma: 3x price, 20% OD risk, moderate heat
 *
 * When customers OD:
 * - Heat spikes by 20-40 points
 * - Unexpected cop raid chance increases
 * - Raids confiscate ALL product + weapons
 * - Player must pay bail ($5K-$50K) or lose member
 * - Unpaid bail = morale drop for entire gang
 */
export interface SuperDrugEffect {
  drug: CraftedDrug;
  priceMultiplier: number;
  odRisk: number;
  heatSpike: number;
  raidChanceIncrease: number;
  customerDeathMessage: string;
}

export const SUPER_DRUG_EFFECTS: Record<string, SuperDrugEffect> = {
  blue_sky: {
    drug: 'blue_sky',
    priceMultiplier: 5.0,
    odRisk: 0.40,
    heatSpike: 30,
    raidChanceIncrease: 0.25,
    customerDeathMessage: 'Customer found dead. Blue Sky too pure. Heat is rising fast.',
  },
  china_white: {
    drug: 'china_white',
    priceMultiplier: 8.0,
    odRisk: 0.70,
    heatSpike: 40,
    raidChanceIncrease: 0.40,
    customerDeathMessage: 'Multiple ODs reported. Feds are watching. Lay low.',
  },
  pure_mdma: {
    drug: 'pure_mdma',
    priceMultiplier: 3.0,
    odRisk: 0.20,
    heatSpike: 15,
    raidChanceIncrease: 0.10,
    customerDeathMessage: 'Party turned fatal. One dead at the club. Stay quiet.',
  },
};

// ============ ALCHEMY STORE STATE ============
export interface AlchemyState {
  discoveredElements: ElementDiscovery[];
  discoveredRecipes: AlchemyRecipe[];
  activeCraftingSessions: CraftingSession[];
  selectedElements: (BaseElement | CraftedDrug)[];
  craftingQueue: CraftingSession[];
  totalCrafted: number;
  totalFailed: number;
  totalExploded: number;
}
