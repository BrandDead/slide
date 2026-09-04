# Closed-Alpha Sprint Integration — Map Resilience + Block DNA Batch One

**Integration branch:** `integrate/closed-alpha-map-block-dna`
**Sources:** PR #126 (`fix/closed-alpha-map-resilience`) and PR #127 (`feature/closed-alpha-block-dna-expansion`)
**Status:** Local integration complete; ready for a final review pull request.

## Player outcome

This release candidate closes two independent closed-alpha gaps without changing the canonical command desktop, persistent-world contract, combat engine, or database schema. A player can now keep using territory strategy when optional street-map context fails, while the curated territory library provides eight additional fictional risk/reward archetypes that feed the existing claim, placement, rival, and encounter paths.

## Integration result

The two source pull requests were independently clean with completed frontend CI, backend CI, and Vercel preview checks. Their only conflict was a simultaneous append to `ASSETS.md`; the integration preserves both review-only visual targets and retains the existing rule that neither image is a runtime asset. No runtime code conflict occurred.

| Source | Delivered behavior | Combined result |
|---|---|---|
| PR #126 | Bounded optional-map loading, clear recovery UI, tactical-board fallback, preserved recon/claim/attack/crew routes, queued-timeout safeguard. | Street-map outage no longer prevents territory strategy or crew placement. |
| PR #127 | Eight data-driven fictional Block DNA archetypes, catalog/resolver tests, and canonical encounter bridge test. | Catalog grows from 17 to 25 distinct archetypes while the existing deterministic resolver and 8-row placement contract remain unchanged. |

## Validation evidence

| Check | Result |
|---|---|
| Combined frontend suite | **55 files / 733 tests passed** |
| TypeScript | Passed |
| Asset audit | Passed |
| Production build | Passed |
| Combined backend suite | **42 tests passed** |
| Static diff check | Passed after conflict resolution |
| Browser — forced map failure | Recovery card retained War Room, City Briefing, territory summary, Maps/Strip/Crew paths, and retry/tactical actions. |
| Browser — crew placement under outage | Selecting Big Rome from Drop crew moved the player to the existing Strip grid with actionable recovery guidance. |
| Browser — Block DNA runtime consumption | Deterministic Ghost Crew activity produced a visible `Canal Court` claim event during the combined session. |
| Canonical encounter bridge | Harbor Spur resolves to distinct parking and alley terrain plus Harbor Spur tactical briefing. |

## Release gates

The integration pull request must re-run standard frontend CI, backend CI, preview deployment, and automated review against the merged combination. A production deployment requires no database change from this release candidate. The separate non-production migration/RLS/world-tick proof remains the next operational gate, pending identification of a confirmed safe Supabase target.
