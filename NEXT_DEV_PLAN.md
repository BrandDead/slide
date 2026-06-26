# SLIDE / DEALT — Next Development Plan
**Prepared by:** Manus AI  
**Date:** June 26, 2026  
**Status:** Post-Mega Merge & Missing Features Implementation  

## 1. Current State of the Game
The repository has undergone a massive cleanup and integration pass. All 10 open pull requests (including the `sprint/sfx-fps-ollama-assets` chain, the GTA visual overhaul, and the V2 architecture migrations) have been successfully merged into `main-tL2525`. 

Additionally, we implemented several critical missing pieces that were previously stubs or disconnected:
- **Gang HQ (CREW):** Fully implemented with active/jailed/fallen tabs, member grid, and quick recruit functionality.
- **Sound System Wiring:** The `SoundManager` (Web Audio API) is now fully wired across all game events: DriveBy gunshot SFX, SlideGame combat SFX, DealtMode swipe accepts/rejects, AlchemyLab cook success, Market purchases, Shoebox banking, and Contacts bail payments. It is also tied to the Settings toggle.
- **UI & Routing:** `Cocaine Crush` has its own app icon on the OS Shell, the `DEALT` icon now opens the V2 mode selector (Classic/Symptoms/Speed), and the game loop correctly triggers `blockStore.tickIncome()` to keep passive income in sync.

### Is it fun for a shooter/Scarface fan?
Yes. The integration of the **GTA-style dark cinematic visual overhaul** combined with the **ImpactEngine** (blood splatters, glass breaking, screen shake) and **SoundManager** (procedural gunshots, ambient street noise) gives the game a gritty, visceral feel. The `DriveByEngine` and `TopDownShooter` modes provide the fast-paced action expected by shooter fans, while the `DealtMode` and `Shoebox` banking hit the strategic "Scarface" empire-building notes. The graphics are significantly better following the integration of the AI-generated Batch 1-4 assets (replacing the old emoji placeholders).

---

## 2. The Next Dev Plan: What's Left?

There are exactly 6 open issues remaining in the repository. These represent the final roadmap to a Beta release.

### Phase 4: Territory & Ops
**1. Territory Map & Block Claiming (Issue #40)**
- **Current State:** Mapbox GL JS is integrated, and the `BlockModeView` works locally.
- **To Do:** Connect the `useBlockClaim` hook to the Supabase backend to allow players to permanently claim real-world addresses. Implement the UI for the `ClaimBlockModal`.

**2. Ops Layer (Issue #41)**
- **Current State:** The `Missions` app generates procedural tasks (hits, deliveries), but they don't fully interact with the map.
- **To Do:** Build the attack planner UI. Allow players to assign specific roles (Lookout/Scout, Enforcer) to blocks to gain intel before launching a `TopDownShooter` attack.

### Phase 5: Economy & Crew Polish
**3. Crew & Phone Upgrades (Issue #42)**
- **Current State:** `GangManagement` and `ContactProfile` are built. The `Phone` app is still a stub.
- **To Do:** Implement the `Phone` app to allow players to call contacts for favors (e.g., bribing police to lower heat, calling a cleaner). Add the ability to purchase permanent upgrades (safehouses, better labs).

**4. Heat, Passive Income, & World Tick (Issue #43)**
- **Current State:** `gameLoopEngine.ts` handles ticks, heat decay, and passive income locally.
- **To Do:** Move the authoritative world tick to the Supabase backend (via Edge Functions or pg_cron) to prevent client-side manipulation. Ensure offline passive income is calculated correctly when the player logs back in.

### Phase 6: AI & Beta Polish
**5. AI Gangs / NPC Opposition (Issue #44)**
- **Current State:** `npc_ai.py` exists in the backend but isn't actively spawning dynamic threats on the map.
- **To Do:** Wire the backend AI service to populate unclaimed blocks with NPC gangs (e.g., "The Scorpions"). Allow these NPCs to launch retaliatory drive-bys against the player if their aggression gets too high.

**6. Beta Gate & QA (Issue #45)**
- **Current State:** The game is feature-rich but needs a final optimization pass.
- **To Do:** 
  - Conduct a full QA pass on mobile devices (ensure touch targets and swipe navigation feel native).
  - Optimize the `ImpactEngine` and `CanvasStreetRenderer` to maintain 60 FPS on mid-tier phones.
  - Finalize the audio mix (balancing ambient loops vs. SFX).

---

## 3. Recommended Next Steps for the Developer
1. **Database Migration:** Run the Supabase migrations (`001_initial_schema.sql`, `002_block_placements.sql`, `003_leaderboard_rpc.sql`) on your live project to ensure the newly merged frontend hooks (`useBlockSync`, `Leaderboard`) have the correct tables to talk to.
2. **Mapbox Key:** Ensure your `VITE_MAPBOX_TOKEN` is set in the `.env` file so the `TerritoryMap` renders correctly.
3. **Tackle Issue #40:** Start by making block claiming fully persistent. Once players can own real estate, the rest of the empire-building loop falls into place.
