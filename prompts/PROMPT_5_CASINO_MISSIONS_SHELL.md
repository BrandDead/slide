# PROMPT 5: Casino Games, Mission System, and OSShell Integration

**Recommended AI Model:** `gpt-oss:120b-cloud`

**Estimated Complexity:** Medium-High (Phaser 3 casino games + mission task system + app routing)

---

## TASK

Generate three systems:

1. **Casino Games** — Blackjack, Craps, and Slots using Phaser 3 embedded in React.
2. **Mission System** — A task-tracking UI for tactical operations.
3. **OSShell Update** — Update the iOS-style desktop to properly route to all new app components.

---

## TECH STACK

- React 18 with functional components and hooks
- TypeScript (strict mode)
- Zustand 4 for state management
- Phaser 3 for casino game rendering (embedded in React via `useRef` + `useEffect`)
- Framer Motion for animations
- Tailwind CSS (dark theme)

---

## PART A: CASINO GAMES

The casino is where players can gamble their money. Winning increases cash; losing decreases it. All transactions are logged.

### Files to Generate:

1. **`frontend/src/components/casino/CasinoLobby.tsx`** — Main casino screen. Shows three game options as large cards: Blackjack, Craps, Slots. Each card shows the game name, a preview image placeholder, and min/max bet. Player's current balance is shown at the top. Clicking a card opens that game.

2. **`frontend/src/components/casino/Blackjack.tsx`** — A complete Blackjack game. Use canvas rendering via a `<canvas>` element and vanilla JS/TS (no Phaser needed for this one). Implement standard Blackjack rules: deal 2 cards each, player can Hit/Stand/Double Down. Dealer hits on 16, stands on 17. Aces are 1 or 11. Blackjack pays 3:2. Bet selection: $100, $500, $1000, $5000. Show cards as styled divs (suit + value). Animate card dealing with Framer Motion.

3. **`frontend/src/components/casino/Craps.tsx`** — A simplified Craps game. Player places a bet, rolls two dice. Come-out roll: 7 or 11 = win, 2/3/12 = lose, anything else sets the "point". Player keeps rolling until they hit the point (win) or roll 7 (lose). Show dice as styled divs with dot patterns. Animate dice roll with a shake animation.

4. **`frontend/src/components/casino/Slots.tsx`** — A 3-reel slot machine. Symbols: 💰 🔫 💊 💎 🃏 7️⃣. Matching 3 = jackpot (10x bet). Matching 2 = small win (2x bet). No match = lose. Animate reels spinning with CSS transforms. Bet selection: $50, $100, $500.

5. **`frontend/src/stores/casinoStore.ts`** — Zustand store. State: `currentGame: 'lobby' | 'blackjack' | 'craps' | 'slots'`, `currentBet: number`, `lastResult: 'win' | 'lose' | 'push' | null`, `winnings: number`, `totalGambled: number`, `totalWon: number`. Actions: `placeBet(amount)`, `setGame(game)`, `recordResult(result, amount)`.

---

## PART B: MISSION SYSTEM

Missions are tactical operations that players can undertake for rewards. They connect to other game systems (dealing, combat, crafting).

### Files to Generate:

6. **`frontend/src/components/missions/MissionBoard.tsx`** — Main mission screen. Shows available missions in a list. Each mission card shows: name, difficulty (1-5 stars), reward (money + XP), required members, time limit, and a "Start Mission" button. Completed missions show a checkmark. Categories: Deal Missions, Combat Missions, Craft Missions, Special Ops.

7. **`frontend/src/components/missions/MissionDetail.tsx`** — Detail view for a selected mission. Shows: full description, objectives (checklist), required member roles, reward breakdown, risk assessment (heat generated, arrest chance), and a "Deploy Team" button that lets the player assign members.

8. **`frontend/src/components/missions/MissionTracker.tsx`** — A floating widget that shows active missions with progress bars. Can be minimized. Shows time remaining and current objective.

9. **`frontend/src/stores/missionStore.ts`** — Zustand store. State: `availableMissions: Mission[]`, `activeMissions: ActiveMission[]`, `completedMissions: string[]`. Actions: `fetchMissions()`, `startMission(missionId, memberIds)`, `updateProgress(missionId, objectiveId)`, `completeMission(missionId)`, `failMission(missionId)`.

10. **`frontend/src/types/mission.types.ts`** — Type definitions:

```typescript
export interface Mission {
  id: string;
  name: string;
  description: string;
  category: 'deal' | 'combat' | 'craft' | 'special';
  difficulty: 1 | 2 | 3 | 4 | 5;
  objectives: MissionObjective[];
  rewards: MissionReward;
  requirements: MissionRequirements;
  timeLimit: number; // seconds
  heatGenerated: number;
  arrestChance: number;
  cooldown: number; // seconds before mission is available again
}

export interface MissionObjective {
  id: string;
  description: string;
  type: 'deal' | 'kill' | 'craft' | 'collect' | 'survive' | 'deploy';
  target: number; // e.g., "deal 10 times"
  current: number;
  completed: boolean;
}

export interface MissionReward {
  money: number;
  xp: number;
  reputation: number;
  items?: { type: string; quantity: number }[];
  unlocks?: string[]; // Recipe IDs, member IDs, etc.
}

export interface MissionRequirements {
  minLevel: number;
  requiredRoles: string[]; // e.g., ['shooter', 'dealer']
  minMembers: number;
  maxMembers: number;
  requiredItems?: { type: string; quantity: number }[];
}

export interface ActiveMission extends Mission {
  startedAt: number;
  assignedMembers: string[];
  status: 'active' | 'completed' | 'failed' | 'expired';
}
```

---

## PART C: OSSHELL UPDATE

The OSShell is the iOS-style home screen. It needs to be updated to route to all new components.

### Files to Generate:

11. **`frontend/src/components/layout/OSShell.tsx`** (UPDATED) — The iOS-style desktop. Must include app icons for ALL game modes:

```
App Grid (4 columns):
Row 1: DEALT (💊), SLIDE (🎯), DRIVE (🚗), COOK (⚗️)
Row 2: CREW (👥), MAP (🗺️), SHOEBOX (💰), OPS (📋)
Row 3: CASINO (🎰), PHONE (📱), SETTINGS (⚙️), STORE (🏪)
```

Each icon should be a glass-morphism card with the emoji icon and label. Clicking navigates to the corresponding app by updating the navigation store.

The top status bar should show: player name, money, heat level (as a colored bar), and current time.

The dock at the bottom should have quick-access icons for the 4 most-used apps.

12. **`frontend/src/stores/navigationStore.ts`** — Zustand store for app navigation. State: `currentApp: string`, `previousApp: string | null`, `appHistory: string[]`. Actions: `navigateTo(appName)`, `goBack()`, `goHome()`.

13. **`frontend/src/App.tsx`** (UPDATED) — Root component. Wraps everything in `AuthGuard`. Uses `AnimatePresence` for page transitions. Routes to the correct component based on `currentApp` from the navigation store. Import map:

```typescript
const APP_COMPONENTS: Record<string, React.LazyComponent> = {
  home: OSShell,
  dealt: DealtMode,
  slide: SlideGame,
  driveby: DriveByEngine,
  alchemy: AlchemyLab,
  contacts: Contacts,
  map: TerritoryMap,
  shoebox: Shoebox,
  missions: MissionBoard,
  casino: CasinoLobby,
  gang: GangManagement,
  // ... etc
};
```

---

## DESIGN GUIDELINES

### Casino
- Felt green table background (`#0d5e2e`) for Blackjack and Craps.
- Slot machine: metallic frame, neon lights, spinning reels.
- Cards: white with black/red suits, rounded corners, drop shadow.
- Dice: white with black dots, 3D perspective on roll.
- Win animation: gold coins falling, green flash.
- Lose animation: red flash, money counter decreasing.

### Missions
- Military/tactical aesthetic. Dark backgrounds with green/amber accents.
- Mission cards: bordered cards with difficulty stars.
- Active missions: pulsing green border.
- Failed missions: red strikethrough.
- Progress bars: segmented (one segment per objective).

### OSShell
- iOS-style grid layout with rounded app icons.
- Glass morphism on all cards (backdrop-blur, semi-transparent).
- Status bar: fixed top, shows player info.
- Dock: fixed bottom, 4 icons with labels.
- Background: dark gradient with subtle animated particles or grid pattern.
- App icons: 80px x 80px, emoji centered, label below.
- Notification badges: red circle with count on app icons that need attention.
