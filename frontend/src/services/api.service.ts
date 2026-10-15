// ═══════════════════════════════════════════════════════════════════════════
// DEALT/SLIDE - API Service
// Centralized HTTP client for all API calls
// Matches Flask backend routes (see docs/openapi.yaml for full contract)
// ═══════════════════════════════════════════════════════════════════════════

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import type {
  Block,
  GangMember,
  Transaction,
  InventoryItem,
  MarketListing,
} from '../types/game.types';
import type {
  BlockSearchResponse,
  GenerateBackgroundsResponse,
} from '../types/api.types';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// ─────────────────────────────────────────────────────────────────────────────
// API CLIENT SETUP
// ─────────────────────────────────────────────────────────────────────────────

const apiClient: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

type SessionRequestConfig = InternalAxiosRequestConfig & {
  _authUserId?: string | null;
  _retry?: boolean;
};

let supabaseModule: Promise<typeof import('./supabase')> | null = null;

function loadSupabase() {
  supabaseModule ??= import('./supabase');
  return supabaseModule;
}

async function getCurrentSession() {
  // Pure stores also import this module in offline tools/tests. Initialize the
  // configured SDK only when an HTTP request actually needs its session.
  const { supabase } = await loadSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

function requireSameAccount(config: SessionRequestConfig, userId: string | null) {
  if (config._authUserId !== undefined && config._authUserId !== userId) {
    throw new axios.CanceledError('Account changed while the request was pending', config);
  }
}

let refreshInFlight: { userId: string; promise: Promise<void> } | null = null;

async function refreshCurrentSession(userId: string): Promise<void> {
  if (refreshInFlight?.userId === userId) return refreshInFlight.promise;

  const pending = {
    userId,
    promise: (async () => {
      const { supabase } = await loadSupabase();
      const { data, error } = await supabase.auth.refreshSession();
      if (error) throw error;
      if (!data.session?.access_token || data.session.user.id !== userId) {
        throw new Error('The original session is no longer available');
      }
    })(),
  };
  refreshInFlight = pending;
  try {
    await pending.promise;
  } finally {
    if (refreshInFlight === pending) refreshInFlight = null;
  }
}

// Use the same SDK session as AuthScreen, including automatic token rotation.
apiClient.interceptors.request.use(
  async (config: SessionRequestConfig) => {
    const session = await getCurrentSession();
    const userId = session?.user.id ?? null;
    requireSameAccount(config, userId);
    config._authUserId = userId;
    config.headers.delete('Authorization');
    if (session?.access_token) config.headers.set('Authorization', `Bearer ${session.access_token}`);
    return config;
  },
  (error) => Promise.reject(error),
);

// Never deliver an old account's response, or replay its mutation as a new user.
apiClient.interceptors.response.use(
  async (response) => {
    const session = await getCurrentSession();
    requireSameAccount(response.config, session?.user.id ?? null);
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as SessionRequestConfig | undefined;

    if (error.response?.status === 401 && originalRequest?._authUserId && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const session = await getCurrentSession();
        requireSameAccount(originalRequest, session?.user.id ?? null);
        if (!session?.access_token) return Promise.reject(error);

        // A late 401 may refer to a token the SDK has already replaced.
        if (originalRequest.headers.get('Authorization') === `Bearer ${session.access_token}`) {
          await refreshCurrentSession(originalRequest._authUserId);
        }
        return apiClient(originalRequest);
      } catch {
        // SDK auth events own sign-out/navigation. A transient error must not
        // erase a valid session or create a second token store.
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// AUTH ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  username: string;
}

export const authApi = {
  register: async (data: { email: string; username: string; password: string }) => {
    const response = await apiClient.post<{ user: AuthUser; access_token: string; refresh_token: string }>(
      '/auth/register',
      data,
    );
    return response.data;
  },

  login: async (data: { email: string; password: string }) => {
    const response = await apiClient.post<{ user: AuthUser; access_token: string; refresh_token: string }>(
      '/auth/login',
      data,
    );
    return response.data;
  },

  logout: async () => {
    await apiClient.post('/auth/logout');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },

  getMe: async () => {
    const response = await apiClient.get<{ user: AuthUser }>('/auth/me');
    return response.data.user;
  },

  refresh: async (refreshToken: string) => {
    const response = await apiClient.post<{ access_token: string }>('/auth/refresh', {
      refresh_token: refreshToken,
    });
    return response.data;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// BLOCKS ENDPOINTS  (matches backend/python/api/blocks.py)
// ─────────────────────────────────────────────────────────────────────────────

export const blocksApi = {
  /** GET /api/blocks/search?q=<address> */
  search: async (query: string) => {
    const response = await apiClient.get<BlockSearchResponse>(
      '/blocks/search',
      { params: { q: query } },
    );
    return response.data.results;
  },

  /** POST /api/blocks/preview */
  preview: async (data: { address: string; lat: number; lng: number }) => {
    const response = await apiClient.post<{ block_hash: string; snapshot: unknown; preview: unknown }>(
      '/blocks/preview',
      data,
    );
    return response.data;
  },

  /** POST /api/blocks/claim */
  claim: async (data: {
    address: string;
    coordinates?: { lat: number; lng: number };
    lat?: number;
    lng?: number;
    city?: string;
    gangName?: string;
  }) => {
    const response = await apiClient.post<{
      success: boolean;
      block: Record<string, unknown>;
      player: { user_id: string; cash: number; heat: number; level: number; xp: number };
      claimCost: number;
    }>('/blocks/claim', data);
    return response.data;
  },

  /** GET /api/blocks/my-blocks */
  getOwned: async () => {
    const response = await apiClient.get<{ blocks: Record<string, unknown>[]; count: number }>(
      '/blocks/my-blocks',
    );
    return response.data;
  },

  /** GET /api/blocks/availability/<block_hash> */
  checkAvailability: async (blockHash: string) => {
    const response = await apiClient.get<{ available: boolean; isAvailable?: boolean; owner?: string }>(
      `/blocks/availability/${blockHash}`,
    );
    return response.data;
  },

  /** GET /api/blocks/<block_id> */
  getById: async (blockId: string) => {
    const response = await apiClient.get<Record<string, unknown>>(`/blocks/${blockId}`);
    return response.data;
  },

  /** POST /api/blocks/:id/members/place */
  placeMembers: async (blockId: string, placements: Record<string, unknown>[]) => {
    const response = await apiClient.post<{
      success: boolean;
      placements: Record<string, unknown>[];
      liveRevision: number;
      incomePerTick: number;
    }>(`/blocks/${blockId}/members/place`, { placements });
    return response.data;
  },

  /** POST /api/blocks/:id/tick-income */
  tickIncome: async (blockId: string) => {
    const response = await apiClient.post<{ success: boolean; block: Record<string, unknown> }>(
      `/blocks/${blockId}/tick-income`,
    );
    return response.data;
  },

  /** POST /api/blocks/:id/collect */
  collect: async (blockId: string) => {
    const response = await apiClient.post<{
      success: boolean;
      collected: number;
      player: { cash: number; heat: number };
      block: Record<string, unknown>;
    }>(`/blocks/${blockId}/collect`);
    return response.data;
  },

  /** GET /api/blocks/nearby?lat=&lng=&radius= */
  getNearby: async (lat: number, lng: number, radius: number = 1000) => {
    const response = await apiClient.get<{ blocks: Block[] }>('/blocks/nearby', {
      params: { lat, lng, radius },
    });
    return response.data.blocks;
  },

  /** GET /api/blocks/city/<city> */
  getCityBlocks: async (city: string) => {
    const response = await apiClient.get<{ blocks: Block[] }>(`/blocks/city/${city}`);
    return response.data.blocks;
  },

  /** GET /api/blocks/cities */
  getSupportedCities: async () => {
    const response = await apiClient.get<{ cities: string[] }>('/blocks/cities');
    return response.data.cities;
  },

  /** POST /api/blocks/:id/generate_backgrounds */
  generateBackgrounds: async (blockId: string) => {
    const response = await apiClient.post<GenerateBackgroundsResponse>(
      `/blocks/${blockId}/generate_backgrounds`,
    );
    return response.data;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// COMBAT ENDPOINTS  (matches backend/python/api/combat.py)
// ─────────────────────────────────────────────────────────────────────────────

export interface CombatSessionResponse {
  session_id: string;
  attacker_id: string;
  defender_id: string;
  block_id: string;
  snapshot: unknown;
  status: string;
  turn: number;
}

export interface CombatTurnResult {
  success: boolean;
  hit: boolean;
  damage: number;
  target_hp: number;
  killed: boolean;
  counterfire?: unknown;
  turn: number;
  status: string;
}

export const combatApi = {
  /** POST /api/combat/start */
  start: async (data: { block_id: string; attacker_members: string[] }) => {
    const response = await apiClient.post<CombatSessionResponse>(
      '/combat/start',
      data,
    );
    return response.data;
  },

  /** POST /api/combat/turn */
  submitTurn: async (data: {
    session_id: string;
    attacker_unit_id: string;
    target_row: number;
    target_col: number;
    action: 'shoot' | 'move' | 'reload' | 'take_cover';
  }) => {
    const response = await apiClient.post<CombatTurnResult>(
      '/combat/turn',
      data,
    );
    return response.data;
  },

  /** GET /api/combat/<session_id> */
  getSession: async (sessionId: string) => {
    const response = await apiClient.get<CombatSessionResponse>(
      `/combat/${sessionId}`,
    );
    return response.data;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// DRIVE-BY ENDPOINTS  (matches backend/python/api/driveby.py)
// ─────────────────────────────────────────────────────────────────────────────

export interface DriveBySessionResponse {
  session_id: string;
  block_id: string;
  street_tiles: Array<{ row: number; col: number }>;
  member_exposure: Record<string, number>;
  snapshot: unknown;
}

export interface DriveByShootResult {
  success: boolean;
  shots: Array<{
    target_row: number;
    target_col: number;
    hit: boolean;
    damage: number;
    target_member?: string;
    killed?: boolean;
  }>;
  counterfire: unknown;
}

export const drivebyApi = {
  /** POST /api/driveby/start */
  start: async (data: { block_id: string; shooter_members: string[] }) => {
    const response = await apiClient.post<DriveBySessionResponse>(
      '/driveby/start',
      data,
    );
    return response.data;
  },

  /** POST /api/driveby/shoot */
  shoot: async (data: {
    session_id: string;
    shots: Array<{ row: number; col: number }>;
  }) => {
    const response = await apiClient.post<DriveByShootResult>(
      '/driveby/shoot',
      data,
    );
    return response.data;
  },

  /** POST /api/driveby/<session_id>/complete */
  complete: async (sessionId: string) => {
    const response = await apiClient.post<{
      success: boolean;
      summary: unknown;
    }>(`/driveby/${sessionId}/complete`);
    return response.data;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// INVENTORY / MARKET ENDPOINTS  (matches backend/python/api/inventory.py)
// ─────────────────────────────────────────────────────────────────────────────

export const inventoryApi = {
  /** GET /api/inventory/ */
  getInventory: async () => {
    const response = await apiClient.get<{ inventory: InventoryItem[] }>(
      '/inventory/',
    );
    return response.data.inventory;
  },

  /** GET /api/inventory/market */
  getMarket: async () => {
    const response = await apiClient.get<{ listings: MarketListing[] }>(
      '/inventory/market',
    );
    return response.data.listings;
  },

  /** POST /api/inventory/buy */
  buy: async (data: { item_id: string; quantity: number }) => {
    const response = await apiClient.post<{
      success: boolean;
      item: InventoryItem;
      remaining_cash: number;
    }>('/inventory/buy', data);
    return response.data;
  },

  /** POST /api/inventory/equip */
  equip: async (data: { member_id: string; item_id: string }) => {
    const response = await apiClient.post<{ success: boolean }>(
      '/inventory/equip',
      data,
    );
    return response.data;
  },

  /** GET /api/inventory/transactions?limit= */
  getTransactions: async (limit: number = 50) => {
    const response = await apiClient.get<{ transactions: Transaction[] }>(
      '/inventory/transactions',
      { params: { limit } },
    );
    return response.data.transactions;
  },

  /** GET /api/inventory/cash */
  getCashBalance: async () => {
    const response = await apiClient.get<{
      cash: number;
      bank: number;
      total: number;
    }>('/inventory/cash');
    return response.data;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// GANG ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

export const gangApi = {
  create: async (data: { name: string; tag: string; colorPrimary: string; colorSecondary: string }) => {
    const response = await apiClient.post<{ gang: unknown }>('/gang/create', data);
    return response.data.gang;
  },

  get: async (gangId: string) => {
    const response = await apiClient.get<{ gang: unknown }>(`/gang/${gangId}`);
    return response.data.gang;
  },

  getMembers: async (gangId: string) => {
    const response = await apiClient.get<{ members: GangMember[] }>(
      `/gang/${gangId}/members`,
    );
    return response.data.members;
  },

  recruit: async () => {
    const response = await apiClient.post<{ member: GangMember; cost: number }>(
      '/gang/recruit',
    );
    return response.data;
  },

  assignMember: async (memberId: string, assignment: { blockId?: string; task?: string }) => {
    const response = await apiClient.post<{ success: boolean }>(
      `/gang/member/${memberId}/assign`,
      assignment,
    );
    return response.data;
  },

  updateMember: async (memberId: string, updates: Partial<GangMember>) => {
    const response = await apiClient.put<{ member: GangMember }>(
      `/gang/member/${memberId}`,
      updates,
    );
    return response.data.member;
  },

  dismissMember: async (memberId: string) => {
    const response = await apiClient.delete<{ success: boolean }>(
      `/gang/member/${memberId}`,
    );
    return response.data;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ALCHEMY ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

export const alchemyApi = {
  getRecipes: async () => {
    const response = await apiClient.get<{ recipes: unknown[] }>('/alchemy/recipes');
    return response.data.recipes;
  },

  getIngredients: async () => {
    const response = await apiClient.get<{ ingredients: unknown[] }>(
      '/alchemy/ingredients',
    );
    return response.data.ingredients;
  },

  combine: async (ingredientIds: string[]) => {
    const response = await apiClient.post<{
      success: boolean;
      result?: unknown;
      newRecipe?: boolean;
    }>('/alchemy/combine', { ingredientIds });
    return response.data;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// WORLD ENDPOINTS  (matches backend/python/api/world.py)
// ─────────────────────────────────────────────────────────────────────────────

export interface WorldStatus {
  blocks: number;
  members: number;
  active_members: number;
  heat: number;
  cash: number;
  bank: number;
  income_per_tick: number;
  last_tick: string;
}

export interface WorldTickResult {
  success: boolean;
  events: Array<{
    type: string;
    description: string;
    data: unknown;
  }>;
  income: number;
  heat_change: number;
}

export const worldApi = {
  /** POST /api/world/tick */
  tick: async () => {
    const response = await apiClient.post<WorldTickResult>('/world/tick');
    return response.data;
  },

  /** GET /api/world/status */
  getStatus: async () => {
    const response = await apiClient.get<WorldStatus>('/world/status');
    return response.data;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PLAYER STATE (Gate 0B)
// ─────────────────────────────────────────────────────────────────────────────

export const playerApi = {
  /** GET /api/player/state */
  getState: async () => {
    const response = await apiClient.get<{
      player: { user_id: string; cash: number; heat: number; level: number; xp: number; username: string };
    }>('/player/state');
    return response.data.player;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT ALL
// ─────────────────────────────────────────────────────────────────────────────

export const api = {
  auth: authApi,
  blocks: blocksApi,
  combat: combatApi,
  driveby: drivebyApi,
  inventory: inventoryApi,
  gang: gangApi,
  alchemy: alchemyApi,
  world: worldApi,
  player: playerApi,
};

export default api;
