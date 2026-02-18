-- ============================================================
-- SLIDE MVP - Additional Tables
-- Tables required for BlockStateEngine and gameplay MVP
-- ============================================================

-- ============================================================
-- GANG MEMBERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS gang_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Ownership
    gang_id UUID REFERENCES gangs(id) ON DELETE CASCADE,
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    
    -- Basic info
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('dealer', 'shooter', 'enforcer', 'canine', 'chemist', 'driver')),
    
    -- Stats
    health INTEGER DEFAULT 100 CHECK (health >= 0 AND health <= 100),
    max_health INTEGER DEFAULT 100,
    damage INTEGER DEFAULT 10,
    defense INTEGER DEFAULT 5,
    speed INTEGER DEFAULT 50 CHECK (speed >= 0 AND speed <= 100),
    loyalty INTEGER DEFAULT 75 CHECK (loyalty >= 0 AND loyalty <= 100),
    
    -- Skills (role-dependent)
    shooting_skill INTEGER DEFAULT 50 CHECK (shooting_skill >= 0 AND shooting_skill <= 100),
    dealing_skill INTEGER DEFAULT 50 CHECK (dealing_skill >= 0 AND dealing_skill <= 100),
    chemistry_skill INTEGER DEFAULT 50 CHECK (chemistry_skill >= 0 AND chemistry_skill <= 100),
    
    -- Experience
    level INTEGER DEFAULT 1,
    experience INTEGER DEFAULT 0,
    
    -- Current assignment
    current_block_id UUID REFERENCES blocks(id) ON DELETE SET NULL,
    position JSONB DEFAULT '{"x": 0, "y": 0}', -- Grid position on block
    
    -- Salary/costs
    weekly_salary INTEGER DEFAULT 500,
    
    -- Status
    status VARCHAR(20) DEFAULT 'idle' CHECK (status IN ('idle', 'assigned', 'injured', 'arrested', 'dead')),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gang_members_gang ON gang_members(gang_id);
CREATE INDEX idx_gang_members_owner ON gang_members(owner_id);
CREATE INDEX idx_gang_members_block ON gang_members(current_block_id);
CREATE INDEX idx_gang_members_status ON gang_members(status);

-- ============================================================
-- MEMBER LOADOUTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS member_loadouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    member_id UUID REFERENCES gang_members(id) ON DELETE CASCADE NOT NULL UNIQUE,
    
    -- Equipment slots
    weapon_id VARCHAR(50), -- References item catalog
    armor_id VARCHAR(50),
    accessory1_id VARCHAR(50),
    accessory2_id VARCHAR(50),
    
    -- Consumable items (medkits, etc.)
    items JSONB DEFAULT '[]', -- Array of item IDs
    
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_loadouts_member ON member_loadouts(member_id);

-- ============================================================
-- BLOCK SNAPSHOTS TABLE
-- For immutable combat/simulation state
-- ============================================================
CREATE TABLE IF NOT EXISTS block_snapshots (
    id VARCHAR(64) PRIMARY KEY, -- SHA256 hash
    
    block_id UUID REFERENCES blocks(id) ON DELETE CASCADE NOT NULL,
    version INTEGER NOT NULL,
    
    -- Complete snapshot data (JSONB for flexibility)
    snapshot_data JSONB NOT NULL,
    
    -- Quick access fields
    member_count INTEGER DEFAULT 0,
    defense_rating DECIMAL(10,2) DEFAULT 0,
    income_rate DECIMAL(10,2) DEFAULT 0,
    heat_level DECIMAL(5,2) DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_snapshots_block ON block_snapshots(block_id, created_at DESC);
CREATE INDEX idx_snapshots_version ON block_snapshots(block_id, version DESC);

-- ============================================================
-- COMBAT SESSIONS TABLE
-- Tracks active SLIDE combat sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS combat_sessions (
    id VARCHAR(100) PRIMARY KEY,
    
    -- Participants
    attacker_gang_id UUID REFERENCES gangs(id),
    attacker_user_id UUID REFERENCES users(id) NOT NULL,
    target_block_id UUID REFERENCES blocks(id) NOT NULL,
    defender_user_id UUID REFERENCES users(id),
    
    -- Snapshots
    target_snapshot_id VARCHAR(64) REFERENCES block_snapshots(id) NOT NULL,
    attacker_snapshot_id VARCHAR(64), -- Optional: snapshot of attacker's setup
    
    -- Combat state
    current_turn INTEGER DEFAULT 0,
    max_turns INTEGER DEFAULT 20,
    
    -- HP tracking (JSONB for flexibility)
    attacker_hp JSONB DEFAULT '{}', -- {member_id: hp}
    defender_hp JSONB DEFAULT '{}',
    
    -- Combat log
    combat_log JSONB DEFAULT '[]', -- Array of turn events
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'attacker_victory', 'defender_victory', 'draw', 'abandoned')),
    winner VARCHAR(50),
    
    -- Seed for deterministic RNG
    seed VARCHAR(64) NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_combat_sessions_attacker ON combat_sessions(attacker_user_id, created_at DESC);
CREATE INDEX idx_combat_sessions_defender ON combat_sessions(defender_user_id, created_at DESC);
CREATE INDEX idx_combat_sessions_block ON combat_sessions(target_block_id, created_at DESC);
CREATE INDEX idx_combat_sessions_status ON combat_sessions(status) WHERE status = 'active';

-- ============================================================
-- DRIVEBY SESSIONS TABLE
-- Tracks drive-by shooting sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS driveby_sessions (
    id VARCHAR(100) PRIMARY KEY,
    
    -- Participants
    user_id UUID REFERENCES users(id) NOT NULL,
    gang_id UUID REFERENCES gangs(id),
    target_block_id UUID REFERENCES blocks(id) NOT NULL,
    target_snapshot_id VARCHAR(64) REFERENCES block_snapshots(id) NOT NULL,
    
    -- Vehicle
    vehicle_type VARCHAR(50),
    vehicle_speed INTEGER DEFAULT 50,
    vehicle_armor INTEGER DEFAULT 50,
    vehicle_hp INTEGER DEFAULT 100,
    
    -- Shooters
    shooter_ids JSONB DEFAULT '[]', -- Array of member IDs
    
    -- Session state
    current_phase VARCHAR(20) DEFAULT 'approach' CHECK (current_phase IN ('approach', 'shooting', 'escape', 'completed')),
    shots_fired INTEGER DEFAULT 0,
    max_shots INTEGER DEFAULT 9,
    
    -- Results
    hits JSONB DEFAULT '[]',
    casualties JSONB DEFAULT '[]',
    heat_gained INTEGER DEFAULT 0,
    money_gained INTEGER DEFAULT 0,
    
    -- Seed for deterministic RNG
    seed VARCHAR(64) NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_driveby_sessions_user ON driveby_sessions(user_id, created_at DESC);
CREATE INDEX idx_driveby_sessions_block ON driveby_sessions(target_block_id, created_at DESC);
CREATE INDEX idx_driveby_sessions_phase ON driveby_sessions(current_phase) WHERE current_phase NOT IN ('completed');

-- ============================================================
-- WORLD TICK LOG TABLE
-- Tracks world simulation ticks for debugging
-- ============================================================
CREATE TABLE IF NOT EXISTS world_tick_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    tick_duration_minutes INTEGER NOT NULL,
    blocks_processed INTEGER DEFAULT 0,
    events_generated INTEGER DEFAULT 0,
    
    -- Summary stats
    total_income_generated BIGINT DEFAULT 0,
    total_heat_decay DECIMAL(10,2) DEFAULT 0,
    
    -- Event log
    events JSONB DEFAULT '[]',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_world_tick_log_created ON world_tick_log(created_at DESC);

-- ============================================================
-- ITEM CATALOG TABLE
-- Underground market items
-- ============================================================
CREATE TABLE IF NOT EXISTS item_catalog (
    id VARCHAR(50) PRIMARY KEY,
    
    name VARCHAR(100) NOT NULL,
    category VARCHAR(30) NOT NULL CHECK (category IN ('weapon', 'armor', 'consumable', 'tool', 'vehicle')),
    
    -- Stats
    damage INTEGER DEFAULT 0,
    defense INTEGER DEFAULT 0,
    healing INTEGER DEFAULT 0,
    
    -- Metadata
    description TEXT,
    rarity VARCHAR(20) DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
    
    -- Economy
    base_price INTEGER NOT NULL,
    
    -- Availability
    available BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_item_catalog_category ON item_catalog(category);
CREATE INDEX idx_item_catalog_available ON item_catalog(available) WHERE available = true;

-- ============================================================
-- USER INVENTORY TABLE (player-owned items)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    item_id VARCHAR(50) NOT NULL, -- References item_catalog
    
    quantity INTEGER DEFAULT 1 CHECK (quantity >= 0),
    
    -- State
    equipped_on_member_id UUID REFERENCES gang_members(id) ON DELETE SET NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_inventory_user ON user_inventory(user_id);
CREATE INDEX idx_user_inventory_item ON user_inventory(user_id, item_id);
CREATE INDEX idx_user_inventory_equipped ON user_inventory(equipped_on_member_id) WHERE equipped_on_member_id IS NOT NULL;

-- ============================================================
-- SHOEBOX LEDGER TABLE
-- Transaction log for player's cash box
-- ============================================================
CREATE TABLE IF NOT EXISTS shoebox_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    
    -- Transaction
    amount BIGINT NOT NULL, -- Positive = income, Negative = expense
    balance_after BIGINT NOT NULL,
    
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN (
        'passive_income', 'combat_win', 'combat_loss', 'item_purchase', 
        'member_salary', 'block_claim', 'driveby_loot', 'dealt_sale',
        'police_fine', 'medical_bill', 'initial_balance'
    )),
    
    -- Metadata
    description TEXT,
    related_block_id UUID REFERENCES blocks(id),
    related_member_id UUID REFERENCES gang_members(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shoebox_user ON shoebox_ledger(user_id, created_at DESC);
CREATE INDEX idx_shoebox_type ON shoebox_ledger(user_id, transaction_type);

-- ============================================================
-- LOYALTY EVENTS TABLE
-- Track member loyalty changes
-- ============================================================
CREATE TABLE IF NOT EXISTS loyalty_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    member_id UUID REFERENCES gang_members(id) ON DELETE CASCADE NOT NULL,
    
    event_type VARCHAR(30) NOT NULL CHECK (event_type IN (
        'salary_paid', 'salary_missed', 'victory', 'defeat', 'injury', 'promotion', 'decay'
    )),
    
    loyalty_before INTEGER,
    loyalty_after INTEGER,
    loyalty_change INTEGER NOT NULL,
    
    description TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_loyalty_events_member ON loyalty_events(member_id, created_at DESC);

-- ============================================================
-- NPC GANGS TABLE
-- AI-controlled enemy gangs
-- ============================================================
CREATE TABLE IF NOT EXISTS npc_gangs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    name VARCHAR(100) UNIQUE NOT NULL,
    faction VARCHAR(30),
    
    -- AI difficulty
    difficulty INTEGER DEFAULT 1 CHECK (difficulty >= 1 AND difficulty <= 5),
    
    -- Territory
    territory_count INTEGER DEFAULT 1,
    
    -- Stats
    aggression INTEGER DEFAULT 50 CHECK (aggression >= 0 AND aggression <= 100),
    wealth INTEGER DEFAULT 50 CHECK (wealth >= 0 AND wealth <= 100),
    
    -- Spawn blocks (JSONB array of block IDs)
    controlled_blocks JSONB DEFAULT '[]',
    
    active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_npc_gangs_active ON npc_gangs(active) WHERE active = true;
CREATE INDEX idx_npc_gangs_difficulty ON npc_gangs(difficulty);

-- ============================================================
-- TRIGGERS FOR NEW TABLES
-- ============================================================

CREATE TRIGGER update_gang_members_updated_at BEFORE UPDATE ON gang_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_member_loadouts_updated_at BEFORE UPDATE ON member_loadouts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_inventory_updated_at BEFORE UPDATE ON user_inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SEED DATA - Default Items
-- ============================================================

INSERT INTO item_catalog (id, name, category, damage, defense, base_price, description, rarity) VALUES
('pistol-9mm', '9mm Pistol', 'weapon', 15, 0, 500, 'Basic handgun', 'common'),
('ak47', 'AK-47', 'weapon', 35, 0, 2500, 'Assault rifle', 'uncommon'),
('shotgun', 'Pump Shotgun', 'weapon', 40, 0, 1800, 'Close-range devastation', 'uncommon'),
('sniper-rifle', 'Sniper Rifle', 'weapon', 60, 0, 5000, 'Long-range precision', 'rare'),
('bulletproof-vest', 'Bulletproof Vest', 'armor', 0, 10, 800, 'Basic body armor', 'common'),
('tactical-armor', 'Tactical Armor', 'armor', 0, 25, 3000, 'Military-grade protection', 'rare'),
('medkit', 'Medical Kit', 'consumable', 0, 0, 200, 'Restores 50 HP', 'common'),
('lockpick', 'Lockpick Set', 'tool', 0, 0, 150, 'Bypass security', 'common'),
('night-vision', 'Night Vision Goggles', 'tool', 0, 0, 1200, '+20% accuracy at night', 'uncommon'),
('sedan', 'Sedan', 'vehicle', 0, 0, 5000, 'Basic getaway car', 'common'),
('sports-car', 'Sports Car', 'vehicle', 0, 0, 25000, 'Fast and flashy', 'rare')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- VIEWS
-- ============================================================

-- View for block with members
CREATE VIEW blocks_with_members AS
SELECT 
    b.*,
    COUNT(gm.id) as member_count,
    SUM(CASE WHEN gm.role = 'dealer' THEN 1 ELSE 0 END) as dealer_count,
    SUM(CASE WHEN gm.role = 'shooter' THEN 1 ELSE 0 END) as shooter_count,
    SUM(CASE WHEN gm.role = 'enforcer' THEN 1 ELSE 0 END) as enforcer_count
FROM blocks b
LEFT JOIN gang_members gm ON gm.current_block_id = b.id AND gm.status = 'assigned'
GROUP BY b.id;

-- View for user assets
CREATE VIEW user_assets AS
SELECT 
    u.id as user_id,
    u.username,
    u.cash,
    COUNT(DISTINCT b.id) as blocks_owned,
    COUNT(DISTINCT gm.id) as members_owned,
    COUNT(DISTINCT ui.id) as items_owned,
    SUM(b.income_per_hour) as total_income_rate
FROM users u
LEFT JOIN blocks b ON b.owner_id = u.id
LEFT JOIN gang_members gm ON gm.owner_id = u.id AND gm.status != 'dead'
LEFT JOIN user_inventory ui ON ui.user_id = u.id
GROUP BY u.id, u.username, u.cash;
