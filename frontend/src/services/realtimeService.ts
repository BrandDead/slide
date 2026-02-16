// ============================================
// DEALT/SLIDE Real-time Multiplayer Service
// Source: gpt-oss:120b-cloud
// ============================================

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
