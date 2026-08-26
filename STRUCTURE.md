# DEALT / SLIDE Modern Ops Structure

## Ownership Model

| Layer | Primary paths | Responsibility |
|---|---|---|
| React strategy shell | `frontend/src/App.tsx`, `frontend/src/components/map/BlockModeView.tsx` | Navigation, launcher UI, briefing, HUD chrome, mode selection, result consequences |
| Strategy state | `frontend/src/stores/**`, `frontend/src/utils/moneyRouter.ts` | Blocks, placements, rivals, crew, money, inventory, heat, morale, persistence |
| Encounter preparation | `frontend/src/game/combat/prepareEncounter.ts` | Stable conversion from selected block, placement, DNA, and rival context into one encounter input |
| Authoritative combat | `frontend/src/game/combat/combatSession.ts`, `types.ts` | Deterministic ticks, commands, RNG, damage, objectives, events, idempotent result |
| Presentation-neutral control | `frontend/src/game/combat/CombatSessionController.ts` | Selection, command sequence, pause, camera mode, shared HUD derivation, subscriptions |
| Tactical presenter | `frontend/src/components/encounter/**` | Existing Phaser tactical rendering and input |
| Modern Ops presenter | `frontend/src/components/ops/**`, `frontend/src/game/ops/**` | Babylon engine lifecycle, procedural 3D projection, cameras, semantic input, effects |
| Result boundary | `BlockModeView.handleEncounterResolved` and `blockStore.applyEncounterResult` | Exactly-once return to territory, heat, morale, crew injury, income, and follow-up UI |

## Modern Ops Runtime

`ModernOpsEncounter.tsx` owns the full-screen React portal, creates one `CombatSessionController`, subscribes to state for the HUD, and commits a completed result once. `ModernOpsCanvas.tsx` owns one Babylon `Engine`, invokes `createModernOpsScene`, handles resize and StrictMode-safe cleanup, and never writes strategy state.

`createModernOpsScene` creates the scene, lights, environment, actor proxies, extraction marker, effects, and three cameras. `OpsWorld` subscribes to the controller, projects grid cells to world coordinates, updates actor transforms and health/readability, interprets semantic input, and converts it into controller commands. Visual interpolation and effects are non-authoritative.

## Coordinate Contract

The combat grid is authoritative. Convert a grid point `{x, y}` to world space using a fixed cell size, centered around the block origin. The X axis follows grid columns; the Z axis follows grid rows; Y is height. Road, sidewalk, storefront, cover, actors, and extraction derive from encounter terrain rather than a separate scene map.

The strategy renderer’s 2.5D projection remains unchanged. Modern Ops does not reuse the 2D pixel projection directly; it reuses the same grid and DNA meaning, with a documented world transform, so every renderer agrees on occupancy, cover, and objectives.

## Asset Hints

Use the generated storefront facade texture as the authored landmark across a simple procedural storefront plane. Use restrained PBR or standard materials for wet road, concrete sidewalk, cover planters, actor proxies, and emissive extraction. Reuse existing registered assets where appropriate; do not introduce unregistered runtime paths. Keep the first slice free of GLB dependencies.

## Data Flow

`BlockModeView → prepareEncounter(block) → CombatSessionController → Modern Ops scene ↔ typed CombatCommand → CombatSnapshot/CombatEvent → CombatResult → BlockModeView.applyEncounterResult`.

Camera changes, interpolation, particles, muzzle flashes, tracer lines, pointer lock, and UI animation never enter `CombatSession`. Strategy stores and money routing never enter Babylon modules.
