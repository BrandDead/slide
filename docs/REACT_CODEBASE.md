# DEALT/SLIDE — React/TypeScript Codebase

## 1. Type Definitions (src/types/game.types.ts)

```typescript
// ============ CORE ENTITIES ============
export interface Player {
  id: string;
  username: string;
  money: number;
  reputation: number;
  heat: number;
  level: number;
  xp: number;
  crewSize: number;
  blocksOwned: number;
}

export type ClientType = 
  | 'regular' | 'fiend' | 'prep_kid' | 'celebrity' 
  | 'undercover' | 'hustler' | 'tourist' | 'veteran';

export interface Client {
  id: string;
  type: ClientType;
  typeName: string;
  emoji: string;
  name: string;
  description: string;
  amount: number;
  payout: number;
  heatImpact: number;
  riskPercent: number;
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  redFlags: string[];
}

export interface DealOutcome {
  success: boolean;
  type: string;
  message: string;
  moneyChange: number;
  heatChange: number;
  xpGain: number;
  reputationChange: number;
}

export type UnitType = 'shooter' | 'whip' | 'dealer' | 'enforcer' | 'k9';

export interface GridCell {
  unit: { id: string; type: UnitType; health: number } | null;
  hit: boolean;
  revealed: boolean;
}

export interface Notification {
  id: string;
  type: 'alert' | 'attack' | 'income' | 'achievement' | 'system';
  title: string;
  message: string;
  icon: string;
  timestamp: Date;
  read: boolean;
  actionRequired: boolean;
}

export type AppScreen = 
  | 'home' | 'map' | 'dealt' | 'slide' | 'drive' 
  | 'cook' | 'crew' | 'casino' | 'phone' | 'market' | 'stats' | 'settings';
```

---

## 2. State Management (src/stores/gameStore.ts)

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// PLAYER STORE
interface PlayerState {
  player: Player;
  updateMoney: (amount: number) => void;
  updateHeat: (amount: number) => void;
  addXP: (amount: number) => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set) => ({
      player: {
        id: 'player_1',
        username: 'NewPlayer',
        money: 10000,
        reputation: 50,
        heat: 0,
        level: 1,
        xp: 0,
        crewSize: 2,
        blocksOwned: 1,
      },
      
      updateMoney: (amount) => set((state) => ({
        player: { ...state.player, money: Math.max(0, state.player.money + amount) }
      })),
      
      updateHeat: (amount) => set((state) => ({
        player: { ...state.player, heat: Math.min(100, Math.max(0, state.player.heat + amount)) }
      })),
      
      addXP: (amount) => set((state) => {
        const newXP = state.player.xp + amount;
        const xpToLevel = state.player.level * 1000;
        if (newXP >= xpToLevel) {
          return { player: { ...state.player, xp: newXP - xpToLevel, level: state.player.level + 1 } };
        }
        return { player: { ...state.player, xp: newXP } };
      }),
    }),
    { name: 'dealt-slide-player' }
  )
);

// NAVIGATION STORE
interface NavigationState {
  currentScreen: AppScreen;
  navigateTo: (screen: AppScreen) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  currentScreen: 'home',
  navigateTo: (screen) => set({ currentScreen: screen }),
}));

// DEALT STORE
interface DealtState {
  streak: number;
  updateStreak: (success: boolean) => void;
}

export const useDealtStore = create<DealtState>()(
  persist(
    (set) => ({
      streak: 0,
      updateStreak: (success) => set((state) => ({ streak: success ? state.streak + 1 : 0 })),
    }),
    { name: 'dealt-slide-dealt' }
  )
);
```

---

## 3. Dealt Engine (src/utils/dealtEngine.ts)

```typescript
const CLIENT_TYPES = {
  regular: {
    name: 'Regular', emoji: '👤', buyRange: [2, 5], payMultiplier: [0.9, 1.1],
    heatImpact: 3, riskPercent: 10, outcomes: ['success', 'robbery'], riskLevel: 'low',
    descriptions: ['Steady customer.', 'Just needs their fix.', 'Been around before.'],
    redFlags: []
  },
  fiend: {
    name: 'Fiend', emoji: '💀', buyRange: [5, 10], payMultiplier: [0.5, 0.8],
    heatImpact: 5, riskPercent: 30, outcomes: ['success', 'robbery', 'overdose'], riskLevel: 'high',
    descriptions: ['Desperate.', 'Shaking hands.', 'Been up for days.'],
    redFlags: ['Unpredictable', 'Might try something']
  },
  prep_kid: {
    name: 'Prep Kid', emoji: '🎒', buyRange: [2, 4], payMultiplier: [1.3, 1.8],
    heatImpact: 2, riskPercent: 15, outcomes: ['success', 'snitch'], riskLevel: 'medium',
    descriptions: ['Rich kid.', 'Designer clothes.', 'First time buyer.'],
    redFlags: ['Might talk']
  },
  celebrity: {
    name: 'Celebrity', emoji: '⭐', buyRange: [3, 6], payMultiplier: [2.0, 3.0],
    heatImpact: 8, riskPercent: 20, outcomes: ['success', 'snitch'], riskLevel: 'high',
    descriptions: ['Famous face.', 'VIP client.', 'Too high-profile.'],
    redFlags: ['Media risk', 'Everyone knows them']
  },
  undercover: {
    name: 'Undercover', emoji: '🔫', buyRange: [4, 8], payMultiplier: [1.0, 1.5],
    heatImpact: 25, riskPercent: 100, outcomes: ['bust'], riskLevel: 'extreme',
    descriptions: ['Something off...', 'Too many questions.', 'Asking about suppliers.'],
    redFlags: ['New shoes', 'Nervous', 'Specific questions']
  },
  hustler: {
    name: 'Hustler', emoji: '💰', buyRange: [8, 15], payMultiplier: [0.7, 0.9],
    heatImpact: 4, riskPercent: 25, outcomes: ['success', 'robbery'], riskLevel: 'medium',
    descriptions: ['Wants bulk.', 'Looking to flip.', 'Connected.'],
    redFlags: ['Might rob you']
  },
  tourist: {
    name: 'Tourist', emoji: '🧳', buyRange: [1, 3], payMultiplier: [1.5, 2.5],
    heatImpact: 1, riskPercent: 5, outcomes: ['success'], riskLevel: 'low',
    descriptions: ['Just visiting.', 'Camera around neck.', 'Leaving soon.'],
    redFlags: []
  },
  veteran: {
    name: 'Veteran', emoji: '🎖️', buyRange: [3, 6], payMultiplier: [0.9, 1.0],
    heatImpact: 2, riskPercent: 8, outcomes: ['success'], riskLevel: 'low',
    descriptions: ['Old timer.', 'Respectful.', 'Been doing this forever.'],
    redFlags: []
  }
};

const NAMES = ['Marcus', 'DeShawn', 'Tyler', 'Miguel', 'Jamal', 'Kevin', 'Maria', 'Ashley', 'Jessica'];

export function generateClient(heat: number, streak: number): Client {
  const types = Object.keys(CLIENT_TYPES);
  const weights = types.map(type => {
    const config = CLIENT_TYPES[type];
    if (type === 'undercover') return Math.min(30, heat / 3);
    if (config.riskLevel === 'low') return 25 - (heat / 10);
    if (config.riskLevel === 'high') return 10 + (heat / 10);
    return 10;
  });
  
  const total = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * total;
  let selectedType = 'regular';
  for (let i = 0; i < types.length; i++) {
    random -= weights[i];
    if (random <= 0) { selectedType = types[i]; break; }
  }
  
  const config = CLIENT_TYPES[selectedType];
  const amount = Math.floor(Math.random() * (config.buyRange[1] - config.buyRange[0] + 1)) + config.buyRange[0];
  const multiplier = Math.random() * (config.payMultiplier[1] - config.payMultiplier[0]) + config.payMultiplier[0];
  const payout = Math.floor(amount * 100 * multiplier);
  const streakBonus = Math.min(streak * 3, 15);
  
  return {
    id: `client_${Date.now()}`,
    type: selectedType,
    typeName: config.name,
    emoji: config.emoji,
    name: `${NAMES[Math.floor(Math.random() * NAMES.length)]} ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}.`,
    description: config.descriptions[Math.floor(Math.random() * config.descriptions.length)],
    amount, payout,
    heatImpact: config.heatImpact,
    riskPercent: Math.max(5, config.riskPercent - streakBonus),
    riskLevel: config.riskLevel,
    redFlags: [...config.redFlags]
  };
}

export function resolveDeal(client: Client, player: any, streak: number): DealOutcome {
  const config = CLIENT_TYPES[client.type];
  const roll = Math.random() * 100;
  
  let outcomeType = 'success';
  if (client.type === 'undercover') outcomeType = 'bust';
  else if (roll < client.riskPercent) {
    const bad = config.outcomes.filter(o => o !== 'success');
    outcomeType = bad[Math.floor(Math.random() * bad.length)] || 'success';
  }
  
  switch (outcomeType) {
    case 'success':
      return { success: true, type: 'success', message: 'Smooth transaction.', 
               moneyChange: client.payout, heatChange: client.heatImpact, xpGain: 50 + streak * 10, reputationChange: 1 };
    case 'bust':
      return { success: false, type: 'bust', message: 'Undercover! Lawyers took their cut.',
               moneyChange: -Math.floor(player.money * 0.3), heatChange: 25, xpGain: 0, reputationChange: -5 };
    case 'robbery':
      return { success: false, type: 'robbery', message: 'They took your product!',
               moneyChange: -Math.floor(client.payout * 0.5), heatChange: client.heatImpact * 1.5, xpGain: 10, reputationChange: -2 };
    case 'snitch':
      return { success: false, type: 'snitch', message: 'Word got out. Heat rising.',
               moneyChange: 0, heatChange: client.heatImpact * 3, xpGain: 15, reputationChange: -3 };
    default:
      return { success: false, type: 'overdose', message: 'Customer OD\'d. Bad for business.',
               moneyChange: 0, heatChange: client.heatImpact * 2, xpGain: 5, reputationChange: -4 };
  }
}
```

---

## 4. App Entry (src/App.tsx)

```typescript
import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigationStore } from './stores/gameStore';
import OSShell from './components/OSShell';
import DealtMode from './components/DealtMode';

const App: React.FC = () => {
  const { currentScreen } = useNavigationStore();
  
  return (
    <div className="app">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentScreen}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.2 }}
        >
          {currentScreen === 'dealt' ? <DealtMode /> : <OSShell />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default App;
```

---

## 5. package.json

```json
{
  "name": "dealt-slide-mvp",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build"
  },
  "dependencies": {
    "framer-motion": "^10.16.4",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zustand": "^4.4.6"
  },
  "devDependencies": {
    "@types/react": "^18.2.37",
    "@vitejs/plugin-react": "^4.1.1",
    "typescript": "^5.2.2",
    "vite": "^5.0.0"
  }
}
```
