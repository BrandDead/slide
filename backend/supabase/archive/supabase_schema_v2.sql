-- ============================================================
-- DEALT/SLIDE - COMPLETE DATABASE SCHEMA FOR SUPABASE
-- Version: 1.0.0 (Beta Launch)
-- Last Updated: 2025-01-29
-- ============================================================
-- 
-- SETUP INSTRUCTIONS:
-- 1. Create a Supabase project at https://supabase.com
-- 2. Go to SQL Editor in your Supabase dashboard
-- 3. Run this entire file to set up your database
-- 4. Copy your anon/service keys from Project Settings > API
--
-- This schema includes:
-- - User accounts and authentication hooks
-- - Territory/Block ownership with geospatial support
-- - Gang members with stats, loyalty, and skills
-- - Drug inventory and crafting recipes
-- - Combat logs and multiplayer events
-- - Economy transactions and leaderboards
-- - Real-time subscriptions ready
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";  -- For geospatial territory features

-- ============================================================
-- CORE ENUMS
-- ============================================================

CREATE TYPE user_status AS ENUM ('active', 'suspended', 'banned', 'deleted');
CREATE TYPE block_status AS ENUM ('unclaimed', 'claimed', 'contested', 'locked');
CREATE TYPE member_status AS ENUM ('active', 'injured', 'arrested', 'dead', 'defected');
CREATE TYPE member_role AS ENUM ('soldier', 'lieutenant', 'dealer', 'enforcer', 'chemist', 'driver');
CREATE TYPE drug_rarity AS ENUM ('common', 'uncommon', 'rare', 'legendary', 'mythic');
CREATE TYPE transaction_type AS ENUM ('deal', 'theft', 'raid_gain', 'raid_loss', 'craft_cost', 'craft_gain', 'mission_reward', 'casino_win', 'casino_loss');
CREATE TYPE combat_type AS ENUM ('slide', 'driveby', 'raid', 'defense');
CREATE TYPE combat_outcome AS ENUM ('attacker_win', 'defender_win', 'draw', 'retreat', 'ongoing');
CREATE TYPE client_type AS ENUM ('regular', 'addict', 'cop', 'snitch', 'rich_kid', 'gang_member', 'crackhead', 'karen', 'dealer', 'undercover');
CREATE TYPE city_region AS ENUM ('nyc', 'la', 'miami', 'chicago', 'detroit', 'new_orleans', 'atlanta', 'houston');

-- ============================================================
-- USERS TABLE (Extends Supabase Auth)
-- ============================================================

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Basic Info
    username VARCHAR(32) UNIQUE NOT NULL,
    display_name VARCHAR(64),
    avatar_url TEXT,
    gang_name VARCHAR(48),
    gang_tag VARCHAR(6),  -- e.g., "[OGK]"
    city_region city_region DEFAULT 'nyc',
    
    -- Game Stats (denormalized for fast reads)
    cash BIGINT DEFAULT 1000 CHECK (cash >= 0),
    bank BIGINT DEFAULT 0 CHECK (bank >= 0),
    reputation INTEGER DEFAULT 0,
    heat_level INTEGER DEFAULT 0 CHECK (heat_level >= 0 AND heat_level <= 100),
    respect_points INTEGER DEFAULT 0,
    
    -- Progression
    level INTEGER DEFAULT 1 CHECK (level >= 1),
    xp BIGINT DEFAULT 0 CHECK (xp >= 0),
    
    -- Counts (denormalized)
    blocks_owned INTEGER DEFAULT 0,
    members_count INTEGER DEFAULT 0,
    total_deals INTEGER DEFAULT 0,
    total_kills INTEGER DEFAULT 0,
    raids_won INTEGER DEFAULT 0,
    raids_lost INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Status
    status user_status DEFAULT 'active',
    is_online BOOLEAN DEFAULT false,
    
    -- Premium/Monetization
    is_premium BOOLEAN DEFAULT false,
    premium_until TIMESTAMPTZ,
    
    -- Settings
    settings JSONB DEFAULT '{
        "notifications": true,
        "sound": true,
        "haptics": true,
        "show_heat_warnings": true,
        "auto_defend": false
    }'::jsonb
);

-- ============================================================
-- BLOCKS (Territory Control)
-- ============================================================

CREATE TABLE public.blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Location
    address TEXT NOT NULL,
    city VARCHAR(64) NOT NULL,
    state VARCHAR(2) NOT NULL,
    zip_code VARCHAR(10),
    region city_region NOT NULL,
    
    -- Geospatial (PostGIS)
    location GEOGRAPHY(POINT, 4326),  -- lat/lng point
    bounds GEOGRAPHY(POLYGON, 4326),  -- Block boundaries
    
    -- Ownership
    owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    claimed_at TIMESTAMPTZ,
    status block_status DEFAULT 'unclaimed',
    
    -- Economics
    traffic_value INTEGER DEFAULT 50 CHECK (traffic_value >= 0 AND traffic_value <= 100),
    base_income INTEGER DEFAULT 100,
    income_multiplier DECIMAL(3,2) DEFAULT 1.00,
    
    -- Defense
    defense_level INTEGER DEFAULT 1 CHECK (defense_level >= 1 AND defense_level <= 10),
    trap_count INTEGER DEFAULT 0,
    camera_count INTEGER DEFAULT 0,
    
    -- Combat State
    is_contested BOOLEAN DEFAULT false,
    attacker_id UUID REFERENCES public.profiles(id),
    combat_started_at TIMESTAMPTZ,
    
    -- Heat
    block_heat INTEGER DEFAULT 0 CHECK (block_heat >= 0 AND block_heat <= 100),
    last_raid_at TIMESTAMPTZ,
    police_presence INTEGER DEFAULT 0,
    
    -- Asset Cache (for generated building images)
    asset_hash VARCHAR(64),
    satellite_image_url TEXT,
    generated_building_url TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(address, city, state)
);

-- Geospatial index for nearby queries
CREATE INDEX idx_blocks_location ON public.blocks USING GIST(location);
CREATE INDEX idx_blocks_owner ON public.blocks(owner_id);
CREATE INDEX idx_blocks_region ON public.blocks(region);
CREATE INDEX idx_blocks_status ON public.blocks(status);

-- ============================================================
-- GANG MEMBERS
-- ============================================================

CREATE TABLE public.gang_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Identity
    name VARCHAR(64) NOT NULL,
    nickname VARCHAR(32),
    avatar_url TEXT,
    
    -- Role & Status
    role member_role DEFAULT 'soldier',
    status member_status DEFAULT 'active',
    assigned_block_id UUID REFERENCES public.blocks(id) ON DELETE SET NULL,
    
    -- Core Stats (1-100 scale)
    loyalty INTEGER DEFAULT 50 CHECK (loyalty >= 0 AND loyalty <= 100),
    morale INTEGER DEFAULT 75 CHECK (morale >= 0 AND morale <= 100),
    experience INTEGER DEFAULT 0,
    
    -- Combat Stats
    accuracy INTEGER DEFAULT 50 CHECK (accuracy >= 0 AND accuracy <= 100),
    toughness INTEGER DEFAULT 50 CHECK (toughness >= 0 AND toughness <= 100),
    speed INTEGER DEFAULT 50 CHECK (speed >= 0 AND speed <= 100),
    stealth INTEGER DEFAULT 50 CHECK (stealth >= 0 AND stealth <= 100),
    
    -- Equipment
    weapon_id UUID,  -- References inventory item
    weapon_name VARCHAR(64),
    weapon_accuracy_bonus INTEGER DEFAULT 0,
    armor_rating INTEGER DEFAULT 0,
    
    -- Economy
    weekly_salary INTEGER DEFAULT 500,
    total_earnings BIGINT DEFAULT 0,
    last_paid_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Combat History
    kills INTEGER DEFAULT 0,
    deaths INTEGER DEFAULT 0,
    deals_completed INTEGER DEFAULT 0,
    
    -- Skills (unlockable abilities)
    skills JSONB DEFAULT '[]'::jsonb,
    skill_points INTEGER DEFAULT 0,
    
    -- Health
    health INTEGER DEFAULT 100 CHECK (health >= 0 AND health <= 100),
    injured_until TIMESTAMPTZ,
    arrested_until TIMESTAMPTZ,
    
    -- Timestamps
    recruited_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_members_owner ON public.gang_members(owner_id);
CREATE INDEX idx_members_status ON public.gang_members(status);
CREATE INDEX idx_members_block ON public.gang_members(assigned_block_id);

-- ============================================================
-- DRUGS (Inventory Items)
-- ============================================================

CREATE TABLE public.drugs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Identity
    name VARCHAR(64) UNIQUE NOT NULL,
    street_name VARCHAR(64),
    description TEXT,
    icon_url TEXT,
    
    -- Classification
    rarity drug_rarity DEFAULT 'common',
    base_price INTEGER NOT NULL,
    
    -- Effect multipliers
    profit_multiplier DECIMAL(4,2) DEFAULT 1.00,
    heat_multiplier DECIMAL(4,2) DEFAULT 1.00,
    addiction_rate INTEGER DEFAULT 50,  -- 0-100
    
    -- Crafting
    is_craftable BOOLEAN DEFAULT false,
    craft_time_minutes INTEGER,
    craft_ingredients JSONB,  -- [{drug_id, quantity}, ...]
    
    -- Regional availability
    available_regions city_region[] DEFAULT '{nyc,la,miami,chicago,detroit,new_orleans}'
);

-- ============================================================
-- PLAYER INVENTORY
-- ============================================================

CREATE TABLE public.inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    drug_id UUID NOT NULL REFERENCES public.drugs(id),
    
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    quality INTEGER DEFAULT 50 CHECK (quality >= 0 AND quality <= 100),  -- Affects price
    
    -- Acquisition tracking
    acquired_at TIMESTAMPTZ DEFAULT NOW(),
    acquired_via VARCHAR(32),  -- 'craft', 'buy', 'steal', 'raid'
    unit_cost INTEGER,  -- What we paid per unit
    
    UNIQUE(owner_id, drug_id, quality)
);

CREATE INDEX idx_inventory_owner ON public.inventory(owner_id);

-- ============================================================
-- ALCHEMY RECIPES
-- ============================================================

CREATE TABLE public.recipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Result
    result_drug_id UUID NOT NULL REFERENCES public.drugs(id),
    result_quantity INTEGER DEFAULT 1,
    result_quality_bonus INTEGER DEFAULT 0,  -- +quality to base
    
    -- Ingredients (as JSONB array)
    ingredients JSONB NOT NULL,  -- [{drug_id: uuid, quantity: int}, ...]
    
    -- Requirements
    required_level INTEGER DEFAULT 1,
    required_chemist_skill INTEGER DEFAULT 0,
    
    -- Crafting
    craft_time_seconds INTEGER DEFAULT 60,
    base_success_rate INTEGER DEFAULT 80,  -- 0-100
    xp_reward INTEGER DEFAULT 10,
    
    -- Discovery
    is_discovered_by_default BOOLEAN DEFAULT false,
    discovery_hint TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PLAYER DISCOVERED RECIPES
-- ============================================================

CREATE TABLE public.player_recipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    recipe_id UUID NOT NULL REFERENCES public.recipes(id),
    
    discovered_at TIMESTAMPTZ DEFAULT NOW(),
    times_crafted INTEGER DEFAULT 0,
    
    UNIQUE(player_id, recipe_id)
);

-- ============================================================
-- TRANSACTIONS (Economy Ledger)
-- ============================================================

CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    type transaction_type NOT NULL,
    amount BIGINT NOT NULL,  -- Positive = gain, Negative = loss
    
    -- Context
    drug_id UUID REFERENCES public.drugs(id),
    block_id UUID REFERENCES public.blocks(id),
    client_type client_type,
    
    -- Deal details
    quantity INTEGER,
    price_per_unit INTEGER,
    was_risky_deal BOOLEAN DEFAULT false,
    
    -- Running balance (for audit trail)
    balance_after BIGINT NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Denormalized for fast queries
    day_of_week INTEGER GENERATED ALWAYS AS (EXTRACT(DOW FROM created_at)) STORED,
    hour_of_day INTEGER GENERATED ALWAYS AS (EXTRACT(HOUR FROM created_at)) STORED
);

CREATE INDEX idx_transactions_player ON public.transactions(player_id);
CREATE INDEX idx_transactions_created ON public.transactions(created_at DESC);
CREATE INDEX idx_transactions_type ON public.transactions(type);

-- ============================================================
-- COMBAT LOGS
-- ============================================================

CREATE TABLE public.combat_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Participants
    attacker_id UUID NOT NULL REFERENCES public.profiles(id),
    defender_id UUID REFERENCES public.profiles(id),  -- NULL for PvE
    block_id UUID REFERENCES public.blocks(id),
    
    -- Combat Info
    combat_type combat_type NOT NULL,
    outcome combat_outcome DEFAULT 'ongoing',
    
    -- Stats
    attacker_units_start INTEGER,
    defender_units_start INTEGER,
    attacker_units_lost INTEGER DEFAULT 0,
    defender_units_lost INTEGER DEFAULT 0,
    
    -- Rewards/Losses
    cash_stolen BIGINT DEFAULT 0,
    drugs_stolen JSONB,  -- [{drug_id, quantity}, ...]
    xp_gained INTEGER DEFAULT 0,
    
    -- Turn data (for replay)
    turns JSONB DEFAULT '[]'::jsonb,
    
    -- Timing
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER GENERATED ALWAYS AS (
        CASE WHEN ended_at IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (ended_at - started_at))::INTEGER 
        ELSE NULL END
    ) STORED
);

CREATE INDEX idx_combat_attacker ON public.combat_logs(attacker_id);
CREATE INDEX idx_combat_defender ON public.combat_logs(defender_id);
CREATE INDEX idx_combat_block ON public.combat_logs(block_id);
CREATE INDEX idx_combat_active ON public.combat_logs(started_at) WHERE outcome = 'ongoing';

-- ============================================================
-- MISSIONS
-- ============================================================

CREATE TABLE public.missions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Mission Info
    title VARCHAR(128) NOT NULL,
    description TEXT,
    icon_url TEXT,
    
    -- Requirements
    required_level INTEGER DEFAULT 1,
    required_reputation INTEGER DEFAULT 0,
    
    -- Objectives (JSONB for flexibility)
    objectives JSONB NOT NULL,  -- [{type: 'deal', target: 10, current: 0}, ...]
    
    -- Rewards
    cash_reward BIGINT DEFAULT 0,
    xp_reward INTEGER DEFAULT 0,
    reputation_reward INTEGER DEFAULT 0,
    item_rewards JSONB,  -- [{drug_id, quantity}, ...]
    
    -- Timing
    time_limit_minutes INTEGER,  -- NULL = no limit
    cooldown_hours INTEGER DEFAULT 0,
    
    -- Availability
    is_daily BOOLEAN DEFAULT false,
    is_weekly BOOLEAN DEFAULT false,
    available_regions city_region[],
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PLAYER MISSION PROGRESS
-- ============================================================

CREATE TABLE public.player_missions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    mission_id UUID NOT NULL REFERENCES public.missions(id),
    
    -- Progress
    objectives_progress JSONB NOT NULL,  -- Mirrors mission objectives with current values
    is_completed BOOLEAN DEFAULT false,
    
    -- Timing
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    
    UNIQUE(player_id, mission_id)
);

CREATE INDEX idx_player_missions ON public.player_missions(player_id);

-- ============================================================
-- LEADERBOARDS (Denormalized for speed)
-- ============================================================

CREATE TABLE public.leaderboards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    region city_region NOT NULL,
    period VARCHAR(16) NOT NULL,  -- 'daily', 'weekly', 'monthly', 'alltime'
    period_start DATE NOT NULL,
    
    -- Metrics
    total_cash BIGINT DEFAULT 0,
    total_deals INTEGER DEFAULT 0,
    total_kills INTEGER DEFAULT 0,
    blocks_captured INTEGER DEFAULT 0,
    raids_won INTEGER DEFAULT 0,
    reputation_earned INTEGER DEFAULT 0,
    
    -- Rank (updated by trigger)
    rank INTEGER,
    
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(player_id, region, period, period_start)
);

CREATE INDEX idx_leaderboard_rank ON public.leaderboards(region, period, period_start, rank);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    type VARCHAR(32) NOT NULL,  -- 'raid_incoming', 'deal_complete', 'member_arrested', etc.
    title VARCHAR(128) NOT NULL,
    message TEXT,
    data JSONB,  -- Additional context
    
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

CREATE INDEX idx_notifications_player ON public.notifications(player_id);
CREATE INDEX idx_notifications_unread ON public.notifications(player_id) WHERE is_read = false;

-- ============================================================
-- REAL-TIME PRESENCE (Online/Offline tracking)
-- ============================================================

CREATE TABLE public.presence (
    player_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    is_online BOOLEAN DEFAULT false,
    current_block_id UUID REFERENCES public.blocks(id),
    current_game_mode VARCHAR(32),  -- 'dealt', 'slide', 'alchemy', 'map', etc.
    
    last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
    session_started TIMESTAMPTZ
);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER blocks_updated_at
    BEFORE UPDATE ON public.blocks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER gang_members_updated_at
    BEFORE UPDATE ON public.gang_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, display_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', 'Player_' || LEFT(NEW.id::TEXT, 8)),
        COALESCE(NEW.raw_user_meta_data->>'display_name', 'New Player')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Update player stats after transaction
CREATE OR REPLACE FUNCTION update_player_after_transaction()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles
    SET 
        cash = cash + NEW.amount,
        total_deals = total_deals + CASE WHEN NEW.type = 'deal' THEN 1 ELSE 0 END,
        updated_at = NOW()
    WHERE id = NEW.player_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_transaction
    AFTER INSERT ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION update_player_after_transaction();

-- Update block count when claimed/lost
CREATE OR REPLACE FUNCTION update_block_ownership()
RETURNS TRIGGER AS $$
BEGIN
    -- Decrement old owner's count
    IF OLD.owner_id IS NOT NULL AND (NEW.owner_id IS NULL OR NEW.owner_id != OLD.owner_id) THEN
        UPDATE public.profiles SET blocks_owned = blocks_owned - 1 WHERE id = OLD.owner_id;
    END IF;
    
    -- Increment new owner's count
    IF NEW.owner_id IS NOT NULL AND (OLD.owner_id IS NULL OR NEW.owner_id != OLD.owner_id) THEN
        UPDATE public.profiles SET blocks_owned = blocks_owned + 1 WHERE id = NEW.owner_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_block_ownership_change
    AFTER UPDATE OF owner_id ON public.blocks
    FOR EACH ROW EXECUTE FUNCTION update_block_ownership();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gang_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combat_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_recipes ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read all, but only update their own
CREATE POLICY "Profiles viewable by everyone" 
    ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" 
    ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Blocks: Everyone can view, only owner can modify
CREATE POLICY "Blocks viewable by everyone" 
    ON public.blocks FOR SELECT USING (true);

CREATE POLICY "Block owner can update" 
    ON public.blocks FOR UPDATE USING (auth.uid() = owner_id);

-- Gang members: Only owner can view and manage
CREATE POLICY "Members viewable by owner" 
    ON public.gang_members FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Members manageable by owner" 
    ON public.gang_members FOR ALL USING (auth.uid() = owner_id);

-- Inventory: Private to owner
CREATE POLICY "Inventory private to owner" 
    ON public.inventory FOR ALL USING (auth.uid() = owner_id);

-- Transactions: Private to owner
CREATE POLICY "Transactions private to owner" 
    ON public.transactions FOR ALL USING (auth.uid() = player_id);

-- Combat logs: Visible to participants
CREATE POLICY "Combat visible to participants" 
    ON public.combat_logs FOR SELECT 
    USING (auth.uid() = attacker_id OR auth.uid() = defender_id);

-- Notifications: Private to recipient
CREATE POLICY "Notifications private to recipient" 
    ON public.notifications FOR ALL USING (auth.uid() = player_id);

-- Player missions: Private to player
CREATE POLICY "Missions private to player" 
    ON public.player_missions FOR ALL USING (auth.uid() = player_id);

-- Player recipes: Private to player
CREATE POLICY "Recipes private to player" 
    ON public.player_recipes FOR ALL USING (auth.uid() = player_id);

-- ============================================================
-- SEED DATA: BASE DRUGS
-- ============================================================

INSERT INTO public.drugs (name, street_name, rarity, base_price, profit_multiplier, heat_multiplier, addiction_rate, is_craftable) VALUES
-- Common (easy to get, low risk, low reward)
('Cannabis', 'Loud', 'common', 20, 1.0, 0.5, 30, false),
('Tobacco', 'Loosies', 'common', 5, 0.8, 0.1, 40, false),
('Alcohol', 'Henny', 'common', 15, 0.9, 0.2, 35, false),

-- Uncommon (moderate risk/reward)
('Cocaine', 'Soft', 'uncommon', 80, 1.5, 1.2, 60, false),
('MDMA', 'Molly', 'uncommon', 60, 1.4, 1.0, 45, false),
('LSD', 'Acid', 'uncommon', 40, 1.3, 0.8, 20, false),
('Xanax', 'Bars', 'uncommon', 50, 1.3, 0.9, 55, false),
('Percocet', 'Percs', 'uncommon', 70, 1.4, 1.1, 65, false),

-- Rare (high risk, high reward, craftable)
('Crack Cocaine', 'Hard', 'rare', 150, 2.0, 2.0, 85, true),
('Methamphetamine', 'Ice', 'rare', 180, 2.2, 2.2, 80, true),
('Fentanyl', 'Fetty', 'rare', 200, 2.5, 2.5, 95, true),
('PCP', 'Angel Dust', 'rare', 120, 1.8, 1.8, 50, true),

-- Legendary (special combos, ultra rare)
('Purple Drank', 'Lean', 'legendary', 300, 3.0, 1.5, 70, true),
('Speedball', 'Speedball', 'legendary', 400, 3.5, 3.0, 90, true),

-- Mythic (game-changers)
('Blue Magic', 'Blue', 'mythic', 1000, 5.0, 2.0, 75, true);

-- ============================================================
-- SEED DATA: BASE RECIPES
-- ============================================================

-- Note: You'll need to grab the actual UUIDs after inserting drugs
-- This is a template - run after drugs are inserted

/*
INSERT INTO public.recipes (result_drug_id, ingredients, craft_time_seconds, base_success_rate, xp_reward, is_discovered_by_default) VALUES
-- Crack from Cocaine + Baking Soda (simulated)
((SELECT id FROM public.drugs WHERE name = 'Crack Cocaine'), 
 '[{"drug_name": "Cocaine", "quantity": 2}]'::jsonb, 
 120, 70, 50, false),

-- Lean from Codeine + Sprite + Jolly Rancher (abstracted)
((SELECT id FROM public.drugs WHERE name = 'Purple Drank'), 
 '[{"drug_name": "Percocet", "quantity": 3}]'::jsonb, 
 180, 80, 100, false),

-- Speedball from Cocaine + Heroin (abstracted as fentanyl)
((SELECT id FROM public.drugs WHERE name = 'Speedball'), 
 '[{"drug_name": "Cocaine", "quantity": 2}, {"drug_name": "Fentanyl", "quantity": 1}]'::jsonb, 
 240, 60, 200, false);
*/

-- ============================================================
-- SEED DATA: STARTER MISSIONS
-- ============================================================

INSERT INTO public.missions (title, description, objectives, cash_reward, xp_reward, reputation_reward, required_level) VALUES
('First Blood', 'Complete your first deal. Every empire starts somewhere.', 
 '[{"type": "deal", "target": 1, "current": 0, "description": "Complete 1 deal"}]'::jsonb, 
 500, 100, 10, 1),

('Corner Boy', 'Work the corner. Complete 10 deals to prove yourself.', 
 '[{"type": "deal", "target": 10, "current": 0, "description": "Complete 10 deals"}]'::jsonb, 
 2000, 300, 25, 1),

('Block Captain', 'Claim your first territory.', 
 '[{"type": "claim_block", "target": 1, "current": 0, "description": "Claim 1 block"}]'::jsonb, 
 5000, 500, 50, 2),

('Squad Up', 'Recruit your first gang member.', 
 '[{"type": "recruit", "target": 1, "current": 0, "description": "Recruit 1 member"}]'::jsonb, 
 1000, 200, 20, 1),

('Chemistry 101', 'Cook up your first batch in the Alchemy Lab.', 
 '[{"type": "craft", "target": 1, "current": 0, "description": "Craft 1 item"}]'::jsonb, 
 3000, 400, 30, 3),

('Drive-By Initiation', 'Win your first SLIDE battle.', 
 '[{"type": "combat_win", "target": 1, "current": 0, "description": "Win 1 combat"}]'::jsonb, 
 4000, 500, 40, 2);

-- ============================================================
-- ENABLE REALTIME FOR MULTIPLAYER
-- ============================================================

-- Enable realtime for tables that need live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.blocks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.combat_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.presence;

-- ============================================================
-- DONE! Your database is ready for beta.
-- ============================================================
