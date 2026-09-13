# Connected Gameplay Slice Contract — 2026-09-12

## Outcome

A newly claimed block must expose one deterministic 8×8 Block DNA board to
every gameplay consumer. The Flask claim response, frontend placement view,
saved placement coordinates, and immutable combat snapshot must agree on tile
type, coordinates, cover, visibility, dimensions, and whether a tile accepts a
crew member. An existing snapshot-bearing block with an older or malformed grid
rebuilds from its saved DNA identity. A snapshot-less record may use a complete,
coordinate-consistent 8×8 legacy board; a missing, malformed, or differently
sized legacy board falls back to the same pinned v1 address resolver in both
runtimes.

The existing deterministic encounter consequence path remains in place. This
slice also preserves its last idempotency key across Supabase projection reload
so the same result cannot be projected twice after refresh.

## Current action → persistence → reload path

1. `POST /api/blocks/claim` verifies/geocodes the address, resolves and embeds a
   versioned Block DNA snapshot, generates `grid_data.grid.tiles`, and persists
   the block through `DBAdapter`. The verified coordinates—not an optional
   client city label—select the stored service-area city.
2. `apiBlockToBlockData` hydrates the claim or `/my-blocks` response into
   the Zustand block store. Before this slice it ignored `gridData` and
   generated a separate board from the DNA row layout. The real
   `TerritoryMap` claim consumer also re-resolved the unverified request
   coordinates and overwrote the mapped server DNA; it now adds only a visual
   satellite fallback.
3. Placement writes `gridX/gridY` through
   `POST /api/blocks/<id>/members/place`; the Flask combat start route freezes a
   `BlockStateEngine` snapshot. Before this slice placement and the engine did
   not share one canonical deployability/crew source, and the production
   adapter still used obsolete placement column names.
4. The unified encounter applies an idempotent local consequence and
   `commit_encounter_result` persists the receipt plus heat, morale, and pending
   income. Crew-down health is sent through the serialized, owner-checked Flask
   placement-replacement queue; the server permits only a monotonic health
   reduction, so a placement refresh cannot heal a downed member.
5. `loadPlayerBlocks` + `loadPlacements` and Flask `/my-blocks` hydrate the
   block after reload. Both hydration orders now union the bounded encounter
   receipt ledger without letting a partial projection replace the canonical
   Flask grid.

## Contract changes and consumers

- `grid_data.metadata.gridContract`: new claims mark the nested board as
  `block-dna-grid` version `1` and record that the global DNA cover bonus is
  already applied. Producers: Python grid generator and claim route. Consumers:
  Flask placement validation, frontend block mapper, tests. Unmarked records are
  legacy. A complete 8×8 legacy board is normalized and shared; any DNA
  snapshot, including a malformed one, takes precedence through the recovery
  ladder.
- `grid_data.grid.tiles`: for marked boards, the saved DNA row layout now owns
  tile `type`, root `cover`/`visibility`, `deployable`, and `x/y`. Consumers:
  frontend block hydration, placement endpoint, and `BlockStateEngine`.
- `resolve_block_grid_tiles`: placement and `BlockStateEngine` share this one
  validator/resolver. A damaged marked board is discarded as a whole and
  rebuilt as a feature-free 8×8 board from saved DNA rows and the already-baked
  cover bonus—the exact fallback shape reproduced by the client. A truncated
  snapshot follows the same recovery order on both sides: complete snapshot by
  value → known stored DNA id → pinned v1 address resolver.
- `BlockData.gridSource` and `BlockData.globalCoverBonus`: diagnostic fields let
  encounter preparation distinguish an already-baked server board from a
  fallback board that still needs its snapshotted DNA cover bonus.
- `BlockStateEngine.members`: saved block placements, including their canonical
  coordinates and health, become the encounter defender source. UUID-backed
  members are owner-filtered and their roster stats/equipment are overlaid;
  the placement cannot spoof those fields. A legacy production fallback
  remains for older member assignment records.
- `BlockData.appliedEncounterResultKeys`: Supabase block projection reload maps
  the bounded metadata ledger plus `lastEncounterResultKey` back into the
  client idempotency ledger. Store upserts union receipts, so parallel Flask
  and Supabase hydration cannot erase a completed consequence.
- The placement client reconciles the server's normalized response (including
  monotonic health and roster-owned role/level) before an encounter can start.
  Destructive snapshots are serialized per block; rejected dependent requests
  roll back to the last server-confirmed placement projection, not to another
  optimistic snapshot. Applying the same encounter result after a failed health
  write retries only the health projection and does not replay heat, morale, or
  pending-income deltas.
- Supabase hydration re-checks for a complete Flask block after every placement
  await. Flask is the only runtime placement writer; the parallel Supabase
  projection carries block metadata/receipts but cannot replace the canonical
  Flask board or placement roster.
- `block_placements`: the Python adapter now reads and writes the tracked
  `grid_x/grid_y` explicit-column shape, preserves numeric zero, and keeps
  live revision/income projection inside existing block JSON metadata.

## Compatibility and failure behavior

- A malformed, ragged, coordinate-inconsistent, or tactical-value-incomplete
  marked grid is never partially consumed. With any usable DNA identity,
  frontend hydration, backend placement, and backend combat all take the same
  recovery ladder. Without DNA, both runtimes accept only a complete 8×8
  unmarked legacy board, normalize its cover/visibility to two wire decimals,
  or use the pinned v1 fallback.
- Missing placement targets return 404 and non-owners return 403. The existing
  combat-start API rejects a missing target before session creation (its current
  failure contract is 500). Malformed claim bodies or gang names,
  invalid/non-finite coordinates, malformed placement bodies, invalid or
  non-finite placement numerics, non-deployable/duplicate cells, over-cap
  rosters, unowned members, and
  non-deployable member statuses return 400 without debiting cash or replacing
  saved placements. Only an explicit `{ "placements": [] }` clears a roster.
- Non-UUID local member ids are accepted only by the explicit offline DEV_USER
  store. Production placement fails closed unless every id resolves to a UUID
  roster row owned by the authenticated player; wiring local roster creation
  into that durable table is a separate compatibility seam.
- Optional legacy `member_loadouts` and `block_snapshots` database tables are
  not part of the proven staging manifest. Missing loadouts degrade to empty;
  archived JSON is decoded correctly where that table exists. No claim is made
  here that those optional database paths are provisioned in staging.
- The repository's broader pre-existing `DBAdapter.claim_block` versus tracked
  master-schema mismatch is not repaired here. The offline connected slice is
  proven, but the Flask production adapter must be reconciled separately before
  claiming staging deployability.
- The health update and existing encounter-receipt RPC are two authorized
  persistence seams rather than one database transaction. A rejected health
  replacement rolls the client back to its last server-confirmed placement;
  replaying the same deterministic result key retries that health write without
  duplicating the already-applied economy consequence.
- No Supabase schema, migration, RLS policy, Edge Function, secret, scheduler,
  production data, or deployment is changed by this slice.
