export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      block_placements: {
        Row: {
          block_id: string
          created_at: string
          exposure_risk: number
          grid_x: number
          grid_y: number
          health: number
          id: string
          income_per_tick: number
          level: number
          member_id: string
          member_name: string
          portrait_url: string | null
          role: string
          topdown_url: string | null
          updated_at: string
          zone_type: string
        }
        Insert: {
          block_id: string
          created_at?: string
          exposure_risk?: number
          grid_x: number
          grid_y: number
          health?: number
          id?: string
          income_per_tick?: number
          level?: number
          member_id: string
          member_name: string
          portrait_url?: string | null
          role: string
          topdown_url?: string | null
          updated_at?: string
          zone_type?: string
        }
        Update: {
          block_id?: string
          created_at?: string
          exposure_risk?: number
          grid_x?: number
          grid_y?: number
          health?: number
          id?: string
          income_per_tick?: number
          level?: number
          member_id?: string
          member_name?: string
          portrait_url?: string | null
          role?: string
          topdown_url?: string | null
          updated_at?: string
          zone_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "block_placements_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "block_placements_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks_with_members"
            referencedColumns: ["id"]
          },
        ]
      }
      block_snapshots: {
        Row: {
          block_id: string
          created_at: string | null
          defense_rating: number | null
          heat_level: number | null
          id: string
          income_rate: number | null
          member_count: number | null
          snapshot_data: Json
          version: number
        }
        Insert: {
          block_id: string
          created_at?: string | null
          defense_rating?: number | null
          heat_level?: number | null
          id: string
          income_rate?: number | null
          member_count?: number | null
          snapshot_data: Json
          version: number
        }
        Update: {
          block_id?: string
          created_at?: string | null
          defense_rating?: number | null
          heat_level?: number | null
          id?: string
          income_rate?: number | null
          member_count?: number | null
          snapshot_data?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "block_snapshots_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "block_snapshots_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks_with_members"
            referencedColumns: ["id"]
          },
        ]
      }
      blocks: {
        Row: {
          address: string
          block_heat: number | null
          block_type: string | null
          center_point: unknown
          city: string
          claimed_at: string | null
          coordinates: unknown
          created_at: string | null
          current_heat: number | null
          danger_level: number | null
          defense_units: number | null
          fortification_level: number | null
          gang_id: string | null
          geohash: string | null
          grid_data: Json | null
          id: string
          income_per_hour: number | null
          is_public: boolean
          last_income_collected: string | null
          last_raid_at: string | null
          max_heat: number | null
          metadata: Json | null
          owner_id: string | null
          raid_count: number | null
          traffic_level: number | null
          updated_at: string | null
        }
        Insert: {
          address: string
          block_heat?: number | null
          block_type?: string | null
          center_point?: unknown
          city: string
          claimed_at?: string | null
          coordinates?: unknown
          created_at?: string | null
          current_heat?: number | null
          danger_level?: number | null
          defense_units?: number | null
          fortification_level?: number | null
          gang_id?: string | null
          geohash?: string | null
          grid_data?: Json | null
          id?: string
          income_per_hour?: number | null
          is_public?: boolean
          last_income_collected?: string | null
          last_raid_at?: string | null
          max_heat?: number | null
          metadata?: Json | null
          owner_id?: string | null
          raid_count?: number | null
          traffic_level?: number | null
          updated_at?: string | null
        }
        Update: {
          address?: string
          block_heat?: number | null
          block_type?: string | null
          center_point?: unknown
          city?: string
          claimed_at?: string | null
          coordinates?: unknown
          created_at?: string | null
          current_heat?: number | null
          danger_level?: number | null
          defense_units?: number | null
          fortification_level?: number | null
          gang_id?: string | null
          geohash?: string | null
          grid_data?: Json | null
          id?: string
          income_per_hour?: number | null
          is_public?: boolean
          last_income_collected?: string | null
          last_raid_at?: string | null
          max_heat?: number | null
          metadata?: Json | null
          owner_id?: string | null
          raid_count?: number | null
          traffic_level?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blocks_gang_id_fkey"
            columns: ["gang_id"]
            isOneToOne: false
            referencedRelation: "gangs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "user_assets"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "blocks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      combat_logs: {
        Row: {
          attacker_damage_dealt: number | null
          attacker_health_after: number | null
          attacker_id: string
          block_id: string | null
          cash_lost: number | null
          cash_won: number | null
          combat_type: string
          created_at: string | null
          defender_damage_dealt: number | null
          defender_health_after: number | null
          defender_id: string | null
          duration_seconds: number | null
          heat_generated: number | null
          id: string
          outcome: string | null
          reputation_change: number | null
          weapons_used: Json | null
        }
        Insert: {
          attacker_damage_dealt?: number | null
          attacker_health_after?: number | null
          attacker_id: string
          block_id?: string | null
          cash_lost?: number | null
          cash_won?: number | null
          combat_type: string
          created_at?: string | null
          defender_damage_dealt?: number | null
          defender_health_after?: number | null
          defender_id?: string | null
          duration_seconds?: number | null
          heat_generated?: number | null
          id?: string
          outcome?: string | null
          reputation_change?: number | null
          weapons_used?: Json | null
        }
        Update: {
          attacker_damage_dealt?: number | null
          attacker_health_after?: number | null
          attacker_id?: string
          block_id?: string | null
          cash_lost?: number | null
          cash_won?: number | null
          combat_type?: string
          created_at?: string | null
          defender_damage_dealt?: number | null
          defender_health_after?: number | null
          defender_id?: string | null
          duration_seconds?: number | null
          heat_generated?: number | null
          id?: string
          outcome?: string | null
          reputation_change?: number | null
          weapons_used?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "combat_logs_attacker_id_fkey"
            columns: ["attacker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combat_logs_attacker_id_fkey"
            columns: ["attacker_id"]
            isOneToOne: false
            referencedRelation: "user_assets"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "combat_logs_attacker_id_fkey"
            columns: ["attacker_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combat_logs_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combat_logs_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks_with_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combat_logs_defender_id_fkey"
            columns: ["defender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combat_logs_defender_id_fkey"
            columns: ["defender_id"]
            isOneToOne: false
            referencedRelation: "user_assets"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "combat_logs_defender_id_fkey"
            columns: ["defender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      combat_sessions: {
        Row: {
          attacker_gang_id: string | null
          attacker_hp: Json | null
          attacker_snapshot_id: string | null
          attacker_user_id: string
          combat_log: Json | null
          completed_at: string | null
          created_at: string | null
          current_turn: number | null
          defender_hp: Json | null
          defender_user_id: string | null
          id: string
          max_turns: number | null
          seed: string
          status: string | null
          target_block_id: string
          target_snapshot_id: string
          winner: string | null
        }
        Insert: {
          attacker_gang_id?: string | null
          attacker_hp?: Json | null
          attacker_snapshot_id?: string | null
          attacker_user_id: string
          combat_log?: Json | null
          completed_at?: string | null
          created_at?: string | null
          current_turn?: number | null
          defender_hp?: Json | null
          defender_user_id?: string | null
          id: string
          max_turns?: number | null
          seed: string
          status?: string | null
          target_block_id: string
          target_snapshot_id: string
          winner?: string | null
        }
        Update: {
          attacker_gang_id?: string | null
          attacker_hp?: Json | null
          attacker_snapshot_id?: string | null
          attacker_user_id?: string
          combat_log?: Json | null
          completed_at?: string | null
          created_at?: string | null
          current_turn?: number | null
          defender_hp?: Json | null
          defender_user_id?: string | null
          id?: string
          max_turns?: number | null
          seed?: string
          status?: string | null
          target_block_id?: string
          target_snapshot_id?: string
          winner?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "combat_sessions_attacker_gang_id_fkey"
            columns: ["attacker_gang_id"]
            isOneToOne: false
            referencedRelation: "gangs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combat_sessions_attacker_user_id_fkey"
            columns: ["attacker_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combat_sessions_attacker_user_id_fkey"
            columns: ["attacker_user_id"]
            isOneToOne: false
            referencedRelation: "user_assets"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "combat_sessions_attacker_user_id_fkey"
            columns: ["attacker_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combat_sessions_defender_user_id_fkey"
            columns: ["defender_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combat_sessions_defender_user_id_fkey"
            columns: ["defender_user_id"]
            isOneToOne: false
            referencedRelation: "user_assets"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "combat_sessions_defender_user_id_fkey"
            columns: ["defender_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combat_sessions_target_block_id_fkey"
            columns: ["target_block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combat_sessions_target_block_id_fkey"
            columns: ["target_block_id"]
            isOneToOne: false
            referencedRelation: "blocks_with_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combat_sessions_target_snapshot_id_fkey"
            columns: ["target_snapshot_id"]
            isOneToOne: false
            referencedRelation: "block_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      combat_turn_logs: {
        Row: {
          actions: Json
          active_player: string
          combat_session_id: string
          created_at: string | null
          id: string
          turn_number: number
        }
        Insert: {
          actions: Json
          active_player: string
          combat_session_id: string
          created_at?: string | null
          id?: string
          turn_number: number
        }
        Update: {
          actions?: Json
          active_player?: string
          combat_session_id?: string
          created_at?: string | null
          id?: string
          turn_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "combat_turn_logs_combat_session_id_fkey"
            columns: ["combat_session_id"]
            isOneToOne: false
            referencedRelation: "combat_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      combat_units: {
        Row: {
          combat_session_id: string
          created_at: string | null
          damage_dealt: number | null
          damage_taken: number | null
          end_health: number
          id: string
          is_attacker: boolean
          kills: number | null
          member_id: string
          position_x: number
          position_y: number
          start_health: number
        }
        Insert: {
          combat_session_id: string
          created_at?: string | null
          damage_dealt?: number | null
          damage_taken?: number | null
          end_health: number
          id?: string
          is_attacker: boolean
          kills?: number | null
          member_id: string
          position_x: number
          position_y: number
          start_health: number
        }
        Update: {
          combat_session_id?: string
          created_at?: string | null
          damage_dealt?: number | null
          damage_taken?: number | null
          end_health?: number
          id?: string
          is_attacker?: boolean
          kills?: number | null
          member_id?: string
          position_x?: number
          position_y?: number
          start_health?: number
        }
        Relationships: [
          {
            foreignKeyName: "combat_units_combat_session_id_fkey"
            columns: ["combat_session_id"]
            isOneToOne: false
            referencedRelation: "combat_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combat_units_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "gang_members"
            referencedColumns: ["id"]
          },
        ]
      }
      driveby_sessions: {
        Row: {
          casualties: Json | null
          completed_at: string | null
          created_at: string | null
          current_phase: string | null
          gang_id: string | null
          heat_gained: number | null
          hits: Json | null
          id: string
          max_shots: number | null
          money_gained: number | null
          seed: string
          shooter_ids: Json | null
          shots_fired: number | null
          target_block_id: string
          target_snapshot_id: string
          user_id: string
          vehicle_armor: number | null
          vehicle_hp: number | null
          vehicle_speed: number | null
          vehicle_type: string | null
        }
        Insert: {
          casualties?: Json | null
          completed_at?: string | null
          created_at?: string | null
          current_phase?: string | null
          gang_id?: string | null
          heat_gained?: number | null
          hits?: Json | null
          id: string
          max_shots?: number | null
          money_gained?: number | null
          seed: string
          shooter_ids?: Json | null
          shots_fired?: number | null
          target_block_id: string
          target_snapshot_id: string
          user_id: string
          vehicle_armor?: number | null
          vehicle_hp?: number | null
          vehicle_speed?: number | null
          vehicle_type?: string | null
        }
        Update: {
          casualties?: Json | null
          completed_at?: string | null
          created_at?: string | null
          current_phase?: string | null
          gang_id?: string | null
          heat_gained?: number | null
          hits?: Json | null
          id?: string
          max_shots?: number | null
          money_gained?: number | null
          seed?: string
          shooter_ids?: Json | null
          shots_fired?: number | null
          target_block_id?: string
          target_snapshot_id?: string
          user_id?: string
          vehicle_armor?: number | null
          vehicle_hp?: number | null
          vehicle_speed?: number | null
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driveby_sessions_gang_id_fkey"
            columns: ["gang_id"]
            isOneToOne: false
            referencedRelation: "gangs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driveby_sessions_target_block_id_fkey"
            columns: ["target_block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driveby_sessions_target_block_id_fkey"
            columns: ["target_block_id"]
            isOneToOne: false
            referencedRelation: "blocks_with_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driveby_sessions_target_snapshot_id_fkey"
            columns: ["target_snapshot_id"]
            isOneToOne: false
            referencedRelation: "block_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driveby_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driveby_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_assets"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "driveby_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      drugs: {
        Row: {
          addiction_rate: number | null
          base_price: number | null
          created_at: string | null
          heat_multiplier: number | null
          id: string
          is_craftable: boolean | null
          name: string
          od_risk: number | null
          profit_multiplier: number | null
          rarity: string | null
          street_name: string | null
        }
        Insert: {
          addiction_rate?: number | null
          base_price?: number | null
          created_at?: string | null
          heat_multiplier?: number | null
          id?: string
          is_craftable?: boolean | null
          name: string
          od_risk?: number | null
          profit_multiplier?: number | null
          rarity?: string | null
          street_name?: string | null
        }
        Update: {
          addiction_rate?: number | null
          base_price?: number | null
          created_at?: string | null
          heat_multiplier?: number | null
          id?: string
          is_craftable?: boolean | null
          name?: string
          od_risk?: number | null
          profit_multiplier?: number | null
          rarity?: string | null
          street_name?: string | null
        }
        Relationships: []
      }
      economy_logs: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          reason: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "economy_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "economy_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_assets"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "economy_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      gang_members: {
        Row: {
          chemistry_skill: number | null
          created_at: string | null
          current_block_id: string | null
          damage: number | null
          dealing_skill: number | null
          defense: number | null
          experience: number | null
          gang_id: string | null
          health: number | null
          id: string
          level: number | null
          loyalty: number | null
          max_health: number | null
          name: string
          owner_id: string
          position: Json | null
          role: string
          shooting_skill: number | null
          speed: number | null
          status: string | null
          updated_at: string | null
          weekly_salary: number | null
        }
        Insert: {
          chemistry_skill?: number | null
          created_at?: string | null
          current_block_id?: string | null
          damage?: number | null
          dealing_skill?: number | null
          defense?: number | null
          experience?: number | null
          gang_id?: string | null
          health?: number | null
          id?: string
          level?: number | null
          loyalty?: number | null
          max_health?: number | null
          name: string
          owner_id: string
          position?: Json | null
          role: string
          shooting_skill?: number | null
          speed?: number | null
          status?: string | null
          updated_at?: string | null
          weekly_salary?: number | null
        }
        Update: {
          chemistry_skill?: number | null
          created_at?: string | null
          current_block_id?: string | null
          damage?: number | null
          dealing_skill?: number | null
          defense?: number | null
          experience?: number | null
          gang_id?: string | null
          health?: number | null
          id?: string
          level?: number | null
          loyalty?: number | null
          max_health?: number | null
          name?: string
          owner_id?: string
          position?: Json | null
          role?: string
          shooting_skill?: number | null
          speed?: number | null
          status?: string | null
          updated_at?: string | null
          weekly_salary?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gang_members_current_block_id_fkey"
            columns: ["current_block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gang_members_current_block_id_fkey"
            columns: ["current_block_id"]
            isOneToOne: false
            referencedRelation: "blocks_with_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gang_members_gang_id_fkey"
            columns: ["gang_id"]
            isOneToOne: false
            referencedRelation: "gangs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gang_members_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gang_members_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "user_assets"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "gang_members_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      gangs: {
        Row: {
          bankroll: number | null
          color_primary: string | null
          color_secondary: string | null
          created_at: string | null
          daily_income: number | null
          fear: number | null
          founded_at: string | null
          heat: number | null
          id: string
          leader_id: string | null
          member_count: number | null
          name: string
          region: string | null
          respect: number | null
          tag: string
          updated_at: string | null
        }
        Insert: {
          bankroll?: number | null
          color_primary?: string | null
          color_secondary?: string | null
          created_at?: string | null
          daily_income?: number | null
          fear?: number | null
          founded_at?: string | null
          heat?: number | null
          id?: string
          leader_id?: string | null
          member_count?: number | null
          name: string
          region?: string | null
          respect?: number | null
          tag: string
          updated_at?: string | null
        }
        Update: {
          bankroll?: number | null
          color_primary?: string | null
          color_secondary?: string | null
          created_at?: string | null
          daily_income?: number | null
          fear?: number | null
          founded_at?: string | null
          heat?: number | null
          id?: string
          leader_id?: string | null
          member_count?: number | null
          name?: string
          region?: string | null
          respect?: number | null
          tag?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gangs_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gangs_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "user_assets"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "gangs_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      item_catalog: {
        Row: {
          available: boolean | null
          base_price: number
          category: string
          created_at: string | null
          damage: number | null
          defense: number | null
          description: string | null
          healing: number | null
          id: string
          name: string
          rarity: string | null
        }
        Insert: {
          available?: boolean | null
          base_price: number
          category: string
          created_at?: string | null
          damage?: number | null
          defense?: number | null
          description?: string | null
          healing?: number | null
          id: string
          name: string
          rarity?: string | null
        }
        Update: {
          available?: boolean | null
          base_price?: number
          category?: string
          created_at?: string | null
          damage?: number | null
          defense?: number | null
          description?: string | null
          healing?: number | null
          id?: string
          name?: string
          rarity?: string | null
        }
        Relationships: []
      }
      loyalty_events: {
        Row: {
          created_at: string | null
          description: string | null
          event_type: string
          id: string
          loyalty_after: number | null
          loyalty_before: number | null
          loyalty_change: number
          member_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          event_type: string
          id?: string
          loyalty_after?: number | null
          loyalty_before?: number | null
          loyalty_change: number
          member_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          event_type?: string
          id?: string
          loyalty_after?: number | null
          loyalty_before?: number | null
          loyalty_change?: number
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "gang_members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_loadouts: {
        Row: {
          accessory1_id: string | null
          accessory2_id: string | null
          armor_id: string | null
          id: string
          items: Json | null
          member_id: string
          updated_at: string | null
          weapon_id: string | null
        }
        Insert: {
          accessory1_id?: string | null
          accessory2_id?: string | null
          armor_id?: string | null
          id?: string
          items?: Json | null
          member_id: string
          updated_at?: string | null
          weapon_id?: string | null
        }
        Update: {
          accessory1_id?: string | null
          accessory2_id?: string | null
          armor_id?: string | null
          id?: string
          items?: Json | null
          member_id?: string
          updated_at?: string | null
          weapon_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_loadouts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "gang_members"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          data: Json | null
          id: string
          is_read: boolean | null
          message: string
          player_id: string
          title: string
          type: string
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          message: string
          player_id: string
          title: string
          type?: string
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          message?: string
          player_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "user_assets"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notifications_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      npc_gangs: {
        Row: {
          active: boolean | null
          aggression: number | null
          controlled_blocks: Json | null
          created_at: string | null
          difficulty: number | null
          faction: string | null
          id: string
          name: string
          territory_count: number | null
          wealth: number | null
        }
        Insert: {
          active?: boolean | null
          aggression?: number | null
          controlled_blocks?: Json | null
          created_at?: string | null
          difficulty?: number | null
          faction?: string | null
          id?: string
          name: string
          territory_count?: number | null
          wealth?: number | null
        }
        Update: {
          active?: boolean | null
          aggression?: number | null
          controlled_blocks?: Json | null
          created_at?: string | null
          difficulty?: number | null
          faction?: string | null
          id?: string
          name?: string
          territory_count?: number | null
          wealth?: number | null
        }
        Relationships: []
      }
      player_drug_inventory: {
        Row: {
          created_at: string | null
          drug_name: string
          id: string
          owner_id: string
          purchase_price: number | null
          purity: number | null
          quantity: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          drug_name: string
          id?: string
          owner_id: string
          purchase_price?: number | null
          purity?: number | null
          quantity?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          drug_name?: string
          id?: string
          owner_id?: string
          purchase_price?: number | null
          purity?: number | null
          quantity?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_drug_inventory_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_drug_inventory_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "user_assets"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "player_drug_inventory_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_records: {
        Row: {
          id: string
          member_count: number
          paid_at: string | null
          total_paid: number
          user_id: string
          was_successful: boolean | null
        }
        Insert: {
          id?: string
          member_count: number
          paid_at?: string | null
          total_paid: number
          user_id: string
          was_successful?: boolean | null
        }
        Update: {
          id?: string
          member_count?: number
          paid_at?: string | null
          total_paid?: number
          user_id?: string
          was_successful?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "salary_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_assets"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "salary_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shoebox_ledger: {
        Row: {
          amount: number
          balance_after: number
          created_at: string | null
          description: string | null
          id: string
          related_block_id: string | null
          related_member_id: string | null
          transaction_type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string | null
          description?: string | null
          id?: string
          related_block_id?: string | null
          related_member_id?: string | null
          transaction_type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string | null
          description?: string | null
          id?: string
          related_block_id?: string | null
          related_member_id?: string | null
          transaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shoebox_ledger_related_block_id_fkey"
            columns: ["related_block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shoebox_ledger_related_block_id_fkey"
            columns: ["related_block_id"]
            isOneToOne: false
            referencedRelation: "blocks_with_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shoebox_ledger_related_member_id_fkey"
            columns: ["related_member_id"]
            isOneToOne: false
            referencedRelation: "gang_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shoebox_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shoebox_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_assets"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "shoebox_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      user_inventory: {
        Row: {
          created_at: string | null
          equipped_on_member_id: string | null
          id: string
          item_id: string
          quantity: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          equipped_on_member_id?: string | null
          id?: string
          item_id: string
          quantity?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          equipped_on_member_id?: string | null
          id?: string
          item_id?: string
          quantity?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_inventory_equipped_on_member_id_fkey"
            columns: ["equipped_on_member_id"]
            isOneToOne: false
            referencedRelation: "gang_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_inventory_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_inventory_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_assets"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_inventory_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_id: string | null
          cash: number | null
          created_at: string | null
          email: string
          experience: number | null
          faction: string | null
          gang_id: string | null
          gang_rank: string | null
          heat: number | null
          home_block_id: string | null
          id: string
          is_online: boolean | null
          last_active: string | null
          last_known_position: unknown
          level: number | null
          reputation: number | null
          updated_at: string | null
          username: string
        }
        Insert: {
          auth_id?: string | null
          cash?: number | null
          created_at?: string | null
          email: string
          experience?: number | null
          faction?: string | null
          gang_id?: string | null
          gang_rank?: string | null
          heat?: number | null
          home_block_id?: string | null
          id?: string
          is_online?: boolean | null
          last_active?: string | null
          last_known_position?: unknown
          level?: number | null
          reputation?: number | null
          updated_at?: string | null
          username: string
        }
        Update: {
          auth_id?: string | null
          cash?: number | null
          created_at?: string | null
          email?: string
          experience?: number | null
          faction?: string | null
          gang_id?: string | null
          gang_rank?: string | null
          heat?: number | null
          home_block_id?: string | null
          id?: string
          is_online?: boolean | null
          last_active?: string | null
          last_known_position?: unknown
          level?: number | null
          reputation?: number | null
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      world_tick_log: {
        Row: {
          blocks_processed: number | null
          created_at: string | null
          events: Json | null
          events_generated: number | null
          id: string
          tick_duration_minutes: number
          total_heat_decay: number | null
          total_income_generated: number | null
        }
        Insert: {
          blocks_processed?: number | null
          created_at?: string | null
          events?: Json | null
          events_generated?: number | null
          id?: string
          tick_duration_minutes: number
          total_heat_decay?: number | null
          total_income_generated?: number | null
        }
        Update: {
          blocks_processed?: number | null
          created_at?: string | null
          events?: Json | null
          events_generated?: number | null
          id?: string
          tick_duration_minutes?: number
          total_heat_decay?: number | null
          total_income_generated?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      blocks_with_members: {
        Row: {
          address: string | null
          block_type: string | null
          center_point: unknown
          city: string | null
          claimed_at: string | null
          coordinates: unknown
          created_at: string | null
          current_heat: number | null
          danger_level: number | null
          dealer_count: number | null
          defense_units: number | null
          enforcer_count: number | null
          fortification_level: number | null
          gang_id: string | null
          geohash: string | null
          grid_data: Json | null
          id: string | null
          income_per_hour: number | null
          last_income_collected: string | null
          last_raid_at: string | null
          max_heat: number | null
          member_count: number | null
          owner_id: string | null
          raid_count: number | null
          shooter_count: number | null
          traffic_level: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blocks_gang_id_fkey"
            columns: ["gang_id"]
            isOneToOne: false
            referencedRelation: "gangs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "user_assets"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "blocks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          auth_id: string | null
          avatar_url: string | null
          bank: number | null
          blocks_owned: number | null
          cash: number | null
          city_region: string | null
          created_at: string | null
          display_name: string | null
          email: string | null
          faction: string | null
          gang_color: string | null
          gang_id: string | null
          gang_name: string | null
          gang_rank: string | null
          gang_tag: string | null
          heat: number | null
          heat_level: number | null
          id: string | null
          is_online: boolean | null
          is_premium: boolean | null
          last_active: string | null
          last_active_at: string | null
          level: number | null
          members_count: number | null
          money: number | null
          premium_until: string | null
          raids_lost: number | null
          raids_won: number | null
          reputation: number | null
          settings: Json | null
          total_deals: number | null
          total_kills: number | null
          updated_at: string | null
          username: string | null
          xp: number | null
        }
        Insert: {
          auth_id?: string | null
          avatar_url?: never
          bank?: never
          blocks_owned?: never
          cash?: number | null
          city_region?: never
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          faction?: string | null
          gang_color?: never
          gang_id?: string | null
          gang_name?: never
          gang_rank?: string | null
          gang_tag?: never
          heat?: number | null
          heat_level?: never
          id?: string | null
          is_online?: boolean | null
          is_premium?: never
          last_active?: string | null
          last_active_at?: string | null
          level?: number | null
          members_count?: never
          money?: number | null
          premium_until?: never
          raids_lost?: never
          raids_won?: never
          reputation?: number | null
          settings?: never
          total_deals?: never
          total_kills?: never
          updated_at?: string | null
          username?: string | null
          xp?: number | null
        }
        Update: {
          auth_id?: string | null
          avatar_url?: never
          bank?: never
          blocks_owned?: never
          cash?: number | null
          city_region?: never
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          faction?: string | null
          gang_color?: never
          gang_id?: string | null
          gang_name?: never
          gang_rank?: string | null
          gang_tag?: never
          heat?: number | null
          heat_level?: never
          id?: string | null
          is_online?: boolean | null
          is_premium?: never
          last_active?: string | null
          last_active_at?: string | null
          level?: number | null
          members_count?: never
          money?: number | null
          premium_until?: never
          raids_lost?: never
          raids_won?: never
          reputation?: number | null
          settings?: never
          total_deals?: never
          total_kills?: never
          updated_at?: string | null
          username?: string | null
          xp?: number | null
        }
        Relationships: []
      }
      user_assets: {
        Row: {
          blocks_owned: number | null
          cash: number | null
          items_owned: number | null
          members_owned: number | null
          total_income_rate: number | null
          user_id: string | null
          username: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_current_user_id: { Args: never; Returns: string }
      get_economy_summary: {
        Args: { p_user_id: string }
        Returns: {
          last_salary_paid: string
          total_earned: number
          total_spent: number
          weekly_salary_total: number
        }[]
      }
      get_leaderboard: {
        Args: { limit_count?: number }
        Returns: {
          avg_morale: number
          gang_name: string
          max_heat: number
          owner_id: string
          rank: number
          total_blocks: number
          total_income: number
          username: string
        }[]
      }
      gettransactionid: { Args: never; Returns: unknown }
      longtransactionsenabled: { Args: never; Returns: boolean }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      unlockrows: { Args: { "": string }; Returns: number }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
    }
    Enums: {
      block_status: "unclaimed" | "claimed" | "contested" | "locked"
      city_region:
        | "nyc"
        | "la"
        | "miami"
        | "chicago"
        | "detroit"
        | "new_orleans"
        | "atlanta"
        | "houston"
        | "philadelphia"
        | "baltimore"
      client_type:
        | "regular"
        | "addict"
        | "fiend"
        | "rich_kid"
        | "college_student"
        | "cop"
        | "undercover"
        | "snitch"
        | "gang_member"
        | "celebrity"
        | "karen"
        | "tweaker"
        | "dealer"
        | "fence"
      combat_outcome:
        | "attacker_win"
        | "defender_win"
        | "draw"
        | "retreat"
        | "ongoing"
      combat_type: "slide" | "driveby" | "raid" | "defense" | "stalk"
      drug_rarity: "common" | "uncommon" | "rare" | "legendary" | "mythic"
      loyalty_tier:
        | "snake"
        | "opportunist"
        | "neutral"
        | "solid"
        | "trusted"
        | "blood_in_blood_out"
      member_role:
        | "soldier"
        | "lieutenant"
        | "dealer"
        | "enforcer"
        | "chemist"
        | "driver"
        | "lookout"
      member_status: "active" | "injured" | "arrested" | "dead" | "defected"
      morale_tier:
        | "critical"
        | "desperate"
        | "low"
        | "neutral"
        | "content"
        | "loyal"
        | "ride_or_die"
      personality_trait:
        | "hothead"
        | "paranoid"
        | "greedy"
        | "loyal_soldier"
        | "ambitious"
        | "lazy"
        | "addict"
        | "psycho"
        | "smooth_talker"
        | "stone_cold"
      transaction_type:
        | "deal_profit"
        | "deal_loss"
        | "theft"
        | "raid_gain"
        | "raid_loss"
        | "craft_cost"
        | "craft_gain"
        | "mission_reward"
        | "casino_win"
        | "casino_loss"
        | "salary_payment"
        | "block_income"
        | "purchase"
        | "sale"
        | "bribe"
        | "hospital_fee"
        | "bail"
      user_status: "active" | "suspended" | "banned" | "deleted"
      weapon_type:
        | "pistol"
        | "revolver"
        | "smg"
        | "shotgun"
        | "rifle"
        | "assault_rifle"
        | "melee"
        | "throwable"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      block_status: ["unclaimed", "claimed", "contested", "locked"],
      city_region: [
        "nyc",
        "la",
        "miami",
        "chicago",
        "detroit",
        "new_orleans",
        "atlanta",
        "houston",
        "philadelphia",
        "baltimore",
      ],
      client_type: [
        "regular",
        "addict",
        "fiend",
        "rich_kid",
        "college_student",
        "cop",
        "undercover",
        "snitch",
        "gang_member",
        "celebrity",
        "karen",
        "tweaker",
        "dealer",
        "fence",
      ],
      combat_outcome: [
        "attacker_win",
        "defender_win",
        "draw",
        "retreat",
        "ongoing",
      ],
      combat_type: ["slide", "driveby", "raid", "defense", "stalk"],
      drug_rarity: ["common", "uncommon", "rare", "legendary", "mythic"],
      loyalty_tier: [
        "snake",
        "opportunist",
        "neutral",
        "solid",
        "trusted",
        "blood_in_blood_out",
      ],
      member_role: [
        "soldier",
        "lieutenant",
        "dealer",
        "enforcer",
        "chemist",
        "driver",
        "lookout",
      ],
      member_status: ["active", "injured", "arrested", "dead", "defected"],
      morale_tier: [
        "critical",
        "desperate",
        "low",
        "neutral",
        "content",
        "loyal",
        "ride_or_die",
      ],
      personality_trait: [
        "hothead",
        "paranoid",
        "greedy",
        "loyal_soldier",
        "ambitious",
        "lazy",
        "addict",
        "psycho",
        "smooth_talker",
        "stone_cold",
      ],
      transaction_type: [
        "deal_profit",
        "deal_loss",
        "theft",
        "raid_gain",
        "raid_loss",
        "craft_cost",
        "craft_gain",
        "mission_reward",
        "casino_win",
        "casino_loss",
        "salary_payment",
        "block_income",
        "purchase",
        "sale",
        "bribe",
        "hospital_fee",
        "bail",
      ],
      user_status: ["active", "suspended", "banned", "deleted"],
      weapon_type: [
        "pistol",
        "revolver",
        "smg",
        "shotgun",
        "rifle",
        "assault_rifle",
        "melee",
        "throwable",
      ],
    },
  },
} as const
