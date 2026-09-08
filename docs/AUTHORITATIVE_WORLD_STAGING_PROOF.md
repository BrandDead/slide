# Authoritative World Staging Proof

**Status:** Passed in isolated standalone staging on 8 September 2026.

**Production status:** Not promoted. No production migration, Edge Function deployment, secret, or scheduler was changed.

**Canonical staging target:** `dealt-world-proof-staging` (`zfgclgnyqlabttymxwuw`).

## Purpose

This record closes the closed-alpha **non-production proof** gate for the authoritative-world foundation. It demonstrates that the selected migration set can be applied to an isolated Supabase project, that the database objects and Row Level Security boundaries work as designed, and that a guarded Ghost Crew tick endpoint rejects unauthorized callers and handles duplicate requests idempotently.

> The proof validates technical readiness; it is **not** authorization to promote database changes, deploy the function, configure a secret, or enable a scheduler in the production `slide` project.

## Why a standalone staging project was used

The initial `closed-alpha-world-proof` preview branch of production project `slide` could not reach a healthy database state. A read-only SQL query and bounded direct migration attempts were unavailable there, so it was retired after the standalone replacement was confirmed. The standalone project is explicitly named for this proof and has no production traffic or production database relationship.

| Environment | Reference | Status | Permitted use |
|---|---|---|---|
| `slide` production `main` | `jdvlavhzornlwpecasia` | Untouched | None during this proof |
| Retired preview branch | `jctlcdzcfilzyebznsur` | Deleted | No longer available |
| `dealt-world-proof-staging` | `zfgclgnyqlabttymxwuw` | Healthy, isolated | This proof only |

## Repository repair required before deployment

The original world-tick deployment exposed a shared Edge Function bundling problem: the function imported `zod` as a bare module specifier. Supabase’s Deno bundler requires an explicit package specifier. The project corrected the same issue in all five affected Edge Function entrypoints in merged PR [#132](https://github.com/BrandDead/slide/pull/132):

```ts
import { z } from 'npm:zod@3.23.8';
```

The repaired `world-tick-ghost` function then bundled and deployed successfully to standalone staging. This staging deployment was made with JWT verification disabled only because the endpoint enforces its own `x-cron-secret`; no scheduler was configured.

## Applied migration set

The proof used the source-controlled manifest at `backend/supabase/world-proof-manifest.json` and its bootstrap validator at `backend/supabase/scripts/prepare_nonprod_world_proof.py`. That workflow excludes incompatible historical migration replay and applies this ordered, tracked sequence:

| Order | Migration | Result |
|---:|---|---|
| 1 | `000_master_schema.sql` | Applied |
| 2 | `003_block_backgrounds.sql` | Applied |
| 3 | `004_paid_entitlements.sql` | Applied after the idempotent API retry completed its pending tracked migration response |
| 4 | `005_authoritative_world_foundation.sql` | Applied |
| 5 | `006_authoritative_world_integrity_hardening.sql` | Applied |

The migration API retained migration names and history; raw untracked SQL was not used to establish schema state.

## Database and RLS proof results

The following assertions passed against the standalone staging database.

| Assertion | Result |
|---|---|
| Required tables exist: `ghost_crews`, `claimed_block_dna`, `world_ticks`, `world_events`, `encounter_results` | Passed |
| Row Level Security is enabled on all five authoritative-world tables | Passed |
| Public read policy exists for Ghost Crews and claimed Block DNA | Passed |
| Recipient/public visibility policy exists for world events | Passed |
| Participant-only visibility policy exists for encounter receipts | Passed |
| Anonymous callers cannot execute Ghost Crew tick RPC | Passed |
| Authenticated callers cannot execute Ghost Crew tick RPC | Passed |
| Only `service_role` can execute Ghost Crew tick RPC | Passed |
| Anonymous callers cannot execute encounter receipt or block projection RPCs | Passed |
| Authenticated callers can execute the intended encounter receipt and block projection RPCs | Passed |
| Anonymous direct write to `world_ticks` is denied at runtime | Passed |
| Authenticated direct write to `world_events` is denied at runtime | Passed |
| Anonymous reads of `encounter_results` return no receipts | Passed |

The runtime RLS test was executed using controlled role changes inside rollback transactions. It did not retain probe rows.

## Idempotent Ghost Crew tick proof

A synthetic, fictional Ghost Crew event was written solely to the standalone staging environment. It verified the same key can never apply twice.

| Input | First request | Second identical request |
|---|---|---|
| Synthetic tick key | `applied: true` | `applied: false` |
| `world_ticks` rows for key | 1 | Still 1 |
| `world_events` rows for key | 1 | Still 1 |
| Canonical Ghost Crew update | Treasury and last move updated | No duplicate update |

This proves the `apply_ghost_world_tick` ledger and event key constraints protect the canonical world state from replayed ticks.

## Guarded endpoint proof

The staging deployment of `world-tick-ghost` used a transient, randomly generated `WORLD_TICK_SECRET`. The secret was held only in process memory / a temporary mode-600 environment file and was not written to Git, source files, project documentation, or deliverables.

| Endpoint scenario | Expected result | Observed result |
|---|---:|---:|
| No `x-cron-secret` header | HTTP 401 | HTTP 401 |
| Correct secret with malformed payload | HTTP 400 | HTTP 400 |
| Correct secret with valid synthetic tick | HTTP 200, `applied: true` | Passed |
| Same valid request re-sent | HTTP 200, `applied: false` | Passed |
| Scheduler creation | Not performed | Not performed |

## What remains before any production promotion

Production promotion remains a deliberate, separate decision. The following items are required before it is considered:

1. **Promotion approval.** Confirm the authoritative-world database additions should run against production `slide`.
2. **Production backup and maintenance decision.** Capture a verified backup / rollback position and select a maintenance or low-traffic rollout window.
3. **Production migration dry run and apply.** Use the source-controlled manifest, never manual dashboard SQL or the retired preview branch.
4. **Production Edge Function deploy.** Deploy the merged `world-tick-ghost` source from PR #132, then set a new production-only `WORLD_TICK_SECRET` through Supabase secret management. Never reuse the staging secret.
5. **Post-deploy smoke test.** Re-run the unauthorized, malformed, first-tick, and duplicate-tick checks with production-safe synthetic data or an operator-designated test profile.
6. **Scheduler design review.** Do not enable a recurring tick until the team selects the trusted trigger owner, cadence, secret-rotation procedure, alerting, and operational runbook.

## Standalone staging lifecycle

The standalone project is still useful for the proof evidence and regression checks. It should remain **isolated from production** and should be deleted when the team has completed production promotion planning or no longer needs the evidence. Deletion would discard staging data only; it does not affect production `slide`.

## Related repository records

- [AI Contributor Start Here](AI_CONTRIBUTOR_START_HERE.md)
- [Supabase Preview Bootstrap](SUPABASE_PREVIEW_BOOTSTRAP.md)
- [AI Manus Authoritative World Design](AI_MANUS_AUTHORITATIVE_WORLD_DESIGN.md)
- [Prepared Non-production Authoritative World Proof Runbook](https://github.com/BrandDead/slide/blob/ops/closed-alpha-world-proof/docs/NONPRODUCTION_AUTHORITATIVE_WORLD_PROOF.md)
- [Project Log](PROJECT_LOG.md)

## External references

- [Supabase Management API: run a SQL query](https://supabase.com/docs/reference/api/v1-run-a-query)
- [Supabase Management API: apply a database migration](https://supabase.com/docs/reference/api/v1-apply-a-migration)
- [Supabase API keys and RLS roles](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase database migrations](https://supabase.com/docs/guides/deployment/database-migrations)
