# Project Contract

Read this after triggering the skill and before writing a plan.

## Product Contract

Treat the phone/desktop shell as the strategy layer. A mini-game is complete only when it reads declared shared inputs and emits a typed outcome that changes at least one durable system: territory, crew, economy, inventory, heat, morale, progression, rival state, or persistence.

| Surface | Reads | Writes |
|---|---|---|
| MAP / block | Blocks, crew availability, rivals, vault summary, Block DNA | Claim, placement, target, collect, encounter intent |
| Contacts / HQ | Vault, roster, inventory, status | Recruit, equip, assign, heal/bail, availability |
| Alchemy / dealing | Inventory, recipes, dealer skill, demand | Product, cash, heat, customer risk, XP |
| Tactical/FPS/TPS encounter | Encounter preparation, selected crew, Block DNA, rival | One idempotent combat result |
| Shoebox | Street cash, pending income, payroll, ledger | Money-router transactions only |
| Rival tick | DNA library, rival treasury/roster/turf/grudge, player blocks | Claim, reinforce, attack intent, lay-low, feed event |

## Authoritative Encounter Boundary

Keep `EncounterPreparation`, `CombatCommand`, `CombatSnapshot`, and `CombatResult` independent from presentation frameworks. Add fields through versioned, tested contracts rather than per-renderer side channels.

Require each command to include a monotonically increasing sequence number. Reject stale or duplicate commands. Use seeded RNG for all hit, spawn, and AI decisions that affect outcomes. Keep renderer-only interpolation, camera motion, particles, decals, and audio outside the model.

Commit a result through one guarded function. Include an idempotency key. Record applied result keys or otherwise guarantee that React rerenders, duplicate callbacks, route remounts, and retries cannot double-pay rewards or double-apply injuries.

## Camera Adapter Contract

Represent the selected combatant and current snapshot in a presentation-neutral controller. Let tactical, first-person, and third-person views share selection, command sequencing, aim-target resolution, tick advancement, HUD derivation, pause state, and result observation.

First-person and third-person movement may interpolate continuously in the scene. Convert meaningful grid-boundary transitions into legal adjacent-cell move commands. Do not teleport the authoritative actor because the camera crossed a visual threshold.

## Block DNA Contract

Use Block DNA as the stable bridge between real-world-inspired selection and authored gameplay. Each card should eventually declare:

| Category | Required data |
|---|---|
| Identity | ID, name, address/reference label, tier, tags |
| Strategy | Income multiplier, heat risk/decay, morale, capacity, event modifiers |
| Tactical | Zone rows, passability, cover, exposure, spawn/extraction candidates |
| Presentation | Strategy plate, action palette, lighting, projection profile, frontage/props |
| Persistence | Stable DNA ID stored with the claimed block |

Mapbox or another map provider may improve search and recon, but combat must resolve from authored DNA without a live map call.

## Rival Contract

Use the same costs and income scale as the player. Persist identity, personality, treasury, roster, claimed DNA IDs, owned block IDs, grudge, event history, and last processed tick. Prevent duplicate claims and make ticks idempotent. Surface every meaningful move through the City Feed or map threat UI.

Local persistence is acceptable for the first deterministic slice. Before release, move authoritative rival state and processed tick IDs to the backend/Supabase path so multiple devices and sessions cannot diverge.

## Integration Order

Recover compatible unmerged work first. Stabilize typed boundaries second. Implement one hero action slice third. Connect rival attacks and result consequences fourth. Expand content only after the slice passes browser, persistence, and performance gates.
