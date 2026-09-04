# DEALT / SLIDE — AI Contributor Start Here

**Purpose:** This is the current entry point for any AI model or human contributor. It explains what the game is, what is already merged, what may be worked on next, and how to contribute without breaking or duplicating work.

> **Do not start from an old prompt file.** Historical prompts in `docs/` and `prompts/` can be useful background, but they may describe superseded architecture, tests, maps, or branches. Follow the source-of-truth order below.

## 1. What this game is

DEALT / SLIDE is an **18+ fictional urban strategy game** presented as an iOS-style command desktop. The player claims fictional territory, assigns a crew to tactical cells, earns and protects resources, reacts to heat and rival activity, and enters deterministic encounter modes. The core value is **connected consequences**: a decision in territory strategy changes combat readiness, earnings, risk, and what the player sees when they return.

The visual direction is a cinematic **2.5D tactical diorama**. The player-facing Strip should feel like a place, not a spreadsheet: the tactical grid is a gameplay layer beneath the visual scene.

## 2. Current product state

The deployable source of truth is the protected default branch: **`main-tL2525`**.

| Area | Current state | Evidence / owner |
|---|---|---|
| Command desktop and return-state briefing | Merged. Durable Ghost Crew events appear in the City Briefing and route to an existing response. | PR #125; `components/layout/CityBriefing.tsx` |
| Territory strategy | Merged. Territory remains playable if the optional street map fails; the player can retry or use the Strip, recon, claims, and crew placement. | PR #128; `components/map/PlayableMap.tsx`, `TerritoryMap.tsx` |
| Block DNA | Merged. The library currently has **25 fictional archetypes**, and the stored DNA assignment owns a claimed block's grid and encounter terrain. | PR #128; `config/blockDNA.ts`, `utils/blockDNAResolver.ts` |
| Authoritative-world foundation | Code is merged, but its migrations and guarded tick endpoint have **not** been proven in a confirmed non-production Supabase project. | `backend/supabase/migrations/005_*`, `006_*`; `backend/supabase/functions/world-tick-ghost/` |
| Default branch quality | Verified at the latest closed-alpha release: frontend tests, TypeScript, asset audit, production build, backend tests, GitHub CI, Vercel preview, and automated review passed. | `docs/CLOSED_ALPHA_SPRINT_INTEGRATION_REPORT.md`; PR #128 |

## 3. The living sources of truth

Read these **in this order** before changing code. If two documents disagree, the earlier item wins.

1. [`AGENTS.md`](../AGENTS.md): local runtime, test, auth, and environment guardrails.
2. [`docs/PROJECT_LOG.md`](PROJECT_LOG.md): current decisions, merged work, roadmap order, and rollback history. Append a dated entry when meaningful work lands; do not rewrite older entries.
3. Open GitHub issues and pull requests: they are the active work queue and review record.
4. [`docs/AI_MANUS_AUTHORITATIVE_WORLD_DESIGN.md`](AI_MANUS_AUTHORITATIVE_WORLD_DESIGN.md): ownership and idempotency boundaries for durable world state.
5. The prepared non-production proof runbook on the [`ops/closed-alpha-world-proof` branch](https://github.com/BrandDead/slide/blob/ops/closed-alpha-world-proof/docs/NONPRODUCTION_AUTHORITATIVE_WORLD_PROOF.md): the exact proof required before migrations or a scheduler can touch any live service.
6. The relevant code, test, and existing component/store/service contract.

The following documents are **background only**, not current execution instructions: `docs/AI_MODEL_ASSIGNMENTS.md`, `docs/AI_MODEL_PROMPTS.md`, `docs/AI_DEVELOPER_CODEBASE_PROMPT.md`, older files in `prompts/`, and old status sections in `README.md`. Do not blindly implement tasks described there.

## 4. Non-negotiable product and data contracts

| Contract | Requirement |
|---|---|
| Fictional content boundary | Keep location, crew, rival, and narrative content fictional. Do not add real people, real criminal organizations, or instructions that mirror real-world wrongdoing. |
| One authoritative state path | Extend existing stores, services, hooks, and result boundaries. Do not create a second state container, duplicate notification stream, or parallel placement system. |
| Block DNA stability | A claimed block's persisted `dnaId` is authoritative. New catalog entries must not change an existing block's tactical terrain, grid, income modifier, or encounter profile. |
| Tactical grid | Use the existing eight-row Block DNA layout builder and `blockStore` grid helpers. Only passable, unoccupied cells may receive crew placements. |
| Map is optional | Street-map imagery is geographic context, not a gameplay prerequisite. Failure must leave strategy, recon, claims, Strip placement, and response routes usable. |
| Result integrity | Encounter outcomes use existing idempotency keys and server receipts. Never apply the same result twice or bypass the persistence/service boundary. |
| Production data | Never apply Supabase migrations, change RLS, deploy the world tick, create a scheduler, or use a service secret unless the task explicitly names a confirmed non-production target and includes the proof runbook. |

## 5. Safe parallel AI workflow

Multiple models can work at the same time **when their file ownership does not overlap**. Every model must work from the newest `origin/main-tL2525`, make a focused branch, and open a pull request. No model should merge a PR, deploy a database migration, alter environment secrets, close issues, delete remote branches, or modify another model's branch.

| Step | Required behavior |
|---:|---|
| 1 | Read the six source-of-truth items above, then inspect open PRs, issues, and recent commits. |
| 2 | State the exact user outcome, in-scope files, out-of-scope files, and acceptance checks before coding. |
| 3 | Reserve the file list on the assigned GitHub issue **before coding**. If no issue exists, stop and ask the integration owner to create or assign one; do not race another contributor. |
| 4 | Create one branch such as `feature/80-block-dna-batch-two` or `fix/79-alpha-cleanup`. Do not use a generic branch. |
| 5 | Reuse existing components, stores, services, types, and tests. Search before creating a new file or system. |
| 6 | Add focused regression tests for the changed behavior and run the relevant full validation commands. |
| 7 | Open one focused PR with changed files, player impact, verification evidence, known limitations, and operational impact. Do not merge it. |
| 8 | Leave the branch and PR for the integration steward to reconcile with compatible work in an isolated integration branch. |

### File ownership rule

Before coding begins, reserve files in a comment on the assigned GitHub issue. Two agents must not independently edit the same store, mapper, migration, root application shell, or shared CSS file. The later pull request repeats the reservation for review traceability. If overlap is unavoidable, split the work into a design-only PR and an implementation PR, or assign a single integration owner.

## 6. Current work queue

The active GitHub issues are the backlog. Do not assume that the oldest issue is next; first confirm its status against the project log and default branch.

| Priority | Work | Suggested branch | Parallel safety |
|---:|---|---|---|
| P0 | Prove the authoritative-world migrations, RLS, guarded Ghost Crew tick, idempotency, and rollback in a confirmed non-production Supabase project. | `ops/closed-alpha-world-proof` | **Do not execute** until a disposable/staging project is explicitly named. |
| P1 | Finish the remaining 2.5D scene and camera contract work. Asset-manifest wiring and the initial asset cleanup are already merged; audit #78/#79 before proposing only genuinely unfinished follow-up work. | `feature/77-diorama-camera-contract` | Renderer and asset files are shared; reserve exact files before coding and avoid parallel changes without an explicit integration plan. |
| P1 | Continue Block DNA toward the planned 30–40 fictional cards. | `feature/80-block-dna-batch-two` | Safe in parallel only if it limits changes to DNA config, its design brief, and resolver/encounter tests. Do not edit map resilience or persistence code. |
| P1 | Strengthen Ghost Crew / NPC rival behavior after the non-production proof clarifies durable tick operations. | `feature/81-ghost-crew-alpha` | Begin with a design/test branch; do not introduce a scheduler or migration without the P0 proof. |
| P2 | Beta art, QA, performance, and release readiness. | `chore/45-beta-gate-*` | Split into non-overlapping audit, performance, accessibility, and release-checklist branches. |

## 7. Required validation

Run the narrowest relevant test first, then the full checks before opening a PR.

```bash
cd frontend
npm run validate
npm run build

cd ../backend/python
./venv/bin/python -m pytest tests -q
```

Also perform a player-path check when a feature changes strategy, placement, notifications, a mini-game, or recovery behavior. Verify the happy path and a realistic failure path. Use deterministic demo mode only for demo verification; never treat it as proof of durable Supabase behavior.

## 8. Pull request template

Use this structure in every AI-created PR.

```markdown
## Outcome
[One sentence describing what a player or operator can now do.]

## Scope
**In:** [files and behavior changed]
**Out:** [explicitly not changed]
**Reserved files:** [shared files this PR owns]

## Contracts preserved
- [Relevant state, persistence, DNA, map-fallback, or idempotency rule]

## Verification
- [Focused tests]
- [Full validation commands and outcomes]
- [Manual/player-path check]

## Operational impact
[None, or migrations/RLS/secrets/scheduler/deployment change with rollback plan.]

## Integration notes
[Dependencies, conflicts expected, or PRs that must not merge first.]
```

## 9. Copy/paste assignment prompt for any AI model

```text
You are contributing to the DEALT / SLIDE repository: https://github.com/BrandDead/slide

Start from the protected default branch `main-tL2525`. Before coding, read:
1. AGENTS.md
2. docs/AI_CONTRIBUTOR_START_HERE.md
3. docs/PROJECT_LOG.md
4. the GitHub issue assigned below
5. the current open PR list and relevant existing source/tests

Your assigned outcome: [INSERT ONE OUTCOME]
Your assigned issue: #[NUMBER]
Your branch name: [INSERT SINGLE-PURPOSE BRANCH]
Your allowed files: [LIST]
Your forbidden/shared files: [LIST]

Rules:
- Keep content fictional and preserve the existing 18+ game boundary.
- Reuse current stores, services, types, and components. Do not create a duplicate system.
- Do not merge, deploy, alter Supabase, change secrets, close issues, delete branches, or edit another contributor’s branch.
- Before coding, reserve your allowed files in a comment on the assigned GitHub issue. If a conflicting reservation exists, stop and ask the integration owner to split or sequence the work.
- Do not apply migrations, RLS changes, tick endpoints, or schedulers unless a confirmed non-production target and the prepared `ops/closed-alpha-world-proof` runbook are explicitly part of the assignment.
- Add focused tests and run the full validation commands documented in AI_CONTRIBUTOR_START_HERE.md.
- Open one PR using the required PR template. Include exact changed files, test evidence, known limits, and integration notes.

Return with the branch name, PR URL, changed files, validation results, and anything an integration owner must know. Do not merge your PR.
```

## 10. Integration owner checklist

The integration owner, not the contributing model, combines compatible PRs. Before merging, the owner must review every open PR and branch, verify no overlapping ready work is omitted, assemble compatible changes in an isolated integration branch, run full validation and player-path checks on the combined result, resolve every applicable review finding, obtain required merge approval, and then verify default-branch CI and deployment after merge.

## 11. Known release gate

The build is **closed-alpha ready for continued feature work**, but it is **not yet proven for durable authoritative-world operations**. The remaining P0 requirement is a non-production Supabase/RLS/world-tick proof against a clearly named disposable or staging project. Treat this as blocked until the environment is confirmed.
