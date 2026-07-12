# SLIDE Graphics Upgrade — 1208 / Las Olas

## What this branch changes

This branch replaces the generic scrolling city strip used during drive-bys with a resolution-independent **South Florida tropical-noir block scene** identified as **1208 / Las Olas**.

The address supplied for the scene is stored as a stylized reference rather than treated as verified building geometry. The visual system is deliberately data-driven so exact photography, Street View references, LiDAR, or photogrammetry can replace the procedural storefronts later without rewriting combat.

## Implemented graphics systems

### Destructible environment

- Persistent bullet holes and material-specific damage decals
- Glass cracks, directional shards, and broken-window states
- Concrete and asphalt chips, dust, and debris
- Metal sparks, dents, and damage integrity
- Wood splinters
- Breakable storefront windows, doors, and light poles
- Smoke and camera shake on heavy impacts
- Typed-array particle pool sized for dense firefights

### Vehicle damage

- Separate hit regions for front window, rear window, front door, rear door, and body
- Bullet holes remain attached to the moving vehicle rather than floating in world space
- Door and body dents
- Window cracking followed by full breakage
- Glass fragments and metal sparks based on the panel hit
- Progressive body integrity and engine smoke

### Character reactions

- Articulated 14-joint ragdolls
- Verlet physics, gravity, drag, body constraints, and floor collision
- Hit impulses originate from the attack direction
- Non-lethal hits produce temporary physical reactions and recovery
- Lethal accumulated visual damage leaves the member downed
- Existing gang-member sprites remain the standing pose; ragdolls take over only during impacts

### Rendering direction

- Palm-lined boulevard
- Humid atmospheric haze
- Sun-faded stucco and boutique storefront glass
- Las Olas street sign and 1208 location marker
- Sodium-vapor highlights, dark asphalt, warm moon, and luxury-noir color grade
- Procedural scene scales to different canvas sizes and device pixel ratios

## Important coordinate repair

The existing drive-by logic stores enemy shots using 8×8 block-grid coordinates, while player shots use canvas pixels. The previous renderer treated both formats as pixels, so a shot aimed at grid cell `(3, 6)` could create an impact near the upper-left corner instead of on the selected member.

The V3 renderer detects the coordinate format, resolves grid shots to the correct member, calculates a body hit point, and only then applies blood, damage, ragdoll impulse, or an environmental miss.

## Files

- `frontend/src/config/lasOlas1208Scene.ts`
- `frontend/src/utils/ImpactEngine.ts`
- `frontend/src/utils/RagdollEngine.ts`
- `frontend/src/components/slide/CanvasStreetRendererV3.tsx`
- `frontend/src/components/slide/CanvasStreetRenderer.tsx` compatibility entrypoint

## Exact-block asset capture needed for the next fidelity pass

To convert the stylized block into a recognizable digital twin, collect:

1. One straight-on photo of each storefront or house facade
2. Both corner approaches looking down the block
3. Road, curb, sidewalk, pole, sign, fence, tree, and parked-car details
4. Day and night lighting references
5. Approximate building widths and distances between major landmarks
6. A confirmed map pin for the intended 1208 block

The renderer can then be upgraded with layered facade atlases, normal maps, parallax depth cards, occlusion masks, and exact collision/destruction masks.

## Recommended next graphics sprint

1. Replace fallback gang figures with eight-direction animated character sheets for every role.
2. Add per-limb hit zones and weapon-specific impulses.
3. Add parked vehicles, dumpsters, fences, poles, AC units, newspaper boxes, and street clutter as individual destructible props.
4. Add day, sunset, rain, and night variants of the same block.
5. Add pooled debris bodies that persist briefly on the sidewalk and road.
6. Add a WebGL lighting/compositing pass after gameplay behavior is stable.
