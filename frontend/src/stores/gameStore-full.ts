import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { 
  Player, 
  GangMember, 
  Block, 
  Drug, 
  Notification, 
  Transaction,
  AppScreen,
  Client,
  DealOutcome
} from '../types/game.types';
import { generateClient, resolveDeal } from '../utils/dealtEngine';

// ============ PLAYER STORE ============

interface PlayerState {
  player: Player;
  updateMoney: (amount: number) => void;
  updateHeat: (amount: number) => void;
  updateReputation: (amount: number) => void;
  addXP: (amount: number) => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
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
        player: { 
          ...state.player, 
          money: Math.max(0, state.player.money + amount) 
        }
      })),
      
      updateHeat: (amount) => set((state) => ({
        player: { 
          ...state.player, 
          heat: Math.min(100, Math.max(0, state.player.heat + amount)) 
        }
      })),
      
      updateReputation: (amount) => set((state) => ({
        player: { 
          ...state.player, 
          reputation: Math.min(100, Math.max(0, state.player.reputation + amount)) 
        }
      })),
      
      addXP: (amount) => set((state) => {
        const newXP = state.player.xp + amount;
        const xpToLevel = state.player.level * 1000;
        
        if (newXP >= xpToLevel) {
          return {
            player: {
              ...state.player,
              xp: newXP - xpToLevel,
              level: state.player.level + 1
            }
          };
        }
        
        return { player: { ...state.player, xp: newXP } };
      }),
    }),
    { name: 'dealt-slide-player' }
  )
);

// ============ INVENTORY STORE ============

interface InventoryState {
  drugs: Drug[];
  addDrug: (drug: Drug) => void;
  removeDrug: (drugId: string, amount: number) => void;
  getDrugQuantity: (drugType: string) => number;
}

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set, get) => ({
      drugs: [
        {
          id: 'weed_1',
          type: 'weed',
          name: 'Street Weed',
          category: 'depressant',
          tier: 1,
          purity: 60,
          potency: 40,
          basePrice: 50,
          xp: 0,
          quantity: 50
        },
        {
          id: 'coke_1',
          type: 'coke',
          name: 'Cocaine',
          category: 'stimulant',
          tier: 2,
          purity: 70,
          potency: 75,
          basePrice: 200,
          xp: 0,
          quantity: 20
        },
        {
          id: 'crack_1',
          type: 'crack',
          name: 'Street Rock',
          category: 'stimulant',
          tier: 2,
          purity: 65,
          potency: 85,
          basePrice: 150,
          xp: 0,
          quantity: 30
        }
      ],
      
      addDrug: (drug) => set((state) => {
        const existing = state.drugs.find(d => d.id === drug.id);
        if (existing) {
          return {
            drugs: state.drugs.map(d => 
              d.id === drug.id 
                ? { ...d, quantity: d.quantity + drug.quantity }
                : d
            )
          };
        }
        return { drugs: [...state.drugs, drug] };
      }),
      
      removeDrug: (drugId, amount) => set((state) => ({
        drugs: state.drugs.map(d => 
          d.id === drugId 
            ? { ...d, quantity: Math.max(0, d.quantity - amount) }
            : d
        ).filter(d => d.quantity > 0)
      })),
      
      getDrugQuantity: (drugType) => {
        const drug = get().drugs.find(d => d.type === drugType);
        return drug?.quantity || 0;
      }
    }),
    { name: 'dealt-slide-inventory' }
  )
);

// ============ DEALT MODE STORE ============

interface DealtState {
  currentClient: Client | null;
  dealsToday: number;
  successfulDeals: number;
  streak: number;
  totalEarned: number;
  isAnimating: boolean;
  lastOutcome: DealOutcome | null;
  
  generateNewClient: () => void;
  acceptDeal: () => DealOutcome;
  rejectDeal: () => void;
  resetDaily: () => void;
  setAnimating: (value: boolean) => void;
}

export const useDealtStore = create<DealtState>((set, get) => ({
  currentClient: null,
  dealsToday: 0,
  successfulDeals: 0,
  streak: 0,
  totalEarned: 0,
  isAnimating: false,
  lastOutcome: null,
  
  generateNewClient: () => {
    const playerHeat = usePlayerStore.getState().player.heat;
    const client = generateClient(playerHeat);
    set({ currentClient: client, lastOutcome: null });
  },
  
  acceptDeal: () => {
    const { currentClient, streak } = get();
    if (!currentClient) {
      return { 
        success: false, 
        type: 'success', 
        moneyChange: 0, 
        heatChange: 0, 
        reputationChange: 0, 
        message: 'No client' 
      };
    }
    
    const outcome = resolveDeal(currentClient, streak);
    
    // Update player stats
    const playerStore = usePlayerStore.getState();
    playerStore.updateMoney(outcome.moneyChange);
    playerStore.updateHeat(outcome.heatChange);
    playerStore.updateReputation(outcome.reputationChange);
    
    // Update inventory if product was sold/lost
    if (outcome.success || outcome.lostProduct) {
      const inventoryStore = useInventoryStore.getState();
      const drugToRemove = inventoryStore.drugs.find(
        d => d.type === currentClient.requestedDrug
      );
      if (drugToRemove) {
        const amountLost = outcome.lostProduct || currentClient.requestedAmount;
        inventoryStore.removeDrug(drugToRemove.id, amountLost);
      }
    }
    
    // Update dealt stats
    set((state) => ({
      dealsToday: state.dealsToday + 1,
      successfulDeals: outcome.success ? state.successfulDeals + 1 : state.successfulDeals,
      streak: outcome.success ? state.streak + 1 : 0,
      totalEarned: state.totalEarned + Math.max(0, outcome.moneyChange),
      lastOutcome: outcome,
      currentClient: null
    }));
    
    return outcome;
  },
  
  rejectDeal: () => {
    set((state) => ({
      currentClient: null,
      dealsToday: state.dealsToday + 1,
      lastOutcome: null
    }));
  },
  
  resetDaily: () => set({
    dealsToday: 0,
    successfulDeals: 0,
    streak: 0,
    totalEarned: 0
  }),
  
  setAnimating: (value) => set({ isAnimating: value })
}));

// ============ NAVIGATION STORE ============

interface NavigationState {
  currentScreen: AppScreen;
  previousScreen: AppScreen | null;
  navigate: (screen: AppScreen) => void;
  goBack: () => void;
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  currentScreen: 'home',
  previousScreen: null,
  
  navigate: (screen) => set((state) => ({
    previousScreen: state.currentScreen,
    currentScreen: screen
  })),
  
  goBack: () => set((state) => ({
    currentScreen: state.previousScreen || 'home',
    previousScreen: null
  }))
}));

// ============ NOTIFICATIONS STORE ============

interface NotificationState {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  clearAll: () => void;
  unreadCount: () => number;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [
    {
      id: 'welcome',
      type: 'alert',
      title: 'Welcome to the Game',
      message: 'Start dealing to build your empire.',
      timestamp: new Date(),
      read: false,
      actionRequired: false
    }
  ],
  
  addNotification: (notification) => set((state) => ({
    notifications: [
      {
        ...notification,
        id: `notif_${Date.now()}`,
        timestamp: new Date(),
        read: false
      },
      ...state.notifications
    ].slice(0, 50) // Keep last 50
  })),
  
  markAsRead: (id) => set((state) => ({
    notifications: state.notifications.map(n =>
      n.id === id ? { ...n, read: true } : n
    )
  })),
  
  clearAll: () => set({ notifications: [] }),
  
  unreadCount: () => get().notifications.filter(n => !n.read).length
}));
