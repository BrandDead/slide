-- ============================================
-- DEALT/SLIDE Combat System - Additional Tables
-- Source: qwen3-coder:480b-cloud
-- ============================================

-- Combat units table (for detailed turn tracking)
CREATE TABLE IF NOT EXISTS combat_units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    combat_session_id UUID NOT NULL REFERENCES combat_logs(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES gang_members(id),
    is_attacker BOOLEAN NOT NULL,
    start_health INTEGER NOT NULL,
    end_health INTEGER NOT NULL,
    position_x INTEGER NOT NULL,
    position_y INTEGER NOT NULL,
    kills INTEGER DEFAULT 0,
    damage_dealt INTEGER DEFAULT 0,
    damage_taken INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_combat_units_session ON combat_units(combat_session_id);
CREATE INDEX IF NOT EXISTS idx_combat_units_member ON combat_units(member_id);

-- Combat turn logs
CREATE TABLE IF NOT EXISTS combat_turn_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    combat_session_id UUID NOT NULL REFERENCES combat_logs(id) ON DELETE CASCADE,
    turn_number INTEGER NOT NULL,
    active_player VARCHAR(20) NOT NULL,
    actions JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_combat_turn_logs_session ON combat_turn_logs(combat_session_id);
