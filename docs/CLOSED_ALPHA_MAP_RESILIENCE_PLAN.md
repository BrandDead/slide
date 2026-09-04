# Closed-Alpha Map Resilience Plan

**Branch:** `fix/closed-alpha-map-resilience`

**User outcome:** A player can inspect and act on their fictional territory even when the optional street/building provider is slow, unavailable, or blocked.

## Observed evidence

During the merged Returning Empire player-path review, `Review Defense` correctly opened the territory War Room and retained strategic controls. The external map area remained at `Loading streets and buildings…` in the sandbox. This branch treats that provider as optional geographic context, not as territory authority.

## In scope

1. Identify the external map request lifecycle and expose bounded loading, unavailable, and retry states.
2. Preserve Home Block selection, fictional territory data, map search, crew/placement routes, and rival-response controls when tiles or buildings cannot render.
3. Add an accessible fallback explanation that distinguishes optional geographic context from the playable territory model.
4. Add deterministic tests for timeout/error/fallback behavior and a demo-mode browser smoke test.

## Out of scope

This branch will not change territory ownership rules, replace the game grid, require real addresses for play, introduce a new map vendor, or alter the authoritative-world database contract.

## Acceptance criteria

| Scenario | Expected result |
|---|---|
| Provider loads normally | Existing street/building context remains usable. |
| Provider errors or exceeds a bounded wait | The infinite spinner is replaced by a readable fallback and retry control. |
| Fallback state | Home Block and existing fictional strategy controls remain selectable and actionable. |
| City Briefing route | `Review Defense` still opens the correct selected block context. |
| Accessibility | Fallback status is announced without trapping keyboard or touch users. |
| Verification | Focused tests, full frontend suite, asset audit, build, and browser smoke pass. |

## First implementation pass

Start by locating the map loader, its external request boundary, and the current fallback renderer. Preserve existing route and selected-block contracts before changing presentation. Treat a missing/slow provider as a recoverable display condition, not a gameplay error.
