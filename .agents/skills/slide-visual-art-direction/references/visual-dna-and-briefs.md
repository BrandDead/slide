# Visual DNA and production briefs

## Canonical tactical scene contract

The approved target is not a flat map, generic cyberpunk alley, or raw satellite view. It is an authored, location-specific tactical diorama: a fixed high oblique camera reveals roofs, facades, sidewalk, street, cover, and depth. The tactical grid explains legal positions without becoming the picture.

Use a versioned live hero-block capture as the camera reference. Reproduce it from the assignment's exact integration commit:

1. In a fresh browser profile, start `VITE_DEMO_MODE=1 npm run dev -- --host 0.0.0.0` from `frontend/`. Open the local app, affirm the 18+ gate, and enter the deterministic demo.
2. Open the desktop MAP app (or `?app=map` in demo mode), then Strip → Diorama and select the seeded 1208 W Las Olas block (`dnaId: las-olas-1208`). The desktop STRIP icon opens the separate loop desk. Confirm that the visible component is `TacticalDiorama`; record the route/query, selected block ID, seed, viewport, device-pixel ratio, and source commit.
3. Capture the entire live screen at 1440×900 and 390×844, with crew, placement/grid overlay and HUD visible. Also capture the unobstructed scene crop from the same frame. Record the actual `.td-stage` width/height: the seed uses stage dimensions, not the viewport. Save under `docs/evidence/<date>-<issue>/hero-tactical-<viewport>.png` with a capture note. Review and approve this exact capture in the assigned issue before art generation.
4. Put that versioned path and commit in every production brief and supply the image when the model supports grounding. If a camera/renderer change invalidates it, recapture and obtain the integration owner's reference decision before deriving more states.

`docs/concept-art/gta_block_board.png` and `docs/concept-art/1208_w_las_olas_block.webp` remain historical visual-direction references. They are not interchangeable live camera measurements. Neither overhead art nor a Babylon FPS/TPS capture substitutes for the approved tactical frame. All generated world elements must match the chosen frame's projection; words such as “top down,” “isometric,” or “aerial” alone are not enough.

This is the contract for `TacticalDiorama`, tactical plates, and tactical sprites—not every camera in the game. Modern Ops/Babylon FPS and TPS assets must match that route's current live capture and camera. The approved Modern Ops target is over-the-right-shoulder. Never reuse a tactical sprite, street sprite, FPS arms asset, TPS character, or environment plate across camera modes merely because the subject is the same.

### World qualities

| Dimension | Required |
|---|---|
| Place | Fictionalized district with specific climate, construction, vegetation, signage scale, road markings, and street furniture |
| Camera | One fixed high-oblique contract for the entire tactical package |
| Lighting | Night-biased, motivated practical light, readable shadow side, wet-surface response; visibility before mood |
| Grade | Near-black/charcoal base, restrained red/green/gold status accents, limited cyan/magenta environmental accents |
| Materials | Asphalt, concrete, glass, painted stucco/brick, metal and fabric remain physically distinguishable |
| Density | Enough depth and identity to feel authored, but clear lanes, cover, targets, and click areas |
| Content | Fictional people, crews, brands and signs; no real gangs or copied real identities |

## Character package brief

Create a fictional adult with a role-readable silhouette before small details. Clothing must be believable, layered, animation-friendly, and distinct at tactical size. Avoid costume stereotypes, luxury-brand logos, excessive chains, intricate micro-patterns, loose straps that change between frames, and weapon poses that hide the body.

Identity continuity anchors:

- face geometry, skin tone, hair and facial hair
- body proportions and height class
- complete wardrobe with fixed colors/materials
- footwear silhouette
- role prop/weapon dimensions and dominant hand
- light direction and color temperature

2D source inventory:

| Use | Source target | Runtime target | Pivot |
|---|---|---|---|
| Contact portrait | Square head-and-shoulders identity image | 512×512 WebP | center |
| Street/fullbody | Full figure on transparent canvas | max edge 640 WebP | `(0.5, 1.0)` |
| Tactical actor | Camera-matched full silhouette on transparent square | max edge 384 WebP | `(0.5, 0.5)` |

Do not imply that separate generated poses are an animation. An animation package needs consistent timing, feet, center of mass, facing/directions, sockets, and transitions. For a 3D package, follow `contracts/character-package.schema.json`: skeleton axes/scale, six hit zones, required clips, LODs, weapon sockets, source files, runtime GLB, and provenance.

## Environment package brief

Treat each block as a package, not one backdrop. Plan:

1. approved high-oblique hero plate
2. background and foreground/occluder layers
3. depth/occlusion mask
4. passable, cover, street-exposure and spawn alignment against Block DNA
5. prop and vehicle layers
6. lighting variant(s) only when gameplay uses them
7. damage/destruction masks only when the renderer consumes them

The plate cannot change a claimed block's authoritative Block DNA. Art follows the stored terrain/grid; it does not silently redesign gameplay.

Runtime targets: environment topdown max edge 1536; street plate max edge 1920. Full-bleed plates do not need alpha. Separated props and occluders do.

## Vehicle brief

Generate a clean fictional vehicle design sheet first. Derive each view from the approved geometry. Match the scene camera and wheelbase; keep windows, lights, body panels, damage zones, and color stable. Topdown and street sprites require transparent backgrounds. Deliver intact plus only the damage states the live renderer uses.

## Effects brief

Effects must inherit scene perspective, light color, scale, and duration. Use transparent layers. Keep the gameplay origin/pivot obvious. Do not bake characters, weapons, background, camera shake, bloom, or HUD into an effect sprite. Effects should clarify fire/hit/damage, not cover the target.

## UI and icon brief

Use generated images for texture/illustration, not layout, labels, or critical status text. Build controls and text in React/CSS/SVG so they stay accessible, responsive, and editable. App icons share one geometry, border treatment, background depth, light direction, stroke/shape weight, and safe area. Test at the actual 48–64 CSS-pixel size.

## Rejection checklist

Reject if any answer is “no”:

- Does this match the approved camera, scale, light direction, and grade?
- Is the main silhouette readable at final size without zooming?
- Can it be composited without a box, halo, fringe, baked ground, or accidental text?
- Does it preserve identity/geometry across states?
- Does it depict only fictional people, names, organizations, and brands?
- Does it support a current player action or clearly defined near-term state?
- Is the full output inventory present, rather than one showcase image?
- Can the asset integration skill name the resolver, manifest/package contract, and live screen that will render it?
