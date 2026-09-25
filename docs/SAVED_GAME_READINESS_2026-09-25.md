# Authenticated Saved-Game Readiness — 2026-09-25

**Source revision audited:** `main-tL2525` at `7e55985`

**Owning issue:** [#175 — Prove authenticated saved-game continuity on isolated staging](https://github.com/BrandDead/slide/issues/175)

**Permitted remote target:** `dealt-world-proof-staging` (`zfgclgnyqlabttymxwuw`) only

**Decision:** The source already has one authoritative placement command. Do not add a second placement RPC. Migration 007 is already recorded on the permitted staging target; do not replay it or repair its history.

## Executive decision

The authenticated saved-game foundation is **ready for the remaining controlled staging proof**, but that player proof is not complete. Authentication restoration, Flask empire hydration, the authoritative placement queue, Supabase receipt/block projection, encounter idempotency, and demo isolation are merged. Live read-only reconciliation confirms migration 007 is already recorded on `dealt-world-proof-staging` as `20260925060458 / staging_saved_game_security_hardening_007`; its normalized stored statement matches the reviewed source and its expected grant/RLS effects are present. Production remains unchanged.

Cursor PR #174 originally treated `persistPlacements()` in `frontend/src/services/blockPersistence.service.ts` as an active browser writer and proposed a new `SECURITY DEFINER` RPC. That diagnosis was incorrect. The live placement path is already singular:

> `blockStore` → `blocksApi.placeMembers()` → authenticated Flask route → validated `DBAdapter.save_placements()`

`useBlockSync` does not call `persistPlacements()`. Its regression suite explicitly requires destructive placement persistence to remain with Flask. A new browser-callable placement RPC would therefore create a parallel authority with weaker validation, not close an active runtime gap.

The correct next step is operational: preserve the reconciled apply evidence, capture the advisor baseline, and prove two-user isolation plus reload/second-session continuity through the existing Flask command path. Do **not** run `supabase db push`, replay migration 007, use SQL Editor for it, or run `migration repair`; the generated manifest filenames use different version identifiers from the live history and may misleadingly appear unapplied to the CLI.

## 1. Canonical ownership map

| State or action | Authoritative writer | Browser role | Evidence | Readiness |
|---|---|---|---|---|
| Block claim and immutable Block DNA snapshot | Authenticated Flask claim route using the trusted server adapter | Sends candidate address/coordinates; does not own resolved DNA | `backend/python/api/blocks.py`; `backend/python/services/block_dna.py` | Merged; staging behavior still needs authenticated proof |
| Crew placement and removal | Serialized `blockStore` replacement queue through `blocksApi.placeMembers()` and Flask | Sends an intended replacement snapshot; reconciles to the server response | `frontend/src/stores/blockStore.ts`; `frontend/src/services/api.service.ts`; `backend/python/api/blocks.py` | Merged and covered offline |
| Placement table mutation | Flask `DBAdapter.save_placements()` using `SUPABASE_SERVICE_ROLE_KEY` on the server | No direct table-write responsibility | `backend/python/services/db.py` | Compatible with migration 007 by design; must be proven against staging |
| Block projection and encounter-receipt ledger | Narrow Supabase RPCs from migration 006 | Authenticated RPC caller | `persist_player_block_projection`; `commit_encounter_result` | Proven in isolated staging before migration 007 |
| Placement hydration | Flask `/api/blocks/my-blocks`; Supabase read projection only when Flask has not already hydrated the complete block | Read-only | `useEmpireHydration.ts`; `useBlockSync.ts` | Merged; cross-session proof open |
| Demo state | Local seeded demo path | No server mutation | `VITE_DEMO_MODE`; store/service guards | Merged and intentionally separate |

### Why Flask remains the only placement authority

The frontend queue serializes destructive replacement requests per block. The server validates that the caller owns the block, every member belongs to the caller, members are deployable, coordinates are integer and unique, cells are passable and unoccupied, zone and income values are server-derived from the stored Block DNA grid, and health reductions are monotonic. Failed requests reconcile to the last server-confirmed roster rather than preserving rejected optimistic state.

The proposed migration 008 checked only authentication and block ownership before deleting and reinserting client-supplied rows. It did not enforce roster ownership, member status, canonical grid passability, derived zone/income values, monotonic health, or a safe concurrency/version contract. Because the function was `SECURITY DEFINER`, those omissions would have bypassed RLS at the mutation boundary. The proposal was removed rather than hardened into a second command.

## 2. Migration 007 compatibility

Migration 007 revokes direct `anon` and `authenticated` table writes while preserving narrowly approved read surfaces and trusted server responsibilities. This matches the current placement architecture: the browser reads its owned placement projection, while Flask writes through the server-only service-role credential.

| Surface | Effect after migration 007 | Expected behavior |
|---|---|---|
| `block_placements` browser reads | `SELECT` remains available to authenticated owners under RLS | Owned rows load; other users' rows remain invisible |
| `block_placements` browser writes | Direct `INSERT`, `UPDATE`, and `DELETE` remain denied | No player impact because the live placement path uses Flask |
| Flask placement writes | Service-role grants are deliberately untouched | The owner-checked API continues to persist validated replacements |
| Block/encounter RPCs | Fixed search paths and deliberate authenticated execution remain | Projection and receipt commands continue through migration 006 functions |
| Legacy direct-write fallbacks | May be denied if an expected RPC is missing | Treat as schema/configuration failure; never broaden grants to rescue a fallback |
| Duplicate `claimed_block_dna` browser projection | A best-effort legacy upsert may be denied and warn | Stored Flask Block DNA snapshot remains authoritative; observe during staging and do not restore broad writes |

The presence of unused legacy helpers is not permission to design around them. A later cleanup may remove dead direct-write code, but that is not required to prove the current live placement path and must not be mixed into the staging operation.

## 3. Current readiness and open gates

| Gate | Current evidence | Status |
|---|---|---|
| Repository validation | Protected main at `7e55985` passed required frontend/backend CI after the documentation repair and setup-node maintenance | Passed |
| Canonical placement behavior | Offline connected-slice tests cover owner checks, roster/status validation, grid rules, queue ordering, rejection rollback, reload, and idempotent consequences | Source-ready |
| Manifest integrity | `world-proof-manifest.json` contains the approved six compatible migrations ending in 007; source contract tests and manifest validation passed during reconciliation | Passed; do not use the generated version IDs to repair live history |
| Migration 007 target state | Recorded as `20260925060458 / staging_saved_game_security_hardening_007`; source digest and intended catalog effects reconciled read-only | Applied; replay forbidden |
| Two-user RLS and grants | Prior proof predates migration 007 | Not proven |
| Returning-player continuity | Auth and hydration paths exist | Not proven on staging across reload and a second session |
| Mobile player path | Strict 375×812 external-beta path is not certified | Not proven |
| Production promotion | Separate release issue #171 remains open | Forbidden by this work |

## 4. Staging proof runbook

This section is a staged operator protocol, not authorization to mutate a remote database. Stop at every stated boundary.

### Phase A — source-only validation (completed baseline)

From a clean checkout at the reviewed revision, run:

```bash
python3 backend/supabase/scripts/prepare_nonprod_world_proof.py --validate-only
python3 backend/supabase/scripts/prepare_nonprod_world_proof.py \
  --workspace /tmp/dealt-slide-world-proof
```

The generated workdir must contain exactly the six manifest migrations in the declared order. It must not contain legacy migrations 001 or 002, a project reference, credentials, or any production identifier.

Run the repository gates:

```bash
cd frontend
npm run validate
npm run build

cd ../backend/python
./venv/bin/python -m pytest tests -q
```

The reconciliation baseline passed the migration contract tests and manifest validator. Re-run these source gates only if the reviewed source changes before the player proof. Any source, manifest, test, or build failure stops the proof.

### Phase B — target and apply-state reconciliation (completed)

Read-only Supabase inspection verified that the target is exactly `dealt-world-proof-staging` (`zfgclgnyqlabttymxwuw`), is isolated from production, and is `ACTIVE_HEALTHY`. The remote migration history already contains migration 007, and catalog checks confirm its intended security effects.

The generated CLI workdir uses source filename versions `20260905000000`–`20260905000500`, while live staging records later application versions. A CLI dry-run may therefore list already-applied schema as new. That mismatch is evidence to preserve, not permission to replay or repair history.

Do not run a new dry-run as an apply precursor for issue #175. Do not run `db push`, replay migration 007, use SQL Editor to recreate it, or run `migration repair` by guesswork.

### Phase C — preserve the completed apply evidence

Record the exact target, migration-history row, source revision/digest comparison, read-only ACL/RLS checks, and pre-proof advisor baseline in the redacted issue #175 evidence. Treat the prior apply gate as completed and superseded by this reconciliation.

No database mutation, production target, Edge Function deployment, scheduler, environment variable, secret, payment setting, or Vercel deployment is part of this phase.

### Phase D — post-apply security and player proof

Use two synthetic, fictional test users and disposable fictional block data. Verify all of the following:

| Scenario | Required result |
|---|---|
| Anonymous reads or writes player/world tables | Denied or empty according to policy |
| User A direct browser write to placements | Denied |
| User B direct browser write to User A's placements | Denied |
| User A reads owned placements | Allowed |
| User B reads User A's placements | No rows returned |
| User A places/removes crew through Flask | Accepted only for an owned block and owned deployable crew |
| Invalid, duplicate, occupied, blocked-cell, or foreign-member placement | Rejected with prior server-confirmed roster retained |
| Projection and encounter receipt retries | No duplicate economy, heat, morale, or receipt effect |
| Database security/performance advisors | Re-run and captured; known PostGIS extension warning remains separately scoped |

Then execute the canonical returning-player path on desktop and 375×812:

1. Sign in as synthetic User A and complete any required onboarding.
2. Claim a fictional eligible block through the normal authenticated API.
3. Place fictional crew on a valid canonical Strip cell.
4. Complete one connected consequence and collect through existing service boundaries.
5. Reload the same session and verify block DNA, placements, economy, heat/morale, and receipt state.
6. Open a separate browser/incognito session, sign in to the same account, and verify the same accepted server state.
7. Sign in as synthetic User B and verify User A's private state is not visible or mutable.

Capture non-secret timestamps, revision/SHA, target reference, viewport, pass/fail results, and redacted request/response summaries. Do not capture tokens, service-role keys, passwords, secret values, or real-user data.

## 5. Stop conditions

| Stop condition | Required response |
|---|---|
| Target is production, unknown, or not isolated | Do not link or run any remote command |
| Any tool proposes migration 007 as unapplied or offers to repair history | Stop; preserve the known version mismatch and do not apply, replay, use SQL Editor, or repair blindly |
| Flask is not configured with a server-only service-role credential | Stop; do not restore browser table grants |
| Direct browser placement writes appear necessary | Treat as an architecture regression; return to the canonical Flask command |
| RLS exposes one user's private state to another | Stop, preserve evidence, and repair policies in a new source-reviewed migration |
| Placement rejection leaves optimistic client state confirmed | Stop and repair the existing queue/result boundary; do not add a parallel writer |
| Any proof requires real people, real gangs, or production records | Replace with fictional synthetic fixtures |
| Any release or production action is proposed | Return to issue #171 and its separate approval gates |

## 6. Definition of done

Issue #175 may close only when the reconciled staging target and migration-007 apply evidence are recorded, post-apply advisors and two-user RLS/direct-write checks pass, and the canonical authenticated loop survives reload plus a same-account second session on desktop and 375×812.

Success proves an isolated staging boundary. It does **not** authorize production migration, Vercel promotion, external beta, payment enablement, a recurring scheduler, or broader client grants.

## 7. References

- `docs/AI_CONTRIBUTOR_START_HERE.md`
- `docs/PROJECT_LOG.md`
- `docs/AI_MANUS_AUTHORITATIVE_WORLD_DESIGN.md`
- `docs/AUTHORITATIVE_WORLD_STAGING_PROOF.md`
- `docs/SUPABASE_PREVIEW_BOOTSTRAP.md`
- `backend/supabase/world-proof-manifest.json`
- `frontend/src/stores/blockStore.ts`
- `frontend/src/hooks/useBlockSync.ts`
- `frontend/src/hooks/__tests__/useBlockSync.test.tsx`
- `frontend/src/services/api.service.ts`
- `backend/python/api/blocks.py`
- `backend/python/services/db.py`

External guidance: Supabase recommends `SECURITY INVOKER` by default; any `SECURITY DEFINER` function must set a safe `search_path` and restrict execute privileges. That guidance reinforces the decision not to add a redundant definer function when the trusted server command already owns the mutation.
