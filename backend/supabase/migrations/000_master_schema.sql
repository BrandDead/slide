-- ============================================================
-- DEALT/SLIDE - Master Schema Migration
-- Applies all tables, RLS policies, seed data, and realtime
-- Safe to run on a fresh Supabase project
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE city_region AS ENUM ('nyc','la','miami','chicago','detroit','atlanta','houston','nola');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE user_status AS ENUM ('active','suspended','banned');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE block_status AS ENUM ('unclaimed','claimed','contested','raided');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE member_role AS ENUM ('shooter','dealer','enforcer','driver','lookout','cook','soldier','boss');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE member_status AS ENUM ('active','injured','hospitalized','jailed','dead','defected','backdoored');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- HELPER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(32) UNIQUE NOT NULL,
    display_name VARCHAR(64),
    avatar_url TEXT,
    gang_name VARCHAR(48) DEFAULT 'New Gang',
    gang_tag VARCHAR(6),
    gang_color TEXT DEFAULT '#dc2626',
    city_region city_region DEFAULT 'nyc',
    cash BIGINT DEFAULT 5000 CHECK (cash >= 0),
    bank BIGINT DEFAULT 0 CHECK (bank >= 0),
    heat_level INTEGER DEFAULT 0 CHECK (heat_level BETWEEN 0 AND 100),
    reputation INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    xp BIGINT DEFAULT 0,
    blocks_owned INTEGER DEFAULT 0,
    members_count INTEGER DEFAULT 0,
    total_deals INTEGER DEFAULT 0,
    total_kills INTEGER DEFAULT 0,
    raids_won INTEGER DEFAULT 0,
    raids_lost INTEGER DEFAULT 0,
    status user_status DEFAULT 'active',
    is_online BOOLEAN DEFAULT false,
    is_premium BOOLEAN DEFAULT false,
    settings JSONB DEFAULT '{"notifications":true,"sound":true,"haptics":true}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_region ON public.profiles(city_region);
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, gang_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'gang_name', 'New Gang')
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- BLOCKS (Territory)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    address TEXT NOT NULL,
    city VARCHAR(64) NOT NULL DEFAULT 'Unknown',
    state VARCHAR(2) NOT NULL DEFAULT 'XX',
    zip_code VARCHAR(10),
    region city_region DEFAULT 'nyc',
    location GEOGRAPHY(POINT, 4326),
    owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    claimed_at TIMESTAMPTZ,
    status block_status DEFAULT 'unclaimed',
    traffic_value INTEGER DEFAULT 50 CHECK (traffic_value BETWEEN 0 AND 100),
    base_income INTEGER DEFAULT 100,
    income_multiplier DECIMAL(3,2) DEFAULT 1.00,
    defense_level INTEGER DEFAULT 1,
    block_heat INTEGER DEFAULT 0 CHECK (block_heat BETWEEN 0 AND 100),
    last_raid_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    satellite_image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(address, city, state)
);
CREATE INDEX IF NOT EXISTS idx_blocks_owner ON public.blocks(owner_id);
CREATE INDEX IF NOT EXISTS idx_blocks_status ON public.blocks(status);
CREATE INDEX IF NOT EXISTS idx_blocks_location ON public.blocks USING GIST(location);
DROP TRIGGER IF EXISTS set_blocks_updated_at ON public.blocks;
CREATE TRIGGER set_blocks_updated_at BEFORE UPDATE ON public.blocks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- GANG MEMBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.gang_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name VARCHAR(64) NOT NULL,
    nickname VARCHAR(32),
    avatar_url TEXT,
    role member_role DEFAULT 'soldier',
    status member_status DEFAULT 'active',
    assigned_block_id UUID REFERENCES public.blocks(id) ON DELETE SET NULL,
    loyalty INTEGER DEFAULT 50 CHECK (loyalty BETWEEN 0 AND 100),
    morale INTEGER DEFAULT 75 CHECK (morale BETWEEN 0 AND 100),
    experience INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    accuracy INTEGER DEFAULT 50 CHECK (accuracy BETWEEN 0 AND 100),
    dealing_skill INTEGER DEFAULT 50 CHECK (dealing_skill BETWEEN 0 AND 100),
    toughness INTEGER DEFAULT 50 CHECK (toughness BETWEEN 0 AND 100),
    speed INTEGER DEFAULT 50 CHECK (speed BETWEEN 0 AND 100),
    stealth INTEGER DEFAULT 50 CHECK (stealth BETWEEN 0 AND 100),
    weapon_name VARCHAR(64),
    armor_rating INTEGER DEFAULT 0,
    weekly_salary INTEGER DEFAULT 500,
    last_paid_at TIMESTAMPTZ DEFAULT NOW(),
    times_arrested INTEGER DEFAULT 0,
    kills INTEGER DEFAULT 0,
    deals_completed INTEGER DEFAULT 0,
    grid_x SMALLINT DEFAULT 4,
    grid_y SMALLINT DEFAULT 4,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gang_members_owner ON public.gang_members(owner_id);
CREATE INDEX IF NOT EXISTS idx_gang_members_block ON public.gang_members(assigned_block_id);
CREATE INDEX IF NOT EXISTS idx_gang_members_status ON public.gang_members(status);
DROP TRIGGER IF EXISTS set_gang_members_updated_at ON public.gang_members;
CREATE TRIGGER set_gang_members_updated_at BEFORE UPDATE ON public.gang_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- BLOCK PLACEMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.block_placements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    block_id UUID NOT NULL REFERENCES public.blocks(id) ON DELETE CASCADE,
    member_id TEXT NOT NULL,
    member_name TEXT NOT NULL,
    role TEXT NOT NULL,
    grid_x SMALLINT NOT NULL CHECK (grid_x BETWEEN 0 AND 7),
    grid_y SMALLINT NOT NULL CHECK (grid_y BETWEEN 0 AND 7),
    zone_type TEXT NOT NULL DEFAULT 'sidewalk',
    income_per_tick INTEGER NOT NULL DEFAULT 0,
    exposure_risk SMALLINT NOT NULL DEFAULT 50,
    level SMALLINT NOT NULL DEFAULT 1,
    health SMALLINT NOT NULL DEFAULT 100,
    portrait_url TEXT,
    topdown_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (block_id, grid_x, grid_y),
    UNIQUE (block_id, member_id)
);
CREATE INDEX IF NOT EXISTS idx_block_placements_block_id ON public.block_placements(block_id);
DROP TRIGGER IF EXISTS set_block_placements_updated_at ON public.block_placements;
CREATE TRIGGER set_block_placements_updated_at BEFORE UPDATE ON public.block_placements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- DRUGS CATALOG
-- ============================================================
CREATE TABLE IF NOT EXISTS public.drugs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    street_name TEXT,
    rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common','uncommon','rare','legendary','mythic')),
    base_price INTEGER DEFAULT 20,
    profit_multiplier DECIMAL(4,2) DEFAULT 1.0,
    heat_multiplier DECIMAL(4,2) DEFAULT 1.0,
    od_risk INTEGER DEFAULT 10 CHECK (od_risk BETWEEN 0 AND 100),
    addiction_rate INTEGER DEFAULT 30,
    is_craftable BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PLAYER DRUG INVENTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS public.player_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    drug_id UUID REFERENCES public.drugs(id),
    drug_name TEXT NOT NULL,
    quantity INTEGER DEFAULT 0 CHECK (quantity >= 0),
    purity INTEGER DEFAULT 50 CHECK (purity BETWEEN 0 AND 100),
    purchase_price INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(owner_id, drug_name)
);
CREATE INDEX IF NOT EXISTS idx_player_inventory_owner ON public.player_inventory(owner_id);

-- ============================================================
-- ECONOMY LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.economy_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_economy_logs_profile ON public.economy_logs(profile_id, created_at DESC);

-- ============================================================
-- SALARY RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.salary_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    total_paid INTEGER NOT NULL,
    member_count INTEGER NOT NULL,
    paid_at TIMESTAMPTZ DEFAULT NOW(),
    was_successful BOOLEAN DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_salary_records_profile ON public.salary_records(profile_id, paid_at DESC);

-- ============================================================
-- COMBAT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.combat_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attacker_id UUID REFERENCES public.profiles(id),
    defender_id UUID REFERENCES public.profiles(id),
    block_id UUID REFERENCES public.blocks(id),
    combat_type TEXT DEFAULT 'driveby' CHECK (combat_type IN ('driveby','slide','topdown','raid')),
    winner_id UUID REFERENCES public.profiles(id),
    attacker_casualties INTEGER DEFAULT 0,
    defender_casualties INTEGER DEFAULT 0,
    loot_cash INTEGER DEFAULT 0,
    heat_generated INTEGER DEFAULT 0,
    turns_played INTEGER DEFAULT 0,
    result JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_combat_logs_attacker ON public.combat_logs(attacker_id);
CREATE INDEX IF NOT EXISTS idx_combat_logs_defender ON public.combat_logs(defender_id);
CREATE INDEX IF NOT EXISTS idx_combat_logs_block ON public.combat_logs(block_id);

-- ============================================================
-- NPC GANGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.npc_gangs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    faction VARCHAR(30),
    difficulty INTEGER DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
    aggression INTEGER DEFAULT 50 CHECK (aggression BETWEEN 0 AND 100),
    wealth INTEGER DEFAULT 50 CHECK (wealth BETWEEN 0 AND 100),
    territory_count INTEGER DEFAULT 1,
    controlled_blocks JSONB DEFAULT '[]',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_player ON public.notifications(player_id, is_read, created_at DESC);

-- ============================================================
-- PRESENCE (Multiplayer)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.presence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    block_id UUID REFERENCES public.blocks(id),
    status TEXT DEFAULT 'online',
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================
-- LEADERBOARD RPC
-- ============================================================
CREATE OR REPLACE FUNCTION get_leaderboard(limit_count INT DEFAULT 50)
RETURNS TABLE (
    rank BIGINT,
    owner_id UUID,
    username TEXT,
    gang_name TEXT,
    total_blocks BIGINT,
    total_income BIGINT,
    max_heat INT,
    avg_morale NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT
        ROW_NUMBER() OVER (ORDER BY SUM(b.base_income) DESC) AS rank,
        b.owner_id,
        p.username,
        p.gang_name,
        COUNT(b.id) AS total_blocks,
        SUM(b.base_income) AS total_income,
        MAX(b.block_heat) AS max_heat,
        ROUND(AVG(COALESCE((b.metadata->>'morale')::int, 80)), 1) AS avg_morale
    FROM public.blocks b
    LEFT JOIN public.profiles p ON p.id = b.owner_id
    WHERE b.owner_id IS NOT NULL
    GROUP BY b.owner_id, p.username, p.gang_name
    ORDER BY total_income DESC
    LIMIT limit_count;
$$;

-- ============================================================
-- ECONOMY SUMMARY RPC
-- ============================================================
CREATE OR REPLACE FUNCTION get_economy_summary(user_id UUID)
RETURNS TABLE (
    total_earned BIGINT,
    total_spent BIGINT,
    last_salary_paid TIMESTAMPTZ,
    weekly_salary_total BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT
        COALESCE(SUM(CASE WHEN el.amount > 0 THEN el.amount ELSE 0 END), 0) AS total_earned,
        COALESCE(SUM(CASE WHEN el.amount < 0 THEN ABS(el.amount) ELSE 0 END), 0) AS total_spent,
        (SELECT MAX(paid_at) FROM public.salary_records WHERE profile_id = user_id) AS last_salary_paid,
        COALESCE((SELECT SUM(weekly_salary) FROM public.gang_members WHERE owner_id = user_id AND status = 'active'), 0) AS weekly_salary_total
    FROM public.economy_logs el
    WHERE el.profile_id = user_id;
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gang_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.block_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.economy_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combat_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.npc_gangs ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Blocks: public read, owner write
CREATE POLICY "Blocks are publicly viewable" ON public.blocks FOR SELECT USING (true);
CREATE POLICY "Owners can update their blocks" ON public.blocks FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Authenticated users can claim blocks" ON public.blocks FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Gang members: private to owner
CREATE POLICY "Gang members private to owner" ON public.gang_members FOR ALL USING (auth.uid() = owner_id);

-- Block placements: owner of the block
CREATE POLICY "Block placements viewable by all" ON public.block_placements FOR SELECT USING (true);
CREATE POLICY "Block owners manage placements" ON public.block_placements FOR ALL
    USING (EXISTS (SELECT 1 FROM public.blocks WHERE id = block_id AND owner_id = auth.uid()));

-- Inventory: private to owner
CREATE POLICY "Inventory private to owner" ON public.player_inventory FOR ALL USING (auth.uid() = owner_id);

-- Economy logs: private to owner
CREATE POLICY "Economy logs private to owner" ON public.economy_logs FOR SELECT USING (auth.uid() = profile_id);

-- Salary records: private to owner
CREATE POLICY "Salary records private to owner" ON public.salary_records FOR SELECT USING (auth.uid() = profile_id);

-- Combat logs: visible to participants
CREATE POLICY "Combat logs visible to participants" ON public.combat_logs FOR SELECT
    USING (auth.uid() = attacker_id OR auth.uid() = defender_id);

-- Notifications: private to recipient
CREATE POLICY "Notifications private to recipient" ON public.notifications FOR ALL USING (auth.uid() = player_id);

-- Presence: public read
CREATE POLICY "Presence publicly viewable" ON public.presence FOR SELECT USING (true);
CREATE POLICY "Users manage own presence" ON public.presence FOR ALL USING (auth.uid() = player_id);

-- Drugs: public read (catalog)
CREATE POLICY "Drugs are publicly viewable" ON public.drugs FOR SELECT USING (true);

-- NPC gangs: public read
CREATE POLICY "NPC gangs are publicly viewable" ON public.npc_gangs FOR SELECT USING (true);

-- ============================================================
-- REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.blocks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.presence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.combat_logs;

-- ============================================================
-- SEED: BASE DRUGS
-- ============================================================
INSERT INTO public.drugs (name, street_name, rarity, base_price, profit_multiplier, heat_multiplier, od_risk, addiction_rate, is_craftable) VALUES
('Cannabis', 'Loud', 'common', 20, 1.0, 0.5, 5, 30, false),
('Cocaine', 'Soft', 'uncommon', 80, 1.5, 1.2, 15, 60, false),
('MDMA', 'Molly', 'uncommon', 60, 1.4, 1.0, 20, 45, false),
('Xanax', 'Bars', 'uncommon', 50, 1.3, 0.9, 30, 55, false),
('Percocet', 'Percs', 'uncommon', 70, 1.4, 1.1, 35, 65, false),
('Crack Cocaine', 'Hard', 'rare', 150, 2.0, 2.0, 55, 85, true),
('Methamphetamine', 'Ice', 'rare', 180, 2.2, 2.2, 60, 80, true),
('Fentanyl', 'Fetty', 'rare', 200, 2.5, 2.5, 85, 95, true),
('Purple Drank', 'Lean', 'legendary', 300, 3.0, 1.5, 40, 70, true),
('Blue Magic', 'Blue', 'mythic', 1000, 5.0, 2.0, 70, 75, true)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- SEED: NPC GANGS
-- ============================================================
INSERT INTO public.npc_gangs (name, faction, difficulty, aggression, wealth) VALUES
('The Scorpions', 'eastside', 2, 65, 50),
('Dead End Boys', 'westside', 1, 45, 30),
('South Side Reapers', 'southside', 3, 75, 70),
('The 400 Boyz', 'northside', 2, 60, 55),
('Grim Street Posse', 'downtown', 4, 85, 80)
ON CONFLICT (name) DO NOTHING;
