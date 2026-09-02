# Production Art Package V1

**Status:** Implemented on `feat/production-art-package-v1`
**Scope:** One legally portable rigged-character pipeline plus CC0 PBR surfaces for the 1208 Las Olas Babylon comparison client.

## Outcome

The Modern Ops renderer now loads a strict character package before the scene becomes ready. The package contains a real 65-joint humanoid rig and 12 selected gameplay animation groups in one optimized GLB. Every deployed combatant receives an independently animated rig, physical hit proxies attached to named bones, a visible weapon attached to the right-hand bone, shadows, and the existing selection marker. If any manifest, GLB, skeleton, or animation requirement fails, the scene keeps the previously verified articulated fallback and records a diagnostic instead of crashing.

The 1208 street now uses compact CC0 asphalt, concrete, and brick color, OpenGL-normal, and roughness maps. These replace flat colors while preserving the authoritative grid, cover metadata, vehicle metadata, line-of-sight, cameras, and result boundary.

| Package component | Runtime result |
|---|---:|
| Optimized rigged character GLB | 1,358,092 bytes |
| Character skeleton | 65 joints |
| Included animation groups | 12 |
| CC0 PBR maps | 9 WebP files, approximately 278 KB |
| Total package directory | 13 files, 1.57 MB |
| Global shipped asset total | 7.38 MB of 20 MB |
| Package schemas validated | 5 packages across 4 schemas |

## Included Character States

| Semantic state | Packaged animation |
|---|---|
| Idle | `Idle_Loop` |
| Walk | `Walk_Loop` |
| Sprint | `Sprint_Loop` |
| Crouch | `Crouch_Idle_Loop` |
| Aim | `Pistol_Aim_Neutral` |
| Fire | `Pistol_Shoot` |
| Reload | `Pistol_Reload` |
| Hit | `Hit_Chest` |
| Downed | `Death01` |

The package contract also supplies controlled fallbacks for strafe, aim-walk, and cover transitions until an authored final rig includes dedicated clips.

## Runtime Architecture

`build-character-package.mjs` verifies that the base model and animation source have identical joint-name sets, copies only required animation channels, deduplicates and prunes data, and emits one intermediate GLB. The documented optimization pass converts textures to 512-pixel WebP while disabling mesh compression, simplification, joining, flattening, instancing, and palette operations that could disturb the rig or named bones.

`loadPackagedCharacterTemplate()` loads the GLB once into a Babylon `AssetContainer`. It validates every animation required by the package, then clones the skeleton and animation groups for each combatant. Renderer-visible meshes are non-pickable; invisible boxes attached to the authored head, torso, arm, and leg bones provide stable renderer-neutral hit-zone candidates. This prevents texture or mesh changes from altering the shared damage contract.

The canvas exposes only the active package ID as a diagnostic. The browser gauntlet requires `character.universal-male.pipeline-v1` before accepting the TPS, FPS, tactical, possession, firing, result, and return evidence.

## Provenance and Reproducibility

The character and animations are from Quaternius CC0 standard packages. The runtime package includes the creator-provided CC0 license. The road, concrete, and brick maps are from ambientCG CC0 archives, with per-source archive and runtime-file checksums in `pbr-sources.json`. Acquisition references and source checksums are recorded in `PRODUCTION_ART_SOURCES.md`.

No marketplace, ripped GTA/FiveM content, login-bound Mixamo asset, or unverified mirror is included. The source archives are deliberately excluded from Git; the repository contains the deterministic build tools, optimized runtime package, exact license, package manifest, and provenance locks.

## Verification

The isolated live-browser gauntlet proved all of the following in WebGL2:

| Gate | Result |
|---|---|
| Production package active | Passed |
| Third-person possession | Passed |
| Switch from Lil Dre to Kilo | Passed |
| First-person camera and firing | Passed |
| Tactical commander view | Passed |
| Result produced and applied once | Passed |
| Return to strategy block | Passed |
| Fatal local runtime exceptions | 0 |

The focused unit test verifies the shipped manifest, CC0 license, engine portability, named skeleton hit zones, fire/reload/downed clips, and a GLB smaller than 1.5 MB. Package validation and global asset-budget auditing are part of the existing quality gate.

## Visual Limitation and Decision

The free standard character is a pipeline stand-in, **not final art**. Its only male full-body option is a bare-torso superhero model. Two procedural streetwear overlay experiments were rejected after live TPS review because their bone-local orientation produced inferior silhouettes. Those overlays are not included.

This milestone proves that a commissioned or licensed clothed member can drop into the game without rewriting combat, possession, hit resolution, animation dispatch, FPS/TPS/tactical cameras, or persistence. The next paid or commissioned deliverable should target this exact contract:

| Required final deliverable | Acceptance gate |
|---|---|
| One recognizable clothed hero | Matches Contacts identity in face, hair, silhouette, and palette |
| One visually distinct rival | Reads correctly at tactical and TPS distances |
| Same 65-bone-compatible or mapped rig | Imports through package validation without gameplay changes |
| Dedicated locomotion and gun set | Idle, walk, sprint, aim, aim-walk, fire, reload, hit, downed, crouch, and cover |
| Named hit bones and right-hand weapon socket | Passes existing physical-ray browser test |
| Source and cross-engine rights | Editable source, FBX/GLB, no engine restriction, commercial redistribution in compiled game |
| Web LOD0 | Under 65,000 triangles, 120 bones, 2–4K source textures with a 512–1024 web export |

The user should approve a final character source only after it is tested against this package, not on screenshots alone.
