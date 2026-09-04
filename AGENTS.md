# AGENTS.md

> **Start here:** Read `docs/AI_CONTRIBUTOR_START_HERE.md`, then `docs/PROJECT_LOG.md`.
> The first file gives the current multi-model workflow, safety boundaries, test gates,
> and active queue. The project log is the append-only record of decisions, direction,
> roadmap order, and rollback anchors. Append a dated log entry when meaningful work lands.

## Cursor Cloud specific instructions

This repo is **DEALT / SLIDE**, an iOS-style urban-warfare game with two services:

| Service  | Path              | Dev command                                   | Port |
| -------- | ----------------- | --------------------------------------------- | ---- |
| Frontend | `frontend/`       | `npm run dev`                                 | 3000 |
| Backend  | `backend/python/` | `./venv/bin/python app.py`                    | 5000 |

Standard scripts live in `frontend/package.json` (`dev`, `build`, `preview`, `lint`, `typecheck`) and `README_RUN.md`. Python deps install into `backend/python/venv` (created by the update script); always invoke the venv directly, e.g. `./venv/bin/python`, `./venv/bin/python -m pytest`.

### Backend runs fully offline (dev mode)
The Flask backend falls back to an **in-memory mock store** and **bypasses auth** (`DEV_USER`) whenever Supabase is not configured. Keep `SUPABASE_URL` (and `DATABASE_URL`) **blank** in `backend/python/.env` — setting an invalid/placeholder Supabase URL makes real client calls that return 500s and break `pytest`. With them blank, `./venv/bin/python -m pytest` passes and every `/api/*` endpoint works without a token.

### GOTCHA 1 — MapLibre street context is optional

The current territory shell uses `components/map/PlayableMap.tsx`. Street/building imagery is optional context, not a gameplay prerequisite: its loading, timeout, and connection failures must retain the Strip board, recon, claims, crew placement, and other strategy controls. Do not replace this recovery behavior with a blocking map error.

For a deterministic local player path, use the build-time flag:

```
cd frontend && VITE_DEMO_MODE=1 npm run dev -- --host 0.0.0.0
```

`VITE_*` values are compiled into the client. Restart the dev server after changing them. Use `npm run build` followed by `npm run preview` when validating production-bundle behavior.

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
