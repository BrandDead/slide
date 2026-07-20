-- ============================================================
-- SLIDE PAID MVP - PRODUCTS, PAYMENT EVENTS, AND ENTITLEMENTS
-- Apply after 000_master_schema.sql and gameplay migrations.
-- Processor webhooks and administrative grants must use the service role.
-- The browser can read only its own effective entitlements.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.billing_products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    entitlement_key TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'stripe',
    provider_product_id TEXT UNIQUE,
    provider_price_id TEXT UNIQUE,
    active BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_products_active
    ON public.billing_products(active)
    WHERE active = true;

CREATE TABLE IF NOT EXISTS public.payment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    provider_event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'received'
        CHECK (status IN ('received', 'processed', 'ignored', 'failed')),
    payload_sha256 TEXT NOT NULL,
    processing_error TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_events_user
    ON public.payment_events(user_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_events_status
    ON public.payment_events(status, received_at)
    WHERE status IN ('received', 'failed');

CREATE TABLE IF NOT EXISTS public.entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    entitlement_key TEXT NOT NULL,
    product_id TEXT REFERENCES public.billing_products(id) ON DELETE SET NULL,
    source TEXT NOT NULL
        CHECK (source IN ('purchase', 'manual', 'promotion')),
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'revoked', 'refunded', 'expired')),
    provider TEXT,
    provider_customer_id TEXT,
    provider_payment_id TEXT,
    granted_by TEXT,
    reason TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entitlements_user_effective
    ON public.entitlements(user_id, entitlement_key, status, expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_entitlements_provider_payment
    ON public.entitlements(provider, provider_payment_id, entitlement_key)
    WHERE provider_payment_id IS NOT NULL;

ALTER TABLE public.billing_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;

-- Catalog reads are allowed only for products explicitly activated by the owner.
CREATE POLICY "Active billing products are readable"
    ON public.billing_products FOR SELECT
    USING (active = true);

-- Entitlements are private. There are intentionally no client INSERT/UPDATE/DELETE
-- policies: verified webhooks and admin tools must write with the service role.
CREATE POLICY "Users read own entitlements"
    ON public.entitlements FOR SELECT
    USING (auth.uid() = user_id);

-- payment_events intentionally has no browser policy. The table is an internal,
-- service-only idempotency and operations ledger.

INSERT INTO public.billing_products (
    id,
    name,
    entitlement_key,
    provider,
    active,
    metadata
) VALUES (
    'founders-access',
    'SLIDE Founders Access',
    'paid_beta',
    'stripe',
    false,
    '{"description":"One-time access to the controlled SLIDE paid beta. Activate only after a real processor price is configured."}'::jsonb
)
ON CONFLICT (id) DO NOTHING;
