# DEALT/SLIDE - AI DEVELOPER CODEBASE CONTEXT PROMPT
## Include This When Asking AI to Build New Game Features

---

**COPY EVERYTHING BELOW THIS LINE WHEN PROMPTING AN AI DEV:**

---

# CODEBASE CONTEXT FOR DEALT/SLIDE

You are adding a new feature/game to an existing React TypeScript codebase. Follow these specifications exactly to ensure your code integrates seamlessly.

## TECH STACK (MUST USE)

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | React | 18.x |
| Language | TypeScript | 5.x (strict mode) |
| Build Tool | Vite | 5.x |
| State Management | Zustand | 4.x |
| Styling | Tailwind CSS | 3.x |
| Animations | Framer Motion | 10.x |
| Icons | Lucide React | latest |
| Game Engine (if needed) | Phaser 3 | 3.70+ |
| Backend | Supabase | latest |
| Maps (if needed) | Mapbox GL | 3.x |

## PROJECT STRUCTURE

```
src/
├── components/
│   ├── layout/           # Shell, nav, notifications
│   │   ├── OSShell.tsx   # Main iOS-style container
│   │   ├── NavigationBar.tsx
│   │   └── NotificationCenter.tsx
│   │
│   ├── [game-name]/      # Each game mode gets its own folder
│   │   ├── [GameName]Game.tsx    # Main game component
│   │   ├── [SubComponent].tsx    # Supporting components
│   │   └── index.ts              # Barrel export
│   │
│   └── shared/           # Reusable UI components
│       ├── Button.tsx
│       ├── Card.tsx
│       └── Modal.tsx
│
├── stores/               # Zustand stores
│   ├── gameStore.ts      # Global game state
│   ├── userStore.ts      # Player profile, auth
│   ├── economyStore.ts   # Cash, inventory
│   └── [feature]Store.ts # Feature-specific stores
│
├── services/             # External API calls
│   ├── supabase.ts       # Database client
│   ├── api.service.ts    # REST calls
│   └── socket.service.ts # Real-time events
│
├── types/                # TypeScript definitions
│   ├── game.types.ts     # Core game types
│   ├── api.types.ts      # API response types
│   └── database.types.ts # Supabase schema types
│
├── hooks/                # Custom React hooks
│   ├── useGameState.ts
│   ├── useSupabase.ts
│   └── use[Feature].ts
│
├── utils/                # Pure utility functions
│   ├── calculations.ts
│   ├── formatters.ts
│   └── validators.ts
│
└── config/               # Configuration constants
    └── constants.ts
```

## CODE STYLE REQUIREMENTS

### TypeScript Rules
```typescript
// ✅ ALWAYS use explicit types
interface PlayerStats {
  health: number;
  cash: number;
  heat: number;
}

// ✅ ALWAYS use functional components
const MyComponent: React.FC<Props> = ({ prop1, prop2 }) => {
  // ...
};

// ✅ ALWAYS destructure props
const Card = ({ title, children, onClick }: CardProps) => {
  // ...
};

// ❌ NEVER use `any` type
// ❌ NEVER use class components
// ❌ NEVER use inline styles (use Tailwind)
```

### Zustand Store Pattern
```typescript
// stores/exampleStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface ExampleState {
  // State
  items: Item[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  addItem: (item: Item) => void;
  removeItem: (id: string) => void;
  fetchItems: () => Promise<void>;
  reset: () => void;
}

export const useExampleStore = create<ExampleState>()(
  devtools(
    (set, get) => ({
      // Initial state
      items: [],
      isLoading: false,
      error: null,
      
      // Actions
      addItem: (item) => set((state) => ({ 
        items: [...state.items, item] 
      })),
      
      removeItem: (id) => set((state) => ({ 
        items: state.items.filter(i => i.id !== id) 
      })),
      
      fetchItems: async () => {
        set({ isLoading: true, error: null });
        try {
          const data = await api.getItems();
          set({ items: data, isLoading: false });
        } catch (err) {
          set({ error: err.message, isLoading: false });
        }
      },
      
      reset: () => set({ items: [], isLoading: false, error: null }),
    }),
    { name: 'example-store' }
  )
);
```

### Component Pattern
```typescript
// components/feature/FeatureCard.tsx
import { motion } from 'framer-motion';
import { cn } from '@/utils/cn';

interface FeatureCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  variant?: 'default' | 'danger' | 'success';
  onClick?: () => void;
  className?: string;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({
  title,
  value,
  icon,
  variant = 'default',
  onClick,
  className,
}) => {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        'rounded-xl p-4 backdrop-blur-sm',
        'border border-white/10',
        variant === 'default' && 'bg-white/5',
        variant === 'danger' && 'bg-red-500/20 border-red-500/30',
        variant === 'success' && 'bg-green-500/20 border-green-500/30',
        onClick && 'cursor-pointer',
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className="text-2xl">{icon}</div>
        <div>
          <p className="text-sm text-white/60">{title}</p>
          <p className="text-xl font-bold text-white">{value.toLocaleString()}</p>
        </div>
      </div>
    </motion.div>
  );
};
```

### Hook Pattern
```typescript
// hooks/useFeature.ts
import { useEffect, useCallback } from 'react';
import { useFeatureStore } from '@/stores/featureStore';
import { useUserStore } from '@/stores/userStore';

export const useFeature = () => {
  const { items, isLoading, fetchItems, addItem } = useFeatureStore();
  const { userId } = useUserStore();
  
  // Fetch on mount
  useEffect(() => {
    if (userId) {
      fetchItems();
    }
  }, [userId, fetchItems]);
  
  // Memoized handlers
  const handleAdd = useCallback((data: ItemData) => {
    addItem({ ...data, userId, createdAt: new Date() });
  }, [userId, addItem]);
  
  return {
    items,
    isLoading,
    handleAdd,
  };
};
```

## UI/UX REQUIREMENTS

### Visual Style
- **Dark theme** with glassmorphism effects
- **iOS-style** cards and interactions
- Colors: Dark backgrounds (#0a0a0f), accent colors per game mode
- Rounded corners: `rounded-xl` or `rounded-2xl`
- Subtle borders: `border border-white/10`
- Glassmorphism: `bg-white/5 backdrop-blur-sm`
- Shadows: `shadow-lg shadow-black/20`

### Animation Standards
```typescript
// Standard hover effect
whileHover={{ scale: 1.02 }}
whileTap={{ scale: 0.98 }}

// Page transitions
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
exit={{ opacity: 0, y: -20 }}
transition={{ duration: 0.3 }}

// Staggered children
variants={{
  container: {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  },
  item: {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  }
}}
```

### Responsive Design
- Mobile-first approach
- Breakpoints: sm (640px), md (768px), lg (1024px)
- Touch-friendly tap targets (min 44px)
- Safe areas for mobile notch/home indicator

## DATABASE INTEGRATION

### Supabase Pattern
```typescript
// Always use the service layer
import { supabase } from '@/services/supabase';

// For reads
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('user_id', userId);

// For writes
const { data, error } = await supabase
  .from('table_name')
  .insert({ ...newData })
  .select()
  .single();

// For real-time
const subscription = supabase
  .channel('channel-name')
  .on('postgres_changes', { 
    event: '*', 
    schema: 'public', 
    table: 'table_name' 
  }, callback)
  .subscribe();
```

## GAME-SPECIFIC INTEGRATION POINTS

When building a new game mode, you MUST integrate with:

### 1. Economy System
```typescript
import { useEconomyStore } from '@/stores/economyStore';

// Access player cash
const { cash, addCash, subtractCash } = useEconomyStore();

// Record transactions
await transactionService.recordDeal({
  amount: profit,
  drugId,
  clientType: 'regular',
  quantity: 1,
  pricePerUnit: 50,
});
```

### 2. Heat System
```typescript
import { useGameStore } from '@/stores/gameStore';

// Access and modify heat
const { heat, addHeat, decayHeat } = useGameStore();

// Heat affects gameplay
if (heat > 80) {
  // Increased police presence
  // Higher risk events
}
```

### 3. Gang Members
```typescript
import { useGangStore } from '@/stores/gangStore';

// Access members
const { members, assignMember, updateMemberStats } = useGangStore();

// Members have stats that affect gameplay
const accuracy = member.accuracy + member.weapon_accuracy_bonus;
```

### 4. Notifications
```typescript
import { useNotificationStore } from '@/stores/notificationStore';

const { addNotification } = useNotificationStore();

// Send in-game notification
addNotification({
  type: 'success',
  title: 'Deal Complete',
  message: `Earned $${profit}`,
});
```

## FILE NAMING CONVENTIONS

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `DrugCard.tsx` |
| Hooks | camelCase with "use" | `useInventory.ts` |
| Stores | camelCase with "Store" | `inventoryStore.ts` |
| Utils | camelCase | `formatCurrency.ts` |
| Types | camelCase with ".types" | `inventory.types.ts` |
| Services | camelCase with ".service" | `inventory.service.ts` |

## TESTING CHECKLIST

Before submitting code:
- [ ] TypeScript compiles with no errors
- [ ] All props have explicit types
- [ ] Component has loading state
- [ ] Component has error state
- [ ] Mobile responsive
- [ ] Animations feel smooth
- [ ] Integrates with relevant stores
- [ ] Database operations use service layer
- [ ] No console.log statements (use proper logging)

## EXAMPLE: ADDING A NEW MINI-GAME

If asked to create a new game called "Poker", you would:

1. Create folder: `src/components/poker/`
2. Create main component: `PokerGame.tsx`
3. Create store: `src/stores/pokerStore.ts`
4. Create types: `src/types/poker.types.ts`
5. Create hook: `src/hooks/usePoker.ts`
6. Add to navigation in OSShell
7. Integrate with economyStore for betting
8. Add database table for poker_games if needed

---

**END OF CODEBASE CONTEXT**

---

Now, describe the new feature/game you want built:

[YOUR FEATURE REQUEST HERE]
