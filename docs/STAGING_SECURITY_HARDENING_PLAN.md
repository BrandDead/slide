# Staging Saved-Game Security Hardening Plan

**Status:** Source-controlled remediation prepared for review; not applied to Supabase.
**Target after approval:** the isolated, non-production project `dealt-world-proof-staging` (`zfgclgnyqlabttymxwuw`).
**Production:** explicitly out of scope.

## Purpose

The authoritative-world proof established that the current migration set can build the core durable-world tables and that the two player RPCs and service-only Ghost Crew tick have the expected access boundary. A later read-only staging reconciliation found additional public-schema hygiene issues that must be corrected before authenticated saved-game work is connected to this project. This document records the corrective scope in repository source before a staging operator applies anything.

The corrective migration is additive: [`007_staging_saved_game_security_hardening.sql`](../backend/supabase/migrations/007_staging_saved_game_security_hardening.sql). It is listed last in the disposable proof manifest. It does not amend migrations `000` through `006`, mutate data, create a scheduler, deploy functions, enable payments, or alter Auth configuration.

## Remediation model

| Surface | Prior staging condition | Source-controlled treatment | Reason |
|---|---|---|---|
| `spatial_ref_sys` | PostGIS extension table in the public schema triggered an RLS advisory | Do not change it in this migration | Enabling RLS or changing extension-managed grants can break spatial functions. A dedicated PostGIS relocation/compatibility plan is required; the advisory is intentionally retained and documented. |
| Block backgrounds and anchors | RLS disabled; written by server-side map generation | Enable RLS and make client access service-only | They contain optional map context and precise grid coordinates; the backend uses a service role. |
| `world_ticks` and `payment_events` | RLS on but no policies; role intent implicit | Explicitly revoke browser access and state service-only policies | They are operational/idempotency ledgers, not player data. |
| Player/world tables | Most policies were scoped to `public` | Replace with explicit `authenticated` policies and grants | Narrows the browser trust boundary and stops anonymous reads. |
| Direct durable writes | Some legacy client methods could write game state directly | Do not grant direct browser writes in the staging hardening migration | The next saved-game slice must introduce specific ownership-checked RPC/API commands instead of making broad table writes permanent. |
| Security-definer functions | Four helpers had mutable search paths and broad function grants | Fix search paths; restrict public/anonymous execution; preserve intended player and service calls | Prevents search-path abuse and makes callable roles explicit. |
| PostGIS extension schema | Extension remains installed in `public` | No blind move in this migration | Moving it can break geography types, functions, indexes, and existing migrations; it needs a separate compatibility plan. |

## Important functional limit

This migration deliberately restricts profile reads to the signed-in player’s own record. Existing legacy client helpers that fetch another player profile or query a public leaderboard are **not** an approved saved-game contract after this migration. The closed-beta demo does not rely on those remote reads. Before multiplayer contacts, public leaderboards, or opponent cards use staging, they require a dedicated safe projection—such as a restricted view or read-only RPC exposing only the fields approved for discovery. No private cash, inventory, receipts, or profile settings should be included in that future projection.

The repository also retains legacy direct-table fallback code for block upserts, Block DNA projection writes, and placement replacement. The normal staging path already uses `persist_player_block_projection` for a UUID-backed block, and the source migration intentionally denies the fallback writes rather than preserving a second, unbounded browser mutation path. Therefore, this migration must not be presented as a complete authenticated-save launch by itself: the next saved-game command slice must remove or replace those fallbacks with narrowly validated RPC/API commands, including a server-owned Block DNA and placement command. Until that slice lands, a missing or unavailable projection RPC fails closed and leaves the last confirmed state in place.

## Verification sequence after review

The Supabase operator must first use the source-controlled manifest and the disposable workdir generator. The apply target must be confirmed as `dealt-world-proof-staging`; production must remain untouched. The operator should record the migration dry-run, apply the reviewed `007` migration, and re-run both database security and performance advisors.

A two-user proof then tests both positive and negative cases with disposable accounts. User A must be able to read only User A’s profile-private state, inventory, owned block placement, economy entries, encounter receipts, and entitlements. User B must be denied corresponding reads and writes. Anonymous access must be denied for all player/state tables. The Ghost Crew tick must remain service-only, and the existing authenticated encounter and block-projection RPCs must remain callable only under their ownership checks. The proof should run in rollback transactions where possible and retain only minimal, non-sensitive evidence.

Auth configuration is a separate dashboard concern. Before real sign-in testing, verify—not modify—that email/password is configured as intended and the exact staging callbacks are limited to `https://slide-git-main-tl2525-steve-wessels-projects.vercel.app/auth/callback` and `http://localhost:5173/auth/callback`. Wildcards, production custom domains, and copied production secrets are not permitted in this staging proof.

`handle_new_user()` is Auth-triggered. This migration fixes its search path but intentionally does **not** revoke its current function grant. The future two-user signup proof must confirm the actual trigger execution context and then decide whether its grant can be narrowed without breaking profile creation. The game-owned RPC grants are narrowed now because their callers and role contracts are explicitly known.

## Explicit non-goals

This work does not promote anything to production, configure Vercel, retrieve secrets, alter Auth settings, run an Edge Function, create a recurring job, expose a payment product, delete data, or reset the staging project. The PostGIS `spatial_ref_sys` advisory is intentionally retained for a dedicated extension-schema compatibility plan; it is not safe to fix by blindly enabling RLS or moving extension-owned objects. Index warnings are likewise recorded for later workload assessment, not treated as a reason to drop indexes.

## Acceptance criteria

The hardening PR is acceptable only when the static migration contract test passes, the world-proof manifest validator accepts the new ordered migration set, all existing backend tests remain green, and the diff shows no environment or secret change. A separate integration owner must then review it before Supabase applies it to staging. A green source PR is not equivalent to a completed live RLS proof.
