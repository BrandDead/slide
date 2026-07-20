# Target-versus-Implementation Comparison

## What the supplied target actually is

The strongest supplied Las Olas and neighborhood references are **not simple top-down maps**. They are cinematic, oblique tactical boards: a fixed high-angle camera, an authored ground plate, readable street and sidewalk zones, realistic material response, wet-night lighting, localized signage, depth-ordered props, and a restrained game overlay. The board feels expensive because every visible element agrees on the same camera, world scale, lighting direction, and color grade.

The supplied character and vehicle art is high-resolution concept/source art, not yet a coherent runtime set. The black sedan demonstrates the desired material fidelity, but its shipped top-down file has a baked checkerboard background and no alpha channel. Several supplied character images are front-facing or street-level views, while the desired battle requires overhead or oblique tactical poses. They communicate finish and wardrobe, but most cannot be placed directly into the board without camera-matched derivatives.

The comic-style `concept_block_board.webp` is a second, materially different direction. It is clear and game-readable, but its linework and cel shading do not match the photoreal Las Olas board. The project must choose one as the **world rendering style** rather than alternating between them inside the same battle.

## Side-by-side gap

| Dimension | Supplied target | Current main | Unmerged V3 branch | Required decision |
|---|---|---|---|---|
| Camera | Fixed oblique tactical camera with visible facades and roofs | Orthographic CSS grid plus separate side-on Canvas street modes | Side-on procedural street scene; not the tactical board | Standardize one tactical camera and derive every world asset from it |
| Location | Recognizable, authored Las Olas scene with signage and neighborhood identity | Generic gradients, one strip-plaza image, Mapbox recon, or seeded rectangles | Stylized procedural “Las Olas” with generic facade coordinates | Build a per-address location package; Mapbox remains selection/recon, not final battle art |
| Characters | Camera-matched tactical actors with readable silhouettes | Emoji, colored circles, a one-frame legacy sheet, or Canvas stick/rounded bodies | One legacy frame while standing; ragdoll only after impacts | Produce a rigged multi-direction actor set with an animation contract |
| Vehicles | High-fidelity, camera-matched vehicle with clean cutout and damage states | Emoji, CSS shapes, or procedural Canvas geometry | Procedural Canvas car with damage regions | Retain damage-state logic but bind it to clean vehicle layers/meshes |
| Animation | Directional movement, aiming, firing, reactions, dodging, downed states | CSS bobbing, token motion, and disconnected one-off hit art | Stronger impact/ragdoll behavior but no locomotion/aim/fire animation set | Add actor state machines and atlas/rig playback before expanding content |
| Effects | Lighting-integrated flashes, smoke, debris, shadows, and environmental response | Many effects exist, but they float over placeholder geometry | Useful material impacts, persistent decals, particles, shake, destruction | Merge and retain V3 effects, then composite them against authored art |
| Interface | Sparse tactical labels and markers integrated into world | Multiple neon/monospace themes, dense controls, emoji, and prototype overlays | Same surrounding UI architecture | Use SVG/DOM for markers and HUD only; keep bodies and world in the renderer |
| Asset delivery | Runtime-ready cutouts, matched perspective, consistent states | Source-scale PNGs, broken paths, missing states, no unified preload | Still points standing actors to the old sprite sheet | Enforce validation, atlases, compressed runtime formats, and zero-placeholder release gates |

## Why the current result reads as “Atari” despite expensive source images

The problem is not insufficient image resolution. The frontend ships roughly 276 MB of images, many between 1,920 and 2,752 pixels wide, yet the live battle does not consume the richer manifest or member top-down URLs. The renderer replaces those assets with semantic tokens and procedural primitives. This produces the paradox the user is reacting to: **high-cost concept art exists beside low-cost runtime representation**.

The second issue is that the current 8×8 grid is also the presentation. A tactical grid should be the invisible gameplay model beneath the world. In the target, the player sees a location and the grid merely explains legal positions. In the current implementation, the player sees the grid itself, so scale, depth, cover, street exposure, storefront identity, and cinematic composition never become a convincing place.

The third issue is camera inconsistency. A front-facing full-body character, an orthographic sedan, a side-on street backdrop, an overhead satellite image, and a cel-shaded isometric block cannot be composited into one believable scene. The art pipeline currently asks for each item independently instead of generating or rendering all items from a shared camera-and-lighting specification.

The fourth issue is missing animation coverage. Single images labeled `idle`, `hit`, or `downed` do not form a game animation system. The actor needs direction, timing, pivots, weapon sockets, foot placement, cover alignment, hit regions, and state transitions. Without that contract, the code can only move still images or fall back to shapes.

## Direct answers

**Can the Las Olas block look like the supplied block?** Yes, but only if the team treats Las Olas as a hero **location package**, not as a procedural color theme. The package must include an approved perspective plate, separated foreground and background layers, depth and occlusion masks, playable-zone geometry, prop layers, lighting variants, destruction masks, and a grid-to-world projection. Real-address APIs can locate and seed the block, but they cannot automatically deliver the final cinematic board.

**Can the characters look like the supplied shooters?** Yes, but the front-facing character art must be converted into a consistent tactical actor pipeline. The practical options are a rigged 2D character system, pre-rendered 3D-to-2D directional atlases, or full 3D. For this React browser project, pre-rendered 3D-to-2D atlases or rigged raster meshes inside PixiJS provide the strongest balance of consistency, speed, and browser performance.

**Should the members be animated SVGs?** SVG is excellent for selection rings, role badges, path arrows, health bars, muzzle indicators, and other interface overlays. It is a poor match for the supplied photoreal characters: detailed photographic bodies become huge, hard-to-rig vector files, and AI-generated raster limbs do not magically become clean SVG anatomy. If the world direction is cel-shaded vector art, animated SVG/Rive can be viable. If the approved Las Olas target remains photoreal/painted, use raster atlases or mesh-rigged textures for actors and reserve SVG for the tactical interface.

**Should top-down happen before first-person?** Yes. Top-down should become the canonical combat layer because it expresses placement, street exposure, cover, income risk, morale, heat, and multiple gang members simultaneously. First-person should be an optional intervention or replay mode—such as taking one critical shot, escaping a slide, or watching a CCTV/bullet-cam replay—not the only place where combat appears alive.
