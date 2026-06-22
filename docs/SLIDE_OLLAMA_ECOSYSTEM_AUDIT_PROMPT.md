# Ollama Prompt — Game Ecosystem Audit & Expansion

*Copy and paste this entire document to the Ollama coding agent (e.g., DeepSeek-Coder). It contains instructions to audit the game loop and propose expansions.*

---

## Mission

You are acting as the Lead Game Designer and Systems Architect for **SLIDE / DEALT**, an urban warfare RPG.

We have built the core modules:
1. **TerritoryMap / BlockModeView:** 8x8 grid where players place dealers/shooters. Placement affects income (closer to street = more money) and risk (closer to street = easier to hit in drive-bys).
2. **DealtMode:** Tinder-style drug dealing mini-game.
3. **DriveByEngine / FPSOverlay:** Canvas-based combat where rival cars drive by and shoot at the block, and the player returns fire in first-person.
4. **Morale & Heat System:** Low morale causes members to desert or shoot friendlies. High heat triggers police raids.
5. **AlchemyLab:** Crafting system to make super drugs.

Your task is to audit this ecosystem, ensure all loops connect logically, and write the code for any missing connective tissue.

---

## Task 1: The Ecosystem Audit

Review the systems above. Does the gameplay loop make sense?
- Are players properly incentivized to engage with all systems?
- Is there an exploit where a player can just hide all members in the "alley" zone to avoid drive-bys while still making enough money?
- Do the drugs crafted in AlchemyLab actually affect the DealtMode or BlockModeView income?

Provide a brief text analysis (1-2 paragraphs) of the current loop and identify the weakest link.

---

## Task 2: The Connective Tissue (Code)

Based on your audit, write the TypeScript code to fix the weakest link.

For example, if you realize that crafted drugs aren't being automatically equipped to dealers on the block, write a `useInventoryEquip.ts` hook or a `DrugAssignmentUI.tsx` component that allows players to assign specific crafted drugs to specific dealers, multiplying their `incomePerTick` and `heat` generation.

Or, if you realize that heat doesn't affect the Tinder-style DealtMode, write a modifier function that injects undercover cops into the customer queue based on the current block heat.

### What you need to write:

Provide the code for the missing system you identified. Include:
1. The TypeScript logic/store updates.
2. The React UI component to expose it to the player.

Please output the code blocks clearly separated by file name.
