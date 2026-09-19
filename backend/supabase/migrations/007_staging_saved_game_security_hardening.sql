-- ============================================================
-- DEALT/SLIDE — Staging Saved-Game Security Hardening
--
-- Additive security baseline for the isolated non-production world-proof
-- target. This migration closes the staging advisor's public-schema RLS and
-- role-scope findings without rewriting prior migration history.
--
-- Browser clients retain authenticated read access to the data necessary to
-- render the game. Durable player/world mutations remain service-role or
-- narrowly validated RPC responsibilities until the saved-game API slice
-- explicitly exposes additional ownership-checked commands.
-- ============================================================

-- ─── Game-owned exposed tables: service-only ─────────────────
-- These tables contain supporting map context, operational tick receipts, or
-- payment-event evidence. No browser route reads or writes them directly.
--
-- `public.spatial_ref_sys` is PostGIS extension-owned. Do not enable RLS or
-- revoke its extension-managed grants here: PostGIS helper functions may need
-- it and moving the extension out of `public` requires a dedicated compatibility
-- migration. Its advisor warning remains an explicit follow-up, not a blind fix.
ALTER TABLE public.block_backgrounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.block_grid_anchors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.world_ticks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.block_backgrounds FROM anon, authenticated;
REVOKE ALL ON TABLE public.block_grid_anchors FROM anon, authenticated;
REVOKE ALL ON TABLE public.world_ticks FROM anon, authenticated;
REVOKE ALL ON TABLE public.payment_events FROM anon, authenticated;

CREATE POLICY "Service role manages block_backgrounds"
    ON public.block_backgrounds FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "Service role manages block_grid_anchors"
    ON public.block_grid_anchors FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "Service role manages world_ticks"
    ON public.world_ticks FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "Service role manages payment_events"
    ON public.payment_events FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- ─── Explicit client grants ──────────────────────────────────
-- Begin from no anon/authenticated table privileges. `service_role` is
-- deliberately not touched: trusted backend and webhook paths need it.
REVOKE ALL ON TABLE public.profiles FROM anon, authenticated;
REVOKE ALL ON TABLE public.blocks FROM anon, authenticated;
REVOKE ALL ON TABLE public.gang_members FROM anon, authenticated;
REVOKE ALL ON TABLE public.block_placements FROM anon, authenticated;
REVOKE ALL ON TABLE public.player_inventory FROM anon, authenticated;
REVOKE ALL ON TABLE public.economy_logs FROM anon, authenticated;
REVOKE ALL ON TABLE public.salary_records FROM anon, authenticated;
REVOKE ALL ON TABLE public.combat_logs FROM anon, authenticated;
REVOKE ALL ON TABLE public.notifications FROM anon, authenticated;
REVOKE ALL ON TABLE public.presence FROM anon, authenticated;
REVOKE ALL ON TABLE public.drugs FROM anon, authenticated;
REVOKE ALL ON TABLE public.npc_gangs FROM anon, authenticated;
REVOKE ALL ON TABLE public.billing_products FROM anon, authenticated;
REVOKE ALL ON TABLE public.entitlements FROM anon, authenticated;
REVOKE ALL ON TABLE public.ghost_crews FROM anon, authenticated;
REVOKE ALL ON TABLE public.claimed_block_dna FROM anon, authenticated;
REVOKE ALL ON TABLE public.world_events FROM anon, authenticated;
REVOKE ALL ON TABLE public.encounter_results FROM anon, authenticated;

-- Read surfaces are authenticated-only. These grants intentionally do not
-- restore direct browser writes to player economy, inventory, blocks, crew,
-- placements, combat, receipts, or entitlements.
GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.blocks TO authenticated;
GRANT SELECT ON TABLE public.gang_members TO authenticated;
GRANT SELECT ON TABLE public.block_placements TO authenticated;
GRANT SELECT ON TABLE public.player_inventory TO authenticated;
GRANT SELECT ON TABLE public.economy_logs TO authenticated;
GRANT SELECT ON TABLE public.salary_records TO authenticated;
GRANT SELECT ON TABLE public.combat_logs TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.presence TO authenticated;
GRANT SELECT ON TABLE public.drugs TO authenticated;
GRANT SELECT ON TABLE public.npc_gangs TO authenticated;
GRANT SELECT ON TABLE public.billing_products TO authenticated;
GRANT SELECT ON TABLE public.entitlements TO authenticated;
GRANT SELECT ON TABLE public.ghost_crews TO authenticated;
GRANT SELECT ON TABLE public.claimed_block_dna TO authenticated;
GRANT SELECT ON TABLE public.world_events TO authenticated;
GRANT SELECT ON TABLE public.encounter_results TO authenticated;

-- ─── Replace broad `public` policies with explicit authenticated roles ──
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Blocks are publicly viewable" ON public.blocks;
DROP POLICY IF EXISTS "Owners can update their blocks" ON public.blocks;
DROP POLICY IF EXISTS "Authenticated users can claim blocks" ON public.blocks;
DROP POLICY IF EXISTS "Gang members private to owner" ON public.gang_members;
DROP POLICY IF EXISTS "Block placements viewable by all" ON public.block_placements;
DROP POLICY IF EXISTS "Block owners manage placements" ON public.block_placements;
DROP POLICY IF EXISTS "Inventory private to owner" ON public.player_inventory;
DROP POLICY IF EXISTS "Economy logs private to owner" ON public.economy_logs;
DROP POLICY IF EXISTS "Salary records private to owner" ON public.salary_records;
DROP POLICY IF EXISTS "Combat logs visible to participants" ON public.combat_logs;
DROP POLICY IF EXISTS "Notifications private to recipient" ON public.notifications;
DROP POLICY IF EXISTS "Presence publicly viewable" ON public.presence;
DROP POLICY IF EXISTS "Users manage own presence" ON public.presence;
DROP POLICY IF EXISTS "Drugs are publicly viewable" ON public.drugs;
DROP POLICY IF EXISTS "NPC gangs are publicly viewable" ON public.npc_gangs;
DROP POLICY IF EXISTS "Active billing products are readable" ON public.billing_products;
DROP POLICY IF EXISTS "Users read own entitlements" ON public.entitlements;
DROP POLICY IF EXISTS "Ghost crews are publicly viewable" ON public.ghost_crews;
DROP POLICY IF EXISTS "Block DNA is publicly viewable" ON public.claimed_block_dna;
DROP POLICY IF EXISTS "Block owners manage block DNA" ON public.claimed_block_dna;
DROP POLICY IF EXISTS "World events visible to recipients or public" ON public.world_events;
DROP POLICY IF EXISTS "Encounter receipts visible to participants" ON public.encounter_results;

CREATE POLICY "Authenticated users read own profiles"
    ON public.profiles FOR SELECT TO authenticated
    USING ((select auth.uid()) = id);

-- A signed-in player may inspect the shared fictional territory layer, but
-- cannot write a block directly. The saved-game command API will own writes.
CREATE POLICY "Authenticated users read territory"
    ON public.blocks FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Authenticated users read own crew"
    ON public.gang_members FOR SELECT TO authenticated
    USING ((select auth.uid()) = owner_id);

CREATE POLICY "Authenticated users read owned block placements"
    ON public.block_placements FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1
        FROM public.blocks
        WHERE blocks.id = block_placements.block_id
          AND blocks.owner_id = (select auth.uid())
    ));

CREATE POLICY "Authenticated users read own inventory"
    ON public.player_inventory FOR SELECT TO authenticated
    USING ((select auth.uid()) = owner_id);

CREATE POLICY "Authenticated users read own economy logs"
    ON public.economy_logs FOR SELECT TO authenticated
    USING ((select auth.uid()) = profile_id);

CREATE POLICY "Authenticated users read own salary records"
    ON public.salary_records FOR SELECT TO authenticated
    USING ((select auth.uid()) = profile_id);

CREATE POLICY "Authenticated participants read combat logs"
    ON public.combat_logs FOR SELECT TO authenticated
    USING ((select auth.uid()) = attacker_id OR (select auth.uid()) = defender_id);

CREATE POLICY "Authenticated users read own notifications"
    ON public.notifications FOR SELECT TO authenticated
    USING ((select auth.uid()) = player_id);

CREATE POLICY "Authenticated users mark own notifications"
    ON public.notifications FOR UPDATE TO authenticated
    USING ((select auth.uid()) = player_id)
    WITH CHECK ((select auth.uid()) = player_id);

CREATE POLICY "Authenticated users read presence"
    ON public.presence FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Authenticated users create own presence"
    ON public.presence FOR INSERT TO authenticated
    WITH CHECK ((select auth.uid()) = player_id);

CREATE POLICY "Authenticated users update own presence"
    ON public.presence FOR UPDATE TO authenticated
    USING ((select auth.uid()) = player_id)
    WITH CHECK ((select auth.uid()) = player_id);

CREATE POLICY "Authenticated users read drug catalog"
    ON public.drugs FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Authenticated users read NPC catalog"
    ON public.npc_gangs FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Authenticated users read active billing products"
    ON public.billing_products FOR SELECT TO authenticated
    USING (active = true);

CREATE POLICY "Authenticated users read own entitlements"
    ON public.entitlements FOR SELECT TO authenticated
    USING ((select auth.uid()) = user_id);

CREATE POLICY "Authenticated users read ghost crews"
    ON public.ghost_crews FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Authenticated users read own block DNA"
    ON public.claimed_block_dna FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1
        FROM public.blocks
        WHERE blocks.id = claimed_block_dna.block_id
          AND blocks.owner_id = (select auth.uid())
    ));

CREATE POLICY "Authenticated users read visible world events"
    ON public.world_events FOR SELECT TO authenticated
    USING (recipient_profile_id IS NULL OR recipient_profile_id = (select auth.uid()));

CREATE POLICY "Authenticated users read encounter receipts"
    ON public.encounter_results FOR SELECT TO authenticated
    USING (profile_id = (select auth.uid()));

-- ─── Fixed search paths and deliberate SECURITY DEFINER grants ───────────
ALTER FUNCTION public.update_updated_at_column() SET search_path = pg_catalog, public;
ALTER FUNCTION public.handle_new_user() SET search_path = pg_catalog, public;
ALTER FUNCTION public.apply_ghost_world_tick(TEXT, JSONB, JSONB, INTEGER) SET search_path = pg_catalog, public;
ALTER FUNCTION public.commit_encounter_result(TEXT, UUID, JSONB) SET search_path = pg_catalog, public;
ALTER FUNCTION public.persist_player_block_projection(UUID, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, public.block_status, INTEGER, INTEGER, JSONB, TEXT) SET search_path = pg_catalog, public;

CREATE OR REPLACE FUNCTION public.get_leaderboard(limit_count INT DEFAULT 50)
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
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
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
    LIMIT LEAST(GREATEST(COALESCE(limit_count, 50), 1), 100);
$$;

CREATE OR REPLACE FUNCTION public.get_economy_summary(user_id UUID)
RETURNS TABLE (
    total_earned BIGINT,
    total_spent BIGINT,
    last_salary_paid TIMESTAMPTZ,
    weekly_salary_total BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF (select auth.uid()) IS DISTINCT FROM user_id
       AND COALESCE(auth.role(), '') <> 'service_role' THEN
        RAISE EXCEPTION 'economy summary is private to the authenticated profile';
    END IF;

    RETURN QUERY
    SELECT
        COALESCE(SUM(CASE WHEN el.amount > 0 THEN el.amount ELSE 0 END), 0) AS total_earned,
        COALESCE(SUM(CASE WHEN el.amount < 0 THEN ABS(el.amount) ELSE 0 END), 0) AS total_spent,
        (SELECT MAX(sr.paid_at) FROM public.salary_records sr WHERE sr.profile_id = user_id) AS last_salary_paid,
        COALESCE((
            SELECT SUM(gm.weekly_salary)
            FROM public.gang_members gm
            WHERE gm.owner_id = user_id AND gm.status = 'active'
        ), 0) AS weekly_salary_total
    FROM public.economy_logs el
    WHERE el.profile_id = user_id;
END;
$$;

-- `handle_new_user()` is invoked by the Auth-owned signup trigger. Its search
-- path is fixed above, but its grant is not changed until the staging two-user
-- Auth smoke test proves the trigger execution context under the target stack.
REVOKE ALL ON FUNCTION public.get_economy_summary(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_economy_summary(UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_leaderboard(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(INT) TO authenticated, service_role;

-- The canonical entitlement names are billing_products and entitlements.
-- No billing products are activated and no payment path is enabled here.
