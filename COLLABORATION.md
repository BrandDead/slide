# Collaboration handoff (for Manus and other agents)

Read this after `AGENTS.md`, `docs/AI_CONTRIBUTOR_START_HERE.md`, and
`docs/PROJECT_LOG.md`. This file is the current-state map so another agent
can take work **without colliding PR #210**.

**Default branch:** `main-tL2525`  
**This branch / PR:** `cursor/launch-readiness-likeness-e7d0` → draft **#210**  
**Do not merge PRs, apply production migrations, or rotate secrets.**

---

## Current product state

SLIDE / DEALT is an 18+ fictional urban strategy game presented as an
iOS-style command desktop. The unique hook is a **saved block + friends
on the crew**. It is **not** a public multiplayer FPS.

| Surface | State |
|---|---|
| Demo path | `VITE_DEMO_MODE=1` bypasses Supabase and seeds Las Olas |
| Strip / Block DNA | Playable. 40 fictional cards. Street map is optional context |
| Save / return session | Code exists. **#175 proof is still the P0 launch blocker** |
| Ghost crews | NPC pressure exists. Live PvP does not |
| Photo recruit | Consent + photo crop shipped on #210. GPT Image wired, **key not set** |
| Combat | Several web toys (DRIVE, SLIDE, UnifiedEncounter). Not HW2-class |

Honest design take: GTA-quality characters **and** Hood Warfare 2 gunplay
will keep fighting this React/Flask/canvas stack. Recommendation is in
`LAUNCH_READINESS.md` — illustrated GTA presentation for the web beta;
UE5 one-fight only if shooting is the public promise.

---

## Art direction (locked)

- **World:** cinematic 2.5D tactical diorama. See `.agents/skills/slide-visual-art-direction`.
- **Crew likeness:** Locked GTA V loading-screen / box-cover illustration
  (owner-approved over cartoon). Shared STYLE + SHOT + IDENTITY + SAFETY
  in `backend/python/config/slide_art_style.py` and `docs/STYLE_PROMPT.md`.
- **Forbidden in player-facing views:** South Park, clip-art, vector
  characters, stick-figure bodies, stock role art presented as a friend’s face.
- **Vendor:** `gpt-image-2.5-flare` via `images.edit` at `1024x1536` /
  `medium`, falling back to `gpt-image-2`. Enable with `OPENAI_API_KEY`.
  Steps: `docs/PHOTO_LIKENESS.md`.
- **No key:** real photo crop on the roster; body labeled locked.
- Fictional content only. Personal-crew photos need adult + permission +
  processing consent. Never persist the source photo on the roster.
  Never commit founder/real-person photos or generated likenesses.

---

## How to run

Backend is offline-friendly. Keep `SUPABASE_URL` and `DATABASE_URL`
**blank** in `backend/python/.env` or pytest and `/api/*` break.

```bash
# Backend
cd backend/python
./venv/bin/python app.py          # :5000

# Frontend (deterministic demo)
cd frontend
VITE_DEMO_MODE=1 npm run dev -- --host 0.0.0.0   # :3000
```

Optional local Supabase (auth UI, not required for demo):

```bash
sudo dockerd &
sudo chmod 666 /var/run/docker.sock
cd ~/supabase-local && supabase start -x studio,imgproxy,storage-api,realtime,edge-runtime,logflare,vector,supavisor,mailpit
```

Then set `VITE_SUPABASE_URL=http://127.0.0.1:54321` and the printed
`ANON_KEY` in `frontend/.env`. Restart Vite after any `VITE_*` change.

GPT Image (owner will provide the key; not set now):

```bash
# backend/python/.env
OPENAI_API_KEY=sk-...
# optional: SLIDE_AVATAR_MODEL=gpt-image-2
./venv/bin/pip install 'openai>=1.40.0'
# restart Flask
```

---

## How to test

Always run the focused test for the files you touched, then the matching
suite. Skills: `$slide-release-safety` for gameplay/code;
`$slide-visual-art-direction` then `$slide-asset-integration-qa` for art.

```bash
# Backend
cd backend/python
./venv/bin/python -m pytest tests/test_avatar_likeness.py -q
./venv/bin/python -m pytest -q

# Frontend
cd frontend
./node_modules/.bin/vitest run src/services/__tests__/likenessCompositor.test.ts \
  src/services/__tests__/avatarGeneration.service.test.ts \
  src/components/gang/__tests__/PhotoMemberCreator.test.tsx
npm run typecheck
# Prefer the local binary if `npx vitest` hits npm store errors.
```

`npm run lint` has known pre-existing `no-var-requires` errors; do not
“fix” unrelated lint as part of a gameplay PR.

Player-path check: 390×844 and 1440×900, happy path + one failure.
MapLibre failing must leave Strip / recon / claims / crew placement usable.

---

## Open work that matters

| ID | State | What | Safe for Manus? |
|---|---|---|---|
| **#175** | OPEN | Authenticated saved-game proof on isolated staging. P0 launch blocker. | Yes — highest-value. Do not replay migration 007, do not touch production, do not add a second writer. |
| **#192** | OPEN | Desktop ATTACK / OPS Planner bypass the canonical encounter. PR #204 is already on this. | Only if #204 is abandoned or you take review findings. Do not open a parallel ATTACK PR. |
| **#201** | OPEN | DRIVE shots/rewards must bind to passenger shooters. PR #202 is already on this. | Same rule: do not fork a second DRIVE attribution PR. |
| **#163** | CLOSED | One Ghost Crew attack on the Strip. Follow-up is still “make it visible and playable” via UnifiedEncounter; do not recreate a second combat authority. | Yes, as a **new** focused issue/PR if the live Strip still cannot show one ghost hit. Check main first. |
| **#210** | OPEN (this PR) | Launch-readiness docs + GPT Image likeness + no vector bodies. | **No. Do not edit these files.** |

Related open PRs to avoid colliding: **#169** (`visualProfile` / `game.types.ts`),
**#206** (Flask session headers), **#207** (encounter session owner),
**#209** (inventory transfer), **#205** (Nightfall tactical art).

---

## Files reserved by PR #210 — do not edit

Stay off this list until #210 merges or the integration owner reassigns it:

- `backend/python/api/avatar.py`
- `backend/python/services/likeness.py`
- `backend/python/config/slide_art_style.py`
- `backend/python/tests/test_avatar_likeness.py`
- `backend/python/.env.example` (likeness block only)
- `docs/STYLE_PROMPT.md`
- `frontend/src/types/avatar.types.ts`
- `frontend/src/services/avatarGeneration.service.ts`
- `frontend/src/services/likenessCompositor.ts`
- `frontend/src/services/__tests__/avatarGeneration.service.test.ts`
- `frontend/src/services/__tests__/likenessCompositor.test.ts`
- `frontend/src/components/gang/PhotoMemberCreator.tsx`
- `frontend/src/components/gang/PhotoMemberCreator.css`
- `frontend/src/components/gang/__tests__/PhotoMemberCreator.test.tsx`
- `frontend/.env.example` (likeness comment only)
- `LAUNCH_READINESS.md`
- `docs/PHOTO_LIKENESS.md`
- `COLLABORATION.md` (this file — extend it after merge, do not rewrite mid-PR)
- `docs/PROJECT_LOG.md` — **append only**; do not rewrite the 2026-10-17 likeness entries

`frontend/src/components/contacts/Contacts.tsx` has a one-line
`portraitUrl` fallback from this work. Prefer not to touch avatar URL
resolution there until #210 merges. **Do not edit** `game.types.ts`
(PR #169 owns `visualProfile`).

---

## Safe areas to take without conflicting #210

Good first picks, each as its own branch off latest `origin/main-tL2525`:

1. **#175 saved-game proof** — staging-only runbook, two-user isolation,
   returning-player loop. Highest launch value.
2. **First-run five-minute loop** — hide Casino / Crush / extra apps behind
   More; teach claim → place → deal → one defense. Avoid photo-creator files.
3. **Fictional onboarding presets** — rename `crip` / Yakuza / Triad-style
   labels. `LAUNCH_READINESS.md` lists this cut; keep it a tiny PR.
4. **#163 follow-up** — one visible ghost hit on the Strip through the
   existing UnifiedEncounter, if main still lacks it. Reserve renderer/store
   files on the issue first.
5. **Private generated-asset storage design** (design-only PR) — #210 still
   uses in-memory jobs + data URLs. Do not implement a bucket on this branch.

Branch naming for Cursor agents: `cursor/<descriptive-name>-e7d0`.
Everyone else: `feature/<issue>-short-name`. One focused PR. Do not merge.

---

## Skills and contracts

| Skill | When |
|---|---|
| `$slide-release-safety` | Any gameplay or shared-behavior change |
| `$slide-visual-art-direction` | Any image generation |
| `$slide-asset-integration-qa` | Any asset that ships in the game |
| `$slide-game-critic` | After a real player-path capture |

Non-negotiables: one authoritative state path; Block DNA `dnaId` is
stable; map failure must not block the Strip; no production Supabase
work unless the task names a confirmed non-production target.
