# Supabase Preview Bootstrap for the Authoritative-World Proof

## Purpose

This document establishes the **only supported repository workflow** for preparing a disposable Supabase preview, staging, development, or sandbox database for the DEALT/SLIDE authoritative-world proof. It exists because the first preview branch exposed a migration-history mismatch: its hosted branch attempted a historical migration that expected `public.blocks` before the current repository base schema had been applied.

> **Never use this workflow against `main`, production, or a project that has not been explicitly named as disposable/non-production.** This document does not authorize production schema changes, service-secret changes, Edge Function deployment, or scheduler activation.

## What caused the blocker

The repository has a current base schema at `backend/supabase/migrations/000_master_schema.sql`, but it did not previously provide a canonical Supabase CLI workdir or a declared migration subset for a fresh preview. Historical migration files `001_mvp_tables.sql` and `002_combat_tables.sql` rely on older `users`, `gangs`, and related table shapes that are not created by the current master schema. Replaying them as part of a new proof environment is not safe.

The source-controlled manifest at [`backend/supabase/world-proof-manifest.json`](../backend/supabase/world-proof-manifest.json) declares the compatible migration set for this proof:

| Order | Source migration | Why it is included |
|---:|---|---|
| 1 | `000_master_schema.sql` | Creates the current profiles, blocks, enums, helper functions, RLS baseline, and realtime baseline. |
| 2 | `003_block_backgrounds.sql` | Creates optional Block-mode tables that depend on `public.blocks`. |
| 3 | `004_paid_entitlements.sql` | Retains current additive billing tables without enabling products or processing payment data. |
| 4 | `005_authoritative_world_foundation.sql` | Adds durable Ghost Crew state, world events, Block DNA projection, and encounter receipts. |
| 5 | `006_authoritative_world_integrity_hardening.sql` | Adds bounded result deltas and stale-projection protection. |

The legacy `001` and `002` files are intentionally excluded from this proof workdir. They remain in the repository as historical material and must not be replayed until they are separately reconciled into a canonical, tested migration history.

## Prepare a disposable workdir

The preparation utility performs **no remote action**. It does not link a project, read a secret, apply SQL, deploy a function, or set a scheduler. It only validates the manifest and copies the approved SQL files into a standard Supabase CLI layout.

```bash
# From the repository root.
python3 backend/supabase/scripts/prepare_nonprod_world_proof.py --validate-only
python3 backend/supabase/scripts/prepare_nonprod_world_proof.py \
  --workspace /tmp/dealt-slide-world-proof
```

The generated workdir contains `supabase/config.toml` and timestamped migrations. The generated configuration contains no project reference and no credentials.

## Approved remote procedure

The operator must verify that the dashboard shows the named target as **Preview**, **Staging**, **Development**, or **Sandbox** before running any command below. Use an empty, newly created preview branch when the previous branch is unhealthy or has mismatched migration history.

1. Install or invoke the supported Supabase CLI. The repository has intentionally not committed a personal access token, database password, service-role key, or function secret.
2. From the generated workdir, link **only** the confirmed preview project reference.
3. Run `supabase db push --dry-run` and record the exact ordered migration list. Stop if the output includes an unexpected historical migration or any production reference.
4. After a separate operator confirmation, run `supabase db push` once. Do not use the SQL Editor for remote schema changes because that bypasses migration history.
5. Execute the object, privilege, RLS, tick-idempotency, encounter, and returning-player checks in the [non-production proof runbook](../backend/supabase/world-proof-manifest.json) and in the `ops/closed-alpha-world-proof` branch’s `docs/NONPRODUCTION_AUTHORITATIVE_WORLD_PROOF.md` file.
6. Deploy `world-tick-ghost` only to that same preview reference, then configure `WORLD_TICK_SECRET` only as a server-side function secret. The scheduler remains disabled during this proof.
7. Capture non-secret evidence, then delete or reset the disposable preview target when the proof is complete.

> Supabase’s documented migration workflow treats local migration files and remote migration history as separate systems. Use `supabase migration list` to inspect divergence and use `supabase migration repair` only after verifying the actual remote schema; it changes history records but does not apply SQL. [Supabase database migrations](https://supabase.com/docs/guides/deployment/database-migrations)

## Validation before every proof run

| Gate | Required evidence | Stop condition |
|---|---|---|
| Target identity | Dashboard label and project reference show Preview/Staging/Development/Sandbox. | Target is `main`, Production, unknown, or unlabeled. |
| Bootstrap utility | `--validate-only` succeeds and the generated workdir contains exactly the five manifest migrations. | Missing source file, duplicate target version, or legacy `001`/`002` file appears. |
| Remote dry run | `supabase db push --dry-run` lists only the manifest migrations in order. | Unexpected migration-history divergence or a failed base schema. |
| Recovery | Preview branch can be deleted/reset without affecting the production branch. | No disposable reset path is known. |
| Proof scope | The runbook’s test actor and synthetic event data are prepared. | Any real player, real address, or production state would be used. |

## Current operational status

The initial `closed-alpha-world-proof` preview branch is **blocked** because Supabase reported it as unhealthy after a historical migration failed before `public.blocks` existed. Do not try to repair its migration-history table manually. Keep the production `main` branch untouched. Recreate a fresh preview after this repository repair is merged, materialize the canonical workdir, and run the dry-run gate before any proof write.

## References

1. [Supabase: Database migrations](https://supabase.com/docs/guides/deployment/database-migrations)
2. [Supabase: CLI reference](https://supabase.com/docs/reference/cli/introduction)
3. [Supabase: Deploy Edge Functions](https://supabase.com/docs/guides/functions/deploy)
