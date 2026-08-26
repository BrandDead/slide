---
name: dealt-slide-game-completion
description: Complete and modernize an existing DEALT/SLIDE-style browser strategy game whose phone-app mini-games share one empire state. Use when auditing branches/issues/PRs, recovering unmerged work, finishing the strategy loop, adding persistent rival crews, expanding Block DNA, or building integrated tactical, first-person, and third-person action modes without disconnecting economy, territory, crew, heat, morale, inventory, or persistence.
---

# DEALT / SLIDE Game Completion

Finish the game by **integrating before inventing**, preserving one authoritative empire state, and proving progress through playable pixels and deterministic tests. Treat the iOS-like desktop as the strategy shell and every mini-game as an input/output adapter over shared state.

Read `references/project-contract.md` before planning. Read `references/quality-gauntlet.md` before implementation or verification. Use `templates/IMPLEMENTATION_PLAN.md` when the repository lacks a current resumable plan.

## Workflow

Follow these stages in order. If the project already has current `PLAN.md`, `STRUCTURE.md`, `MEMORY.md`, or `ASSETS.md` files, read them and resume from the first incomplete stage.

1. **Audit before editing.** Inspect the default branch, open issues, pull requests, remote branches, recent history, CI runs, repository instructions, project log, package manifests, and current build health. Compare each open issue against the code; issue checkboxes may be stale.
2. **Recover existing work.** Identify unmerged branches whose commits already implement roadmap items. Rebase or cherry-pick compatible work onto a fresh feature branch before creating replacements. Preserve newer integration work on the default branch and remove superseded duplication.
3. **Map the live loop.** Trace the player path from OS shell → MAP/block selection → crew/loadout → encounter preparation → action mode → atomic result → territory/crew/heat/morale/vault persistence. Name the exact store, service, and component that owns each boundary.
4. **Define one vertical slice.** Choose one hero block, one named rival, one playable crew loadout, one objective, and one action presentation. Write explicit success/failure behavior, shared-state inputs, typed output, test criteria, screenshot criteria, and known deferrals.
5. **Stabilize the authoritative model.** Keep combat simulation and outcome resolution in framework-agnostic TypeScript. The model must accept typed commands, expose snapshots/events, use deterministic RNG, and emit an idempotent result. Never let a renderer directly apply damage, cash, heat, morale, territory, or inventory changes.
6. **Build presentation adapters.** Keep the existing tactical view working. Add first-person and third-person cameras as input/rendering adapters over the same session. Continuous movement may be visually smooth, but legal simulation changes must flow through the shared command contract.
7. **Generate and wire art.** Read the `imagegen` and `game-dev` skills. Generate a visual target and a small coherent asset set. Record prompts, source paths, runtime URLs, registration, and fallback behavior in `ASSETS.md`. Do not ship a gray blockout or disconnected asset gallery.
8. **Integrate consequences.** Apply the encounter result once through a single boundary. Update the block, crew injuries/arrests, heat/raid risk, morale, pending income or loot, rival grudge/territory, and Shoebox ledger without duplicate rewards.
9. **Run the quality gauntlet.** Type-check, test pure models, run integration and persistence tests, audit assets, build production, and capture deterministic tactical/FPS/TPS evidence. Fix the largest verified gap, rerun, and log the round.
10. **Reconcile the repository.** Update the project log, release checklist, and roadmap. Close, rewrite, or split stale issues based on verified acceptance. Push the feature branch and open a focused pull request; do not commit directly to a protected default branch.

## Non-Negotiable Architecture

> **Strategy state is authoritative; action modes are adapters.**

Use this flow:

`MAP + CREW + BLOCK DNA + RIVAL → EncounterPreparation → CombatSession → Tactical/FPS/TPS adapters → CombatResult → one result boundary → empire stores/persistence`

Keep these ownership rules:

| Layer | Owns | Must not own |
|---|---|---|
| React OS shell | Navigation, briefing, HUD, settings, modal consequences | Simulation damage or duplicate economy state |
| Strategy stores/services | Blocks, crew, money, inventory, heat, morale, rival state, persistence | Per-frame camera or renderer state |
| Combat model | Legal commands, ticks, RNG, damage, objectives, result | React, Phaser, Babylon, stores, APIs |
| Tactical/FPS/TPS adapter | Camera, input, selection, interpolation, effects | Authoritative rewards or permanent state |
| Result boundary | Atomic, idempotent empire updates | Replaying presentation events as new outcomes |

## Modern Action Slice

Implement one controllable crew member first. Require movement, aim, fire, reload, cover readability, return-fire telegraph, extraction or retreat, pause/exit, first-/third-person camera switching, and a deterministic demo route. Keep the tactical mode available as a fallback and debugging reference.

Default to a Babylon.js canvas for a new 3D adapter when the repository has no established 3D engine. Keep React as the host shell and plain TypeScript as the gameplay layer. Reuse existing Phaser/canvas modes rather than rewriting them unless the audit proves removal is safer.

## Persistent Rival Slice

Start with one named rival crew that has personality, treasury, roster, owned DNA-backed blocks, grudge, and event history. On each deterministic world tick, choose among claim, reinforce, attack, and lay low using real costs and income. Surface visible City Feed consequences. Route contested blocks into the normal encounter path. Move from browser persistence to backend/Supabase only after the deterministic local loop is verified.

## Completion Evidence

Do not claim completion from code alone. Require all of the following:

| Evidence | Minimum bar |
|---|---|
| Repository | Feature branch, clean diff, reconciled unmerged work, updated project log |
| Model | Deterministic command tests and idempotent result tests |
| Integration | Strategy → action → strategy path updates shared state once |
| Visual | Tactical, first-person, and third-person captures from the same hero block |
| Reliability | Repeated enter/exit, pause/resume, unmount cleanup, no duplicate loops |
| Assets | Manifest-only runtime assets, no missing files, budget gate passes |
| Build | Typecheck, unit/integration tests, backend tests when applicable, production build or documented environment limitation |

## Guardrails

Do not add a home-screen icon for a mode that cannot produce a typed shared-state outcome. Do not create a separate economy, crew roster, territory copy, or rival state inside a mini-game. Do not let Mapbox availability block core play. Do not expand to many maps before one hero block passes the action and consequence gates. Do not treat critic feedback as truth until checked against pixels, probes, or code. Do not merge an unreviewed large branch into a protected default branch.
