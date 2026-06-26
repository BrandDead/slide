# Ollama Prompt — Security Cam & Weekly Local Update

*Copy and paste this entire document to the Ollama coding agent (e.g., Qwen-2.5-Coder or DeepSeek-Coder). It contains the instructions to build a CCTV replay system and a news feed component.*

---

## Mission

You are building the **Security Cam Replay & Weekly Update System** for the **SLIDE / DEALT** urban warfare RPG.

We want players to be able to watch replays of drive-bys and altercations from a "third-party" civilian perspective — specifically, a grainy, black-and-white security camera. These clips will be featured in a "Weekly Local Update" news app on the in-game phone.

This game is a React + Vite + Zustand + TailwindCSS application.

---

## Core Requirements

1. **Security Cam Renderer (`SecurityCamRenderer.tsx`)**
   - A `<canvas>` component that takes an array of `DriveByEvent` data and replays the entire sequence from a high-angle perspective.
   - **Visual Style:** Black and white, high contrast, heavy film grain / static noise, scanlines.
   - **Overlays:** A blinking `REC •` indicator, a running timestamp, and a camera ID (e.g., `CAM-04: SOUTH BEACH`).

2. **Weekly Update Feed (`WeeklyUpdateApp.tsx`)**
   - A new app for the in-game iOS shell.
   - Looks like a gritty local news feed or a "citizen app" (like Citizen or CitizenApp).
   - Lists recent combat events across the city (e.g., "Shots fired at 14th St", "Major altercation in Downtown").
   - Clicking an event opens the `SecurityCamRenderer` to watch the replay.

---

## Context: Existing Event Data

Our combat engine stores drive-bys in this format:

```typescript
export interface DriveByShot {
  shooterId: string;
  targetX: number;
  targetY: number;
  hit: boolean;
  damage: number;
  timestamp: number;
}

export interface DriveByEvent {
  id: string;
  blockId: string;
  attackerGangName: string;
  vehicleType: 'sedan' | 'suv' | 'coupe' | 'van';
  phase: 'resolved';
  shots: DriveByShot[];
  defenderShots: DriveByShot[];
  casualties: string[];
  startedAt: number;
  resolvedAt: number;
  outcome: 'repelled' | 'successful' | 'fled';
}
```

---

## What you need to write:

Please provide the complete code for:
1. `frontend/src/components/news/SecurityCamRenderer.tsx` (The CCTV canvas replay)
2. `frontend/src/components/news/WeeklyUpdateApp.tsx` (The news feed UI)

### Constraints:
- For the film grain, generate a static noise pattern once on an off-screen canvas and draw it over the main canvas with `globalAlpha = 0.1` and a random offset every frame (this is much faster than generating noise per-pixel every frame).
- Use TailwindCSS for the news feed UI.
- Make the news feed look like a mobile app (scrollable list, card-based layout).

Please output the code blocks clearly separated by file name. Focus on production-ready, typed React/TypeScript code.
