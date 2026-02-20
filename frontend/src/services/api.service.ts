// ═══════════════════════════════════════════════════════════════════════════
// DEALT/SLIDE - API Service
// Centralized HTTP client for all API calls
// Matches Flask backend routes from PR #3 (blocks, combat, driveby, inventory, world)
// ═══════════════════════════════════════════════════════════════════════════

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import type {
  Block,
  GangMember,
  Transaction,
  InventoryItem,
  MarketListing,
} from '../types/game.types';

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

// Request interceptor — attach auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor — handle 401 with token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await axios.post(`${API_URL}/api/auth/refresh`, {
            refresh_token: refreshToken,
          });

          const { access_token } = response.data;
          localStorage.setItem('access_token', access_token);

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${access_token}`;
          }
          return apiClient(originalRequest);
        }
      } catch {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/auth';
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
    const response = await apiClient.get<{ results: Array<{ address: string; lat: number; lng: number }> }>(
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
  claim: async (data: { block_hash: string; gang_name: string }) => {
    const response = await apiClient.post<{ success: boolean; block: Block }>(
      '/blocks/claim',
      data,
    );
    return response.data;
  },

  /** GET /api/blocks/availability/<block_hash> */
  checkAvailability: async (blockHash: string) => {
    const response = await apiClient.get<{ available: boolean; owner?: string }>(
      `/blocks/availability/${blockHash}`,
    );
    return response.data;
  },

  /** GET /api/blocks/<block_id> */
  getById: async (blockId: string) => {
    const response = await apiClient.get<{ block: Block }>(`/blocks/${blockId}`);
    return response.data.block;
  },

  /** GET /api/blocks/my-blocks */
  getOwned: async () => {
    const response = await apiClient.get<{ blocks: Block[] }>('/blocks/my-blocks');
    return response.data.blocks;
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
};

export default api;
