# RELEASE CHECKLIST — DEALT / SLIDE Beta (#45)

Gate for shipping a build to outside testers. Check every box; a "no" blocks release.

## Core gameplay loop
- [ ] Claim → place crew → earn → collect → spend loop works end-to-end offline (demo mode)
- [ ] A drive-by can be launched from the map and resolves into vault deposit + heat
- [ ] Ghost crews claim turf, surface in the feed, and retaliate after a player hit (#81)
- [ ] No blocker-level crash in: OS shell, map, block view, drive-by, shoebox, crew

## Visuals
- [ ] No emoji or flat-color cells in any player-facing view (#77)
- [ ] All world actors resolve through `worldActorResolver` (no hardcoded sprite URLs)
- [ ] `npm run assets:audit` passes: 0 errors, 0 warnings, ≤ 20 MB runtime budget (#79)
- [ ] Street + top-down scenes render real art for every placed role (#78)

## Systems
- [ ] `npm run typecheck` clean
- [ ] `npm test` green (Vitest — includes `betaGate.smoke.test.ts`)
- [ ] `npm run build` succeeds; Vercel preview deploys
- [ ] Backend `pytest` green in offline mock mode
- [ ] CI green on the release branch (lint + asset audit + build + pytest)

## Performance
- [ ] First paint ≤ 3 s on a mid laptop in demo mode
- [ ] Map pans/zooms without dropped frames with ≥ 20 blocks on screen
- [ ] No `getImageData` per-frame work in the combat renderers (build-time defringe only)

## Compliance / safety
- [ ] Age gate shows on first launch and is versioned (#76)
- [ ] Fictional-content notice renders on encounter scenes
- [ ] No real-person likenesses; all art is generated or licensed

## Known deferrals (explicitly NOT in this beta)
- Multiplayer / real PvP (ghost crews stand in — #81)
- Full Block DNA library at 30–40 cards (currently 17 — #80)
- Lookout/driver street-aim/fire art (idle + fullbody shipped — #78)
- Mapbox as the combat foundation (selection/recon only — #80)
- Payments/monetization P0s — see `docs/MVP_STATUS_AND_DEV_PLAN_2026-07-16.md`

## Rollback
- [ ] `backup/pre-pr76` branch intact as the rollback anchor
- [ ] Release tag created and logged in `docs/PROJECT_LOG.md`
