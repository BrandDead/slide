# PROJECT LOG — DEALT / SLIDE

**Read this first if you are an AI agent (or human) picking up work on this repo.**
This is the running record of decisions, merges, and active direction. Append new dated
entries at the top of the log section; never rewrite history entries.

---

## Current state (as of 2026-07-20)

- **Default branch:** `main-tL2525` (protected). Head includes PR #76 (squash commit `d4ea90f`).
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
