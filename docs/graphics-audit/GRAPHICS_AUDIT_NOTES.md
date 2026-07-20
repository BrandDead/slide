# DEALT/SLIDE Graphics Audit — Working Notes

## Scope and visual targets

The user wants an explanation for why the current top-down view does not resemble the supplied polished Las Olas and neighborhood concepts; why characters do not resemble the supplied realistic shooter assets; whether animated SVGs can support shooting, being hit, dodging, and death; and how to turn attacks into watchable top-down RPG shootouts.

Reference images supplied in the task include a black top-down sedan, damaged vehicle pieces, realistic shooter portrait/full-body/hit/downed/enforcer assets, combat FX sheet, FPS HUD, security-camera overlay, Las Olas block board, illustrated block concept, territory concept, and realistic top-down neighborhood concept. Do not reopen these attachments with the file viewer.

## Governing repository information

Source: `/home/ubuntu/slide-audit/AGENTS.md`

The repository is DEALT/SLIDE. Frontend is React/Vite on port 3000; backend is Flask. Production build/preview is the reliable UI route because Mapbox UMD import behavior can blank the dev app. The frontend is gated by Supabase auth unless configured locally.

Source: `/home/ubuntu/slide-audit/frontend/package.json`

The frontend already includes React 18, Framer Motion, Mapbox GL, and Phaser 3. There is no Babylon/Three dependency. Phaser is available but current block presentation is mostly React/CSS/Canvas.

## Declared visual direction versus production requirements

Source: `/home/ubuntu/slide-audit/docs/DESIGN_SYSTEM.md`

The declared identity is “NEON NOIR”: black/glass UI, neon accents, sharp condensed type, and an aesthetic described as iOS glassmorphism meets GTA loading screens. Asset priorities explicitly name 512×512 character sprites (idle + armed), top-down/side vehicle sprites, aerial/street block backgrounds, VFX, and effect animations.

Source: `/home/ubuntu/slide-audit/docs/ASSET_GENERATION_PROMPTS.md`

Prompts primarily request isolated cinematic stills or generic aerial satellite-like scenes. They do not define a production asset grammar: fixed camera pitch/yaw, orthographic scale, common ground plane, per-state registration, pivots, character silhouettes, directional rotations, animation frames, modular environment layers, masks, collision geometry, or color/lighting LUT. The document explicitly discourages illustration/cartoon while some supplied block concepts are illustrated, producing style contradiction. Character prompts are portrait photography rather than gameplay sprites.

Source: `/home/ubuntu/slide-audit/prompts/PROMPT_7_VISUAL_ASSETS_UI_POLISH.md`

This prompt focuses on shared glass cards, meters, icons, CSS theme constants, and Framer Motion micro-interactions. It solves interface consistency, not world rendering, environmental art, character animation, camera, or combat staging. Its proposed `AppIcon` even uses emoji, reinforcing placeholder-like presentation.

Source: `/home/ubuntu/slide-audit/prompts/PROMPT_9_HUB_REDESIGN_COMBAT.md`

The latest master brief recognizes that the hub looks generic and lacks personality. It defines Neon Noir, a top-down/tactical combat concept, and richer combat variables, but the first 500 lines focus far more on UI components and combat math than a shippable scene-rendering pipeline. It describes desired polish but does not establish a consistent world-art production system.

## Exact causes in live code

Source: `/home/ubuntu/slide-audit/frontend/src/components/map/TopDownBlock.tsx`

The current top-down block is explicitly an abstract 8×8 grid. Each tile is a flat color from `ZONE_COLORS`; empty cells show tiny zone labels. Members are circular tokens with a 28px `GameSprite`, role-colored borders, level/health text, and emoji fallbacks. The renderer does not use `block.topdownBgUrl`, buildings, streets, parked cars, sidewalk geometry, lighting, shadows, depth, or location art. New placement data is hardcoded as `memberName: 'Member'` and `role: 'dealer'`, so even identity and role are lost in this path.

Source: `/home/ubuntu/slide-audit/frontend/src/components/map/TopDownBlock.css`

The scene is capped at 420px, with 2px grid gaps, opaque flat cells, 6px labels, and 28px actors. `imageRendering: pixelated` comes from the shared sprite renderer. The composition is designed like a compact board widget, not a cinematic block scene.

Source: `/home/ubuntu/slide-audit/frontend/src/components/common/GameSprite.tsx`

The shared renderer labels itself a pixel-art sprite system. `gang_members.png` is sliced into only four role frames and displayed with `imageRendering: pixelated`. Although the file exports paths for richer portraits, full bodies, top-down assets, street hit/downed states, vehicles, environments, effects, and UI overlays, `TopDownBlock` uses only the legacy role sprite sheet. There is no state machine, direction, animation timeline, or asset-selection logic for generated high-fidelity character states.

Source: `/home/ubuntu/slide-audit/frontend/src/assets/assetManifest.ts`

A stronger asset schema already exists: characters can have portrait, fullbody, topdown, streetIdle, streetAim, streetFire, streetHit, streetDowned, scale, anchor, and hitbox; environments can have top-down and street backdrops; vehicles have top-down/street/damage states. However, the manifest has only one environment package and a few characters. Shooter aim/hit/downed paths incorrectly point to dealer assets, and vehicle overlay filenames do not consistently match the attached/generated paths. This is an incomplete library plus wiring problem, not a total absence of ideas.

Source: `/home/ubuntu/slide-audit/frontend/src/types/block.types.ts`

The data model already includes `BlockPlacement.portraitUrl`, `BlockPlacement.topdownUrl`, `BlockData.topdownBgUrl`, and `BlockData.streetBackdropUrl`. The schema is capable of richer art; the live rendering paths largely ignore these fields.

Source: `/home/ubuntu/slide-audit/frontend/src/components/map/BlockModeView.tsx`

Every newly seeded block receives the same generic grid, fixed Miami coordinates, no environment art URLs, and top-down mode. Deploy selection passes identity/role/level into temporary state, but `TopDownBlock` does not consume that data correctly during placement. Block view simply toggles among generic child renderers.

Source: `/home/ubuntu/slide-audit/frontend/src/components/slide/CanvasStreetRenderer.tsx`

The cinematic drive-by renderer procedurally paints a generic neon sky, repeated silhouette buildings, storefront band, sidewalk, and road. It uses the same four-frame gang-member sheet and draws the car from primitive canvas shapes. It never selects location-specific environment art or the supplied polished car/character packages. This guarantees that even the more active combat view remains generic.

Source: `/home/ubuntu/slide-audit/frontend/src/components/topdown/TopDownShooter.tsx`

The project already contains a large turn-based/top-down combat prototype with units, AP, movement, shooting, cover, reload, hit markers, kill feed, vehicle seat assignments, defender generation, results, loot, heat, and morale. However, its grid generation is abstract; tile visuals and role visuals use text/emoji; it is separate from the block-mode renderer and real location asset system. This is likely the best gameplay foundation to integrate, not recreate.

## Preliminary diagnosis

1. The project has an identity mismatch: cinematic still assets, an illustrated tactical-board concept, a photoreal neighborhood concept, flat Neon Noir UI, and pixelated legacy sprites coexist without a hierarchy.
2. The live renderer is intentionally an abstract grid widget, so it cannot look like the supplied environment concept regardless of CSS polish.
3. Asset presence is mistaken for asset integration. High-quality files exist, but the code path renders the old sprite sheet, emoji, flat cells, and procedural geometry.
4. There is no art bible that defines camera, scale, lighting, perspective, silhouette, palette, alpha treatment, shadow, registration, animation states, and export conventions.
5. Location data and gameplay grid are disconnected. The grid is gameplay truth, but there is no visual projection layer mapping it onto a location-specific block image or modular scene.
6. The first-person/street transition is not the immediate blocker. A strong top-down combat presentation can be the main combat layer first, with first person as a later takeover/replay mode.
7. SVG is useful for HUD markers, selection rings, paths, muzzle-flash vectors, hit indicators, and limited stylized rigs. Fully realistic human animation is better handled with layered raster/WebP sprite sequences, Spine/Rive-style rigs, or 3D; tracing photoreal characters into animated SVG will look like cutout puppetry and can become DOM-heavy.

## Direction to develop next

Recommend one canonical visual stack: a 2.5D orthographic/oblique “tactical diorama” block scene, with a fixed camera and location-specific background/environment package; the 8×8 logical grid becomes an invisible or selectivelyDownShooter.tsx:121-160` generates a 10×10 abstract tile grid and represents terrain with text glyphs.
- `TopDownShooter.tsx:163-170` still represents roles with emoji.
- This is a useful **logic prototype**, not a visual foundation. It should feed a new renderer rather than remain the renderer.

## Preliminary diagnosis

The problem is **not mainly asset quality**. It is an architectural mismatch between the desired product and the live renderer:

1. The target is a location-specific cinematic 2.5D board; the implementation is a 420px color grid.
2. High-quality generated assets are cataloged but not consumed by live gameplay components.
3. The art pipeline intentionally asks for 32×32 pixel top-down sprites, creating the “Atari” look the user dislikes.
4. No immutable camera/perspective/lighting/scale contract binds environments, characters, cars, props, VFX, and UI.
5. The project conflates UI polish (glassmorphism and neon) with game-world art direction.
6. Real addresses are used as labels and coordinates, not as inputs to address-specific environment packages.
7. Characters have isolated images, not animation-ready rigs or coherent state/angle sets.
8. Combat logic exists in multiple isolated components, but no single battle-scene renderer presents it as an observable RPG sequence.

## Direction to validate next

Adopt a **cinematic 2.5D tactical diorama** as the canonical block view: one address-specific oblique block plate, with a calibrated scene coordinate map and lightweight tactical overlay. Render characters as 2D skeletal/cutout actors (SVG only if hand-authored or vectorized into controlled parts; otherwise WebP/PNG atlases or Spine/Rive-style rigs are more practical). Use explicit unit states (`idle`, `walk`, `aim`, `fire`, `hit`, `dodge`, `downed`, `dead`, `reload`, `arrested`) and 8-direction facing or limited 4-direction staging. The current combat systems should drive a deterministic timeline/event stream consumed by this renderer. First-person drive-by can remain a later optional camera, not a prerequisite for the first compelling combat experience.

## Additional library-wide evidence

A parallel audit of 40 graphics-relevant documents and renderers is saved at `/home/ubuntu/audit_graphics_library.json` and `/home/ubuntu/audit_graphics_library.csv`.

Across the planning documents, the graphics direction changes repeatedly: 64×64 pixel art, hyper-realistic photography, GTA-style realism, GTA V cel-shaded semi-realism, CSS glassmorphism, Mapbox satellite imagery, DOM/CSS grids, Canvas 2D, proposed PixiJS, proposed Matter.js, and Phaser. This is not merely variety among mini-games; the project lacks a declared hierarchy separating world art, UI art, replay filters, and minigame-specific treatments.

Key corroborating sources:

- `DEV_PLAN_FORWARD.md` explicitly says the game uses emoji and proposes 64×64 pixel-art replacements.
- `docs/GAMEPLAY_EXPLANATION.md` acknowledges current CSS grids and proposes PixiJS/WebGL plus AI-generated GTA-style assets.
- `docs/FABLE_5_MASTER_PROMPT.md` proposes GTA V cel-shaded semi-realism, PixiJS, skeletal sprites, 2D normal maps, physics, and particles, but it is a proposal, not live architecture.
- `docs/ARCHITECTURE.md` correctly separates the 8×8 authoritative gameplay grid from read-only geographic recon visuals; this separation should be kept and extended into a real visual-projection layer.
- `frontend/src/components/map/StreetBlock.tsx` is a shipped 2.5D DOM layer, but it still uses emoji cars, legacy `GameSprite` actors, and gradient fallback scenery.
- `frontend/src/components/driveby/DriveByEngine.tsx` contains useful particles, parallax, shake, bullet handling, and state transitions, while characters, cars, gun, dashboard, and fallback buildings are mostly Canvas primitive shapes.
- `frontend/src/components/news/SecurityCamRenderer.tsx` has reusable deterministic replay math and CCTV post-processing, but its world geometry is also simple Canvas shapes.
- `backend/python/services/grid_generator.py` already exposes `sprite_key`, `rotation`, and `elevation`; gameplay logic can feed a richer visual layer without being discarded.

## Asset-library quality audit

A deterministic PIL inventory of `frontend/public/assets` is saved at `/home/ubuntu/game_asset_inventory.csv` and `/home/ubuntu/game_asset_inventory_summary.json`.

Measured results:

- 86 image files total, occupying approximately 276.15 MB.
- 80 PNG and 6 JPG files; 42 images have alpha.
- The library ships extremely large source-like images directly to the frontend: 1920×1920, 1536×2304, 2048×2048, 2560×1440, and 2752×1536. Individual app icons are commonly around 5–6 MB. This is not a runtime atlas/compression strategy.
- Ten assets contain material amounts of suspicious bright-green matte/chroma residue. The worst are the dealer aim image (43.07% of pixels), passenger overlay (41.52%), enforcer idle (11.69%), dealer hit (6.82%), and shooter hit (5.94%).
- The supplied/shipped top-down luxury sedan file is RGB with no alpha, so its checkerboard-like background is baked into the image rather than being transparent. It cannot be composited as a clean in-world vehicle sprite without preprocessing.
- Several intended top-down character sprites are also RGB with no alpha: dealer and enforcer. Driver, lookout, and shooter have alpha, but the shooter has measurable green fringe.
- `sprites/gang_members.png`, the actual legacy gameplay sheet, is itself about 5.9 MB at 2752×1536 despite being rendered as tiny 28px/role tokens.

## Generated manifest is disconnected and internally broken

Source: `frontend/src/assets/assetManifest.ts`

The manifest defines a good conceptual schema (`portrait`, `fullbody`, `topdown`, `streetIdle`, `streetAim`, `streetFire`, `streetHit`, `streetDowned`, anchor, hitbox, and vehicle/environment variants), but a repository-wide reference trace shows no live component imports the manifest at all.

There are also concrete broken references:

- Shooter `streetAim`, `streetHit`, and `streetDowned` point to dealer assets instead of the shooter assets that partially exist.
- The manifest expects character idle files for dealer, lookout, driver, and shooter that do not exist.
- It expects vehicle windows-down, occupied-passenger, and heavy-damage paths that do not exist; the actual passenger file is named `vehicle_luxury_sedan_passenger_overlay_v001.png`.
- Only one generic South Florida strip-plaza environment package exists.
- Tracing `topdownBgUrl`, `streetBackdropUrl`, `topdownUrl`, and `portraitUrl` shows that `StreetBlock` consumes `streetBackdropUrl`; no top-down renderer consumes `topdownBgUrl` or member `topdownUrl`. The photo creator previews top-down art, but gameplay does not use it.

## Critical branch divergence: unmerged Las Olas V3 work

Recent history reveals a graphics branch not present on the audited current main: `origin/agent/las-olas-graphics-destruction` (the related commits also appear on `origin/agent/mvp-readiness-2026-07-16`). Key commits include:

- `ceeb2db` — articulated Canvas ragdoll physics (`RagdollEngine.ts`, 412 lines)
- `1120f92` — Las Olas destruction and ragdoll renderer (`CanvasStreetRendererV3.tsx`, 1,574 lines)
- `9598286` — routes the compatibility entry point through V3
- `e3a8ffa` — documents the Las Olas graphics upgrade

The branch adds about 3,047 lines across a scene config, V3 renderer, impact engine, and ragdoll engine. It is important and should be integrated selectively rather than re-created.

Source: branch file `docs/GRAPHICS_UPGRADE_1208_LAS_OLAS.md`

The branch implements persistent decals, material-specific destruction, vehicle panel damage, a typed-array particle pool, articulated 14-joint ragdolls, camera shake, and a coordinate repair for grid-coordinate enemy shots versus pixel-coordinate player shots. It explicitly says the scene is a “stylized reference” rather than verified geometry and requests exact-block photos, dimensions, and map pin for a later digital-twin pass.

Source: branch file `frontend/src/config/lasOlas1208Scene.ts`

The Las Olas scene is a normalized-coordinate procedural manifest of colored facade rectangles, generic storefront labels, glass/door rectangles, palms, sidewalk/street bands, and poles. The art direction and destructible-surface metadata are useful, but it is not the supplied high-fidelity Las Olas board or a real-location reconstruction.

Source: branch file `frontend/src/components/slide/CanvasStreetRendererV3.tsx`

The V3 renderer still draws the environment with Canvas gradients, `fillRect`, paths, text labels, procedural palms, and a procedurally drawn car. Standing members still use the old `gang_members.png` sheet; ragdolls take over only during impact reactions. Therefore V3 meaningfully upgrades motion, destruction, and combat response, but it does not solve the core art-fidelity, top-down-block, location-package, or character-animation problem.

## V3 branch build readiness

The unmerged graphics branch was checked out into an isolated worktree at commit `4ff60b7`. Its frontend dependencies installed successfully, `tsc --noEmit` passed, and the Vite production build completed successfully. This means the V3 impact/ragdoll work is technically mergeable and should not be rewritten from scratch.

The build emitted two circular-chunk warnings (`chunk-crew -> chunk-economy -> chunk-crew` and `chunk-minigames -> chunk-map -> chunk-minigames`) and a large Mapbox vendor bundle warning (approximately 1.665 MB minified / 447 KB gzip). These do not invalidate the graphics branch but reinforce the need for deliberate scene code-splitting and runtime asset budgets.

The exact V3 standing-character code confirms that each role is still drawn from one frame in the old `gang_members.png` sheet, with a colored rounded-rectangle body as the fallback. The 14-joint ragdoll activates only after impact. The vehicle is drawn procedurally with Canvas rectangles, arcs, and gradients. Therefore, the branch is a reusable behavior/effects upgrade rather than the final art solution.
