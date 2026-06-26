# GLM-5.2 Prompt — Canvas Destruction & Gore Engine

*Copy and paste this entire document to the GLM-5.2 coding agent. It contains the instructions to build a modular canvas-based destruction and impact engine.*

---

## Mission

You are building a high-performance **Canvas Destruction & Impact Engine** for the **SLIDE / DEALT** urban warfare RPG. 

We recently upgraded our `DriveByEngine` to use an HTML5 canvas renderer (`CanvasStreetRenderer.tsx`). Currently, it has basic hit sparks and muzzle flashes. We need you to build a dedicated `ImpactEngine.ts` utility class that handles advanced particle physics, environmental destruction, and character impacts (gore/blood) without slowing down the main render loop.

This game is a React + Vite + Zustand + TailwindCSS application.

---

## Core Requirements

1. **Particle System:**
   - Must handle thousands of particles efficiently (use typed arrays or pre-allocated object pools).
   - Support gravity, friction, air resistance, and ground bouncing.

2. **Environmental Destruction:**
   - **Glass Shards:** When a shot hits a storefront or car window, spawn directional glass shards (blue-white, angular).
   - **Concrete Dust/Debris:** When a shot misses and hits the background/curb, spawn grey dust puffs and concrete chips.
   - **Sparks:** Metallic hits (on cars/poles) spawn high-velocity yellow/orange sparks.

3. **Character Impacts (Gore):**
   - The user requested a "gore" engine. We need stylized, 2.5D appropriate blood effects.
   - **Blood Splatter:** Directional red particle bursts when a character is hit.
   - **Blood Pools:** Static red decals that slowly expand on the ground beneath downed characters.

4. **Integration Ready:**
   - The engine should not manage the React state. It should be a pure TypeScript class `ImpactEngine` that takes a `CanvasRenderingContext2D` and a `deltaTime`.
   - Provide an `update(dt)` method and a `draw(ctx)` method.
   - Provide spawn methods: `spawnGlass(x, y, dirX, dirY)`, `spawnBlood(x, y, dirX, dirY)`, `spawnSparks(x, y, dirX, dirY)`.

---

## Context: Existing Canvas Setup

Our current render loop looks like this:

```typescript
// Inside CanvasStreetRenderer.tsx
const draw = useCallback(() => {
  const ctx = canvasRef.current?.getContext('2d');
  if (!ctx) return;
  
  const now = performance.now();
  const dt = (now - lastTimeRef.current) / 1000;
  lastTimeRef.current = now;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Draw background, characters, car...

  // UPDATE & DRAW IMPACTS HERE
  impactEngineRef.current.update(dt);
  impactEngineRef.current.draw(ctx);

  requestAnimationFrame(draw);
}, []);
```

---

## What you need to write:

Please provide the complete code for `frontend/src/utils/ImpactEngine.ts`.

### Constraints:
- Use `Float32Array` or object pooling to prevent garbage collection pauses during heavy combat.
- Keep the gore stylized (dark red, fast fade, high velocity) to match the luxury-noir aesthetic.
- Include a `clear()` method to reset the engine between drive-by events.

### Example Output Structure:

```typescript
export class ImpactEngine {
  constructor(width: number, height: number) { ... }
  
  public spawnBlood(x: number, y: number, angle: number, intensity: number) { ... }
  public spawnGlass(x: number, y: number, angle: number) { ... }
  public spawnSparks(x: number, y: number, angle: number) { ... }
  
  public update(dt: number) { ... }
  public draw(ctx: CanvasRenderingContext2D) { ... }
}
```

Please output the code block clearly. Do not include excessive conversational filler; focus on production-ready, highly optimized TypeScript code.
