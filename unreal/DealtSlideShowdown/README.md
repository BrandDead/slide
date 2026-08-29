# DEALT / SLIDE — Unreal 1208 Las Olas Showdown

This directory is the private native-engine comparison path for the **same** 1208 Las Olas encounter used by the Babylon client. It is not a separate game and it does not own progression, economy, heat, morale, Block DNA, persistence, or durable combat consequences.

## Authority boundary

The canonical TypeScript domain remains the source of encounter preparation, deterministic results, and the exactly-once strategy commit. Unreal consumes `Content/Contracts/encounter.1208.v1.json`, presents the scene, translates native input and physics hits into the shared command vocabulary, and emits `encounter-result.v1` JSON for the existing result boundary.

The copied fixture files must remain byte-identical to `contracts/examples/encounter.v1.json` and `contracts/examples/result.v1.json`. Run:

```bash
node unreal/DealtSlideShowdown/Tools/validate-boundary.mjs
```

## Native responsibilities

Unreal owns presentation-only concerns: the commander camera, first-person and third-person cameras, possessed pawn movement, animation graphs, Chaos collision queries, cover/vehicle/environment hit candidates, squad navigation presentation, Niagara effects, audio, and the imported 1208 Las Olas block and character packages.

Unreal must not calculate durable inventory, money, heat, morale, territory capture, hospital, jail, or permanent-member consequences independently. Those fields return through the shared result contract.

## Local build prerequisites

The project targets **Unreal Engine 5.4**. Generate project files and build it on Windows, macOS, or Linux with Unreal 5.4 and a supported C++ toolchain. The default Manus sandbox does not include Unreal Engine, a GPU, or enough persistent editor storage, so this repository pass validates source structure and contract synchronization but does not claim a native compile or rendered Unreal screenshot.

## Production asset path

Do not import marketplace content directly into gameplay code. Characters and the 1208 block must first satisfy `contracts/character-package.schema.json` and `contracts/block-package.schema.json`, retain editable source files and provenance, and expose stable sockets, hit-zone nodes, anchors, and cross-engine exports. Babylon and Unreal must receive the same package identity even when their runtime formats differ.

## Visual-showdown acceptance

The Unreal comparison is only decision-worthy when it uses the same encounter seed, member identities, terrain semantics, objective, top-down commander view, FPS/TPS possession, physical fire inputs, and result fixture as Babylon. A visually impressive Unreal scene with different gameplay is not a valid comparison.
