# DEALT/SLIDE: Current Repo Status Report
**Date:** July 8, 2026
**Branch:** `main-tL2525`
**Repo:** `BrandDead/slide`
**Live URL:** `https://slide-sable-rho.vercel.app`

---

## For Other AI Models: What You Need to Know

This is a mobile-first urban warfare RPG built with **React + Vite + TypeScript + TailwindCSS + Supabase + Mapbox GL**. The game is live on Vercel and the backend is running on Supabase with 9 deployed Edge Functions and pg_cron jobs.

### Tech Stack
- **Frontend:** React 18, Vite 5, TypeScript, Zustand (state), Framer Motion (animations), Mapbox GL JS (maps)
- **Backend:** Supabase (PostgreSQL, Auth, Edge Functions, Realtime), Python Flask (NPC AI)
- **Deployment:** Vercel (frontend), Supabase (backend)
- **CI:** GitHub Actions (lint + build + pytest)

### Current Build Status
- `npm run typecheck`: **PASS** (0 errors)
- `npm run lint`: **PASS** (0 errors, 173 warnings)
- `npm run build`: **PASS** (~42 seconds)
- `pytest` (backend): **PASS** (35/35)

### Open PRs (awaiting CI re-run after lint fix)
- **PR #71:** `feat/role-mechanics` — Complete role/weapon/vehicle/progression system + rebuilt SLIDE battleship game
- **PR #72:** `docs/gameplay-bible` — Game Design Bible (Parts 1 & 2) + Gameplay Explanation + Concept Art

### What's Been Built (Complete)
1. iOS-style desktop shell (OSShell) with app icons
2. Territory Map with Mapbox GL (real-world address claiming)
3. 8x8 tactical block grid (TopDownBlock + BlockModeView)
4. DEALT drug-dealing mini-game (Tinder-style swipe)
5. SLIDE drive-by battleship (rebuilt with spin-the-block, shot-spotter, reinforcements)
6. Drive-By FPS (canvas + parallax, from car perspective)
7. Top-Down Shooter (Clash-of-Clans-style block assault)
8. Alchemy Lab (drug crafting: combine ingredients → drugs)
9. Contacts / Gang Roster (member management, equip, deploy)
10. Heat System + Police Raids (heat accumulates, raids trigger at threshold)
11. Morale System (salary, bail, hospital, consequences)
12. Income Engine (position-based multipliers, OD events, drug quality)
13. Enforcer Patrol Engine (small income + heat reduction per tick)
14. Recruit Recon Engine (steal cars, scout blocks, vandalize, spot surveillance)
15. Role-Based Inventory Restrictions (dealers=drugs, shooters=weapons, enforcers=melee)
16. Weapon System (16 weapons, 10 accessories, shooter tiers: Novice→Gunsmith)
17. Vehicle Engine (5 vehicle types, seat rules, driver can't shoot, on-foot transition)
18. Member Progression (XP, leveling, role upgrades: Recruit→Enforcer/Shooter/Dealer→Chemist)
19. Gifting System (clothing, jewelry → morale + XP boosts)
20. Chemist Drug Synthesis (6 recipes: Crack, Meth, MDMA, Fentanyl, Heroin, Blue Sky)
21. Salary System (role-based wages, Shoebox routing, selective payroll)
22. Shoebox Banking (dirty→clean cash laundering at 20% fee)
23. World Tick (passive income every 5 min via Supabase Edge Function + pg_cron)
24. NPC Gang Spawner (seeds AI gangs on unclaimed blocks daily)
25. NPC Retaliation Engine (counter-attacks when player hits NPC blocks)
26. Auth Screen (Supabase email/password)
27. Phone App (call contacts for services)
28. Attack Planner (assign roles before TopDown attacks)

### What's NOT Built Yet (Next Sprint)
1. **PixiJS rendering engine** (replace CSS grids with WebGL)
2. **Matter.js physics** (bullet ballistics, vehicle damage, ragdoll)
3. **AI-generated assets** (GTA-style sprites, tiles, portraits via Nano Banana/Scenario)
4. **First-person drive-by** (inside-the-car FPS with window roll-down mechanic)
5. **Enforcer robbery mechanics** (walk block, target dealers, steal loot)
6. **Graffiti/vandalism system** (custom messages, persistence, cleanup)
7. **Trap House system** (indoor dealing, upgrades, hidden compartments)
8. **Block Alarm system** (tripwire, motion sensor, police scanner)
9. **Convoy/product transport** (supply chain logistics mini-game)
10. **Jewelry/Trophy Wall** (status items, stolen loot display)
11. **Grudge History/Revenge Window** (rivalry tracking, counterattack bonuses)
12. **Block Morale** (separate from member morale, affects dealing speed)
13. **Onboarding/Tutorial** (guided first-time player experience)
14. **Multiplayer PvP** (real-time attacks between players via Supabase Realtime)

### Key Files to Know
- `frontend/src/config/roleMechanics.ts` — Source of truth for ALL role rules
- `frontend/src/config/wages.ts` — Role-based weekly salary tiers
- `frontend/src/utils/incomeEngine.ts` — Passive income calculation
- `frontend/src/utils/slideGameEngine.ts` — SLIDE battleship game logic
- `frontend/src/utils/weaponSystem.ts` — All weapons + accessories + combat math
- `frontend/src/utils/vehicleEngine.ts` — Vehicle seats, damage, escape
- `frontend/src/utils/memberProgression.ts` — XP, leveling, upgrades, gifting
- `frontend/src/stores/gameStore.ts` — Central Zustand store (player, gang, economy)
- `frontend/src/stores/blockStore.ts` — Block state (placements, income, drive-bys)
- `docs/GAME_DESIGN_BIBLE_PART1.md` — Authoritative game design spec (Part 1)
- `docs/GAME_DESIGN_BIBLE_PART2.md` — Authoritative game design spec (Part 2)
