# Closed-Alpha Sprint Board

**Baseline:** `main-tL2525` at merge commit `8bf9e62` (Returning Empire City Briefing)

**Product outcome:** A closed-alpha player can return to a durable fictional empire, understand what changed, and act safely through the existing territory/crew/economy loop.

## Sprint focus

The sprint deliberately prioritizes **truthful world state** and **resilient strategic play** over another mini-game, commerce, or multiplayer expansion. It does not change the project’s fictional-world boundary: map context may use real places, while gameplay territories, crews, events, and outcomes remain fictionalized.

| Priority | Branch | Outcome | Scope boundary | Acceptance evidence | Status |
|---:|---|---|---|---|---|
| P0 | `ops/closed-alpha-world-proof` | Prove migrations, RLS, guarded ticking, idempotency, and returning-player delivery in a disposable Supabase target. | No production migration, scheduler, or live secret configuration. | Every entry in `NONPRODUCTION_AUTHORITATIVE_WORLD_PROOF.md` recorded as pass/fail. | **Blocked**: target project must be explicitly identified as non-production. |
| P1 | `fix/closed-alpha-map-resilience` | A territory review remains playable when the external streets/buildings layer is slow, unavailable, or denied. | Do not change fictional territory logic or make Mapbox a gameplay authority. | Timeout/error fallback, usable Home Block/territory controls, unit tests, demo smoke, and visual proof. | **Ready** |
| P1 | `feature/closed-alpha-block-dna-expansion` | Expand the playable fictional block library toward issue #80’s 30–40 distinct strategic archetypes. | No real-address dependence; no unrelated engine rewrite; visual assets require a generated art target before implementation. | Catalog diversity, deterministic resolver coverage, claim/encounter smoke, asset audit, and a reviewed visual target. | **Ready for design** |

## Branch contracts

### `ops/closed-alpha-world-proof`

This branch owns the operational runbook and evidence record only. It may add test-safe proof scripts after an explicit non-production target is selected. It must not include frontend gameplay changes, modify the default branch directly, or enable a recurring scheduler.

### `fix/closed-alpha-map-resilience`

This branch owns only the map provider’s loading/error/timeout experience and the fallback strategy surface. It must preserve current map selection, City Briefing target routing, and the `TerritoryMap` authority boundary. It should be independently reviewable and safe to merge even if the non-production proof remains blocked.

### `feature/closed-alpha-block-dna-expansion`

This branch owns the fictional archetype catalog, its tactical/economy trade-offs, deterministic selection behavior, and authored visual direction for any new player-facing art. It must not make a real address or external map response a prerequisite for a playable block.

## Recommended execution order

1. Identify a non-production Supabase target and execute the operations proof without enabling a scheduler.
2. In parallel, complete map resilience because it removes the primary player-visible interruption observed during the City Briefing action path.
3. Start the Block DNA design pass with one generated art target, then add content in small batches that each preserve existing claim/placement/encounter contracts.
4. Review integration order only when each branch has isolated tests and a clear player-path smoke result.

## Explicitly deferred

Additional game engines, broad multiplayer, payments, automatic production world scheduling, and a general map-provider rewrite are not part of this sprint. They become candidates only after the non-production proof and map fallback path are evidenced.
