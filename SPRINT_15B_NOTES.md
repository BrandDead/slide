# Sprint 15-B Working Notes (Manus half)

Branch: `feat/marketplace-mostwanted-getback` off `main-tL2525`
Repo: `/home/ubuntu/slide` (BrandDead/slide)
Claude prompt written to: `/home/ubuntu/slide/CLAUDE_SPRINT_15A_PROMPT.md`

## Work split
- **Claude/Opus 5 (Sprint 15-A)**: Priority 1 (AttackPlanner→TopDownShooter wiring, real defenders from blockStore, loot→Trap) + Priority 3 (CLAIM IT flow, opp contacts, retaliation mission). Branch `feat/sprint-15a-engine-rewiring`.
- **Manus (Sprint 15-B)**: Priority 2 (Market MEMBERS tab, dogs/K9) + Priority 4 (Most Wanted board, Get Back clock, allies).

## Files DONE so far (Manus)
1. `frontend/src/types/game.types.ts` — APPENDED new types:
   - `SpecialPerson`, `SpecialPersonRelation`, `SpecialPersonStatus`, `MemberOriginStory`
   - `HireableMember`, `HireableRole`, `HireableTier`
   - `MostWantedPoster`, `BountyStatus`, `BountyTargetKind`
   - `GetBackWindow`, `GetBackOutcome`, `GetBackTrigger`
   - `Ally`
2. `frontend/src/stores/getBackStore.ts` — NEW. Get Back clock store.
   - Exports: `useGetBackStore`, `GET_BACK_CONFIG`, `remainingMs`, `remainingFraction`, `isLapsed`, `urgency`, `formatClock`, `moraleSwing`, `isValidRevengeTarget`
   - Store methods: `openWindow`, `resolveWindow`, `registerCatch`, `sweepExpired`, `activeWindows`, `mostUrgentWindow`, `isMemberWanted`, `allWantedMemberIds`, `pruneHistory`, `clearAll`
   - Wall-clock based (openedAt + durationMs), NOT tick based
   - SUCCESS_MULTIPLIER = 2; EXPIRY_MORALE_PENALTY = 12
3. `frontend/src/stores/mostWantedStore.ts` — NEW. Bounty board + ally ledger.
   - Exports: `useMostWantedStore`, `BOUNTY_CONFIG`, `listingFee`, `totalPostingCost`, `minimumReward`, `isExpired`, `remainingMs`, `formatRemaining`, `canFulfil`, `bumpStanding`
   - Store methods: `postBounty`, `cancelBounty`, `fulfilBounty`, `sweepExpired`, `openPosters`, `postersBy`, `postersAgainstGang`, `bountyOnTarget`, `isTargetWanted`, `addAlly`, `recordAllyJob`, `getAlly`, `pruneHistory`, `clearAll`
   - `fulfilBounty` returns `PayoutReceipt` for caller to debit/credit/log
4. `frontend/src/utils/marketMembersCatalog.ts` — NEW. Hireable member generator.
   - Exports: `TIER_BANDS`, `ROLE_PROFILES`, `RELATION_LABELS`, `generateSpecialPeople`, `generateHireable`, `generateMemberBoard`, `hireableToMemberPayload`
   - Tiers: street / seasoned / certified / legend (price mult 1 / 3.2 / 8.5 / 22)
   - Roles: recruit, dealer, shooter, enforcer, driver, lookout, k9
   - Seeded deterministic RNG so listing ids regenerate identically

5. DONE `frontend/src/components/economy/MarketMembers.tsx` + `.css` — MEMBERS tab UI
6. DONE `frontend/src/components/economy/MostWanted.tsx` + `.css` — bounty board UI
7. DONE `frontend/src/components/economy/MostWantedApp.tsx` + `.css` — route wrapper
8. DONE `frontend/src/components/common/GetBackClock.tsx` + `.css` — NBA shot clock HUD
9. DONE Market.tsx: added `members` virtual category tab rendering MarketMembers; purged ALL emoji (removed dead `icon` field from ITEM_CATALOG via `scripts/strip_market_icons.py`, replaced with CATEGORY_TAGS text labels)
10. DONE App.tsx: lazy `MostWantedApp` + `case 'most_wanted'` route + global `<GetBackClock />` overlay
11. DONE OSShell.tsx: `RANKINGS` → `CLOUT` (desc 'Who Runs What'); added `most_wanted` app 'WANTED' with live open-bounty badge
12. DONE `frontend/src/stores/__tests__/getBackStore.test.ts`

## Files STILL TO DO (Manus)
13. Tests: `__tests__/mostWantedStore.test.ts`, `__tests__/marketMembersCatalog.test.ts`
14. Run `npx vitest run` (must stay green, was 430 passing), commit, PR, merge

## Key repo facts
- Test runner: `npx vitest run` from `/home/ubuntu/slide/frontend`. Pinned to vitest 2.x (Vite 5 compat) — DO NOT upgrade.
- Baseline before this sprint: 430 tests passing, 22 files.
- HARD RULE: no emoji in any UI string. Use text labels or `GameSprite` icons.
- Pattern: rules in `utils/*Engine.ts` or store, rendering in components.
- `useEconomyStore().inventory` IS the Trap stash. `addInventoryItem` / `transferItemToMember`.
- `useGangStore()`: `members`, `addMember`, `updateMember`, `removeMember`, `backdoorMember`, `jailMember`, `releaseMember`, `killMember`, `contacts`, `addContact`
- `usePlayerStore()`: `player` (money, heat, level, xp, gangName, bankBalance), `updateMoney`, `updateHeat`, `addXP`, `updatePlayer`
- `useBlockStore()`: `blocks` (keyed obj), `selectedBlockId`, `placements` per block
- Market.tsx existing pattern: `ITEM_CATALOG` array + `CATEGORIES` tuple + `CATEGORY_LABELS` record; `handlePurchase` calls `updateMoney(-total)` then `addInventoryItem({...})` then `addTransaction({...})`
- Market.tsx currently HAS emoji in `ITEM_CATALOG[].icon` and `CATEGORY_LABELS` — needs purging when I touch it.

## Open GitHub issues (unchanged)
#77 2.5D visual stack | #78 wire assetManifest into renderers | #79 asset chroma-key cleanup | #80 Block DNA library | #81 NPC rival crew v1 | #45 beta gate

## User design decisions captured this session
- Members bought on underworld are pre-leveled / higher skilled — YES, implemented via tier bands.
- Players can order hits on special people of any member known to them from an opposing gang.
- Most Wanted section: post a picture of target + reward amount. Other players fulfil for quick money.
- Proof flow: player screenshots the confirmed win (mobile: Cmd+Shift+3 mentioned), uploads to the poster, cashes in.
- Poster receives inbox message with the pic + "$X was paid to [player]".
- Shoebox shows a transaction debiting $X paid to the fulfiller's name.
- Fulfiller is added to poster's contact book as an ALLY.
- Who cashed in is PUBLIC — can start wars.
- Get Back clock: NBA shot-clock style, X time to retaliate for a lost member. Success = double morale + skill.
- Rankings app: keep separate from News. Rename label to CLOUT.
