-- ============================================================
-- DEALT/SLIDE - Complete Supabase Database Schema
-- Version: 1.0.0 (MVP Launch)
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================
-- USERS & AUTHENTICATION
-- ============================================================

-- Profiles table (extends Supabase auth.users)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    gang_name TEXT DEFAULT 'New Gang',
    gang_color TEXT DEFAULT '#dc2626',
    region TEXT DEFAULT 'miami' CHECK (region IN ('miami', 'nyc', 'la', 'chicago', 'detroit', 'nola', 'atlanta', 'houston')),
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    xp_to_next_level INTEGER DEFAULT 100,
    money BIGINT DEFAULT 5000,
    bank_balance BIGINT DEFAULT 0,
    heat INTEGER DEFAULT 0 CHECK (heat >= 0 AND heat <= 100),
    reputation INTEGER DEFAULT 0,
    total_deals INTEGER DEFAULT 0,
    total_kills INTEGER DEFAULT 0,
    total_earnings BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ DEFAULT NOW()
);

-- User settings
CREATE TABLE public.user_settings (
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
    notifications_enabled BOOLEAN DEFAULT true,
    sound_enabled BOOLEAN DEFAULT true,
    haptics_enabled BOOLEAN DEFAULT true,
    auto_save BOOLEAN DEFAULT true,
    dark_mode BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- GANG MEMBERS
-- ============================================================

CREATE TABLE public.gang_members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    nickname TEXT,
    role TEXT NOT NULL CHECK (role IN ('shooter', 'dealer', 'enforcer', 'driver', 'lookout', 'cook')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'injured', 'hospitalized', 'jailed', 'dead', 'defected', 'backdoored')),
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    
    -- Stats
    shooting INTEGER DEFAULT 50 CHECK (shooting >= 0 AND shooting <= 100),
    driving INTEGER DEFAULT 50 CHECK (driving >= 0 AND driving <= 100),
    dealing INTEGER DEFAULT 50 CHECK (dealing >= 0 AND dealing <= 100),
    loyalty INTEGER DEFAULT 70 CHECK (loyalty >= 0 AND loyalty <= 100),
    morale INTEGER DEFAULT 75 CHECK (morale >= 0 AND morale <= 100),
    heat_resistance INTEGER DEFAULT 50 CHECK (heat_resistance >= 0 AND heat_resistance <= 100),
    stealth INTEGER DEFAULT 50 CHECK (stealth >= 0 AND stealth <= 100),
    
    -- Health
    health INTEGER DEFAULT 100,
    max_health INTEGER DEFAULT 100,
    armor INTEGER DEFAULT 0,
    
    -- Equipment (stored as JSONB)
    weapon JSONB,
    weapon_mods JSONB DEFAULT '[]',
    gear JSONB DEFAULT '[]',
    inventory JSONB DEFAULT '[]',
    
    -- Appearance
    appearance JSONB NOT NULL DEFAULT '{}',
    custom_avatar_url TEXT,
    
    -- Backstory & Connections
    backstory JSONB,
    connections JSONB DEFAULT '[]',
    
    -- Assignment
    assigned_block_id UUID,
    position JSONB,
    
    -- Meta
    hired_at TIMESTAMPTZ DEFAULT NOW(),
    death_date TIMESTAMPTZ,
    death_cause TEXT,
    killed_by TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Member contacts (history including dead/jailed)
CREATE TABLE public.member_contacts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    member_id UUID REFERENCES public.gang_members(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    nickname TEXT,
    role TEXT NOT NULL,
    status TEXT NOT NULL,
    status_emoji TEXT DEFAULT '✅',
    avatar_url TEXT,
    notes JSONB DEFAULT '[]',
    tags JSONB DEFAULT '[]',
    hire_date TIMESTAMPTZ,
    death_date TIMESTAMPTZ,
    death_cause TEXT,
    killed_by TEXT,
    backdoored_by TEXT,
    final_stats JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BLOCKS & TERRITORY
-- ============================================================

CREATE TABLE public.blocks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    coordinates GEOGRAPHY(POINT, 4326) NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    
    -- Ownership
    owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    owner_name TEXT,
    gang_color TEXT,
    
    -- Stats
    traffic INTEGER DEFAULT 50 CHECK (traffic >= 1 AND traffic <= 100),
    heat INTEGER DEFAULT 0 CHECK (heat >= 0 AND heat <= 100),
    reputation INTEGER DEFAULT 0,
    income_per_hour INTEGER DEFAULT 100,
    
    -- Units (stored as JSONB array)
    units JSONB DEFAULT '[]',
    max_units INTEGER DEFAULT 6,
    
    -- Visual
    image_url TEXT,
    grid_layout JSONB,
    
    -- Combat
    in_combat BOOLEAN DEFAULT false,
    contested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    
    -- Meta
    claimed_at TIMESTAMPTZ,
    last_attacked TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(address, city)
);

-- Create spatial index for geolocation queries
CREATE INDEX idx_blocks_coordinates ON public.blocks USING GIST(coordinates);
CREATE INDEX idx_blocks_owner ON public.blocks(owner_id);

-- ============================================================
-- TRANSACTIONS & ECONOMY
-- ============================================================

CREATE TABLE public.transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer', 'deal', 'purchase', 'loot', 'bail', 'bribe')),
    amount BIGINT NOT NULL,
    description TEXT,
    category TEXT,
    related_entity_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_user ON public.transactions(user_id);
CREATE INDEX idx_transactions_created ON public.transactions(created_at DESC);

-- Inventory items
CREATE TABLE public.inventory_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    item_type TEXT NOT NULL CHECK (item_type IN ('drug', 'weapon', 'gear', 'vehicle', 'consumable', 'key_item')),
    item_id TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, item_type, item_id)
);

-- Market listings
CREATE TABLE public.market_listings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL,
    item_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1,
    available BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- COMBAT & SESSIONS
-- ============================================================

CREATE TABLE public.combat_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    attacker_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    defender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    block_id UUID REFERENCES public.blocks(id) ON DELETE CASCADE NOT NULL,
    
    phase TEXT DEFAULT 'placement' CHECK (phase IN ('placement', 'combat', 'resolution')),
    current_turn TEXT DEFAULT 'attacker' CHECK (current_turn IN ('attacker', 'defender')),
    turn_number INTEGER DEFAULT 1,
    
    attacker_units JSONB DEFAULT '[]',
    defender_units JSONB DEFAULT '[]',
    
    attacker_grid JSONB,
    defender_grid JSONB,
    
    combat_log JSONB DEFAULT '[]',
    
    outcome JSONB,
    
    started_at TIMESTAMPTZ DEFAULT NOW(),
    last_action TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_combat_attacker ON public.combat_sessions(attacker_id);
CREATE INDEX idx_combat_defender ON public.combat_sessions(defender_id);

-- ============================================================
-- NOTIFICATIONS & EVENTS
-- ============================================================

CREATE TABLE public.notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    action_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id, read) WHERE read = false;

-- Morale events
CREATE TABLE public.morale_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    member_id UUID REFERENCES public.gang_members(id) ON DELETE CASCADE NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('positive', 'negative')),
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    morale_change INTEGER NOT NULL,
    loyalty_change INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Get-back requests
CREATE TABLE public.get_back_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    member_id UUID REFERENCES public.gang_members(id) ON DELETE SET NULL NOT NULL,
    member_name TEXT NOT NULL,
    target_type TEXT NOT NULL CHECK (target_type IN ('revenge', 'rescue', 'retaliation')),
    target_id UUID,
    target_name TEXT NOT NULL,
    reason TEXT NOT NULL,
    urgency TEXT DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
    deadline TIMESTAMPTZ,
    loyalty_penalty INTEGER DEFAULT 10,
    morale_penalty INTEGER DEFAULT 15,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'completed', 'failed', 'ignored')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- ============================================================
-- MISSIONS
-- ============================================================

CREATE TABLE public.missions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    mission_type TEXT NOT NULL CHECK (mission_type IN ('slide', 'stalk', 'deal', 'collect', 'defend', 'escort', 'hit')),
    name TEXT NOT NULL,
    description TEXT,
    objectives JSONB NOT NULL DEFAULT '[]',
    rewards JSONB NOT NULL DEFAULT '{}',
    difficulty INTEGER DEFAULT 1 CHECK (difficulty >= 1 AND difficulty <= 5),
    required_level INTEGER DEFAULT 1,
    assigned_members JSONB DEFAULT '[]',
    status TEXT DEFAULT 'available' CHECK (status IN ('available', 'active', 'completed', 'failed', 'expired')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SELFIE UPLOADS (for friend photo gang members)
-- ============================================================

CREATE TABLE public.selfie_uploads (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    original_url TEXT NOT NULL,
    processed_url TEXT,
    face_data JSONB,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- ============================================================
-- CACHED ASSETS (for Banana Nano generated images)
-- ============================================================

CREATE TABLE public.cached_assets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    asset_hash TEXT UNIQUE NOT NULL,
    asset_type TEXT NOT NULL CHECK (asset_type IN ('block', 'character', 'drug', 'weapon', 'vehicle', 'effect')),
    image_url TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    times_used INTEGER DEFAULT 1,
    last_accessed TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cached_assets_hash ON public.cached_assets(asset_hash);
CREATE INDEX idx_cached_assets_type ON public.cached_assets(asset_type);

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gang_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.morale_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.get_back_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.selfie_uploads ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Gang members policies
CREATE POLICY "Users can view own gang members" ON public.gang_members FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own gang members" ON public.gang_members FOR ALL USING (auth.uid() = user_id);

-- Blocks policies (public read, owner write)
CREATE POLICY "Anyone can view blocks" ON public.blocks FOR SELECT USING (true);
CREATE POLICY "Owner can update blocks" ON public.blocks FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Anyone can claim unclaimed blocks" ON public.blocks FOR UPDATE USING (owner_id IS NULL);

-- Transactions policies
CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_gang_members_updated_at BEFORE UPDATE ON public.gang_members
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_blocks_updated_at BEFORE UPDATE ON public.blocks
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, display_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', 'player_' || substr(NEW.id::text, 1, 8)),
        COALESCE(NEW.raw_user_meta_data->>'display_name', 'New Player')
    );
    
    INSERT INTO public.user_settings (user_id)
    VALUES (NEW.id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Level up function
CREATE OR REPLACE FUNCTION public.add_xp(
    p_user_id UUID,
    p_xp_amount INTEGER
) RETURNS JSONB AS $$
DECLARE
    v_current_xp INTEGER;
    v_current_level INTEGER;
    v_xp_to_next INTEGER;
    v_new_xp INTEGER;
    v_new_level INTEGER;
    v_leveled_up BOOLEAN := false;
BEGIN
    SELECT xp, level, xp_to_next_level INTO v_current_xp, v_current_level, v_xp_to_next
    FROM public.profiles WHERE id = p_user_id;
    
    v_new_xp := v_current_xp + p_xp_amount;
    v_new_level := v_current_level;
    
    WHILE v_new_xp >= v_xp_to_next LOOP
        v_new_xp := v_new_xp - v_xp_to_next;
        v_new_level := v_new_level + 1;
        v_xp_to_next := FLOOR(v_xp_to_next * 1.5);
        v_leveled_up := true;
    END LOOP;
    
    UPDATE public.profiles
    SET xp = v_new_xp, level = v_new_level, xp_to_next_level = v_xp_to_next
    WHERE id = p_user_id;
    
    RETURN jsonb_build_object(
        'new_xp', v_new_xp,
        'new_level', v_new_level,
        'xp_to_next', v_xp_to_next,
        'leveled_up', v_leveled_up
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- INITIAL SEED DATA (Market Listings)
-- ============================================================

INSERT INTO public.market_listings (item_type, item_id, name, description, price, quantity) VALUES
    ('weapon', 'knife', 'Combat Knife', 'Basic melee weapon', 50, 999),
    ('weapon', 'pistol_9mm', '9mm Pistol', 'Standard sidearm', 300, 999),
    ('weapon', 'glock', 'Glock 19', 'Reliable handgun', 500, 999),
    ('weapon', 'mac10', 'MAC-10', 'Compact SMG', 1500, 999),
    ('weapon', 'draco', 'Draco', 'Mini AK variant', 2500, 999),
    ('weapon', 'ak47', 'AK-47', 'Classic assault rifle', 3500, 999),
    ('gear', 'light_vest', 'Light Vest', '+10 Armor', 200, 999),
    ('gear', 'ballistic_vest', 'Ballistic Vest', '+25 Armor', 800, 999),
    ('gear', 'plate_carrier', 'Plate Carrier', '+40 Armor', 1500, 999),
    ('drug', 'weed', 'Weed (oz)', 'Entry level product', 100, 999),
    ('drug', 'coke', 'Cocaine (g)', 'High margin product', 80, 999),
    ('drug', 'pills', 'Pills (10-pack)', 'Steady seller', 150, 999);
