# Nightfall presentation verification — 2026-10-09

This is a partial evidence handoff for issue #190. The scene/CSS fix passed local gates and real built-game checks before the final crew-condition HUD addition. The workspace disconnected during the final HUD preflight. **Keep the PR draft until the final HUD browser check and capture handoff are complete.**

## Regression and automated gates

- Against unchanged base `9eef5aa`, the new scene suite failed four cases and passed one. The corrected scene passed all five.
- Before the HUD addition: full frontend suite **1,038 passed / 4 skipped / 92 files**; typecheck and production build passed; lint **200 baseline warnings / 0 errors / 0 new warnings**.
- Asset audit: **112 assets / 7.70 MB of 20 MB / 0 errors / 0 warnings**. Package validation: **5 packages / 4 schemas**.
- The crew-condition HUD regression failed on the unchanged UI as expected. Its final local preflight started but its completion is unknown. GitHub CI verifies the published final source separately; consult the PR checks.
- Existing build warnings include large chunks and legacy logo/menu/drive-by background references. No new asset or dependency was introduced.

## Real player path completed before the HUD addition

At **390×844** with real touchscreen taps and **1440×900** with pointer input: age gate → Run the Block → lock Dre/Rome → place/assign through the existing Legal board → Close Deal → Defend Block → named Nightfall encounter → move → fire/reload → down a named rival → retreat → apply result once → return → reload.

Actual session cells matched the rendered destinations: Dre `(0,2)`, Rome `(4,4)`. A registered shooter downed texture appeared on the named Nightfall lookout. Both happy paths produced **0 page errors and 0 console errors**. One local receipt survived reload unchanged.

As a controlled reproduction, reinjecting only the old canvas sizing rule into the same build made Dre land at `(0,3)` on phone and `(1,2)` on desktop when the intended rendered cell was `(0,2)`. Removing forced CSS dimensions lets existing Phaser FIT own the canvas geometry; world projection and hit cells remain unchanged.

On phone, aborting registered topdown actor images left named fallback markers, fire/reload/retreat, result application, return and reload playable: **0 page errors**, with **16 expected failed-resource console errors**.

The demo used the real built game and commands, with a read-only observer for session/texture inspection. Built files were delivered through a hermetic static handler; unavailable web fonts used the system fallback. Game state, engine commands and result application were not stubbed. These are local demo checks, not authenticated Supabase receipt proof.

## Evidence gap and release hold

`verification-summary.json` records the checks inspected during the session. It is a summary, not a replacement for raw browser reports or screenshots. Local screenshots and browser reports were produced and inspected, but the disconnected workspace prevented their upload. No unavailable capture is presented as attached evidence.

Before making the PR ready for review:
1. Repeat phone/desktop movement, crew HP/ammo/reload HUD, fire/downed/retreat/apply/return/reload on the final commit.
2. Repeat actor-image failure and confirm labels, controls, HUD and one receipt remain intact.
3. Attach before/after and failure captures, confirm no clipping or cell offset after the extra HUD row, and record the final CI results.

This uses existing topdown role art and preserves the historical tactical plane. It does not complete the full #190 hero-package/style approval or missing aim/fire/hit/reload poses. The Legal board was used because Diorama hit areas overlap on phone; that separate overlap remains. Authenticated durability/recovery stays with #175.
