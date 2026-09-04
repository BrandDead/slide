# Closed-Alpha Block DNA Expansion — Batch One

**Branch:** `feature/closed-alpha-block-dna-expansion`
**Scope:** Eight fictional tactical archetypes added as data, not a new map authority, combat system, or asset dependency.

## Product outcome

A returning player should recognize that each claim is a meaningful strategic choice before any tactical placement begins. This batch widens the existing catalog from seventeen entries to twenty-five without presenting a procedural location generator as a gameplay system. The identifier, tags, zone layout, projection values, income opportunity, heat persistence, cover, morale, and crew capacity together form the block's playable identity.

> Street context may be based on the player’s chosen address, but each Block DNA entry remains a fictional gameplay archetype. The catalog does not represent or claim any real property.

## Visual target

`/home/ubuntu/slide-artifact-audit/block_dna_expansion_batch_reference.png` is a **review-only** art-direction reference. It shows port, elevated transit market, canal, and service-district silhouettes in the established tropical-noir oblique-diorama language. It is not copied into the runtime asset bundle.

## Archetype matrix

| ID | Fictional role | Tactical identity | Economy and heat posture | Strategic reason to choose it |
|---|---|---|---|---|
| `harbor-spur` | Harbor freight interchange | Long parking approach, loading-bay depth, hard cover | Strong income; lingering heat | Holds a larger crew but exposes a wide street edge. |
| `rail-market` | Elevated rail market | Dense storefront and roof lanes | High turnover; high initial heat | Rewards early pressure and rapid responses. |
| `canal-court` | Canal cul-de-sac | Bridge choke point, quiet rear lanes | Lower income; fast heat decay | A forgiving defensive foothold for a small crew. |
| `stadium-service` | Stadium service district | Broad lots, utility fence, service corridors | High income; police attention | Trades capacity and access for more demanding heat management. |
| `night-market` | Late-night corner market | Street-facing commerce and rear alley exit | Steady income; medium heat | A flexible mid-game all-rounder. |
| `courtyard-walkups` | Residential courtyard | Tight alleys and building cover | Moderate income; high morale | Rewards careful placement and resilient defenders. |
| `floodgate-repair` | Waterfront repair lane | Mixed curb, dockside lot, enclosed workshop | Balanced income and heat | Suits a crew that needs varied staging depth. |
| `ring-road-underpass` | Elevated ring-road block | Covered frontage and hidden parking | Modest income; high cover | Offers a low-visibility control point with limited scale. |

## Compatibility contract

The implementation may add descriptive `BlockTag` values, but it must preserve the established `BlockDNA` public shape and 8-row `BlockZoneType` contract. The resolver remains responsible for deterministic selection, projection merging, offline layouts, and claim-to-encounter handoff. No rendered map provider, new runtime art, or new player action is required.

## Acceptance evidence

| Check | Expected evidence |
|---|---|
| Catalog integrity | Twenty-five unique identifiers; each new entry has a distinct stat/layout signature. |
| Family representation | All eight archetypes cover one documented strategic role. |
| Determinism | Identical resolver inputs produce identical IDs, zone layouts, and projection snapshots. |
| Gameplay bridge | Claim data retains DNA modifiers; encounter target resolution retains its zone layout and projection. |
| Regressions | Focused Block DNA tests, complete frontend suite, TypeScript, asset audit, and production build pass. |
| Player review | A closed-alpha demo can inspect a new archetype’s tactics without depending on street-map availability. |
