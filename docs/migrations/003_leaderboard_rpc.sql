-- ============================================================
-- Migration 003: Leaderboard RPC function
-- Sprint: mobile-leaderboard-onboarding-batch4
-- Run in Supabase SQL Editor
-- ============================================================

-- ─── Leaderboard function ────────────────────────────────────
-- Aggregates block data per player and returns ranked results.
-- Called from frontend via supabase.rpc('get_leaderboard').

CREATE OR REPLACE FUNCTION get_leaderboard(limit_count INT DEFAULT 50)
RETURNS TABLE (
  rank            BIGINT,
  owner_id        UUID,
  username        TEXT,
  gang_name       TEXT,
  total_blocks    BIGINT,
  total_income    BIGINT,
  max_heat        INT,
  total_morale    INT,
  avg_morale      NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    ROW_NUMBER() OVER (ORDER BY SUM(b.base_income) DESC) AS rank,
    b.owner_id,
    p.username,
    p.gang_name,
    COUNT(b.id)                                           AS total_blocks,
    SUM(b.base_income)                                    AS total_income,
    MAX(b.block_heat)                                     AS max_heat,
    SUM(COALESCE((b.metadata->>'morale')::int, 80))       AS total_morale,
    ROUND(AVG(COALESCE((b.metadata->>'morale')::int, 80)), 1) AS avg_morale
  FROM blocks b
  LEFT JOIN profiles p ON p.id = b.owner_id
  WHERE b.owner_id IS NOT NULL
  GROUP BY b.owner_id, p.username, p.gang_name
  ORDER BY total_income DESC
  LIMIT limit_count;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_leaderboard(INT) TO authenticated;

-- ─── Block stats view ────────────────────────────────────────
-- Convenience view for per-block stats with owner info.

CREATE OR REPLACE VIEW block_stats_view AS
SELECT
  b.id,
  b.address,
  b.owner_id,
  p.username,
  p.gang_name,
  b.block_heat,
  b.base_income,
  COALESCE((b.metadata->>'morale')::int, 80) AS morale,
  COALESCE((b.metadata->>'pendingIncome')::int, 0) AS pending_income
FROM blocks b
LEFT JOIN profiles p ON p.id = b.owner_id;

-- Allow authenticated users to read the view
GRANT SELECT ON block_stats_view TO authenticated;
