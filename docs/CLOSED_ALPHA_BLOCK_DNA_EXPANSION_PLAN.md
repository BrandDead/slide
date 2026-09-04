# Closed-Alpha Block DNA Expansion Plan

**Branch:** `feature/closed-alpha-block-dna-expansion`

**User outcome:** A player chooses among a larger set of clearly different fictional blocks, understands the risk/reward of each territory, and sees that choice affect placement, income, exposure, and encounters.

## Why this branch exists

Issue #80 calls for 30–40 premade playable block archetypes while deferring an external map provider as gameplay authority. The current library is already a useful foundation; this sprint extends it in small, testable batches rather than introducing a procedural-address system.

## In scope

1. Audit the existing Block DNA catalog and identify missing strategic roles across income, cover, exposure, access lanes, crowding, and heat pressure.
2. Create one generated visual target for the expanded fictional territory library before player-facing art/code work begins.
3. Add the first coherent batch of 8–12 fictional archetypes with distinct economy, tactical, and encounter consequences.
4. Preserve deterministic block selection, claim persistence, member placement, combat preparation, and existing asset-budget constraints.
5. Add catalog/resolver tests and a claim-to-encounter smoke path for each strategic family.

## Out of scope

This branch will not depend on Mapbox or real-world properties, rewrite the combat engine, alter the core 8×8 placement contract, add monetization, or claim that a generated image represents a real location.

## Design families for the first batch

| Family | Player trade-off | Example fictional archetype direction |
|---|---|---|
| Street commerce | High turnover and exposure | Neon corner market, late-night food strip |
| Covered interior | Lower turnover and stronger defense | Arcade plaza, backroom warehouse row |
| Transit edge | Fast opportunities with unpredictable heat | Bus depot approach, bridge underpass block |
| Waterfront/service | Moderate income with longer lanes | Marina service lane, repair-yard frontage |
| Dense residential | Loyalty and recruitment, tight movement | Courtyard walkups, rowhouse alley grid |
| Industrial fringe | Stash/cover utility, low visibility | Freight spur, fenced loading bay |

## Acceptance criteria

| Area | Evidence required |
|---|---|
| Creative direction | Generated visual target is reviewed and recorded outside runtime assets. |
| Catalog quality | Each new DNA entry has a documented strategic identity; no duplicate stat-only variants. |
| Determinism | The same claim inputs resolve to the same DNA/tactical snapshot. |
| Player impact | Income, exposure, cover, placement, or encounter preparation differs meaningfully by family. |
| Safety | All locations, crews, events, and outcomes remain fictionalized. |
| Verification | Focused tests, full frontend checks, asset audit, production build, and browser claim/placement/encounter smoke pass. |

## First implementation pass

Read the current Block DNA resolver and tests, inventory the existing entries, then create the visual target. Select the first batch only after the catalog gaps and visual target agree; do not create a large unreviewable content dump.
