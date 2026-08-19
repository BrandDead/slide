# PROJECT LOG — DEALT / SLIDE

**Read this first if you are an AI agent (or human) picking up work on this repo.**
This is the running record of decisions, merges, and active direction. Append new dated
entries at the top of the log section; never rewrite history entries.

---

## Current state (as of 2026-08-19)

- **Default branch:** `main-tL2525` (protected).
- **Player-facing loop:** Cash App-style Shoebox vault, iPhone Maps-style hood recon with
  nearby attackable strips, and a drive-by tactical HUD. See log entry 2026-08-19.
- **Graphics engine on main:** Las Olas V3 renderer (`CanvasStreetRendererV3.tsx`) with
  material destruction, vehicle damage regions, 14-joint Verlet ragdolls, and the
  grid-vs-pixel coordinate repair. Compatibility entrypoint preserved at
  `CanvasStreetRenderer.tsx`.
- **Also on main via #76:** authenticated player hydration (`utils/authPlayer.ts`),
  block sync mounted at app root, versioned 18+ fictional-content gate
  (`components/compliance/AgeGate.tsx`), read-only entitlement schema/API, and
  `docs/MVP_STATUS_AND_DEV_PLAN_2026-07-16.md` (the P0 list for paid MVP).
- **Rollback anchor:** branch `backup/pre-pr76` = main immediately before the #76 merge
  (`7b7df1d`). To roll back: `git revert d4ea90f` on main (preferred), or branch from
  `backup/pre-pr76` for a clean-room recovery. Do not force-push main.
- **Graphics diagnosis:** `docs/graphics-audit/` (external audit, 2026-07). Summary:
  high-quality art exists but live renderers don't consume it; the manifest was broken
  and unused; the 8×8 grid is the presentation instead of an invisible layer under a
  rendered place. Asset library ships ~276 MB with chroma fringe and missing alpha.

## Approved direction (owner sign-off 2026-07-20)

1. **Visual stack — one canonical style.** Cinematic 2.5D oblique "tactical diorama"
   block scenes (targets: `docs/concept-art/gta_block_board.png`,
   `docs/concept-art/1208_w_las_olas_block.webp`). The gameplay grid becomes an
   invisible overlay. No more emoji, flat color cells, or the 4-frame
   `gang_members.png` sheet in any player-facing view. SVG/DOM is for HUD only.
   Tracked in **#77**.
2. **Computer as the rival gang.** Until multiplayer has population, persistent NPC
   "ghost crews" with personalities play like real players — claiming, defending,
   and retaliating under the same economy rules. Tracked in **#81**.
3. **Premade blocks before Mapbox.** 30–40 authored "Block DNA" cards are the playable
   territory for beta; Mapbox stays a selection/recon layer, not the combat foundation.
   Tracked in **#80**.

## Active roadmap (work in this order)

| Order | Issue | What | Why first |
|---|---|---|---|
| 1 | #78 | Wire `assetManifest` into `TopDownBlock` / V3 renderer / `StreetBlock`; retire legacy sheet + emoji | Biggest visible win; art already exists |
| 2 | #79 | Asset cleanup: de-fringe, real alpha, downscale, WebP, ≤20 MB budget, CI gate | Makes #78's output actually look clean and load fast |
| 3 | #77 | Art bible + camera contract + grid→scene projection; Las Olas hero block end-to-end | Locks the style so all new art composites |
| 4 | #80 | Block DNA library (start 5–10 cards, grow to 30–40) | Territory variety without Mapbox risk |
| 5 | #81 | NPC rival crew v1 (ghost crews) | Makes the world feel opposed/alive |
| — | #45 | Beta gate umbrella (art pass, QA, release checklist) | Closes when 1–5 land |

Payments/monetization P0s are separately listed in `docs/MVP_STATUS_AND_DEV_PLAN_2026-07-16.md`.

## Housekeeping

- Stale branches to delete via GitHub UI (remote deletion is blocked from the agent
  environment): `agent/las-olas-graphics-destruction`, `agent/mvp-readiness-2026-07-16`,
  `copilot/research-audit-dealt-slide`, `docs/gameplay-bible`.
  Keep: `backup/pre-pr76` (rollback anchor until #76 is proven stable in production).
- PR #75 closed as superseded by #76.

---

## Log

### 2026-08-19 — Game experience audit + Cash App vault / Maps hood / combat HUD

Audited the player-facing loop (empire → shoebox → map → combat) and closed the biggest
disconnects that made the game feel unfinished:

- **Shoebox** was a deposit/withdraw screen on `player.money`, while payroll lived in
  a separate `useShoeboxStore`. It now is a Cash App-style vault: huge balance, stash/pull
  /collect, dealer vs enforcer vs shooter P&L, weekly block cost, spend categories, and
  the live ledger.
- **Maps** mixed dummy Miami pins, a $2,000 claim label vs $5,000 cost, `VITE_MAPBOX_TOKEN`
  vs `VITE_MAPBOX_ACCESS_TOKEN`, and a 400px map. Hood view is now iPhone Maps-like: origin
  on the player strip, search sheet, nearby attackable/claimable recon ring, and drop-crew
  onto a block from the map.
- **Income** no longer auto-banks then gets overwritten by vault sync. Pending cash sits
  on the block; Collect stashes it. Payroll uses live `BlockData` placements instead of
  an empty array.
- **Drive-by** has a modern tactical HUD (ammo, destruction, kill feed, hit markers) and
  mission take deposits to the vault.
- **mapbox-gl** is in `optimizeDeps.include` with a UMD default-export shim so `npm run
  dev` no longer blanks the app on the map import.

### 2026-08-14 — Deployment runtime compatibility remediation

- Reviewed the connected platform-alert mailbox after the game milestones. Vercel issued an account-wide notice that Node.js 20 will be discontinued on 2026-10-01; the repository CI still pinned Node 20 and the deployment configuration did not declare a runtime.
- Added a Node 24 pin in `frontend/package.json` and its lockfile metadata, added a root `.nvmrc`, and updated the frontend GitHub Actions job to run on Node 24. This keeps development, CI, and the hosted build aligned before Node 20 builds become ineligible.

### 2026-08-14 — Drive-by depth/frontage projection (issue #109)

- Merged PR #111 first after frontend typecheck, 609 frontend tests, asset audit, whitespace checks, and its successful Vercel preview. It closes issue #108 by carrying a normalized structured target through the selector, game, and engine; geocoded targets now seed Block DNA with their supplied coordinates, while offline entries use a deterministic labelled text seed.
- Added `projectStreetScene()` as the explicit Block DNA depth-to-passenger-view bridge for #109. `zoneLayout` is now projected as stable far-to-near layers (`skyline → setback → facade → sidewalk → curb → road`) with retained row-based IDs, while repeated frontage lots are derived independently from built-form rows. Depth rows are no longer consumed as horizontal façade columns.
- Threaded the projection through `resolveStreetForTarget` and `DriveByEngine` into the renderer. The renderer now draws skyline/setback backdrops before storefront frontage, with street/curb as the nearest layer.
- Added acceptance tests for depth-order semantics, frontage-source separation, stable IDs, and three authored Block DNA archetypes. Frontend typecheck passed; full frontend test suite passed 611/611. Build verification remains delegated to Vercel because local production bundling was terminated by the constrained sandbox while rendering chunks; asset audit remains green at 5.73 MB / 20 MB with 7 pre-existing non-blocking orphan warnings.

### 2026-08-11 — K3 handoff: Milestone 0 baseline + Milestone 1 (#108)

- **M0 baseline (verified on `copilot/k3-implementation-handoff`):** `npm run typecheck` clean;
  Vitest 595/595 across 27 files; `npm run build` passed; `npm run assets:audit` passed
  (5.73 MB / 20 MB, 0 errors, 7 known orphan warnings); backend `pytest` 42/42 in offline
  mock mode. Known non-blocking warnings unchanged: 101 `datetime.utcnow()` deprecations,
  Mapbox/Phaser chunk-size warnings.
- **Actual state vs open issues:** #108 (drive-by target seeding) — fixed in this PR, see
  below. #109 (Block DNA frontage projection) — still open: `generateStreetSegments` still
  consumes depth rows as along-street segments; deferred to its own PR per the work order.
  #77–#79 — partially landed via #76/#78 (assetResolver + manifest wiring are in; orphan
  cleanup, defringe, and the camera/art bible remain). #80 — Block DNA library exists but is
  small; #81 — ghost crews exist only as the NPC tick store, not the full rival-crew loop;
  #45 — beta gate umbrella remains open pending 1–5.
- **M1 — structured drive-by target selection (#108):** `CarCrew.targetBlock` is now a
  structured `DriveByTarget { address, lat?, lng?, placeId?, seedMode }`. `CarCrewSelector`
  reuses the existing `AddressSearchBar` autocomplete (the shared address-search contract)
  and exposes a clearly labelled offline text fallback. `DriveByEngine` passes real
  coordinates to `resolveBlockDNA` when geocoded — no more fixed Fort Lauderdale seed for a
  user-selected target. When offline (no coordinates), a deterministic non-geographic FNV-1a
  text seed derived from the normalized address is mixed into the scene seed and labelled in
  code (`seedMode: 'text-seed'`), so two different typed addresses produce distinct streets.
  New `utils/driveByTarget.ts` owns the contract + pure `resolveStreetForTarget` (no network
  per frame). Tests: `utils/__tests__/driveByTarget.test.ts` (10) and
  `components/driveby/__tests__/carCrewTarget.test.tsx` (3 UI handoff). Deferred: #109
  projection repair, HUD seed-mode badge.

### 2026-08-11 — Sprint 16–18 reconciliation branch

- Created `chore/reconcile-sprints-16-18` to safely combine the compatible work from PRs #104 and #105 without merging three divergent branches directly into the protected default branch.
- Kept Sprint 17’s address-seeded procedural drive-by and window mechanic, and intentionally excluded Sprint 16’s superseded static drive-by backdrop. Integrated the Sprint 16 splash, Las Olas demo seed, OS-shell wallpaper, role contact cards, and member-creation flow.
- Corrected the blocking geospatial import regression in `models/block.py` and `geocoding_service.py`; coordinate-based claims now preserve the offline mock-backend path without requiring Mapbox reverse geocoding.
- Resolved review findings in the integrated code: Contacts now enters placement mode before MAP navigation, preserves legacy avatars, seeds canonical `experience` and `stats`, role cards read canonical nested stats and cover all supported roster roles, member-preview errors are source-scoped, desktop icon paths use verified processed assets, and interactive raid seizures update current inventory.
- Validation on this branch: frontend typecheck passed; Vitest passed 595/595; production build passed; asset audit passed at 5.73 MB / 20 MB; backend pytest passed 42/42 in offline mode. Remaining warnings: 7 asset-manifest orphan warnings, 99 Python `datetime.utcnow()` deprecations, and production bundle-size warnings for Mapbox/Phaser.
- This log entry is associated with the reconciliation branch until its pull request is merged. Do not merge the superseded PRs independently afterward.

### 2026-07-20 (later) — #78 milestone: art library wired into live renderers

- New `frontend/src/services/assetResolver.ts`: the single role→art lookup layer.
  Guarantees returned URLs exist on disk with usable alpha, per-state fallback chains,
  preloading, and load-time chroma defringe for canvas sprites. All renderers must use
  it — no hardcoded sprite URLs in components.
- `TopDownBlock`: aerial block art under a translucent tactical grid; circular portrait
  tokens (role ring, level, health) replace the pixel-sheet/emoji tokens.
- `StreetBlock`: real night-street backdrop by default; members render photoreal street
  sprites (dealer/shooter/enforcer) or portrait chips (lookout/driver — art pending).
- `CanvasStreetRendererV3`: standing actors now draw defringed hi-res street art;
  legacy sheet/vector body remain as fallback; ragdoll impact takeover unchanged.
- Placement identity bug fixed: `pendingPlacementMember` (name/role/level) flows through
  `blockStore` → board; the untyped `_pendingMemberData` hack is gone.
- Evidence in `docs/qa/2026-07-20-*.png`; full report in
  `docs/REPORT_2026-07-20_GRAPHICS_WIRING.md`. Issue #78 remains open for the missing
  art generation + vehicle cutouts (#79 overlap).

### 2026-07-20 — Graphics audit intake, #76 merge, roadmap reset (Claude session)

- Verified the external graphics audit zip against the repo: all code files were
  snapshots of main (nothing unmerged); all reference images existed full-res in-repo
  except the Las Olas block plate. Committed the audit to `docs/graphics-audit/` and
  the plate to `docs/concept-art/1208_w_las_olas_block.webp`.
- Fixed broken `assetManifest.ts` references: shooter street hit/downed now point to
  shooter files (were dealer's), dealer gained its own existing aim/hit/downed entries,
  vehicle passenger overlay corrected to the real filename, entries for nonexistent
  files (`windowsDown`, `damageHeavy`, shooter `streetAim`) removed. Typecheck clean.
  Note: `streetIdle` paths for dealer/lookout/driver/shooter still point to files that
  need to be generated (only enforcer's exists) — covered by #78.
- Created rollback branch `backup/pre-pr76` at `7b7df1d`, then squash-merged PR #76
  as `d4ea90f`. Closed superseded draft PR #75.
- Filed roadmap issues #77 (visual stack), #78 (manifest wiring), #79 (asset cleanup),
  #80 (Block DNA), #81 (NPC rival crews). Created this log.

### 2026-07-16 — PR #76 opened (MVP readiness)

Las Olas V3 integration + auth hydration + block sync + age gate + entitlements.
See `docs/MVP_STATUS_AND_DEV_PLAN_2026-07-16.md` and `MVP_AUDIT_NOTES.md`.

### Earlier history

See closed PRs #63–#74 and `docs/GAME_DESIGN_BIBLE_PART1.md` / `PART2.md` for design
canon; `docs/ARCHITECTURE.md` for the authoritative-grid vs. visual-layer separation.
