# Non-Production Authoritative-World Proof

**Purpose:** Establish evidence that the durable Ghost Crew/world-event foundation can run safely in an explicitly non-production Supabase project before it is considered for closed-alpha production enablement.

**Branch:** `ops/closed-alpha-world-proof`

**Required migrations:** `005_authoritative_world_foundation.sql`, then `006_authoritative_world_integrity_hardening.sql`

**Required endpoint:** `world-tick-ghost`

**Non-goal:** This runbook does not authorize a production migration, scheduler, or seed change.

> Do not begin until the selected Supabase project is explicitly identified by its owner as **development**, **staging**, or another disposable non-production environment. Do not infer that an active project named `slide` is safe to alter.

## 1. Entry gate

| Gate | Required evidence | Pass condition |
|---|---|---|
| Project identity | Dashboard project name, reference, and owner confirmation | The target is explicitly non-production. |
| Recovery | A point-in-time backup, a disposable project, or a documented reset method | The team can undo this proof without affecting live player data. |
| Deployment access | The operator can apply migrations, deploy an edge function, and configure a function secret in the target | No credentials are written into this repository or supplied to the browser client. |
| Test actor | A dedicated test account/profile and one owned test block | RLS assertions can use an authenticated owner and an unauthenticated/non-owner comparison. |
| Baseline | Existing schema and function inventory captured | Any unexpected object conflict is visible before applying changes. |

If any entry gate is unavailable, record the proof as **blocked** and stop. Do not substitute a production project, an unrelated staging project, or a local demo state.

## 2. Ordered migration proof

Apply the migrations in this exact sequence and record the migration/version result after each step.

| Order | Action | Required checks |
|---:|---|---|
| 1 | Apply migration `005_authoritative_world_foundation.sql`. | Tables `ghost_crews`, `claimed_block_dna`, `world_ticks`, `world_events`, and `encounter_results` exist; four seeded Ghost Crews exist; RLS is enabled on all five tables. |
| 2 | Apply migration `006_authoritative_world_integrity_hardening.sql`. | `commit_encounter_result` contains bounded delta checks; `persist_player_block_projection` exists and is executable only by authenticated/service roles. |
| 3 | Inspect function privileges. | `apply_ghost_world_tick` is not executable by `anon` or `authenticated`; it is executable by `service_role`. `commit_encounter_result` and `persist_player_block_projection` are not executable by `anon`. |
| 4 | Inspect realtime publications. | `ghost_crews` and `world_events` are present once in `supabase_realtime`; duplicate publication errors are investigated rather than ignored. |

## 3. RLS proof matrix

Use the dedicated test profile and an unrelated authenticated profile where available. Record the response status and row count for each assertion.

| Actor | Operation | Expected result |
|---|---|---|
| Anonymous | Select `ghost_crews` | Allowed; public crew state only. |
| Anonymous | Select `world_events` | Only rows with no recipient are visible. |
| Anonymous | Insert/update `world_ticks`, `world_events`, `ghost_crews`, or `encounter_results` | Denied. |
| Non-owner authenticated user | Upsert `claimed_block_dna` for the test block | Denied. |
| Test-block owner | Upsert `claimed_block_dna` for the test block | Allowed. |
| Test-block owner | Select own `encounter_results` | Allowed. |
| Different authenticated user | Select the test owner’s `encounter_results` | Denied. |
| Authenticated player | Execute `commit_encounter_result` against an unowned block | Denied. |
| Anonymous | Execute `commit_encounter_result` or `persist_player_block_projection` | Denied. |

## 4. Guarded world-tick endpoint proof

Deploy `world-tick-ghost` to the selected non-production project only. Configure `WORLD_TICK_SECRET` as a server-side function secret; it must not be included in a frontend variable, committed file, pull-request body, or browser request log.

### Request cases

| Case | Invocation | Expected result |
|---|---|---|
| Unauthorized caller | Valid body without `x-cron-secret`, or with a deliberately wrong value | HTTP 401; no `world_ticks`, `ghost_crews`, or `world_events` mutation. |
| Invalid payload | Authorized request with invalid crew/event shape | HTTP 400; no mutation. |
| First tick | Authorized request with a unique `tickKey`, one valid seeded crew state, and one `attack` event | HTTP success; response says `applied: true`; one tick and one event are persisted. |
| Repeated tick | Repeat the exact first request with the same `tickKey` | HTTP success; response says `applied: false`; no second tick/event is created. |
| New tick | Authorized request with a new `tickKey` and a new `eventKey` | HTTP success; the new state/event is persisted once. |

Use synthetic, fictional descriptions and a test-only event key such as `proof:<date>:attack-1`. Do not use a player address, a production crew, or a real-world target.

## 5. Encounter and stale-projection integrity proof

For the owned test block, use one synthetic encounter receipt and retain its `result_key`.

| Case | Expected result |
|---|---|
| Valid owned-block receipt | `commit_encounter_result` returns `applied: true`, writes one receipt, updates bounded block state, and writes one recipient world event. |
| Same receipt repeated | Returns `applied: false`; no duplicate receipt, block change, or world event. |
| Receipt key/body mismatch | Rejected. |
| Heat, morale, or pending-income values outside migration `006` bounds | Rejected. |
| Projection with the current result key | `persist_player_block_projection` returns `applied: true`. |
| Projection with an older/no result key after the receipt | Returns `applied: false` with `stale_encounter_projection`; existing result consequences remain unchanged. |

## 6. Returning-player acceptance proof

After the authorized tick creates a recipient event, sign in as the matching non-production test player and verify the actual UI path.

1. Load the command desktop with the non-production Supabase variables.
2. Confirm the event appears once in **City Briefing** with a relative occurrence time derived from the persisted event timestamp.
3. Confirm the notification center contains one notification whose time reflects the event occurrence, not login time.
4. Reload or rehydrate the same player state. Confirm no duplicate notification is created.
5. Use the event action. For a known target block, confirm the Map route selects that block. For a non-local target block, confirm the route still opens safely without inventing a block selection.

## 7. Evidence record and rollback

Save the following without secrets: project reference/name, migration identifiers, test-account aliases, request case names, timestamps, response status, row counts, and screenshot or test output links. Do not store access tokens, service-role keys, function secrets, email addresses, or player addresses.

If any write check fails or an object conflicts unexpectedly, stop automatic follow-up work. Restore/reset the disposable target using the agreed recovery method, capture the error, and open a repair branch rather than retrying against production.

## 8. Promotion gate

The closed-alpha scheduler remains disabled until all entry gates, migration checks, RLS checks, endpoint checks, integrity checks, and returning-player checks pass in a confirmed non-production project. A later production rollout requires a separate approval, a fresh migration plan, explicit deployment ownership, and a rollback decision.
