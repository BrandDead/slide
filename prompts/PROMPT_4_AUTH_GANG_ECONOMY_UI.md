# PROMPT 4: Authentication, Gang Management, and Economy UI

**Recommended AI Model:** `qwen3-coder:480b-cloud`

**Estimated Complexity:** Medium (standard CRUD UIs with game-specific styling)

---

## TASK

Generate three sets of React/TypeScript components:

1. **Authentication UI** — Login, signup, and auth guard using Supabase Auth.
2. **Gang Management UI** — Contact-book-style member management with stats, leveling, and deployment.
3. **Economy UI (Shoebox)** — Cash App-style banking interface for transactions, bail, and hospital bills.

---

## TECH STACK

- React 18 with functional components and hooks
- TypeScript (strict mode)
- Zustand 4 for state management
- Framer Motion for animations
- Tailwind CSS (dark theme)
- Supabase for backend (auth + database)

---

## EXISTING SERVICES

### Supabase Auth (`frontend/src/services/supabase.ts`)

```typescript
export const authService = {
  signUp: async (email: string, password: string, username: string) => {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { username } }
    });
    if (error) throw error;
    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id, username,
        display_name: username, level: 1, xp: 0, money: 10000,
        reputation: 0, heat: 0, crew_size: 0, blocks_owned: 0
      });
    }
    return data;
  },
  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },
  signOut: async () => { await supabase.auth.signOut(); },
  getSession: async () => { return await supabase.auth.getSession(); },
};
```

### Existing Zustand Stores (`frontend/src/stores/gameStore.ts`)

```typescript
// usePlayerStore - manages player profile
interface PlayerState {
  profile: Profile | null;
  money: number;
  heat: number;
  reputation: number;
  isLoading: boolean;
  fetchProfile: () => Promise<void>;
  updateMoney: (amount: number) => void;
  updateHeat: (amount: number) => void;
}

// useGameStore - manages game state
interface GameState {
  gangMembers: GangMember[];
  blocks: Block[];
  inventory: InventoryItem[];
  transactions: Transaction[];
  fetchGangMembers: () => Promise<void>;
  fetchBlocks: () => Promise<void>;
  addTransaction: (tx: Transaction) => void;
}
```

### Morale System (`frontend/src/utils/moraleSystem.ts`)

```typescript
export function calculateMorale(factors: MoraleFactors): number;
export function getMoraleConsequences(morale: number, memberId: string): MoraleConsequence[];
export function rollMoraleConsequences(consequences: MoraleConsequence[]): MoraleConsequence[];
export function calculateBailImpact(gangSize: number, memberName: string): { moraleChange: number; message: string };
export function calculateHospitalImpact(gangSize: number, memberName: string): { moraleChange: number; message: string };
export function getMoraleDescription(morale: number): { label: string; color: string; warning: string | null };
```

### Member Progression (`frontend/src/utils/memberProgression.ts`)

```typescript
export function addXp(currentLevel: MemberLevel, xpGained: number, role: string): { level: MemberLevel; levelUps: LevelUpResult[] };
export function getDealingEffectiveness(stats: MemberStats): { priceMultiplier: number; successRateBonus: number; bulkDealChance: number };
export function getShootingEffectiveness(stats: MemberStats): { accuracyBonus: number; damageMultiplier: number; critChance: number };
export function getMemberHeatContribution(level: number): number;
```

---

## PART A: AUTHENTICATION UI

### Files to Generate:

1. **`frontend/src/components/auth/Login.tsx`** — Full-screen login form. Fields: email, password. "Sign In" button. Link to signup. Error display. Dark theme with centered card. On success, redirect to OSShell (set `currentApp = 'home'` in navigation store).

2. **`frontend/src/components/auth/Signup.tsx`** — Full-screen signup form. Fields: email, password, confirm password, username. "Create Account" button. Link to login. Validates password match and minimum length (8 chars). On success, auto-login and redirect.

3. **`frontend/src/components/auth/AuthGuard.tsx`** — Wrapper component. Checks `supabase.auth.getSession()` on mount. If no session, renders `Login.tsx`. If session exists, renders children. Shows a loading spinner while checking.

4. **`frontend/src/stores/authStore.ts`** — Zustand store. State: `user: User | null`, `session: Session | null`, `isLoading: boolean`, `error: string | null`. Actions: `login(email, password)`, `signup(email, password, username)`, `logout()`, `checkSession()`.

---

## PART B: GANG MANAGEMENT UI (CREW / CONTACTS)

### Files to Generate:

5. **`frontend/src/components/gang/GangManagement.tsx`** — Main container. Layout: left panel = member list (scrollable), right panel = selected member detail card. Top bar shows: total crew size, total salary cost per hour, average morale. "Buy New Member" button opens a shop modal.

6. **`frontend/src/components/gang/MemberCard.tsx`** — A contact-card-style component for a single gang member. Shows: name, role icon, level (with XP bar), status badge (active/injured/jailed/dead/awol), morale indicator (colored bar), and key stats. Clicking opens the detail view.

7. **`frontend/src/components/gang/MemberDetail.tsx`** — Full detail view for a selected member. Shows: all stats (shooting, dealing, nerve, hustle, stealth) as progress bars, equipment list, assigned block, salary, arrest count, kill count, deals completed. Action buttons: "Deploy to Block", "Level Up" (costs money), "Fire Member", "Pay Bail" (if jailed), "Pay Hospital" (if injured).

8. **`frontend/src/components/gang/MemberShop.tsx`** — Modal to buy new gang members. Shows available members for purchase with randomized stats and prices. Categories: Shooters ($5K-$20K), Dealers ($3K-$15K), Enforcers ($8K-$25K), Drivers ($4K-$12K), Chemists ($10K-$30K). Each has randomized name, base stats, and a "Hire" button.

---

## PART C: ECONOMY UI (SHOEBOX)

### Files to Generate:

9. **`frontend/src/components/economy/Shoebox.tsx`** — Main container styled like a Cash App interface. Shows: current balance (large number at top), income per hour, expenses per hour, net profit. Below: transaction history list and action buttons.

10. **`frontend/src/components/economy/TransactionHistory.tsx`** — Scrollable list of transactions. Each entry shows: type icon, description, amount (green for income, red for expense), and timestamp. Filter tabs: All, Deals, Salaries, Bail, Hospital, Purchases.

11. **`frontend/src/components/economy/BailPanel.tsx`** — Shows all jailed members with their bail amounts. Each entry has: member name, charge description, bail amount, and "Pay Bail" / "Leave in Jail" buttons. Paying bail deducts money and changes member status to 'active'. Leaving in jail triggers morale penalty (use `calculateBailImpact`).

12. **`frontend/src/components/economy/HospitalPanel.tsx`** — Shows all injured members with their hospital bills. Similar to BailPanel but for injuries. Uses `calculateHospitalImpact` for morale consequences.

---

## DESIGN GUIDELINES

### Auth Screens
- Full-screen dark background with a centered card (max-width 400px).
- Card has glass morphism effect.
- Input fields: dark background, white text, green focus border.
- Buttons: green gradient (`#00ff88` to `#00cc66`), white text.
- Error messages: red text below the form.

### Gang Management
- Contact-book aesthetic. Left sidebar is a scrollable list of member cards.
- Role icons: Shooter = 🔫, Dealer = 💊, Enforcer = 👊, Driver = 🚗, Chemist = ⚗️, Dog = 🐕.
- Status colors: Active = green, Injured = orange, Jailed = red, Dead = gray, AWOL = yellow.
- Morale bar: green (75+), yellow (50-74), orange (30-49), red (<30).
- Level-up animation: gold sparkle effect.

### Shoebox (Economy)
- Cash App-inspired design. Large balance display at top.
- Transaction list: alternating dark/darker rows.
- Income = green text with `+` prefix. Expense = red text with `-` prefix.
- Bail/Hospital panels: urgent red accent for unpaid items.
- "Pay" buttons: green. "Leave" buttons: gray with warning tooltip.
