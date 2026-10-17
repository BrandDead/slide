# SLIDE / DEALT — Launch readiness audit

**Date:** 2026-10-17  
**Audited revision:** `main-tL2525` at `9eef5aa`, plus the photo-likeness work on this branch  
**Owner ask:** ship the best street-war game — live-action shooter plus territory/strategy, deeper than GTA, better than the recently released street-war FPS (treated here as **Hood Warfare 2**, Steam, 8 Oct 2026; there is no current “Street Warfare 2” store listing).

This document reconciles the living sources of truth (`docs/AI_CONTRIBUTOR_START_HERE.md`, `docs/PROJECT_LOG.md`, `docs/RELEASE_CHECKLIST.md`, `docs/MVP_2026_SCOPE.md`, `docs/SAVED_GAME_READINESS_2026-09-25.md`, issues #45 / #175 / #195) with what is actually in the repo and what this run could execute. Older files such as `docs/BETA_LAUNCH_ASSESSMENT.md` (Jan 2025) and `docs/MISSING_COMPONENTS.md` are **stale** and should not be used as a launch plan.

**Honest product verdict:** SLIDE is a **closed-alpha web command desktop** with a real single-player territory loop and several combat toys. It is **not** a public multiplayer shooter and **not** ready for a store or paying public launch. The path to a good first launch is a tight web beta around one saved empire, not a feature race against Hood Warfare 2.

---

## Genre comparison (what players will judge)

| Expectation | Hood Warfare 2 (live competitor) | What SLIDE actually is | Launch implication |
|---|---|---|---|
| Shooting feel | Unreal Engine 5 multiplayer FPS, six modes, four Chicago maps, weapon customization | Browser canvas/Phaser/Babylon encounters (Las Olas V3 drive-by, grid SLIDE, UnifiedEncounter). Readable, not a packaged FPS. | Do **not** market as a live-action shooter yet. Lead with crew + block strategy; keep one good defense fight. |
| Territory control | Session turf-war modes | Persistent fictional blocks, Block DNA (40 cards), claims, Strip desk, ghost-crew pressure | This is SLIDE’s actual differentiator. Launch on it. |
| Crew management | Loadout / gang pick before a match | Contacts, roles, hospital/bail, photo recruit, placement on a block | Must feel personal. Photo-friends-on-the-crew is the unique hook. |
| Progression | Match-to-match shooter loop | Levels, XP, morale, heat, stash, shoebox — locally rich, server proof incomplete | A returning empire is the GTA-like depth. Without save, there is no launch. |
| Economy | Match scoring / cosmetics | Dealing, cook, market, trap, shoebox, heat/raid costs | Keep one connected cash path. Hide side economies that do not write the same books. |
| Multiplayer / social | The whole product | Ghost crews + a Socket.IO client with no shipped realtime server | Ghost rivals are the launch stand-in. Live PvP is a later game. |
| Onboarding | Steam match flow | Age gate, Auth screen, gang onboarding, tutorial overlay | Fine for closed alpha. Public launch needs a five-minute first block. |
| Performance | Native UE5 | Vite/React web; Mapbox vendor chunk is large; combat is canvas | Web beta on phone + desktop. No native store until the loop is trusted. |
| Monetization | $5.99 Steam | Read-only entitlement API, no checkout/webhooks | Do not take money until save + refunds work. |
| Store / platform | Steam page, ratings, age disclaimer | Web app gated on Supabase. No iOS/Android/Steam packaging. | First launch = invite web URL. Stores are post-launch. |

SLIDE cannot beat Hood Warfare 2 at “jump in and shoot.” It can beat it at **owning a block, putting your friends on the crew, and coming back to the same war.** That is the launch product.

---

## (a) What works today

Verified in this environment unless marked otherwise.

### Verified in this run

| Check | Result | Notes |
|---|---|---|
| Default branch checkout | `main-tL2525` @ `9eef5aa` | Clean working tree before this branch |
| Frontend unit tests (focused likeness + creator) | See PR verification | New photo-likeness contract |
| Backend likeness tests | See PR verification | Consent, no stock swap, source deleted |
| Avatar blueprint | Now registered on Flask | Previously written but **not mounted** — `/api/avatar/*` 404’d, so the client always fell back |
| Photo recruit UI | Contacts + Phone | Consent, name, role, style, outputs, add-to-roster. Live demo at 390×844: Generate stays disabled without consent; result is labeled photo-based likeness; Jay appears on the CREW card with the uploaded face. |
| Local API CORS | Flask default now allows :3000 and :5173 | Previously the documented Vite port 3000 was blocked, so the browser always took the offline path |

### Product surfaces that exist and are playable in demo mode

`VITE_DEMO_MODE=1` bypasses Supabase and seeds a Las Olas block. This is the only fully walkable path without credentials. The home screen exposes **every** app as available:

**Core loop (keep):**

- **Age gate** — versioned 18+ / fictional-content notice (`AgeGate.tsx`). Implemented and tested.
- **Auth shell** — email sign-in/up UI exists; production credentials are not proven here.
- **Onboarding** — gang name, tag, style, colors, optional logo, graffiti pick.
- **STRIP (`BlockLoopDesk`)** — the connected claim → place → earn → fight desk. This is the real game.
- **MAP** — recon, claims, tactical diorama, street imagery optional. Failure must leave the Strip playable (PR #128). **Do not regress this.**
- **CONTACTS / CREW / PHONE** — roster, roles, hospital/bail, photo recruit.
- **DEALT** — swipe dealing; v2 selector also present.
- **COOK** — alchemy lab with recipes.
- **DRIVE** — car loadout + canvas shooter. Seat rules exist; individual shot attribution is still #201.
- **SLIDE / UnifiedEncounter** — grid / encounter combat with persistent-looking receipts in demo.
- **SHOEBOX / TRAP / MARKET** — cash, stash, shop. Demo books work locally.
- **Ghost crews** — NPC rivals, banners, incidents. One visible Strip attack is still #163.
- **Block DNA** — 40 fictional archetypes. Claimed `dnaId` is authoritative.

**Present but not launch-critical:**

- Casino, Cocaine Crush, Bip N Dip, graffiti/Vandalize, leaderboard/Clout, Local News, Wanted/bounties, OPS planner, ATTACK top-down, RAID, Messages (routes to Phone).
- Experimental `unreal/DealtSlideShowdown` — not the ship target.
- Socket.IO client (`socket.service.ts`) — client only.

### Persistence and backend

| Layer | State |
|---|---|
| Flask API | Blocks, player, combat, world, inventory, drive-by, entitlements (read-only), NPC, art, **avatar (now registered)** |
| Offline / no Supabase | In-memory mock + `DEV_USER` auth bypass. `pytest` is designed for blank `SUPABASE_URL`. |
| Supabase schema | Migrations through 007 exist. Staging proof recorded. **Production must not be touched from this work.** |
| Authenticated return session | Code exists (`authPlayer`, `useEmpireHydration`, `useBlockSync`). **#175 player proof is still open.** |
| Payments | `GET /api/entitlements/me` only. No checkout, webhook, or grant UI. |

### Visuals

Cinematic 2.5D tactical-diorama direction is decided (#77). Runtime assets are on a 20 MB budget and audit-gated. Live renderers still mix strong Las Olas V3 work with role silhouettes, leftover emoji in some chrome, and stock portraits when a custom face is missing. Release checklist items for “no emoji / all actors through resolver” are **unchecked**.

### Documents that are still true

- `docs/AI_CONTRIBUTOR_START_HERE.md` — closed-alpha, not external/paid beta.
- `docs/RELEASE_CHECKLIST.md` — outside-tester gate; almost every box open.
- `docs/MVP_2026_SCOPE.md` / `docs/MVP_STATUS_AND_DEV_PLAN_2026-07-16.md` — paid MVP is one connected saved loop, not more mini-games.
- `docs/SAVED_GAME_READINESS_2026-09-25.md` — staging foundation ready; returning-player proof is not.

### Documents to ignore for launch planning

- `docs/BETA_LAUNCH_ASSESSMENT.md` — claims “no backend/auth” and a 3-week beta. Superseded.
- `docs/MISSING_COMPONENTS.md` — lists SlideGame / TerritoryMap / casino as missing. They exist.
- `docs/REALTIME_MULTIPLAYER_COMPLETION.md` — unfinished prompt dump, not a shipped system.
- Root `README.md` marketing copy (“multiplayer urban warfare RPG”) oversells live PvP.

---

## (b) Launch blockers, ranked

Effort is **focused engineering days** for one person who already knows the repo, not calendar time.

| Rank | Blocker | Why it stops a public launch | Effort | Evidence |
|---:|---|---|---|---|
| 1 | **No proven returning account** | A public player cannot trust that cash, crew, block, wounds, and heat survive refresh / second device. | 8–15 days (ops + proof, not new architecture) | Issue #175; start-here §11 |
| 2 | **Core loop still forks** | Desktop ATTACK / OPS planner can bypass the canonical encounter (#192). Drive-by shots are not bound to the named passenger (#201). Ghost attack is not a single visible Strip fight (#163). Testers will say “the war doesn’t connect.” | 6–12 days | Issues #192, #201, #163, #188 |
| 3 | **Photo friends were stock art** | The headline social feature failed the founder’s own demo (#195). This branch fixes the local/offline path; durable private storage + optional AI vendor are still owner decisions. | 2–5 days remaining after this PR | #195; `docs/PHOTO_LIKENESS.md` |
| 4 | **Auth / hosting config for real users** | Fresh production builds throw without `VITE_SUPABASE_*`. Demo mode must never ship publicly. Password reset, email confirm, and support email are unverified. | 3–6 days | `frontend/src/services/supabase.ts`; `docs/ENV_SETUP.md` |
| 5 | **Economy is not server-authoritative** | Demo books are local Zustand. A public economy that can be edited in DevTools is not shippable. | 8–14 days | MVP status gates; entitlements are read-only |
| 6 | **No payment / refund / access lock** | Taking money would be unsafe. Founders pass is designed but not built. | 4–7 days **after** #1 and #5 | `api/entitlements.py`; MVP plan milestone 4 |
| 7 | **Onboarding does not finish a first war in five minutes** | Tutorial exists but is a tour of apps, not “claim → place dealer+shooter → one deal → one defense.” | 3–5 days | `TutorialContent.ts`; release checklist |
| 8 | **Visual / performance bar for outsiders** | Mixed emoji/chrome, large Mapbox chunk, phone combat readability uncertified. Outside testers will compare to UE5 screenshots. | 8–15 days of art+perf, not a rewrite | #45, #77, #78, #79; release checklist |
| 9 | **Ops / legal / store** | No verified error monitoring, backup restore drill, terms/privacy on the live URL, incident runbook, or store listing. 18+ crime fiction needs a qualified legal pass before ads. | 5–8 days + owner/legal | Release checklist; MVP ops gate |
| 10 | **Live PvP / presence** | Players expect to see other crews. Ghost crews are the stand-in; realtime docs are unfinished. | **Defer** (15–30+ days if started now) | #81; socket client only |

**Not blockers if the first launch is an invite web beta:** native iOS/Android, Steam, extra cities, casino, graffiti, crush, Unreal showdown, voice chat, Mapbox-as-combat.

---

## (c) Nice-to-haves to defer post-launch

- Live PvP, presence, chat, alliances
- More cities / photogrammetry / Mapbox as the fight
- Casino, Cocaine Crush, Bip N Dip, graffiti as retention extras (only after they write the same books)
- Full street pose library per custom member (draft PR #169 Phase C)
- Nightfall production art package (#190)
- AI restyle of photo members (optional; local face cards are enough)
- Premium cosmetics / founder merch
- Native mobile wrappers and store review
- Unreal `DealtSlideShowdown`
- Leaderboards against real players
- Push notifications, voice, rewarded ads

---

## (d) Things to cut (or hide) for launch

Cut means **remove from the first-run home screen and marketing**, not delete from git.

| Cut / hide | Why |
|---|---|
| Casino, Crush, Bip N Dip, Vandalize, Clout, Local News, Wanted | Extra apps that dilute the first session and look like unfinished GTA clones. |
| Dual combat entry points | One fight: Strip → canonical encounter. Hide ATTACK/OPS PLAN until #192 is closed. |
| “Multiplayer urban warfare RPG” README / store copy | False vs Hood Warfare 2 buyers. Say “asynchronous street-war strategy with shooter encounters.” |
| Demo mode in production | `VITE_DEMO_MODE=1` is a developer door. |
| Real gang / color names in onboarding (`crip` preset, Yakuza/Triad labels) | Conflicts with the fictional-content contract. Rename presets before public ads. |
| Unreal tree and old prompt packs as “the game” | Confusion for contributors and press. |
| Paid power items | Highest-risk monetization; excluded by MVP scope. |
| Broad drug-catalog expansion | Three base + one risky recipe is enough. |
| Replaying migration 007 / touching production Supabase | Explicitly forbidden until a separate release issue. |

---

## (e) Recommended path to launch

**Launch shape:** invite-only **web** closed beta. One city kit (Las Olas). Ghost crews, not live PvP. Founders access **only after** save works. Do not open Steam/App Store until the web loop retains people.

1. **Lock the single-player war (this is the game).**  
   Finish the ordered stack already in flight: #188 integration, #192 one attack route, #163 one visible ghost hit, #201 truthful drive-by seats. Hide every other combat icon.

2. **Prove a clean account comes back (#175).**  
   Isolated staging only. Age gate → sign up → gang → starter block → deal → defense → reload → second session. No new writer. No production migrate.

3. **Ship photo friends as a real feature (#195, this PR).**  
   Local likeness cards now keep the uploaded face. Owner still chooses an AI vendor and private asset storage. Do not advertise “AI clones your friends” until a key is configured and privately QA’d.

4. **First-run in five minutes.**  
   Replace the app-tour tutorial with: name crew → claim Strip → assign dealer + shooter → one deal → one defense → hospital/bail if needed. Hide Casino/Crush/etc. behind an “More” folder.

5. **Make the desk look like one game.**  
   No new renderer. Finish resolver-backed roles on the Strip, kill remaining emoji on the first-run path, phone + desktop captures. Critic skill (`slide-game-critic`) on real play evidence.

6. **Then** entitlements + checkout, support email, terms/privacy, Sentry, backup drill, legal pass, and a 50–100 person invite.  
   Only then talk about stores or live PvP.

### Suggested public promise (once the above is true)

> SLIDE is an 18+ fictional street-war strategy game. You claim a block, put your friends on the crew, deal, take heat, and fight to hold the Strip. The world keeps playing when you leave.

That is more GTA than Hood Warfare 2 — **if** the empire is saved. If it is not, SLIDE is a folder of demos.

---

## Photo-likeness state (this run)

| | Before | After |
|---|---|---|
| Backend route | `api/avatar.py` existed, **not registered** in `app.py` | Registered. `GET /api/avatar/provider` reports config. |
| No API key | `MockAvatarProvider` returned stock dealer/enforcer/lookout art | Local compositor keeps the uploaded face on portrait / full-body / token cards |
| Backend down | Frontend catch → stock `/assets/runtime/` portraits labeled “stock” | Frontend compositor embeds the photo; labeled “photo-based likeness” |
| Consent | One checkbox | Adult + permission + processing; API rejects without them |
| Source photo | Temp file deleted; roster stored URLs | Unchanged contract, now tested: source deleted, roster gets cards only |
| AI | DALL·E 2 stub if `OPENAI_API_KEY` happened to be set | Still optional. Needs key + `SLIDE_AVATAR_PROVIDER=openai` + `openai` package. Failures fall back to the photo card, not stock. |

Details: `docs/PHOTO_LIKENESS.md`.

---

## Owner decisions still required

1. First launch is **invite web beta**, not Steam/iOS. Confirm.
2. Complete #175 on `dealt-world-proof-staging` (or a new isolated target). Do not use production.
3. Whether to buy an image API for stylized restyles. Not required for likeness.
4. Private bucket for generated cards if you want them to survive server restart for signed-in players.
5. Founders-access price and processor (Stripe etc.) — only after save works.
6. Legal review of 18+ crime fiction + friend-photo consent copy before ads.
7. Rename onboarding presets that look like real gangs.
8. Who integrates the open PR stack (#188 / #192 / #206 / #209 / #169) so file reservations do not collide.

---

## Open work this audit does **not** steal

Do not treat this PR as owning `game.types.ts` visual profiles (draft PR #169), encounter session ownership (#207), Flask session headers (#206), inventory transfer (#209), or Nightfall art (#190). Photo member records still use the existing `portraitUrl` / `fullbodyUrl` / `topdownUrl` fields so #169 can land later.
