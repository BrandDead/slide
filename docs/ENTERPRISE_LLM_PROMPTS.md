# DEALT/SLIDE - Enterprise LLM Task Prompts

This document contains prompts designed for enterprise-grade LLMs (like Llama 3, DeepSeek, or Qwen) to complete the remaining complex systems for the DEALT/SLIDE game. Since the LLM won't have direct repository access, all necessary context is provided in each prompt.

## Task 1: Mapbox Integration & Address Claiming (Issue #40)

**Context for LLM:**
The game needs a system where players can input a real-world address, and the game claims that territory for their gang. We have a `TerritoryMap.tsx` component that renders a Mapbox map, and a `useBlockClaim.ts` hook.

**Prompt for LLM:**
```markdown
You are building the Mapbox integration and Block Claiming system for a React/TypeScript game called DEALT/SLIDE. 
The player needs to be able to search for a real-world address using the Mapbox Geocoding API, view it on the map, and claim it as their gang's territory.

Please write the complete code for:
1. `ClaimBlockModal.tsx` - A UI component that uses the `useBlockClaim` hook to search for an address and claim it. It should display the traffic score and cost before claiming.
2. A Supabase Edge Function `claim-address/index.ts` that receives the address, verifies the user has enough cash (deducts $5000), and inserts a new row into the `blocks` table.

**Required Types:**
```typescript
interface Block {
  id: string;
  address: string;
  owner_id: string;
  traffic_value: number;
  status: 'claimed' | 'unclaimed';
}
```

**Requirements:**
- Use Framer Motion for modal animations.
- Handle loading and error states gracefully.
- Ensure the Edge Function validates the user's JWT token.
```

## Task 2: Authoritative World Tick (Issue #43)

**Context for LLM:**
Currently, heat decay and passive income are calculated locally in `gameLoopEngine.ts`. This needs to be moved to the backend to prevent cheating and handle offline progression.

**Prompt for LLM:**
```markdown
You are writing a secure, authoritative backend world tick system for a game called DEALT/SLIDE using Supabase and PostgreSQL.

Currently, players earn passive income from their claimed blocks, and their "heat" (police attention) decays over time. This is handled client-side, which is insecure.

Please write:
1. A PostgreSQL `pg_cron` script or a Supabase Edge Function `world-tick/index.ts` that runs every 5 minutes.
2. The script must:
   - Iterate through all active players.
   - Calculate their passive income based on the blocks they own (sum of `base_income` from the `blocks` table).
   - Add this income to their `cash` balance in the `profiles` table.
   - Decrease their `heat_level` by 2 points (minimum 0).
   - Log the transaction in an `economy_logs` table.

**Schema Context:**
- `profiles` table: `id` (uuid), `cash` (int), `heat_level` (int)
- `blocks` table: `id` (uuid), `owner_id` (uuid), `base_income` (int)
- `economy_logs` table: `id` (uuid), `profile_id` (uuid), `amount` (int), `reason` (text)

Ensure the code is robust and handles large numbers of users efficiently (e.g., using batch updates or a single SQL query).
```

## Task 3: Economy Polish & Shoebox Banking

**Context for LLM:**
The game has an economy where players earn dirty cash that needs to be laundered. The UI components exist (`Shoebox.tsx`), but the logic needs refining.

**Prompt for LLM:**
```markdown
You are refining the Economy system for a React game called DEALT/SLIDE. 
Players earn "dirty cash" from drug deals, which they must store in a "Shoebox" or launder into a real bank account to protect it from police raids.

Please write the complete code for `useEconomyStore.ts` (using Zustand) and the `LaunderMoneyModal.tsx` component.

**Requirements for the Store:**
- State: `dirtyCash` (number), `cleanCash` (number), `transactions` (array).
- Actions: `addDirtyCash(amount)`, `launderCash(amount)`, `payBail(amount)`.
- Laundering cash takes a 20% cut (e.g., laundering $1000 dirty cash results in $800 clean cash).

**Requirements for the Modal:**
- A slider or input to select how much dirty cash to launder.
- Display the 20% fee and the final amount of clean cash they will receive.
- A "Launder" button that triggers the store action and plays a success animation.
```
