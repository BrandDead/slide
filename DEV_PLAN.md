# DEALT/SLIDE — Development Plan

## Current State Summary

The codebase has a **React/Vite/TypeScript frontend** with Zustand state management and a **Flask/Python backend** with Supabase as the database. The iOS-style OSShell desktop launcher is functional, and four core mini-games (SLIDE combat, Drive-By, Cook Lab, Territory Map) have working UIs. The backend has API blueprints for blocks, combat, driveby, inventory, and world — but the frontend is **not connected** to the backend. Everything runs on local Zustand stores with hardcoded data.

## Open Issues (9 total)

| # | Title | Priority | Labels | Status |
|---|-------|----------|--------|--------|
| 5 | Mapbox Integration: Geocoding, Block Claiming, Grid Generation | HIGH | frontend, mvp | Open |
| 6 | Frontend Refactor: Connect React Components to Backend API | HIGH | frontend, mvp | Open |
| 7 | NPC Simulation: AI Gang Behaviours and Schedule Attacks | MEDIUM | backend, mvp | Open |
| 8 | World Tick Scheduler: Background Worker for Passive Simulation | HIGH | infrastructure, mvp | Open |
| 9 | JWT Authentication: Replace Placeholder Auth with Supabase JWT | HIGH | backend, mvp | Open |
| 10 | Testing: Unit and Integration Tests for Backend API | MEDIUM | backend, testing | Open |
| 11 | Documentation: Update README and Architecture Diagrams | MEDIUM | documentation | Open |
| 12 | Rich Grid Features: Integrate PR #2 Tile Configs into BlockStateEngine | MEDIUM | backend | Open |
| 13 | Alchemy Lab: Drug Crafting System (Little Alchemy Style) | MEDIUM | frontend, backend, mvp | Partially done (UI built, backend needed) |

## Prioritized Execution Order

### Sprint 1: Placeholder Apps → Playable (Frontend-Only, No Backend Required)

These can be built immediately since they only need Zustand stores and existing utility engines.

| Task | Issue | Description |
|------|-------|-------------|
| **1A. Shoebox (Banking)** | — | Build the Shoebox banking app: deposit/withdraw cash, view transaction history, earn interest. Uses `useEconomyStore` and `usePlayerStore`. |
| **1B. Market (Underworld Shop)** | — | Build the Market app: browse weapons/armor/vehicles/consumables from `item_catalog`, purchase with cash, view inventory. Uses `useEconomyStore`. |
| **1C. Missions/Ops** | — | Build the Missions app: list of procedurally generated missions (deal X drugs, kill Y opps, defend block for Z minutes). Rewards money/XP/rep. |
| **1D. Settings** | — | Build Settings page: gang name/color editor, sound/notification toggles, reset game, view stats. |
| **1E. Casino** | — | Build Casino with 2-3 mini-games: Dice (Craps), Card game (Hi-Lo), Slot machine. Bet cash, win/lose. |

### Sprint 2: Core Game Systems (Frontend Logic Engines)

These wire the existing utility engines into the UI components so game mechanics actually function.

| Task | Issue | Description |
|------|-------|-------------|
| **2A. Heat System Integration** | #6 partial | Wire `heatSystem.ts` into all game actions: dealing raises heat, combat raises heat, heat decays over time, high heat triggers raids. Visual heat meter on OSShell. |
| **2B. Morale System Integration** | #6 partial | Wire `moraleSystem.ts`: not bailing members drops morale, low morale causes members to not show up or friendly fire. Visual morale indicators on Contacts. |
| **2C. Member Progression** | #6 partial | Wire `memberProgression.ts`: members gain XP from missions, level up shooting/dealing stats, high-level members are more effective but generate more heat. |
| **2D. Income Engine** | #6 partial | Wire `incomeEngine.ts`: passive income from blocks based on dealer placement, drug quality, traffic score. Auto-collect or manual collect from Territory Map. |
| **2E. Alchemy → Dealer Pipeline** | #13 | Connect Cook Lab output to dealer inventory: crafted drugs appear in economy store, can be equipped to dealers via Contacts, affects deal prices in DEALT mode. |

### Sprint 3: Backend Connection (Requires Supabase Setup)

| Task | Issue | Description |
|------|-------|-------------|
| **3A. API Service Update** | #6 | Update `api.service.ts` endpoints to match Flask backend routes. Add error handling, loading states, retry logic. |
| **3B. Auth Flow** | #9 | Implement Supabase JWT auth: login/register page, token storage, `require_auth` decorator validation, protected routes. |
| **3C. Block Claiming API** | #5, #6 | Connect TerritoryMap to `POST /api/blocks/claim`, render server-generated grids, sync member placement. |
| **3D. Combat API** | #6 | Connect SlideGame to `POST /api/combat/start` + `/turn`, sync combat results with server. |
| **3E. World Tick** | #8 | Implement APScheduler background worker calling `/api/world/tick` every 10 minutes. |

### Sprint 4: Advanced Features

| Task | Issue | Description |
|------|-------|-------------|
| **4A. Mapbox Integration** | #5 | Replace placeholder map with Mapbox GL JS, address search, real geocoding, territory visualization. |
| **4B. NPC AI** | #7 | Implement NPC gang behaviors: patrol, expand, retaliate, raid. NPCs use same combat engine as players. |
| **4C. Rich Grid Features** | #12 | Integrate tile feature configs (dumpsters, parked cars, mailboxes) into grid generation with cover/visibility bonuses. |
| **4D. Testing** | #10 | Write pytest unit/integration tests for all backend endpoints and game engines. |
| **4E. Documentation** | #11 | Update README, add architecture diagrams, API docs. |

## Execution Plan (This Session)

I will execute **Sprint 1** (all 5 placeholder apps) and **Sprint 2** (all 5 system integrations) since they are frontend-only and can be built and tested immediately without any backend or Supabase setup.
