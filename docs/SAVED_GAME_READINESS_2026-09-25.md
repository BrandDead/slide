# Saved-Game Readiness Inventory — 2026-09-25

**Branch:** `main-tL2525` @ `390cc78`
**Target:** `dealt-world-proof-staging` (`zfgclgnyqlabttymxwuw`) — non-production
**Audit status:** Keep amber; no merge #157/#169; no prod promote

## Executive Summary

**Source readiness:** The authenticated saved-game foundation exists on `main-tL2525`. Auth session restore, block/encounter persistence RPCs, Flask empire hydration, Supabase block sync, and demo-ledger isolation (#149) are merged and tested.

**Staging schema status:** Migration 007 is **merged in source** (PR #165) and listed in the world-proof manifest, but **NOT yet applied** to the staging target. It hardens RLS, removes direct browser table writes, and requires ownership-checked RPC/API commands.

**Next slice:** ONE code PR adding a placement-persistence RPC before applying migration 007, OR a human-operator staging apply checklist if the RPC is deemed unnecessary and the fallback can safely fail.

---

## 1. Current Inventory (What Exists on main-tL2525)

### 1.1 Auth Session Restore ✅

| Component | Status | Location |
|-----------|--------|----------|
| Supabase auth session check | ✅ Merged | `App.tsx` lines 176-183 |
| Auth state change listener | ✅ Merged | `App.tsx` line 180 |
| Player identity hydration | ✅ Merged | `utils/authPlayer.ts`, `hydrateAuthenticatedPlayer` callback |
| Account switch detection | ✅ Merged | `isAccountSwitch()` — resets state on account change |

**Evidence:** `App.tsx` calls `supabase.auth.getSession()` on mount and subscribes to `onAuthStateChange`. The `hydrateAuthenticatedPlayer` callback updates `usePlayerStore` with identity from the Supabase `User` object.

**Second-device readiness:** Session restoration works. If a user signs in on device B with the same Supabase account as device A, the auth session will restore correctly.

---

### 1.2 Block Persistence (persist_player_block_projection) ✅

| Component | Status | Location |
|-----------|--------|----------|
| `persist_player_block_projection` RPC | ✅ In migration 006 (applied to staging) | `migrations/006_authoritative_world_integrity_hardening.sql` lines 1-93 |
| Frontend atomic write | ✅ Merged | `blockPersistence.service.ts` lines 90-108 |
| Receipt ledger tracking | ✅ Merged | `appliedEncounterResultKeys` in block metadata |
| Stale-projection guard | ✅ Merged | RPC returns `applied: false` when client key is stale |
| Legacy fallback path | ⚠️ Exists | Lines 115-137: direct `.from('blocks').upsert()` when RPC is missing |

**Evidence:** The RPC exists in migration 006, which was applied to staging during the September authoritative-world proof. The frontend calls it for UUID-backed blocks and falls back to direct upsert only when the RPC is unavailable (PGRST202 or 42883 error).

**After migration 007:** The fallback path will fail because 007 revokes direct `INSERT/UPDATE` grants on `blocks` from `authenticated`. The app MUST use the RPC.

---

### 1.3 Placement Persistence ⚠️

| Component | Status | Location |
|-----------|--------|----------|
| Placement RPC | ❌ Does not exist | No `persist_block_placements` RPC in migrations |
| Direct Supabase writes | ⚠️ Active | `blockPersistence.service.ts` lines 228-257 |
| Flask placement API | ✅ Merged | `api/blocks.py` `/place` route writes via DBAdapter |

**Evidence:** The `persistPlacements()` function directly deletes from and inserts into `block_placements` table. There is no RPC alternative.

**After migration 007:** Direct writes to `block_placements` will fail because 007 revokes `INSERT/DELETE` grants from `authenticated`. The app relies on Flask `/api/blocks/place` for authoritative placement, but Supabase `useBlockSync` still tries direct writes on debounce.

**Gap:** Need either:
- A `persist_block_placements` RPC (similar to block projection), OR
- Remove the direct Supabase placement writes and rely solely on Flask placement API + read-only Supabase SELECT

---

### 1.4 Encounter Receipt Persistence (commit_encounter_result) ✅

| Component | Status | Location |
|-----------|--------|----------|
| `commit_encounter_result` RPC | ✅ In migration 006 (applied to staging) | `migrations/006_*` |
| Frontend idempotent submit | ✅ Merged | `worldPersistence.service.ts` lines 135-157 |
| Block Loop ledger restore | ✅ Merged | `blockStore.encounter.test.ts` proves replay-safe ledger |
| Demo isolation | ✅ Merged | PR #149 — demo player never writes to server receipts |

**Evidence:** The `commitEncounterResult()` function submits a typed receipt keyed by `result.idempotencyKey`. The RPC rejects duplicate keys. Demo mode explicitly skips the call.

---

### 1.5 Empire / Save Hydration ✅

| Component | Status | Location |
|-----------|--------|----------|
| Flask player state hydration | ✅ Merged | `useEmpireHydration.ts` calls `/api/player/state` and `/api/blocks/my-blocks` |
| Supabase block sync | ✅ Merged | `useBlockSync.ts` loads `blocks` and `block_placements` from Supabase |
| Dual-source merge strategy | ✅ Merged | Block sync merges Flask canonical grid + Supabase durable receipts |
| Persist rehydration guard | ✅ Merged | App.tsx lines 161-173 — demo seed after persist hydration |

**Evidence:** On authenticated mount, `useEmpireHydration` loads player cash/heat/level and owned blocks from Flask. `useBlockSync` loads durable receipt projections from Supabase and unions them with Flask's canonical grid.

**Second-device readiness:** Both Flask and Supabase hydration run on auth session restore. A second device will load the same Flask state and Supabase receipts.

---

### 1.6 Demo Ledger Isolation ✅

| Component | Status | Location |
|-----------|--------|----------|
| Demo account gating | ✅ Merged | PR #149 |
| Signed-in ledger boundary | ✅ Merged | Block Loop ledger is owned by `demo-player` only |
| Receipt isolation | ✅ Merged | `IS_DEMO_MODE` guards in `worldPersistence.service.ts` |

**Evidence:** The demo ledger is explicitly an evaluation convenience. Signed-in or unrecognized player identities never read or write the demo browser ledger.

---

## 2. Migration 007 Status

| Aspect | Status |
|--------|--------|
| Source | ✅ Merged in PR #165 |
| Manifest entry | ✅ Listed as migration #7 in `world-proof-manifest.json` |
| Applied to staging | ❌ NOT applied |
| Applied to production | ❌ Forbidden (non-production target only) |

**Migration 007 changes:**
1. Enables RLS on `block_backgrounds`, `block_grid_anchors`, `world_ticks`, `payment_events`
2. Revokes ALL direct table writes from `anon` and `authenticated` roles on player/world tables
3. Grants only SELECT to `authenticated` on most tables
4. Replaces broad `public` policies with explicit `authenticated` policies
5. Fixes security-definer function search paths
6. Restricts `get_leaderboard` to service-role only

**Impact on current code:**
- ✅ Block projection RPC already exists → no break
- ✅ Encounter receipt RPC already exists → no break  
- ⚠️ Direct `.from('blocks').upsert()` fallback → will fail (acceptable if RPC is always available)
- ❌ Direct `.from('block_placements')` writes → will fail (no RPC alternative exists)

---

## 3. Remaining Gaps for Authenticated Saved-Game Proof

### 3.1 Code Gaps

| Gap | Impact | Severity |
|-----|--------|----------|
| No placement RPC | `persistPlacements()` will fail after migration 007 | 🔴 Blocks saved-game proof |
| Legacy block upsert fallback | Falls back to direct write when RPC unavailable | 🟡 Acceptable if RPC always exists |
| gangService direct writes | Unused dead code in `supabase.ts` | 🟢 Safe (not imported anywhere) |

### 3.2 Operational Gaps

| Gap | Required Action |
|-----|----------------|
| Migration 007 not applied | Human operator must materialize manifest, dry-run, apply to staging only |
| Two-user RLS smoke test | Prove User A reads only User A's data; User B denied |
| End-to-end saved-game proof | Sign in → play → reload → same state; second device restores |
| PostGIS `spatial_ref_sys` advisor warning | Retained for separate extension-schema compatibility plan |

---

## 4. Proposed Next Slice

### Option A: Code PR — Create placement RPC (RECOMMENDED)

**Outcome:** Add a `persist_block_placements(p_block_id UUID, p_placements JSONB)` RPC that:
- Accepts ownership-checked placement array from authenticated role
- Validates block ownership via `blocks.owner_id = auth.uid()`
- Atomically deletes existing + inserts new placements
- Returns success/failure without exposing other players' placements

**Files:**
- New: `backend/supabase/migrations/008_placement_persistence_rpc.sql`
- Edit: `frontend/src/services/blockPersistence.service.ts` — call RPC instead of direct writes
- Edit: `backend/supabase/world-proof-manifest.json` — add migration 008
- New: `frontend/src/services/blockPersistence.service.test.ts` — prove RPC path

**Acceptance:**
- Offline pytest + frontend vitest pass
- Manual: sign in → place crew → reload → placement persists
- Manual: User A cannot write User B's placements

**Why first:** Closes the last direct-write gap before applying migration 007. After this PR + migration 007, all browser saves go through ownership-checked RPCs.

---

### Option B: Operator Checklist — Apply 007 without placement RPC

**Rationale:** If the team decides that:
- Placement persistence should remain Flask-only (client reads from Supabase but writes via Flask API), OR
- The Supabase placement writes can be removed without replacement

**Checklist (post as issue comment, do NOT execute SQL yourself):**
1. Confirm target is `dealt-world-proof-staging` (`zfgclgnyqlabttymxwuw`)
2. Run `prepare_nonprod_world_proof.py` to materialize workdir
3. Run `supabase db push --dry-run` and verify migration 007 is next
4. Apply migration 007: `supabase db push`
5. Re-run database advisors (security + performance)
6. Two-user RLS smoke test:
   - User A signs in → claims block → places crew → sees own data
   - User B signs in → cannot see User A's blocks/placements/inventory
   - Anonymous role denied for all player tables
7. Remove `persistPlacements()` calls from `useBlockSync` (or accept silent failures)
8. End-to-end saved-game proof:
   - Sign in → play → collect income → encounter → reload → state persists
   - Second device (or incognito session) → sign in with same account → state restores

**Why second:** Only viable if placement RPC is deemed unnecessary. Requires source edits to remove the broken Supabase placement writes.

---

## 5. What is Deliberately OUT OF SCOPE

- ❌ Apply migration 007 to production (non-production target only)
- ❌ Change Auth configuration or Vercel secrets
- ❌ Deploy Edge Functions or enable schedulers
- ❌ Create new Supabase schema beyond migrations 007/008
- ❌ Implement Ghost Crew attack slice (#163) — separate PR
- ❌ Implement payments or entitlement activation
- ❌ Second-device push notifications or realtime presence
- ❌ Public leaderboard or opponent discovery (requires separate safe projection)

---

## 6. Acceptance Criteria for Saved-Game Proof

The proof is complete when:

1. ✅ Migration 007 (+ optional 008) applied to staging only
2. ✅ Two-user RLS smoke test passed (User A isolated from User B)
3. ✅ Database advisors re-run (PostGIS warning expected, others resolved)
4. ✅ Sign in → play → reload → same state (no duplicate money/heat/receipts)
5. ✅ Second device or second session restores same state
6. ✅ Demo mode remains isolated (no server writes)
7. ✅ All existing tests pass (946 frontend, 95 backend)

**Evidence artifacts:**
- Dry-run logs
- Two-user RLS test transcript
- End-to-end saved-game proof video (375×812 mobile + desktop)
- Database advisor output

---

## 7. Recommendation

**Chosen slice:** **Option A — Code PR for placement RPC**

**Why:**
- Closes the last gap before applying migration 007
- Preserves Supabase debounced autosave (complements Flask writes)
- Follows the RPC pattern already proven with block projection
- Allows migration 007 to land cleanly without breaking existing features

**Branch:** `feature/saved-game-placement-rpc`

**Estimated scope:**
- 1 new migration (~50 lines SQL)
- 1 service file edit (~20 lines TypeScript)
- 1 test file addition (~80 lines vitest)
- 1 manifest update (~10 lines JSON)

**After this PR merges:** Apply migration 007 via operator checklist (Option B steps 1-8) to complete the saved-game proof.
