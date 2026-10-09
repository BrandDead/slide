# Canonical owned-block response — #192

Base: `9eef5aac28a82275d7a2e1596e8658b167953ed7`. Branch: `fix/192-canonical-block-response`.

ATTACK and OPS PLAN now open the same confirmed-block planner. Launch carries the selected owned block to MAP's existing `UnifiedEncounter`; no rival takeover, fabricated target, preview scout, new engine, new game-state store, or new result writer was added. Crew/ownership are checked at queue, consume, and encounter entry. The current result handler checks the block receipt before any shared consequence, including player heat and service submission.

## Automated evidence

- Regression first: 12 planner/intent/MAP tests failed against the unmodified base for missing canonical commands and the old UI; two additional BlockMode regressions failed for duplicate submissions and permitting an all-downed encounter.
- Focused: 17 tests passed across planner, intent, MAP handoff and BlockMode. The existing four tutorial tests also pass with the new confirmed-block fixture and real Launch Response action.
- Full validation: 93 test files, 1,047 passed, 4 existing skips; TypeScript passed; lint 0 errors / 200 baseline warnings, no new warnings.
- Asset audit: 112 assets, 0 errors, 0 warnings, 7.70 MB / 20 MB. Package validation: 5 packages / 4 schemas.
- Production build passed, including the existing large-chunk warning. Offline backend: 107 passed, 0 warnings.

## Real built-game path

Chromium 153 with Playwright; fresh browser profiles at 390×844 and 1440×900, device scale 1. Built with `VITE_DEMO_MODE=1`, the existing dummy Supabase URL/key, and no real credentials. The exact dist files were served through a hermetic local static handler because the environment's restricted network failed CSS imports. The unavailable Google Fonts stylesheet was supplied as empty CSS so the game's own system-font fallback rendered. No gameplay modules, responses, or state were stubbed in happy paths.

At each size: affirm the actual age gate → dismiss existing rival banner → desktop ATTACK icon → inspect confirmed Lil Dre + Kilo → Launch response → Fire nearest → Reload → Retreat safely → Apply result and return → reload. One local receipt, heat 1 and morale 66 survived reload; there were no page or console errors. Details are in `browser-results.json`. This is local demo persistence, **not authenticated server persistence or #175 proof**; the demo service intentionally skips the remote receipt.

Phone failure: abort the encounter JavaScript chunk. The existing lazy-route boundary displayed a load failure and Retry Encounter while retaining the playable board. Two expected console errors came from the deliberately failed download; no uncaught page errors.

Screenshots: `phone-planner.png`, `desktop-planner.png`, `*-encounter-before-graphics.png`, `*-combat.png`, `*-result.png`, `*-return.png`, and `phone-load-failure.png`.

## Limits and integration

This is the supported owned-block, on-foot response slice of #192. NPC invasions and driver dismounts need an explicit command contract; the current server receipt accepts the player's owned block only. The legacy shooter implementation remains on disk but these entries no longer route to it. DRIVE #201, identity/resolver #169, staging #175, migrations, Supabase, secrets and production settings were untouched.

The existing remote receipt remains fire-and-forget with a warning on failure; #175 must prove authenticated return/reload behavior and receipt recovery before outside testers. The existing phone canvas sizing and rival circles are left for an independent #190 presentation PR. No merge or deployment was performed.
