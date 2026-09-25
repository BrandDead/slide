-- ============================================================
-- DEALT/SLIDE — Placement Persistence RPC
--
-- Adds an ownership-checked RPC for persisting block placements
-- so authenticated clients can save crew assignments without
-- requiring direct table write grants.
--
-- Must be applied before migration 007's grant revocations, or
-- immediately after if placement writes are temporarily broken.
-- ============================================================

CREATE OR REPLACE FUNCTION public.persist_block_placements(
    p_block_id UUID,
    p_placements JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_owner_id UUID;
    v_placement JSONB;
    v_inserted_count INTEGER := 0;
BEGIN
    -- Authenticated-only: caller must own the block
    IF (SELECT auth.uid()) IS NULL THEN
        RAISE EXCEPTION 'placement persistence requires authentication';
    END IF;

    SELECT owner_id INTO v_owner_id
    FROM public.blocks
    WHERE id = p_block_id;

    IF v_owner_id IS NULL THEN
        RAISE EXCEPTION 'block % not found', p_block_id;
    END IF;

    IF v_owner_id IS DISTINCT FROM (SELECT auth.uid()) THEN
        RAISE EXCEPTION 'block % is not owned by the authenticated profile', p_block_id;
    END IF;

    -- Atomic replace: delete existing placements then insert new ones
    DELETE FROM public.block_placements WHERE block_id = p_block_id;

    -- Insert each placement from the JSONB array
    IF jsonb_array_length(p_placements) > 0 THEN
        FOR v_placement IN SELECT * FROM jsonb_array_elements(p_placements)
        LOOP
            INSERT INTO public.block_placements (
                block_id,
                member_id,
                member_name,
                role,
                grid_x,
                grid_y,
                zone_type,
                income_per_tick,
                exposure_risk,
                level,
                health,
                portrait_url,
                topdown_url,
                updated_at
            ) VALUES (
                p_block_id,
                (v_placement->>'memberId')::TEXT,
                (v_placement->>'memberName')::TEXT,
                (v_placement->>'role')::TEXT,
                (v_placement->>'x')::INTEGER,
                (v_placement->>'y')::INTEGER,
                (v_placement->>'zoneType')::TEXT,
                (v_placement->>'incomePerTick')::INTEGER,
                (v_placement->>'exposureRisk')::INTEGER,
                (v_placement->>'level')::INTEGER,
                (v_placement->>'health')::INTEGER,
                (v_placement->>'portraitUrl')::TEXT,
                (v_placement->>'topdownUrl')::TEXT,
                NOW()
            );
            v_inserted_count := v_inserted_count + 1;
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'blockId', p_block_id,
        'placementCount', v_inserted_count
    );
END;
$$;

-- Grant execute to authenticated and service roles only
REVOKE ALL ON FUNCTION public.persist_block_placements(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.persist_block_placements(UUID, JSONB) TO authenticated, service_role;

COMMENT ON FUNCTION public.persist_block_placements IS 
'Ownership-checked placement persistence for authenticated players. Atomically replaces all placements for a player-owned block.';
