# Production Art V1 — Visual Review

**Evidence date:** 2026-08-29
**Final captures:** `docs/evidence/production-art-v1/`

The runtime conclusively loads `character.universal-male.pipeline-v1` and renders independently animated rigs in tactical, first-person, and third-person modes. Scale, ground placement, physical bone hit zones, right-hand weapon attachment, camera possession, member switching, PBR road/concrete/brick response, and the exactly-once result return are functional. This is a production-pipeline improvement over capsules and renderer-owned character assumptions.

The selected free standard Quaternius asset is not suitable as final member art. Its only male full-body option is a bare-torso superhero wearing briefs. The underlying UV and final TPS capture confirm that the asset demonstrates the rig and animation path but does not represent the game’s character-driven streetwear vision.

Two bone-attached procedural clothing experiments were tested in the live TPS view. Although both followed the skeleton and preserved the browser gauntlet, their local bone orientation produced oversized torsos and disconnected shoes, degrading silhouette and member identity. Both experiments were removed. This confirms that procedural clothing cannot rescue an unsuitable source body at target quality.

The environment’s imported asphalt, concrete, and brick maps create denser surfaces and preserve the invisible gameplay grid. The block still remains below the visual target in modeled storefront depth, background-city density, wet reflections, vegetation, vehicle fidelity, lighting complexity, and authored human detail.

The approved next visual gate is therefore one authored clothed hero and one distinct rival that satisfy `character-package.schema.json`. They must be evaluated live in tactical, FPS, and TPS—not as standalone renders—before the roster is scaled.
