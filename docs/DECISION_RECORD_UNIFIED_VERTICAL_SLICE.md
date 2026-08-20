# Decision Record: Unified Territory-to-Encounter Vertical Slice

**Status:** Accepted for implementation  
**Date:** 2026-08-20  
**Owner:** SLIDE production director  

## Player Outcome

A player scouts a selected, privacy-safe location reference, sees the place’s visual character and tactical modifiers, deploys a crew, launches one playable top-down encounter, and receives a clear persistent block/crew consequence. The place may resemble an entered area through the existing satellite/scene seed and location archetype, but the encounter remains fictionalized and never creates a real-world target.

## Current Fragmentation

The repository currently contains separate grid combat, arcade drive-by, and block-defense renderer paths. `BlockModeView` is the active map-to-combat integration point, `blockStore` owns claimed-block state, and `PhaserTopDownBlock` is the existing React–Phaser bridge. The first implementation will add a canonical offline `CombatSession` and a Phaser encounter scene behind the existing block flow; legacy modes remain intact as a rollback path during migration.

## Chosen Scope

The first vertical slice delivers the following without adding a new engine or external runtime:

| Area | Chosen implementation |
|---|---|
| Location resemblance | Keep existing Mapbox/satellite flow and `resolveBlockDNA`; show a fictional district brief, archetype, terrain tags, and explicit tactical effect rather than expose precise location as a target. |
| Strategy preparation | Use current block placements, zone cover/exposure, heat, morale, and resolved DNA to prepare a deterministic encounter. |
| Combat | Add a pure TypeScript fixed-step session with commands, seeded RNG, cover/line-of-sight, movement, projectile events, reload, extraction objective, and retreat. |
| Rendering | Add one Phaser scene wrapped by a React component. Reuse current world actor assets and location/satellite backdrop; use bounded graphics effects and pooled projectile display objects. |
| Persistence | Apply one idempotent local result to block placements, heat, morale, and pending income; keep server synchronization separate from combat authority. |
| Accessibility | Support keyboard, pointer/touch, gamepad basics, reduced-motion feedback, readable HUD, and explicit text alternatives for state. |

## Deferred

Authoritative multiplayer, payments/entitlements, broad live operations, full address persistence policy, voice/chat, and any new third-party engine/library are deferred. Existing legacy drive-by and raid screens remain unchanged except for replacing the main player-facing encounter launch route.

## Contracts

The domain layer owns `CombatSession`, `CombatCommand`, seed/clock, participants, terrain, cover, objective, and outcome. Phaser owns input capture, rendering, camera, animation, and feedback. React owns HUD, menus, accessibility settings, and result presentation. `blockStore` owns durable local territory projections but does not resolve combat.

## Acceptance Evidence

1. A block’s selected address/DNA, placements, cover, exposure, morale, and heat affect a deterministic encounter preparation summary.
2. The encounter supports move, aim/fire, reload, objective progress, cover, retreat, win/loss, and result summary.
3. The same seed and command sequence produce the same snapshot/result in unit tests.
4. The player-facing route uses the unified encounter from `BlockModeView`, while legacy modes remain available for rollback.
5. Typecheck, tests, build, and asset audit pass. A visual verification covers desktop and touch-sized viewports.

## Changed-File Plan

| Path | Responsibility |
|---|---|
| `frontend/src/game/combat/*` | Pure contracts, seeded simulation, preparation, replay tests |
| `frontend/src/components/encounter/*` | React–Phaser bridge, scene, HUD/result surface, styles |
| `frontend/src/components/map/BlockModeView.tsx` | Launch unified preparation/encounter from claimed block flow |
| `frontend/src/stores/blockStore.ts` | Apply idempotent vertical-slice result projection |
| `frontend/src/types/block.types.ts` | Optional result/brief types where block ownership needs them |
| `frontend/src/**/__tests__/*` | Domain, bridge, and flow tests |

## Risks and Rollback

Cross-origin satellite imagery may fail to load in a Phaser canvas; the encounter must render a deterministic scene fallback. Existing legacy `DriveByEngine` remains an accessible fallback until the new flow has passing tests and visual verification. Limit the first scene to a small roster and bounded projectile/effect pool to protect mobile frame time.
