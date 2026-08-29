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
