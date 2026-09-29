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

`process.mjs` is a global scan, not a per-file command. It reads staged source images across `frontend/public/assets`, copies masters to ignored `art-src/`, writes optimized derivatives, removes staged originals, and regenerates the whole runtime manifest. Inspect the dry-run and repository status before `--write`; stop if the plan includes unreserved work.

The audit blocks missing files, required-alpha failure, green fringe over threshold, class oversize, and budget overflow. It warns on orphan files. Treat new orphan warnings as failures unless the files are intentionally excluded from runtime.

## Resolver proof

Add or update focused tests that:

1. request the exact role/context/state;
2. assert the resolver returns the new manifest URL;
3. assert missing states follow the documented fallback chain;
4. assert every returned file exists and is preloaded when needed;
5. assert a component never embeds a raw `/assets/...` URL when a resolver contract exists.

## 3D package proof

A character package must satisfy `contracts/character-package.schema.json`: source editable files, runtime Babylon GLB, skeleton axes/unit scale, named six-part hit zones, all 14 required movement/combat/cover animation clips, LODs, and provenance. Validate it with `assets:packages`, then prove tactical, first-person, and third-person traversal, possession/member switch, firing, reload, downed state, exactly-once result application, and return to strategy. A standalone turntable is not acceptance.

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
