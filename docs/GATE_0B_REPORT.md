# SLIDE Gate Report — Phase 0A Baseline + Gate 0B

**Branch:** `feat/mvp-vertical-slice`  
**Base:** `origin/agent/mvp-readiness-2026-07-16` @ `3557d2a`  
**Tag:** `phase-0a-baseline`  
**Date:** 2026-07-17  
**Mode:** Local Agent only

---

## Phase 0A — Baseline health

| Check | Command | Result |
|-------|---------|--------|
| Checkout | `git checkout -B feat/mvp-vertical-slice origin/agent/mvp-readiness-2026-07-16` | Pass — tip `3557d2a` |
| Frontend install | `npm ci` | Pass |
| Frontend tests | `npx vitest run` / `npm test` | **25 passed** (was 22; +3 contract tests) |
| Typecheck | `npm run typecheck` | Pass |
| Production build | `npm run build` | Pass |
| Backend deps | `pip install -r requirements.txt` | Pass after Pillow pin (`>=11,<12` for Python 3.9) |
| Backend tests | `./venv/bin/python -m pytest` | **42 passed** (was 37 after auth fix; +3 contracts +2 vertical-slice) |

### Baseline blockers fixed before Gate 0B

1. **Python 3.9 `dict | None`** in `middleware/auth.py` prevented all blueprints from registering (404s). Fixed with `from __future__ import annotations` + `Optional[dict]`.
2. **Pillow==12.1.1** unavailable on Python 3.9 — relaxed to `Pillow>=11.0.0,<12`.

---

## Gate 0B — Claim-to-save vertical slice

### Definition of done

> Sign in → claim → deploy → earn → refresh → same state

**Proven by:** `backend/python/tests/test_gate_0b_vertical_slice.py`  
Flow: claim ($5000) → place dealer → tick income → collect → `GET /my-blocks` + `GET /player/state` retain placements and cash.

### What changed

| Area | Change |
|------|--------|
| **One claim cost** | `CLAIM_BLOCK_COST = 5000` in `frontend/src/config/gameEconomy.ts` + `backend/python/config/game_constants.py` |
| **Flask authority** | Rewrote `api/blocks.py` claim/my-blocks/get/nearby/city onto `DBAdapter` (no SQLAlchemy) |
| **Economy** | `DBAdapter.get_player_state / apply_economy_delta / deduct_cash`; `GET /api/player/state` |
| **Placement** | `POST /api/blocks/<id>/members/place` |
| **Earn** | `POST .../tick-income`, `POST .../collect` |
| **Contracts** | `BlockSceneManifest`, `LiveBlockState`, `AttackSnapshot` (TS + Python) + unit tests |
| **Frontend** | TerritoryMap claims via `blocksApi`; blockStore syncs placements; BlockModeView collect hits API; `useEmpireHydration` reloads player+blocks |

### Evidence commands

```bash
cd backend/python && ./venv/bin/python -m pytest -q
# 42 passed

cd frontend && npm test && npm run typecheck && npm run build
# 25 passed, typecheck clean, build OK
```

### Manual smoke (local)

1. Start backend mock: `cd backend/python && ./venv/bin/python app.py` (blank `SUPABASE_URL`)
2. Frontend: `npm run build && npm run preview -- --port 3000` (Mapbox gotcha)
3. Age gate → auth → MAP hood → claim eligible Miami sample → deploy dealer → collect after tick → refresh → cash/placements persist via hydration

### Risks / rollback

- Mock DBAdapter placements are in-memory — Flask restart clears them (expected in blank-Supabase mode).
- Supabase live path for `block_placements` columns may need a follow-up migration if table schema differs from adapter payload.
- Rollback: `git reset --hard phase-0a-baseline` on this feature branch (unpushed) or revert commits.

### Explicitly not started

- Gate 1 Phaser / NPC fixture
- Overture ingest / AI plates
- Production payments / webhooks

---

## Next gate

**Gate 1** — Unified Phaser combat pilot + fixed NPC defender fixture; keep `CanvasStreetRendererV3` until parity.
