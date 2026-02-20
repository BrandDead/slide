/**
 * DEALT/SLIDE - Sync Service
 * Manages offline-first state synchronization between Zustand stores and the backend.
 * Queues mutations when offline, flushes when back online.
 */

import { apiClient } from './apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SyncAction {
  id: string;
  type: 'save_game' | 'update_member' | 'update_block' | 'add_transaction' | 'craft_drug';
  payload: any;
  timestamp: number;
  retries: number;
}

type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

type SyncListener = (status: SyncStatus, pendingCount: number) => void;

// ─── Storage Keys ────────────────────────────────────────────────────────────

const SYNC_QUEUE_KEY = 'dealt-slide-sync-queue';
const LAST_SYNC_KEY = 'dealt-slide-last-sync';

// ─── Sync Service ────────────────────────────────────────────────────────────

class SyncService {
  private queue: SyncAction[] = [];
  private status: SyncStatus = 'idle';
  private listeners: SyncListener[] = [];
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private isSyncing = false;

  constructor() {
    this.loadQueue();
    this.startAutoSync();
    this.setupOnlineListener();
  }

  // ─── Public API ────────────────────────────────────────────────────────

  /**
   * Queue a mutation for sync to the backend.
   */
  enqueue(type: SyncAction['type'], payload: any): void {
    const action: SyncAction = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      payload,
      timestamp: Date.now(),
      retries: 0,
    };

    this.queue.push(action);
    this.saveQueue();
    this.notifyListeners();

    // Try to sync immediately if online
    if (navigator.onLine) {
      this.flush();
    }
  }

  /**
   * Save the full game state to the backend.
   */
  async saveGameState(state: any): Promise<boolean> {
    const result = await apiClient.post('/api/game/save', state);
    if (result.ok) {
      localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
      return true;
    }
    return false;
  }

  /**
   * Load game state from the backend.
   */
  async loadGameState(): Promise<any | null> {
    const result = await apiClient.get('/api/game/load');
    if (result.ok) {
      return result.data;
    }
    return null;
  }

  /**
   * Flush all queued actions to the backend.
   */
  async flush(): Promise<void> {
    if (this.isSyncing || this.queue.length === 0 || !navigator.onLine) return;

    this.isSyncing = true;
    this.setStatus('syncing');

    const pending = [...this.queue];
    const completed: string[] = [];
    const failed: SyncAction[] = [];

    for (const action of pending) {
      try {
        const result = await this.executeAction(action);
        if (result) {
          completed.push(action.id);
        } else {
          action.retries++;
          if (action.retries < 3) {
            failed.push(action);
          }
          // Drop after 3 retries
        }
      } catch {
        action.retries++;
        if (action.retries < 3) {
          failed.push(action);
        }
      }
    }

    this.queue = this.queue.filter(
      (a) => !completed.includes(a.id) && failed.some((f) => f.id === a.id)
    );
    this.queue.push(...failed.filter((f) => !this.queue.some((q) => q.id === f.id)));
    this.saveQueue();

    this.isSyncing = false;
    this.setStatus(this.queue.length > 0 ? 'error' : 'idle');
    this.notifyListeners();
  }

  /**
   * Subscribe to sync status changes.
   */
  subscribe(listener: SyncListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Get current sync status.
   */
  getStatus(): { status: SyncStatus; pendingCount: number; lastSync: string | null } {
    return {
      status: this.status,
      pendingCount: this.queue.length,
      lastSync: localStorage.getItem(LAST_SYNC_KEY),
    };
  }

  /**
   * Force a full state sync.
   */
  async forceSync(state: any): Promise<boolean> {
    const saved = await this.saveGameState(state);
    if (saved) {
      await this.flush();
    }
    return saved;
  }

  // ─── Private Methods ───────────────────────────────────────────────────

  private async executeAction(action: SyncAction): Promise<boolean> {
    const endpointMap: Record<SyncAction['type'], string> = {
      save_game: '/api/game/save',
      update_member: '/api/gang/members/update',
      update_block: '/api/blocks/update',
      add_transaction: '/api/economy/transaction',
      craft_drug: '/api/alchemy/craft',
    };

    const endpoint = endpointMap[action.type];
    if (!endpoint) return false;

    const result = await apiClient.post(endpoint, action.payload);
    return result.ok;
  }

  private loadQueue(): void {
    try {
      const stored = localStorage.getItem(SYNC_QUEUE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch {
      this.queue = [];
    }
  }

  private saveQueue(): void {
    try {
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(this.queue));
    } catch {
      // Storage full — drop oldest actions
      this.queue = this.queue.slice(-50);
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(this.queue));
    }
  }

  private setStatus(status: SyncStatus): void {
    this.status = status;
    this.notifyListeners();
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.status, this.queue.length);
    }
  }

  private startAutoSync(): void {
    // Auto-sync every 5 minutes
    this.syncInterval = setInterval(() => {
      if (navigator.onLine && this.queue.length > 0) {
        this.flush();
      }
    }, 5 * 60 * 1000);
  }

  private setupOnlineListener(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.setStatus('idle');
        if (this.queue.length > 0) {
          this.flush();
        }
      });

      window.addEventListener('offline', () => {
        this.setStatus('offline');
      });
    }
  }

  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }
}

// ─── Singleton Export ────────────────────────────────────────────────────────

export const syncService = new SyncService();
