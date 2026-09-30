# Runtime contracts and gates

## Canonical paths

| Purpose | Path |
|---|---|
| Unshipped editable/source masters | `art-src/` |
| Optimized runtime images | `frontend/public/assets/runtime/` |
| Runtime image metadata | `frontend/src/assets/runtimeManifest.json` |
| Runtime character/block packages | `frontend/public/assets/packages/` |
| Package schemas | `contracts/*.schema.json` |
| Role/context resolver | `frontend/src/services/assetResolver.ts` |
| Manifest-driven actor resolver | `frontend/src/render/worldActorResolver.ts` |
| Asset processor | `frontend/scripts/assets/process.mjs` |
| Image audit | `frontend/scripts/assets/audit.mjs` |
| Package validator | `frontend/scripts/assets/validate-packages.mjs` |
| Provenance and integration log | `ASSETS.md` |

## Runtime class contract

These values come from `process.mjs`; inspect the file again if it changes.

| Class | Directory signal | Max edge | Alpha | Pivot |
|---|---|---:|---|---|
| actor street/fullbody | `characters/street`, `characters/fullbody` | 640 | required | `(0.5, 1.0)` |
| actor topdown | `characters/topdown` | 384 | required | `(0.5, 0.5)` |
| portrait | `characters/portraits` | 512 | expected | `(0.5, 0.5)` |
| vehicle topdown | `vehicles/topdown` | 512 | required | `(0.5, 0.5)` |
| vehicle street/damage | `vehicles/street`, `damage`, `overlays` | 768 | required | `(0.5, 1.0)` |
| weapon/product icon | `weapons`, `products` | 256 | required | center |
| UI icon | `ui/icons`, `assets/icons` | 192 | expected | center |
| effect | `effects` | 512 | required | center unless an effect-specific origin is documented |
| environment topdown | `environments/topdown` | 1536 | full bleed | center |
| environment street | `environments/street` | 1920 | full bleed | `(0.5, 1.0)` |

The global shipped runtime/package budget is 20 MB unless an approved exception with a reason changes it. Do not add an exception merely to pass CI.

## Naming

Use a stable descriptive versioned name:

```text
character_<role>_<identity>_<view>_<state>_v001.webp
vehicle_<type>_<identity>_<view>_<state>_v001.webp
block_<location-id>_<view>_<lighting>_v001.webp
fx_<effect>_<view-or-state>_v001.webp
icon_<app-or-action>_v001.webp
```

Use a new version when pixels materially change. Keep role/state tokens compatible with `process.mjs` and resolver tests. Do not overwrite history under an existing version when a PR already references it.

## Processing and verification

From `frontend/`:

```bash
# inspect plan without mutation
node scripts/assets/process.mjs

# after scope review, produce approved runtime derivatives and manifest
node scripts/assets/process.mjs --write

npm run assets:audit
npm run assets:packages
npm run validate
npm run build
```

`process.mjs` is a global scan, not a per-file command. It reads staged source images across `frontend/public/assets` and merges their registrations into the existing manifest by ID. It verifies retained files, counts the complete runtime/package budget, and finishes planning before mutation. Approved writes copy masters to ignored `art-src/`, write optimized derivatives and the merged manifest, then remove staged originals. A no-source write does not rewrite the manifest. Inspect the dry-run and repository status before `--write`; stop if the plan includes unreserved work. Missing registered files and budget overflow must fail without consuming input. Do not prune registrations merely because their source is no longer staged.

The audit blocks missing files, required-alpha failure, green fringe over threshold, class oversize, and budget overflow. It warns on orphan files. Treat new orphan warnings as failures unless the files are intentionally excluded from runtime.

## Resolver proof

Add or update focused tests that:

1. request the exact role/context/state;
2. assert the resolver returns the new manifest URL;
3. assert missing states follow the documented fallback chain;
4. assert every returned file exists and is preloaded when needed;
5. assert a component never embeds a raw `/assets/...` URL when a resolver contract exists.

## Character-package GLB proof

A character package must satisfy `contracts/character-package.schema.json`: source editable files, runtime Babylon GLB, skeleton axes/unit scale, named six-part hit zones, all 14 required movement/combat/cover animation clips, LODs, and provenance. Validate it with `assets:packages`, then prove tactical, first-person, and third-person traversal, possession/member switch, firing, reload, downed state, exactly-once result application, and return to strategy. A standalone turntable is not acceptance.

## Block/environment-package GLB proof

Use `contracts/block-package.schema.json`, not the character schema. Report the package's editable source paths, runtime GLB, provenance, and actual consumer/loader. If no runtime loader consumes this package type yet, report integration as incomplete; do not invent acceptance from a schema pass.

1. Compare `blockId` and `dnaId` to the existing claimed block. Record the authoritative grid before and after load, placement, encounter return, and fallback. Art must not rewrite persisted terrain or legal cells.
2. Verify `gridProjection.width`, `height`, `cellSizeMeters`, `origin`, `xAxis`, and `yAxis` against the actual GLB units/orientation and current grid helpers. Check both a corner and an interior cell in the live scene; legal placement and navigation must still use canonical passability and occupancy.
3. Check every anchor's `gridPoint` bounds and legal role, plus its world `position`/rotation against loaded geometry. Capture crew/opposition spawns, cover, objectives, extraction, vehicles, interaction/navigation, and occlusion anchors that the package contains. A JSON coordinate with no corresponding live geometry is not proof.
4. Match `lighting.profileId`, time, weather, wetness, and any reflection probes to the live materials and approved reference. Inspect actor grounding and foreground occlusion at final size.
5. Measure download bytes including referenced textures, loaded triangle/material counts, peak rendered draw calls, and texture memory with the loader/engine's inspector or instrumentation. Record the measurement method and values next to each of `maxDownloadBytes`, `maxTriangles`, `maxMaterials`, `maxDrawCalls`, and `maxTextureBytes`. Declared maxima and file existence are not measurements. Include all shipped package files in the global 20 MB audit.
6. Exercise the real entry route at 390×844 and 1440×900, then force a missing/failed GLB request. The documented loader fallback must retain the Strip, recon, claim/placement controls, canonical grid, and safe encounter return. Prove one result receipt and no repeated consequence application after reload. Attach live captures, network/error evidence, and grid comparisons.

Run `assets:packages`, `assets:audit`, focused loader/projection tests, full validation, and production build. Acceptance requires the live geometry, measured budget, and recovery proof as well as a schema pass; a concept render or isolated turntable is insufficient.

## Visual evidence sheet

Capture, at minimum:

| Capture | What it proves |
|---|---|
| Alpha checker + dark/bright backgrounds | clean edges and transparency |
| Final-size contact/tactical/street use | readability and correct scale |
| Idle + action + hit/down state | continuity and state coverage |
| Behind/in front of scene occluders | depth ordering and pivot |
| 390×844 | phone layout and safe-area reachability |
| 1440×900 | desktop composition |
| Failure/fallback | honest missing/unavailable behavior |
