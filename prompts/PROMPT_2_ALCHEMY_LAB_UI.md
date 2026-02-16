# PROMPT 2: COOK LAB (Alchemy) UI — Little Alchemy-Style Drug Crafting

**Recommended AI Model:** `qwen3-coder:480b-cloud`

**Estimated Complexity:** Medium (drag-and-drop crafting + recipe discovery)

---

## TASK

Generate the complete React/TypeScript UI for the **COOK LAB** — a Little Alchemy-style drug crafting system where players combine base elements to discover and create drugs. Players start with basic elements (baking soda, cannabis plant, etc.) and combine them to discover recipes. Crafted drugs can be equipped to dealers for selling on the block. Super drugs (tier 4-5) are extremely profitable but cause customer overdoses, raising heat and triggering police raids.

---

## TECH STACK

- React 18 with functional components and hooks
- TypeScript (strict mode, no `any`)
- Zustand 4 for state management (with `devtools` middleware)
- Framer Motion for animations (drag-and-drop, craft animations)
- Tailwind CSS for styling (dark theme, neon accents)

---

## EXISTING CODE YOU MUST USE

### 1. Alchemy Types (`frontend/src/types/alchemy.types.ts`)

```typescript
export type BaseElement =
  | 'baking_soda' | 'acetone' | 'pseudoephedrine' | 'lithium' | 'iodine'
  | 'red_phosphorus' | 'ether' | 'coca_leaf' | 'poppy' | 'cannabis_plant'
  | 'ergot_fungus' | 'psilocybin_mushroom' | 'codeine_syrup' | 'jolly_rancher'
  | 'sprite' | 'mdma_precursor' | 'lye' | 'ammonia' | 'heat' | 'water';

export type CraftedDrug =
  | 'weed' | 'hash' | 'edibles' | 'coke' | 'crack' | 'freebase'
  | 'meth' | 'crystal_meth' | 'blue_sky' | 'heroin' | 'black_tar'
  | 'china_white' | 'lean' | 'double_cup' | 'pills' | 'lsd'
  | 'shrooms' | 'molly' | 'pure_mdma';

export interface AlchemyRecipe {
  id: string;
  name: string;
  description: string;
  ingredients: AlchemyIngredient[];
  result: CraftedDrug;
  resultTier: 1 | 2 | 3 | 4 | 5;
  baseSuccessRate: number;
  purityRange: [number, number];
  potencyRange: [number, number];
  craftTime: number;
  discovered: boolean;
  heatGenerated: number;
  odRisk: number;
}

export interface CraftingResult {
  drug: CraftedDrug;
  quantity: number;
  purity: number;
  potency: number;
  tier: number;
  isSuperDrug: boolean;
  odRisk: number;
  heatMultiplier: number;
  priceMultiplier: number;
  customerKillChance: number;
}

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

export const SUPER_DRUG_EFFECTS: Record<string, SuperDrugEffect>;
```

### 2. Alchemy Engine (`frontend/src/utils/alchemyEngine.ts`)

```typescript
export const ALL_RECIPES: AlchemyRecipe[];  // 18 recipes across 5 tiers

export function findMatchingRecipe(elements: { element: string; amount: number }[]): AlchemyRecipe | null;
export function attemptCraft(recipe: AlchemyRecipe, chemistSkillBonus?: number, rng?: () => number): CraftingResult | null;
export function getUndiscoveredRecipes(discoveredIds: Set<string>): AlchemyRecipe[];
export function getCraftableRecipes(discoveredRecipes: AlchemyRecipe[], availableElements: Map<string, number>): AlchemyRecipe[];
export function getRecipeHint(recipe: AlchemyRecipe): string;
```

---

## FILES TO GENERATE

Generate the following 8 files:

1. **`frontend/src/stores/alchemyStore.ts`** — Zustand store managing `AlchemyState`. Actions: `selectElement`, `removeElement`, `clearSelection`, `attemptCraft`, `discoverRecipe`, `startCraftingSession`, `completeCraftingSession`, `addElement` (when player buys/finds new elements). Initialize with the 3 starter recipes (weed, shrooms, lean) and all 20 base elements.

2. **`frontend/src/components/alchemy/AlchemyLab.tsx`** — Main container. Layout: left sidebar = ElementGrid, center = CraftingTable + result area, right sidebar = RecipeBook. Top bar shows stats (total crafted, failed, exploded). Back button to return to OSShell.

3. **`frontend/src/components/alchemy/ElementGrid.tsx`** — Grid of all discovered elements. Each element is a card with an icon, name, and quantity. Clicking adds it to the CraftingTable. Elements with 0 quantity are grayed out. Group by category: raw materials, tier 1 drugs, tier 2 drugs, etc.

4. **`frontend/src/components/alchemy/CraftingTable.tsx`** — Central crafting area. Shows 2-4 slots for selected elements. A large "COOK" button in the center. When elements are combined, show a mixing animation. If the combination matches a recipe, show a success animation. If not, show a "Nothing happened" message.

5. **`frontend/src/components/alchemy/RecipeBook.tsx`** — Scrollable list of discovered recipes. Each recipe card shows: name, tier (star rating), ingredients with icons, result drug, success rate, purity range, and OD risk. Undiscovered recipes show as "???" with a hint from `getRecipeHint`.

6. **`frontend/src/components/alchemy/CraftingResult.tsx`** — Modal that appears after a craft attempt. Success: shows the drug name, purity %, potency, tier, and any super drug warnings. Failure: shows "Craft Failed" with a reason. Explosion: shows "LAB EXPLODED" with damage to the player.

7. **`frontend/src/components/alchemy/CraftingQueue.tsx`** — Shows active crafting sessions with progress bars and time remaining.

8. **`frontend/src/components/alchemy/index.ts`** — Barrel export.

---

## ELEMENT ICONS (use emoji)

| Element | Icon | Element | Icon |
|---------|------|---------|------|
| baking_soda | 🧂 | acetone | 🧪 |
| pseudoephedrine | 💊 | lithium | 🔋 |
| iodine | 🟤 | red_phosphorus | 🔴 |
| ether | 💨 | coca_leaf | 🍃 |
| poppy | 🌺 | cannabis_plant | 🌿 |
| ergot_fungus | 🍄 | psilocybin_mushroom | 🍄 |
| codeine_syrup | 🍯 | jolly_rancher | 🍬 |
| sprite | 🥤 | mdma_precursor | ⚗️ |
| lye | 🧴 | ammonia | ☁️ |
| heat | 🔥 | water | 💧 |

## DRUG ICONS

| Drug | Icon | Drug | Icon |
|------|------|------|------|
| weed | 🌿 | hash | 🟫 |
| edibles | 🍪 | coke | ❄️ |
| crack | 🪨 | meth | 💎 |
| crystal_meth | 💠 | blue_sky | 🔵 |
| heroin | 🩸 | black_tar | ⚫ |
| china_white | ⬜ | lean | 🟣 |
| double_cup | 🥤 | pills | 💊 |
| lsd | 🌈 | shrooms | 🍄 |
| molly | 💜 | pure_mdma | 💎 |

---

## DESIGN GUIDELINES

- **Background**: Dark gradient `#0a0a0a` to `#1a1a2e`.
- **Element cards**: Glass morphism effect (`backdrop-blur`, semi-transparent background). 80px x 80px. Hover: glow effect matching the element's category color.
- **Category colors**: Raw materials = gray, Tier 1 = green, Tier 2 = blue, Tier 3 = purple, Tier 4 = orange, Tier 5 = red/gold.
- **Crafting animation**: When "COOK" is pressed, the selected elements should animate toward the center, merge, and either produce a new element (success) or explode (failure).
- **Super drug warning**: When a super drug is crafted, show a pulsing red border and a warning message about OD risk and heat.
- **Sound cues**: Add comments where sound effects should play (e.g., `// TODO: play bubbling sound`).

---

## GAME MECHANICS TO IMPLEMENT

1. **Discovery**: When a player combines elements that match an undiscovered recipe, the recipe is permanently discovered and added to the RecipeBook.
2. **Crafting**: Success rate is `baseSuccessRate + chemistSkillBonus`. On failure, ingredients are consumed but no drug is produced. On critical failure (roll < 5%), the lab explodes, destroying some inventory.
3. **Super Drugs**: Tier 4-5 drugs have extreme effects. Display prominent warnings. The `odRisk` should be shown as a danger meter.
4. **Chemist Bonus**: If a gang member with the "chemist" role is assigned, their skill level adds to the success rate. Show a "Chemist: +X%" indicator.
