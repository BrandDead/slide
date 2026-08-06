# Claude / Opus 5 — SLIDE Sprint 15-A

## Your Assignment

You are working on **BrandDead/slide**, a React + TypeScript + Zustand mobile game. Two priorities are yours. Manus is working in parallel on the Underworld Marketplace, Most Wanted bounty system, and Get Back clock — **do not touch those files** (listed under "Hands Off" below).

Branch from `main-tL2525`. Name your branch `feat/sprint-15a-engine-rewiring`. Open a PR against `main-tL2525` when tests are green. You cannot merge — Manus will verify and merge.

---

## Context: What This Game Is

SLIDE is a gang-management game built as an iOS-style desktop ("OSShell") of app icons. Each icon opens a mini-game or management screen. All mini-games feed one shared economy: money, heat, morale, gang member progression, and block territory control.

The player claims a real-world city block by address, deploys gang members onto a grid representing that block, and:
- **Dealers** near the street earn more but are easier to kill in drive-bys
- **Shooters** defend the block and return fire when opps "slide" (drive-by)
- **Heat** rises the longer high-level members stay outside; high heat triggers police raids
- **Morale** drops if the player abandons jailed or hospitalized members

Key stores (all in `frontend/src/stores/`):
- `gameStore.ts` — `usePlayerStore`, `useGangStore`, `useEconomyStore`, `useNotificationStore`, `useMoraleStore`, `useNavigationStore`, `useTerritoryStore`
- `blockStore.ts` — `useBlockStore`: blocks keyed by id, each with `placements: BlockPlacement[]`, `heat`, `selectedBlockId`

---

## PRIORITY 1 — Wire the Broken Attack Chain

Three connections are broken between `AttackPlanner` → `TopDownShooter` → the shared economy.

### 1A. Pass planner context into TopDownShooter

**File:** `frontend/src/components/missions/AttackPlanner.tsx`

Currently `handleLaunch()` just calls `navigateTo('topdown')` and throws away everything the player configured. Fix this.

Create a new store slice (put it in `frontend/src/stores/attackPlanStore.ts`) that holds the pending attack plan:

```ts
export interface AttackPlan {
  targetBlockId: string;
  targetAddress: string;
  roles: {
    scout: string | null;      // memberId
    enforcer: string | null;   // memberId
    driver: string | null;     // memberId
  };
  /** Extra attackers beyond the three named roles. */
  additionalMemberIds: string[];
  /** Intel gathered by the scout, null when no scout assigned. */
  intel: AttackIntel | null;
  createdAt: number;
}

export interface AttackIntel {
  defenderCount: number;
  defenderRoles: string[];
  blockHeat: number;
  policePresence: 'none' | 'light' | 'moderate' | 'heavy';
  /** Known positions, only populated when the scout has high enough level. */
  knownPositions: Array<{ memberId: string; x: number; y: number }>;
}
```

`AttackPlanner` writes the plan via `setPlan()` then navigates. `TopDownShooter` reads it via `usePlan()` on mount and clears it on unmount.

**Intel quality must scale with scout level.** A level 1 scout returns only `defenderCount`. Level 3+ returns `defenderRoles` and `blockHeat`. Level 5+ returns `knownPositions` (actual grid coordinates of deployed defenders). Read the scout's level off the `GangMember` record.

If no scout is assigned, `intel` is `null` and TopDownShooter must show the grid with defender positions **hidden** until they fire or are spotted.

### 1B. TopDownShooter reads real defenders from blockStore

**File:** `frontend/src/components/topdown/TopDownShooter.tsx`

Right now `TopDownShooter` generates hardcoded NPC defenders. Replace this.

- Read `useBlockStore().blocks[plan.targetBlockId]`
- Map each `BlockPlacement` on that block into a `CombatUnit` with `team: 'defender'`
- Pull each defender's real stats from their `GangMember` record: `level`, `accuracy`, `hp`, and their equipped weapon out of `member.inventory`
- Defender grid position must come from the placement's actual `x`/`y` on the block, not a random spawn
- When the block is NPC-owned (no real player behind it), fall back to generating defenders from the NPC store (`useNPCStore`) so the game still works against AI rivals
- Attacker units come from `plan.roles` + `plan.additionalMemberIds`, using each member's real stats and equipped weapon

Preserve the existing `takeover` mode, action-point system, and cover mechanics — you are swapping the data source, not rewriting the combat loop.

### 1C. Non-cash loot flows into the Trap

**File:** `frontend/src/components/topdown/TopDownShooter.tsx` (results phase)

Currently only `moneyFromLoot` is applied via `updateMoney()`. Drugs and weapons looted off downed defenders are displayed in the results screen and then discarded.

Create `frontend/src/components/topdown/topDownRewards.ts` following the pattern already established in `frontend/src/components/topdown/bipNDipRewards.ts` and `frontend/src/components/raid/policeRaidRewards.ts`. It must:

- Send looted drugs and weapons to `useEconomyStore().addInventoryItem()` (this is the Trap stash)
- Keep cash going to `updateMoney()`
- Fence jewelry/valuables at a below-face-value rate for cash, matching how `bipNDipRewards.ts` already handles goods with no inventory slot
- Apply heat, XP, and morale changes
- Return a summary object the results screen renders

Also: when a defender is killed, if they were a **real player's member**, that member must be marked dead in the owning player's roster. Look at how `blockStore.applyDriveByCasualties` already handles casualty propagation and follow the same path.

---

## PRIORITY 3 — Claim Hit → Opp Contact → Get Back Mission

This is the social/retaliation loop. It is the mechanic that turns a drive-by from a solo activity into a rivalry.

### 3A. Claim the hit

**File:** `frontend/src/components/slide/SlideGame.tsx`

After a successful slide (attacker caused at least one casualty and retreated or won), show a **CLAIM IT** button on the results screen alongside the existing stats.

Claiming is optional and it is a tradeoff, which is the whole point:
- **Claiming** gives your gang a morale boost and gives the attacking members individual morale + XP. But it reveals your identity to the defender, who can now retaliate.
- **Not claiming** keeps you anonymous. The defender only sees "someone from [your block] slid on you" — they have to ask around to find out who.

When the player claims:
1. A trash-talk text is composed and sent to the defending player
2. The player's gang is saved into the defender's contact book with `status: 'opp'`
3. The defender's gang is saved into the attacker's contact book with `status: 'opp'`
4. Attacking gang morale increases; each member present gains individual morale and XP
5. A **Get Back** window opens for the defender (see 3B)

Let the player pick from generated trash-talk lines rather than typing free text — this keeps content moderated and is faster on mobile. Generate 4–5 options based on the outcome (how many casualties, whether the car escaped clean, whether the block was swept).

**File to create:** `frontend/src/utils/claimHitEngine.ts` — all the rules, no React. Pure functions covering: whether a hit is claimable, generating trash-talk options, computing morale deltas for both sides, and building the contact records.

### 3B. Get Back clock

**Coordinate with Manus here.** Manus is building the Get Back clock UI component and the store slice (`frontend/src/stores/getBackStore.ts`) as part of the Most Wanted work, because the same clock powers bounty fulfilment windows.

Your job is the **trigger and resolution path from the slide side**:
- When a hit is claimed, call `useGetBackStore().openWindow({ ... })` to start the clock for the defending player
- When the defender successfully retaliates against any member who was present on the original slide, call `useGetBackStore().resolveWindow(windowId, 'success')`
- Getting back within the window awards **double morale** to the retaliating gang, and the original attacking gang **loses** that same amount plus the morale they originally gained from claiming
- If the window expires, call `resolveWindow(windowId, 'expired')` — the defending gang takes an additional morale hit for letting it slide

Manus will have the store interface committed before you need it. If it is not on `main-tL2525` yet when you get here, define the calls against the interface above and leave a `TODO(manus-integration)` comment — Manus will reconcile during merge.

### 3C. Retaliation mission

When a Get Back window is open, the defending player gets a mission surfaced in `Missions`: catch any of the members who were present on the slide. Mark those members as "wanted" for the duration of the window. If the defender attacks a block where one of those members is deployed, the Get Back resolves as a success.

---

## Hands Off — Manus Is Working Here

Do not modify these files. Merge conflicts here will cost us a full round trip.

```
frontend/src/components/economy/Market.tsx
frontend/src/components/economy/MarketMembers.tsx
frontend/src/components/economy/MostWanted.tsx
frontend/src/components/economy/MostWantedPoster.tsx
frontend/src/stores/mostWantedStore.ts
frontend/src/stores/getBackStore.ts
frontend/src/utils/marketMembersCatalog.ts
frontend/src/components/common/GetBackClock.tsx
frontend/src/components/layout/OSShell.tsx
```

You **may** read them for reference. You **may** call into `getBackStore.ts` per 3B.

---

## Standards

Follow what is already in the repo — it is consistent and you should match it.

- **Rules live in engines, rendering lives in components.** Every mini-game already splits this way: `slideGameEngine.ts` / `SlideGame.tsx`, `bipNDipEngine.ts` / `BipNDipGame.tsx`, `policeRaidEngine.ts` / `PoliceRaidGame.tsx`. Keep it.
- **No emoji in any UI string.** We just finished purging them. Use text labels or icon images from `GameSprite`. This is a hard rule.
- **Tests are required.** `vitest`, colocated in `__tests__/` next to the file under test. The suite is at 430 passing and must stay green. Test the engines thoroughly — they are pure functions and there is no excuse not to.
- **Comment the why, not the what.** The existing engine files are a good model: they explain design decisions and edge cases, not line-by-line narration.
- **Types go in `frontend/src/types/game.types.ts`** unless they are local to one engine.
- Run `npx vitest run` before opening the PR. If `vitest` complains about the Vite version, the repo is pinned to `vitest@2.x` on purpose — do not upgrade it.

## Definition of Done

- `npx vitest run` green, with new tests covering the new engine logic
- AttackPlanner → TopDownShooter passes target block, roles, and level-scaled intel
- TopDownShooter fights real deployed defenders from blockStore, falls back to NPC store for AI blocks
- Looted drugs and weapons land in the Trap; jewelry fences to cash; casualties propagate to the owning roster
- CLAIM IT works on the slide results screen with generated trash-talk options and correct two-sided morale
- Both gangs save each other as opps in contacts
- Get Back window opens on claim and resolves on retaliation or expiry
- Retaliation mission surfaces in Missions while the window is open
- PR open against `main-tL2525` with a description covering what changed and anything you had to stub
