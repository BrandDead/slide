# Production Art V1 — Verification

**Branch:** `feat/production-art-package-v1`
**Date:** 2026-08-29

## Automated Gates

| Gate | Result |
|---|---|
| ESLint | 0 errors; 194 pre-existing warnings |
| TypeScript | Passed |
| Vitest | 48 files, 708 tests passed |
| Runtime image and package budget | 110 manifest assets plus 13 package files; 7.38 MB / 20 MB; 0 errors; 0 warnings |
| Package schema validation | 5 packages against 4 schemas passed |
| Production build | Passed in 23.22 seconds after browser/acquisition process cleanup |
| Backend offline pytest | 42 passed; 93 existing `datetime.utcnow()` warnings |

The first production-build attempt terminated during chunk rendering under sandbox memory pressure after all frontend tests and asset gates had passed. No code change was made to conceal it. The temporary development server and completed acquisition browsers were stopped; the identical production source then built successfully with 2.8 GB available.

## Live WebGL2 Gauntlet

The reusable `scripts/verify-showdown.mjs` gate now resolves its output directory relative to the repository and requires the loaded canvas package ID to equal `character.universal-male.pipeline-v1`.

| Interaction | Result |
|---|---|
| Real strategy shell to 1208 Strip and OPS 3D launch | Passed |
| Production character package active | Passed |
| Third-person possession | Passed |
| Possession transfer: Lil Dre → Kilo | Passed |
| First-person camera and physical fire | Passed |
| Tactical commander camera | Passed |
| Retreat result generated | Passed |
| Result applied once to block | Passed |
| Return to strategy view | Passed |
| Fatal local runtime exceptions | 0 |

Final screenshots are stored in `docs/evidence/production-art-v1/`.

## Asset Pipeline Gates

The runtime package is 1,358,092 bytes and contains 65 named joints plus 12 animation groups. A unit test enforces a GLB smaller than 1.5 MB, CC0 provenance, zero engine restrictions, named head/arm hit-zone mapping, and required fire, reload, and downed clips. The package validator verifies the runtime JSON against `character-package.schema.json` and confirms the referenced GLB exists.

The asset audit now counts all files under `public/assets/packages` in the global shipping budget without treating package manifests, licenses, PBR maps, or GLBs as unregistered image orphans.

## Honest Visual Gate

The final captures prove the rigged-character and PBR pipeline but do not meet the cinematic visual target. The free source character’s superhero costume is unsuitable for recognizable street members. Two bone-attached primitive-clothing experiments were tested and removed after live TPS review because they degraded silhouette. The next character must be licensed or commissioned against the package contract and judged in all three cameras.
