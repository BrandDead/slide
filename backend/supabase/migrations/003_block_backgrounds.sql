-- ============================================================
-- SLIDE MVP - Phase 7: Block Backgrounds + Grid Anchors
-- Stores satellite/street-view image URLs and 8x8 grid lat/lon anchors
-- generated after a block is claimed.
-- ============================================================

-- ============================================================
-- BLOCK BACKGROUNDS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS block_backgrounds (
    block_id UUID PRIMARY KEY REFERENCES blocks(id) ON DELETE CASCADE,

    -- Mapbox static satellite image (top-down view)
    topdown_url TEXT,

    -- Google Street View static images (4 cardinal headings)
    -- Only populated when GOOGLE_MAPS_API_KEY is set and ENABLE_STREET_VIEW=true
    street_n_url TEXT,
    street_e_url TEXT,
    street_s_url TEXT,
    street_w_url TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_block_backgrounds_block ON block_backgrounds(block_id);

CREATE TRIGGER update_block_backgrounds_updated_at
    BEFORE UPDATE ON block_backgrounds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- BLOCK GRID ANCHORS TABLE
-- Maps each tile in the 8x8 game grid to a real-world lat/lon.
-- anchors_json shape: { "0,0": {"lat": ..., "lng": ...}, "0,1": ..., ... }
-- ============================================================
CREATE TABLE IF NOT EXISTS block_grid_anchors (
    block_id UUID PRIMARY KEY REFERENCES blocks(id) ON DELETE CASCADE,

    grid_size INTEGER DEFAULT 8,   -- Always 8 for SLIDE MVP
    anchors_json JSONB NOT NULL,   -- Keyed by "x,y" → {lat, lng}

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_block_grid_anchors_block ON block_grid_anchors(block_id);
