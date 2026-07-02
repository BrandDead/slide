// ============================================================
// DEALT/SLIDE - Complete Game State Management (Zustand)
// ============================================================

import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import type {
  Player,
  GangMember,
  Block,
  Client,
  DealOutcome,
  CombatSession,
  Drug,
  Recipe,
  Transaction,
  Notification,
  Contact,
  Mission,
  MoraleEvent,
  GetBackRequest,
  InventoryItem,
  MarketListing,
  SelfieUpload,
} from '../types/game.types';

// ============ NAVIGATION STORE ============

interface NavigationState {
  currentApp: string;
  previousApp: string;
  appStack: string[];
  isTransitioning: boolean;
  
  navigateTo: (app: string) => void;
  goBack: () => void;
  goHome: () => void;
  setTransitioning: (value: boolean) => void;
}

export const useNavigationStore = create<NavigationState>()(
  devtools(
    (set, get) => ({
      currentApp: 'home',
      previousApp: '',
      appStack: ['home'],
      isTransitioning: false,
      
      navigateTo: (app) => set((state) => ({
        previousApp: state.currentApp,
        currentApp: app,
        appStack: [...state.appStack, app],
      })),
      
      goBack: () => set((state) => {
        const newStack = state.appStack.slice(0, -1);
        return {
          currentApp: newStack[newStack.length - 1] || 'home',
          previousApp: state.currentApp,
          appStack: newStack.length > 0 ? newStack : ['home'],
        };
      }),
      
      goHome: () => set({
        currentApp: 'home',
        previousApp: '',
        appStack: ['home'],
      }),
      
      setTransitioning: (value) => set({ isTransitioning: value }),
    }),
    { name: 'navigation-store' }
  )
);

// ============ PLAYER STORE ============

interface PlayerState {
  player: Player;
  isAuthenticated: boolean;
  
  updatePlayer: (updates: Partial<Player>) => void;
  updateMoney: (amount: number) => void;
  updateHeat: (amount: number) => void;
  addXP: (amount: number) => void;
  levelUp: () => void;
  login: (player: Player) => void;
  logout: () => void;
}

const defaultPlayer: Player = {
  id: '',
  username: 'Player',
  email: '',
  level: 1,
  xp: 0,
  xpToNextLevel: 100,
  money: 5000,
  bankBalance: 0,
  heat: 0,
  reputation: 0,
  region: 'miami',
  gangName: 'New Gang',
  gangColor: '#dc2626',
  createdAt: new Date().toISOString(),
  lastLogin: new Date().toISOString(),
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
    devtools(
      (set, get) => ({
        player: defaultPlayer,
        isAuthenticated: false,
        
        updatePlayer: (updates) => set((state) => ({
          player: { ...state.player, ...updates },
        })),
        
        updateMoney: (amount) => set((state) => ({
          player: {
            ...state.player,
            money: Math.max(0, state.player.money + amount),
          },
        })),
        
        updateHeat: (amount) => set((state) => ({
          player: {
            ...state.player,
            heat: Math.min(100, Math.max(0, state.player.heat + amount)),
          },
        })),
        
        addXP: (amount) => {
          const { player } = get();
          const newXP = player.xp + amount;
          
          if (newXP >= player.xpToNextLevel) {
            set((state) => ({
              player: {
                ...state.player,
                xp: newXP - state.player.xpToNextLevel,
                level: state.player.level + 1,
                xpToNextLevel: Math.floor(state.player.xpToNextLevel * 1.5),
              },
            }));
          } else {
            set((state) => ({
              player: { ...state.player, xp: newXP },
            }));
          }
        },
        
        levelUp: () => set((state) => ({
          player: {
            ...state.player,
            level: state.player.level + 1,
            xpToNextLevel: Math.floor(state.player.xpToNextLevel * 1.5),
          },
        })),
        
        login: (player) => set({ player, isAuthenticated: true }),
        
        logout: () => set({ player: defaultPlayer, isAuthenticated: false }),
      }),
      { name: 'player-store' }
    ),
    { name: 'dealt-slide-player' }
  )
);

// ============ DEALT (DEALING) STORE ============

interface DealtState {
  currentClient: Client | null;
  streak: number;
  totalDeals: number;
  successfulDeals: number;
  failedDeals: number;
  dailyDeals: number;
  lastDealTime: string | null;
  
  setClient: (client: Client | null) => void;
  completeDeal: (outcome: DealOutcome) => void;
  resetStreak: () => void;
  resetDaily: () => void;
}

export const useDealtStore = create<DealtState>()(
  persist(
    devtools(
      (set) => ({
        currentClient: null,
        streak: 0,
        totalDeals: 0,
        successfulDeals: 0,
        failedDeals: 0,
        dailyDeals: 0,
        lastDealTime: null,
        
        setClient: (client) => set({ currentClient: client }),
        
        completeDeal: (outcome) => set((state) => ({
          currentClient: null,
          totalDeals: state.totalDeals + 1,
          successfulDeals: outcome.success ? state.successfulDeals + 1 : state.successfulDeals,
          failedDeals: outcome.success ? state.failedDeals : state.failedDeals + 1,
          streak: outcome.success ? state.streak + 1 : 0,
          dailyDeals: state.dailyDeals + 1,
          lastDealTime: new Date().toISOString(),
        })),
        
        resetStreak: () => set({ streak: 0 }),
        
        resetDaily: () => set({ dailyDeals: 0 }),
      }),
      { name: 'dealt-store' }
    ),
    { name: 'dealt-slide-dealt' }
  )
);

// ============ GANG MEMBERS STORE ============

interface GangState {
  members: GangMember[];
  contacts: Contact[];
  maxMembers: number;
  
  // Member management
  addMember: (member: GangMember) => void;
  updateMember: (id: string, updates: Partial<GangMember>) => void;
  removeMember: (id: string) => void;
  killMember: (id: string, cause: string, killedBy?: string) => void;
  backdoorMember: (id: string, reason: string) => void;
  jailMember: (id: string) => void;
  releaseMember: (id: string) => void;
  
  // Contact book
  addContact: (contact: Contact) => void;
  updateContact: (id: string, updates: Partial<Contact>) => void;
  
  // Stats
  getMemberById: (id: string) => GangMember | undefined;
  getActiveMembers: () => GangMember[];
  getDeadMembers: () => Contact[];
  getJailedMembers: () => Contact[];
}

export const useGangStore = create<GangState>()(
  persist(
    devtools(
      (set, get) => ({
        members: [],
        contacts: [],
        maxMembers: 20,
        
        addMember: (member) => set((state) => ({
          members: [...state.members, member],
          contacts: [...state.contacts, {
            id: member.id,
            memberId: member.id,
            name: member.name,
            nickname: member.nickname,
            role: member.role ?? 'soldier',
            status: 'active',
            customAvatarUrl: member.customAvatarUrl,
          } as Contact],
        })),
        
        updateMember: (id, updates) => set((state) => ({
          members: state.members.map((m) =>
            m.id === id ? { ...m, ...updates } : m
          ),
        })),
        
        removeMember: (id) => set((state) => ({
          members: state.members.filter((m) => m.id !== id),
        })),
        
        killMember: (id, cause, killedBy) => set((state) => {
          const member = state.members.find((m) => m.id === id);
          if (!member) return state;
          
          const deathDate = new Date().toISOString();
          
          return {
            members: state.members.filter((m) => m.id !== id),
            contacts: state.contacts.map((c) =>
              c.memberId === id
                ? {
                    ...c,
                    status: 'dead' as const,
                    statusEmoji: '💀',
                    deathDate,
                    deathCause: cause,
                    killedBy,
                    finalStats: {
                      level: member.level,
                      kills: 0, // Would need combat tracking
                      deals: 0, // Would need deal tracking
                      earnings: 0, // Would need earning tracking
                    },
                  }
                : c
            ),
          };
        }),
        
        backdoorMember: (id, reason) => set((state) => {
          const member = state.members.find((m) => m.id === id);
          if (!member) return state;
          
          return {
            members: state.members.filter((m) => m.id !== id),
            contacts: state.contacts.map((c) =>
              c.memberId === id
                ? {
                    ...c,
                    status: 'backdoored' as const,
                    statusEmoji: '🔙',
                    deathDate: new Date().toISOString(),
                    deathCause: reason,
                    backdooredBy: 'Player',
                  }
                : c
            ),
          };
        }),
        
        jailMember: (id) => set((state) => ({
          members: state.members.map((m) =>
            m.id === id ? { ...m, status: 'jailed' as const } : m
          ),
          contacts: state.contacts.map((c) =>
            c.memberId === id
              ? { ...c, status: 'jailed' as const, statusEmoji: '⛓️' }
              : c
          ),
        })),
        
        releaseMember: (id) => set((state) => ({
          members: state.members.map((m) =>
            m.id === id ? { ...m, status: 'active' as const } : m
          ),
          contacts: state.contacts.map((c) =>
            c.memberId === id
              ? { ...c, status: 'active' as const, statusEmoji: '✅' }
              : c
          ),
        })),
        
        addContact: (contact) => set((state) => ({
          contacts: [...state.contacts, contact],
        })),
        
        updateContact: (id, updates) => set((state) => ({
          contacts: state.contacts.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        })),
        
        getMemberById: (id) => get().members.find((m) => m.id === id),
        
        getActiveMembers: () =>
          get().members.filter((m) => m.status === 'active'),
        
        getDeadMembers: () =>
          get().contacts.filter((c) => c.status === 'dead' || c.status === 'backdoored'),
        
        getJailedMembers: () =>
          get().contacts.filter((c) => c.status === 'jailed'),
      }),
      { name: 'gang-store' }
    ),
    { name: 'dealt-slide-gang' }
  )
);

// ============ MORALE & LOYALTY STORE ============

interface MoraleState {
  events: MoraleEvent[];
  getBackRequests: GetBackRequest[];
  
  addMoraleEvent: (event: MoraleEvent) => void;
  addGetBackRequest: (request: GetBackRequest) => void;
  resolveGetBackRequest: (id: string, status: 'completed' | 'failed' | 'ignored') => void;
  applyMoraleChange: (memberId: string, moraleChange: number, loyaltyChange: number) => void;
}

export const useMoraleStore = create<MoraleState>()(
  persist(
    devtools(
      (set, get) => ({
        events: [],
        getBackRequests: [],
        
        addMoraleEvent: (event) => set((state) => ({
          events: [event, ...state.events].slice(0, 100), // Keep last 100
        })),
        
        addGetBackRequest: (request) => set((state) => ({
          getBackRequests: [...state.getBackRequests, request],
        })),
        
        resolveGetBackRequest: (id, status) => set((state) => ({
          getBackRequests: state.getBackRequests.map((r) =>
            r.id === id ? { ...r, status } : r
          ),
        })),
        
        applyMoraleChange: (memberId, moraleChange, loyaltyChange) => {
          const gangStore = useGangStore.getState();
          const member = gangStore.getMemberById(memberId);
          
          if (member) {
            gangStore.updateMember(memberId, {
              morale: Math.min(100, Math.max(0, member.morale + moraleChange)),
              loyalty: Math.min(100, Math.max(0, member.loyalty + loyaltyChange)),
            });
          }
        },
      }),
      { name: 'morale-store' }
    ),
    { name: 'dealt-slide-morale' }
  )
);

// ============ TERRITORY STORE ============

interface TerritoryState {
  blocks: Block[];
  selectedBlockId: string | null;
  
  addBlock: (block: Block) => void;
  updateBlock: (id: string, updates: Partial<Block>) => void;
  claimBlock: (id: string, playerId: string, playerName: string, gangColor: string) => void;
  selectBlock: (id: string | null) => void;
  assignMember: (blockId: string, memberId: string, position: { row: number; col: number }) => void;
  removeMemberFromBlock: (blockId: string, memberId: string) => void;
}

export const useTerritoryStore = create<TerritoryState>()(
  persist(
    devtools(
      (set) => ({
        blocks: [],
        selectedBlockId: null,
        
        addBlock: (block) => set((state) => ({
          blocks: [...state.blocks, block],
        })),
        
        updateBlock: (id, updates) => set((state) => ({
          blocks: state.blocks.map((b) =>
            b.id === id ? { ...b, ...updates } : b
          ),
        })),
        
        claimBlock: (id, playerId, playerName, gangColor) => set((state) => ({
          blocks: state.blocks.map((b) =>
            b.id === id
              ? {
                  ...b,
                  ownerId: playerId,
                  ownerName: playerName,
                  gangColor,
                  claimedAt: new Date().toISOString(),
                }
              : b
          ),
        })),
        
        selectBlock: (id) => set({ selectedBlockId: id }),
        
                assignMember: (blockId, memberId, position) => set((state) => {
          const gangStore = useGangStore.getState();
          const member = gangStore.getMemberById(memberId);
          if (!member) return state as TerritoryState;
          return {
            ...state,
            blocks: state.blocks.map((b) =>
              b.id === blockId
                ? {
                    ...b,
                    units: [
                      ...b.units,
                      {
                        id: `unit-${memberId}`,
                        type: (member.role ?? 'soldier') as any,
                        gangMemberId: memberId,
                        memberId,
                        blockId,
                        position,
                        health: member.health ?? 100,
                        maxHealth: member.maxHealth ?? 100,
                        accuracy: 0.5,
                        nerve: 0.5,
                        speed: 50,
                        weaponId: null,
                        armorLevel: 0,
                        status: 'idle' as const,
                        assignedTask: null,
                      },
                    ],
                  }
                : b
            ),
          } as TerritoryState;
        }),
        
        removeMemberFromBlock: (blockId, memberId) => set((state) => ({
          blocks: state.blocks.map((b) =>
            b.id === blockId
              ? {
                  ...b,
                  units: b.units.filter((u) => u.memberId !== memberId),
                }
              : b
          ),
        })),
      }),
      { name: 'territory-store' }
    ),
    { name: 'dealt-slide-territory' }
  )
);

// ============ ECONOMY STORE ============

interface EconomyState {
  transactions: Transaction[];
  inventory: InventoryItem[];
  marketListings: MarketListing[];
  
  addTransaction: (transaction: Transaction) => void;
  addInventoryItem: (item: InventoryItem) => void;
  removeInventoryItem: (itemId: string, quantity: number) => void;
  transferItemToMember: (itemId: string, memberId: string, quantity: number) => void;
  purchaseFromMarket: (listingId: string, quantity: number) => boolean;
}

export const useEconomyStore = create<EconomyState>()(
  persist(
    devtools(
      (set, get) => ({
        transactions: [],
        inventory: [
          { id: '1', type: 'drug' as const, itemId: 'weed', name: 'Cannabis', quantity: 50, acquiredAt: new Date().toISOString(), value: 20 },
          { id: '2', type: 'drug' as const, itemId: 'coke', name: 'Cocaine', quantity: 20, acquiredAt: new Date().toISOString(), value: 80 },
          { id: '3', type: 'drug' as const, itemId: 'pills', name: 'Percocet', quantity: 30, acquiredAt: new Date().toISOString(), value: 50 },
        ],
        marketListings: [],
        
        addTransaction: (transaction) => set((state) => ({
          transactions: [transaction, ...state.transactions].slice(0, 200),
        })),
        
        addInventoryItem: (item) => set((state) => {
          const existing = state.inventory.find(
            (i) => i.itemId === item.itemId && i.type === item.type
          );
          
          if (existing) {
            return {
              inventory: state.inventory.map((i) =>
                i.id === existing.id
                  ? { ...i, quantity: i.quantity + item.quantity }
                  : i
              ),
            };
          }
          
          return {
            inventory: [...state.inventory, item],
          };
        }),
        
        removeInventoryItem: (itemId, quantity) => set((state) => ({
          inventory: state.inventory
            .map((i) =>
              i.itemId === itemId
                ? { ...i, quantity: Math.max(0, i.quantity - quantity) }
                : i
            )
            .filter((i) => i.quantity > 0),
        })),
        
        transferItemToMember: (itemId, memberId, quantity) => {
          const { inventory } = get();
          const item = inventory.find((i) => i.itemId === itemId);
          
          if (!item || item.quantity < quantity) return;
          
          const gangStore = useGangStore.getState();
          const member = gangStore.getMemberById(memberId);
          
          if (!member) return;
          
          // Remove from player inventory
          set((state) => ({
            inventory: state.inventory.map((i) =>
              i.itemId === itemId
                ? { ...i, quantity: i.quantity - quantity }
                : i
            ),
          }));
          
          // Add to member inventory
          gangStore.updateMember(memberId, {
            inventory: [
              ...(member.inventory ?? []),
              {
                id: Date.now().toString(),
                type: item.type,
                itemId: item.itemId,
                name: item.name,
                quantity,
                acquiredAt: new Date().toISOString(),
                value: item.value,
              },
            ],
          });
        },
        
        purchaseFromMarket: (listingId, quantity) => {
          const { marketListings } = get();
          const listing = marketListings.find((l) => l.id === listingId);
          
          if (!listing || !listing.available || (listing as any).quantity < quantity) {
            return false;
          }
          
          const totalCost = listing.price * quantity;
          const playerStore = usePlayerStore.getState();
          
          if (playerStore.player.money < totalCost) {
            return false;
          }
          
          // Deduct money
          playerStore.updateMoney(-totalCost);
          
          // Add item to inventory
          get().addInventoryItem({
            id: Date.now().toString(),
            type: (listing as any).type ?? 'consumable',
            itemId: (listing as any).itemId ?? listing.id,
            name: listing.name,
            quantity,
            acquiredAt: new Date().toISOString(),
            value: listing.price,
          });
          
          // Record transaction
          get().addTransaction({
            id: Date.now().toString(),
            type: 'purchase',
            amount: -totalCost,
            description: `Purchased ${quantity}x ${listing.name}`,
            category: 'market',
            relatedEntityId: listingId,
            timestamp: new Date().toISOString(),
          });
          
          // Update listing
          set((state) => ({
            marketListings: state.marketListings.map((l) =>
              l.id === listingId
                ? { ...l, quantity: (l.quantity ?? l.stock) - quantity }
                : l
            ),
          }));
          
          return true;
        },
      }),
      { name: 'economy-store' }
    ),
    { name: 'dealt-slide-economy' }
  )
);

// ============ NOTIFICATIONS STORE ============

interface NotificationState {
  notifications: Notification[];
  
  addNotification: (notification: Omit<Notification, 'id' | 'read' | 'timestamp'> & { timestamp?: number }) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  getUnreadCount: () => number;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    devtools(
      (set, get) => ({
        notifications: [],
        
        addNotification: (notification) => set((state) => ({
          notifications: [
            {
              ...notification,
              id: Date.now().toString(),
              timestamp: notification.timestamp ?? Date.now(),
              createdAt: new Date().toISOString(),
              read: false,
            },
            ...state.notifications,
          ].slice(0, 50),
        })),
        
        markAsRead: (id) => set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        })),
        
        markAllAsRead: () => set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        })),
        
        clearAll: () => set({ notifications: [] }),
        
        getUnreadCount: () =>
          get().notifications.filter((n) => !n.read).length,
      }),
      { name: 'notification-store' }
    ),
    { name: 'dealt-slide-notifications' }
  )
);

// ============ SELFIE UPLOAD STORE ============

interface SelfieState {
  uploads: SelfieUpload[];
  
  addUpload: (upload: SelfieUpload) => void;
  updateUpload: (id: string, updates: Partial<SelfieUpload>) => void;
  removeUpload: (id: string) => void;
}

export const useSelfieStore = create<SelfieState>()(
  persist(
    devtools(
      (set) => ({
        uploads: [],
        
        addUpload: (upload) => set((state) => ({
          uploads: [...state.uploads, upload],
        })),
        
        updateUpload: (id, updates) => set((state) => ({
          uploads: state.uploads.map((u) =>
            u.id === id ? { ...u, ...updates } : u
          ),
        })),
        
        removeUpload: (id) => set((state) => ({
          uploads: state.uploads.filter((u) => u.id !== id),
        })),
      }),
      { name: 'selfie-store' }
    ),
    { name: 'dealt-slide-selfies' }
  )
);
