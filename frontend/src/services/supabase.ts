// ============================================================
// DEALT/SLIDE - Supabase Client Integration
// Drop this into: src/services/supabase.ts
// ============================================================

import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { Database } from '../types/database.types'; // Generated types

// ============================================================
// CONFIGURATION
// ============================================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables. Check your .env file.');
}

// ============================================================
// CLIENT INITIALIZATION
// ============================================================

export const supabase: SupabaseClient<Database> = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

// ============================================================
// AUTH SERVICE
// ============================================================

export const authService = {
  // Sign up with email/password
  async signUp(email: string, password: string, username: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          display_name: username,
        },
      },
    });
    if (error) throw error;
    return data;
  },

  // Sign in with email/password
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  // Sign in with OAuth (Google, Apple, Discord, etc.)
  async signInWithProvider(provider: 'google' | 'apple' | 'discord') {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
    return data;
  },

  // Sign out
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  // Get current session
  async getSession(): Promise<Session | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  },

  // Get current user
  async getUser(): Promise<User | null> {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  // Listen to auth state changes
  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    return supabase.auth.onAuthStateChange(callback);
  },

  // Password reset
  async resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    if (error) throw error;
  },
};

// ============================================================
// PROFILE SERVICE
// ============================================================

export const profileService = {
  // Get current user's profile
  async getMyProfile() {
    const user = await authService.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) throw error;
    return data;
  },

  // Update profile
  async updateProfile(updates: Partial<Database['public']['Tables']['profiles']['Update']>) {
    const user = await authService.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Get profile by ID (for viewing other players)
  async getProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, gang_name, gang_tag, city_region, reputation, level, blocks_owned')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  },

  // Get leaderboard
  async getLeaderboard(region: string, limit = 100) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, gang_name, reputation, level, blocks_owned, total_deals, raids_won')
      .eq('city_region', region)
      .order('reputation', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  },
};

// ============================================================
// BLOCKS (TERRITORY) SERVICE
// ============================================================

export const blockService = {
  // Get blocks in a region
  async getBlocksByRegion(region: string) {
    const { data, error } = await supabase
      .from('blocks')
      .select(`
        *,
        owner:profiles(id, username, gang_name, gang_tag)
      `)
      .eq('region', region);

    if (error) throw error;
    return data;
  },

  // Get blocks owned by current user
  async getMyBlocks() {
    const user = await authService.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('blocks')
      .select('*')
      .eq('owner_id', user.id);

    if (error) throw error;
    return data;
  },

  // Claim a block
  async claimBlock(blockId: string) {
    const user = await authService.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('blocks')
      .update({
        owner_id: user.id,
        claimed_at: new Date().toISOString(),
        status: 'claimed',
      })
      .eq('id', blockId)
      .eq('status', 'unclaimed') // Can only claim unclaimed blocks
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Create a new block (for geocoded addresses)
  async createBlock(blockData: {
    address: string;
    city: string;
    state: string;
    region: string;
    lat?: number;
    lng?: number;
  }) {
    const { data, error } = await supabase
      .from('blocks')
      .insert({
        address: blockData.address,
        city: blockData.city,
        state: blockData.state,
        region: blockData.region as any,
        location: blockData.lat && blockData.lng 
          ? `POINT(${blockData.lng} ${blockData.lat})`
          : null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Subscribe to block changes in a region (real-time)
  subscribeToRegion(region: string, callback: (payload: any) => void) {
    return supabase
      .channel(`blocks:${region}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'blocks',
          filter: `region=eq.${region}`,
        },
        callback
      )
      .subscribe();
  },
};

// ============================================================
// GANG MEMBERS SERVICE
// ============================================================

export const gangService = {
  // Get all members for current user
  async getMyMembers() {
    const user = await authService.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('gang_members')
      .select('*')
      .eq('owner_id', user.id)
      .order('recruited_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  // Recruit a new member
  async recruitMember(name: string, role: string = 'soldier') {
    const user = await authService.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('gang_members')
      .insert({
        owner_id: user.id,
        name,
        role: role as any,
        loyalty: 50 + Math.floor(Math.random() * 30), // 50-80
        morale: 60 + Math.floor(Math.random() * 30),  // 60-90
        accuracy: 40 + Math.floor(Math.random() * 30), // 40-70
        toughness: 40 + Math.floor(Math.random() * 30),
        speed: 40 + Math.floor(Math.random() * 30),
      })
      .select()
      .single();

    if (error) throw error;

    // Update member count
    await supabase.rpc('increment_member_count', { user_id: user.id });

    return data;
  },

  // Assign member to block
  async assignToBlock(memberId: string, blockId: string) {
    const { data, error } = await supabase
      .from('gang_members')
      .update({ assigned_block_id: blockId })
      .eq('id', memberId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update member stats
  async updateMember(memberId: string, updates: Partial<Database['public']['Tables']['gang_members']['Update']>) {
    const { data, error } = await supabase
      .from('gang_members')
      .update(updates)
      .eq('id', memberId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

// ============================================================
// INVENTORY SERVICE
// ============================================================

export const inventoryService = {
  // Get player's inventory
  async getMyInventory() {
    const user = await authService.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('inventory')
      .select(`
        *,
        drug:drugs(*)
      `)
      .eq('owner_id', user.id);

    if (error) throw error;
    return data;
  },

  // Add to inventory (after deal, craft, etc.)
  async addToInventory(drugId: string, quantity: number, quality: number = 50, acquiredVia: string = 'buy') {
    const user = await authService.getUser();
    if (!user) throw new Error('Not authenticated');

    // Try to update existing stack first
    const { data: existing } = await supabase
      .from('inventory')
      .select('id, quantity')
      .eq('owner_id', user.id)
      .eq('drug_id', drugId)
      .eq('quality', quality)
      .single();

    if (existing) {
      const { data, error } = await supabase
        .from('inventory')
        .update({ quantity: existing.quantity + quantity })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    // Create new stack
    const { data, error } = await supabase
      .from('inventory')
      .insert({
        owner_id: user.id,
        drug_id: drugId,
        quantity,
        quality,
        acquired_via: acquiredVia,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Remove from inventory
  async removeFromInventory(drugId: string, quantity: number, quality: number = 50) {
    const user = await authService.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: existing } = await supabase
      .from('inventory')
      .select('id, quantity')
      .eq('owner_id', user.id)
      .eq('drug_id', drugId)
      .eq('quality', quality)
      .single();

    if (!existing || existing.quantity < quantity) {
      throw new Error('Insufficient inventory');
    }

    if (existing.quantity === quantity) {
      // Delete the stack
      await supabase.from('inventory').delete().eq('id', existing.id);
      return null;
    }

    // Reduce quantity
    const { data, error } = await supabase
      .from('inventory')
      .update({ quantity: existing.quantity - quantity })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

// ============================================================
// TRANSACTIONS SERVICE
// ============================================================

export const transactionService = {
  // Record a deal transaction
  async recordDeal(params: {
    amount: number;
    drugId: string;
    blockId?: string;
    clientType: string;
    quantity: number;
    pricePerUnit: number;
    wasRiskyDeal?: boolean;
  }) {
    const user = await authService.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get current balance
    const profile = await profileService.getMyProfile();
    const newBalance = profile.cash + params.amount;

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        player_id: user.id,
        type: 'deal',
        amount: params.amount,
        drug_id: params.drugId,
        block_id: params.blockId,
        client_type: params.clientType as any,
        quantity: params.quantity,
        price_per_unit: params.pricePerUnit,
        was_risky_deal: params.wasRiskyDeal || false,
        balance_after: newBalance,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Get recent transactions
  async getRecentTransactions(limit = 50) {
    const user = await authService.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('player_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  },

  // Get transaction stats
  async getStats() {
    const user = await authService.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('transactions')
      .select('type, amount')
      .eq('player_id', user.id);

    if (error) throw error;

    // Calculate totals
    const stats = {
      totalDeals: 0,
      totalEarned: 0,
      totalLost: 0,
    };

    data?.forEach((tx) => {
      if (tx.type === 'deal') {
        stats.totalDeals++;
        stats.totalEarned += tx.amount;
      } else if (tx.amount < 0) {
        stats.totalLost += Math.abs(tx.amount);
      }
    });

    return stats;
  },
};

// ============================================================
// COMBAT SERVICE
// ============================================================

export const combatService = {
  // Initiate an attack on a block
  async initiateAttack(targetBlockId: string, attackingMemberIds: string[]) {
    const user = await authService.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get target block info
    const { data: block } = await supabase
      .from('blocks')
      .select('owner_id')
      .eq('id', targetBlockId)
      .single();

    if (!block) throw new Error('Block not found');

    const { data, error } = await supabase
      .from('combat_logs')
      .insert({
        attacker_id: user.id,
        defender_id: block.owner_id,
        block_id: targetBlockId,
        combat_type: 'raid',
        attacker_units_start: attackingMemberIds.length,
      })
      .select()
      .single();

    if (error) throw error;

    // Mark block as contested
    await supabase
      .from('blocks')
      .update({
        is_contested: true,
        attacker_id: user.id,
        combat_started_at: new Date().toISOString(),
      })
      .eq('id', targetBlockId);

    return data;
  },

  // Submit combat turn
  async submitTurn(combatId: string, turnData: any) {
    const { data: combat } = await supabase
      .from('combat_logs')
      .select('turns')
      .eq('id', combatId)
      .single();

    if (!combat) throw new Error('Combat not found');

    const updatedTurns = [...(combat.turns as any[] || []), turnData];

    const { data, error } = await supabase
      .from('combat_logs')
      .update({ turns: updatedTurns })
      .eq('id', combatId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // End combat
  async endCombat(combatId: string, outcome: string, results: any) {
    const { data, error } = await supabase
      .from('combat_logs')
      .update({
        outcome: outcome as any,
        ended_at: new Date().toISOString(),
        attacker_units_lost: results.attackerLosses,
        defender_units_lost: results.defenderLosses,
        cash_stolen: results.cashStolen || 0,
        xp_gained: results.xpGained || 0,
      })
      .eq('id', combatId)
      .select()
      .single();

    if (error) throw error;

    // Update block ownership if attacker won
    if (outcome === 'attacker_win' && results.blockId) {
      await supabase
        .from('blocks')
        .update({
          owner_id: results.attackerId,
          is_contested: false,
          attacker_id: null,
          combat_started_at: null,
        })
        .eq('id', results.blockId);
    }

    return data;
  },

  // Subscribe to combat updates
  subscribeToCombat(combatId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`combat:${combatId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'combat_logs',
          filter: `id=eq.${combatId}`,
        },
        callback
      )
      .subscribe();
  },
};

// ============================================================
// NOTIFICATIONS SERVICE
// ============================================================

export const notificationService = {
  // Get unread notifications
  async getUnread() {
    const user = await authService.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('player_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  // Mark as read
  async markAsRead(notificationId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) throw error;
  },

  // Mark all as read
  async markAllAsRead() {
    const user = await authService.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('player_id', user.id)
      .eq('is_read', false);

    if (error) throw error;
  },

  // Subscribe to notifications
  subscribeToNotifications(callback: (payload: any) => void) {
    return supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return null;

      return supabase
        .channel(`notifications:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `player_id=eq.${user.id}`,
          },
          callback
        )
        .subscribe();
    });
  },
};

// ============================================================
// PRESENCE SERVICE (Online/Offline)
// ============================================================

export const presenceService = {
  // Set online status
  async goOnline(gameMode?: string) {
    const user = await authService.getUser();
    if (!user) return;

    await supabase.from('presence').upsert({
      player_id: user.id,
      is_online: true,
      current_game_mode: gameMode,
      last_heartbeat: new Date().toISOString(),
      session_started: new Date().toISOString(),
    });
  },

  // Set offline status
  async goOffline() {
    const user = await authService.getUser();
    if (!user) return;

    await supabase
      .from('presence')
      .update({ is_online: false })
      .eq('player_id', user.id);
  },

  // Update current game mode
  async updateGameMode(gameMode: string) {
    const user = await authService.getUser();
    if (!user) return;

    await supabase
      .from('presence')
      .update({
        current_game_mode: gameMode,
        last_heartbeat: new Date().toISOString(),
      })
      .eq('player_id', user.id);
  },

  // Heartbeat (call every 30 seconds)
  async heartbeat() {
    const user = await authService.getUser();
    if (!user) return;

    await supabase
      .from('presence')
      .update({ last_heartbeat: new Date().toISOString() })
      .eq('player_id', user.id);
  },

  // Get online players in region
  async getOnlinePlayers(region: string) {
    const { data, error } = await supabase
      .from('presence')
      .select(`
        *,
        player:profiles(id, username, gang_name, gang_tag)
      `)
      .eq('is_online', true)
      .gte('last_heartbeat', new Date(Date.now() - 60000).toISOString()); // Last 60 seconds

    if (error) throw error;
    return data;
  },
};

// ============================================================
// DRUGS SERVICE
// ============================================================

export const drugService = {
  // Get all drugs
  async getAllDrugs() {
    const { data, error } = await supabase
      .from('drugs')
      .select('*')
      .order('base_price', { ascending: true });

    if (error) throw error;
    return data;
  },

  // Get drugs available in region
  async getDrugsByRegion(region: string) {
    const { data, error } = await supabase
      .from('drugs')
      .select('*')
      .contains('available_regions', [region]);

    if (error) throw error;
    return data;
  },
};

// ============================================================
// MISSIONS SERVICE
// ============================================================

export const missionService = {
  // Get available missions
  async getAvailableMissions() {
    const profile = await profileService.getMyProfile();

    const { data, error } = await supabase
      .from('missions')
      .select('*')
      .lte('required_level', profile.level)
      .lte('required_reputation', profile.reputation);

    if (error) throw error;
    return data;
  },

  // Get player's active missions
  async getMyMissions() {
    const user = await authService.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('player_missions')
      .select(`
        *,
        mission:missions(*)
      `)
      .eq('player_id', user.id)
      .eq('is_completed', false);

    if (error) throw error;
    return data;
  },

  // Start a mission
  async startMission(missionId: string) {
    const user = await authService.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: mission } = await supabase
      .from('missions')
      .select('objectives, time_limit_minutes')
      .eq('id', missionId)
      .single();

    if (!mission) throw new Error('Mission not found');

    const { data, error } = await supabase
      .from('player_missions')
      .insert({
        player_id: user.id,
        mission_id: missionId,
        objectives_progress: mission.objectives,
        expires_at: mission.time_limit_minutes
          ? new Date(Date.now() + mission.time_limit_minutes * 60000).toISOString()
          : null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update mission progress
  async updateProgress(playerMissionId: string, objectiveIndex: number, newValue: number) {
    const { data: current } = await supabase
      .from('player_missions')
      .select('objectives_progress')
      .eq('id', playerMissionId)
      .single();

    if (!current) throw new Error('Mission progress not found');

    const updatedProgress = [...(current.objectives_progress as any[])];
    updatedProgress[objectiveIndex].current = newValue;

    // Check if all objectives complete
    const isCompleted = updatedProgress.every((obj) => obj.current >= obj.target);

    const { data, error } = await supabase
      .from('player_missions')
      .update({
        objectives_progress: updatedProgress,
        is_completed: isCompleted,
        completed_at: isCompleted ? new Date().toISOString() : null,
      })
      .eq('id', playerMissionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

// ============================================================
// EXPORT DEFAULT CLIENT
// ============================================================

export default supabase;
