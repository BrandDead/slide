---
name: slide-visual-art-direction
description: Art direction and production-prompt skill for DEALT/SLIDE images, sprites, characters, vehicles, environments, effects, icons, UI mockups, and visual polish. Use whenever ChatGPT/GPT Image, Astra, FLUX, or another image model is asked to make or revise SLIDE art, or when a screen “needs to look better.” Enforces the canonical cinematic 2.5D tactical-diorama style, shared camera/light/scale, fictional regional identity, character continuity, gameplay readability, and runtime-ready deliverables instead of disconnected concept art.
---

# SLIDE Visual Art Direction

Generate art that can live together in one game and one camera. Do not generate isolated “cool images” first and invent integration later.

Read [Visual DNA and production briefs](references/visual-dna-and-briefs.md) before writing a prompt. If the output will enter the repository, also invoke `slide-asset-integration-qa` before calling the work finished.

Before any repository edit or asset import, read `AGENTS.md`, `docs/AI_CONTRIBUTOR_START_HERE.md`, and `docs/PROJECT_LOG.md`; inspect the assigned issue, open PRs, and current reservations; state scope and reserve exact files on the issue. If this is art exploration only, do not add runtime/package/manifest files and report that no repository scope was reserved. For meaningful landed work, append the required dated project-log entry.

## Workflow

1. **Name the runtime use.** Identify the exact screen/renderer, on-screen size, player action, asset class, state(s), and existing resolver/manifest entry it will replace or extend.
2. **Inspect the live screen and references.** Use the current runtime capture as the composition truth. Use `docs/concept-art`, `ASSETS.md`, and approved evidence as art references. Do not let an old prompt override current code or the project log.
3. **Lock one visual contract.** State camera, horizon/obliqueness, character scale, light direction, grade, material response, silhouette priorities, palette, and transparency. Every asset in the batch repeats this contract.
4. **Create a generation brief.** Use [the template](templates/generation-brief.md). Separate content, composition, continuity, runtime constraints, preserve list, exclusions, and output inventory.
5. **Choose a model adapter.** For GPT Image, use the five labeled blocks below. For Astra, inspect the live tool/model schema first; never invent parameter names. If Astra-specific controls are unavailable, provide the same structured brief as natural language plus reference-image roles and preserve constraints.
6. **Generate a proof before a batch.** Approve one hero frame in the live scene at final display size. Do not generate a full roster, city, or animation set until the proof passes.
7. **Derive states, do not reroll identity.** Use the approved image as the anchor. Change one state, view, or wardrobe element at a time. Preserve face, body, silhouette, outfit, palette, camera, light, and proportions.
8. **Reject before integration.** Reject camera drift, mixed rendering style, baked backgrounds on sprites, illegible silhouettes, warped hands/weapons, text artifacts, real logos/people/gangs, excess fog/glow, wrong light direction, and details invisible at runtime size.
9. **Hand off a complete package.** Return source/master files, each named runtime derivative, reference roles, prompts/settings, provenance, intended pivot, state inventory, and known gaps.

## GPT Image prompt adapter

Use this exact structure:

```text
SCENE
[Where this appears in SLIDE, fixed camera, background/alpha, world scale and lighting.]

SUBJECT
[Fictional character, vehicle, prop, environment, effect, or interface element.]

IMPORTANT DETAILS
[Silhouette, wardrobe/materials, regional cues, pose/state, palette, light direction, continuity anchors.]

USE CASE
[Runtime renderer, final display size, crop/pivot, required states or layers.]

CONSTRAINTS
[Preserve list, transparent/full-bleed rule, fictional-content rule, no text/logos unless exact copy is supplied, no camera/style drift, no effects the runtime cannot support.]
```

For edits, add:

```text
CHANGE: [one change only]
PRESERVE: [identity, geometry, crop, camera, lighting, palette, materials]
```

Use high quality for the approved source/master; generate runtime derivatives through the repository pipeline rather than asking the image model to fake compression.

## Astra prompt adapter

Provide:

1. **Primary instruction:** one coherent natural-language production brief.
2. **Reference map:** label every input as identity, camera/composition, palette/material, wardrobe, or environment reference.
3. **Preserve list:** state what cannot drift.
4. **Output inventory:** dimensions/aspect, transparency, states, and file naming.
5. **Exclusions:** express positive desired properties first; use explicit exclusions only for common generation defects.

Inspect Astra's current model/schema before selecting seed, image-reference, mask, aspect, or quality controls. Do not claim a seed or model option guarantees continuity. Continuity is proven by comparing outputs.

## Camera routing

Select the camera contract from the named runtime consumer; never force a tactical-diorama reference onto a different camera mode. For `TacticalDiorama`, tactical actor sprites, and tactical plates, use the approved fixed high-oblique projection and grid alignment. For the Modern Ops/Babylon first- or third-person route, use the current live capture and that route's approved camera contract (the supplied combat target is over-the-right-shoulder). Every brief must name `renderer`, `camera mode`, `reference capture`, `projection`, and final world/CSS size. Do not reuse an asset across modes without a confirmed adapter.

## Non-negotiable style rules

- Canonical **tactical-diorama world**: cinematic stylized-realistic 2.5D, fixed high oblique view, readable street/sidewalk/storefront depth, wet-night material response, restrained tropical-noir grade.
- The player sees a place; the 8×8 grid remains a subtle gameplay overlay, never the dominant art.
- World art shares one camera, world scale, light direction, shadow softness, and grade. Do not mix front-facing portraits, side-view cars, overhead satellite plates, pixel art, cel shading, and photoreal bodies in one scene.
- UI is sparse and sharp: near-black `#0A0A0F`, charcoal `#1A1A2E`, danger red `#FF4444`, action green `#00FF88`/`#4ADE80`, restrained gold `#FFD700`, off-white `#F5F5F7`. Use Rajdhani/Oswald/Bebas-like hierarchy in code; do not bake UI text into world art.
- Use fictional names, people, organizations, brands, and signs. Regional architecture, climate, materials, vegetation, and fashion may ground the world without copying real individuals or criminal organizations.
- Gameplay readability beats cinematic spectacle: readable cover, exposure, threats, pathways, role silhouettes, and state changes.

## Sprite and character rules

- Generate an approved identity/wardrobe sheet first, then one camera-matched hero state, then derive the remaining states.
- Prefer separate single-state transparent images over asking a generative model to compose a large atlas. Assemble atlases deterministically after approval.
- Street/fullbody source: upright character, full silhouette, feet visible, bottom-center pivot, transparent background, no baked shadow unless requested as a separate layer.
- Tactical source: true camera-matched oblique/topdown view, centered pivot, silhouette readable at 48–96 CSS pixels.
- Name the destination class in every inventory row: `characters/street` or `characters/fullbody` uses `(0.5, 1.0)`, while `characters/topdown` and `characters/portraits` use `(0.5, 0.5)`. An otherwise correct image in the wrong directory is not integrated because the processor, manifest, and resolver derive behavior from that path.
- Minimum 2D gameplay states by role: idle, aim, fire, hit, downed. Add walk/reload/cover/arrested only where the live state machine uses them.
- A portrait is a contact identity asset, not a substitute for a tactical or street sprite.

## Output

Return:

- Asset brief and runtime target
- Selected model and verified controls
- Ready-to-copy prompt(s)
- Reference-image map and preserve list
- Output inventory and filenames
- Rejection checklist
- Integration handoff to `slide-asset-integration-qa`
