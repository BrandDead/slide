# DEALT/SLIDE - COMPILED CODEBASE
## All Generated Code from AI Models

**Generated:** December 31, 2025  
**Status:** Ready for Integration

---

# TABLE OF CONTENTS

1. [Backend API (Supabase Edge Functions)](#1-backend-api)
2. [Authentication System](#2-authentication-system)
3. [Real-time Multiplayer System](#3-real-time-multiplayer)
4. [Tutorial System](#4-tutorial-system)
5. [Combat System](#5-combat-system)
6. [Type Definitions](#6-type-definitions)

---

# 1. BACKEND API

## Source: Document 2 (qwen3-coder:480b)

### _shared/cors.ts
```typescript
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

### _shared/utils.ts
```typescript
import { corsHeaders } from './cors.ts';

export function successResponse(data: any, status = 200) {
  return new Response(JSON.stringify({ success: true, data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

export function errorResponse(message: string, status = 400) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

export function validateJson(req: Request) {
  const contentType = req.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error('Content-Type must be application/json');
  }
}

export async function parseBody<T>(req: Request): Promise<T> {
  validateJson(req);
  try {
    return await req.json();
  } catch (error) {
    throw new Error('Invalid JSON in request body');
  }
}
```

### _shared/supabaseClient.ts
```typescript
import { createClient } from 'npm:@supabase/supabase-js@2';

export function createSupabaseClient(req: Request) {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    }
  );
}

export function createAdminSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
}
```

### api/deal/complete/index.ts
```typescript
import { z } from 'zod';
import { corsHeaders } from '../../../_shared/cors.ts';
import { errorResponse, successResponse, parseBody } from '../../../_shared/utils.ts';
import { createSupabaseClient } from '../../../_shared/supabaseClient.ts';

const DealCompleteSchema = z.object({
  drug_id: z.string().uuid(),
  quantity: z.number().positive(),
  client_type: z.string(),
  price: z.number().positive(),
  was_accepted: z.boolean(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await parseBody<any>(req);
    const validatedData = DealCompleteSchema.parse(body);

    const supabase = createSupabaseClient(req);
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('cash, heat_level, xp, level')
      .eq('id', user.id)
      .single();

    let cashChange = 0;
    let heatChange = 0;
    let xpGained = 0;

    if (validatedData.was_accepted) {
      cashChange = validatedData.price * validatedData.quantity;
      heatChange = Math.floor(Math.random() * 3) + 1;
      xpGained = Math.floor(validatedData.price / 100) + 1;
    } else {
      heatChange = Math.floor(Math.random() * 5) + 3;
    }

    const newBalance = profile.cash + cashChange;
    const newHeat = Math.min(100, Math.max(0, profile.heat_level + heatChange));

    await supabase
      .from('profiles')
      .update({
        cash: newBalance,
        heat_level: newHeat,
        xp: profile.xp + xpGained,
        total_deals: profile.total_deals + 1,
        successful_deals: validatedData.was_accepted ? profile.successful_deals + 1 : profile.successful_deals
      })
      .eq('id', user.id);

    await supabase.from('transactions').insert({
      player_id: user.id,
      type: cashChange > 0 ? 'deal_profit' : 'deal_loss',
      amount: cashChange,
      balance_after: newBalance,
      drug_id: validatedData.drug_id,
      client_type: validatedData.client_type,
      quantity: validatedData.quantity,
      price_per_unit: validatedData.price
    });

    return successResponse({
      cash_change: cashChange,
      new_balance: newBalance,
      heat_change: heatChange,
      new_heat: newHeat,
      xp_gained: xpGained
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(`Validation error: ${error.errors[0].message}`, 400);
    }
    return errorResponse(error.message, 500);
  }
});
```

### api/block/claim/index.ts
```typescript
import { z } from 'zod';
import { corsHeaders } from '../../../_shared/cors.ts';
import { errorResponse, successResponse, parseBody } from '../../../_shared/utils.ts';
import { createSupabaseClient } from '../../../_shared/supabaseClient.ts';

const BlockClaimSchema = z.object({
  address: z.string(),
  city: z.string(),
  region: z.string(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await parseBody<any>(req);
    const validatedData = BlockClaimSchema.parse(body);

    const supabase = createSupabaseClient(req);
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check if block already exists
    const { data: existingBlock } = await supabase
      .from('blocks')
      .select('*')
      .eq('address', validatedData.address)
      .eq('region', validatedData.region)
      .maybeSingle();

    if (existingBlock) {
      if (existingBlock.owner_id && existingBlock.owner_id !== user.id) {
        return errorResponse('Block is already claimed by another player', 400);
      }
      
      const { data: updatedBlock } = await supabase
        .from('blocks')
        .update({ owner_id: user.id, claimed_at: new Date().toISOString(), status: 'claimed' })
        .eq('id', existingBlock.id)
        .select()
        .single();

      return successResponse({ block: updatedBlock });
    } else {
      const { data: newBlock, error: insertError } = await supabase
        .from('blocks')
        .insert({
          address: validatedData.address,
          city: validatedData.city,
          region: validatedData.region,
          owner_id: user.id,
          traffic_value: Math.floor(Math.random() * 50) + 25,
          status: 'claimed',
          claimed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        return errorResponse(insertError.message, 400);
      }

      return successResponse({ block: newBlock });
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(`Validation error: ${error.errors[0].message}`, 400);
    }
    return errorResponse(error.message, 500);
  }
});
```

### api/members/recruit/index.ts
```typescript
import { z } from 'zod';
import { corsHeaders } from '../../../_shared/cors.ts';
import { errorResponse, successResponse, parseBody } from '../../../_shared/utils.ts';
import { createSupabaseClient } from '../../../_shared/supabaseClient.ts';

const MemberRecruitSchema = z.object({
  name: z.string().min(1).max(50),
  role: z.enum(['soldier', 'dealer', 'enforcer', 'chemist', 'driver', 'lookout']).optional(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await parseBody<any>(req);
    const validatedData = MemberRecruitSchema.parse(body);

    const supabase = createSupabaseClient(req);
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { data: member, error: insertError } = await supabase
      .from('gang_members')
      .insert({
        owner_id: user.id,
        name: validatedData.name,
        role: validatedData.role || 'soldier',
        accuracy: Math.floor(Math.random() * 30) + 40,
        toughness: Math.floor(Math.random() * 30) + 40,
        speed: Math.floor(Math.random() * 30) + 40,
        stealth: Math.floor(Math.random() * 30) + 40,
        hustle: Math.floor(Math.random() * 30) + 40,
        weekly_salary: 500 + Math.floor(Math.random() * 500)
      })
      .select()
      .single();

    if (insertError) {
      return errorResponse(insertError.message, 400);
    }

    return successResponse({ member }, 201);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(`Validation error: ${error.errors[0].message}`, 400);
    }
    return errorResponse(error.message, 500);
  }
});
```

---

# 2. AUTHENTICATION SYSTEM

## Source: Document 7 (deepseek-v3.1:671b)

### src/services/supabase.ts
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL!;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
```

### src/stores/authStore.ts
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../services/supabase';

interface User {
  id: string;
  email: string;
  username: string;
  gang_name: string | null;
  city_region: string | null;
  avatar_url: string | null;
  cash: number;
  bank: number;
  level: number;
  xp: number;
  reputation: number;
  heat_level: number;
}

interface AuthState {
  user: User | null;
  session: any | null;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  signup: (data: SignupData) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  clearError: () => void;
  initialize: () => Promise<void>;
}

interface SignupData {
  email: string;
  password: string;
  username: string;
  gang_name: string;
  city_region: string;
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      isLoading: false,
      error: null,

      initialize: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          set({ session, user: profile });
        }
      },

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) throw error;

          if (data.session) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', data.user.id)
              .single();

            set({ user: profile, session: data.session, isLoading: false });
          }
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
        }
      },

      signup: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const { data: authData, error } = await supabase.auth.signUp({
            email: data.email,
            password: data.password,
            options: {
              data: {
                username: data.username,
                gang_name: data.gang_name,
                city_region: data.city_region,
              }
            }
          });

          if (error) throw error;
          set({ isLoading: false });
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
        }
      },

      logout: async () => {
        await supabase.auth.signOut();
        set({ user: null, session: null });
      },

      resetPassword: async (email) => {
        set({ isLoading: true, error: null });
        try {
          const { error } = await supabase.auth.resetPasswordForEmail(email);
          if (error) throw error;
          set({ isLoading: false });
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
        }
      },

      updateProfile: async (data) => {
        const { user } = get();
        if (!user) return;

        set({ isLoading: true });
        try {
          const { error } = await supabase
            .from('profiles')
            .update(data)
            .eq('id', user.id);

          if (error) throw error;
          set({ user: { ...user, ...data }, isLoading: false });
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, session: state.session }),
    }
  )
);
```

---

# 3. REAL-TIME MULTIPLAYER

## Source: Document 3 (gpt-oss:120b) + Completion

### src/services/realtimeService.ts
```typescript
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

export type PlayerActivity = 'dealing' | 'combat' | 'crafting' | 'idle';

export interface PlayerPresence {
  id: string;
  username: string;
  position: { x: number; y: number };
  activity: PlayerActivity;
  lastSeen: string;
  online: boolean;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
}

class RealtimeService {
  private supabase: SupabaseClient;
  private presenceChannel: RealtimeChannel | null = null;
  private callbacks: {
    presence: Array<(players: PlayerPresence[]) => void>;
    notifications: Array<(payload: any) => void>;
    blocks: Array<(payload: any) => void>;
    combat: Array<(payload: any) => void>;
  } = {
    presence: [],
    notifications: [],
    blocks: [],
    combat: [],
  };

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async initialize(userId: string, username: string) {
    // Presence channel
    this.presenceChannel = this.supabase.channel('online-users');
    
    this.presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = this.presenceChannel?.presenceState();
        const players = this.formatPresenceState(state || {});
        this.callbacks.presence.forEach(cb => cb(players));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await this.presenceChannel?.track({
            user_id: userId,
            username,
            activity: 'idle',
            online_at: new Date().toISOString(),
          });
        }
      });

    // Notifications channel
    this.supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        this.callbacks.notifications.forEach(cb => cb(payload));
      })
      .subscribe();

    // Blocks channel
    this.supabase
      .channel('blocks')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'blocks',
      }, (payload) => {
        this.callbacks.blocks.forEach(cb => cb(payload));
      })
      .subscribe();
  }

  private formatPresenceState(state: Record<string, any[]>): PlayerPresence[] {
    const players: PlayerPresence[] = [];
    Object.values(state).forEach(presences => {
      presences.forEach((presence: any) => {
        players.push({
          id: presence.user_id,
          username: presence.username,
          position: presence.position || { x: 0, y: 0 },
          activity: presence.activity || 'idle',
          lastSeen: presence.online_at,
          online: true,
        });
      });
    });
    return players;
  }

  async updateActivity(activity: PlayerActivity) {
    if (this.presenceChannel) {
      await this.presenceChannel.track({ activity });
    }
  }

  subscribeToPresence(callback: (players: PlayerPresence[]) => void) {
    this.callbacks.presence.push(callback);
    return () => {
      this.callbacks.presence = this.callbacks.presence.filter(cb => cb !== callback);
    };
  }

  subscribeToNotifications(callback: (payload: any) => void) {
    this.callbacks.notifications.push(callback);
    return () => {
      this.callbacks.notifications = this.callbacks.notifications.filter(cb => cb !== callback);
    };
  }

  subscribeToBlockChanges(callback: (payload: any) => void) {
    this.callbacks.blocks.push(callback);
    return () => {
      this.callbacks.blocks = this.callbacks.blocks.filter(cb => cb !== callback);
    };
  }

  async markNotificationAsRead(id: string) {
    return this.supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('id', id);
  }

  async markAllNotificationsAsRead(userId: string) {
    return this.supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('read', false);
  }

  cleanup() {
    this.presenceChannel?.unsubscribe();
  }
}

export default RealtimeService;
```

### src/hooks/usePresence.ts
```typescript
import { useEffect, useState } from 'react';
import realtimeService, { PlayerPresence, PlayerActivity } from '../services/realtimeService';

export const usePresence = (
  userId: string,
  username: string,
  activity: PlayerActivity = 'idle'
) => {
  const [onlinePlayers, setOnlinePlayers] = useState<PlayerPresence[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    realtimeService.initialize(userId, username);
    
    const unsubscribe = realtimeService.subscribeToPresence((players) => {
      setOnlinePlayers(players);
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
      realtimeService.cleanup();
    };
  }, [userId, username]);

  useEffect(() => {
    realtimeService.updateActivity(activity);
  }, [activity]);

  return {
    onlinePlayers: onlinePlayers.filter(p => p.id !== userId),
    allPlayers: onlinePlayers,
    isLoading,
  };
};
```

---

# 4. TUTORIAL SYSTEM

## Source: Document 4 (minimax-m2)

### src/stores/tutorialStore.ts
```typescript
import React, { createContext, useContext, useMemo, useReducer } from 'react';

export interface TutorialStep {
  id: string;
  title: string;
  content: string;
  target?: {
    selector: string;
    action: 'click' | 'swipe' | 'presence' | 'timer' | 'custom';
    timeoutMs?: number;
  };
  autoAdvance?: boolean;
  optional?: boolean;
  rewards?: { id: string; label: string; amount: number }[];
}

interface TutorialState {
  currentStep: number;
  isActive: boolean;
  completed: boolean;
  completedSteps: number[];
}

type TutorialAction =
  | { type: 'START' }
  | { type: 'NEXT' }
  | { type: 'PREV' }
  | { type: 'SKIP' }
  | { type: 'COMPLETE' }
  | { type: 'RESET' };

const initialState: TutorialState = {
  currentStep: 0,
  isActive: false,
  completed: false,
  completedSteps: [],
};

function reducer(state: TutorialState, action: TutorialAction): TutorialState {
  switch (action.type) {
    case 'START':
      return { ...initialState, isActive: true };
    case 'NEXT':
      return {
        ...state,
        currentStep: state.currentStep + 1,
        completedSteps: [...new Set([...state.completedSteps, state.currentStep])],
      };
    case 'PREV':
      return { ...state, currentStep: Math.max(0, state.currentStep - 1) };
    case 'SKIP':
    case 'COMPLETE':
      return { ...state, isActive: false, completed: true };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

const TutorialContext = createContext<{
  state: TutorialState;
  dispatch: React.Dispatch<TutorialAction>;
} | null>(null);

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>;
}

export function useTutorial() {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error('useTutorial must be used within TutorialProvider');
  
  const { state, dispatch } = ctx;
  
  return {
    ...state,
    startTutorial: () => dispatch({ type: 'START' }),
    nextStep: () => dispatch({ type: 'NEXT' }),
    previousStep: () => dispatch({ type: 'PREV' }),
    skipTutorial: () => dispatch({ type: 'SKIP' }),
    completeTutorial: () => dispatch({ type: 'COMPLETE' }),
    reset: () => dispatch({ type: 'RESET' }),
  };
}
```

### Tutorial Steps Content
```typescript
// src/components/tutorial/TutorialContent.ts
import { TutorialStep } from '../../stores/tutorialStore';

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to the Crew',
    content: 'Confirm your gang name and customize your look.',
    rewards: [{ id: 'starter-cash', label: 'Cash', amount: 100 }],
  },
  {
    id: 'first-deal',
    title: 'Make Your First Deal',
    content: 'Open DEALT, review the client, and swipe to deal.',
    target: { selector: '[data-app="dealt"]', action: 'click' },
    autoAdvance: true,
    rewards: [{ id: 'profit-first', label: 'Profit', amount: 50 }],
  },
  {
    id: 'claim-territory',
    title: 'Claim Your First Block',
    content: 'Open MAP, learn the block system, and claim a block.',
    target: { selector: '[data-app="map"]', action: 'click' },
    rewards: [{ id: 'income-boost', label: 'Income/5min', amount: 10 }],
  },
  {
    id: 'recruit-member',
    title: 'Recruit Your First Member',
    content: 'Open CONTACTS to recruit and assign members.',
    target: { selector: '[data-app="contacts"]', action: 'click' },
    rewards: [{ id: 'recruit-bonus', label: 'Reputation', amount: 25 }],
  },
  {
    id: 'crafting-intro',
    title: 'Crafting Basics',
    content: 'Open ALCHEMY to craft your first item.',
    target: { selector: '[data-app="alchemy"]', action: 'click' },
    rewards: [{ id: 'craft-kit', label: 'Starter Kit', amount: 1 }],
  },
  {
    id: 'complete',
    title: "You're Ready",
    content: 'Collect your starter rewards and set loose on the city!',
    target: { selector: '[data-action="collect-rewards"]', action: 'click' },
    rewards: [{ id: 'welcome-pack', label: 'Welcome Pack', amount: 1 }],
  },
];
```

---

# 5. COMBAT SYSTEM

## Source: Document 5 (qwen3-coder)

### src/types/combatTypes.ts
```typescript
export interface CombatSession {
  id: string;
  attacker_id: string;
  defender_id: string;
  block_id: string;
  status: 'setup' | 'active' | 'ended';
  current_turn: number;
  active_player: 'attacker' | 'defender';
  attacker_units: CombatUnit[];
  defender_units: CombatUnit[];
  vehicle: Vehicle;
  fog_of_war: boolean[][];
  turns: TurnLog[];
  outcome?: CombatOutcome;
}

export interface CombatUnit {
  id: string;
  member_id: string;
  name: string;
  role: string;
  health: number;
  max_health: number;
  position_x: number;
  position_y: number;
  is_revealed: boolean;
  accuracy: number;
  damage: number;
  has_acted: boolean;
}

export interface Vehicle {
  id: string;
  type: '2-door' | '4-door' | 'suv' | 'van';
  size_x: number;
  size_y: number;
  passenger_capacity: number;
  speed: 'fast' | 'balanced' | 'slow';
  armor: number;
}

export interface CombatAction {
  unit_id: string;
  action_type: 'move' | 'attack' | 'retreat';
  target_x?: number;
  target_y?: number;
  target_unit_id?: string;
}

export interface TurnResult {
  action: CombatAction;
  success: boolean;
  damage_dealt?: number;
  target_destroyed?: boolean;
  positions_revealed?: string[];
  combat_ended?: boolean;
  outcome?: CombatOutcome;
}

export interface CombatOutcome {
  winner: 'attacker' | 'defender' | 'draw';
  reason: 'elimination' | 'retreat' | 'turn_limit';
  survivors: string[];
}
```

### src/utils/combatUtils.ts
```typescript
export const UNIT_STATS = {
  soldier: { health: 100, accuracy: 0.7, damage: 25 },
  enforcer: { health: 150, accuracy: 0.5, damage: 40 },
  dealer: { health: 75, accuracy: 0, damage: 0 },
};

export const VEHICLE_STATS = {
  '2-door': { size: [2, 1], passengers: 2, speed: 'fast', armor: 1 },
  '4-door': { size: [2, 2], passengers: 4, speed: 'balanced', armor: 2 },
  'suv': { size: [2, 2], passengers: 4, speed: 'balanced', armor: 3 },
  'van': { size: [3, 2], passengers: 6, speed: 'slow', armor: 4 },
};

export function isPositionValid(x: number, y: number): boolean {
  return x >= 0 && x <= 7 && y >= 0 && y <= 7;
}

export function calculateHit(accuracy: number): boolean {
  return Math.random() < accuracy;
}

export function calculateDamage(baseDamage: number): number {
  const multiplier = 0.8 + Math.random() * 0.4;
  return Math.round(baseDamage * multiplier);
}
```

---

# 6. TYPE DEFINITIONS

### src/types/game.types.ts
```typescript
// City regions
export type CityRegion = 
  | 'nyc' | 'la' | 'miami' | 'chicago' | 'detroit' 
  | 'new_orleans' | 'atlanta' | 'houston' | 'philadelphia' | 'baltimore';

// Drug rarity
export type DrugRarity = 'common' | 'uncommon' | 'rare' | 'legendary' | 'mythic';

// Member roles
export type MemberRole = 'soldier' | 'lieutenant' | 'dealer' | 'enforcer' | 'chemist' | 'driver' | 'lookout';

// Member status
export type MemberStatus = 'active' | 'injured' | 'arrested' | 'dead' | 'defected';

// Block status
export type BlockStatus = 'unclaimed' | 'claimed' | 'contested' | 'locked';

// Client types for DEALT
export type ClientType = 
  | 'regular' | 'addict' | 'fiend' | 'rich_kid' | 'college_student'
  | 'cop' | 'undercover' | 'snitch' | 'gang_member' | 'celebrity'
  | 'karen' | 'tweaker' | 'dealer' | 'fence';

// Transaction types
export type TransactionType = 
  | 'deal_profit' | 'deal_loss' | 'theft' | 'raid_gain' | 'raid_loss'
  | 'craft_cost' | 'craft_gain' | 'mission_reward' | 'casino_win'
  | 'casino_loss' | 'salary_payment' | 'block_income' | 'purchase'
  | 'sale' | 'bribe' | 'hospital_fee' | 'bail';

// Drug interface
export interface Drug {
  id: string;
  name: string;
  street_name: string;
  description: string;
  rarity: DrugRarity;
  base_price: number;
  profit_multiplier: number;
  heat_multiplier: number;
  is_craftable: boolean;
}

// Gang member interface
export interface GangMember {
  id: string;
  owner_id: string;
  name: string;
  nickname?: string;
  role: MemberRole;
  status: MemberStatus;
  loyalty: number;
  morale: number;
  accuracy: number;
  toughness: number;
  speed: number;
  stealth: number;
  hustle: number;
  chemistry: number;
  level: number;
  experience: number;
  health: number;
  weekly_salary: number;
  kills: number;
  deaths: number;
  deals_completed: number;
  assigned_block_id?: string;
}

// Block interface
export interface Block {
  id: string;
  address: string;
  city: string;
  region: CityRegion;
  owner_id?: string;
  status: BlockStatus;
  traffic_value: number;
  base_income: number;
  defense_level: number;
  block_heat: number;
  is_contested: boolean;
}

// Transaction interface
export interface Transaction {
  id: string;
  player_id: string;
  type: TransactionType;
  amount: number;
  balance_after: number;
  description?: string;
  created_at: string;
}
```

---

# INTEGRATION CHECKLIST

After copying these files:

1. **Install dependencies:**
```bash
npm install @supabase/supabase-js zustand framer-motion zod
```

2. **Set environment variables:**
```env
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_anon_key
```

3. **Wrap app with providers:**
```tsx
// App.tsx
import { AuthProvider } from './contexts/AuthProvider';
import { TutorialProvider } from './stores/tutorialStore';

function App() {
  return (
    <AuthProvider>
      <TutorialProvider>
        {/* Your app content */}
      </TutorialProvider>
    </AuthProvider>
  );
}
```

4. **Initialize realtime on auth:**
```tsx
// After user logs in
import realtimeService from './services/realtimeService';
realtimeService.initialize(user.id, user.username);
```

---

**End of Compiled Codebase**
