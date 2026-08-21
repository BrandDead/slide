# Decision Record: Playable Top-Down Territory Map

**Date:** 2026-08-21  
**Author:** Manus AI  
**Status:** Accepted for implementation

## Problem

The current no-token map fallback is a canvas radar: a dark grid with synthetic straight lines and territory pins. It does not render real roads, sidewalks, water, building footprints, or meaningful block geometry. This breaks the game’s central promise that a selected place influences strategy.

## Decision

Adopt **MapLibre GL JS** behind a project-owned map component and use a token-free OpenFreeMap vector style as the development/default basemap. Keep Mapbox geocoding and static-image support where already configured; do not make the playable map disappear when a Mapbox token is absent. MapLibre renders interactive vector-tile maps and exposes map camera, sources, layers, and interaction APIs.[1] OpenFreeMap documents a MapLibre-compatible style URL and OpenStreetMap-derived attribution.[2]

| Candidate | License / access | Player impact | Stack fit | Cost / risk | Decision |
|---|---|---:|---:|---|---|
| Existing radar canvas | Project code | 1/5 | 5/5 | No network, but not a real map | **Replace** |
| Existing Mapbox-only surface | Existing dependency; token required | 5/5 | 5/5 | Hidden when token is missing; vendor account required | **Keep as optional provider/data path** |
| MapLibre + OpenFreeMap | MapLibre BSD-3-Clause; token-free public style | 5/5 | 4.5/5 | New bundle/runtime dependency; public service has no game-specific SLA | **Adopt behind an adapter** |

For production scale, the style/tile URL remains configurable so the game can move to a paid MapTiler/Mapbox deployment or self-hosted tiles without rewriting gameplay code.

## Player Camera Contract

| Mode | Camera | Visible detail | Primary actions |
|---|---|---|---|
| Territory | Zoom 14–16, north-up, top-down | Neighborhood streets, water, districts, player/rival/open blocks | Pan, pinch/scroll zoom, search, select, attack, claim |
| Block inspect | Zoom 17–18 | Selected street block, building footprints, labels, risk/value overlay | Inspect block, open placement, return to territory |
| Placement | Zoom 18.5–20, selected block locked in view | Streets, building massing, sidewalk/street tactical cells, members, cover/exposure | Select member, select valid cell, undo, confirm deployment |

The map initially centers the player’s selected/owned block. Panning does not silently change ownership. A **Home Block** control always returns to it. Selecting another block centers that block for inspection without losing the owned-block identity.

## Tactical Geometry Contract

The basemap is geographic context, not an authoritative property survey. Game placement uses a deterministic, fictionalized tactical overlay derived from the block’s existing grid and scene seed. The overlay is anchored to the selected coordinates and visually aligns street-side, sidewalk, yard/building, and safer rear cells. It must display a fiction notice and must never claim exact private parcel boundaries, entrances, resident identities, or real-world criminal activity.

At close zoom, the player sees:

- basemap roads, water, labels, and building footprints;
- a highlighted selected-block footprint;
- distinct placement zones for street edge, sidewalk, building/frontage, and rear/cover;
- member markers, valid/invalid occupancy states, cover, exposure, projected income, and escape direction;
- an accessible list alternative for placement.

## Implementation Boundary

The map component owns rendering and camera only. Territory state, placement validity, economy, combat preparation, and outcomes remain in existing stores/domain functions. Vendor map objects must not enter Zustand state or persisted saves.

## Acceptance Criteria

The radar fallback is no longer shown. With no Mapbox token, a genuine vector map still renders. The selected Las Olas block remains identifiable after zooming away and returning. Territory zoom exposes nearby blocks; placement zoom exposes streets/buildings and game placement zones. Mouse, touch, keyboard controls, reduced motion, attribution, loading/error recovery, and a non-visual placement alternative remain available. The complete validation suite passes, and mobile performance is measured before merge.

## References

[1]: https://maplibre.org/maplibre-gl-js/docs/ "MapLibre GL JS Documentation"
[2]: https://openfreemap.org/quick_start/ "OpenFreeMap Quick Start Guide"
