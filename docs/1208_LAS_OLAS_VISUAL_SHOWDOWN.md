# 1208 Las Olas Visual Showdown

**Branch:** `feat/1208-las-olas-visual-showdown`  
**Stacked on:** PR #119, `feat/modern-gameplay-completion`  
**Production benchmark:** `dealt-slide-modern-ops-visual-target.png`  
**Decision:** Babylon remains the current renderer until a controlled Unreal slice proves a materially better production result.

## Purpose

PR #119 proved the important architecture: one deterministic encounter can drive tactical, first-person, and third-person cameras; renderer lifecycle is isolated; and an idempotent result returns to the real block, crew, heat, morale, injury, and income systems. It did not prove production character art, physical shooter input, a scalable 3D asset pipeline, or the final visual direction.

This milestone compares **production-intent Babylon** with a **minimal Unreal vertical slice** using the same encounter and result contracts. It does not rebuild the game, move strategy authority into Unreal, or merge rendering with simulation.

## Non-Negotiable Ownership

| Concern | Owner |
|---|---|
| Block, member, inventory, weapon, heat, morale, injury, economy, mission state | SLIDE domain and strategy services |
| Encounter preparation, command validation, deterministic outcome, replay identity, result idempotency | Shared combat authority |
| Character meshes, animation, materials, cameras, VFX, audio, interpolation, local collision queries | Renderer adapters |
| Commander, TPS, and FPS | Views and control policies over one live encounter |
| Babylon and Unreal | Replaceable presentation clients consuming identical contracts |

## Shared Encounter Package

The portable encounter package must be JSON-serializable, versioned, and free of React, Babylon, Phaser, or Unreal types. The minimum contract is:

```ts
interface EncounterPackageV1 {
  schemaVersion: 1;
  encounterId: string;
  blockId: string;
  sceneLabel: string;
  locationReference: string;
  seed: number;
  terrain: CombatTerrainCell[][];
  crew: Combatant[];
  opposition: Combatant[];
  loadout: EncounterLoadoutEntry[];
  objective: CombatObjective;
  extraction: GridPoint;
  heatAtStart: number;
  moraleAtStart: number;
}
```

`EncounterPreparation` remains the in-process TypeScript representation. An adapter produces `EncounterPackageV1` for native clients and replays. Existing callers are not forced to serialize during local browser play.

## Shared Result Package

The portable result is versioned and carries durable consequences, inventory deltas, and a replay identity. It never includes renderer-only effects.

```ts
interface EncounterResultV1 {
  schemaVersion: 1;
  encounterId: string;
  idempotencyKey: string;
  outcome: 'secured' | 'retreated' | 'overrun';
  crewDown: string[];
  oppositionDown: string[];
  injuries: EncounterInjury[];
  ammoConsumed: Record<string, number>;
  inventoryChanges: EncounterInventoryDelta[];
  heatDelta: number;
  moraleDelta: number;
  pendingIncomeDelta: number;
  capturedBlock: boolean;
  replayHash: string;
  summary: string;
}
```

PR #119’s `CombatResult` remains supported. A compatibility adapter produces `EncounterResultV1`; the strategy boundary continues to apply a result exactly once by idempotency key.

## Control and Possession Contract

Exactly one authority controls each living actor per simulation tick.

```ts
type ControlAuthority =
  | { kind: 'player'; playerId: string }
  | { kind: 'squad-ai'; orderId?: string }
  | { kind: 'inactive'; reason: 'downed' | 'arrested' | 'unavailable' };
```

Commander view selects members and issues semantic orders. TPS or FPS possesses the selected living member. Switching camera does not change actor identity, position, health, ammo, weapon, current order, or encounter tick. Unpossessed members remain under squad AI. If the possessed member becomes unavailable, control returns to commander view and selects the nearest living member without restarting the session.

## Aimed-Fire Contract

`fireNearest()` remains only as a tactical/demo accessibility helper. Direct FPS/TPS input uses a renderer-neutral ray intent.

```ts
interface EncounterVector3 {
  x: number;
  y: number;
  z: number;
}

type CombatHitZone = 'head' | 'torso' | 'arm' | 'leg';

interface CombatAimRay {
  origin: EncounterVector3;
  direction: EncounterVector3;
  maxDistance: number;
  clientTick: number;
}

interface CombatImpactCandidate {
  kind: 'actor' | 'cover' | 'vehicle' | 'environment' | 'miss';
  entityId?: string;
  hitZone?: CombatHitZone;
  point: EncounterVector3;
  distance: number;
}

interface AimFireRayCommand {
  type: 'aim-fire-ray';
  actorId: string;
  ray: CombatAimRay;
  candidate: CombatImpactCandidate;
  sequence: number;
}
```

The combat authority validates phase, actor identity, sequence, ammo, reload, fire cadence, finite/normalized direction, range, candidate type, target team/liveness, and grid line of sight. It owns RNG, armor, hit-zone multiplier, damage, downing, ammo consumption, fire cadence, events, and results. Client candidates never provide damage. A future multiplayer server can replace the candidate with a server-side rewind/raycast without changing presentation APIs.

Events gain renderer-neutral impact metadata so Babylon, Phaser, Unreal, replay tools, and tests visualize the same shot:

```ts
interface CombatEvent {
  // existing fields
  impact?: CombatImpactCandidate;
  hitZone?: CombatHitZone;
}
```

## Invisible Grid Policy

| Mode | Grid presentation |
|---|---|
| Strategy | Visible block grid and deployment/economic meaning |
| Commander | Optional tactical overlay, cover anchors, paths, orders, and objective markers |
| TPS/FPS | No visible tiles; physical street, cover, vehicles, and actors communicate the simulation |

The grid remains authoritative for the current combat model. Physical meshes carry stable gameplay metadata linking them to grid cells and entity IDs.

## Production Character Package

Each future playable member must be an asset package, not scene-specific code.

| Required item | Contract |
|---|---|
| Identity | Stable `memberId`, display name, role, portrait ID, wardrobe/material IDs |
| Source | Editable source model plus exported GLB for Babylon and FBX/engine import source for Unreal |
| Skeleton | One documented shared humanoid skeleton and retarget profile |
| Geometry | TPS body, FPS arms/weapon presentation, collision proxy, LODs, measured triangles/bones |
| Materials | PBR base color, normal, roughness/metallic or ORM, emissive where justified |
| Animation states | idle, walk, sprint, strafe, aim, aim-walk, fire, reload, crouch, hit, downed, cover enter/idle/exit |
| Runtime metadata | scale, forward axis, root bone, clips, sockets, hit-zone nodes, portrait continuity |
| Provenance | Source, creator, license, commercial rights, AI involvement, modification history |

Until licensed rigged characters are available, Babylon must use a structured fallback assembled from multiple meshes with a recognizable humanoid silhouette, visible weapon, hit-zone metadata, and animation-state hooks. Capsules and spheres may remain only as invisible collision/debug proxies.

## Production Block Package

`1208-las-olas-v1` is one authored block package with stable gameplay anchors.

| Required item | Contract |
|---|---|
| Identity | Stable block/DNA ID, fictionalized Las Olas label, version |
| Geometry | Road, curbs, sidewalks, parking, storefront shells, cover, vehicles, palms, poles, signs, clutter |
| Gameplay | Spawn, cover, objective, extraction, vehicle, interaction, nav, and occlusion anchors linked to grid cells |
| Rendering | PBR materials, emissive signs, shadow policy, reflection/wetness policy, day/night profile |
| Performance | LOD/instances, texture budgets, material count, draw-call target, Babylon download budget |
| Source | Editable source scene or modular source files plus runtime GLB/texture outputs |
| Provenance | License and generation ledger for every non-original dependency |

## Visual Acceptance

The benchmark requires a human-scale over-the-shoulder composition, realistic silhouettes, visible weapons, physical cover, parked vehicles, storefront depth, palms/utility infrastructure, wet asphalt, emissive practical lighting, South Florida night identity, and readable combat feedback. The visual target is a quality bar, not a runtime image or a license to copy real brands.

The Babylon and Unreal slices must use the same camera framing, objective, actor count, encounter seed, and capture resolution. A comparison is invalid if Babylon uses primitives while Unreal uses finished sample art.

## First Delivery Gates

| Gate | Acceptance |
|---|---|
| Contract | Versioned JSON schemas and fixtures validate; TypeScript adapters round-trip deterministically |
| Gunplay | TPS/FPS fire from camera-center ray; actor/cover/miss outcomes are explicit; damage is authority-owned |
| Possession | Any living crew member can be selected/possessed; camera switching preserves snapshot |
| Squad | Unpossessed members remain active under AI orders |
| Babylon art | Capsules/spheres are no longer player-facing; one hero block uses production-intent asset packages |
| Unreal boundary | Native project reads the same fixture and emits a schema-valid result fixture |
| Consequence | One result updates strategy exactly once |
| Evidence | Typecheck, unit tests, asset audit, build, browser captures, performance notes, and provenance ledger |

## Rollback and Branching

PR #119 remains the rollback anchor for the working Modern Ops architecture. This branch is stacked on PR #119. The shared-contract and aimed-fire commits land before asset/presentation commits. The Unreal project remains a sidecar comparison until it passes the same contract, control, visual, and result gates; no canonical authority moves into Unreal during the experiment.
