-- ============================================================
-- DEALT/SLIDE - Complete Database Schema
-- PostgreSQL with PostGIS for geospatial queries
-- Integrated from DeepSeek-V3.1:671B
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- For text search

-- ============================================================
-- USERS TABLE
-- ============================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_id UUID UNIQUE NOT NULL, -- Links to Supabase Auth
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    
    -- Player stats
    level INTEGER DEFAULT 1 CHECK (level >= 1 AND level <= 100),
    experience BIGINT DEFAULT 0,
    cash BIGINT DEFAULT 10000,
    reputation INTEGER DEFAULT 50 CHECK (reputation >= 0 AND reputation <= 100),
    heat INTEGER DEFAULT 0 CHECK (heat >= 0 AND heat <= 100),
    
    -- Gang affiliation
    faction VARCHAR(30) CHECK (faction IN ('bloods', 'crips', 'cartel', 'mafia', 'yakuza', 'independent')),
    gang_id UUID,
    gang_rank VARCHAR(20) DEFAULT 'soldier',
    
    -- Location
    last_known_position GEOMETRY(POINT, 4326),
    home_block_id UUID,
    
    -- Activity tracking
    is_online BOOLEAN DEFAULT false,
    last_active TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_position ON users USING GIST(last_known_position);
CREATE INDEX idx_users_gang ON users(gang_id);
CREATE INDEX idx_users_online ON users(is_online) WHERE is_online = true;

-- ============================================================
-- BLOCKS / TERRITORIES TABLE
-- ============================================================
CREATE TABLE blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Location data
    address VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    coordinates GEOMETRY(POLYGON, 4326) NOT NULL,
    center_point GEOMETRY(POINT, 4326) NOT NULL,
    geohash VARCHAR(12), -- For efficient proximity queries
    
    -- Ownership
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    gang_id UUID,
    claimed_at TIMESTAMPTZ,
    
    -- Block attributes
    block_type VARCHAR(20) DEFAULT 'residential' CHECK (block_type IN ('residential', 'commercial', 'industrial', 'downtown', 'projects')),
    traffic_level INTEGER DEFAULT 50 CHECK (traffic_level >= 0 AND traffic_level <= 100),
    danger_level INTEGER DEFAULT 30 CHECK (danger_level >= 0 AND danger_level <= 100),
    
    -- Heat system
    current_heat DECIMAL(5,2) DEFAULT 0,
    max_heat DECIMAL(5,2) DEFAULT 100,
    last_raid_at TIMESTAMPTZ,
    raid_count INTEGER DEFAULT 0,
    
    -- Defense
    defense_units INTEGER DEFAULT 0,
    fortification_level INTEGER DEFAULT 0,
    
    -- Income
    income_per_hour DECIMAL(10,2) DEFAULT 100,
    last_income_collected TIMESTAMPTZ DEFAULT NOW(),
    
    -- Asset generation
    asset_url VARCHAR(500), -- Cached Banana Nano generated image
    asset_hash VARCHAR(64), -- For deduplication
    asset_generated_at TIMESTAMPTZ,
    
    -- Grid data for SLIDE mode
    grid_data JSONB DEFAULT '{}', -- Stores unit placements
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_blocks_coordinates ON blocks USING GIST(coordinates);
CREATE INDEX idx_blocks_center ON blocks USING GIST(center_point);
CREATE INDEX idx_blocks_owner ON blocks(owner_id);
CREATE INDEX idx_blocks_city ON blocks(city);
CREATE INDEX idx_blocks_geohash ON blocks(geohash);
CREATE INDEX idx_blocks_heat ON blocks(current_heat) WHERE current_heat > 50;

-- ============================================================
-- INVENTORY / ITEMS TABLE
-- ============================================================
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    
    item_type VARCHAR(50) NOT NULL CHECK (item_type IN ('weapon', 'drug', 'vehicle', 'equipment', 'consumable')),
    item_name VARCHAR(100) NOT NULL,
    quantity INTEGER DEFAULT 1 CHECK (quantity >= 0),
    
    -- Item attributes
    rarity VARCHAR(20) DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
    quality INTEGER DEFAULT 100 CHECK (quality >= 0 AND quality <= 100),
    attributes JSONB DEFAULT '{}',
    
    -- Drug-specific
    purity INTEGER CHECK (purity >= 0 AND purity <= 100),
    
    -- State
    equipped BOOLEAN DEFAULT false,
    locked BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inventory_user ON inventory(user_id);
CREATE INDEX idx_inventory_type ON inventory(user_id, item_type);
CREATE INDEX idx_inventory_equipped ON inventory(user_id) WHERE equipped = true;

-- ============================================================
-- COMBAT LOGS TABLE
-- ============================================================
CREATE TABLE combat_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Participants
    attacker_id UUID REFERENCES users(id) NOT NULL,
    defender_id UUID REFERENCES users(id),
    block_id UUID REFERENCES blocks(id),
    
    -- Combat details
    combat_type VARCHAR(20) NOT NULL CHECK (combat_type IN ('drive-by', 'slide', 'dealt', 'raid', 'police')),
    
    -- Outcomes
    attacker_damage_dealt INTEGER DEFAULT 0,
    defender_damage_dealt INTEGER DEFAULT 0,
    attacker_health_after INTEGER,
    defender_health_after INTEGER,
    
    outcome VARCHAR(20) CHECK (outcome IN ('attacker_win', 'defender_win', 'draw', 'flee', 'interrupted')),
    
    -- Rewards/Penalties
    cash_won BIGINT DEFAULT 0,
    cash_lost BIGINT DEFAULT 0,
    reputation_change INTEGER DEFAULT 0,
    heat_generated INTEGER DEFAULT 0,
    
    -- Details
    weapons_used JSONB DEFAULT '[]',
    duration_seconds INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_combat_attacker ON combat_logs(attacker_id, created_at DESC);
CREATE INDEX idx_combat_defender ON combat_logs(defender_id, created_at DESC);
CREATE INDEX idx_combat_block ON combat_logs(block_id, created_at DESC);
CREATE INDEX idx_combat_type ON combat_logs(combat_type, created_at DESC);

-- ============================================================
-- TRANSACTIONS TABLE (Drug deals, payments, etc.)
-- ============================================================
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Participants
    from_user_id UUID REFERENCES users(id),
    to_user_id UUID REFERENCES users(id) NOT NULL,
    
    -- Transaction details
    amount BIGINT NOT NULL,
    transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN (
        'drug_sale', 'drug_purchase', 'territory_income', 'protection_money',
        'weapon_purchase', 'healing', 'bribe', 'robbery', 'deal_payment'
    )),
    
    -- Item details (if applicable)
    item_type VARCHAR(50),
    item_name VARCHAR(100),
    quantity INTEGER,
    
    -- Location
    block_id UUID REFERENCES blocks(id),
    
    -- Consequences
    heat_generated INTEGER DEFAULT 0,
    
    -- Status
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'reversed')),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_to ON transactions(to_user_id, created_at DESC);
CREATE INDEX idx_transactions_from ON transactions(from_user_id, created_at DESC);
CREATE INDEX idx_transactions_type ON transactions(transaction_type, created_at DESC);
CREATE INDEX idx_transactions_block ON transactions(block_id);

-- ============================================================
-- POLICE RAIDS TABLE
-- ============================================================
CREATE TABLE police_raids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    block_id UUID REFERENCES blocks(id) NOT NULL,
    
    -- Raid details
    raid_intensity INTEGER DEFAULT 1 CHECK (raid_intensity >= 1 AND raid_intensity <= 5),
    trigger_reason VARCHAR(50) CHECK (trigger_reason IN ('high_heat', 'civilian_casualties', 'snitch', 'random')),
    
    -- Participants caught
    participants JSONB DEFAULT '[]',
    
    -- Outcomes
    arrests INTEGER DEFAULT 0,
    casualties INTEGER DEFAULT 0,
    confiscated_cash BIGINT DEFAULT 0,
    confiscated_items JSONB DEFAULT '[]',
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'escaped')),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

CREATE INDEX idx_raids_block ON police_raids(block_id, started_at DESC);
CREATE INDEX idx_raids_active ON police_raids(status) WHERE status = 'active';

-- ============================================================
-- DEALT MODE - CLIENT ENCOUNTERS
-- ============================================================
CREATE TABLE dealt_encounters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    user_id UUID REFERENCES users(id) NOT NULL,
    block_id UUID REFERENCES blocks(id),
    
    -- Client details
    client_type VARCHAR(30) NOT NULL,
    client_name VARCHAR(100),
    
    -- Deal details
    drug_type VARCHAR(50),
    quantity INTEGER,
    price_offered BIGINT,
    
    -- Outcome
    action VARCHAR(20) CHECK (action IN ('accept', 'reject', 'pass')),
    outcome VARCHAR(30) CHECK (outcome IN ('success', 'bust', 'robbery', 'snitch', 'overdose')),
    
    -- Results
    money_change BIGINT DEFAULT 0,
    heat_change INTEGER DEFAULT 0,
    reputation_change INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dealt_user ON dealt_encounters(user_id, created_at DESC);
CREATE INDEX idx_dealt_outcome ON dealt_encounters(outcome);

-- ============================================================
-- SLIDE MODE - BATTLESHIP COMBATS
-- ============================================================
CREATE TABLE slide_battles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Participants
    attacker_id UUID REFERENCES users(id) NOT NULL,
    defender_id UUID REFERENCES users(id),
    block_id UUID REFERENCES blocks(id) NOT NULL,
    
    -- Game state
    attacker_grid JSONB NOT NULL, -- Unit placements
    defender_grid JSONB NOT NULL,
    current_turn UUID, -- Which player's turn
    turn_number INTEGER DEFAULT 0,
    
    -- Outcome
    winner_id UUID REFERENCES users(id),
    loser_id UUID REFERENCES users(id),
    
    -- Stats
    attacker_hits INTEGER DEFAULT 0,
    attacker_misses INTEGER DEFAULT 0,
    defender_hits INTEGER DEFAULT 0,
    defender_misses INTEGER DEFAULT 0,
    
    -- Rewards
    territory_transferred BOOLEAN DEFAULT false,
    cash_prize BIGINT DEFAULT 0,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('placement', 'active', 'completed', 'abandoned')),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

CREATE INDEX idx_slide_attacker ON slide_battles(attacker_id, started_at DESC);
CREATE INDEX idx_slide_defender ON slide_battles(defender_id, started_at DESC);
CREATE INDEX idx_slide_block ON slide_battles(block_id);
CREATE INDEX idx_slide_active ON slide_battles(status) WHERE status IN ('placement', 'active');

-- ============================================================
-- DRIVE-BY MODE - SHOOTING RUNS
-- ============================================================
CREATE TABLE driveby_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    user_id UUID REFERENCES users(id) NOT NULL,
    
    -- Blocks traversed
    blocks_completed INTEGER DEFAULT 0,
    total_blocks INTEGER DEFAULT 10,
    
    -- Combat stats
    gang_kills INTEGER DEFAULT 0,
    civilian_hits INTEGER DEFAULT 0,
    leader_kills INTEGER DEFAULT 0,
    shots_fired INTEGER DEFAULT 0,
    shots_hit INTEGER DEFAULT 0,
    
    -- Results
    car_health_remaining INTEGER DEFAULT 0,
    final_heat INTEGER DEFAULT 0,
    money_earned BIGINT DEFAULT 0,
    
    -- Outcome
    outcome VARCHAR(20) CHECK (outcome IN ('victory', 'destroyed', 'raided', 'abandoned')),
    
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

CREATE INDEX idx_driveby_user ON driveby_runs(user_id, started_at DESC);

-- ============================================================
-- ALCHEMY RECIPES
-- ============================================================
CREATE TABLE alchemy_recipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Ingredients (JSON array of {item_name, quantity})
    ingredients JSONB NOT NULL,
    
    -- Output
    output_item VARCHAR(100) NOT NULL,
    output_quantity INTEGER DEFAULT 1,
    output_purity_bonus INTEGER DEFAULT 0,
    
    -- Requirements
    required_level INTEGER DEFAULT 1,
    difficulty INTEGER DEFAULT 1 CHECK (difficulty >= 1 AND difficulty <= 10),
    
    -- Unlock status per user stored in user_recipes
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_recipes (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    recipe_id UUID REFERENCES alchemy_recipes(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMPTZ DEFAULT NOW(),
    times_crafted INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, recipe_id)
);

-- ============================================================
-- GANGS / CREWS
-- ============================================================
CREATE TABLE gangs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    name VARCHAR(100) UNIQUE NOT NULL,
    tag VARCHAR(10) UNIQUE NOT NULL, -- Short tag like [BLD], [CRP]
    
    leader_id UUID REFERENCES users(id),
    
    -- Stats
    member_count INTEGER DEFAULT 1,
    territory_count INTEGER DEFAULT 0,
    total_cash BIGINT DEFAULT 0,
    reputation INTEGER DEFAULT 50,
    
    -- Settings
    color_primary VARCHAR(7) DEFAULT '#ff0000', -- Hex color
    color_secondary VARCHAR(7) DEFAULT '#000000',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gangs_leader ON gangs(leader_id);

-- Add foreign key for gang_id in users
ALTER TABLE users ADD CONSTRAINT fk_user_gang FOREIGN KEY (gang_id) REFERENCES gangs(id) ON DELETE SET NULL;
ALTER TABLE blocks ADD CONSTRAINT fk_block_gang FOREIGN KEY (gang_id) REFERENCES gangs(id) ON DELETE SET NULL;

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    
    type VARCHAR(30) NOT NULL CHECK (type IN ('attack', 'income', 'raid', 'message', 'achievement', 'system')),
    title VARCHAR(200) NOT NULL,
    message TEXT,
    
    -- Related entities
    related_user_id UUID REFERENCES users(id),
    related_block_id UUID REFERENCES blocks(id),
    
    -- Status
    read BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE read = false;

-- ============================================================
-- HEAT EVENTS (for decay calculation)
-- ============================================================
CREATE TABLE heat_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    block_id UUID REFERENCES blocks(id) NOT NULL,
    user_id UUID REFERENCES users(id),
    
    event_type VARCHAR(30) NOT NULL CHECK (event_type IN ('combat', 'drug_deal', 'civilian_casualty', 'police_raid', 'decay')),
    intensity INTEGER NOT NULL,
    heat_before DECIMAL(5,2),
    heat_after DECIMAL(5,2),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_heat_events_block ON heat_events(block_id, created_at DESC);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Function to calculate income for a block
CREATE OR REPLACE FUNCTION calculate_block_income(p_block_id UUID)
RETURNS DECIMAL AS $$
DECLARE
    v_income DECIMAL;
    v_traffic INTEGER;
    v_fortification INTEGER;
BEGIN
    SELECT traffic_level, fortification_level INTO v_traffic, v_fortification
    FROM blocks WHERE id = p_block_id;
    
    v_income := 100 + (v_traffic * 2) + (v_fortification * 10);
    RETURN v_income;
END;
$$ LANGUAGE plpgsql;

-- Function to decay heat over time
CREATE OR REPLACE FUNCTION decay_block_heat()
RETURNS void AS $$
BEGIN
    UPDATE blocks 
    SET current_heat = GREATEST(0, current_heat * 0.95),
        updated_at = NOW()
    WHERE current_heat > 0;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blocks_updated_at BEFORE UPDATE ON blocks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- INITIAL DATA - Default Recipes
-- ============================================================
INSERT INTO alchemy_recipes (name, description, ingredients, output_item, output_quantity, required_level, difficulty) VALUES
('Basic Cut', 'Stretch your product with basic cutting agent', '[{"item_name": "cocaine", "quantity": 1}, {"item_name": "baking_soda", "quantity": 1}]', 'cut_cocaine', 2, 1, 1),
('Premium Blend', 'High quality product mix', '[{"item_name": "cocaine", "quantity": 2}, {"item_name": "caffeine", "quantity": 1}]', 'premium_cocaine', 2, 5, 3),
('Party Pack', 'Mixed pills for parties', '[{"item_name": "mdma", "quantity": 1}, {"item_name": "amphetamine", "quantity": 1}]', 'party_pills', 5, 3, 2),
('Blue Sky', 'Legendary pure product', '[{"item_name": "pseudoephedrine", "quantity": 3}, {"item_name": "red_phosphorus", "quantity": 1}, {"item_name": "iodine", "quantity": 1}]', 'blue_meth', 1, 10, 10);

-- ============================================================
-- VIEWS
-- ============================================================

-- Leaderboard view
CREATE VIEW leaderboard AS
SELECT 
    u.id,
    u.username,
    u.level,
    u.cash,
    u.reputation,
    g.name as gang_name,
    g.tag as gang_tag,
    COUNT(DISTINCT b.id) as territories_owned,
    COUNT(DISTINCT cl.id) FILTER (WHERE cl.outcome = 'attacker_win') as battles_won
FROM users u
LEFT JOIN gangs g ON u.gang_id = g.id
LEFT JOIN blocks b ON b.owner_id = u.id
LEFT JOIN combat_logs cl ON cl.attacker_id = u.id
GROUP BY u.id, u.username, u.level, u.cash, u.reputation, g.name, g.tag
ORDER BY u.reputation DESC, u.cash DESC;

-- Active blocks view (with heat > 0)
CREATE VIEW active_blocks AS
SELECT 
    b.*,
    u.username as owner_name,
    g.name as gang_name
FROM blocks b
LEFT JOIN users u ON b.owner_id = u.id
LEFT JOIN gangs g ON b.gang_id = g.id
WHERE b.current_heat > 0 OR b.owner_id IS NOT NULL;
