# DEALT / SLIDE Modern Ops Assets

**Art direction:** A compact fictionalized South Florida strip at night, with wet asphalt, palms, simple one-story storefront geometry, cyan-magenta-amber-green emissive accents, restrained physically plausible materials, readable cover lanes, and clean crew/opposition silhouettes. The target is stylized-realistic browser-game output rather than a cinematic or photoreal scene.

## Visual Target

| Name | Role | Size | File | Runtime |
|---|---|---:|---|---|
| Modern Ops visual target | QA reference for composition, camera, palette, cover, HUD, and object density | 2560×1440 | `/home/ubuntu/webdev-static-assets/dealt-slide-modern-ops-visual-target.png` | No; verification reference only |

**Prompt:** Create a clean, sharp 16:9 in-game screenshot target for a modern 3D browser action game, using the supplied rainy neon Florida strip reference only for palette, mood, wet asphalt reflections, palm silhouettes, and storefront identity. Use an over-the-right-shoulder camera; include one player crew member, two readable opposition silhouettes, concrete planter and parked-car cover, a green extraction marker, a wet two-lane road, simple neon storefront boxes, a complete but compact combat HUD, and only effects the implementation will support. Exclude motion blur, depth of field, volumetric fog, crowds, real brands, gore, and cinematic composition.

## Runtime Texture

| Name | Description | Intended size | Source | Runtime path |
|---|---|---:|---|---|
| Modern Ops storefront facade | Four-bay straight-on fictional storefront elevation with cyan, green, magenta, and amber emissive signs | 32 m × 6 m plane; source 1536×864 WebP, 88,376 bytes | `/home/ubuntu/webdev-static-assets/dealt-slide-ops-storefront-facade.png` | `/assets/runtime/generated/environments/street/block_modern_ops_storefront_v001.webp` |

**Prompt:** Create a straight-on orthographic 16:9 game texture plate for four simple fictional Florida strip-mall bays, matching the visual target’s rainy-neon palette. Include charcoal stucco, reflective windows, metal doors, shallow awnings, and short fictional signs: NIGHT MART, 305 CAFE, VICE SHOP, and GOLD PAWN. Exclude people, cars, sidewalk, sky, rain, HUD, weapons, real brands, perspective, depth of field, and dramatic lighting.

The runtime texture is registered as `generated.environments.street.block_modern_ops_storefront_v001` in `frontend/src/assets/runtimeManifest.json` and is included in the repository asset budget.

## Existing Reused Assets

| Asset | Role in the slice | Runtime path |
|---|---|---|
| Las Olas drive-by street plate | Existing palette/place reference and legacy action fallback | `/assets/runtime/generated/environments/street/block_lasolas_driveby_street_v001.webp` |
| Las Olas top-down plate | Strategy/tactical identity continuity | `/assets/runtime/generated/environments/topdown/block_lasolas_topdown_v001.webp` |
| Registered street character art | Tactical/legacy actor art; 3D mode uses lightweight procedural proxies in the first slice | Resolved through `worldActorResolver` |
| Combat effect sheet | Existing effect vocabulary for non-3D action modes | `/assets/runtime/generated/effects/fx_combat_sprite_sheet_v001.webp` |

## Runtime Rules

All runtime images must be registered in `runtimeManifest.json`, pass `npm run assets:audit`, and stay within the 20 MB budget. Babylon receives the storefront through its registered public path. The visual-target PNG remains outside the runtime tree and should be attached with review evidence rather than loaded by the game.

## 2026-08-28 — Production-Intent 1208 Las Olas Pass

The Babylon comparison path now has a formal package pipeline rather than scene-specific asset assumptions. Versioned character and block schemas live under `contracts/`, canonical examples define the expected cross-engine exports, runtime guards live in `frontend/src/game/assets/assetPackages.ts`, and `npm run assets:packages` validates examples plus any runtime package manifests. Babylon's official glTF loader is installed, and `OpsPackagedAssetLoader.ts` imports schema-valid character or block GLBs without moving gameplay authority into those assets.

| Asset or system | Current source | Runtime role | Replacement path |
|---|---|---|---|
| Articulated actor fallback | Original procedural mesh assembly in `OpsCharacterFactory.ts` | Human-proportioned crew/rival silhouette, separate clothing materials, visible weapon, head/torso/arm/leg hit zones | Replace package-by-package with licensed rigged GLB using the same `OpsActorVisual` contract |
| Parked sedans | Original procedural assembly in `OpsEnvironmentFactory.ts` | Vehicle cover, physical ray target, night-street density | Replace with optimized vehicle GLBs carrying stable vehicle anchor IDs |
| Concrete planters and foliage | Original procedural assembly in `OpsEnvironmentFactory.ts` | Physical cover and Las Olas streetscape dressing | Replace or refine inside the block GLB without changing grid/anchor semantics |
| Palm trees and puddles | Original procedural assembly in `OpsEnvironmentFactory.ts` | South Florida identity and wet-neon reflection cues | Replace with instanced production meshes/textures after the hero-block package exists |
| Storefront depth and background massing | Original procedural geometry plus existing generated facade WebP | Awnings, columns, sills, roof depth, and skyline enclosure around the existing facade | Consolidate into `block.1208-las-olas.v1` source scene and GLB |
| FPS weapon presentation | Original procedural assembly in `OpsWorld.ts` | Visible first-person weapon and local recoil only | Replace with the possessed member package's `firstPersonArmsGlb` and weapon socket contract |

The Quaternius Universal Base Characters and Universal Animation Library free standard packages were acquired through their official zero-price itch pages. Their creator-provided archive licenses dedicate the included assets to CC0 1.0. One male base and 12 gameplay clips are now combined into the optimized runtime package at `/assets/packages/characters/universal-male/universal-male.v1.glb`; the exact license and strict package manifest ship beside it. This model proves the portable rig pipeline but its superhero costume is explicitly not the final benchmark. No marketplace asset or third-party model is represented as project-owned content.

All procedural fallbacks are code, not claimed production art. They exist to remove player-facing capsules/spheres, exercise semantic hit zones, and let the gameplay and package pipeline be verified before licensed source models arrive.

### Evaluated External Character Reference

Quaternius's **Universal Base Characters** page describes six game-ready base characters, 20 hairstyles, an average 13,000-triangle model, humanoid retargeting, FBX/glTF exports, and compatibility with Unreal, Unity, and Godot: https://quaternius.com/packs/universalbasecharacters.html. The selected free standard archive includes `CC0 1.0 Universal (CC0 1.0) Public Domain Dedication` and identifies Quaternius as the model creator; that exact license is preserved at `frontend/public/assets/packages/characters/universal-male/LICENSE-QUATERNIUS-CC0.txt`. Acquisition and transformation details are recorded in `docs/PRODUCTION_ART_SOURCES.md` and `docs/PRODUCTION_ART_PACKAGE_V1.md`.
