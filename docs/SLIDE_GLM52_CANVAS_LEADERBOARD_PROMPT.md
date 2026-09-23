# GLM-5.2 Prompt — Canvas Upgrade & Leaderboard System

*Copy and paste this entire document to the GLM-5.2 coding agent. Since GLM-5.2 does not have direct access to the repo, all necessary context, types, and component structures are included below.*

---

## Mission

You are building two critical features for the **SLIDE / DEALT** urban warfare RPG:
1. **Canvas Renderer Upgrade (Sprint 5C):** Upgrade the `DriveByEngine` and `StreetBlock` to use an HTML5 `<canvas>` based rendering system instead of DOM nodes for better performance and visual fidelity.
2. **Leaderboard System (Sprint 6D):** Build a global leaderboard component and the Supabase backend queries to rank players by total income, block count, and heat level.

This game is a React + Vite + Zustand + TailwindCSS application. We are using Supabase for the backend.

---

## Task 1: Canvas Renderer Upgrade

Currently, `StreetBlock.tsx` and `DriveByEngine.tsx` render gang members and the drive-by car using standard `<div>` and `<img>` tags. As the game scales, this DOM-heavy approach causes layout thrashing during the active combat phase.

Your task is to write a generic `CanvasStreetRenderer` component that takes the block data and drive-by event state, and renders them onto a single `<canvas>`.

### Required Canvas Features:
- Parallax scrolling background (sky, buildings, storefront).
- Sprite rendering for members using the existing `GameSprite` logic.
- Car rendering animating across the screen based on the `DriveByPhase`.
- Muzzle flash and hit spark particle effects using simple canvas arc drawing.

### Context: Types

```typescript
export type BlockZoneType = 'street' | 'curb' | 'sidewalk' | 'storefront' | 'alley' | 'parking' | 'rooftop' | 'building';

export interface BlockPlacement {
  memberId: string;
  memberName: string;
  role: 'dealer' | 'shooter' | 'enforcer' | 'lookout' | 'driver' | 'chemist' | 'runner' | 'boss';
  x: number;
  y: number;
  zoneType: BlockZoneType;
  health: number;
}

export type DriveByPhase = 'idle' | 'incoming' | 'active' | 'retreating' | 'resolved';

export interface DriveByShot {
  targetX: number;
  targetY: number;
  hit: boolean;
  timestamp: number;
}

export interface DriveByEvent {
  phase: DriveByPhase;
  shots: DriveByShot[];
  defenderShots: DriveByShot[];
}
```

### Context: Sprite Mapping

```typescript
// Sprite sheet mapping for characters
const MEMBER_FRAMES: Record<string, number> = {
  dealer: 0, shooter: 1, enforcer: 2, lookout: 3
};
// Character sprite sheet is 4 columns x 1 row. Image URL: '/assets/sprites/gang_members.png'
```

### What you need to write:

Please provide the complete code for `frontend/src/components/slide/CanvasStreetRenderer.tsx`.
It should accept these props:
```typescript
interface CanvasStreetRendererProps {
  placements: BlockPlacement[];
  activeDriveBy?: DriveByEvent;
  width: number;
  height: number;
  onDefendShot: (x: number, y: number) => void;
}
```
Use `requestAnimationFrame` for the render loop. Handle click events on the canvas to trigger `onDefendShot`.

---

## Task 2: Global Leaderboard (future safe projection)

We may later add a global leaderboard to show the top criminal empires. The legacy
`public.get_leaderboard(INT)` RPC is service-role only and must not be called from
browser code. Phase 1 therefore uses local block-store data until a separately
reviewed authenticated backend or restricted public projection exists.

### Context: Database Schema

The `blocks` table in Supabase contains the territory data:
```sql
CREATE TABLE blocks (
  id UUID PRIMARY KEY,
  address TEXT,
  owner_id UUID REFERENCES auth.users(id),
  block_heat INTEGER,
  base_income INTEGER,
  metadata JSONB
);
```

### Future implementation requirements:

1. **Safe backend projection:** If a global leaderboard is approved, expose it through a reviewed read-only backend or restricted public projection. Never put a service-role key in frontend code, and do not restore browser execution for the legacy RPC.

2. **Supabase RPC (SQL):** If a new projection is required, write a separately named and security-reviewed Supabase PostgreSQL function that aggregates data from the `blocks` table grouped by `owner_id`. It should return only approved public fields:
   - `owner_id`
   - `total_blocks` (count of blocks owned)
   - `total_income` (sum of base_income)
   - `max_heat` (max of block_heat)
   Order the results descending by `total_income`.

3. **React Component:** Update `frontend/src/components/hub/Leaderboard.tsx` only after the backend projection is approved.
   - Until then, keep the Phase 1 local-only implementation.
   - Display the data in a clean, dark-themed, luxury-noir styled table using TailwindCSS.
   - Include a loading state and handle empty results.

---

## Output Requirements

Please output the code blocks clearly separated by file name. Do not include excessive conversational filler; focus on production-ready, typed React/TypeScript and SQL code.

Ensure all React components use functional component syntax with hooks.
