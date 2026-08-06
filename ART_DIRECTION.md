# SLIDE — Established Art Direction

Reference notes captured from the merged art system so new sprites match rather
than clash. Derived from inspecting `runtimeManifest.json` and the on-disk source
art, not from guesswork.

## Which merge established this

The graphics turning point was **not a single PR** — it was a chain:

| PR | Date | What it established |
|---|---|---|
| **#49** (closed, folded into #58) | Jun 2026 | The GTA-style dark cinematic direction and 21 initial art assets |
| **#58** MEGA MERGE | 2026-06-26 | Landed #49's visual overhaul into `main-tL2525` alongside TopDownShooter and ContactProfile |
| **#82** | 2026-07-20 | Repaired `assetManifest`, landed the graphics audit docs |
| **#83** | 2026-07-20 | Wired the generated art library into live renderers via `assetResolver` |
| **#84** | 2026-07-31 | **The real structural win.** Runtime image payload 276 MB to 4.03 MB, added `gridConfig.ts`, `projection.ts`, `worldActorResolver.ts`, and a build-time asset pipeline with an audit gate |
| **#93** | 2026-08-02 | Phaser 3 top-down block scene consuming the sprites, plus police sprites |

The one that "really made a difference" is **#84** — it replaced ad-hoc
per-renderer coordinate math with a shared projection layer and made the manifest
incapable of drifting from disk. #58 set the *look*; #84 made the look shippable.

## The look

Photoreal-leaning digital painting, not pixel art. Near-monochrome.

- **Palette**: black and charcoal clothing, desaturated. Skin and a weapon's
  metal are effectively the only chroma in frame.
- **Wardrobe**: hoodies, balaclavas and ski masks, tactical plate carriers,
  cargo pants, work boots. Straps, webbing, pouches.
- **Lighting**: soft top-down key, low contrast, no rim light, no glow. Reads as
  overcast rather than neon.
- **Rendering**: fabric weave and leather scuffing are visible. Matte finish
  throughout — nothing is glossy.
- **Background**: pure white matte, keyed out at build time by
  `scripts/assets/process.mjs`. Never generate on a coloured or transparent
  background; generate on white.

## Technical contract

| Property | Street / fullbody | Top-down |
|---|---|---|
| Source resolution | 1536 x 2304 (2:3 portrait) | 1920 x 1920 (1:1) |
| Runtime resolution | 427 x 640 | 384 x 384 |
| Runtime format | `.webp` | `.webp` |
| Pivot | (0.5, 1.0) foot contact | (0.5, 0.5) centre |
| Background | white, keyed at build | white, keyed at build |

Naming: `character_{role}_{sex}_{view}_{state}_v001.png`
Location: `frontend/public/assets/generated/characters/{view}/`

The audit gate (`frontend/scripts/assets/audit.mjs`) fails the build if the
manifest declares a path that is not on disk, so new art must be added to disk
and the manifest regenerated together.

## Camera angles

- **street**: eye-level, full standing figure, front or three-quarter facing.
  This is the drive-by and block view.
- **topdown**: steep overhead, roughly 70-80 degrees, not a true 90-degree
  bird's eye. The shooter reference shows the top of the hood, both shoulders,
  and the boots — you can still read the weapon and the pose. Match this angle
  exactly or figures will not sit correctly on the satellite ground plane.
- **fullbody**: eye-level neutral A-pose for roster cards.

## Coverage

Run `python3 scripts/sprite_gaps.py` from the repo root for a live matrix.

### Before batch 2

87 of 98 (view, role, state) slots empty and silently falling back.

- **street**: `lookout`, `driver`, `recruit`, `k9` had zero poses
- **topdown**: every role had one sprite but **`state` was `null` on all of
  them**, because the first-generation filenames carried no state token. The
  resolver only indexes assets with both a role and a state, so a downed or
  arrested member rendered **standing upright** in the raid and block scenes
- **fullbody**: `recruit`, `k9` missing

### After batch 2

62 of 98 remaining, and no role has zero art in any view.

Added: top-down `downed` and `arrested` for shooter/dealer/enforcer/lookout;
`k9` across all three views plus a street `alert`; `recruit` across all three;
street `idle` for shooter, dealer, lookout and driver.

Also renamed the six stateless top-down sprites to declare `idle`
(`scripts/name_topdown_states.py`), which is what actually repaired the
standing-when-downed bug — new art alone would not have fixed it.

### Still open, in priority order

1. `walk` in both views for every role — nothing animates while moving
2. `aim` in top-down for shooter and enforcer — raid scenes cannot show a
   member returning fire
3. street `fire` and `reload` for shooter and enforcer
4. `arrested` in the street view for every role
5. `seated` and `driving` for `driver`, needed by the drive-by car interior

## Role isolation rule

`k9` and `police` declare single-entry `ROLE_CHAIN` arrays in
`worldActorResolver.ts`. A single-entry chain sets `isolated = true`, which
suppresses the cross-role Pass 2 search. Without that guard a `k9` resolves to
a hooded man and a `police` unit resolves to a gang shooter — both actively
misinform the player about what is on the tile. Prefer returning `null` and
letting the caller draw a placeholder.

When adding a new non-gang actor, give it a single-entry chain and add its
role token to `ROLES` in `frontend/scripts/assets/process.mjs`, or the manifest
will record `role: null` and the sprite becomes unreachable.
