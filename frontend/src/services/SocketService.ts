// SocketService.ts - Real-time multiplayer service
// Integrated from DeepSeek-V3.1:671B

import { io, Socket } from 'socket.io-client';

// ============ TYPES ============
export interface CombatEvent {
  combatId: string;
  attackerId: string;
  defenderId?: string;
  blockId: string;
  combatType: 'drive-by' | 'slide' | 'dealt' | 'raid';
  damage?: number;
  outcome?: string;
}

export interface BlockEvent {
  blockId: string;
  userId: string;
  eventType: 'claimed' | 'attacked' | 'defended' | 'raided';
  coordinates?: { lat: number; lng: number };
}

export interface HeatEvent {
  blockId: string;
  heatLevel: number;
  change: number;
  reason: string;
}

export interface PlayerPosition {
  userId: string;
  lat: number;
  lng: number;
  timestamp: number;
}

export interface NotificationEvent {
  id: string;
  type: 'attack' | 'income' | 'raid' | 'message' | 'achievement';
  title: string;
  message: string;
  data?: any;
}

type EventCallback<T> = (data: T) => void;

// ============ SOCKET SERVICE ============
export class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private messageQueue: Array<{ event: string; data: any }> = [];
  
  // Event listeners
  private listeners: Map<string, Set<Function>> = new Map();

  constructor(private serverUrl: string = 'wss://api.dealt-slide.com') {}

  // ============ CONNECTION ============
  connect(authToken: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = io(this.serverUrl, {
        auth: { token: authToken },
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: this.maxReconnectAttempts,
      });

      this.socket.on('connect', () => {
        console.log('Socket connected:', this.socket?.id);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.flushMessageQueue();
        resolve();
      });

      this.socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        this.isConnected = false;
      });

      this.socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        this.reconnectAttempts++;
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          reject(new Error('Max reconnection attempts reached'));
        }
      });

      // Set up default event handlers
      this.setupEventHandlers();
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // ============ EVENT HANDLERS ============
  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Combat events
    this.socket.on('combat:initiated', (data: CombatEvent) => {
      this.emit('combat:initiated', data);
    });

    this.socket.on('combat:update', (data: CombatEvent) => {
      this.emit('combat:update', data);
    });

    this.socket.on('combat:ended', (data: CombatEvent) => {
      this.emit('combat:ended', data);
    });

    // Block events
    this.socket.on('block:claimed', (data: BlockEvent) => {
      this.emit('block:claimed', data);
    });

    this.socket.on('block:attacked', (data: BlockEvent) => {
      this.emit('block:attacked', data);
    });

    // Heat events
    this.socket.on('heat:update', (data: HeatEvent) => {
      this.emit('heat:update', data);
    });

    this.socket.on('heat:raid', (data: HeatEvent) => {
      this.emit('heat:raid', data);
    });

    // Notifications
    this.socket.on('notification', (data: NotificationEvent) => {
      this.emit('notification', data);
    });

    // Player movement
    this.socket.on('player:nearby', (data: PlayerPosition[]) => {
      this.emit('player:nearby', data);
    });
  }

  // ============ EMIT METHODS ============
  private emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  // ============ SUBSCRIBE METHODS ============
  on<T>(event: string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  off(event: string, callback?: Function): void {
    if (callback) {
      this.listeners.get(event)?.delete(callback);
    } else {
      this.listeners.delete(event);
    }
  }

  // ============ SEND METHODS ============
  private send(event: string, data: any): void {
    if (this.isConnected && this.socket) {
      this.socket.emit(event, data);
    } else {
      // Queue message for when connection is restored
      this.messageQueue.push({ event, data });
    }
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const { event, data } = this.messageQueue.shift()!;
      this.send(event, data);
    }
  }

  // ============ GAME ACTIONS ============
  
  // Territory Actions
  claimBlock(blockId: string, coordinates: { lat: number; lng: number }): void {
    this.send('block:claim', { blockId, coordinates });
  }

  attackBlock(blockId: string, combatType: CombatEvent['combatType']): void {
    this.send('territory:attack', { blockId, combatType });
  }

  defendBlock(blockId: string, combatId: string): void {
    this.send('territory:defend', { blockId, combatId });
  }

  // Combat Actions
  initiateCombat(defenderId: string, blockId: string, combatType: CombatEvent['combatType']): void {
    this.send('combat:initiate', { defenderId, blockId, combatType });
  }

  sendCombatAction(combatId: string, action: any): void {
    this.send('combat:action', { combatId, action });
  }

  surrenderCombat(combatId: string): void {
    this.send('combat:surrender', { combatId });
  }

  // Drive-By Actions
  startDriveBy(blockId: string): void {
    this.send('driveby:start', { blockId });
  }

  reportDriveByKill(blockId: string, targetType: 'gang' | 'civilian' | 'leader', bounty: number): void {
    this.send('driveby:kill', { blockId, targetType, bounty });
  }

  endDriveBy(blockId: string, stats: any): void {
    this.send('driveby:end', { blockId, stats });
  }

  // SLIDE (Battleship) Actions
  startSlide(blockId: string, defenderId: string): void {
    this.send('slide:start', { blockId, defenderId });
  }

  placeUnits(combatId: string, placements: any[]): void {
    this.send('slide:place', { combatId, placements });
  }

  fireAt(combatId: string, x: number, y: number): void {
    this.send('slide:fire', { combatId, x, y });
  }

  // DEALT (Drug Dealing) Actions
  requestClient(blockId: string): void {
    this.send('dealt:request', { blockId });
  }

  respondToClient(clientId: string, action: 'accept' | 'reject'): void {
    this.send('dealt:respond', { clientId, action });
  }

  // Player Movement
  updatePosition(lat: number, lng: number): void {
    this.send('player:move', { lat, lng });
  }

  // ============ UTILITY METHODS ============
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  getSocketId(): string | null {
    return this.socket?.id || null;
  }
}

// ============ SINGLETON EXPORT ============
export const socketService = new SocketService();

// ============ REACT HOOK ============
import { useEffect, useState, useCallback } from 'react';

export function useSocket() {
  const [isConnected, setIsConnected] = useState(socketService.getConnectionStatus());

  useEffect(() => {
    const unsubConnect = socketService.on('connect', () => setIsConnected(true));
    const unsubDisconnect = socketService.on('disconnect', () => setIsConnected(false));

    return () => {
      unsubConnect();
      unsubDisconnect();
    };
  }, []);

  return {
    isConnected,
    connect: (token: string) => socketService.connect(token),
    disconnect: () => socketService.disconnect(),
    on: socketService.on.bind(socketService),
    off: socketService.off.bind(socketService),
  };
}

export function useCombatEvents() {
  const [currentCombat, setCurrentCombat] = useState<CombatEvent | null>(null);

  useEffect(() => {
    const unsubInitiated = socketService.on<CombatEvent>('combat:initiated', setCurrentCombat);
    const unsubUpdate = socketService.on<CombatEvent>('combat:update', setCurrentCombat);
    const unsubEnded = socketService.on<CombatEvent>('combat:ended', () => setCurrentCombat(null));

    return () => {
      unsubInitiated();
      unsubUpdate();
      unsubEnded();
    };
  }, []);

  return {
    currentCombat,
    initiateCombat: socketService.initiateCombat.bind(socketService),
    sendAction: socketService.sendCombatAction.bind(socketService),
    surrender: socketService.surrenderCombat.bind(socketService),
  };
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);

  useEffect(() => {
    const unsub = socketService.on<NotificationEvent>('notification', (notification) => {
      setNotifications(prev => [notification, ...prev].slice(0, 50));
    });

    return unsub;
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return {
    notifications,
    unreadCount: notifications.length,
    markAsRead,
    clearAll,
  };
}

export function useHeatSystem() {
  const [blockHeat, setBlockHeat] = useState<Map<string, number>>(new Map());
  const [raidAlert, setRaidAlert] = useState<HeatEvent | null>(null);

  useEffect(() => {
    const unsubUpdate = socketService.on<HeatEvent>('heat:update', (event) => {
      setBlockHeat(prev => new Map(prev).set(event.blockId, event.heatLevel));
    });

    const unsubRaid = socketService.on<HeatEvent>('heat:raid', (event) => {
      setRaidAlert(event);
      // Clear raid alert after 10 seconds
      setTimeout(() => setRaidAlert(null), 10000);
    });

    return () => {
      unsubUpdate();
      unsubRaid();
    };
  }, []);

  return {
    blockHeat,
    raidAlert,
    getHeat: (blockId: string) => blockHeat.get(blockId) || 0,
  };
}
