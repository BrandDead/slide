# Slide Environment Map

**Status:** Verified read-only audit on 2026-09-09. No database, deployment, authentication, storage, or secret changes were made.

## Environment ownership

| Role | Supabase project | Project reference | Region | Repository/deployment relationship | Current state |
|---|---|---|---|---|---|
| Non-production proof / staging candidate | `dealt-world-proof-staging` | `zfgclgnyqlabttymxwuw` | AWS `us-east-2` | Supabase is linked to `BrandDead/slide` | Healthy; authoritative-world migration history present |
| Production / legacy live candidate | `slide` | `jdvlavhzornlwpecasia` | AWS `us-west-1` | Supabase has no GitHub repository connection | Existing account and older game schema present |
| Web deployment | Vercel project `slide` | `prj_RtjG6z9txO8ECSQKknC6ZIbfAoBa` | Vercel team deployment | Linked to `BrandDead/slide` | Latest deployment ready; previews observed from `main-tL2525` |

The Supabase dashboard labels the primary branch as `main — PRODUCTION` in **both** Supabase projects. The `staging` designation is therefore a project-level operating convention, not a formal Supabase branch/environment guarantee.

## Observed differences

The staging candidate contains the newer authoritative-world schema and reports a latest migration of `20260905000400_authoritative_world_integrity_hardening.sql`. Its public schema includes `claimed_block_dna`, `block_grid_anchors`, `ghost_crews`, `encounter_results`, `world_events`, and `world_ticks`.

The production-named `slide` project contains a different, older schema including `gangs`, `combat_sessions`, `combat_units`, `driveby_sessions`, `member_loadouts`, `player_drug_inventory`, `shoebox_ledger`, `user_assets`, and `user_inventory`. It has at least one visible email-authenticated account. Its overview did not show a last migration, although the database tables are present.

Neither project currently has Storage buckets. Authentication is enabled in both. The staging authentication screen showed an estimated user count but no visible rows; the `slide` project showed a visible email account.

## Application configuration contract

The repository intentionally contains no real deployment secrets. The checked-in frontend template uses:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_ENV=development
```

The backend expects `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as server-only variables. The actual Vercel environment values were not exposed by the read-only project metadata audit, so the deployment-to-Supabase URL mapping remains an operational verification task.

Expected mapping:

| Deployment context | `VITE_SUPABASE_URL` / `SUPABASE_URL` | `VITE_ENV` |
|---|---|---|
| Local development | Local/mock or explicitly selected non-production project | `development` |
| Preview / proof | `https://zfgclgnyqlabttymxwuw.supabase.co` | `staging` |
| Production | `https://jdvlavhzornlwpecasia.supabase.co` | `production` |

The service-role key must never be placed in a `VITE_*` variable or shipped to the browser.

## Promotion guardrails

Do not replay the staging authoritative-world migrations directly against `slide`. The two projects have materially different schemas and existing production account data.

Before any production promotion:

1. Export or confirm a restorable production backup for `slide`.
2. Compare the production schema against the approved migration manifest.
3. Decide whether the legacy schema is migrated, replaced, or kept as a compatibility layer.
4. Verify Vercel Preview points only to `dealt-world-proof-staging`.
5. Verify Vercel Production points only to `slide`.
6. Generate a new production-only server secret; never reuse a staging secret.
7. Run the documented smoke tests against a test account and synthetic data.
8. Obtain explicit approval for the production migration and rollout window.
9. Keep the scheduler disabled until the production promotion and rollback plan are separately approved.

This document records the environment boundary; it does not authorize a production migration, data deletion, credential rotation, or scheduler activation.
