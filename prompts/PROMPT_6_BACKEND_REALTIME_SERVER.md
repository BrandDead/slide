# PROMPT 6: Backend Real-Time Server — Socket.IO Multiplayer + Game Loop

**Recommended AI Model:** `deepseek-v3.1:671b-cloud`

**Estimated Complexity:** High (Node.js server with Socket.IO, game tick loop, Supabase integration)

---

## TASK

Generate a complete Node.js/TypeScript backend server that handles:

1. **Real-time multiplayer** via Socket.IO (combat matchmaking, live updates).
2. **Game tick loop** that processes passive income, heat decay, morale changes, and raid checks every 60 seconds.
3. **Combat resolution** for SLIDE battles between two players.
4. **Supabase integration** for persisting game state.

---

## TECH STACK

- Node.js 18+ with TypeScript
- Socket.IO 4 for WebSocket communication
- Express.js for HTTP endpoints
- `@supabase/supabase-js` for database access
- `dotenv` for environment variables

---

## EXISTING FRONTEND SOCKET CLIENT (`frontend/src/services/SocketService.ts`)

The frontend already has a Socket.IO client that expects these events:

```typescript
// Events the client LISTENS for:
'combat:started'     — { gameId, attackerId, defenderId, blockId }
'combat:turn_result' — { gameId, turnNumber, result: TurnResult }
'combat:ended'       — { gameId, winner, scores, rewards }
'block:updated'      — { blockId, heat, income, units }
'member:updated'     — { memberId, status, morale, level }
'raid:incoming'      — { blockId, severity, countdown }
'raid:result'        — { blockId, result: RaidResult }
'economy:update'     — { money, income, expenses }
'notification'       — { type, message, data }

// Events the client EMITS:
'combat:request'     — { targetBlockId }
'combat:place_unit'  — { gameId, unitId, position }
'combat:fire'        — { gameId, shots }
'combat:retreat'     — { gameId }
'block:deploy'       — { blockId, memberId, position }
'block:recall'       — { memberId }
'dealt:complete'     — { blockId, clientType, accepted, drugType }
'alchemy:craft'      — { recipeId, chemistId }
```

---

## FILES TO GENERATE

Generate the following files in `backend/server/`:

1. **`backend/server/package.json`**

```json
{
  "name": "slide-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "socket.io": "^4.7.2",
    "@supabase/supabase-js": "^2.38.0",
    "dotenv": "^16.3.1",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "tsx": "^4.6.0",
    "@types/express": "^4.17.21",
    "@types/uuid": "^9.0.7"
  }
}
```

2. **`backend/server/src/index.ts`** — Main entry point. Creates Express app, HTTP server, and Socket.IO server. Configures CORS for the frontend origin. Starts the game tick loop. Registers all event handlers.

3. **`backend/server/src/gameLoop.ts`** — The game tick loop. Runs every 60 seconds. For each active block: calculates passive income for all deployed dealers, applies heat decay, checks for raid events (using the heat system logic), and updates morale. Emits `block:updated` and `economy:update` events to connected players.

4. **`backend/server/src/combatManager.ts`** — Manages active SLIDE combat sessions. Functions: `createCombat(attackerId, defenderId, blockId)`, `handlePlacement(gameId, unitId, position)`, `handleFire(gameId, shots)`, `handleRetreat(gameId)`, `resolveTurn(gameId)`. Uses the dual-grid logic from the frontend utils (duplicated here for server-side validation).

5. **`backend/server/src/raidManager.ts`** — Handles police raid events. When a raid is triggered by the game loop, it: sends a `raid:incoming` warning with a 30-second countdown, then executes the raid using the heat system logic, confiscates items, arrests members, and sends `raid:result`.

6. **`backend/server/src/eventHandlers.ts`** — All Socket.IO event handlers organized by category (combat, block, dealt, alchemy). Each handler validates the request, processes it, updates Supabase, and emits the appropriate response events.

7. **`backend/server/src/supabaseAdmin.ts`** — Server-side Supabase client using the service role key (for admin operations like updating any player's data).

```typescript
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
export default supabase;
```

8. **`backend/server/.env.example`**

```env
PORT=3001
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
FRONTEND_URL=http://localhost:5173
GAME_TICK_INTERVAL_MS=60000
```

9. **`backend/server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## GAME LOOP LOGIC

The game loop runs every 60 seconds and processes the following for each active block:

```
For each block with deployed units:
  1. Calculate income from each dealer (use incomeEngine logic):
     - Base income * street proximity multiplier * drug quality * member level
     - Subtract heat penalty
     - Add to owner's money
  2. Apply heat decay:
     - Reduce heat by decayRate per hour (prorated to 1 minute)
  3. Check for raids:
     - If heat > 40, roll for raid using getRaidProbability(heat)
     - If raid triggers, start raid sequence
  4. Update morale:
     - Check if salaries are due (every game-hour)
     - If unpaid, apply morale penalty to all members
  5. Check for member consequences:
     - If any member's morale < 30, roll for no-show/desertion/betrayal
  6. Emit updates to connected players
```

---

## COMBAT FLOW (Server-Side)

```
1. Player A emits 'combat:request' with targetBlockId
2. Server creates combat session, notifies Player B
3. Player B (defender) places units via 'combat:place_unit'
4. Player B confirms placement
5. Turn loop:
   a. Server emits 'combat:turn_result' with attacker's phase
   b. Player A selects targets and emits 'combat:fire'
   c. Server resolves attacker shots using resolveDriveByTurn()
   d. Server emits 'combat:turn_result' with results
   e. Player B selects targets and emits 'combat:fire'
   f. Server resolves defender shots using resolveDefenseRetaliation()
   g. Server emits 'combat:turn_result' with results
   h. Check win conditions
6. On game end, emit 'combat:ended' with winner and rewards
7. Update Supabase with combat log, member XP, heat changes
```

---

## IMPORTANT NOTES

- All game logic must be validated server-side. Never trust client data.
- Use UUIDs for all IDs.
- Log all important events for debugging.
- Handle disconnections gracefully (auto-retreat after 60 seconds).
- Rate-limit combat requests (1 per 5 minutes per player).
