-- ============================================================
-- DEALT/SLIDE - Migration 001: Initial Schema
-- PostgreSQL with PostGIS
-- Run order: auto-executed by docker-entrypoint-initdb.d
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_id UUID UNIQUE,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    level INTEGER DEFAULT 1 CHECK (level >= 1 AND level <= 100),
    experience BIGINT DEFAULT 0,
    cash BIGINT DEFAULT 5000,
    bank_balance BIGINT DEFAULT 0,
    reputation INTEGER DEFAULT 0,
    heat INTEGER DEFAULT 0 CHECK (heat >= 0 AND heat <= 100),
    gang_name VARCHAR(100) DEFAULT 'New Gang',
    gang_tag VARCHAR(10),
    gang_color VARCHAR(7) DEFAULT '#dc2626',
    gang_style VARCHAR(20) DEFAULT 'street',
    region VARCHAR(20) DEFAULT 'miami',
    is_online BOOLEAN DEFAULT false,
    last_active TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BLOCKS / TERRITORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    address VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    bounds_north DOUBLE PRECISION,
    bounds_south DOUBLE PRECISION,
    bounds_east DOUBLE PRECISION,
    bounds_west DOUBLE PRECISION,
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    gang_name VARCHAR(100),
    claimed_at TIMESTAMPTZ,
    block_type VARCHAR(20) DEFAULT 'residential',
    traffic_score DECIMAL(5,2) DEFAULT 0.5,
    danger_level INTEGER DEFAULT 30,
    heat_level DECIMAL(5,2) DEFAULT 0,
    last_raid_at TIMESTAMPTZ,
    raid_count INTEGER DEFAULT 0,
    income_per_hour DECIMAL(10,2) DEFAULT 100,
    last_income_collected TIMESTAMPTZ DEFAULT NOW(),
    grid_data JSONB DEFAULT '{}',
    backgrounds JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- GANG MEMBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS gang_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(100) NOT NULL,
    nickname VARCHAR(50),
    role VARCHAR(30) DEFAULT 'soldier' CHECK (role IN ('shooter','dealer','enforcer','lookout','driver','soldier','dog')),
    level INTEGER DEFAULT 1,
    experience INTEGER DEFAULT 0,
    health INTEGER DEFAULT 100,
    max_health INTEGER DEFAULT 100,
    loyalty INTEGER DEFAULT 60,
    morale INTEGER DEFAULT 70,
    respect INTEGER DEFAULT 50,
    accuracy INTEGER DEFAULT 50,
    toughness INTEGER DEFAULT 50,
    speed INTEGER DEFAULT 50,
    charisma INTEGER DEFAULT 50,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','injured','hospitalized','arrested','jailed','dead','missing','on_the_run')),
    assigned_block_id UUID REFERENCES blocks(id) ON DELETE SET NULL,
    position_x INTEGER,
    position_y INTEGER,
    kills INTEGER DEFAULT 0,
    arrests INTEGER DEFAULT 0,
    deals_completed INTEGER DEFAULT 0,
    money_earned BIGINT DEFAULT 0,
    avatar_url VARCHAR(500),
    recruited_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INVENTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    item_type VARCHAR(50) NOT NULL CHECK (item_type IN ('weapon','drug','vehicle','equipment','consumable')),
    item_name VARCHAR(100) NOT NULL,
    quantity INTEGER DEFAULT 1 CHECK (quantity >= 0),
    rarity VARCHAR(20) DEFAULT 'common',
    quality INTEGER DEFAULT 100,
    purity INTEGER,
    equipped BOOLEAN DEFAULT false,
    attributes JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TRANSACTIONS (ledger)
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    from_user_id UUID REFERENCES users(id),
    amount BIGINT NOT NULL,
    transaction_type VARCHAR(30) NOT NULL,
    description TEXT,
    item_type VARCHAR(50),
    item_name VARCHAR(100),
    quantity INTEGER,
    block_id UUID REFERENCES blocks(id),
    heat_generated INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- COMBAT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS combat_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attacker_id UUID REFERENCES users(id),
    defender_id UUID REFERENCES users(id),
    block_id UUID REFERENCES blocks(id),
    combat_type VARCHAR(20) NOT NULL,
    attacker_damage_dealt INTEGER DEFAULT 0,
    defender_damage_dealt INTEGER DEFAULT 0,
    outcome VARCHAR(20),
    cash_won BIGINT DEFAULT 0,
    cash_lost BIGINT DEFAULT 0,
    heat_generated INTEGER DEFAULT 0,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SLIDE BATTLES
-- ============================================================
CREATE TABLE IF NOT EXISTS slide_battles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attacker_id UUID REFERENCES users(id) NOT NULL,
    defender_id UUID REFERENCES users(id),
    block_id UUID REFERENCES blocks(id) NOT NULL,
    attacker_grid JSONB NOT NULL DEFAULT '{}',
    defender_grid JSONB NOT NULL DEFAULT '{}',
    current_turn UUID,
    turn_number INTEGER DEFAULT 0,
    winner_id UUID REFERENCES users(id),
    attacker_hits INTEGER DEFAULT 0,
    attacker_misses INTEGER DEFAULT 0,
    defender_hits INTEGER DEFAULT 0,
    defender_misses INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'placement',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

-- ============================================================
-- DEALT ENCOUNTERS
-- ============================================================
CREATE TABLE IF NOT EXISTS dealt_encounters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) NOT NULL,
    block_id UUID REFERENCES blocks(id),
    client_type VARCHAR(30) NOT NULL,
    client_name VARCHAR(100),
    drug_type VARCHAR(50),
    quantity INTEGER,
    price_offered BIGINT,
    action VARCHAR(20),
    outcome VARCHAR(30),
    money_change BIGINT DEFAULT 0,
    heat_change INTEGER DEFAULT 0,
    reputation_change INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DRIVEBY RUNS
-- ============================================================
CREATE TABLE IF NOT EXISTS driveby_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) NOT NULL,
    block_id UUID REFERENCES blocks(id),
    blocks_completed INTEGER DEFAULT 0,
    total_blocks INTEGER DEFAULT 10,
    gang_kills INTEGER DEFAULT 0,
    civilian_hits INTEGER DEFAULT 0,
    shots_fired INTEGER DEFAULT 0,
    shots_hit INTEGER DEFAULT 0,
    car_health_remaining INTEGER DEFAULT 0,
    money_earned BIGINT DEFAULT 0,
    outcome VARCHAR(20),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

-- ============================================================
-- ALCHEMY RECIPES
-- ============================================================
CREATE TABLE IF NOT EXISTS alchemy_recipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    ingredients JSONB NOT NULL,
    output_item VARCHAR(100) NOT NULL,
    output_quantity INTEGER DEFAULT 1,
    output_purity_bonus INTEGER DEFAULT 0,
    required_level INTEGER DEFAULT 1,
    difficulty INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_recipes (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    recipe_id UUID REFERENCES alchemy_recipes(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMPTZ DEFAULT NOW(),
    times_crafted INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, recipe_id)
);

-- ============================================================
-- POLICE RAIDS
-- ============================================================
CREATE TABLE IF NOT EXISTS police_raids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    block_id UUID REFERENCES blocks(id) NOT NULL,
    raid_intensity INTEGER DEFAULT 1,
    trigger_reason VARCHAR(50),
    participants JSONB DEFAULT '[]',
    arrests INTEGER DEFAULT 0,
    casualties INTEGER DEFAULT 0,
    confiscated_cash BIGINT DEFAULT 0,
    confiscated_items JSONB DEFAULT '[]',
    status VARCHAR(20) DEFAULT 'active',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    type VARCHAR(30) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT,
    related_block_id UUID REFERENCES blocks(id),
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- HEAT EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS heat_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    block_id UUID REFERENCES blocks(id),
    user_id UUID REFERENCES users(id),
    event_type VARCHAR(30) NOT NULL,
    intensity INTEGER NOT NULL DEFAULT 0,
    heat_before DECIMAL(5,2),
    heat_after DECIMAL(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SEED DATA: Default Alchemy Recipes
-- ============================================================
INSERT INTO alchemy_recipes (name, description, ingredients, output_item, output_quantity, required_level, difficulty) VALUES
('Basic Cut', 'Stretch your product with basic cutting agent', '[{"item_name": "cocaine", "quantity": 1}, {"item_name": "baking_soda", "quantity": 1}]', 'cut_cocaine', 2, 1, 1),
('Premium Blend', 'High quality product mix', '[{"item_name": "cocaine", "quantity": 2}, {"item_name": "caffeine", "quantity": 1}]', 'premium_cocaine', 2, 5, 3),
('Party Pack', 'Mixed pills for parties', '[{"item_name": "mdma", "quantity": 1}, {"item_name": "amphetamine", "quantity": 1}]', 'party_pills', 5, 3, 2),
('Blue Sky', 'Legendary pure product', '[{"item_name": "pseudoephedrine", "quantity": 3}, {"item_name": "red_phosphorus", "quantity": 1}, {"item_name": "iodine", "quantity": 1}]', 'blue_meth', 1, 10, 10)
ON CONFLICT DO NOTHING;

-- ============================================================
-- FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY['users','blocks','gang_members','inventory'])
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS update_%s_updated_at ON %s;
            CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON %s
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        ', t, t, t, t);
    END LOOP;
END;
$$;
