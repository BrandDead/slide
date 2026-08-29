# Game Plan: DEALT / SLIDE Modern Ops Slice

**Branch:** `feat/modern-gameplay-completion`  
**Baseline:** `main-tL2525@c178861`  
**Hero block:** Las Olas / 1208 E Las Olas-derived Block DNA  
**Authoritative model:** `frontend/src/game/combat/**`

## Recovered Foundation

The six unique `copilot/dev-oplan` commits have been reconciled onto the current baseline. The recovered work provides zero-warning runtime assets, 17 Block DNA cards, persistent local Ghost Crews, City Feed threat surfacing, beta smoke tests, and a release checklist. The new `CombatSessionController` provides one deterministic command and snapshot boundary for tactical, first-person, and third-person presentation.

## Risk Tasks

### 1. Shared session across cameras

- **Why isolated:** A camera switch must never recreate the encounter, reset RNG, duplicate commands, or commit a result twice.
- **Approach:** Keep `CombatSessionController` outside Babylon scene nodes; let cameras observe the same snapshot and emit typed commands through one monotonically increasing sequence.
- **Verify:** Switch tactical → first person → third person after movement and firing; tick, ammo, health, objective progress, and event IDs remain continuous.

### 2. Pointer-lock first-person controls

- **Why isolated:** Pointer lock requires a direct user gesture and may fail inside embedded browser contexts.
- **Approach:** Start with unlocked mouse-look plus a visible click-to-focus affordance; request pointer lock only from the canvas click, pause on lock loss, and keep keyboard/fire controls usable without lock.
- **Verify:** Camera does not spin on mount; pointer-lock denial shows no fatal error; Escape pauses; re-entry resumes from the same session.

### 3. Third-person shoulder camera

- **Why isolated:** Tight block geometry can place the camera inside cover or storefront meshes.
- **Approach:** Use a bounded follow/orbit camera with a fixed shoulder offset and ray-based obstruction shortening; keep movement grid-authoritative.
- **Verify:** Rotate behind the actor near planters and storefronts; the camera remains outside geometry and the selected actor stays visible.

### 4. DNA-to-3D scene projection

- **Why isolated:** A separate hand-authored 3D map would disconnect the claimed block from strategy and tactical modes.
- **Approach:** Convert encounter terrain cells and the stable hero-block identity into procedural road, sidewalk, storefront, cover, actor, and extraction meshes. Use the generated storefront facade as the authored visual anchor.
- **Verify:** The same preparation produces stable geometry; passable cells remain traversable; high-cover cells create visible cover; extraction occupies the declared grid point.

### 5. React/Babylon lifecycle

- **Why isolated:** Development double-mount and repeated mode entry can leak engines, render loops, events, pointer lock, and canvases.
- **Approach:** Guard engine initialization, centralize listener cleanup, call scene/world/controller disposal, and dispose the engine on unmount.
- **Verify:** Enter and exit Modern Ops five times; one canvas exists while active, no render loop continues after exit, and the next session starts cleanly.

## Main Build

Build a full-screen Babylon.js Modern Ops encounter under `BlockModeView` while preserving the existing Phaser tactical encounter. Add tactical, first-person, and third-person camera buttons; WASD/arrow movement; click/Space fire; `R` reload; `E` extract; `Q` retreat; `V` camera cycle; HUD; cover; opponent return fire; extraction; pause/exit; and atomic `CombatResult` handoff.

- **Assets:**
  - `/home/ubuntu/webdev-static-assets/dealt-slide-modern-ops-visual-target.png` — 2560×1440 visual QA target, not runtime-loaded.
  - `frontend/public/assets/runtime/generated/environments/street/block_modern_ops_storefront_v001.webp` — generated facade texture on a 32 m × 6 m storefront plane.
  - Existing Las Olas street and top-down plates plus registered character sprites remain available to tactical and legacy views.
- **Verify:**
  - Movement direction matches input and legal grid movement.
  - Camera switching never changes the combat snapshot.
  - Fire/reload feedback and opponent return fire are visible.
  - The green extraction point resolves the encounter through the shared result boundary.
  - HUD is readable at desktop and narrow mobile widths.
  - No missing texture, fallback-magenta material, or gray blockout dominates the hero view.
  - No browser console error appears during deterministic demo capture.
  - Re-entry does not create duplicate engines or rewards.
  - Reference consistency: wet neon Las Olas palette, compact block scale, readable cover lanes, authored storefront identity.

## Completion Gates

Run frontend typecheck, focused and full Vitest, runtime asset audit, lint, production build where environment memory permits, backend offline Pytest, deterministic browser smoke, and visual captures of tactical, first-person, third-person, firefight, and resolved strategy state. Update `MEMORY.md`, `ASSETS.md`, `STRUCTURE.md`, the project log, and release checklist before pull request review.
