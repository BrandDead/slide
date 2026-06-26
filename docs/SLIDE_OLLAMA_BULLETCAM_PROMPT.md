# Ollama Prompt — Bullet-Cam & X-Ray Impact Engine

*Copy and paste this entire document to the Ollama coding agent (e.g., Qwen-2.5-Coder or DeepSeek-Coder). It contains the instructions to build a cinematic "bullet-cam" replay engine.*

---

## Mission

You are building a **Bullet-Cam & X-Ray Impact Engine** for the **SLIDE / DEALT** urban warfare RPG.

We currently have a 2.5D `CanvasStreetRenderer` and an `FPSOverlay` that handles active combat. When a player lands a critical or lethal shot, we want to trigger a slow-motion cinematic "bullet-cam" replay, similar to Sniper Elite.

This game is a React + Vite + Zustand + TailwindCSS application.

---

## Core Requirements

1. **Bullet-Cam Renderer (`BulletCamReplay.tsx`)**
   - A dedicated `<canvas>` component that overlays the screen when a critical hit occurs.
   - **Phase 1 (Travel):** The camera follows the bullet in slow motion across the street. Use radial blur or speed lines to convey velocity.
   - **Phase 2 (Impact/X-Ray):** When the bullet strikes the target, the renderer switches to an "X-Ray mode" (invert colors, high contrast black/white/red).
   - **Phase 3 (Damage):** Render stylized bone/organ fractures at the point of impact.

2. **Replay State Machine (`useBulletCam.ts`)**
   - A React hook that takes the shot data (`startX`, `startY`, `targetX`, `targetY`, `damage`, `isLethal`).
   - Manages the animation timeline: `idle` → `travel` → `impact` → `xray` → `resolved`.
   - Returns the current frame state (bullet position, camera zoom, time dilation) to the renderer.

3. **Security Camera Mode (Bonus Feature)**
   - Add a toggle or secondary component (`SecurityCamReplay.tsx`) that replays the same shot data from a high-angle, black-and-white, grainy CCTV perspective.
   - Add a timestamp overlay (e.g., `REC • 19:43:22`).

---

## Context: Existing Shot Data

Our combat engine records shots using this interface:

```typescript
export interface DriveByShot {
  shooterId: string;
  targetX: number;
  targetY: number;
  hit: boolean;
  damage: number;
  timestamp: number;
  isLethal?: boolean; // You will need to add this
}
```

---

## What you need to write:

Please provide the complete code for:
1. `frontend/src/utils/BulletCamEngine.ts` (The math/physics for the slow-mo trajectory)
2. `frontend/src/components/slide/BulletCamReplay.tsx` (The React canvas component)

### Constraints:
- Do not use Three.js or WebGL. Stick to the standard HTML5 `CanvasRenderingContext2D` API for maximum compatibility.
- Use `ctx.filter = 'invert(1) contrast(2)'` for the X-Ray effect.
- Keep the code highly optimized. Avoid garbage collection pauses by reusing objects.

Please output the code blocks clearly separated by file name. Focus on production-ready, typed React/TypeScript code.
