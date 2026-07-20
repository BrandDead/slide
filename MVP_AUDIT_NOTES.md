# SLIDE MVP Audit — Working Findings

**Audit date:** 2026-07-16  
**Branch:** `agent/mvp-readiness-2026-07-16`

## Verified repository state

The default branch is `main-tL2525`. The project is a React 18/TypeScript/Vite frontend with a Flask backend and Supabase/PostgreSQL data model. The frontend contains an iOS-style shell plus routed DEALT, CREW, MAP, SLIDE, DRIVE, TOPDOWN, COOK, SHOEBOX, MARKET, OPS, CASINO, GRAFFITI, COCAINE CRUSH, leaderboard, news, phone, and planner screens.

A clean dependency install completed. `npm run typecheck` passed and `npm run build` passed. The production build reports circular manual chunks and a Mapbox vendor bundle of roughly 1.66 MB minified (roughly 447 KB gzip), so performance is acceptable for internal testing but still needs launch optimization.

The backend test suite passes in documented offline mode with blank Supabase configuration: **35 tests passed**. It emits 93 deprecation warnings, mostly from naive `datetime.utcnow()` usage.

## Verified launch blockers

A fresh production build cannot enter gameplay without valid `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. `frontend/src/services/supabase.ts` throws at module load if either is absent. With syntactically valid placeholders, the app reaches a polished sign-in/sign-up screen, but cannot authenticate against a real project. The root app explicitly gates the entire game behind a Supabase session and then onboarding.

Game state remains split between a rich local Zustand simulation and partially implemented Supabase/backend services. Documentation claiming a playable MVP is therefore stronger than the current end-to-end reality: individual modes exist and compile, but a new paying player cannot reliably sign up, create a gang, claim a real block, preserve progression, return later, and continue the same state from a deployed production environment.

No operational Stripe checkout, entitlement, subscription, webhook, or server-side grant system exists in the executable code. Monetization appears only in planning documents. The paid-MVP path must therefore include a real authentication/persistence deployment first, then a narrowly scoped paid access model with server-authoritative entitlements and verified webhook fulfillment.

## Verified graphics state

The repository already contains a material shooter-style foundation: generated character, weapon, vehicle, effect, app-icon, and environment assets; a `GameSprite` registry with image-first rendering and emoji fallbacks; a canvas DRIVE shooter with parallax street rendering, particles, screen shake, tracers, cockpit framing, and combat HUD; plus grid-based SLIDE and top-down combat modes.

However, visual quality is inconsistent. Some core combat screens still rely on emoji, colored cells, or procedural silhouettes. The unmerged branch `origin/agent/las-olas-graphics-destruction` is six commits ahead of main and adds a validated, compiling V3 combat renderer with a tropical-noir Las Olas scene, persistent material-specific impact damage, breakable glass/storefront elements, vehicle hit regions, a pooled particle system, 14-joint ragdolls, and a coordinate repair for grid shots. That branch passes TypeScript and production build checks and is the strongest existing integration candidate rather than rebuilding the shooter renderer from scratch.

## Immediate implementation direction

Integrate the validated Las Olas graphics branch into the isolated MVP branch, preserve the compatibility entrypoint, then add focused validation around the renderer and address the QA-access problem with a build-time-controlled demo path that is impossible to enable accidentally in production. Use the resulting playable preview to verify the shooter presentation visually. After that, prioritize the minimum player journey: authentication, onboarding, block claim, crew placement, DEALT income, one combat loop, persistence, return session, and a single paid entitlement.
