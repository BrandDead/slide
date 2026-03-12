# DEALT/SLIDE - MVP Pull Request Plan

## Execution Order

All PRs target `main-tL2525`. Each wave builds on the previous.

| Wave | Branch | PR Title | Issues | Phase |
|------|--------|----------|--------|-------|
| 1 | `feat/mvp-foundation-auth-schema` | `feat(mvp): foundation, auth, db schema, docker, ci` | #36, #37 | Phase 1 |
| 2 | `feat/os-shell-navigation-stores` | `feat(shell): ios command center, routing, hud, shared stores` | #37 | Phase 1 |
| 3 | `feat/dealt-economy-loop` | `feat(dealt): playable dealer loop connected to money, product, and heat` | #38 | Phase 2 |
| 4 | `feat/slide-core-combat` | `feat(slide): battleship combat, unit health, counterattack, combat logs` | #39 | Phase 3 |
| 5 | `feat/territory-map-ops-layer` | `feat(map-ops): block claim, placement, map actions, lookout ops` | #40, #41 | Phase 4 |
| 6 | `feat/beta-crew-heat-npc-qa` | `feat(beta): crew stackapp heat npc gangs qa and art pass` | #42, #43, #44, #45 | Phase 5-6 |

## Branch Naming Convention

All branches use the `feat/` prefix and descriptive kebab-case names:

- `feat/mvp-foundation-auth-schema`
- `feat/os-shell-navigation-stores`
- `feat/dealt-economy-loop`
- `feat/slide-core-combat`
- `feat/territory-map-ops-layer`
- `feat/beta-crew-heat-npc-qa`

## PR Workflow

1. Branch from `main-tL2525`
2. Implement in small, clean commits
3. Ensure CI passes (lint + build + tests)
4. Open PR with summary, screenshots, and referenced issues
5. Squash and merge after review

## Architecture Decisions

- **Frontend**: React + Vite + TypeScript + TailwindCSS + Zustand + Framer Motion
- **Backend**: Flask + PostgreSQL + SQLAlchemy + Flask-SocketIO
- **Auth**: JWT-based with Supabase integration (fallback to local JWT for dev)
- **Maps**: Mapbox GL JS with geocoder
- **State**: Zustand with persistence middleware
- **CI**: GitHub Actions (lint, build, pytest)
- **Deployment**: Vercel (frontend) + Railway/Render (backend)
