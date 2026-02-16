// ============================================
// DEALT/SLIDE Presence Hook
// Source: gpt-oss:120b-cloud
// ============================================

import { useEffect, useState } from 'react';
import RealtimeService, { PlayerPresence, PlayerActivity } from '../services/realtimeService';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const realtimeService = new RealtimeService(supabaseUrl, supabaseKey);

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
