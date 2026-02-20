This file will contain the self-contained prompts for an AI developer to build the frontend components for Sprint 1.


---

## 🚀 PROMPT 1A: Build Shoebox (Banking) Component

**Objective:** Create the `Shoebox.tsx` component, a banking interface for the player to manage their money. It should allow depositing cash into a bank account, withdrawing from the bank to cash, and viewing a transaction history. The component will be entirely frontend-driven, using existing Zustand stores.

### **UI/UX Requirements:**

1.  **Main View:**
    *   Display **Current Cash** (from `usePlayerStore`).
    *   Display **Bank Balance** (from `usePlayerStore`).
    *   Show two main buttons: **Deposit** and **Withdraw**.
    *   Include a **Transaction History** log below the buttons.

2.  **Deposit/Withdraw Modals:**
    *   Clicking "Deposit" or "Withdraw" should open a modal.
    *   The modal should have a text input for the amount.
    *   Include quick-select buttons for **25%**, **50%**, **75%**, **MAX**.
    *   A confirmation button to execute the transaction.

3.  **Transaction History:**
    *   List the last 20-30 transactions from `useEconomyStore`.
    *   Each entry should show: description, amount (colored green for income, red for expense), and a timestamp.

### **Technical Requirements:**

*   **File Location:** `frontend/src/components/economy/Shoebox.tsx`
*   **Styling:** Create a corresponding `Shoebox.css` file and import it. Use the existing dark theme and color palette.
*   **State Management:** All state changes must go through the following Zustand stores:
    *   `usePlayerStore`: for `money` and `bankBalance`.
    *   `useEconomyStore`: for logging transactions.

### **Codebase Context:**

**`frontend/src/stores/gameStore.ts` (Economy & Player Stores)**

```typescript
// Relevant parts of gameStore.ts

// PLAYER STORE
interface PlayerState {
  player: Player;
  updateMoney: (amount: number) => void; // Use this to add/remove cash
  updatePlayer: (updates: Partial<Player>) => void; // Use this to update bankBalance
}

const defaultPlayer: Player = {
  // ...
  money: 5000,
  bankBalance: 0,
  // ...
};

export const usePlayerStore = create<PlayerState>()(/* ... */);

// ECONOMY STORE
interface EconomyState {
  transactions: Transaction[];
  addTransaction: (transaction: Transaction) => void;
}

export const useEconomyStore = create<EconomyState>()(/* ... */);
```

**`frontend/src/types/game.types.ts`**

```typescript
// Relevant parts of game.types.ts

export interface Player {
  id: string;
  money: number;
  bankBalance: number;
  // ... other fields
}

export interface Transaction {
  id: string;
  type: TransactionType;
  userId: string;
  amount: number;
  details: Record<string, unknown>;
  createdAt: string;
}

export type TransactionType = 
  | 'deal_income'
  | 'block_income'
  | 'combat_loot'
  | 'purchase'
  | 'salary'
  | 'bribe'
  | 'tax'
  | 'asset_seized'
  | 'deposit' // Add this
  | 'withdrawal'; // Add this
```

**`frontend/src/App.tsx` (Placeholder to replace)**

```typescript
// ...
      case 'shoebox':
        return <PlaceholderScreen key="shoebox" title="SHOEBOX" icon="💰" />;
// ...
```

### **Implementation Steps:**

1.  Create `frontend/src/components/economy/Shoebox.tsx` and `Shoebox.css`.
2.  Build the main component layout with placeholders for cash, balance, and transaction history.
3.  Implement the Deposit and Withdraw modals with amount input and quick-select buttons.
4.  Wire the modals to the `usePlayerStore` and `useEconomyStore` actions:
    *   **Deposit:** Decrease `player.money`, increase `player.bankBalance`, and call `addTransaction` with type `'deposit'`.
    *   **Withdraw:** Increase `player.money`, decrease `player.bankBalance`, and call `addTransaction` with type `'withdrawal'`.
5.  Render the `transactions` array from `useEconomyStore` in the history log.
6.  Update `App.tsx` to replace the `PlaceholderScreen` with your new `Shoebox` component.



---

## 🚀 PROMPT 1B: Build Market (Underworld Shop) Component

**Objective:** Create the `Market.tsx` component, an underworld marketplace where players can buy and sell items like weapons, armor, and consumables. The component will be frontend-driven, using a hardcoded item catalog and the existing `useEconomyStore`.

### **UI/UX Requirements:**

1.  **Main View:**
    *   Display player's **Current Cash** (from `usePlayerStore`).
    *   A tabbed interface to switch between item categories: **Weapons**, **Armor**, **Vehicles**, **Consumables**, **Tools**.
    *   A grid or list view of items within the selected category.

2.  **Item Cards:**
    *   Each item should have a card showing its name, icon/image, price, and key stats (e.g., damage for weapons, defense for armor).
    *   A "Buy" button on each card.

3.  **Purchase Modal:**
    *   Clicking "Buy" opens a modal for that item.
    *   The modal should show item details and an input to select quantity.
    *   A "Confirm Purchase" button that executes the transaction.

4.  **Player Inventory:**
    *   A separate section or tab to view the player's current inventory, grouped by category.

### **Technical Requirements:**

*   **File Location:** `frontend/src/components/economy/Market.tsx` and `Market.css`.
*   **Item Catalog:** For now, use a hardcoded JSON array of items within `Market.tsx`. This will later be fetched from the backend. The items should align with the `item_catalog` seed data in the database schema.
*   **State Management:**
    *   `usePlayerStore`: to get `player.money` and deduct on purchase.
    *   `useEconomyStore`: to add purchased items to `inventory` and log the transaction.

### **Codebase Context:**

**`backend/supabase/migrations/001_mvp_tables.sql` (Item Catalog Seed Data)**

```sql
-- Use this as the basis for your hardcoded item catalog
INSERT INTO item_catalog (id, name, category, damage, defense, base_price, description, rarity) VALUES
("pistol-9mm", "9mm Pistol", "weapon", 15, 0, 500, "Basic handgun", "common"),
("ak47", "AK-47", "weapon", 35, 0, 2500, "Assault rifle", "uncommon"),
("shotgun", "Pump Shotgun", "weapon", 40, 0, 1800, "Close-range devastation", "uncommon"),
("sniper-rifle", "Sniper Rifle", "weapon", 60, 0, 5000, "Long-range precision", "rare"),
("bulletproof-vest", "Bulletproof Vest", "armor", 0, 10, 800, "Basic body armor", "common"),
("tactical-armor", "Tactical Armor", "armor", 0, 25, 3000, "Military-grade protection", "rare"),
("medkit", "Medical Kit", "consumable", 0, 0, 200, "Restores 50 HP", "common"),
("lockpick", "Lockpick Set", "tool", 0, 0, 150, "Bypass security", "common"),
("night-vision", "Night Vision Goggles", "tool", 0, 0, 1200, "+20% accuracy at night", "uncommon"),
("sedan", "Sedan", "vehicle", 0, 0, 5000, "Basic getaway car", "common"),
("sports-car", "Sports Car", "vehicle", 0, 0, 25000, "Fast and flashy", "rare");
```

**`frontend/src/stores/gameStore.ts` (Economy Store)**

```typescript
// Relevant parts of gameStore.ts
interface EconomyState {
  inventory: InventoryItem[];
  addInventoryItem: (item: InventoryItem) => void;
  addTransaction: (transaction: Transaction) => void;
  purchaseFromMarket: (listingId: string, quantity: number) => boolean; // You can implement a simplified version of this
}

export const useEconomyStore = create<EconomyState>()(/* ... */);
```

**`frontend/src/types/game.types.ts`**

```typescript
// Relevant parts of game.types.ts
export interface InventoryItem {
  id: string;
  type: 'drug' | 'weapon' | 'armor' | 'vehicle' | 'consumable' | 'tool';
  itemId: string; // Corresponds to item_catalog id
  quantity: number;
}
```

**`frontend/src/App.tsx` (Placeholder to replace)**

```typescript
// ...
      case 'market':
        return <PlaceholderScreen key="market" title="UNDERWORLD MARKET" icon="🏪" />;
// ...
```

### **Implementation Steps:**

1.  Create `frontend/src/components/economy/Market.tsx` and `Market.css`.
2.  Define a hardcoded array of items based on the SQL seed data.
3.  Build the tabbed UI for item categories.
4.  Render the items for the active category.
5.  Implement the purchase modal.
6.  On purchase confirmation:
    *   Check if the player has enough `money` from `usePlayerStore`.
    *   If so, call `updateMoney` on `usePlayerStore` to deduct the cost.
    *   Call `addInventoryItem` on `useEconomyStore` to add the item to the player's inventory.
    *   Call `addTransaction` on `useEconomyStore` to log the purchase.
7.  Create a view to display the player's `inventory` from `useEconomyStore`.
8.  Update `App.tsx` to replace the `PlaceholderScreen` with your new `Market` component.



---

## 🚀 PROMPT 1C: Build Missions/Ops Component

**Objective:** Create the `Missions.tsx` component, which presents the player with a list of procedurally generated missions. Completing missions will eventually reward the player with money, XP, and reputation, but for this frontend-only implementation, we will just focus on displaying the missions and a placeholder "Start Mission" button.

### **UI/UX Requirements:**

1.  **Mission List:**
    *   Display a list of 3-5 available missions.
    *   Each mission in the list should show:
        *   A title (e.g., "Rival Takedown", "Drug Run", "Block Defense").
        *   A short description of the objective (e.g., "Eliminate 3 rival gang members on their turf.", "Deliver a package of cocaine across town.").
        *   The rewards (e.g., "$5,000", "500 XP", "+10 Rep").
        *   A difficulty rating (e.g., Easy, Medium, Hard).
    *   A "Start Mission" button for each mission.

2.  **Mission Generation:**
    *   Since this is frontend-only for now, create a utility function `generateMissions(count: number)` that returns an array of procedurally generated mission objects.
    *   The generation logic should be simple, combining random mission types, objectives, and rewards.

### **Technical Requirements:**

*   **File Location:** `frontend/src/components/missions/Missions.tsx` and `Missions.css`.
*   **Mission Generation:** Create a new utility file `frontend/src/utils/missionGenerator.ts` to house the mission generation logic.
*   **State Management:** The component should fetch its missions from a new `useMissionStore` (to be created in `gameStore.ts`).

### **Codebase Context:**

**`frontend/src/stores/gameStore.ts` (New Mission Store)**

```typescript
// Add this new store to gameStore.ts

interface MissionState {
  missions: Mission[];
  activeMission: Mission | null;
  generateMissions: () => void;
  startMission: (missionId: string) => void;
  completeMission: (success: boolean) => void;
}

export const useMissionStore = create<MissionState>()(
  devtools(
    (set, get) => ({
      missions: [],
      activeMission: null,
      generateMissions: () => {
        // This will call your new utility function
        const newMissions = missionGenerator(5); // Assuming missionGenerator is imported
        set({ missions: newMissions });
      },
      startMission: (missionId) => {
        const mission = get().missions.find(m => m.id === missionId);
        if (mission) {
          set({ activeMission: mission });
          // For now, just log to console. Later, this will trigger game events.
          console.log("Starting mission:", mission);
        }
      },
      completeMission: (success) => {
        const mission = get().activeMission;
        if (mission) {
          console.log(`Mission ${mission.title} completed ${success ? 'successfully' : 'failed'}`);
          if (success) {
            // Later, add rewards to player store
          }
          set({ activeMission: null });
        }
      },
    }),
    { name: 'mission-store' }
  )
);
```

**`frontend/src/types/game.types.ts` (New Mission Type)**

```typescript
// Add this new type to game.types.ts

export interface Mission {
  id: string;
  type: 'attack' | 'defend' | 'delivery' | 'supply_run';
  title: string;
  description: string;
  rewards: {
    money: number;
    xp: number;
    reputation: number;
  };
  difficulty: 'easy' | 'medium' | 'hard';
  isCompleted: boolean;
}
```

**`frontend/src/App.tsx` (Placeholder to replace)**

```typescript
// ...
      case 'missions':
        return <PlaceholderScreen key="missions" title="MISSION CONTROL" icon="📋" />;
// ...
```

### **Implementation Steps:**

1.  Create `frontend/src/components/missions/Missions.tsx`, `Missions.css`, and `frontend/src/utils/missionGenerator.ts`.
2.  Add the `Mission` type to `game.types.ts`.
3.  Add the `useMissionStore` to `gameStore.ts`.
4.  Implement the `missionGenerator.ts` utility to create a variety of missions.
5.  In `Missions.tsx`, use the `useMissionStore` to get and display the list of missions.
6.  When the component mounts, call `generateMissions` if the mission list is empty.
7.  Wire the "Start Mission" button to the `startMission` action in the store.
8.  Update `App.tsx` to replace the `PlaceholderScreen` with your new `Missions` component.



---

## 🚀 PROMPT 1D: Build Settings Component

**Objective:** Create the `Settings.tsx` component, allowing players to customize their game experience, including changing their gang's identity and managing game settings.

### **UI/UX Requirements:**

1.  **Gang Identity:**
    *   An input field to change the **Gang Name**.
    *   A color picker to change the **Primary and Secondary Gang Colors**.

2.  **Game Settings:**
    *   Toggles for **Sound**, **Notifications**, and **Haptic Feedback**.

3.  **Game Data:**
    *   A "Reset Game" button that clears all Zustand persisted state (with a confirmation modal).
    *   A section to display player stats (e.g., Total Earnings, Blocks Claimed, Combat Wins/Losses).

### **Technical Requirements:**

*   **File Location:** `frontend/src/components/settings/Settings.tsx` and `Settings.css`.
*   **State Management:** All changes should be saved to the `usePlayerStore`.
*   **Reset Logic:** The "Reset Game" button should call `clear()` on all persisted Zustand stores.

### **Codebase Context:**

**`frontend/src/stores/gameStore.ts` (Player Store)**

```typescript
// Relevant parts of gameStore.ts
interface PlayerState {
  player: Player;
  updatePlayer: (updates: Partial<Player>) => void;
  logout: () => void; // This can be used for reset
}

const defaultPlayer: Player = {
  // ...
  gangName: 'New Gang',
  gangColor: '#dc2626',
  settings: {
    notifications: true,
    sound: true,
    haptics: true,
    autoSave: true,
    darkMode: true,
  },
};

export const usePlayerStore = create<PlayerState>()(
  persist(
    // ...
  )
);
```

**`frontend/src/types/game.types.ts`**

```typescript
// Relevant parts of game.types.ts
export interface Player {
  // ...
  gangName: string;
  gangColor: string;
  settings: {
    notifications: boolean;
    sound: boolean;
    haptics: boolean;
    autoSave: boolean;
    darkMode: boolean;
  };
}
```

**`frontend/src/App.tsx` (Placeholder to replace)**

```typescript
// ...
      case 'settings':
        return <PlaceholderScreen key="settings" title="SETTINGS" icon="⚙️" />;
// ...
```

### **Implementation Steps:**

1.  Create `frontend/src/components/settings/Settings.tsx` and `Settings.css`.
2.  Build the UI with inputs for gang name, color pickers, and toggles for settings.
3.  Wire the inputs and toggles to the `updatePlayer` action in `usePlayerStore`.
4.  Implement the "Reset Game" button. On click, show a confirmation modal. If confirmed, call the `logout` (or a new `reset` function) on all relevant Zustand stores to clear their state.
5.  Display player stats by reading from the appropriate stores.
6.  Update `App.tsx` to replace the `PlaceholderScreen` with your new `Settings` component.



---

## 🚀 PROMPT 1E: Build Casino Component

**Objective:** Create the `Casino.tsx` component, a hub for several gambling mini-games where the player can bet their in-game cash.

### **UI/UX Requirements:**

1.  **Casino Lobby:**
    *   A main screen that presents the available games.
    *   Display the player's **Current Cash**.
    *   Cards or icons for each game: **Dice (Craps)**, **Hi-Lo (Card Game)**, and **Slots**.

2.  **Dice Game (Simplified Craps):**
    *   A simple interface to place a bet amount.
    *   A "Roll Dice" button.
    *   Two dice are rolled. If the sum is 7 or 11, the player wins 2x their bet. If the sum is 2, 3, or 12, they lose. Any other number becomes the "point," and they must roll that number again before rolling a 7 to win.

3.  **Hi-Lo Card Game:**
    *   The player is shown a card.
    *   They bet on whether the next card will be higher or lower.
    *   Correct guesses can be chained to increase the multiplier, or the player can cash out.

4.  **Slots Game:**
    *   A classic three-reel slot machine.
    *   The player places a bet and spins the reels.
    *   Payouts are based on matching symbols (e.g., cherries, 7s, bars).

### **Technical Requirements:**

*   **File Location:** `frontend/src/components/casino/Casino.tsx` and `Casino.css`. Create sub-components for each game (e.g., `DiceGame.tsx`, `HiLoGame.tsx`, `SlotsGame.tsx`).
*   **Game Logic:** All game logic should be self-contained within the components. Use `Math.random()` for dice rolls, card draws, and slot spins.
*   **State Management:**
    *   Use `usePlayerStore` to get the player's `money` and `updateMoney` to add winnings or deduct losses.
    *   Use `useEconomyStore` to log gambling transactions.

### **Codebase Context:**

**`frontend/src/stores/gameStore.ts` (Player & Economy Stores)**

```typescript
// Relevant parts of gameStore.ts

// PLAYER STORE
interface PlayerState {
  player: Player;
  updateMoney: (amount: number) => void;
}

export const usePlayerStore = create<PlayerState>()(/* ... */);

// ECONOMY STORE
interface EconomyState {
  addTransaction: (transaction: Transaction) => void;
}

export const useEconomyStore = create<EconomyState>()(/* ... */);
```

**`frontend/src/App.tsx` (Placeholder to replace)**

```typescript
// ...
      case 'casino':
        return <PlaceholderScreen key="casino" title="CASINO" icon="🎰" />;
// ...
```

### **Implementation Steps:**

1.  Create the main `Casino.tsx` lobby component and its CSS file.
2.  Create the sub-components for each mini-game (`DiceGame.tsx`, `HiLoGame.tsx`, `SlotsGame.tsx`).
3.  Implement the UI and game logic for each mini-game.
4.  Connect the games to the `usePlayerStore` to manage the player's cash.
5.  Use `useEconomyStore` to log wins and losses as transactions.
6.  Update `App.tsx` to replace the `PlaceholderScreen` with your new `Casino` component.

