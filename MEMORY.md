# DEALT / SLIDE Modern Ops Memory

## 2026-08-26 — Audit and Recovery

The protected default branch is `main-tL2525`. Work is isolated on `feat/modern-gameplay-completion`. The repository had 32 open issues, no open pull requests, and one materially divergent unmerged branch: `copilot/dev-oplan`. Six unique commits from that branch were recovered and reconciled onto the current baseline rather than recreated.

The recovered work registers the seven previously orphaned assets, fixes stale runtime paths, expands Block DNA from 8 to 17 cards, adds persistent local Ghost Crews and tests, adds the City Feed threat banner, and restores the beta smoke tests and release checklist. After recovery, frontend typecheck passed, 685 tests passed across 43 files, and the asset audit passed with zero errors and zero warnings at 5.73 MB.

The default branch’s existing tactical encounter already has a strong deterministic core: `prepareEncounter` produces a typed preparation, `combatSession` owns commands/ticks/RNG/results, and `BlockModeView` applies the result back to block/crew/heat systems. The main missing modern-action requirement was not another simulation but a shared presentation controller and 3D adapter.

## 2026-08-26 — Shared Controller

Added `CombatSessionController` and five focused tests. Camera mode, pause state, selection, shared command sequence, nearest-target fire, reload, interact, retreat, HUD derivation, subscriptions, and disposal live outside the authoritative `CombatSession`. Switching tactical, first-person, and third-person cameras leaves the combat snapshot unchanged. Focused typecheck and 10 combat tests passed.

## 2026-08-26 — Art Direction

Generated a mandatory 2560×1440 visual target at `/home/ubuntu/webdev-static-assets/dealt-slide-modern-ops-visual-target.png`, using the existing Las Olas drive-by plate as a palette and place reference. The target establishes a wet neon strip, over-the-shoulder camera, simple cover, two opponents, extraction marker, and the minimum Modern Ops HUD.

Generated a straight-on four-bay storefront texture from that target, converted it to an 88,376-byte 1536×864 WebP, placed it at `/assets/runtime/generated/environments/street/block_modern_ops_storefront_v001.webp`, and registered it in `runtimeManifest.json`. The visual target is not loaded at runtime.

## Build Environment Note

On the audited default baseline, production bundling transformed 2,437 modules and was terminated by sandbox memory pressure while rendering chunks. Typecheck, tests, lint, asset audit, backend tests, and the latest default-branch CI were healthy. Treat a repeat local build termination as an environment limitation only after confirming there is no TypeScript, test, or asset regression; use CI/Vercel build evidence for the final gate.

## Next Implementation Step

Install Babylon.js, add `frontend/src/game/ops/**` and `frontend/src/components/ops/**`, project encounter terrain into one hero 3D block, wire semantic controls to `CombatSessionController`, add tactical/FPS/TPS cameras, expose Modern Ops from `BlockModeView`, then run focused tests before browser verification.

## 2026-08-26 — Modern Ops Integrated and Browser-Verified

Added Babylon.js, the grid-to-world projection helpers, semantic DOM input, lifecycle-safe scene factory, `OpsWorld`, full-screen React canvas/HUD, generated storefront runtime texture, and lazy `OPS 3D` launchers in `BlockModeView`. The scene supports tactical, first-person, and third-person cameras over one `CombatSessionController`, WASD/arrow movement, fire, reload, extract, retreat, pause, live opponent turns, cover, tracers/impacts, extraction, and deterministic `?demo=1` behavior.

The first browser round found two real defects. Inline canvas callbacks caused the Babylon effect to recreate the engine after every HUD update, and `OpsWorld.dispose()` cleared externally owned controller listeners. Memoizing callbacks and moving controller disposal to encounter unmount fixed camera/HUD persistence. The initial encounter also overran the crew before input; opposition turns now occur every twenty ticks with lower damage, and a deterministic test proves the opening forty ticks remain active and survivable.

Sandbox Chromium/CDP launched the mode through MAP → Strip → OPS 3D with WebGL2, one canvas, no Modern Ops error overlay, and zero captured runtime exceptions. TPS, FPS, and tactical screenshots show the same authored block, cover, actors, objective, ammo, health, and event stream. FPS firing reduced ammo and returned `Shot strikes cover.` without resetting the session.

The deterministic demo reached a secured outcome and applied it through the existing block boundary. Pending income changed $840→$982, heat 1→2, morale 85%→89%, the Modern Ops portal unmounted, and the $2,200 injury/hospital follow-up opened for Lil Dre. No separate economy, crew, or territory copy was introduced.

Evidence is saved under `.audit/`: `ops-third-person.png`, `ops-first-person.png`, `ops-tactical-active.png`, `ops-return-strategy.png`, `browser-findings.md`, and CDP state/event JSON files.

## 2026-08-26 — Final Quality Gauntlet

The completed branch passes TypeScript, all 45 frontend test files / 693 tests, the runtime asset audit (110 assets, 5.81 MB of the 20 MB budget), and all 42 offline backend tests. ESLint reports zero errors and 196 pre-existing warnings.

The production build initially terminated during chunk rendering, reproducing the baseline sandbox failure. Vite’s application-level manual chunks also emitted circular chunk warnings. Removing those forced component chunks, keeping only dependency-oriented chunks (including a dedicated lazy Babylon vendor chunk), and changing the minifier from Terser to esbuild eliminated the circular graph. After closing the completed browser-verification process, the production build succeeded in 21.15 seconds with 2,875 modules transformed. Modern Ops remains a separate lazy chunk (`ModernOpsEncounter` about 24.4 kB plus its Babylon vendor chunk), so the 3D runtime is not loaded until the player launches OPS 3D.


## 2026-09-04 — Returning Empire Command Brief

The next founder-aligned closed-alpha slice makes the current authoritative-world foundation visible to returning players without adding another game engine or creating a parallel rival-state system. A generated 2560×1440 command-desktop visual target exists at `/home/ubuntu/slide-artifact-audit/returning_empire_command_desktop_reference.png`; it is a review reference only and is not loaded by the runtime.

`CityBriefing` is a bounded, presentation-only command-desktop panel. It reads the existing `useGhostStore.feed`, projects the three newest rival/world events through `cityBriefing.ts`, and uses the established navigation store to lead each card to a practical existing response: Map, Crew, or DEALT. The existing `GhostThreatBanner` remains the immediate in-session alert surface. The persistent briefing explains the changes that occurred while a player was away.

Authenticated `useGhostCrewSync` hydration now mirrors only `server-` event IDs into the established notification store. Event IDs are recorded in notification metadata and de-duplicated before insertion, so a returning player sees durable server events in the notification center once while locally generated fallback/demo events retain their established local behavior. The demo seed contains three bounded fictional briefing events exclusively for repeatable visual and player-path review; it does not change production authority.

The milestone passes 52 frontend test files / 720 tests, TypeScript typecheck, asset audit, and a successful production build. The 42 offline backend tests pass. Browser verification confirmed the readable single-column briefing within the intentional 430-pixel iOS-style app frame and verified `Review Defense` routes to the existing territory War Room. The external map tile may remain loading during this route in the sandbox, while its fallback strategic content is present; treat map-provider availability as a separate alpha resilience gate.
