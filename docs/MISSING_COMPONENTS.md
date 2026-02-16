# Missing Components & Implementation Plan

This document outlines the UI components that are still needed to complete the core gameplay loops of SLIDE. The backend logic, type definitions, and utility functions for these systems are largely in place. The primary remaining work is to build the React components to expose this functionality to the player.

---

## 1. SLIDE Combat UI (`frontend/src/components/slide/`)

**Core Logic Ready:** `dualGrid.ts`, `attackPatterns.ts`, `turnLogic.ts`, `gridFactory.ts`, `slide.types.ts`

### Components Needed:

- **`SlideGame.tsx`**: The main container for the combat screen. It will manage the game state (`SlideGameState`), handle turn progression, and render the appropriate sub-components based on the current `SlidePhase`.
- **`MacroGrid.tsx`**: Renders the 8x8 defender grid. It should display placed units, show hit/miss states, and allow the attacker to select targets.
- **`MicroGrid.tsx`**: Renders the 16x16 attacker grid (the vehicle). It should display vehicle parts, show damage states, and allow the defender to target specific parts.
- **`UnitPlacement.tsx`**: A UI for the defender to drag and drop their units (`BlockUnit`) onto the `MacroGrid` during the `setup` phase, respecting `PLACEMENT_RULES`.
- **`CombatHUD.tsx`**: Heads-up display showing ammo, health, turn info, and player stats.
- **`CombatActions.tsx`**: Buttons for the current player to confirm attacks, switch patterns, or retreat.
- **`TurnResolver.tsx`**: A component to visualize the outcome of a turn (e.g., showing projectiles, explosions, and damage numbers).

---

## 2. COOK LAB (Alchemy) UI (`frontend/src/components/alchemy/`)

**Core Logic Ready:** `alchemyEngine.ts`, `alchemy.types.ts`

### Components Needed:

- **`AlchemyLab.tsx`**: The main container for the crafting screen. It will manage the `AlchemyState`, including discovered elements and recipes.
- **`ElementGrid.tsx`**: Displays all `discoveredElements` that the player can select for crafting.
- **`CraftingTable.tsx`**: Shows the currently selected elements for combination.
- **`RecipeBook.tsx`**: A UI to view all `discoveredRecipes`, including their ingredients and effects.
- **`CraftingResult.tsx`**: A modal or screen that displays the result of a successful or failed craft, including the stats of the `CraftingResult`.
- **`CraftingQueue.tsx`**: Shows any `activeCraftingSessions` and their remaining time.

---

## 3. Territory Map UI (`frontend/src/components/map/`)

**Core Logic Ready:** `pasted_content.txt` contains a detailed guide for Mapbox integration.

### Components Needed:

- **`TerritoryMap.tsx`**: The main component that will initialize and render the Mapbox GL JS map.
- **`BlockGridOverlay.tsx`**: An overlay on the map to show the 8x8 grid for a selected block.
- **`MemberPlacer.tsx`**: UI for dragging and dropping gang members onto the `BlockGridOverlay` to position them on the block.
- **`BlockInfoPanel.tsx`**: A slide-out panel showing stats for a selected block (owner, heat, income, etc.).
- **`ClaimBlockModal.tsx`**: A modal for when a player wants to claim a new block by entering an address.
- **`NearbyBlocksList.tsx`**: A list of nearby blocks that the player can interact with.

---

## 4. Authentication UI (`frontend/src/components/auth/`)

**Core Logic Ready:** `supabase.ts` contains `authService` for signup and signin.

### Components Needed:

- **`Login.tsx`**: A form for users to sign in with email/password or OAuth providers.
- **`Signup.tsx`**: A form for new users to create an account.
- **`AuthGuard.tsx`**: A higher-order component to protect routes that require authentication.

---

## 5. Other UI Components

- **Gang Management (`frontend/src/components/gang/`)**: UI to view member cards, stats, level progression, and assign them to blocks.
- **Economy/Shoebox (`frontend/src/components/economy/`)**: UI to view transactions, pay bail, and manage hospital bills.
- **Casino Games (`frontend/src/components/casino/`)**: Phaser 3 integration for Blackjack, Craps, etc.
- **Mission System (`frontend/src/components/missions/`)**: UI to view and track available missions.

---

## `App.tsx` Implementation

To integrate these new components, the `frontend/src/App.tsx` file should be updated to import and render them in the router.

```typescript
// frontend/src/App.tsx (Updated)
import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigationStore } from './stores/gameStore';

// Layout
import OSShell from './components/layout/OSShell';

// Game Modes (Existing and New)
import DealtMode from './components/dealt/DealtMode';
import Contacts from './components/contacts/Contacts';
import SlideGame from './components/slide/SlideGame';
import DriveByEngine from './components/driveby/DriveByEngine';
import AlchemyLab from './components/alchemy/AlchemyLab';
import TerritoryMap from './components/map/TerritoryMap';

// Placeholder for other screens
const PlaceholderScreen: React.FC<{ title: string; icon: string }> = ({ title, icon }) => {
  const { goBack } = useNavigationStore();
  return (
    <div style={{ padding: '20px', color: 'white' }}>
      <button onClick={goBack}>← Back</button>
      <h2>{title}</h2>
      <p>Coming Soon</p>
    </div>
  );
};

const pageVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

const App: React.FC = () => {
  const { currentApp } = useNavigationStore();

  const renderCurrentApp = () => {
    switch (currentApp) {
      case 'home':
        return <OSShell key="home" />;
      case 'dealt':
        return <DealtMode key="dealt" />;
      case 'contacts':
        return <Contacts key="contacts" />;
      case 'slide':
        return <SlideGame key="slide" />;
      case 'driveby':
        return <DriveByEngine key="driveby" />;
      case 'alchemy':
        return <AlchemyLab key="alchemy" />;
      case 'map':
        return <TerritoryMap key="map" />;
      // Add other cases for new components here
      case 'shoebox':
        return <PlaceholderScreen key="shoebox" title="SHOEBOX" icon="💰" />;
      case 'market':
        return <PlaceholderScreen key="market" title="UNDERWORLD MARKET" icon="🏪" />;
      case 'missions':
        return <PlaceholderScreen key="missions" title="MISSION CONTROL" icon="📋" />;
      case 'casino':
        return <PlaceholderScreen key="casino" title="CASINO" icon="🎰" />;
      case 'phone':
        return <PlaceholderScreen key="phone" title="PHONE" icon="📱" />;
      case 'settings':
        return <PlaceholderScreen key="settings" title="SETTINGS" icon="⚙️" />;
      default:
        return <OSShell key="home" />;
    }
  };

  return (
    <div className="app-container">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentApp}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="page-container"
        >
          {renderCurrentApp()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default App;
```
