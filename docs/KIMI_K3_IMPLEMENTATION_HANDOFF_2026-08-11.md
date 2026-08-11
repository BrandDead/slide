# Kimi K3 Implementation Handoff — DEALT / SLIDE

**Repository:** `BrandDead/slide`
**Prepared:** 2026-08-11
**Current default branch:** `main-tL2525`
**Repository state at handoff:** PRs #104–#106 were reconciled, validated, merged through #107, and closed as superseded. There are no open pull requests or unmerged remote branches.

> **Use the prompt below as the initial GitHub Copilot cloud-agent request. Do not append unrelated instructions from prior agent sessions.**

---

## Prompt to paste into Kimi K3

```text
You are the lead implementation engineer for the DEALT / SLIDE repository. Work deliberately, preserve the established architecture, and make the game feel like a premium modern interactive tactical RPG—not a set of disconnected prototypes.

<repository>
Repository: BrandDead/slide
Default branch: main-tL2525 (protected)
Stack: React 18 + TypeScript + Vite + Zustand frontend; Flask + SQLAlchemy/Supabase-capable backend.

Before changing anything, read these files in order:
1. AGENTS.md
2. docs/PROJECT_LOG.md
3. docs/ARCHITECTURE.md
4. docs/MVP_STATUS_AND_DEV_PLAN_2026-07-16.md
5. docs/GAME_DESIGN_BIBLE_PART1.md and docs/GAME_DESIGN_BIBLE_PART2.md
6. docs/KIMI_K3_IMPLEMENTATION_HANDOFF_2026-08-11.md
7. The open GitHub issues, especially #108, #109, #77–#81, and #45.

The repository is clean after reconciliation merge #107. Do not resurrect or merge the closed/superseded PRs #104, #105, or #106. Build on current main only.
</repository>

<product-direction>
DEALT / SLIDE is an 18+ fictional urban strategy game presented through an iOS-like desktop. The player claims a block, recruits a crew, positions members, equips product, earns income while balancing exposure, defends territory through a tactical drive-by encounter, absorbs heat, raids, wounds, arrests, bail/hospital costs, morale, and reinvestment.

The beta must prove one connected, recoverable loop:
claim a block → recruit dealer + shooter → deploy → equip product → make money → heat rises → survive a defense or raid → resolve consequences → reload the same saved empire.

Treat every person, gang, institution, and storefront as fictional. Do not use real gang names, real people, real criminal organizations, real-world tactics, or photoreal depictions of a user-entered private address. An address may be used only as an abstract deterministic seed and selection input; render the result with the authored Block DNA library and generic fictional signage.
</product-direction>

<non-negotiable-engineering-rules>
1. Never commit or push directly to `main-tL2525`. Create one focused branch and one pull request per bounded issue or coherent milestone.
2. Never delete, replace, or regress a working feature merely to simplify a task. Inspect existing code and integrate before recreating.
3. Never change or expose secrets, production payment credentials, real customer data, or Supabase service-role keys. Do not implement live charging, refunds, or entitlement grants unless a separate, explicit task authorizes that work.
4. Preserve the offline development contract: blank Supabase and database environment values must allow Flask mock-store API tests to run. If coordinates and an address are supplied, the backend must not require a Mapbox network call.
5. Keep the authoritative gameplay model separate from visual projection. The tactical grid is authoritative; the 2.5D scene, procedural street, sprites, and effects are visual consumers of it.
6. Do not silently broaden product scope. Do not add extra cities, synchronous multiplayer, native mobile delivery, premium currency, new mini-games, or a broad product catalog before the core beta loop is persisted and tested.
7. Respect the 18+ fictional-content gate and keep language, art, and UI non-graphic. Prefer strategy, consequence, and stylized tactical feedback over graphic violence.
8. Do not close issues, merge pull requests, alter GitHub Actions, or change dependencies without documenting why in the PR and requesting review.
</non-negotiable-engineering-rules>

<visual-and-ux-bar>
Use the repository’s approved canonical look: cinematic 2.5D oblique tactical diorama, fixed high-angle camera, tropical-noir palette, authored location plate, real alpha sprites, restrained neon HUD, strong typography, and motion with gameplay purpose. The visible 8×8 grid is an interaction layer, not the world artwork.

Kimi K3 is strong at visual reasoning. Use that advantage responsibly:
- Inspect `docs/concept-art/`, `docs/qa/`, and live preview screenshots before modifying a player-facing screen.
- Preserve the currently wired visual assets and generated WebP runtime paths.
- For every visual milestone, compare before/after screenshots at desktop and a narrow viewport. Fix broken paths, text truncation, contrast, tap targets, and layout jitter before claiming completion.
- Never ship emoji, flat-color cells, or `gang_members.png` in player-facing block/combat views when the manifest-backed visual route exists.
- Use cinematic camera treatment for world scenes; use DOM/SVG only for HUD, selection, menus, and accessibility overlays.
</visual-and-ux-bar>

<work-order>
Work in the following order. Stop after each numbered milestone, run its required checks, and open a reviewable PR. Do not start a later milestone if an earlier one lacks a passing acceptance test.

Milestone 0 — Establish a trustworthy baseline
- Confirm `npm run typecheck`, `npm test`, `npm run build`, `npm run assets:audit`, and `backend/python/venv/bin/python -m pytest` pass.
- Read the latest project log and produce a short implementation note listing actual state versus each open issue. Do not edit code in this milestone unless the baseline is broken.

Milestone 1 — Complete structured drive-by target selection (issue #108)
- Replace `CarCrew.targetBlock: string | null` with a structured target contract containing normalized address, optional coordinates, and optional place identifier.
- Reuse the existing address-search result contract rather than inventing a second geocoding flow. A typed target must pass through `CarCrewSelector` → `DriveByGame` → `DriveByEngine`.
- When latitude/longitude exist, pass them to `resolveBlockDNA`; never use fixed Fort Lauderdale coordinates for a user-selected target.
- When offline/no coordinates, derive a deterministic non-geographic seed from normalized address text, label the fallback in code, and avoid network work inside rendering or animation loops.
- Add unit tests proving two coordinate-distinct targets create distinct scenes and that a selected target is stable across reload/retry.

Milestone 2 — Repair the Block DNA scene projection (issue #109)
- Establish a small, documented projection contract that transforms the depth-ordered `zoneLayout` into road, curb, sidewalk, façade/setback, alley, and skyline draw passes.
- Do not treat depth rows as successive frontage columns. If repeated lots are needed, create a separate deterministic frontage sequence or explicit lot metadata.
- Preserve stable segment identifiers and keep future collision/destruction hooks possible.
- Write projection tests for at least three DNA archetypes and use screenshots to validate depth ordering.

Milestone 3 — Build the persistent production spine
- Implement one server-authoritative player-state contract with revision/version handling and idempotency keys, or finish a normalized equivalent already present in schema.
- Persist and reload money, heat, inventory, crew, member status, territory/Block DNA ID, placements, wounds, arrests, morale, and loadout for the authenticated owner.
- Keep the frontend stores as responsive view/state caches, not the source of truth for grants, losses, or economy results.
- Add golden-path integration coverage: age gate → sign-up/onboarding → claim → recruit/deploy/equip → earn → raid/combat consequence → refresh → sign out/in → same state.
- Make every money/inventory mutation server validated, auditable, idempotent, and bounded against negative balances or duplication.

Milestone 4 — Deliver one complete, balanced empire loop
- Use one dealer, one shooter, three base products, and one deliberately high-profit/high-heat upgraded product. Do not widen the catalogue.
- Make placement risk readable: street-facing positions earn more but raise exposure; safer positions earn less. Centralize formulas, show their inputs in the UI, and test the edge cases.
- Connect SLIDE/DRIVE outcome to crew assignments, weapon/ammunition state, cover, health, arrest, seized inventory, heat, bail/hospital choices, morale, and persistence.
- Ensure interactive raid handling and background raid handling call the same authoritative consequence service. UI text must never claim an item was seized while the persistent inventory still retains it.

Milestone 5 — Make the world alive and varied
- Implement the initial 5–10 authored Block DNA cards for #80 before expanding toward 30–40. Each must alter visuals and gameplay modifiers, persist its ID, and be chosen fairly by tier/borough.
- Implement ghost crews for #81 as persistent NPCs with identity, behavior card, budget, roster, claimed blocks, and memory. They must use the same economy/claim/combat rules as the player.
- Surface NPC actions in City Feed and keep their actions deterministic/replayable for tests.

Milestone 6 — Launch hardening and visual fidelity
- Finish #77–#79 and #45: camera/asset bible, art projection contract, genuine alpha/defringed sprite set, asset budget enforcement, runtime asset manifest cleanup, smoke tests, error states, performance checks, release checklist, and explicit deferrals.
- Address current known hygiene items: seven asset-audit orphan warnings; `datetime.utcnow()` deprecations; Mapbox/Phaser bundle warnings; and any code paths that still use inconsistent top-level versus canonical nested member stats.
- Design first for 1440×900 desktop and verify a narrow viewport. Mapbox must not eagerly load for non-map routes.

Paid-access work is intentionally separate. Do not build checkout or live webhooks in this workstream. If payment UI is needed, implement only a feature-flagged, read-only entitlement lock that consumes an already verified server result.
</work-order>

<definition-of-done-for-each-pr>
Every PR must include:
1. A concise scope statement and links to the addressed issue(s).
2. Architecture notes identifying authoritative data, cache/view state, and failure behavior.
3. Tests that fail before the change and pass after it, plus edge cases for persistence/idempotency where state changes.
4. `npm run typecheck`, `npm test`, `npm run build`, `npm run assets:audit`, backend pytest, and `git diff --check` results.
5. Visual evidence for player-facing changes: desktop and narrow viewport screenshots or a short recording, with a sentence explaining what was inspected.
6. A dated append-only entry at the top of `docs/PROJECT_LOG.md` once the change is ready for merge.
7. An explicit list of deferred work. Do not mark an issue complete unless its acceptance criteria are demonstrably met.

If requirements conflict, stop and write a decision note in the PR instead of improvising. Prefer a small correct vertical slice over a broad untested rewrite.
```

---

## Why the prompt is structured this way

Kimi K3 is available in GitHub Copilot, including the Copilot cloud agent, subject to plan availability and organizational policy; GitHub states that business and enterprise administrators must enable the model explicitly.[1] Kimi describes K3 as a long-horizon coding and multimodal model, and specifically highlights game-development and screenshot-driven iteration as strengths.[2] [3]

The explicit milestone boundaries are intentional. Moonshot’s own documentation recommends clear steps, reference text, delimiters, and concrete desired output; K3’s technical blog also cautions that the model can be excessively proactive when objectives are ambiguous.[2] [4] The prompt therefore gives it the visual opportunity to inspect and improve game UI, while preventing unsupervised scope expansion, direct-main changes, payment work, or unsafe external integrations.

## Recommended Copilot operating setup

| Setting | Recommendation | Rationale |
|---|---|---|
| Model | **Kimi K3** | It is generally available in GitHub Copilot and positioned for agentic, long-horizon coding.[1] |
| Work unit | **One milestone / one PR** | Keeps the model’s long context focused and makes rollback/review tractable. |
| Starting materials | Paste the prompt, then direct it to the repository files named in `<repository>` | Kimi’s guidance favors clear reference text and ordered steps.[4] |
| Visual validation | Ask for screenshots from the Vercel preview or local production preview after every player-facing task | K3 has native visual capability and its publisher recommends visual feedback for frontend/game work.[2] [3] |
| Review gate | Require human review after CI plus the stated visual evidence | Avoids accepting broad autonomous changes solely because automated tests pass. |
| Constraints | Keep the `<non-negotiable-engineering-rules>` section unchanged | Kimi explicitly notes a tendency toward excessive proactiveness under ambiguous instructions.[2] |

## References

[1]: https://github.blog/changelog/2026-08-06-kimi-k3-is-now-available-in-github-copilot/ "GitHub Blog — Kimi K3 is now available in GitHub Copilot"
[2]: https://www.kimi.com/blog/kimi-k3 "Moonshot AI — Kimi K3: Open Frontier Intelligence"
[3]: https://platform.kimi.ai/docs/guide/kimi-k3-quickstart "Kimi API Platform — Kimi K3 quickstart"
[4]: https://platform.kimi.ai/docs/guide/prompt-best-practice "Kimi API Platform — Best Practices for Prompts"
[5]: https://docs.github.com/copilot/reference/ai-models/supported-models "GitHub Docs — Supported AI models in GitHub Copilot"

---

**Handoff status:** This file is a planning and operating contract. It does not authorize direct production changes, live payment processing, or merges without review.
