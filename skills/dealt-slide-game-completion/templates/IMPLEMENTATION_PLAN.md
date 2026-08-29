# Game Completion Implementation Plan

**Branch:** `<feature-branch>`  
**Baseline:** `<default-branch>@<sha>`  
**Hero Block DNA:** `<dna-id>`  
**Named Rival:** `<crew-id>`  
**Prepared:** `<YYYY-MM-DD>`

## Vertical Slice

Describe the player decision, playable action, success state, failure state, expected duration, and the durable empire consequence in one paragraph.

## Existing Work to Recover

| Branch/PR/Commit | Capability | Reuse decision | Conflict or verification needed |
|---|---|---|---|
| | | | |

## Shared-State Contract

| Input | Owner | Read path |
|---|---|---|
| Block and DNA | | |
| Selected crew/loadout | | |
| Rival/opposition | | |
| Heat/morale/inventory | | |

| Output | Owner | Apply-once path |
|---|---|---|
| Combat result | | |
| Crew consequences | | |
| Territory/rival consequences | | |
| Economy/ledger consequences | | |

## Risk Slices

| Risk | Smallest proof | Verification |
|---|---|---|
| Shared session across tactical/FPS/TPS | | |
| First-person input and pointer-lock lifecycle | | |
| Third-person camera and collision | | |
| 3D scene projection from Block DNA | | |
| Result idempotency | | |
| Repeated mount/unmount cleanup | | |

## Implementation Order

| Order | Deliverable | Files/systems | Acceptance evidence |
|---|---|---|---|
| 1 | Recover compatible work | | |
| 2 | Stabilize model/adapter | | |
| 3 | Generate visual target/assets | | |
| 4 | Build hero 3D scene | | |
| 5 | Add first-/third-person controls | | |
| 6 | Integrate result consequences | | |
| 7 | Run gauntlet and refine | | |
| 8 | Update issues/log/release checklist | | |

## Quality Gates

| Gate | Command or method | Result |
|---|---|---|
| Typecheck | | |
| Unit/integration tests | | |
| Asset audit | | |
| Production build | | |
| Backend tests | | |
| Browser smoke | | |
| Tactical/FPS/TPS captures | | |
| Repeated enter/exit | | |

## Deferred Work

List only deliberate non-goals with a reason, dependency, and proposed follow-up issue.
