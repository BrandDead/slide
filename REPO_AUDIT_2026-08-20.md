# BrandDead/slide Repository Audit

**Audited:** 2026-08-20  
**Repository:** `BrandDead/slide`  
**Default branch:** `main-tL2525` (protected)

## Executive Finding

The changes described in the supplied implementation note **exist in draft PR #114 but are not yet applied to the protected default branch**. The PR is clean and its frontend CI, backend CI, Vercel deployment, and Vercel preview checks are successful. It remains open and draft, with no recorded review decision. The correct management action is to retain the draft state until an owner review, then mark it ready and merge through the protected-branch process rather than committing directly to default.

The repository contains a functioning empire-game prototype with a readable core loop. It does **not** yet meet the production bar for a complete shooter or for a living strategy game: DRIVE is still a custom Canvas passenger-seat action prototype, and rival crews are not persistent, economic opponents.

## Collaboration State

| Area | Finding | Recommendation |
|---|---|---|
| Default branch | `main-tL2525`, protected. | Preserve protected review-and-check workflow. |
| Draft gameplay pass | [PR #114](https://github.com/BrandDead/slide/pull/114), `cursor/game-experience-enhancement-cb34` → default. | Review the now-verified implementation; do not merge solely because checks pass. |
| PR #114 health | Open, draft, merge state `CLEAN`; all four current checks successful. | Keep draft until product/owner review; then set ready for review. |
| Implemented on PR #114 | Shoebox vault/P&L/ledger UI, tactical map fallback, search/recon, claim/drop crew, map-to-DRIVE targeting, tactical combat HUD, demo-state repair. | Merge after review if the product direction remains approved. |
| Other remote branch | `copilot/connect-player-locations` points to a commit already on default and has no diff or PR. | Delete as safe stale-branch housekeeping. |
| Open issue queue | #81, #80, #79, #78, #77, #45; all currently unassigned. | Assign ownership and work them in the order below. |

## What Is and Is Not Applied

| Supplied-note claim | Status on default | Status in PR #114 | Audit conclusion |
|---|---|---|---|
| Cash App-style Shoebox with vault, stash/pull/collect/clean, role P&L, block cost, and ledger | No | Yes | Implemented but unmerged. |
| Map recon, offline tactical fallback, search, nearby rivals, drop crew, and map-selected drive-by target | No | Yes | Implemented but unmerged. |
| DRIVE combat HUD, hit markers, streaks, heat, car/destruction feedback | No | Yes | Implemented but unmerged. |
| Demo seed/persistence and dummy-token safeguards | No | Yes | Implemented but unmerged. |
| A true persistent rival crew loop | No | No | Still required by [issue #81](https://github.com/BrandDead/slide/issues/81). |
| Varied authored Block DNA gameplay library | Partial | Partial | Still required by [issue #80](https://github.com/BrandDead/slide/issues/80). |
| Canonical visual art/camera contract and full asset cleanup | Partial | Partial | Still required by issues [#77](https://github.com/BrandDead/slide/issues/77), [#78](https://github.com/BrandDead/slide/issues/78), and [#79](https://github.com/BrandDead/slide/issues/79). |
| Fully unified vault ledger for every spend | No | No | Casino, market, bail, and other direct-cash paths still need routing through the money boundary. |

## Work Added During This Audit

Commit [`27043a4`](https://github.com/BrandDead/slide/commit/27043a41dcec5bc3b019d91dd2d03e08e65fb16f) was pushed to PR #114. It completes the stated Shoebox requirement at the individual-member level.

| Change | Result |
|---|---|
| Member economics contract | Added pure weekly per-member income, wage, net, deployment, block, role, level, and status calculation. |
| Shoebox UI | Added a `Crew cashflow` section showing **every member**, their attributable weekly earnings, cost, net, current status, and strip/off-strip association. |
| Regression tests | Added deployed dealer/enforcer, off-strip shooter, jailed-member, and empire-summary coverage. |
| Individual game workflow | Added demo-only `?app=<app-id>` deep links; e.g., `?app=shoebox`, `?app=map`, and `?app=driveby` let developers test an app without manually navigating through the OS. |
| Development plan | Added [`docs/DEV_PLAN_2026-08-20.md`](docs/DEV_PLAN_2026-08-20.md), defining the shooter gate, shared-state contracts, and prioritized delivery path. |

Verification after the implementation: TypeScript type-check passed; the focused Shoebox suite passed 6/6; the frontend suite passed **632/632** tests; the production build passed; and browser inspection of `?app=shoebox` showed all four demo crew members with the correct earnings, costs, net values, and block assignments. The build retains a non-blocking warning that the Mapbox vendor chunk exceeds 500 kB after minification.

## What Makes DRIVE a Real Shooter

The current DRIVE mode has real-time aiming, firing, ammunition, targets, return fire, car health, heat, particles, hit feedback, streaks, a passenger-window mechanic, and simple per-run outcomes. That makes it an **action prototype**, not a finished shooter.

A credible game-specific shooter vertical slice requires the following, in this order:

| Requirement | Needed behavior |
|---|---|
| Weapon model | At least two weapons with distinct reload, cadence, spread, damage, ammunition, and feedback. |
| Encounter model | A named rival encounter with objective, deterministic enemy composition, cover/movement, return-fire telegraph, and failure condition. |
| Authored location | One Block DNA-driven playable street with tuned cover, readable actor silhouettes, property damage, and coherent visual presentation. |
| Consequences | Loot, ammunition, damage, heat, injuries, civilians, and success/failure update MAP, CREW, and SHOEBOX atomically. |
| Crew/loadout connection | Crew role, equipment, health, and territory defense change the encounter loadout or outcome. |
| Reliability | Safe restart/exit/pause, no duplicate loops or rewards, persistence, automated integration coverage, and browser smoke proof. |

The recommendation is **not** to pursue an AAA or general military-shooter target. Build the single DRIVE vertical slice above only after the one persistent rival crew and a small, shared Block DNA library make a hit matter in the larger empire game.

## Phone OS Icon Inventory

The shell currently declares 24 icons. All are available in navigation, although their depth and integration vary.

| Icon | App ID | Function in the game ecosystem |
|---|---|---|
| MAP | `map` | Scout, claim territory, inspect nearby blocks, place crew, collect income, and begin a hit. |
| DEALT | `dealt_v2` | Drug-dealing decision loop; produces income and risk/heat outcomes. |
| SLIDE | `slide` | Grid/tactical combat layer. |
| DRIVE | `driveby` | Real-time passenger-seat drive-by action encounter. |
| COOK | `alchemy` | Crafting and product preparation. |
| CREW | `gang_hq` | Crew roster, availability, roles, and management. |
| TRAP | `trap` | Stash and inventory management. |
| SHOEBOX | `shoebox` | Vault, street-cash transfers, payroll, P&L, ledger, and spending analysis. |
| MARKET | `market` | Equipment, weapons, consumables, and member-related purchases. |
| WANTED | `most_wanted` | Bounty-board contracts and threat targets. |
| CONTACTS | `contacts` | Crew contacts and recruitment/placement entry point. |
| OPS | `missions` | Mission and operations selection. |
| CASINO | `casino` | Gambling mini-games; should use the shared money router. |
| CRUSH | `cocaine_crush` | Cocaine-themed score/progression mini-game. |
| BIP N DIP | `bipndip` | Car-break-in rhythm/action mini-game. |
| ATTACK | `topdown` | Top-down block-attack/shooter experiment. |
| RAID | `raid` | Police-raid response mini-game. |
| VANDALIZE | `graffiti` | Opposing-block tagging/pressure mini-game. |
| CLOUT | `leaderboard` | Territory/reputation visibility. |
| LOCAL NEWS | `news` | Weekly world/city update surface. |
| PHONE | `phone` | Contact calling and phone interaction. |
| MESSAGES | `messages` → `phone` | Alias that opens the phone/message surface rather than a separate module. |
| OPS PLAN | `planner` | Attack planning interface. |
| SETTINGS | `settings` | Player/system configuration. |

## How to Work on a Single Game

Individual apps are React modules selected in `frontend/src/App.tsx`. Work inside the app’s component folder plus its nearest pure utilities and tests; do not create a private money, territory, crew, or heat store. Each mini-game should receive explicit shared-state inputs and produce one typed outcome that updates the central contracts.

For local demo development, run the frontend with `VITE_DEMO_MODE=1` and visit `?app=<app-id>`. Examples are `?app=shoebox`, `?app=map`, and `?app=driveby`. This deep-link helper is intentionally demo-only; production navigation remains the OS shell.

| Individual-game checklist | Required before placing a new icon on the home screen |
|---|---|
| Define the player decision and session duration | A concise game brief exists. |
| Specify shared-state reads and writes | Inputs and a typed outcome are documented. |
| Build pure logic and tests first | No UI-only reward logic. |
| Wire one atomic result boundary | Money routes through `moneyRouter`; territory/crew/inventory/heat updates remain authoritative. |
| Demonstrate browser behavior | A playable proof shows a meaningful result in the parent empire. |

## Recommended Work Order

1. **Review PR #114.** It now meets automated and browser verification; retain draft status until an owner validates the gameplay direction, then change it to ready for review.
2. **Implement issue #81 before a broad shooter art pass.** One named, persistent rival crew should claim, earn, reinforce, remember attacks, and retaliate under player-equivalent economic rules.
3. **Complete the initial five-to-ten Block DNA cards for issue #80.** MAP, SLIDE, and DRIVE must all consume the same block identity and statistics.
4. **Build the single credible DRIVE vertical slice.** Use one hero DNA card, then add weapons, encounters, cover, telegraphs, and persistent outcome routing.
5. **Route remaining spending paths through the Shoebox ledger.** Market, casino, bail/hospital, bribes, seizures, and other costs must become complete financial statements.
6. **Resolve visual and release work.** Finish issues #77–#79 and use #45 as the tester-readiness release gate.

## References

[1]: https://github.com/BrandDead/slide/pull/114
[2]: https://github.com/BrandDead/slide/issues/81
[3]: https://github.com/BrandDead/slide/issues/80
[4]: https://github.com/BrandDead/slide/issues/77
[5]: https://github.com/BrandDead/slide/issues/78
[6]: https://github.com/BrandDead/slide/issues/79
[7]: https://github.com/BrandDead/slide/issues/45
[8]: https://github.com/BrandDead/slide/commit/27043a41dcec5bc3b019d91dd2d03e08e65fb16f
