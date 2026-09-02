-- ============================================================
-- DEALT/SLIDE — Authoritative World Foundation
--
-- Additive foundation for durable Ghost Crew state, idempotent
-- world ticks, safe Block DNA references, and deterministic
-- encounter-result receipts. This migration does not replace the
-- existing local deterministic combat session.
-- ============================================================

-- ─── Canonical Ghost Crew state ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.ghost_crews (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    home_tag TEXT NOT NULL,
    personality JSONB NOT NULL DEFAULT '{}'::jsonb,
    treasury INTEGER NOT NULL DEFAULT 0 CHECK (treasury >= 0),
    roster JSONB NOT NULL DEFAULT '[]'::jsonb,
    owned_block_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    claimed_dna_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    grudge JSONB NOT NULL DEFAULT '{"score": 0}'::jsonb,
    income_per_tick INTEGER NOT NULL DEFAULT 0 CHECK (income_per_tick >= 0),
    last_tick_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_move TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ghost_crews_updated_at ON public.ghost_crews(updated_at DESC);
DROP TRIGGER IF EXISTS set_ghost_crews_updated_at ON public.ghost_crews;
CREATE TRIGGER set_ghost_crews_updated_at BEFORE UPDATE ON public.ghost_crews
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── Minimal approved Block DNA projection ───────────────────
-- The source block remains the owner of location and possession data.
-- This table keeps only the gameplay archetype and derived tactical snapshot.
CREATE TABLE IF NOT EXISTS public.claimed_block_dna (
    block_id UUID PRIMARY KEY REFERENCES public.blocks(id) ON DELETE CASCADE,
    dna_id TEXT NOT NULL,
    tactical_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS set_claimed_block_dna_updated_at ON public.claimed_block_dna;
CREATE TRIGGER set_claimed_block_dna_updated_at BEFORE UPDATE ON public.claimed_block_dna
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── Idempotent server-tick ledger ───────────────────────────
CREATE TABLE IF NOT EXISTS public.world_ticks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tick_key TEXT NOT NULL UNIQUE,
    source TEXT NOT NULL DEFAULT 'ghost-crew' CHECK (source IN ('ghost-crew', 'manual', 'system')),
    seed INTEGER,
    action_count INTEGER NOT NULL DEFAULT 0 CHECK (action_count >= 0),
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_world_ticks_applied_at ON public.world_ticks(applied_at DESC);

-- ─── Durable, deduplicated player-visible world events ───────
CREATE TABLE IF NOT EXISTS public.world_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_key TEXT NOT NULL UNIQUE,
    tick_id UUID REFERENCES public.world_ticks(id) ON DELETE SET NULL,
    crew_id TEXT REFERENCES public.ghost_crews(id) ON DELETE SET NULL,
    recipient_profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('claim', 'reinforce', 'attack', 'lay-low', 'encounter', 'system')),
    target_block_key TEXT,
    description TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_world_events_recipient ON public.world_events(recipient_profile_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_world_events_tick ON public.world_events(tick_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_world_events_crew ON public.world_events(crew_id, occurred_at DESC);

-- ─── Idempotent unified combat-result receipts ───────────────
CREATE TABLE IF NOT EXISTS public.encounter_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    result_key TEXT NOT NULL UNIQUE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    block_id UUID NOT NULL REFERENCES public.blocks(id) ON DELETE CASCADE,
    outcome TEXT NOT NULL CHECK (outcome IN ('secured', 'retreated', 'overrun')),
    payload JSONB NOT NULL,
    committed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_encounter_results_profile ON public.encounter_results(profile_id, committed_at DESC);
CREATE INDEX IF NOT EXISTS idx_encounter_results_block ON public.encounter_results(block_id, committed_at DESC);

-- ─── Row-level security ──────────────────────────────────────
ALTER TABLE public.ghost_crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claimed_block_dna ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.world_ticks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.world_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encounter_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ghost crews are publicly viewable" ON public.ghost_crews;
CREATE POLICY "Ghost crews are publicly viewable"
    ON public.ghost_crews FOR SELECT USING (true);

DROP POLICY IF EXISTS "Block DNA is publicly viewable" ON public.claimed_block_dna;
CREATE POLICY "Block DNA is publicly viewable"
    ON public.claimed_block_dna FOR SELECT USING (true);

DROP POLICY IF EXISTS "Block owners manage block DNA" ON public.claimed_block_dna;
CREATE POLICY "Block owners manage block DNA"
    ON public.claimed_block_dna FOR ALL
    USING (EXISTS (SELECT 1 FROM public.blocks WHERE id = block_id AND owner_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.blocks WHERE id = block_id AND owner_id = auth.uid()));

DROP POLICY IF EXISTS "World events visible to recipients or public" ON public.world_events;
CREATE POLICY "World events visible to recipients or public"
    ON public.world_events FOR SELECT
    USING (recipient_profile_id IS NULL OR recipient_profile_id = auth.uid());

DROP POLICY IF EXISTS "Encounter receipts visible to participants" ON public.encounter_results;
CREATE POLICY "Encounter receipts visible to participants"
    ON public.encounter_results FOR SELECT USING (profile_id = auth.uid());

-- No direct policies are added for writes to ghost_crews, world_ticks,
-- world_events, or encounter_results. They are mutated only through the
-- security-definer RPCs below or service-role Edge Functions.

-- ─── Seed the same deterministic crews used by the local engine ───────
INSERT INTO public.ghost_crews (
    id, name, home_tag, personality, treasury, roster, owned_block_ids,
    claimed_dna_ids, grudge, income_per_tick, last_move
) VALUES
(
    'ghost-nightfall', 'Nightfall Crew', 'downtown',
    '{"type":"territory-hungry","aggression":55,"expansionDrive":85,"grudgeWeight":40,"caution":30}'::jsonb,
    2200,
    '[{"id":"nf-1","name":"Olas King","role":"enforcer","level":4,"alive":true},{"id":"nf-2","name":"Strip Boss","role":"shooter","level":4,"alive":true},{"id":"nf-3","name":"Beach Boy","role":"dealer","level":3,"alive":true}]'::jsonb,
    '[]'::jsonb, '[]'::jsonb, '{"score":0}'::jsonb, 0, 'Controlling downtown Las Olas'
),
(
    'ghost-sistrunk', 'Sistrunk Ghosts', 'eastside',
    '{"type":"revenge-driven","aggression":80,"expansionDrive":45,"grudgeWeight":90,"caution":20}'::jsonb,
    1500,
    '[{"id":"sg-1","name":"Fed Buster","role":"enforcer","level":4,"alive":true},{"id":"sg-2","name":"All-Day","role":"shooter","level":3,"alive":true},{"id":"sg-3","name":"Zero Fed","role":"shooter","level":3,"alive":true}]'::jsonb,
    '[]'::jsonb, '[]'::jsonb, '{"score":15}'::jsonb, 0, 'Watching Sistrunk Blvd'
),
(
    'ghost-riverwalk', 'Riverwalk Money Crew', 'southside',
    '{"type":"money-crew","aggression":30,"expansionDrive":55,"grudgeWeight":25,"caution":80}'::jsonb,
    3000,
    '[{"id":"rm-1","name":"Lucky 7","role":"dealer","level":4,"alive":true},{"id":"rm-2","name":"Down-Low","role":"dealer","level":3,"alive":true},{"id":"rm-3","name":"Seven-Up","role":"enforcer","level":3,"alive":true}]'::jsonb,
    '[]'::jsonb, '[]'::jsonb, '{"score":0}'::jsonb, 0, 'Running the Riverwalk docks'
),
(
    'ghost-chaos', 'Westside Wolves', 'westside',
    '{"type":"chaotic","aggression":70,"expansionDrive":65,"grudgeWeight":55,"caution":10}'::jsonb,
    1200,
    '[{"id":"ww-1","name":"Cloud 9","role":"shooter","level":2,"alive":true},{"id":"ww-2","name":"Nine-Life","role":"dealer","level":2,"alive":true},{"id":"ww-3","name":"Lil Niner","role":"enforcer","level":2,"alive":true}]'::jsonb,
    '[]'::jsonb, '[]'::jsonb, '{"score":5}'::jsonb, 0, 'Tagging the west side'
)
ON CONFLICT (id) DO NOTHING;

-- ─── Service-only world tick commit ──────────────────────────
CREATE OR REPLACE FUNCTION public.apply_ghost_world_tick(
    p_tick_key TEXT,
    p_crew_states JSONB,
    p_events JSONB DEFAULT '[]'::jsonb,
    p_seed INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tick_id UUID;
    v_crew JSONB;
    v_event JSONB;
    v_event_key TEXT;
BEGIN
    IF COALESCE(trim(p_tick_key), '') = '' THEN
        RAISE EXCEPTION 'tick_key is required';
    END IF;
    IF jsonb_typeof(p_crew_states) <> 'array' OR jsonb_typeof(p_events) <> 'array' THEN
        RAISE EXCEPTION 'crew_states and events must be JSON arrays';
    END IF;

    INSERT INTO public.world_ticks (tick_key, source, seed, action_count)
    VALUES (p_tick_key, 'ghost-crew', p_seed, jsonb_array_length(p_crew_states))
    ON CONFLICT (tick_key) DO NOTHING
    RETURNING id INTO v_tick_id;

    IF v_tick_id IS NULL THEN
        SELECT id INTO v_tick_id FROM public.world_ticks WHERE tick_key = p_tick_key;
        RETURN jsonb_build_object('applied', false, 'tickId', v_tick_id, 'tickKey', p_tick_key);
    END IF;

    FOR v_crew IN SELECT value FROM jsonb_array_elements(p_crew_states)
    LOOP
        UPDATE public.ghost_crews
        SET
            treasury = GREATEST(0, COALESCE((v_crew->>'treasury')::integer, treasury)),
            roster = COALESCE(v_crew->'roster', roster),
            owned_block_ids = COALESCE(v_crew->'ownedBlockIds', owned_block_ids),
            claimed_dna_ids = COALESCE(v_crew->'claimedDnaIds', claimed_dna_ids),
            grudge = COALESCE(v_crew->'grudge', grudge),
            income_per_tick = GREATEST(0, COALESCE((v_crew->>'incomePerTick')::integer, income_per_tick)),
            last_tick_at = COALESCE(NULLIF(v_crew->>'lastTickAt', '')::timestamptz, NOW()),
            last_move = COALESCE(NULLIF(v_crew->>'lastMove', ''), last_move)
        WHERE id = v_crew->>'id';

        IF NOT FOUND THEN
            RAISE EXCEPTION 'unknown ghost crew: %', v_crew->>'id';
        END IF;
    END LOOP;

    FOR v_event IN SELECT value FROM jsonb_array_elements(p_events)
    LOOP
        v_event_key := COALESCE(
            NULLIF(v_event->>'eventKey', ''),
            p_tick_key || ':' || COALESCE(NULLIF(v_event->>'crewId', ''), 'system') || ':' || COALESCE(NULLIF(v_event->>'action', ''), 'event')
        );
        INSERT INTO public.world_events (
            event_key, tick_id, crew_id, recipient_profile_id, event_type,
            target_block_key, description, data, occurred_at
        ) VALUES (
            v_event_key,
            v_tick_id,
            NULLIF(v_event->>'crewId', ''),
            NULLIF(v_event->>'recipientProfileId', '')::uuid,
            COALESCE(NULLIF(v_event->>'action', ''), 'system'),
            NULLIF(v_event->>'targetBlockId', ''),
            COALESCE(NULLIF(v_event->>'description', ''), 'World state changed.'),
            COALESCE(v_event->'data', '{}'::jsonb),
            COALESCE(NULLIF(v_event->>'timestamp', '')::timestamptz, NOW())
        ) ON CONFLICT (event_key) DO NOTHING;
    END LOOP;

    RETURN jsonb_build_object('applied', true, 'tickId', v_tick_id, 'tickKey', p_tick_key);
END;
$$;

-- ─── Authenticated, idempotent encounter receipt ─────────────
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

    v_heat_delta := COALESCE((p_payload->>'heatDelta')::integer, 0);
    v_morale_delta := COALESCE((p_payload->>'moraleDelta')::integer, 0);
    v_pending_income_delta := COALESCE((p_payload->>'pendingIncomeDelta')::integer, 0);

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
    WHERE id = p_block_id
      AND owner_id = v_profile_id
      AND COALESCE(metadata->>'lastEncounterResultKey', '') <> p_result_key;

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

-- The tick writer is service-only. The result writer validates auth.uid()
-- and block ownership internally before any mutation.
REVOKE ALL ON FUNCTION public.apply_ghost_world_tick(TEXT, JSONB, JSONB, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_ghost_world_tick(TEXT, JSONB, JSONB, INTEGER) TO service_role;
REVOKE ALL ON FUNCTION public.commit_encounter_result(TEXT, UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.commit_encounter_result(TEXT, UUID, JSONB) TO authenticated, service_role;

-- Only public/read-safe event streams are published; direct writes stay behind RPCs.
ALTER PUBLICATION supabase_realtime ADD TABLE public.ghost_crews;
ALTER PUBLICATION supabase_realtime ADD TABLE public.world_events;
