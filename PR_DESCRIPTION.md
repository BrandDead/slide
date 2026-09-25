# Saved-Game Placement RPC (Auth Proof Pre-requisite)

## Outcome

Authenticated players can now persist block placements through an ownership-checked RPC, closing the last direct-write gap before migration 007 removes direct table grants from the `authenticated` role.

## Scope

**In:**
- `backend/supabase/migrations/008_placement_persistence_rpc.sql` — new `persist_block_placements` RPC
- `frontend/src/services/blockPersistence.service.ts` — prefer RPC over direct writes for UUID blocks
- `frontend/src/services/blockPersistence.service.test.ts` — test RPC path and fallback
- `backend/supabase/world-proof-manifest.json` — add migration 008 to canonical set

**Out:**
- Migration 007 application (operator checklist only; not automated)
- Two-user RLS smoke test (post-007 verification)
- End-to-end saved-game proof (separate after 007 is applied)
- gangService cleanup (dead code, not imported; separate cleanup PR)
- Flask placement API changes (already authoritative)

**Reserved files:**
- blockPersistence.service.ts
- blockPersistence.service.test.ts
- world-proof-manifest.json

## Contracts Preserved

- **Block ownership check:** RPC validates `blocks.owner_id = auth.uid()` before any write
- **Atomic replace:** Deletes existing + inserts new placements in one transaction
- **Fallback compatibility:** Legacy direct-table path retained for non-UUID blocks and RPC-unavailable scenarios (will fail after migration 007, which is acceptable)
- **Demo isolation:** Demo mode never calls Supabase persistence (unchanged)
- **Idempotency:** Placement writes are atomic; no partial states

## Verification

### Focused Tests

- ✅ Ownership-checked RPC path for UUID-backed blocks
- ✅ Legacy fallback when RPC is unavailable (PGRST202)
- ✅ Payload structure matches RPC JSONB parameter contract

### Full Validation

**CI will run:**
- `npm run validate` (lint, typecheck, full test suite, asset audit)
- Backend `pytest`
- Production build

**Manual verification (after CI):**
- Deploy to staging with migrations 000-008
- Sign in → claim block → place crew → reload → placement persists
- Second device → sign in → same crew placement visible

### Acceptance Criteria

This PR is ready to merge when:
1. GitHub CI passes (Frontend + Backend checks)
2. Reviewer confirms SQL RPC follows established pattern (compare to `persist_player_block_projection`)
3. No regressions in existing placement tests

**After merge:** Apply migration 007 + 008 to staging via operator checklist (documented in `docs/SAVED_GAME_READINESS_2026-09-25.md`).

## Operational Impact

**Migrations:**
- New: `008_placement_persistence_rpc.sql` (source-only; not applied)
- Manifest updated: migration 008 added to canonical set
- No production change; staging-only target remains `dealt-world-proof-staging`

**RLS:**
- No RLS changes in this PR (migration 007 contains RLS hardening)
- RPC uses SECURITY DEFINER with explicit ownership check

**Secrets / Scheduler:**
- No changes

**Rollback:**
- Revert this PR before applying migration 007
- OR drop the RPC after application: `DROP FUNCTION public.persist_block_placements(UUID, JSONB);`

## Integration Notes

**Dependencies:**
- Builds on PR #165 (migration 007 source merge)
- Blocks migration 007 application until this merges (or operator accepts broken fallback)

**Conflicts:**
- None expected (net-new migration, focused service edit)

**Do not merge before:**
- CI passes
- Reviewer approval

**After merge, operator must:**
1. Review `docs/SAVED_GAME_READINESS_2026-09-25.md`
2. Apply migrations 007 + 008 to `dealt-world-proof-staging` only
3. Run two-user RLS smoke test
4. Perform end-to-end saved-game proof (sign in → play → reload → second device)

## Evidence Artifacts

**Code Structure:**
- RPC follows `persist_player_block_projection` pattern (SECURITY DEFINER, `auth.uid()` check, JSONB payload)
- Frontend service prefers RPC, falls back to direct writes only when unavailable
- Test coverage: RPC success path, ownership validation, legacy fallback

**Next Steps After Merge:**
1. Operator applies migration 007 + 008 to staging
2. Two-user RLS proof (User A cannot see/write User B's placements)
3. End-to-end saved-game proof (documented in readiness doc)
4. Record evidence in `docs/AUTHENTICATED_SAVED_GAME_STAGING_PROOF.md` (parallel to authoritative-world proof)
