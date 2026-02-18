// ═══════════════════════════════════════════════════════════════════════════
// DEALT/SLIDE - Socket.IO Service
// Real-time WebSocket connection for multiplayer features
// ═══════════════════════════════════════════════════════════════════════════

import { io, Socket } from 'socket.io-client';
import { useGameStore } from '../stores/gameStore';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface SocketEvents {
  // Combat events
  'combat:join': (data: { sessionId: string }) => void;
  'combat:leave': (data: { sessionId: string }) => void;
  'combat:action': (data: CombatAction) => void;
  'combat:update': (data: CombatUpdate) => void;
  'combat:result': (data: CombatResult) => void;
  
  // Block events
  'block:claimed': (data: BlockClaimedEvent) => void;
  'block:attacked': (data: BlockAttackedEvent) => void;
  'block:update': (data: BlockUpdateEvent) => void;
  
  // Notification events
  'notify:income': (data: IncomeNotification) => void;
  'notify:combat': (data: CombatNotification) => void;
  'notify:heat': (data: HeatNotification) => void;
  'notify:member': (data: MemberNotification) => void;
}

interface CombatAction {
  sessionId: string;
  actionType: 'shoot' | 'move' | 'reload' | 'take_cover';
  actorId: string;
  targetId?: string;
  position?: { x: number; y: number };
}

interface CombatUpdate {
  sessionId: string;
  state: unknown;
  lastAction: unknown;
}

interface CombatResult {
  sessionId: string;
  winner: 'attacker' | 'defender' | 'draw';
  stats: unknown;
}

interface BlockClaimedEvent {
  blockId: string;
  ownerId: string;
  gangId: string;
  gangName: string;
}

interface BlockAttackedEvent {
  blockId: string;
  attackerId: string;
  attackerGang: string;
}

interface BlockUpdateEvent {
  blockId: string;
  changes: Record<string, unknown>;
}

interface IncomeNotification {
  amount: number;
  blockId: string;
  blockName: string;
}

interface CombatNotification {
  type: 'initiated' | 'won' | 'lost';
  blockId: string;
  opponentName: string;
}

interface HeatNotification {
  blockId: string;
  heatLevel: number;
  warning: string;
}

interface MemberNotification {
  memberId: string;
  memberName: string;
  event: 'joined' | 'left' | 'promoted' | 'injured' | 'arrested' | 'killed';
}

// ─────────────────────────────────────────────────────────────────────────────
// SOCKET SERVICE CLASS
// ─────────────────────────────────────────────────────────────────────────────

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private listeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();
  
  // ─────────────────────────────────────────────────────────────────────────
  // CONNECTION MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────
  
  connect(): void {
    if (this.socket?.connected) {
      console.log('[Socket] Already connected');
      return;
    }
    
    const serverUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const token = localStorage.getItem('access_token');
    
    this.socket = io(serverUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    
    this.setupCoreListeners();
    this.reattachListeners();
  }
  
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
  
  private setupCoreListeners(): void {
    if (!this.socket) return;
    
    this.socket.on('connect', () => {
      console.log('[Socket] Connected:', this.socket?.id);
      this.reconnectAttempts = 0;
    });
    
    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });
    
    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('[Socket] Max reconnection attempts reached');
        useGameStore.getState().addNotification({
          type: 'error',
          title: 'Connection Lost',
          message: 'Unable to connect to server. Please refresh the page.',
        });
      }
    });
    
    // Handle real-time game events
    this.socket.on('combat:update', (data: CombatUpdate) => {
      // Update combat state in store
      console.log('[Socket] Combat update:', data);
    });
    
    this.socket.on('block:claimed', (data: BlockClaimedEvent) => {
      useGameStore.getState().addNotification({
        type: 'info',
        title: 'Territory Update',
        message: `${data.gangName} claimed a block`,
      });
    });
    
    this.socket.on('block:attacked', (data: BlockAttackedEvent) => {
      useGameStore.getState().addNotification({
        type: 'combat',
        title: 'Under Attack!',
        message: `Your block is being attacked by ${data.attackerGang}`,
      });
    });
    
    this.socket.on('notify:income', (data: IncomeNotification) => {
      useGameStore.getState().addNotification({
        type: 'money',
        title: 'Income Received',
        message: `+$${data.amount.toLocaleString()} from ${data.blockName}`,
      });
    });
    
    this.socket.on('notify:heat', (data: HeatNotification) => {
      if (data.heatLevel >= 4) {
        useGameStore.getState().addNotification({
          type: 'warning',
          title: 'Heat Warning',
          message: data.warning,
        });
      }
    });
  }
  
  private reattachListeners(): void {
    if (!this.socket) return;
    
    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach((callback) => {
        this.socket!.on(event, callback);
      });
    });
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // EVENT SUBSCRIPTION
  // ─────────────────────────────────────────────────────────────────────────
  
  on<K extends keyof SocketEvents>(
    event: K,
    callback: SocketEvents[K]
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event)!.add(callback as (...args: unknown[]) => void);
    
    if (this.socket) {
      this.socket.on(event, callback as (...args: unknown[]) => void);
    }
    
    // Return unsubscribe function
    return () => {
      this.off(event, callback);
    };
  }
  
  off<K extends keyof SocketEvents>(
    event: K,
    callback: SocketEvents[K]
  ): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback as (...args: unknown[]) => void);
    }
    
    if (this.socket) {
      this.socket.off(event, callback as (...args: unknown[]) => void);
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // EMIT METHODS
  // ─────────────────────────────────────────────────────────────────────────
  
  emit<K extends keyof SocketEvents>(
    event: K,
    data: Parameters<SocketEvents[K]>[0]
  ): void {
    if (!this.socket?.connected) {
      console.warn('[Socket] Cannot emit, not connected');
      return;
    }
    
    this.socket.emit(event, data);
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // COMBAT SPECIFIC METHODS
  // ─────────────────────────────────────────────────────────────────────────
  
  joinCombat(sessionId: string): void {
    this.emit('combat:join', { sessionId });
  }
  
  leaveCombat(sessionId: string): void {
    this.emit('combat:leave', { sessionId });
  }
  
  sendCombatAction(action: CombatAction): void {
    this.emit('combat:action', action);
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // UTILITY METHODS
  // ─────────────────────────────────────────────────────────────────────────
  
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
  
  getSocketId(): string | undefined {
    return this.socket?.id;
  }
}

// Singleton instance
export const socketService = new SocketService();

export default socketService;
