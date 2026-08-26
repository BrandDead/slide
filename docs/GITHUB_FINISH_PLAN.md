# DEALT / SLIDE GitHub Finish Plan — Beyond Stripe

**Author:** Manus AI  
**Date:** 2026-08-26  
**Active integration PR:** [#119 — Recover beta work and add Modern Ops FPS/TPS slice][1]

## Executive decision

**Stripe is not the next product priority.** Payments should remain behind a feature flag until the game proves a stable, replayable single-player loop. The immediate priority is to merge PR #119, then finish persistence, Block DNA variety, live rival territory behavior, coherent production art, action-mode controls, and beta evidence. Monetization before those systems are dependable would optimize checkout before retention.

PR #119 establishes the correct foundation: recovered asset, Block DNA, Ghost Crew, beta-gate, and release work; one presentation-neutral combat controller; tactical/FPS/TPS Modern Ops views; one atomic strategy-result handoff; and a successful production build. It **advances** all six open issues but should not automatically close them because each still has explicit acceptance work.[1]

| Order | Product objective | Why it comes before Stripe | Exit gate |
|---:|---|---|---|
| 0 | Merge and stabilize PR #119 | All later work depends on the recovered foundation and shared action contract. | Required CI stays green; review feedback resolved; merge to `main-tL2525`. |
| 1 | Persistent world and rival crews | The map must change while the player plans, sells, and fights. | Rival state survives reload; named crews claim, reinforce, attack, and hold turf using shared economy rules. |
| 2 | Complete the Block DNA library | A territory game cannot retain players if every claimed block plays the same. | 30–40 cards across three tiers; authored packages; DNA persisted in Supabase; two tiers visibly and mechanically differ. |
| 3 | Production visual and asset contract | The current vertical slice proves the pipeline, not final character or vehicle fidelity. | No legacy role fallback in core views; zero high-fringe/no-alpha sprites; coherent tactical/FPS/TPS art. |
| 4 | Action-mode production pass | FPS/TPS must be controllable and legible on actual target devices. | Touch controls, gamepad support, animation states, audio, aim/reload feedback, camera collision, and device budgets pass. |
| 5 | Economy, heat, morale, and consequence balance | These systems create the strategic reason to replay the mini-games. | Tuned income/heat curves, transparent risk, jail/hospital/bail recovery, and no dominant exploit. |
| 6 | Beta gate and outside testing | Payments should follow evidence that the core loop is stable and understandable. | Release checklist complete, crash/performance telemetry, onboarding success, and tester retention evidence. |
| 7 | Stripe and monetization | Monetization becomes useful only after the loop has value and operational stability. | Products/prices mapped to a reviewed economy; receipts, refunds, entitlements, and failure states tested. |

## Open-issue reconciliation

| Issue | What PR #119 now provides | What still blocks closure | Recommended next PR |
|---|---|---|---|
| [#81 — NPC rival crew v1][2] | Named Ghost Crew identities, personality-driven deterministic decisions, treasury/roster/turf state, grudge memory, shared-economy behavior, store tests, and a visible threat banner. | Supabase persistence, authoritative world-tick integration, real adjacent DNA claims, contested-block handoff into combat, and the acceptance test where an ignored player loses ground after three ticks. | `feat/ghost-crew-authoritative-world` |
| [#80 — Block DNA library][3] | `BlockDNA` contracts, DNA stamping on claim, gameplay multipliers, tests, and a 17-card library recovered from the divergent branch. | Expand to 30–40 cards across all three tiers, bind authored location packages, persist DNA metadata to Supabase, and prove two tiers look and play differently without Mapbox in combat. | `feat/block-dna-40-and-persistence` |
| [#79 — Asset pipeline cleanup][4] | Runtime manifest repair, orphan registration, CI asset audit, WebP runtime paths, a 20 MB gate, and a measured 5.81 MB current runtime set. | Re-matte every flagged high-fringe source, recut all gameplay sprites with true alpha, remove duplicate originals, and make the audit explicitly fail on fringe/alpha violations. | `art/runtime-sprite-rematte` |
| [#78 — Manifest wiring][5] | Existing core wiring is preserved; the recovered work fixes additional manifest paths and registers unused runtime assets. Modern Ops also uses a registered generated facade rather than a hardcoded external asset. | Generate missing role states, replace procedural vehicles with real-alpha layers, and delete the final `gang_members.png` fallback after proving no live consumer remains. | `art/complete-role-and-vehicle-states` |
| [#77 — Canonical visual stack][6] | A real grid-to-world projection contract, authored Las Olas action target, runtime art provenance, lifecycle-safe 3D scene, and camera ownership rules. | Complete the 2.5D tactical art bible, actor animation/socket contract, shared four-direction staging, and one production-quality hero block. Modern Ops complements rather than replaces the canonical tactical diorama. | `art/las-olas-hero-block-production` |
| [#45 — Beta gate][7] | Smoke tests, release checklist, final build recovery, full frontend/backend tests, asset budget, and browser/WebGL evidence. | Check off the release list with deployed evidence, real-device FPS/memory budgets, touch testing, accessibility/onboarding review, and an outside-tester blocker sweep. | `release/beta-evidence-and-device-matrix` |

## Pull-request and branch state

At audit time, PR #119 is open against the actual default branch, `main-tL2525`. GitHub reports it as mergeable. The repository CI frontend and backend jobs passed, and the Vercel preview completed successfully; the optional review bot remained pending during the final check.[1]

| Branch | Divergence from `main-tL2525` | Disposition |
|---|---:|---|
| `main-tL2525` | Default branch | Keep. Merge PR #119 here. |
| `feat/modern-gameplay-completion` | 10 branch-only commits | Keep until PR #119 merges; then delete through the normal merged-branch cleanup. |
| `copilot/dev-oplan` | 2 default-only / 6 branch-only commits | Do not merge separately. Its six unique commits were cherry-picked and reconciled into PR #119. Delete only after #119 merges and patch equivalence is confirmed. |
| `feat/driveby-bullet-camera` | 1 default-only / 0 branch-only commits | Already merged by PR #118; safe to delete now or during post-merge cleanup.[8] |
| `copilot/connect-player-locations` | 10 default-only / 0 branch-only commits | Fully contained by the default branch; safe to delete after confirming no external automation targets it. |

No other pull request was open when PR #119 was created. The old divergent work is therefore consolidated into one review surface rather than competing branches.

## Four execution milestones

### Milestone A — Authoritative living city

Move Ghost Crew and Block DNA ownership from browser-local persistence to the existing backend/Supabase contract. A world tick should select one deterministic rival action, debit its treasury, mutate ownership, and emit a City Feed event. When a rival attacks a player block, the same encounter preparation and result boundary used by Modern Ops must resolve the contest. This milestone closes the largest strategic gap because it makes planning, selling, heat, and combat affect one shared world.[2] [3]

### Milestone B — Production Las Olas block

Replace capsule actors and procedural cover with production silhouettes, registered animation states, real-alpha vehicles, camera collision, street dressing, rain/audio ambience, and a coherent tactical projection. Preserve the existing deterministic grid as authority while the 2.5D tactical, FPS, and TPS presenters read the same state. The acceptance bar is one block that looks intentional in all three cameras and never needs a separate result model.[4] [5] [6]

### Milestone C — Consequence and balance pass

Tune selling distance, income multipliers, weapon accuracy, opponent pressure, heat gain, raid probability, overdose risk, morale loss, hospital/bail cost, and life-sentence escalation as one economy. Add seeded simulation tests for 100+ ticks and assert bounded money, heat, casualties, and rival growth. This is where the mini-games become one game rather than disconnected modes.

### Milestone D — Beta evidence

Run the release checklist on the Vercel preview and target mobile browsers. Record cold load, memory, sustained FPS, pointer-lock fallback, touch controls, pause/resume, WebGL loss, background/foreground recovery, and the complete claim → deploy → sell → defend → recover loop. Fix blocker and high-severity findings before enabling any paid product.[7]

## Merge and cleanup checklist

| Step | Owner action | Evidence |
|---:|---|---|
| 1 | Review PR #119 in the documented order and resolve optional review-bot findings. | Approved review and green required checks. |
| 2 | Merge PR #119 into `main-tL2525`. | Merge commit or squash commit on default. |
| 3 | Re-run production smoke on the merged Vercel deployment. | MAP → Strip → OPS 3D → FPS/TPS/TAC → apply result → injury flow. |
| 4 | Delete `feat/modern-gameplay-completion`, `copilot/dev-oplan`, `feat/driveby-bullet-camera`, and `copilot/connect-player-locations` only after the checks above. | Branch list contains only active work. |
| 5 | Create Milestone A issues/subtasks from #81 and #80, then start the authoritative-world PR. | One scoped PR with persistence migration, world-tick tests, and rollback plan. |

## References

[1]: https://github.com/BrandDead/slide/pull/119 "PR #119 — Recover beta work and add Modern Ops FPS/TPS slice"
[2]: https://github.com/BrandDead/slide/issues/81 "Issue #81 — NPC rival crew v1"
[3]: https://github.com/BrandDead/slide/issues/80 "Issue #80 — Block DNA library"
[4]: https://github.com/BrandDead/slide/issues/79 "Issue #79 — Asset pipeline cleanup"
[5]: https://github.com/BrandDead/slide/issues/78 "Issue #78 — Wire assetManifest into live renderers"
[6]: https://github.com/BrandDead/slide/issues/77 "Issue #77 — Canonical visual stack"
[7]: https://github.com/BrandDead/slide/issues/45 "Issue #45 — Beta gate"
[8]: https://github.com/BrandDead/slide/pull/118 "PR #118 — Complete the drive-by bullet camera"
