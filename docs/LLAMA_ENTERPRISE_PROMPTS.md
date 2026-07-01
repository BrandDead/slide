# DEALT/SLIDE — Enterprise LLM Task Prompts
## For Llama 3, DeepSeek, Qwen, or any Large Code Model

These prompts are self-contained. Each one includes all the context the model needs to produce working code. No repository access is required. After the model generates code, drop each file into the path shown in the prompt.

---

## PROMPT 1 — ClaimBlockModal (Mapbox Territory Claiming)
**Assign to:** `deepseek-v3.1:671b-cloud` or `llama3.3:70b`
**Drop output into:** `frontend/src/components/map/ClaimBlockModal.tsx`

```
You are a senior React/TypeScript developer working on a mobile-first urban RPG called DEALT/SLIDE.

## CONTEXT
The game lets players claim real-world city blocks as gang territory. We already have:
- A Mapbox GL JS map rendered in `TerritoryMap.tsx`
- A `useBlockClaim` hook that exposes: `{ searchQuery, suggestions, isSearching, preview, isClaiming, claimError, claimedBlock }` and actions `{ setSearchQuery, selectSuggestion, claimBlock, reset }`
- A Zustand store with `usePlayerStore` exposing `{ player: { money }, updateMoney }`
- Framer Motion is installed

## TASK
Write a complete `ClaimBlockModal.tsx` React component. It must:

1. Show a dark-themed modal overlay (background: rgba(0,0,0,0.85))
2. Include a text input that calls `setSearchQuery` on change
3. Show a dropdown list of `suggestions` (each has `{ place_name, center: [lng, lat] }`)
4. When a suggestion is selected via `selectSuggestion(suggestion)`, show a preview card with:
   - Address
   - Traffic Score (0-100, shown as a colored bar: green < 40, yellow < 70, red >= 70)
   - Estimated income per tick: `$${Math.round(trafficScore * 0.8 + 20)}`
   - Cost to claim: $5,000
5. A "CLAIM THIS BLOCK ($5,000)" button that calls `claimBlock()` and deducts $5000 from `player.money` via `updateMoney(-5000)`
6. If `player.money < 5000`, disable the button and show "Insufficient funds"
7. If `claimedBlock` is set, show a success screen with a green checkmark and the address
8. A close button (top right X) that calls `onClose` prop

## TYPES
```typescript
interface ClaimBlockModalProps {
  onClose: () => void;
}
```

## STYLE REQUIREMENTS
- Background: #0a0a0f
- Accent color: #4ade80 (green)
- Warning color: #ef4444 (red)
- Text: white
- Font: system-ui, monospace for numbers
- Rounded corners: 12px
- Mobile-first: max-width 420px, centered

## OUTPUT
Output only the complete `ClaimBlockModal.tsx` file. No explanations.
```

---

## PROMPT 2 — Authoritative World Tick (Supabase Edge Function)
**Assign to:** `qwen3-coder:480b-cloud` or `llama3.3:70b`
**Drop output into:** `backend/supabase/functions/world-tick/index.ts`

```
You are a Supabase/Deno backend developer working on a game called DEALT/SLIDE.

## CONTEXT
The game has players who own city blocks. Every 5 minutes, the backend should:
1. Give each player passive income from their blocks
2. Reduce each player's heat level (police attention)
3. Log the transaction

## SCHEMA
```sql
-- profiles table
id UUID PRIMARY KEY,
cash INTEGER DEFAULT 5000,
heat_level INTEGER DEFAULT 0 CHECK (heat_level BETWEEN 0 AND 100),
username TEXT,
gang_name TEXT

-- blocks table
id UUID PRIMARY KEY,
owner_id UUID REFERENCES profiles(id),
address TEXT,
base_income INTEGER DEFAULT 50,
status TEXT DEFAULT 'claimed'

-- economy_logs table (create if not exists)
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
profile_id UUID REFERENCES profiles(id),
amount INTEGER,
reason TEXT,
created_at TIMESTAMPTZ DEFAULT NOW()
```

## TASK
Write a complete Supabase Edge Function `world-tick/index.ts` (Deno runtime) that:

1. Accepts a POST request with a secret header `x-cron-secret` matching `Deno.env.get('CRON_SECRET')`
2. Returns 401 if the secret doesn't match
3. Runs a single efficient SQL query that:
   - For each profile, sums the `base_income` of all their claimed blocks
   - Updates `cash = cash + total_income` for each profile
   - Decreases `heat_level = GREATEST(0, heat_level - 2)` for each profile
4. Bulk inserts rows into `economy_logs` for each profile that received income
5. Returns a JSON response: `{ processed: N, totalPaid: M }`

## REQUIREMENTS
- Use the Supabase service role key from `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`
- Use `@supabase/supabase-js` for the client
- Handle errors gracefully — if the DB call fails, return 500 with the error message
- Use CORS headers from a shared `_shared/cors.ts` file that exports `corsHeaders`

## OUTPUT
Output only the complete `world-tick/index.ts` file. No explanations.
```

---

## PROMPT 3 — LaunderMoneyModal (Economy Polish)
**Assign to:** `deepseek-v3.1:671b-cloud` or `llama3.3:70b`
**Drop output into:** `frontend/src/components/economy/LaunderMoneyModal.tsx`

```
You are a React/TypeScript developer building a mobile-first urban RPG called DEALT/SLIDE.

## CONTEXT
Players earn "dirty cash" from drug deals. They can launder it into clean cash through a "Shoebox" banking system, but laundering costs 20% (so $1000 dirty → $800 clean). Dirty cash is seized in police raids; clean cash is safe.

The Zustand store already has:
```typescript
// From useEconomyStore (already exists in gameStore.ts):
const { dirtyCash, cleanCash, launderCash } = useEconomyStore();
// launderCash(amount: number) deducts `amount` from dirtyCash and adds `amount * 0.8` to cleanCash
```

## TASK
Write a complete `LaunderMoneyModal.tsx` component that:

1. Shows a full-screen dark modal overlay
2. Displays current balances:
   - "DIRTY CASH: $X,XXX" in red
   - "CLEAN CASH: $X,XXX" in green
3. Has a range slider (min: 0, max: dirtyCash, step: 100) to select the amount to launder
4. Shows a live calculation:
   - "Laundering: $X,XXX"
   - "Fee (20%): -$XXX"
   - "You receive: $XXX" (in green)
5. A "LAUNDER" button that calls `launderCash(selectedAmount)` and shows a brief success animation (green flash)
6. If `dirtyCash === 0`, show "No dirty cash to launder" and disable the button
7. A close button that calls `onClose` prop

## TYPES
```typescript
interface LaunderMoneyModalProps {
  onClose: () => void;
}
```

## STYLE
- Background: #0a0a0f
- Dirty cash color: #ef4444
- Clean cash color: #4ade80
- Accent: #fbbf24 (gold)
- Slider: custom styled, dark track, green thumb
- Mobile-first, max-width 420px

## OUTPUT
Output only the complete `LaunderMoneyModal.tsx` file with inline CSS-in-JS or a companion `.css` file. No explanations.
```

---

## PROMPT 4 — NPC Gang Retaliation System
**Assign to:** `qwen3-coder:480b-cloud` or `llama3.3:70b`
**Drop output into:** `frontend/src/utils/npcRetaliationEngine.ts`

```
You are a TypeScript game systems developer working on DEALT/SLIDE, a mobile RPG.

## CONTEXT
The game has NPC (AI-controlled) gangs that own city blocks. When the player attacks an NPC block (via the drive-by or TopDown shooter mini-game), the NPC gang should retaliate. Retaliation is a scheduled event that fires after a random delay.

## EXISTING TYPES
```typescript
interface GangMember {
  id: string;
  name: string;
  role: 'shooter' | 'dealer' | 'enforcer' | 'lookout' | 'driver';
  level: number;
  health: number;
  status: 'active' | 'injured' | 'arrested' | 'dead';
}

interface Block {
  id: string;
  address: string;
  owner: 'player' | 'npc' | 'enemy';
  heat: number;
  morale: number;
  members: number;
}

interface NPCGang {
  id: string;
  name: string;
  aggression: number; // 0-100
  difficulty: number; // 1-5
}
```

## EXISTING STORES (Zustand)
```typescript
// usePlayerStore
const { updateHeat } = usePlayerStore();
// useGangStore
const { members } = useGangStore();
// useNotificationStore
const { addNotification } = useNotificationStore();
```

## TASK
Write a complete `npcRetaliationEngine.ts` TypeScript module that exports:

1. `scheduleRetaliation(npcGang: NPCGang, targetBlock: Block): RetaliationEvent`
   - Creates a retaliation event with a delay of `(5 - npcGang.difficulty) * 2` minutes
   - Higher aggression = more members sent (1-5)
   - Returns a `RetaliationEvent` object

2. `executeRetaliation(event: RetaliationEvent, playerMembers: GangMember[]): RetaliationResult`
   - Simulates the attack: NPC shooters vs player shooters
   - Uses `Math.random()` weighted by NPC difficulty vs player member levels
   - Returns casualties on both sides and whether the player's block was taken

3. `useNPCRetaliation()` — a React hook that:
   - Listens for pending retaliation events (stored in a local ref)
   - Fires `executeRetaliation` when the timer expires
   - Calls `addNotification` to alert the player
   - Calls `updateHeat(10)` on the player's block after each retaliation

Include the `RetaliationEvent` and `RetaliationResult` interfaces.

## OUTPUT
Output only the complete `npcRetaliationEngine.ts` file. No explanations.
```

---

## PROMPT 5 — Supabase Auth Integration (Login/Signup Screen)
**Assign to:** `minimax-m2:cloud` or `llama3.3:70b`
**Drop output into:** `frontend/src/components/auth/AuthScreen.tsx`

```
You are a React/TypeScript UI developer building a mobile-first urban RPG called DEALT/SLIDE.

## CONTEXT
The game needs a login/signup screen. We use Supabase for auth. The Supabase client is already configured at `src/services/supabase.ts` and exports `supabase`.

```typescript
// src/services/supabase.ts (already exists)
import { createClient } from '@supabase/supabase-js';
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

## TASK
Write a complete `AuthScreen.tsx` component that:

1. Has two tabs: "SIGN IN" and "SIGN UP"
2. Sign In form: email + password + "SIGN IN" button
   - Calls `supabase.auth.signInWithPassword({ email, password })`
   - On success, calls `onAuthSuccess(user)` prop
   - On error, shows the error message in red
3. Sign Up form: username + gang name + email + password + "CREATE GANG" button
   - Calls `supabase.auth.signUp({ email, password, options: { data: { username, gang_name } } })`
   - On success, shows "Check your email to confirm your account"
   - On error, shows the error message in red
4. Loading state: disable buttons and show "..." text while requests are pending
5. The screen should look like a dark, gritty phone interface

## TYPES
```typescript
interface AuthScreenProps {
  onAuthSuccess: (user: any) => void;
}
```

## STYLE
- Background: #0a0a0f
- Accent: #4ade80
- Input background: #1e1e2d
- Input border: #333
- Error text: #ef4444
- Font: system-ui
- Full screen, centered content, max-width 400px

## OUTPUT
Output only the complete `AuthScreen.tsx` file. No explanations.
```

---

## PROMPT 6 — Gang Member Salary System (Issue #43 Extension)
**Assign to:** `deepseek-v3.1:671b-cloud` or `llama3.3:70b`
**Drop output into:** `frontend/src/hooks/useSalarySystem.ts`

```
You are a TypeScript game developer working on DEALT/SLIDE, a mobile RPG.

## CONTEXT
Gang members have a weekly salary that should be auto-deducted from the player's cash. If the player can't pay, member morale drops. If morale drops too low, members may desert or turn on each other.

## EXISTING CODE
```typescript
// memberProgression.ts (already exists)
export interface MemberStats {
  shooting: number;
  dealing: number;
  nerve: number;
  hustle: number;
  stealth: number;
}

// moraleSystem.ts (already exists)
export const MORALE_CONFIG = {
  HIGH_MORALE: 80,
  NORMAL_MORALE: 50,
  LOW_MORALE: 30,
  CRITICAL_MORALE: 15,
  MORALE_DECAY_RATE: 2,
  MORALE_RECOVERY_RATE: 1,
  UNPAID_SALARY_PENALTY: -15,
  BAIL_PAID_BONUS: 10,
};

// Zustand stores (already exist)
// usePlayerStore: { player: { money }, updateMoney }
// useGangStore: { members: GangMember[], updateMember }
// useNotificationStore: { addNotification }
```

## TASK
Write a complete React hook `useSalarySystem.ts` that:

1. Exports `useSalarySystem()` hook
2. Tracks the last time salaries were paid (stored in localStorage as `lastSalaryPaid`)
3. On mount and every 60 seconds, checks if 7 days (in real time, for testing use 10 minutes = 600000ms) have passed since last payment
4. If payment is due:
   - Calculate total salary: sum of `member.salary` for all active members
   - If `player.money >= totalSalary`: deduct it, set `lastSalaryPaid = Date.now()`, show a notification "Paid gang salaries: -$X,XXX"
   - If `player.money < totalSalary`: apply `MORALE_CONFIG.UNPAID_SALARY_PENALTY` to ALL active members' morale, show a critical notification "COULDN'T PAY SALARIES — Gang morale dropping!"
5. Returns `{ nextPaymentIn: string, totalWeeklySalary: number, canAfford: boolean }`
   - `nextPaymentIn` should be a human-readable string like "3 days, 4 hours"

## OUTPUT
Output only the complete `useSalarySystem.ts` file. No explanations.
```

---

## PROMPT 7 — Supabase Migration: Economy & Salary Tables
**Assign to:** `qwen3-coder:480b-cloud` or any model
**Drop output into:** `backend/supabase/migrations/004_economy_salary.sql`

```
You are a PostgreSQL/Supabase database developer working on DEALT/SLIDE.

## CONTEXT
We need new tables for the economy system and salary tracking.

## EXISTING TABLES (already created in migrations 001-003)
- `profiles` (id, cash, heat_level, username, gang_name)
- `blocks` (id, owner_id, address, base_income, status)
- `gang_members` (id, owner_id, name, role, status, weekly_salary, morale, level)
- `block_placements` (id, block_id, member_id, grid_x, grid_y, zone_type)

## TASK
Write a complete SQL migration file that creates:

1. `economy_logs` table:
   - id UUID PRIMARY KEY DEFAULT gen_random_uuid()
   - profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE
   - amount INTEGER NOT NULL
   - reason TEXT NOT NULL (e.g., 'passive_income', 'salary_payment', 'deal_profit', 'bail_payment')
   - created_at TIMESTAMPTZ DEFAULT NOW()
   - Add index on (profile_id, created_at DESC)

2. `salary_records` table:
   - id UUID PRIMARY KEY DEFAULT gen_random_uuid()
   - profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE
   - total_paid INTEGER NOT NULL
   - member_count INTEGER NOT NULL
   - paid_at TIMESTAMPTZ DEFAULT NOW()
   - was_successful BOOLEAN DEFAULT TRUE
   - Add index on (profile_id, paid_at DESC)

3. Add Row Level Security (RLS) policies to both tables:
   - Users can only SELECT their own rows (profile_id = auth.uid())
   - Only the service role can INSERT

4. Create a helper function `get_economy_summary(user_id UUID)` that returns:
   - total_earned (sum of positive economy_logs)
   - total_spent (sum of negative economy_logs)
   - last_salary_paid (most recent salary_records.paid_at)
   - weekly_salary_total (sum of gang_members.weekly_salary WHERE owner_id = user_id AND status = 'active')

## OUTPUT
Output only the complete SQL migration file. No explanations.
```

---

## HOW TO USE THESE PROMPTS

1. Copy the prompt text between the triple backticks.
2. Paste it into your LLM interface (Ollama, OpenRouter, etc.).
3. The model will output a complete file.
4. Drop the file into the path specified in the prompt header.
5. Run `npm run build` in `frontend/` to verify no TypeScript errors.
6. For backend files, deploy with `supabase functions deploy <function-name>`.

## INTEGRATION CHECKLIST

After running all prompts, wire everything together:

| Step | Action | File |
|------|--------|------|
| 1 | Add `ClaimBlockModal` to `TerritoryMap.tsx` | `map/TerritoryMap.tsx` |
| 2 | Add `LaunderMoneyModal` to `Shoebox.tsx` | `economy/Shoebox.tsx` |
| 3 | Add `AuthScreen` to `App.tsx` (show before onboarding if not logged in) | `App.tsx` |
| 4 | Call `useSalarySystem()` inside `App.tsx` | `App.tsx` |
| 5 | Call `useNPCRetaliation()` inside `App.tsx` | `App.tsx` |
| 6 | Deploy `world-tick` Edge Function | Supabase Dashboard |
| 7 | Run migration `004_economy_salary.sql` | Supabase SQL Editor |
| 8 | Set `CRON_SECRET` env var in Supabase | Supabase Dashboard → Settings → Edge Functions |
| 9 | Schedule `world-tick` via pg_cron: `SELECT cron.schedule('world-tick', '*/5 * * * *', $$SELECT net.http_post(...)$$)` | Supabase SQL Editor |
