# Block DNA Batch Three — Final Catalog Completion

**Issue:** #80  
**Branch:** `feature/80-block-dna-batch-three`  
**Status:** Complete locally; pending focused pull request review  
**Catalog target:** 33 → 40 fictional archetypes

## Purpose

This final bounded batch completes the current Issue #80 target of **30–40 authored playable blocks** without turning an address lookup into a gameplay dependency. Each card remains a fictional archetype rather than a representation of a real property. The player can therefore choose a strategic personality—defensive, high-turnover, vertical, waterfront, or industrial—while the game retains the same canonical eight-row tactical contract.

The milestone is primarily a **save-integrity and strategic-variety** improvement. It freezes the existing 33-card resolver pool as catalog version `v2`, creates `v3` for new claims, and appends seven cards. A block claimed under `v1` or `v2` will continue to resolve against exactly its original frozen pool when it lacks a persisted snapshot. A persisted snapshot remains the strongest authority.

## Strategic batch

| Card | Tier | Fictional play identity | Main advantage | Main cost |
|---|---|---|---|---|
| Foundry Steps | High | Dense industrial frontage with layered work bays | Strong cover and a large deployed crew | Slow heat decay and immediate attention |
| Solstice Terminal | Starter | Quiet terminal edge with broad but modest lanes | Low opening heat and easy recovery | Limited income ceiling |
| Ferry Exchange | Elite | Waterfront exchange with a bright open approach | Premium turnover and flexible access | Few hiding places and high starting heat |
| Glasshouse Court | Starter | Tight residential court with interior paths | High morale and defensive cover | Small-scale, low-revenue operation |
| Quarry Terrace | Elite | Elevated service terrace with vertical pressure | Top-end income and capacity | Sustained heat and difficult defense |
| Atlas Arcade | Mid | Covered commercial passage with a rear lane | Balanced income, cover, and maneuvering | No single dominant deployment lane |
| Meridian Works | High | Broad service works with loading approaches | High capacity and strong revenue | Exposed approaches and persistent heat |

## Contracts preserved

| Contract | Implementation requirement |
|---|---|
| Fictional boundary | New names, addresses, cities, and flavour text are fictional. No new card describes an actual property or organization. |
| One canonical board | Every card specifies an eight-row layout built by the existing Block DNA layout helpers. No new grid or placement system is introduced. |
| Resolver stability | `v1` stays frozen at 25 cards; `v2` becomes frozen at the current 33 cards; `v3` is the 40-card pool for new resolutions. |
| Claim stability | Stored DNA snapshots remain authoritative. Snapshot-less legacy records continue through their recorded resolver version. |
| Server/client parity | The generated Python catalog and resolver-parity fixture are regenerated from TypeScript and must agree with the Flask resolver. |
| Presentation independence | This work does not modify renderer/camera files. Cursor's Issue #77 milestone can consume the new DNA cards later without a shared-file conflict. |

## Explicit exclusions

This batch does not modify the command desktop, map fallback, Block Loop, placements, combat simulation, encounter results, economy writers, Supabase migrations, RLS, Edge Functions, production data, secrets, schedulers, Vercel configuration, or runtime art. It adds no real-world map expansion, no factual claims about locations, and no new criminal-instruction content.

## Evidence plan

The completion gate requires focused TypeScript catalog/export/resolver tests, Python catalog/parity tests, regeneration of the generated artifacts, and the repository validation commands permitted by the environment. The minimum behavioral evidence is that all seven cards resolve deterministically at their fictional coordinates, have distinct strategic signatures, retain legal eight-row layouts, and leave `v1` and `v2` resolution stable after `v3` is introduced.

## Verification record

The catalog export now declares `v1` with 25 cards, frozen `v2` with 33 cards, and current `v3` with 40 cards. The generated Flask catalog and resolver-parity fixture were regenerated from the TypeScript source; the fixture covers 1,200 deterministic versioned resolution cases.

Focused frontend coverage passed with 65 tests across the catalog, export, resolver, and legacy-contract files. The complete frontend validation suite passed with 834 tests across 60 files, TypeScript checking, asset audit (110 assets, 7.38 MB of the 20 MB budget), and asset-package validation. The production Vite build passed; it retains the repository's pre-existing large-chunk warnings. The complete offline Python suite passed with 95 tests. Its existing `datetime.utcnow()` deprecation warnings are outside the scope of this catalog milestone.
