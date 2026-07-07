# AGENTS.md

## Cursor Cloud specific instructions

This repo is **DEALT / SLIDE**, an iOS-style urban-warfare game with two services:

| Service  | Path              | Dev command                                   | Port |
| -------- | ----------------- | --------------------------------------------- | ---- |
| Frontend | `frontend/`       | `npm run dev`                                 | 3000 |
| Backend  | `backend/python/` | `./venv/bin/python app.py`                    | 5000 |

Standard scripts live in `frontend/package.json` (`dev`, `build`, `preview`, `lint`, `typecheck`) and `README_RUN.md`. Python deps install into `backend/python/venv` (created by the update script); always invoke the venv directly, e.g. `./venv/bin/python`, `./venv/bin/python -m pytest`.

### Backend runs fully offline (dev mode)
The Flask backend falls back to an **in-memory mock store** and **bypasses auth** (`DEV_USER`) whenever Supabase is not configured. Keep `SUPABASE_URL` (and `DATABASE_URL`) **blank** in `backend/python/.env` — setting an invalid/placeholder Supabase URL makes real client calls that return 500s and break `pytest`. With them blank, `./venv/bin/python -m pytest` passes and every `/api/*` endpoint works without a token.

### GOTCHA 1 — `npm run dev` renders a blank page (mapbox-gl)
`vite.config.ts` has `optimizeDeps.exclude: ['mapbox-gl']`, while `components/map/MapboxMap.tsx` and `BlockOverlay.tsx` use a default `import mapboxgl from 'mapbox-gl'`. In dev, Vite serves mapbox-gl's UMD build un-bundled and the default-export interop fails (console: *"does not provide an export named 'default'"*), which blanks the whole app because `TerritoryMap` is eagerly imported by `App.tsx`. The **production build works** (rollup handles the UMD), so to exercise the full UI use:

```
cd frontend && npm run build && npm run preview -- --port 3000 --host 0.0.0.0
```

(A source fix would be to move `mapbox-gl` into `optimizeDeps.include`, but that is a code change.)

### GOTCHA 2 — the UI is gated behind Supabase auth
`App.tsx` shows the app only after a valid Supabase session (`AuthScreen` → onboarding → game). To run the UI locally there are two options:

- **Local Supabase stack (used here).** Docker + the `supabase` CLI are installed. Bring it up with:
  ```
  sudo dockerd &                       # if the daemon is not already running
  sudo chmod 666 /var/run/docker.sock  # allow the ubuntu user to talk to docker
  cd ~/supabase-local && supabase start -x studio,imgproxy,storage-api,realtime,edge-runtime,logflare,vector,supavisor,mailpit
  supabase status                      # prints ANON_KEY / API_URL
  ```
  Then set in `frontend/.env`: `VITE_SUPABASE_URL=http://127.0.0.1:54321` and `VITE_SUPABASE_ANON_KEY=<ANON_KEY>`. Email confirmations are disabled locally, so sign-up auto-confirms and you can immediately sign in.
- **Real project.** Provide real `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` values.

`VITE_*` vars are baked in at build/preview time — after changing `frontend/.env`, restart the dev server (or rebuild before `preview`).

### Notes
- `npm run lint` currently reports 2 pre-existing errors (`no-var-requires`) + ~172 warnings; `npm run typecheck` is clean. These are not environment issues.
- `.env` files and `venv/` are git-ignored; they persist in the VM snapshot but are not committed.
