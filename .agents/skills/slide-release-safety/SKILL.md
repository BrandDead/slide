---
name: slide-release-safety
description: Regression-first implementation and review guard for every DEALT/SLIDE gameplay or shared-behavior change, including React/TypeScript/Zustand, Flask/Python, async and persistence paths, mini-games, PR review, review-finding responses, and merge readiness. Prevents stale closures, coupled cleanup, incomplete domain records, duplicate actions/results, fallback data loss, disconnected state, and code-only verification.
---

# SLIDE Release Safety

Ship the smallest verified player outcome. Treat a passing build as necessary but insufficient.

Read, in order:

1. `AGENTS.md`
2. `docs/AI_CONTRIBUTOR_START_HERE.md`
3. `docs/PROJECT_LOG.md`
4. The assigned issue, open PR stack, and current file reservations
5. [Review failure modes](references/review-failure-modes.md)

## Workflow

1. **Confirm the live path.** Trace the player action from the UI through component, store/service, typed result, persistence, and return UI. Search for existing or unmerged implementations before creating a new system.
2. **Reserve scope.** State the player outcome, exact files, forbidden files, dependencies, and acceptance checks. Reserve files on the issue before editing. Do not work around a conflicting reservation.
3. **Write a failing regression first.** Reproduce the bug through public behavior. For a new feature, write the acceptance test before implementation. Run it against the unmodified base and record that it fails for the expected reason.
4. **Implement the narrow fix.** Reuse the current store, service, resolver, result boundary, and types. Do not create parallel state or bypass idempotency/persistence.
5. **Exercise interaction order and repetition.** Test the on-screen order, a reversed order, invalid-after-valid input, retry, replacement during async work, double-click/double-tap, unmount/remount, and reload when applicable. For sparse poll/approve responses, merge only defined fields and assert prior URLs, metadata, and generated fields survive. For remove/reseed flows, run remove → add → reload twice and assert unique logical IDs and rendered keys.
6. **Prove domain completeness.** Construct complete typed records. Never use `as any` to satisfy a domain object. Verify required defaults, IDs, relationships, timestamps, stats, health, morale, inventory, and persistence fields.
7. **Prove shared consequences once.** Cash, heat, morale, crew state, inventory, territory, and encounter outcomes must update through one authoritative boundary exactly once.
8. **Run gates.** Run the focused test, then `scripts/preflight.sh <focused-test-path-or-pattern>`. If player behavior changed, run the real path at phone and desktop widths and capture the happy path plus one realistic failure path.
9. **Review the diff as a skeptic.** Inspect every hook dependency, cleanup function, asynchronous merge, fallback, key, loading/disabled state, optional value, and new warning. Reject replacement-object merges unless a regression proves no richer local field is erased. Compare warning count to the base; do not normalize a new warning as “pre-existing.”
10. **Open one focused PR.** Include failing-before/passing-after evidence, full gate results, browser path, known limits, operational impact, dependency order, and files intentionally not touched. Do not merge or deploy.

## Required acceptance matrix

| Surface | Minimum proof |
|---|---|
| Pure logic | Boundary, invalid input, deterministic output |
| React interaction | User-visible order, rerender/state freshness, disabled/loading state |
| Async job | queued → running → ready/failed; replacement and unmount cleanup |
| Mutation | double action does not duplicate; retry remains safe |
| Domain record | complete typed shape; no `any`; survives persistence/reload |
| Shared game state | one store/result boundary; consequences applied once |
| Failure mode | service unavailable or fallback is explicit and non-destructive |
| Map/backend dependency | With optional street context or backend unavailable, Strip/board, recon, claims, placement, and response routes remain usable; fallback is honest and preserves player input |
| Player path | phone + desktop; happy path + realistic failure; no page errors |

## Stop conditions

Stop and report instead of guessing when:

- The intended authoritative store/result boundary is unclear.
- The task conflicts with an open reservation or stacked PR.
- A migration, RLS, secret, scheduler, production target, or deployment is required but not explicitly authorized.
- A fallback would pretend success while discarding the player's input.
- Tests cannot be made to fail on the base because the reported bug is not reproducible.

## Completion report

Return:

- Branch and PR URL
- Player outcome
- Changed and intentionally untouched files
- Regression that failed before and passed after
- Focused/full/build/browser results with counts
- New warnings compared with base
- Known limitations and integration order
