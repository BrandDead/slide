-- ============================================================
-- Migration 002: Block placements + block metadata column
-- Sprint: wire-morale-supabase-batch3
-- Run in Supabase SQL Editor or via supabase db push
-- ============================================================

-- ─── Add metadata JSONB column to blocks table ──────────────
ALTER TABLE blocks
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- ─── Block placements table ──────────────────────────────────
-- Stores which gang members are placed on which block zones.
-- One row per member per block.

CREATE TABLE IF NOT EXISTS block_placements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id        UUID NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  member_id       TEXT NOT NULL,          -- gang member ID (local or DB)
  member_name     TEXT NOT NULL,
  role            TEXT NOT NULL,          -- dealer | shooter | enforcer | lookout | driver | chemist | runner | boss
  grid_x          SMALLINT NOT NULL CHECK (grid_x BETWEEN 0 AND 7),
  grid_y          SMALLINT NOT NULL CHECK (grid_y BETWEEN 0 AND 7),
  zone_type       TEXT NOT NULL,          -- street | curb | sidewalk | storefront | alley | parking | rooftop
  income_per_tick INTEGER NOT NULL DEFAULT 0,
  exposure_risk   SMALLINT NOT NULL DEFAULT 50,
  level           SMALLINT NOT NULL DEFAULT 1,
  health          SMALLINT NOT NULL DEFAULT 100,
  portrait_url    TEXT,
  topdown_url     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Only one member per zone per block
  UNIQUE (block_id, grid_x, grid_y),
  -- Only one placement per member per block
  UNIQUE (block_id, member_id)
);

-- ─── Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_block_placements_block_id
  ON block_placements (block_id);

CREATE INDEX IF NOT EXISTS idx_block_placements_member_id
  ON block_placements (member_id);

-- ─── Auto-update updated_at ──────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_block_placements_updated_at ON block_placements;
CREATE TRIGGER set_block_placements_updated_at
  BEFORE UPDATE ON block_placements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Row Level Security ──────────────────────────────────────
ALTER TABLE block_placements ENABLE ROW LEVEL SECURITY;

-- Players can read placements on blocks they own
CREATE POLICY "Players can read own block placements"
  ON block_placements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM blocks
      WHERE blocks.id = block_placements.block_id
        AND blocks.owner_id = auth.uid()
    )
  );

-- Players can insert/update/delete placements on their own blocks
CREATE POLICY "Players can manage own block placements"
  ON block_placements FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM blocks
      WHERE blocks.id = block_placements.block_id
        AND blocks.owner_id = auth.uid()
    )
  );

-- ─── Realtime ────────────────────────────────────────────────
-- Enable realtime for live block updates
ALTER PUBLICATION supabase_realtime ADD TABLE block_placements;

-- ─── Comments ────────────────────────────────────────────────
COMMENT ON TABLE block_placements IS
  'Stores gang member placements on block zones. Each row represents one member on one zone of a block.';
COMMENT ON COLUMN block_placements.zone_type IS
  'Zone type from the 8x8 grid: street (highest risk/income) through alley (lowest risk/income)';
COMMENT ON COLUMN block_placements.income_per_tick IS
  'Calculated income per 30-second tick based on zone modifier and member level';
COMMENT ON COLUMN block_placements.exposure_risk IS
  'Percentage chance (0-100) of being hit during a drive-by based on zone position';
