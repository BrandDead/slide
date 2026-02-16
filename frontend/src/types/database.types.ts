// ============================================================
// database.types.ts - Auto-generated Supabase types
// ============================================================
// TODO: Regenerate this file using the Supabase CLI after running
// the schema in backend/supabase/supabase_schema.sql
//
// Command: npx supabase gen types typescript --project-id <your-project-id> > src/types/database.types.ts
//
// For now, this provides a minimal stub so TypeScript compilation
// succeeds before Supabase is configured.
// ============================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          level: number;
          xp: number;
          money: number;
          reputation: number;
          heat: number;
          crew_size: number;
          blocks_owned: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
          level?: number;
          xp?: number;
          money?: number;
          reputation?: number;
          heat?: number;
          crew_size?: number;
          blocks_owned?: number;
        };
        Update: {
          username?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          level?: number;
          xp?: number;
          money?: number;
          reputation?: number;
          heat?: number;
          crew_size?: number;
          blocks_owned?: number;
        };
      };
      blocks: {
        Row: {
          id: string;
          address: string;
          lat: number;
          lng: number;
          owner_id: string | null;
          heat: number;
          traffic_level: number;
          income_per_hour: number;
          max_units: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          address: string;
          lat: number;
          lng: number;
          owner_id?: string | null;
          heat?: number;
          traffic_level?: number;
          income_per_hour?: number;
          max_units?: number;
        };
        Update: {
          address?: string;
          lat?: number;
          lng?: number;
          owner_id?: string | null;
          heat?: number;
          traffic_level?: number;
          income_per_hour?: number;
          max_units?: number;
        };
      };
      gang_members: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          role: 'dealer' | 'shooter' | 'enforcer' | 'driver' | 'chemist';
          level: number;
          loyalty: number;
          morale: number;
          status: 'active' | 'injured' | 'jailed' | 'dead' | 'awol';
          stats: Json;
          equipment: Json;
          salary: number;
          arrests: number;
          kills: number;
          deals_completed: number;
          assigned_block_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          role: 'dealer' | 'shooter' | 'enforcer' | 'driver' | 'chemist';
          level?: number;
          loyalty?: number;
          morale?: number;
          status?: 'active' | 'injured' | 'jailed' | 'dead' | 'awol';
          stats?: Json;
          equipment?: Json;
          salary?: number;
          arrests?: number;
          kills?: number;
          deals_completed?: number;
          assigned_block_id?: string | null;
        };
        Update: {
          name?: string;
          role?: 'dealer' | 'shooter' | 'enforcer' | 'driver' | 'chemist';
          level?: number;
          loyalty?: number;
          morale?: number;
          status?: 'active' | 'injured' | 'jailed' | 'dead' | 'awol';
          stats?: Json;
          equipment?: Json;
          salary?: number;
          arrests?: number;
          kills?: number;
          deals_completed?: number;
          assigned_block_id?: string | null;
        };
      };
      inventory: {
        Row: {
          id: string;
          owner_id: string;
          item_type: 'drug' | 'weapon' | 'armor' | 'accessory';
          item_data: Json;
          quantity: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          item_type: 'drug' | 'weapon' | 'armor' | 'accessory';
          item_data: Json;
          quantity?: number;
        };
        Update: {
          item_type?: 'drug' | 'weapon' | 'armor' | 'accessory';
          item_data?: Json;
          quantity?: number;
        };
      };
      combat_logs: {
        Row: {
          id: string;
          attacker_id: string;
          defender_id: string;
          block_id: string;
          combat_type: 'slide' | 'driveby' | 'raid';
          result: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          attacker_id: string;
          defender_id: string;
          block_id: string;
          combat_type: 'slide' | 'driveby' | 'raid';
          result: Json;
        };
        Update: {
          result?: Json;
        };
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          type: 'deal' | 'purchase' | 'salary' | 'bail' | 'bribe' | 'loot' | 'casino_win' | 'casino_loss';
          amount: number;
          description: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: 'deal' | 'purchase' | 'salary' | 'bail' | 'bribe' | 'loot' | 'casino_win' | 'casino_loss';
          amount: number;
          description: string;
        };
        Update: {
          type?: 'deal' | 'purchase' | 'salary' | 'bail' | 'bribe' | 'loot' | 'casino_win' | 'casino_loss';
          amount?: number;
          description?: string;
        };
      };
      alchemy_recipes: {
        Row: {
          id: string;
          name: string;
          ingredients: Json;
          result_drug: string;
          result_tier: number;
          success_rate: number;
          discovered_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          ingredients: Json;
          result_drug: string;
          result_tier?: number;
          success_rate?: number;
          discovered_by?: string | null;
        };
        Update: {
          name?: string;
          ingredients?: Json;
          result_drug?: string;
          result_tier?: number;
          success_rate?: number;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      member_role: 'dealer' | 'shooter' | 'enforcer' | 'driver' | 'chemist';
      member_status: 'active' | 'injured' | 'jailed' | 'dead' | 'awol';
      item_type: 'drug' | 'weapon' | 'armor' | 'accessory';
      combat_type: 'slide' | 'driveby' | 'raid';
      transaction_type: 'deal' | 'purchase' | 'salary' | 'bail' | 'bribe' | 'loot' | 'casino_win' | 'casino_loss';
    };
  };
}
