// ═══════════════════════════════════════════════════════════════════════════
// DEALT/SLIDE - API Service
// Centralized HTTP client for all API calls
// ═══════════════════════════════════════════════════════════════════════════

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { 
  User, 
  Gang, 
  GangMember, 
  Block, 
  CombatSession,
  Drug,
  DealerClient,
  DealResult 
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

// Request interceptor - add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
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
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/auth';
      }
    }
    
    return Promise.reject(error);
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// AUTH ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

export const authApi = {
  register: async (data: { email: string; username: string; password: string }) => {
    const response = await apiClient.post<{ user: User; access_token: string; refresh_token: string }>(
      '/auth/register',
      data
    );
    return response.data;
  },
  
  login: async (data: { email: string; password: string }) => {
    const response = await apiClient.post<{ user: User; access_token: string; refresh_token: string }>(
      '/auth/login',
      data
    );
    return response.data;
  },
  
  logout: async () => {
    await apiClient.post('/auth/logout');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },
  
  getMe: async () => {
    const response = await apiClient.get<{ user: User }>('/auth/me');
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
// BLOCKS ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

export const blocksApi = {
  generate: async (address: string) => {
    const response = await apiClient.post<{ success: boolean; block: Block }>(
      '/blocks/generate',
      { address }
    );
    return response.data.block;
  },
  
  generateFromCoords: async (lat: number, lng: number) => {
    const response = await apiClient.post<{ success: boolean; block: Block }>(
      '/blocks/generate/coordinates',
      { lat, lng }
    );
    return response.data.block;
  },
  
  claim: async (blockId: string) => {
    const response = await apiClient.post<{ success: boolean; block: Block }>(
      '/blocks/claim',
      { blockId }
    );
    return response.data.block;
  },
  
  getOwned: async () => {
    const response = await apiClient.get<{ blocks: Block[] }>('/blocks/owned');
    return response.data.blocks;
  },
  
  getById: async (blockId: string) => {
    const response = await apiClient.get<{ block: Block }>(`/blocks/${blockId}`);
    return response.data.block;
  },
  
  getNearby: async (lat: number, lng: number, radius: number = 1000) => {
    const response = await apiClient.get<{ blocks: Block[] }>('/blocks/nearby', {
      params: { lat, lng, radius },
    });
    return response.data.blocks;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// COMBAT ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

export const combatApi = {
  initiate: async (data: { targetBlockId: string; attackType: 'slide' | 'driveby' }) => {
    const response = await apiClient.post<{ session: CombatSession }>(
      '/combat/initiate',
      data
    );
    return response.data.session;
  },
  
  getSession: async (sessionId: string) => {
    const response = await apiClient.get<{ session: CombatSession }>(
      `/combat/${sessionId}`
    );
    return response.data.session;
  },
  
  submitAction: async (sessionId: string, action: {
    type: 'shoot' | 'move' | 'reload' | 'take_cover';
    targetId?: string;
    position?: { x: number; y: number };
  }) => {
    const response = await apiClient.post<{ success: boolean; result: unknown }>(
      `/combat/${sessionId}/action`,
      action
    );
    return response.data;
  },
  
  getHistory: async (limit: number = 20) => {
    const response = await apiClient.get<{ sessions: CombatSession[] }>(
      '/combat/history',
      { params: { limit } }
    );
    return response.data.sessions;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// DEALER ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

export const dealerApi = {
  getNextClient: async () => {
    const response = await apiClient.get<{ client: DealerClient }>('/dealer/client');
    return response.data.client;
  },
  
  swipe: async (clientId: string, accepted: boolean) => {
    const response = await apiClient.post<{ result: DealResult }>(
      '/dealer/swipe',
      { clientId, accepted }
    );
    return response.data.result;
  },
  
  getInventory: async () => {
    const response = await apiClient.get<{ inventory: Record<string, number> }>(
      '/dealer/inventory'
    );
    return response.data.inventory;
  },
  
  getStats: async () => {
    const response = await apiClient.get<{
      totalDeals: number;
      totalRevenue: number;
      successRate: number;
      currentStreak: number;
    }>('/dealer/stats');
    return response.data;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// GANG ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

export const gangApi = {
  create: async (data: { name: string; tag: string; colorPrimary: string; colorSecondary: string }) => {
    const response = await apiClient.post<{ gang: Gang }>('/gang/create', data);
    return response.data.gang;
  },
  
  get: async (gangId: string) => {
    const response = await apiClient.get<{ gang: Gang }>(`/gang/${gangId}`);
    return response.data.gang;
  },
  
  getMembers: async (gangId: string) => {
    const response = await apiClient.get<{ members: GangMember[] }>(
      `/gang/${gangId}/members`
    );
    return response.data.members;
  },
  
  recruit: async () => {
    const response = await apiClient.post<{ member: GangMember; cost: number }>(
      '/gang/recruit'
    );
    return response.data;
  },
  
  assignMember: async (memberId: string, assignment: { blockId?: string; task?: string }) => {
    const response = await apiClient.post<{ success: boolean }>(
      `/gang/member/${memberId}/assign`,
      assignment
    );
    return response.data;
  },
  
  updateMember: async (memberId: string, updates: Partial<GangMember>) => {
    const response = await apiClient.put<{ member: GangMember }>(
      `/gang/member/${memberId}`,
      updates
    );
    return response.data.member;
  },
  
  dismissMember: async (memberId: string) => {
    const response = await apiClient.delete<{ success: boolean }>(
      `/gang/member/${memberId}`
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
    const response = await apiClient.get<{ ingredients: Drug[] }>(
      '/alchemy/ingredients'
    );
    return response.data.ingredients;
  },
  
  combine: async (ingredientIds: string[]) => {
    const response = await apiClient.post<{
      success: boolean;
      result?: Drug;
      newRecipe?: boolean;
    }>('/alchemy/combine', { ingredientIds });
    return response.data;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ECONOMY ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

export const economyApi = {
  getMarketPrices: async () => {
    const response = await apiClient.get<{ prices: Record<string, number> }>(
      '/economy/prices'
    );
    return response.data.prices;
  },
  
  getTransactions: async (limit: number = 50) => {
    const response = await apiClient.get<{ transactions: unknown[] }>(
      '/economy/transactions',
      { params: { limit } }
    );
    return response.data.transactions;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT ALL
// ─────────────────────────────────────────────────────────────────────────────

export const api = {
  auth: authApi,
  blocks: blocksApi,
  combat: combatApi,
  dealer: dealerApi,
  gang: gangApi,
  alchemy: alchemyApi,
  economy: economyApi,
};

export default api;
