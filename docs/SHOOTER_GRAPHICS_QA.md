# Shooter Graphics QA — 2026-07-16

## Verified build

The integrated `agent/mvp-readiness` branch renders the Las Olas drive-by combat scene successfully in a clean production build. The opt-in QA entry was built with `VITE_ENABLE_GRAPHICS_LAB=true` and captured at 1440 × 900 after five seconds of runtime.

## What is visibly working

The scene presents a coherent 2.5D nighttime shooter style rather than placeholder UI. It includes the 1208 Las Olas block frontage, street and sidewalk depth layers, a moving drive-by vehicle, role-based gang-member sprites, health/name indicators, environmental cover, street signage, lighting, bullet impacts, and a combat-focused crosshair interaction surface. The darker palette, vignette, warm street lights, storefront silhouettes, and burgundy HUD accent establish a consistent crime-strategy/combat direction.

The renderer is connected to the real `BlockDriveByEngine`, not a disconnected concept image. It accepts actual crew placements and drive-by events, processes attacker and defender shots, supports destructible surfaces and vehicle damage, and integrates the impact and ragdoll engines already covered by automated tests.

## Remaining art risks before broad marketing

The graphics are sufficient for a closed paid alpha and MVP validation, but not yet final launch art. Character sprites are small relative to the scene, some labels overlap geometry, distant figures can be difficult to read on mobile, and the procedural storefronts need additional landmark variation if multiple real-world blocks are shown. The next visual pass should prioritize combat readability, hit feedback, mobile composition, and reusable scene kits before producing more neighborhoods.

## QA-only route

A new opt-in graphics lab exercises the real renderer without bypassing production authentication. It is available only when the build flag `VITE_ENABLE_GRAPHICS_LAB=true` is supplied and the URL includes `?graphicsLab=shooter`. Normal builds and normal URLs continue through the production application entry.

## Evidence

The verified frame is saved as `docs/shooter-graphics-lab.png`.
