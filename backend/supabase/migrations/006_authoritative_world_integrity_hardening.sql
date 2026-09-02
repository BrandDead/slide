-- ============================================================
-- DEALT/SLIDE — Authoritative World Integrity Hardening
--
-- Follow-up to 005_authoritative_world_foundation.sql.
-- Tightens bounded result deltas and makes background block projection
-- writes reject stale snapshots after a newer encounter has committed.
-- ============================================================

CREATE OR REPLACE FUNCTION public.commit_encounter_result(
    p_result_key TEXT,
    p_block_id UUID,
    p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile_id UUID := auth.uid();
    v_result_id UUID;
    v_existing RECORD;
    v_heat_delta INTEGER;
    v_morale_delta INTEGER;
    v_pending_income_delta INTEGER;
BEGIN
    IF v_profile_id IS NULL THEN
        RAISE EXCEPTION 'authentication required';
    END IF;
    IF COALESCE(trim(p_result_key), '') = '' THEN
        RAISE EXCEPTION 'result_key is required';
    END IF;
    IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
        RAISE EXCEPTION 'result payload must be an object';
    END IF;
    IF COALESCE(p_payload->>'idempotencyKey', '') <> p_result_key THEN
        RAISE EXCEPTION 'result key does not match payload idempotency key';
    END IF;
    IF COALESCE(p_payload->>'outcome', '') NOT IN ('secured', 'retreated', 'overrun') THEN
        RAISE EXCEPTION 'invalid encounter outcome';
    END IF;

    v_heat_delta := COALESCE((p_payload->>'heatDelta')::integer, 0);
    v_morale_delta := COALESCE((p_payload->>'moraleDelta')::integer, 0);
    v_pending_income_delta := COALESCE((p_payload->>'pendingIncomeDelta')::integer, 0);
    IF v_heat_delta NOT BETWEEN -5 AND 5
      OR v_morale_delta NOT BETWEEN -100 AND 100
      OR v_pending_income_delta NOT BETWEEN -1000000 AND 1000000 THEN
        RAISE EXCEPTION 'encounter result deltas exceed permitted bounds';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.blocks WHERE id = p_block_id AND owner_id = v_profile_id
    ) THEN
        RAISE EXCEPTION 'block is not owned by authenticated profile';
    END IF;

    INSERT INTO public.encounter_results (result_key, profile_id, block_id, outcome, payload)
    VALUES (p_result_key, v_profile_id, p_block_id, p_payload->>'outcome', p_payload)
    ON CONFLICT (result_key) DO NOTHING
    RETURNING id INTO v_result_id;

    IF v_result_id IS NULL THEN
        SELECT id, profile_id, block_id INTO v_existing
        FROM public.encounter_results
        WHERE result_key = p_result_key;
        IF v_existing.profile_id <> v_profile_id OR v_existing.block_id <> p_block_id THEN
            RAISE EXCEPTION 'result key belongs to a different participant or block';
        END IF;
        RETURN jsonb_build_object('applied', false, 'resultId', v_existing.id, 'resultKey', p_result_key);
    END IF;

    UPDATE public.blocks
    SET
        block_heat = GREATEST(0, LEAST(100, block_heat + (v_heat_delta * 20))),
        metadata = jsonb_set(
            jsonb_set(
                jsonb_set(COALESCE(metadata, '{}'::jsonb), '{morale}', to_jsonb(GREATEST(0, LEAST(100, COALESCE((metadata->>'morale')::integer, 80) + v_morale_delta))), true),
                '{pendingIncome}', to_jsonb(GREATEST(0, COALESCE((metadata->>'pendingIncome')::integer, 0) + v_pending_income_delta)), true
            ),
            '{lastEncounterResultKey}', to_jsonb(p_result_key), true
        )
    WHERE id = p_block_id AND owner_id = v_profile_id;

    INSERT INTO public.world_events (
        event_key, recipient_profile_id, event_type, target_block_key, description, data
    ) VALUES (
        'encounter:' || p_result_key,
        v_profile_id,
        'encounter',
        p_block_id::text,
        COALESCE(NULLIF(p_payload->>'summary', ''), 'Encounter result committed.'),
        jsonb_build_object(
            'outcome', p_payload->>'outcome',
            'heatDelta', v_heat_delta,
            'moraleDelta', v_morale_delta,
            'pendingIncomeDelta', v_pending_income_delta
        )
    ) ON CONFLICT (event_key) DO NOTHING;

    RETURN jsonb_build_object('applied', true, 'resultId', v_result_id, 'resultKey', p_result_key);
END;
$$;

-- Atomically accepts the current local block projection only when it is based
-- on the current server encounter receipt key. This is used by the existing
-- debounced sync path, which may otherwise arrive after an encounter RPC.
CREATE OR REPLACE FUNCTION public.persist_player_block_projection(
    p_block_id UUID,
    p_address TEXT,
    p_lng DOUBLE PRECISION,
    p_lat DOUBLE PRECISION,
    p_status public.block_status,
    p_block_heat INTEGER,
    p_base_income INTEGER,
    p_metadata JSONB,
    p_client_result_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile_id UUID := auth.uid();
    v_server_result_key TEXT;
BEGIN
    IF v_profile_id IS NULL THEN
        RAISE EXCEPTION 'authentication required';
    END IF;
    IF p_block_heat NOT BETWEEN 0 AND 100 THEN
        RAISE EXCEPTION 'block heat must be between 0 and 100';
    END IF;
    IF p_base_income < 0 OR p_base_income > 1000000 THEN
        RAISE EXCEPTION 'base income is outside permitted bounds';
    END IF;

    SELECT metadata->>'lastEncounterResultKey' INTO v_server_result_key
    FROM public.blocks
    WHERE id = p_block_id AND owner_id = v_profile_id
    FOR UPDATE;

    IF FOUND AND COALESCE(v_server_result_key, '') <> COALESCE(p_client_result_key, '') THEN
        RETURN jsonb_build_object('applied', false, 'reason', 'stale_encounter_projection');
    END IF;

    INSERT INTO public.blocks (
        id, address, location, owner_id, status, block_heat, base_income, metadata, updated_at
    ) VALUES (
        p_block_id,
        p_address,
        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
        v_profile_id,
        p_status,
        p_block_heat,
        p_base_income,
        COALESCE(p_metadata, '{}'::jsonb),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        address = EXCLUDED.address,
        location = EXCLUDED.location,
        status = EXCLUDED.status,
        block_heat = EXCLUDED.block_heat,
        base_income = EXCLUDED.base_income,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    WHERE public.blocks.owner_id = v_profile_id;

    RETURN jsonb_build_object('applied', true);
END;
$$;

REVOKE ALL ON FUNCTION public.persist_player_block_projection(UUID, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, public.block_status, INTEGER, INTEGER, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.persist_player_block_projection(UUID, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, public.block_status, INTEGER, INTEGER, JSONB, TEXT) TO authenticated, service_role;
