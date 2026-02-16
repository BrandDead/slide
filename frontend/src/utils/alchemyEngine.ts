// ============================================================
// alchemyEngine.ts - Drug crafting engine (Little Alchemy style)
// Players combine base elements to discover and craft drugs
// ============================================================

import type {
  BaseElement,
  CraftedDrug,
  AlchemyRecipe,
  CraftingSession,
  CraftingResult,
  AlchemyIngredient,
} from '../types/alchemy.types';

// ============ RECIPE DATABASE ============
// All possible recipes. Players must discover them by experimenting.

export const ALL_RECIPES: AlchemyRecipe[] = [
  // Tier 1 - Basic drugs from raw elements
  {
    id: 'recipe_weed',
    name: 'Street Weed',
    description: 'Basic cannabis. Low risk, low reward.',
    ingredients: [{ element: 'cannabis_plant', amount: 2 }],
    result: 'weed',
    resultTier: 1,
    baseSuccessRate: 95,
    purityRange: [40, 70],
    potencyRange: [30, 60],
    craftTime: 5,
    discovered: true, // Starter recipe
    heatGenerated: 1,
    odRisk: 0,
  },
  {
    id: 'recipe_shrooms',
    name: 'Magic Mushrooms',
    description: 'Dried psilocybin mushrooms.',
    ingredients: [{ element: 'psilocybin_mushroom', amount: 3 }],
    result: 'shrooms',
    resultTier: 1,
    baseSuccessRate: 90,
    purityRange: [50, 80],
    potencyRange: [40, 70],
    craftTime: 10,
    discovered: true,
    heatGenerated: 2,
    odRisk: 1,
  },
  {
    id: 'recipe_lean',
    name: 'Lean (Purple Drank)',
    description: 'Codeine syrup mixed with Sprite and Jolly Ranchers.',
    ingredients: [
      { element: 'codeine_syrup', amount: 2 },
      { element: 'sprite', amount: 1 },
      { element: 'jolly_rancher', amount: 1 },
    ],
    result: 'lean',
    resultTier: 1,
    baseSuccessRate: 98,
    purityRange: [60, 90],
    potencyRange: [30, 50],
    craftTime: 3,
    discovered: true,
    heatGenerated: 1,
    odRisk: 5,
  },

  // Tier 2 - Processed drugs
  {
    id: 'recipe_coke',
    name: 'Cocaine',
    description: 'Processed coca leaf into powder cocaine.',
    ingredients: [
      { element: 'coca_leaf', amount: 5 },
      { element: 'acetone', amount: 1 },
      { element: 'baking_soda', amount: 1 },
    ],
    result: 'coke',
    resultTier: 2,
    baseSuccessRate: 75,
    purityRange: [30, 60],
    potencyRange: [50, 80],
    craftTime: 30,
    discovered: false,
    heatGenerated: 5,
    odRisk: 8,
  },
  {
    id: 'recipe_hash',
    name: 'Hashish',
    description: 'Concentrated cannabis resin.',
    ingredients: [
      { element: 'cannabis_plant', amount: 5 },
      { element: 'heat', amount: 1 },
    ],
    result: 'hash',
    resultTier: 2,
    baseSuccessRate: 85,
    purityRange: [50, 80],
    potencyRange: [60, 85],
    craftTime: 15,
    discovered: false,
    heatGenerated: 2,
    odRisk: 0,
  },
  {
    id: 'recipe_pills',
    name: 'Street Pills',
    description: 'Pressed pills from various precursors.',
    ingredients: [
      { element: 'pseudoephedrine', amount: 2 },
      { element: 'baking_soda', amount: 1 },
    ],
    result: 'pills',
    resultTier: 2,
    baseSuccessRate: 80,
    purityRange: [20, 50],
    potencyRange: [40, 70],
    craftTime: 20,
    discovered: false,
    heatGenerated: 4,
    odRisk: 12,
  },
  {
    id: 'recipe_heroin',
    name: 'Heroin',
    description: 'Processed opium from poppies.',
    ingredients: [
      { element: 'poppy', amount: 5 },
      { element: 'acetone', amount: 1 },
      { element: 'water', amount: 1 },
    ],
    result: 'heroin',
    resultTier: 2,
    baseSuccessRate: 65,
    purityRange: [20, 50],
    potencyRange: [60, 90],
    craftTime: 45,
    discovered: false,
    heatGenerated: 8,
    odRisk: 20,
  },
  {
    id: 'recipe_molly',
    name: 'Molly (MDMA)',
    description: 'Synthesized MDMA from precursors.',
    ingredients: [
      { element: 'mdma_precursor', amount: 3 },
      { element: 'acetone', amount: 1 },
      { element: 'heat', amount: 1 },
    ],
    result: 'molly',
    resultTier: 2,
    baseSuccessRate: 70,
    purityRange: [30, 60],
    potencyRange: [50, 80],
    craftTime: 35,
    discovered: false,
    heatGenerated: 5,
    odRisk: 10,
  },

  // Tier 3 - Advanced drugs (require tier 2 as ingredients)
  {
    id: 'recipe_crack',
    name: 'Crack Cocaine',
    description: 'Freebase cocaine. Highly addictive.',
    ingredients: [
      { element: 'coke' as BaseElement, amount: 2 },
      { element: 'baking_soda', amount: 2 },
      { element: 'water', amount: 1 },
      { element: 'heat', amount: 1 },
    ],
    result: 'crack',
    resultTier: 3,
    baseSuccessRate: 60,
    purityRange: [40, 70],
    potencyRange: [70, 95],
    craftTime: 20,
    discovered: false,
    heatGenerated: 10,
    odRisk: 25,
  },
  {
    id: 'recipe_meth',
    name: 'Methamphetamine',
    description: 'Synthesized crystal meth.',
    ingredients: [
      { element: 'pseudoephedrine', amount: 3 },
      { element: 'red_phosphorus', amount: 2 },
      { element: 'iodine', amount: 1 },
      { element: 'heat', amount: 1 },
    ],
    result: 'meth',
    resultTier: 3,
    baseSuccessRate: 55,
    purityRange: [30, 60],
    potencyRange: [70, 90],
    craftTime: 60,
    discovered: false,
    heatGenerated: 12,
    odRisk: 18,
  },
  {
    id: 'recipe_lsd',
    name: 'LSD',
    description: 'Synthesized lysergic acid diethylamide.',
    ingredients: [
      { element: 'ergot_fungus', amount: 3 },
      { element: 'ether', amount: 2 },
      { element: 'ammonia', amount: 1 },
    ],
    result: 'lsd',
    resultTier: 3,
    baseSuccessRate: 50,
    purityRange: [40, 80],
    potencyRange: [80, 100],
    craftTime: 90,
    discovered: false,
    heatGenerated: 6,
    odRisk: 5,
  },
  {
    id: 'recipe_double_cup',
    name: 'Double Cup',
    description: 'Extra-strength lean with added opioids.',
    ingredients: [
      { element: 'lean' as BaseElement, amount: 2 },
      { element: 'heroin' as BaseElement, amount: 1 },
    ],
    result: 'double_cup',
    resultTier: 3,
    baseSuccessRate: 80,
    purityRange: [50, 80],
    potencyRange: [60, 85],
    craftTime: 10,
    discovered: false,
    heatGenerated: 7,
    odRisk: 30,
  },
  {
    id: 'recipe_edibles',
    name: 'Edibles',
    description: 'Cannabis-infused food products.',
    ingredients: [
      { element: 'hash' as BaseElement, amount: 2 },
      { element: 'heat', amount: 1 },
    ],
    result: 'edibles',
    resultTier: 3,
    baseSuccessRate: 90,
    purityRange: [60, 90],
    potencyRange: [50, 80],
    craftTime: 30,
    discovered: false,
    heatGenerated: 1,
    odRisk: 0,
  },

  // Tier 4 - Super drugs (extremely potent, high risk)
  {
    id: 'recipe_crystal_meth',
    name: 'Crystal Meth (99% Pure)',
    description: 'Near-perfect crystal methamphetamine.',
    ingredients: [
      { element: 'meth' as BaseElement, amount: 3 },
      { element: 'lithium', amount: 2 },
      { element: 'ammonia', amount: 2 },
      { element: 'heat', amount: 1 },
    ],
    result: 'crystal_meth',
    resultTier: 4,
    baseSuccessRate: 35,
    purityRange: [85, 99],
    potencyRange: [90, 100],
    craftTime: 120,
    discovered: false,
    heatGenerated: 20,
    odRisk: 30,
  },
  {
    id: 'recipe_black_tar',
    name: 'Black Tar Heroin',
    description: 'Concentrated black tar. Extremely dangerous.',
    ingredients: [
      { element: 'heroin' as BaseElement, amount: 3 },
      { element: 'lye', amount: 1 },
      { element: 'heat', amount: 1 },
    ],
    result: 'black_tar',
    resultTier: 4,
    baseSuccessRate: 40,
    purityRange: [60, 85],
    potencyRange: [85, 100],
    craftTime: 90,
    discovered: false,
    heatGenerated: 18,
    odRisk: 45,
  },

  // Tier 5 - Legendary super drugs
  {
    id: 'recipe_blue_sky',
    name: 'Blue Sky',
    description: 'The purest meth ever made. Legendary.',
    ingredients: [
      { element: 'crystal_meth' as BaseElement, amount: 2 },
      { element: 'lithium', amount: 3 },
      { element: 'ether', amount: 2 },
    ],
    result: 'blue_sky',
    resultTier: 5,
    baseSuccessRate: 15,
    purityRange: [99, 100],
    potencyRange: [99, 100],
    craftTime: 240,
    discovered: false,
    heatGenerated: 35,
    odRisk: 40,
  },
  {
    id: 'recipe_china_white',
    name: 'China White',
    description: 'The deadliest heroin. One hit can kill.',
    ingredients: [
      { element: 'black_tar' as BaseElement, amount: 2 },
      { element: 'acetone', amount: 2 },
      { element: 'ammonia', amount: 1 },
    ],
    result: 'china_white',
    resultTier: 5,
    baseSuccessRate: 10,
    purityRange: [95, 100],
    potencyRange: [99, 100],
    craftTime: 180,
    discovered: false,
    heatGenerated: 40,
    odRisk: 70,
  },
  {
    id: 'recipe_pure_mdma',
    name: 'Pure MDMA',
    description: 'Lab-grade pure MDMA. Party drug of legends.',
    ingredients: [
      { element: 'molly' as BaseElement, amount: 3 },
      { element: 'ether', amount: 2 },
      { element: 'heat', amount: 1 },
    ],
    result: 'pure_mdma',
    resultTier: 5,
    baseSuccessRate: 20,
    purityRange: [95, 100],
    potencyRange: [95, 100],
    craftTime: 150,
    discovered: false,
    heatGenerated: 25,
    odRisk: 20,
  },
];

// ============ CRAFTING FUNCTIONS ============

/**
 * Check if a combination of elements matches any recipe.
 */
export function findMatchingRecipe(
  elements: { element: string; amount: number }[]
): AlchemyRecipe | null {
  for (const recipe of ALL_RECIPES) {
    if (ingredientsMatch(elements, recipe.ingredients)) {
      return recipe;
    }
  }
  return null;
}

/**
 * Check if provided ingredients match a recipe's requirements.
 */
function ingredientsMatch(
  provided: { element: string; amount: number }[],
  required: AlchemyIngredient[]
): boolean {
  if (provided.length !== required.length) return false;

  const sortedProvided = [...provided].sort((a, b) => a.element.localeCompare(b.element));
  const sortedRequired = [...required].sort((a, b) =>
    (a.element as string).localeCompare(b.element as string)
  );

  for (let i = 0; i < sortedProvided.length; i++) {
    if (
      sortedProvided[i].element !== sortedRequired[i].element ||
      sortedProvided[i].amount < sortedRequired[i].amount
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Attempt to craft a drug from a recipe.
 */
export function attemptCraft(
  recipe: AlchemyRecipe,
  chemistSkillBonus: number = 0,
  rng: () => number = Math.random
): CraftingResult | null {
  const effectiveSuccessRate = Math.min(99, recipe.baseSuccessRate + chemistSkillBonus);

  // Roll for success
  if (rng() * 100 > effectiveSuccessRate) {
    return null; // Craft failed
  }

  // Calculate result properties
  const purity = recipe.purityRange[0] +
    rng() * (recipe.purityRange[1] - recipe.purityRange[0]) +
    chemistSkillBonus * 0.2;
  const potency = recipe.potencyRange[0] +
    rng() * (recipe.potencyRange[1] - recipe.potencyRange[0]);

  const isSuperDrug = recipe.resultTier >= 4;
  const clampedPurity = Math.min(100, Math.max(0, purity));

  // OD risk scales with purity for super drugs
  const odRisk = isSuperDrug
    ? recipe.odRisk * (clampedPurity / 100)
    : recipe.odRisk * 0.5;

  return {
    drug: recipe.result,
    quantity: 1,
    purity: Math.round(clampedPurity),
    potency: Math.round(Math.min(100, potency)),
    tier: recipe.resultTier,
    isSuperDrug,
    odRisk: Math.round(odRisk),
    heatMultiplier: isSuperDrug ? 2.0 + recipe.resultTier * 0.5 : 1.0,
    priceMultiplier: 1.0 + (clampedPurity / 50) + (recipe.resultTier - 1) * 0.5,
    customerKillChance: odRisk / 100,
  };
}

/**
 * Get all discoverable recipes (not yet discovered by the player).
 */
export function getUndiscoveredRecipes(
  discoveredIds: Set<string>
): AlchemyRecipe[] {
  return ALL_RECIPES.filter(r => !discoveredIds.has(r.id));
}

/**
 * Get recipes that can be crafted with available ingredients.
 */
export function getCraftableRecipes(
  discoveredRecipes: AlchemyRecipe[],
  availableElements: Map<string, number>
): AlchemyRecipe[] {
  return discoveredRecipes.filter(recipe => {
    return recipe.ingredients.every(ing => {
      const available = availableElements.get(ing.element as string) ?? 0;
      return available >= ing.amount;
    });
  });
}

/**
 * Get a hint for an undiscovered recipe based on what the player has tried.
 */
export function getRecipeHint(recipe: AlchemyRecipe): string {
  const ingredientNames = recipe.ingredients.map(i => i.element);
  const hintCount = Math.min(2, ingredientNames.length);
  const hints = ingredientNames.slice(0, hintCount);
  return `Try combining ${hints.join(' + ')} with something else...`;
}
