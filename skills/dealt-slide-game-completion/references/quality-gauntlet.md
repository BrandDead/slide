# Quality Gauntlet

Use this loop for every substantial gameplay or visual milestone.

## Round Loop

1. Build and run smoke tests before trusting a screenshot. A renderer or shader error can still leave a plausible partial frame.
2. Start from a fixed seed, hero Block DNA card, crew loadout, rival, viewport, and query flag such as `?demo=1`.
3. Capture the same evidence set: strategy block, tactical encounter, first person, third person, firefight feedback, low-health or injury state, and resolved result back in strategy.
4. Inspect the pixels directly. When useful, ask independent critics to identify the largest gap, but verify every diagnosis against code, probes, or measurements.
5. Fix the largest verified gap rather than many cosmetic symptoms.
6. Re-run the narrow tests, then the full quality gates.
7. Record the round, screenshots, measurements, change, and rollback commit in `MEMORY.md` or the project log.

## Deterministic Evidence Set

| Capture | Must show |
|---|---|
| Strategy | Authored block identity, crew placement, income/heat/morale, rival ownership or threat |
| Tactical | Same block geometry, legal grid/cover readability, objective, crew/opposition |
| First person | Weapon/readable hands or proxy, aim target, cover depth, HUD, location identity |
| Third person | Controlled actor, shoulder/orbit framing, cover relationship, objective direction |
| Combat feedback | Fire/reload state, impact/hit feedback, return-fire telegraph, ammo/health changes |
| Result | Outcome summary and exactly-once updates to empire state and ledger |

## Model and Integration Gates

Test deterministic session creation, command sequencing, legal/illegal movement, line of sight, fire cadence, reload timing, opponent decisions, objective completion, retreat/overrun, and result idempotency. Test that camera switching does not reset the session or duplicate commands.

Test the full strategy path with controlled fixtures. Confirm that one result updates the block, selected crew, heat, morale, pending income or loot, rival state, and ledger as intended. Remount the result component and retry the callback to prove the idempotency guard.

## Lifecycle Gates

Enter and exit the 3D mode repeatedly. Verify that the engine, scene, event listeners, intervals, animation frame loops, pointer lock, and audio nodes are disposed. Confirm that React development double-mount does not create duplicate engines or ticks. Pause on pointer-lock loss and never silently reacquire it from an arbitrary click.

## Performance Gates

Measure rather than infer. Record boot time, frame-time median and p95, draw calls, active meshes, texture memory estimate, and long-session resource counts. Use object pools for transient combat effects. Keep the UI at native resolution if the 3D render scale changes.

Do not pursue a broad custom AAA renderer before the integrated gameplay slice works. Prioritize stable input, readable lighting, coherent art, bounded effects, and consequences over exotic post-processing.

## Repository Gates

Run the repository’s own commands, normally including frontend typecheck, tests, asset audit, lint, production build, backend tests, and browser smoke. Treat environment limits separately from code failure and preserve logs.

Before pushing, inspect the diff for generated artifacts, secrets, large unregistered assets, direct cash mutations, duplicate stores, stale temporary files, and accidental edits to the protected default branch. Update the project log and release checklist, then open a focused pull request with evidence and remaining limitations.
