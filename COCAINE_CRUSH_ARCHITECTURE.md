# Cocaine Crush - Architecture & Reverse Engineering Guide

## Overview
This document outlines the exact architecture, data flow, and file dependencies added to the `slide` repository for the `CocaineCrush` minigame. This provides a blueprint for any future reverse-engineering, modifications, or debugging.

The core design philosophy of this feature is **Strict Economy Integration**. It deliberately rejects abstract scores or isolated states in favor of reading directly from the player's active game stores (`usePlayerStore`, `useEconomyStore`). If an item isn't in the player's inventory, it doesn't exist in the minigame.

## 1. File Structure
The following paths map the new component and its integrations:
- `frontend/src/components/cocaine-crush/CocaineCrush.tsx`: The main game logic and render cycle.
- `frontend/src/components/cocaine-crush/CocaineCrush.css`: CSS defining the game board layout and strict drug-specific animation keyframes.
- `frontend/src/components/economy/Shoebox.tsx`: The entry point for the minigame (contains the "Play Cocaine Crush" button).
- `frontend/src/App.tsx`: Incorporates the `<CocaineCrush />` component into the high-level OS screen router.

## 2. State & Data Flow
`CocaineCrush.tsx` relies exclusively on Zustand stores for its truth:
- **`useEconomyStore.inventory`**: Used to determine exactly which drugs can spawn on the board. The `getAvailableDrugs` function filters this down to drugs where `quantity > 0` and are recognized in `DEAL_RULES`.
- **`useEconomyStore.removeInventoryItem`**: Called exactly when a drug match clears the board natively to deduct the exact grammar weight.
- **`usePlayerStore.updateMoney`**: Called exactly when a drug match clears to issue the payout.
- **`useNavigationStore.goBack()`**: Facilitates returning to the Shoebox.

## 3. The `DEAL_RULES` Engine
Inside `CocaineCrush.tsx`, `DEAL_RULES` strictly enforces the economy:
```typescript
const DEAL_RULES = {
  weed: { deductionPerTile: 3.5 / 3, payoutPerTile: 35 / 3, animationType: 'burn' },
  coke: { deductionPerTile: 1 / 3, payoutPerTile: 80 / 3, animationType: 'crumble' },
  meth: { deductionPerTile: 1 / 3, payoutPerTile: 60 / 3, animationType: 'shatter' },
  pills: { deductionPerTile: 2 / 3, payoutPerTile: 20 / 3, animationType: 'chip' },
  shrooms: { deductionPerTile: 3.5 / 3, payoutPerTile: 30 / 3, animationType: 'burn' },
};
```
When a match of 3 or more is found, `verifyAndApplyEconomy()` checks if `inventory.quantity` can satisfy `matchCount * rules.deductionPerTile`. 
- **Success:** Subtracts the quantity, adds the payout to global cash, and the tiles execute their clearing animations.
- **Failure:** The tiles visually clear (to maintain game flow), but the payout is $0 and 0g is deducted. This prevents negative stash quantities.

## 4. Spawning Mechanism
The game loop uses `processBoard` to resolve matches and collapse columns. When creating new tiles at the top of the board, it randomly samples from the current `activeDrugs` array (freshly polled from the economy store).
If `activeDrugs.length === 0` (the stash is empty), the game transitions into a `no_drugs` hard-stop state, prompting the user to go to the Market.

## 5. Visual FX Engine (DOM Injection)
The specific drug animations are not standard CSS transitions. The component's `applyVisualFx` function performs targeted DOM injection to bypass standard React render cycles (which can be too slow for high-velocity particles). 

It reads the tile's `animationType` from `DEAL_RULES` and uses JavaScript to inject specialized `div` elements into `.cc-fx-layer`:
1. **`anim-burn` (Organics)**: Applies heavy contrast and orange hues to the SVG, whilst injecting `ash-particle` divs that drift upwards.
2. **`anim-shatter` (Meth)**: Explodes via scale limits and injects `shard-particle` elements (hard polygons, random angles).
3. **`anim-crumble` (Coke)**: Applies a gaussian blur filter and injects `powder-particle` elements that fall with high simulated gravity.
4. **`anim-chip` (Pills)**: Rotates SVG fragments and injects `chip-particle` blocks.
