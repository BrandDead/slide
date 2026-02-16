# AI Code Generation Prompts for SLIDE

This file contains detailed prompts for generating the missing React components for the SLIDE game. These prompts are designed to be used with advanced AI coding models like `deepseek-v3.1:671b-cloud` or `qwen3-coder:480b-cloud`.

**INSTRUCTIONS FOR THE AI MODEL:**

You are an expert React/TypeScript developer. Your task is to generate complete, production-ready React components based on the detailed requirements provided in each prompt. You must adhere to the following principles:

1.  **Tech Stack**: Use React 18, TypeScript, Vite, Zustand for state management, Framer Motion for animations, and Tailwind CSS for styling. No other libraries should be used unless specified.
2.  **File Structure**: Place generated files in the correct directory as specified in the prompt.
3.  **Code Quality**: Write clean, modular, and well-documented code. Use functional components with hooks. All types must be explicitly defined and imported from the `frontend/src/types/` directory.
4.  **State Management**: Use the existing Zustand stores (`useGameStore`, `usePlayerStore`, etc.) to manage state. Do not create local state for data that should be persisted globally.
5.  **Services**: Use the provided service files (`supabase.ts`, `SocketService.ts`) for all backend interactions.
6.  **Styling**: Use Tailwind CSS for all styling. The UI should be dark-themed, responsive, and have a modern, clean aesthetic.
7.  **Completeness**: Each generated file should be a complete, copy-paste-ready component.

---

## Prompt 1: SLIDE Combat UI

**Task:** Generate the complete UI for the **SLIDE** combat mode.

**Recommended Model:** `deepseek-v3.1:671b-cloud`

### 1.1. `frontend/src/components/slide/SlideGame.tsx`

This is the main container for the combat screen. It will manage the `SlideGameState` and render sub-components based on the `SlidePhase`.

**Requirements:**

- Fetch the initial combat state from a new Zustand store `useSlideCombatStore`.
- Implement a state machine to transition between phases: `setup` -> `attacker_turn` -> `defender_turn` -> `resolution` -> (loop) -> `finished`.
- Render `UnitPlacement.tsx` during the `setup` phase.
- Render `MacroGrid.tsx`, `MicroGrid.tsx`, `CombatHUD.tsx`, and `CombatActions.tsx` during the combat phases.
- Render `TurnResolver.tsx` during the `resolution` phase.
- Use the `eventBus` from `frontend/src/core/game-engine-integration.ts` to emit combat events.

### 1.2. `frontend/src/components/slide/MacroGrid.tsx`

This component renders the 8x8 defender grid.

**Requirements:**

- The grid should be an 8x8 CSS grid.
- Each cell should display the terrain type from `gridFactory.ts` (`street`, `building`, etc.).
- Placed units (`BlockUnit`) should be displayed on the grid, showing their health.
- The attacker should be able to click on cells to select targets. Selected targets should be highlighted.
- The grid should show hit/miss markers after an attack.

### 1.3. `frontend/src/components/slide/MicroGrid.tsx`

This component renders the 16x16 attacker grid (the vehicle).

**Requirements:**

- The grid should be a 16x16 CSS grid.
- It should display the vehicle parts (`hood`, `driver_seat`, etc.) based on the `vehicleFootprint` from `dualGrid.ts`.
- The defender should be able to click on cells to target specific vehicle parts.
- Damaged parts should be visually distinct (e.g., red overlay, cracks).

### 1.4. `frontend/src/components/slide/UnitPlacement.tsx`

This component allows the defender to place their units on the macro grid.

**Requirements:**

- Display a list of available units for placement.
- Allow the user to drag and drop units onto the `MacroGrid.tsx`.
- Enforce placement rules from `slide.types.ts` (`PLACEMENT_RULES`).
- A "Ready" button to confirm placement and start the combat.

### 1.5. `frontend/src/components/slide/CombatHUD.tsx`

This component displays the heads-up display during combat.

**Requirements:**

- Show the current player's turn.
- Display attacker's vehicle health and defender's remaining units.
- Show the attacker's available ammo and weapon patterns.
- A log of recent combat events.

### 1.6. `frontend/src/components/slide/CombatActions.tsx`

This component provides action buttons for the current player.

**Requirements:**

- For the attacker: buttons to select weapon patterns (`single`, `burst3x3`, `line3`) and a "Fire" button.
- For the defender: a "Fire" button to confirm their shots.
- A "Retreat" button for both players.

### 1.7. `frontend/src/stores/slideCombatStore.ts`

Create a new Zustand store to manage the state of a SLIDE combat session.

**State properties:**

- `gameState: SlideGameState | null`
- `isLoading: boolean`
- `error: string | null`

**Actions:**

- `startCombat(attackerId: string, defenderId: string, blockId: string)`: Initializes a new combat session.
- `placeUnit(unitId: string, position: MacroCoord)`: Places a unit on the grid.
- `confirmPlacement()`: Finalizes unit placement and starts the combat.
- `selectMacroTarget(coord: MacroCoord)`: Selects a target on the macro grid.
- `selectMicroTarget(coord: MicroCoord)`: Selects a target on the micro grid.
- `fireAttackerShot(seat: DriveBySeat, pattern: MacroPattern)`: Fires a shot from the attacker's vehicle.
- `fireDefenderShot(shooterId: string)`: Fires a shot from a defending unit.
- `resolveTurn()`: Resolves the current turn and updates the game state.

---

## Prompt 2: COOK LAB (Alchemy) UI

**Task:** Generate the complete UI for the **COOK LAB** (Alchemy) crafting mode.

**Recommended Model:** `qwen3-coder:480b-cloud`

### 2.1. `frontend/src/components/alchemy/AlchemyLab.tsx`

This is the main container for the crafting screen.

**Requirements:**

- Use a new Zustand store `useAlchemyStore` to manage the `AlchemyState`.
- Render `ElementGrid.tsx` to show available crafting elements.
- Render `CraftingTable.tsx` to show the selected elements.
- A "Craft" button to attempt a combination.
- Render `RecipeBook.tsx` to show discovered recipes.
- Render `CraftingQueue.tsx` to show ongoing crafts.

### 2.2. `frontend/src/components/alchemy/ElementGrid.tsx`

Displays all discovered elements.

**Requirements:**

- Grid layout of all `discoveredElements` from the `useAlchemyStore`.
- Each element should be a clickable button.
- Clicking an element adds it to the `CraftingTable.tsx`.

### 2.3. `frontend/src/components/alchemy/CraftingTable.tsx`

Shows the currently selected elements for combination.

**Requirements:**

- Display the icons/names of the selected elements.
- A "Clear" button to remove all selected elements.

### 2.4. `frontend/src/components/alchemy/RecipeBook.tsx`

Displays all discovered recipes.

**Requirements:**

- A searchable and scrollable list of `discoveredRecipes`.
- Each entry should show the recipe name, ingredients, and the resulting drug.

### 2.5. `frontend/src/components/alchemy/CraftingResult.tsx`

A modal to show the result of a craft attempt.

**Requirements:**

- Show whether the craft was a success or failure.
- If successful, display the `CraftingResult` details (drug name, purity, potency, etc.).
- An "OK" button to close the modal.

### 2.6. `frontend/src/stores/alchemyStore.ts`

Create a new Zustand store for the alchemy system.

**State properties:**

- `state: AlchemyState`
- `isLoading: boolean`

**Actions:**

- `selectElement(element: BaseElement | CraftedDrug)`: Adds an element to the crafting table.
- `clearSelection()`: Clears the crafting table.
- `attemptCraft()`: Attempts to craft a drug from the selected elements, using `alchemyEngine.ts`.
- `startCraftingSession(recipeId: string)`: Starts a new crafting session.

---

## Prompt 3: Territory Map UI

**Task:** Generate the UI for the **Territory Map** using Mapbox GL JS.

**Recommended Model:** `deepseek-v3.1:671b-cloud`

### 3.1. `frontend/src/components/map/TerritoryMap.tsx`

This component will render the main Mapbox map.

**Requirements:**

- Initialize a Mapbox map using the token from `.env`.
- The map should be full-screen and dark-themed.
- It should display claimed blocks as colored polygons (e.g., green for player, red for enemy).
- Clicking on a block should open the `BlockInfoPanel.tsx`.

### 3.2. `frontend/src/components/map/BlockInfoPanel.tsx`

A slide-out panel showing details for a selected block.

**Requirements:**

- Display the block's address, owner, heat level, and income.
- Show a list of units stationed on the block.
- Buttons to "Attack" or "Deploy Units".

### 3.3. `frontend/src/components/map/ClaimBlockModal.tsx`

A modal to claim a new block.

**Requirements:**

- An input field for the user to enter a real-world address.
- A "Claim" button that uses the Mapbox Geocoding API to get the coordinates.
- On success, it should call a `claimBlock` action in a new `useTerritoryStore`.

### 3.4. `frontend/src/stores/territoryStore.ts`

Create a new Zustand store for territory management.

**State properties:**

- `blocks: Block[]`
- `selectedBlockId: string | null`

**Actions:**

- `fetchBlocks()`: Fetches all blocks from Supabase.
- `selectBlock(blockId: string)`: Sets the selected block.
- `claimBlock(address: string)`: Claims a new block.
- `deployUnit(blockId: string, memberId: string, position: MacroCoord)`: Deploys a unit to a block.
