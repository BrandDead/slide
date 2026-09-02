# Authoritative World Foundation Design

**Owner:** Manus AI
**Branch:** `feat/authoritative-world-foundation`
**Base:** `main-tL2525` at `2d80761440be87702802d0c59d26cfad3717bb1c`
**Scope:** A minimal, additive server-backed foundation for durable Ghost Crew state, world events, and idempotent encounter-result recording. This design deliberately does **not** turn the game into real-time multiplayer or replace the existing deterministic combat simulation.

## Current state and ownership

The client currently owns the working strategy loop. `ghostCrewStore.ts` persists named crews, turf, treasury, grudges, and a tick counter to browser storage; it projects rival territory into `blockStore`. `ghostCrewEngine.ts` provides the deterministic decision and transition functions (`decideGhostAction`, `applyGhostAction`, `buildGhostBlock`, and `addGrudge`). `blockStore.ts` owns the local territory projection and already prevents duplicate local `CombatResult` application using `appliedEncounterResultKeys`.

`prepareEncounter.ts` transforms block strategy state into the deterministic combat input, and `BlockModeView.tsx` is the player-facing result boundary. It currently applies the outcome to the local block store and player heat. The existing Supabase block persistence service is best-effort and serializes selected strategy fields into `blocks.metadata`; the two hydration hooks tolerate offline operation. Existing server world ticking and combat action functions are legacy paths and should not be used to resolve the modern deterministic encounter.

> **Boundary:** the combat domain remains pure TypeScript. React, Zustand, Phaser, Babylon, Supabase, and HTTP are all outside it. The server records and applies completed outcomes; it does not simulate the client combat session in this first foundation.

## Minimal durable model

The new additive migration contains five tables.

| Table | Purpose | Visibility/write model |
|---|---|---|
| `ghost_crews` | Canonical rival identity and coarse strategic state: name, faction, treasury, aggression, roster summary, grudge, owned DNA IDs, and last resolved tick | Publicly readable. Server-only writes. |
| `claimed_block_dna` | The game-safe DNA/archetype reference and a derived tactical snapshot for a claimed block. No detailed address is copied. | Publicly readable for visible blocks. Owner-only writes through the existing block ownership model. |
| `world_ticks` | Idempotency ledger for a player-visible world tick, keyed by `tick_key` | Server-only. |
| `world_events` | Immutable player-visible rival/world event stream. Each event may optionally identify its affected player profile. | An event is visible when public or addressed to the authenticated player. Server-only writes. |
| `encounter_results` | Idempotency receipt for a final `CombatResult`, keyed by a caller-supplied `result_key` | Participant-only reads. Server-only writes. |

The new tables record only fictional block IDs, DNA IDs, and strategic metadata. They never require a private street address, home address, or a real-world target description.

## Idempotency and transaction model

A server-generated or trusted server-scheduled world tick uses a stable `tick_key`, for example `ghost:global:2026-09-01T22:00Z`. `apply_world_tick` inserts the key once under a unique constraint. Repeating the same key returns the original tick record and does not create a second world event. A valid action payload must be deterministic before the RPC is called: the client/rule engine supplies the result of the existing seeded Ghost Crew decision logic; the RPC only atomically records a validated, bounded action and immutable event. This keeps the change compatible with current scheduling while preventing duplicate observable outcomes.

A completed encounter generates one `result_key`, normally `CombatResult.id`, and submits the already-determined outcome to `commit_encounter_result`. The function verifies that the claimed block belongs to the authenticated participant and inserts a receipt with `ON CONFLICT DO NOTHING`. A retry returns the original receipt without rewriting state. The initial server receipt intentionally does not duplicate local cash, crew, or block projection writes because existing schemas vary between legacy endpoints. The frontend remains immediately responsive through the existing local result application; the receipt provides the durable reconciliation anchor for the next synchronization increment.

## Frontend synchronization model

The new service is disabled in demo mode and catches configuration/network errors. It supports three narrow operations: load public Ghost Crew/world-event state, request/record a tick only when authorized server infrastructure invokes it, and record one encounter-result receipt. A hydration hook seeds locally only when the server has no visible state, then overlays durable crew/event state after authentication. It does not create another game store; it calls the existing Ghost Crew store’s dedicated replacement method. Realtime subscriptions are deferred until the server event producer and RLS ownership are proven in a live Supabase project; the first slice safely hydrates on authenticated boot and on page reload.

## Migration and rollback

Migration `005_authoritative_world_foundation.sql` is additive: it creates tables, indexes, policies, and RPCs without altering existing tables or deleting data. Its rollback is a separate manual migration that removes only these new objects after dependent function removal. No existing legacy world tick, combat endpoint, client persistence function, or asset manifest is changed by the migration.

## Tests and acceptance

Pure helpers test action normalization, result-key selection, and duplicate-safe state adaptation. Service tests mock the Supabase interface and assert demo/no-client no-op behavior, successful receipt processing, and duplicate receipts. Store tests assert remote Ghost Crew state is replaceable without breaking local actions. End-to-end database/RLS verification remains a deployment gate because it requires a configured Supabase project.

The initial acceptance scenario is: a player sees stable Ghost Crew state after authenticated hydration, a completed encounter records one durable receipt, a retry returns the same receipt, and all current gameplay tests still pass. The next increment may use the world event ledger to drive an authenticated server world scheduler and reconcile final cash/territory effects from the receipt.
