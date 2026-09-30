---
name: slide-asset-integration-qa
description: Production integration and visual QA for DEALT/SLIDE generated or licensed art. Use when adding, replacing, reviewing, optimizing, or wiring sprites, characters, vehicles, environments, effects, icons, textures, GLB packages, manifests, or renderer visuals. Ensures clean alpha, camera/scale/pivot consistency, complete state coverage, provenance, manifest/resolver-only loading, budget compliance, and proof in the live game at phone and desktop sizes.
---

# SLIDE Asset Integration QA

An asset is not shipped because it exists on disk. It is shipped only when the live player path renders it through the canonical resolver/package contract and the visual result passes at final size.

Read [Runtime contracts and gates](references/runtime-contracts-and-gates.md), `ASSETS.md`, and the relevant renderer/resolver before editing.

Before any repository edit or asset import, read `AGENTS.md`, `docs/AI_CONTRIBUTOR_START_HERE.md`, and `docs/PROJECT_LOG.md`; inspect the assigned issue, open PRs, and current reservations; state scope and reserve exact files on the issue. If this is art exploration only, do not add runtime/package/manifest files and report that no repository scope was reserved. For meaningful landed work, append the required dated project-log entry.

## Workflow

1. **Name the consumer first.** Identify the exact component/renderer, current fallback, asset class, role/state, world/CSS size, and expected pivot.
2. **Confirm the visual package.** Verify camera, scale, lighting, grade, identity continuity, state inventory, transparency/full-bleed rule, and fictional/provenance boundary. Use `slide-visual-art-direction` when generation or revision is needed.
3. **Keep source and runtime separate.** Preserve editable/source masters and prompts outside the shipped runtime tree. Stage newly approved raster input only in `frontend/public/assets/<runtime-class>/` (never directly in `runtime/`); do not hand-author a runtime derivative or manifest entry. Add schema-valid packages under `frontend/public/assets/packages`.
4. **Use canonical naming and classes.** Use lowercase descriptive IDs with role/view/state/version. Place the file in the class directory so `process.mjs` infers the correct budget, alpha requirement, and pivot.
5. **Process non-destructively.** Run `cd frontend && node scripts/assets/process.mjs` first as a dry run. `process.mjs` has no per-asset scope: dry-run and `--write` scan the entire `frontend/public/assets` tree. Incremental writes retain existing registrations, replace matching IDs, count retained images plus other runtime/package files against the budget, and reject missing registrations or budget overflow before writing. A no-source write leaves the manifest unchanged. Approved writes preserve masters in ignored `art-src/`, publish derivatives and the merged manifest, then remove staged originals. Before `--write`, inspect the complete plan and reserve/review every affected input and manifest change. If unrelated or unreserved inputs appear, stop rather than claiming a scoped run.
6. **Register and resolve.** Runtime images must be present in `src/assets/runtimeManifest.json` and reached through `assetResolver`, `worldActorResolver`, or a schema-valid package loader. Do not hardcode a public URL in a component and do not create a second manifest.
7. **Prove all states and fallbacks.** Verify requested role/state resolves to the new asset. Missing states must have an intentional documented fallback. A portrait chip is not completion for a tactical/street sprite requirement.
   - **2D actor:** prove the exact `worldActorResolver` role/view/state lookup, manifest pivot, deterministic fallback, alpha, and required 2D states.
   - **Character-package GLB:** validate every schema-required clip (`idle` through `coverExit`), six named hit bones, skeleton axes/meters-per-unit, LOD metadata, provenance, runtime GLB, and weapon socket or documented loader fallback. Prove live tactical, first-person, and third-person routes, member switch, fire/reload/downed, one result application, and return to strategy. Do not substitute a sprite-state checklist for a GLB package gate.
   - **Block/environment-package GLB:** follow the separate block-package proof in the reference. Verify editable sources, `runtime.babylonGlb`, stored `dnaId`, grid projection, every anchor against the loaded geometry, lighting, and measured download/triangle/material/draw-call/texture budgets. Identify the actual loader and prove its missing/failed-GLB fallback, navigation, legal placement, spawn/cover/occlusion alignment, encounter return, and unchanged authoritative cells in the live scene. Schema validation and a turntable alone do not prove these properties.
8. **Run gates.** Run `npm run assets:audit`, `npm run assets:packages`, focused resolver/renderer tests, `npm run validate`, and `npm run build`.
9. **Inspect live pixels.** Capture the real screen at 390×844 and 1440×900. Check the asset at actual display size, in front of the approved plate, in idle/action/damage/down states, with HUD and occlusion—not in an asset gallery.
10. **Document provenance and handoff.** Update `ASSETS.md` with source, license/AI involvement, prompt, runtime path/ID, consumer, fallback, dimensions, byte size, and screenshots. Open a focused PR; do not merge or deploy.

## Hard release gates

Reject the asset or PR if any condition is true:

- The final runtime derivative of a composited sprite has no alpha, a checkerboard/white/black matte, edge fringe, baked environment, or accidental text/logo. A staged legacy source without alpha may proceed only if the processor produces clean alpha and the audit passes; if no uniform removable matte is detected, regenerate with true transparency.
- Camera, scale, light direction, contact/grounding, or rendering style disagrees with the scene.
- A generated character changes identity, wardrobe, proportions, handedness, or weapon geometry across states.
- A large source image is shipped for a tiny UI use, the 20 MB runtime budget fails, or the manifest contains missing/orphan files.
- The component uses a hardcoded URL or bypasses `assetResolver`, `worldActorResolver`, or the package loader.
- Only a concept render or asset-lab screenshot exists; the live player path is unverified.
- Required states, pivots, occlusion, hit zones, sockets, or fallback behavior are undefined.
- Provenance, commercial-use status, or AI involvement is missing.
- Visual polish changes gameplay geometry, Block DNA, hitboxes, or result authority.

## Runtime-size QA

Inspect without zooming:

- silhouette and role readable
- feet/wheels/object base grounded at the pivot
- no halo/fringe on bright and dark backgrounds
- weapon/prop does not detach or change sides
- cover/occlusion behaves correctly
- selection ring, health/status UI, and click target remain visible
- effect origin and scale match the action
- no layout obstruction on phone safe areas
- fallback/error state is honest and visually distinct

## Completion report

Return:

- Asset IDs and runtime paths
- Consumer/resolver and states proven
- Source/provenance and prompt location
- Audit/package/full validation/build outcomes
- Phone/desktop live captures
- Before/after at final size
- Missing states and intentional fallbacks
- Budget delta and operational impact
