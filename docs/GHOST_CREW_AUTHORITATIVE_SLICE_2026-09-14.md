# Ghost Crew authoritative slice — implementation lock

**Date:** 2026-09-14
**Issue:** #81
**Branch:** `feature/81-ghost-crew-authoritative-slice`
**Base:** `origin/main-tL2525` at `afa44de`

## Outcome

One seeded Ghost Crew tick can safely change the existing Block DNA-backed
territory world, record a durable City Brief event, and be replayed without
duplicating treasury, turf, or event effects. A response to rival turf enters
the existing unified encounter preparation/result path. Local rehydration
restores the same rival, event, receipt, and shared block identity.

## Existing seams reused

- `ghostCrewEngine.ts`: pure rival policy and Block DNA economics.
- `ghostCrewStore.ts`: the only rival state/event store and offline persistence
  boundary.
- `blockStore.ts`: the shared territory projection and encounter-result receipt
  ledger.
- `prepareEncounter` / `BlockModeView`: the existing deterministic encounter
  preparation and result consumer.
- `CityBriefing`: the existing Ghost Feed projection; no second notification
  stream is added.
- `worldPersistence.service.ts` / `useGhostCrewSync.ts`: authenticated transport
  and hydration remain unchanged.

## Files and acceptance checks

Implementation is limited to the reservation recorded on issue #81: the Ghost
Crew engine/store and their focused tests, the narrow Territory Map → unified
encounter handoff, this note, and the project log. The checks are deterministic
action traces, checked economy/ownership failures, tick and response replay,
three-tick shared-world visibility, canonical Block DNA grid identity, and
localStorage rehydration.

No Supabase migration, RLS policy, Edge Function, scheduler, secret, production
data, auth, billing, deployment, or alternate state container is in scope.

The clean main checkout also contains `CityBriefing.tsx` and
`cityBriefing.ts`. Their case-only basename collision makes TypeScript and
Vitest select the wrong module on this filesystem. The issue reservation was
expanded before editing to rename the helper to `cityBriefingModel.ts` and
update its three imports; this changes no briefing behavior or styling.

## Branch review

- `copilot/dev-oplan`: the Ghost Crew engine patch is already represented on
  main; no code is copied from the broader historical branch.
- `cursor/authoritative-state-persistence-3679`: salvage the principle that an
  authenticated server snapshot overrides stale local rival state. Its older
  block-persistence patch is superseded by the connected-slice receipt ledger.
- `ops/closed-alpha-world-proof`: documentation-only historical proof prep;
  the newer staging proof on main remains authoritative and no operational
  changes are needed here.
