# Alpha Stabilization Integration Report

**Integration branch:** `integration/alpha-stabilization`
**Base branch:** `main-tL2525`
**Date:** September 2, 2026

## Scope

This integration branch combines three independently reviewed, non-overlapping pull requests into one testable release candidate. The merge was assembled only in an isolated local worktree; it does not modify the remote default branch.

| Source pull request | Integrated purpose | Result |
|---|---|---|
| [#121](https://github.com/BrandDead/slide/pull/121) | Production art package pipeline, lifecycle hardening, portable character/PBR packages | Merged cleanly into the integration branch |
| [#122](https://github.com/BrandDead/slide/pull/122) | Player-visible startup recovery boundary for missing service configuration | Merged cleanly into the integration branch |
| [#123](https://github.com/BrandDead/slide/pull/123) | Additive authoritative Ghost Crew and encounter-result foundation | Merged cleanly into the integration branch |

> There were no textual merge conflicts. The integration does not add a second game engine, state manager, real-time combat system, payment system, or broad multiplayer system.

## Combined validation

The combined branch was validated after all three pull-request heads had been merged locally.

| Gate | Result | Evidence |
|---|---|---|
| Frontend validation | Passed | `npm run validate`: 50 test files and 716 tests passed; lint completed with the repository’s existing warnings but no errors; asset audit reported zero errors; five packages passed validation |
| Production build | Passed | Standard production build completed successfully |
| Demo production build | Passed | Explicit `VITE_DEMO_MODE=1` production build completed successfully |
| Backend validation | Passed | `pytest -q`: 42 tests passed; pre-existing `datetime.utcnow()` deprecation warnings remain |
| Migration safety review | Passed | `005_authoritative_world_foundation.sql` is additive and contains no destructive SQL patterns |
| Non-demo startup path | Passed | Missing service configuration renders the styled recovery state with a retry control, rather than a blank frame |
| Demo DEALT path | Passed | DEALT card UI initialized and completed a deterministic failure-state transition when seeded inventory was insufficient |
| Strategy-to-action path | Passed to prerequisite gate | Map/War Room initialized; Ghost Crew target handoff opened the loadout screen and correctly required a driver plus shooter before launch |

## Known non-blocking warnings

The integration retains repository warnings that predate this release candidate. These include 194 frontend lint warnings, legacy static runtime asset references, large bundle chunk warnings, and backend `datetime.utcnow()` deprecation warnings. None failed lint, tests, asset checks, or the production builds. They should be scheduled as technical-debt work, not addressed through unreviewed release-candidate changes.

## Release gates still required

The integration branch is a reviewable candidate, not a production deployment. The following gates must be completed before merging to the default branch or applying live world-state schema changes.

| Gate | Required outcome |
|---|---|
| Source PR #123 automated review | Resolve or explicitly waive the pending Cursor Bugbot Autofix status before final merge approval |
| Integration PR automation | Ensure its GitHub CI, Vercel, and automated review checks complete successfully |
| Human review | Review the three source scopes and this combined report together |
| Database deployment | Apply migration `005_authoritative_world_foundation.sql` first to a non-production Supabase environment and verify RLS plus repeated-RPC idempotency |
| Edge-function deployment | Configure `WORLD_TICK_SECRET` only in server-side deployment secrets before deploying the Ghost Crew tick endpoint |
| Final release decision | Merge the integration pull request only after all checks and deployment gates are accepted |

## Recommended merge policy

Use this integration pull request as the **only** path to merge #121, #122, and #123 into `main-tL2525`. Do not separately merge the original source PRs afterward. After the integration PR is merged and its deployment is verified, close the three source PRs as superseded and delete only their merged remote branches following a separate confirmation.
