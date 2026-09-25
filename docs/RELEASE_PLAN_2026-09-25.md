# Release Planning Investigation — Issue #171
**Date**: 2026-09-25  
**Scope**: Read-only investigation for production release planning  
**Issue**: https://github.com/BrandDead/slide/issues/171

---

## Executive Summary

✅ **Current HEAD Verified**: `main-tL2525` at `390cc785dc0d8e53c9fba554eb25ec9bef2ffad8`  
✅ **Required CI**: GREEN (Frontend lint+build, Backend pytest)  
✅ **Production Policy**: Manual promotion (intentional, not misconfigured)  
📊 **Divergence**: 153 commits ahead of production (744c52b → 390cc78)  
🚀 **RC Proposal**: 390cc78 (current HEAD) with passing CI  
🔄 **Rollback Target**: `dpl_EU1Jw9BuyCrRfsuk6JEdrjes8MsE` at `744c52b`

---

## 1. Current Protected Default State ✓

**Branch**: `main-tL2525`  
**HEAD**: `390cc785dc0d8e53c9fba554eb25ec9bef2ffad8`  
**Commit**: `Merge pull request #168 from BrandDead/ci/167-full-required-gates`  
**Date**: 2026-09-23

### Required CI Status: ✅ **GREEN**

- `Frontend (lint + build)`: ✅ pass (2m46s)
- `Backend (pytest)`: ✅ pass (24s)
- GitHub Actions run: https://github.com/BrandDead/slide/actions/runs/35891023278

Recent CI history shows consistent success:
```
completed  success  Merge pull request #168 (main-tL2525)  2026-09-23T16:49:40Z
completed  success  Merge pull request #166 (main-tL2525)  2026-09-23T16:40:23Z
completed  success  Merge pull request #165 (main-tL2525)  2026-09-23T16:35:06Z
completed  success  Merge pull request #161 (main-tL2525)  2026-09-23T16:30:20Z
completed  success  Merge pull request #159 (main-tL2525)  2026-09-23T16:16:03Z
```

---

## 2. Vercel Production Branch Policy 🔍

### Finding: **Manual Promotion Policy** (Intentional)

**Evidence**:
1. Vercel project setting: `"live": false`
2. Recent `main-tL2525` pushes create deployments with `"target": null` (Preview)
3. Current production deployment shows `"source": "redeploy"` (manual promotion)
4. No auto-promote configured on any branch

**Deployment Pattern Observed**:
```
dpl_3HGNJ15FJSzz8xmoK5vfQe3dctNT  main-tL2525@390cc78  target: null     (Preview)
dpl_HbzfiNphtR7NhcNuf7njyH86tAST  cursor/*           target: null     (Preview)
dpl_Cpon8koqDxp7mvKU4pTjPYMm6yra  ci/*               target: null     (Preview)
dpl_EU1Jw9BuyCrRfsuk6JEdrjes8MsE  main-tL2525@744c52b target: production source: redeploy
```

### Conclusion ✅

Preview-only deployments for `main-tL2525` are **by design**, not a misconfiguration. This is a deliberate operational control requiring explicit promotion approval before changes reach production domains.

---

## 3. Production vs. Protected Default Divergence 📊

### Current Production
- **Deployment**: `dpl_EU1Jw9BuyCrRfsuk6JEdrjes8MsE`
- **Commit**: `744c52b3653907c4c4c8d0b5f3249021a6c88ab2`
- **Message**: "feat: Fable AI Economy Pillar 1 — Shoebox store, PayrollModal, reinforcements"
- **Date**: 2026-07-04
- **Aliases**: 
  - `slide-sable-rho.vercel.app`
  - `slide-steve-wessels-projects.vercel.app`
  - `slide-git-main-tl2525-steve-wessels-projects.vercel.app`
- **Inspector**: https://vercel.com/steve-wessels-projects/slide/EU1Jw9BuyCrRfsuk6JEdrjes8MsE

### Divergence: **153 Commits Ahead**

### Key Changes Since Production (744c52b → 390cc78)

#### 🎯 **Major Gameplay & Features**
- **Phase 1 proof**: Las Olas loop and idempotency hardening (`b0046ea`)
- **Beta gate scaffolding**: Single Las Olas demo path, 18+ gate, evaluation mode
- **Route performance**: Lazy-load heavy engines (MapLibre, Phaser, Babylon) off demo shell
- **Mobile clearance**: Strip action CTA no longer covered by tutorial hint at 375px
- **Ghost Crew**: Authoritative world slice, replay-safe ticks, grudge memory
- **Block DNA**: 
  - Batch two: 25 → 33 cards with resolver catalog versioning
  - Batch three: Complete 40-card fictional library
- **Territory**: 
  - Server-authoritative DNA snapshots
  - Canonical grid repair (nested board consumption)
  - Map resilience (tactical fallback when MapLibre fails)
- **2.5D Diorama**: Cinematic Las Olas street scene on Strip desk

#### 🔒 **Security & Data Integrity**
- **Leaderboard security**: 
  - Browser access to legacy `get_leaderboard` RPC removed
  - Service-role restriction prepared (staging-only, not applied to production)
- **Demo ledger isolation**: Signed-in sessions no longer touch demo-player ledger
- **Staging RLS/grant hardening**: Prepared in PR #165 (not applied to production DB)

#### 🐛 **Bug Fixes & Stability**
- **Demo XP threshold**: Restored numeric threshold (was `undefined`, broke level-up)
- **Leaderboard fallback**: Labeled honestly as "Local Snapshot" when RPC unavailable
- **Encounter reliability**: Comprehensive Las Olas loop tests
- **Ghost alerts**: Kept fictionalized (no real names)

#### 🛠️ **CI & Infrastructure**
- **Full test gates** (PR #168): Frontend now runs complete `npm run validate`; backend runs full `tests` suite
- **Node 24 alignment**: Pinned `ubuntu-24.04`, actions upgraded to v5/v6, removed Node 20 deprecation warnings
- **Required checks**: `Frontend (lint + build)` and `Backend (pytest)` enforced on `main-tL2525`

#### 📚 **Documentation & Governance**
- **PROJECT_LOG.md reconciliation**: Current 946-passed/4-skipped frontend, 95-passed backend baseline
- **Required checks documented**: Branch protection contexts recorded
- **Contributor onboarding**: `docs/AI_CONTRIBUTOR_START_HERE.md`
- **Runbook updates**: No longer depend on deleted proof branches

### Changes NOT Included (Explicitly Out of Scope)
- ❌ No Supabase migrations applied to production
- ❌ No Edge Function deployments
- ❌ No scheduler changes
- ❌ No secret rotation
- ❌ No payment/monetization activation

---

## 4. Proposed Release Candidate 🚀

### RC SHA: `390cc785dc0d8e53c9fba554eb25ec9bef2ffad8`

**Rationale**:
- ✅ Required CI green (Frontend lint+build ✅, Backend pytest ✅)
- ✅ Incorporates complete Phase 1 proof + stability fixes
- ✅ Includes 153 commits of improvements over 2.5 months
- ✅ Latest Vercel preview deployment successful (`READY`)
- ✅ No blocking regressions identified in CI or recent merges

### Preview URLs (for Manual Smoke Testing)

**Latest main-tL2525 Preview**:
- **Deployment ID**: `dpl_3HGNJ15FJSzz8xmoK5vfQe3dctNT`
- **Preview URL**: https://slide-2ga43w1q0-steve-wessels-projects.vercel.app
- **Branch URL**: https://slide-git-main-tl2525-steve-wessels-projects.vercel.app
- **Status**: `READY`
- **Inspector**: https://vercel.com/steve-wessels-projects/slide/3HGNJ15FJSzz8xmoK5vfQe3dctNT

### Required Smoke Test Specification

Per task requirements, test **core Las Olas path** at:

- [ ] **1280×800** (desktop)
- [ ] **414×896** (iPhone 11/XR)
- [ ] **375×812** (iPhone X/11 Pro)

**Test Path** (from `docs/RELEASE_CHECKLIST.md` and PROJECT_LOG):
1. Age gate → acknowledge 18+ affirmation
2. Command desktop → MAP
3. Hood view → Las Olas block (1208 W Las Olas or nearby)
4. Strip desk → place Dre + Rome on tactical grid
5. Run encounter → observe combat + briefing
6. Collect income → Shoebox vault update

**⚠️ Note**: Smoke testing **NOT performed** by this investigation (read-only constraint). Human approval + manual smoke testing required before promotion.

---

## 5. Rollback Deployment & Procedure 🔄

### Known-Good Rollback Target

- **Deployment ID**: `dpl_EU1Jw9BuyCrRfsuk6JEdrjes8MsE`
- **Commit**: `744c52b3653907c4c4c8d0b5f3249021a6c88ab2`
- **Message**: "feat: Fable AI Economy Pillar 1 — Shoebox store, PayrollModal, reinforcements"
- **Date**: 2026-07-04
- **Status**: `READY`, `isRollbackCandidate: true`
- **Inspector**: https://vercel.com/steve-wessels-projects/slide/EU1Jw9BuyCrRfsuk6JEdrjes8MsE

### Rollback Procedure

**Option 1: Vercel Dashboard Rollback** (Fastest)
1. Navigate to Vercel dashboard → project "slide"
2. Go to **Deployments** tab
3. Find deployment `dpl_EU1Jw9BuyCrRfsuk6JEdrjes8MsE` (marked as rollback candidate)
4. Click **"Promote to Production"**
5. Verify production aliases resolve to `744c52b`
6. Monitor runtime errors for 15 minutes post-rollback

**Option 2: Git Tag + Redeploy** (If deployment no longer available)
```bash
# Tag the rollback anchor
git tag -a release/2026-07-04-rollback -m "Production rollback anchor" 744c52b
git push origin release/2026-07-04-rollback

# Manually promote resulting deployment in Vercel dashboard
```

**Option 3: Revert Merge** (Nuclear option, avoid if possible)
```bash
# Create revert branch
git checkout -b revert/production-rollback main-tL2525
git revert -m 1 <merge-commit-range>
git push origin revert/production-rollback

# Open PR, get approval, merge, manually promote
```

**Recommended**: Use **Option 1** (dashboard rollback) for speed and safety. The deployment is confirmed healthy and marked as a rollback candidate.

---

## 6. Production Environment Inventory 🔐

### Frontend Environment Keys
*(from `frontend/.env.example`)*

- `VITE_API_URL` — Backend API endpoint
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anonymous key
- `VITE_MAPBOX_ACCESS_TOKEN` — Mapbox token for street maps
- `VITE_SOCKET_URL` — WebSocket endpoint (multiplayer features)
- `VITE_ENV` — Environment identifier (production/staging/development)
- `VITE_DEMO_MODE` — Demo bypass flag (**NEVER set in production**)

### Backend Environment Keys
*(from `backend/python/.env.example`)*

**Database**:
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (privileged)
- `SUPABASE_ANON_KEY` — Supabase anonymous key
- `DATABASE_URL` — PostgreSQL connection string (alternative to Supabase)

**External Services**:
- `MAPBOX_ACCESS_TOKEN` — Mapbox token (geocoding, maps)
- `GOOGLE_MAPS_API_KEY` — Optional Google Maps (Street View, 3D Tiles)

**Application**:
- `SECRET_KEY` — Flask JWT/session secret
- `CORS_ORIGINS` — CORS whitelist (comma-separated)
- `HOST` — Server bind address
- `PORT` — Server port

**Feature Flags**:
- `ENABLE_STREET_VIEW` — Google Street View toggle
- `ENABLE_3D_TILES` — Google 3D Tiles toggle
- `ENABLE_WORLD_TICK` — Ghost crew world tick toggle

### ⚠️ Security Note

**Actual secret values NOT queried** (read-only investigation per task constraints). Verify all required keys are set in Vercel project settings before promotion:

```bash
# Inspect (do not expose values)
vercel env ls --scope production
```

Ensure no placeholder/example values remain from `.env.example`.

---

## 7. Summary & Remaining Acceptance Items

### ✅ Completed Investigation

| Item | Status | Details |
|------|--------|---------|
| Current HEAD verified | ✅ | `390cc78` confirmed |
| CI status confirmed | ✅ | Frontend + Backend GREEN |
| Production policy determined | ✅ | Manual promotion (intentional) |
| Divergence identified | ✅ | 153 commits, key changes documented |
| RC proposed | ✅ | `390cc78` with passing CI |
| Preview URL provided | ✅ | https://slide-2ga43w1q0-steve-wessels-projects.vercel.app |
| Rollback target identified | ✅ | `dpl_EU1Jw9BuyCrRfsuk6JEdrjes8MsE` at `744c52b` |
| Rollback procedure documented | ✅ | Three options provided |
| Env keys inventoried | ✅ | Names only, no secret values exposed |

### 🚨 Remaining Human Approval Items

- [ ] **Executive decision**: Approve promotion of `390cc78` to production
- [ ] **Smoke testing**: Manual verification of Las Olas core path at 3 viewport sizes on preview URL
- [ ] **Environment audit**: Confirm all required production env vars are set in Vercel (no placeholder values)
- [ ] **Promotion execution**: Manually promote deployment `dpl_3HGNJ15FJSzz8xmoK5vfQe3dctNT` in Vercel dashboard
- [ ] **Post-deploy verification**: 
  - [ ] HTTP 200 checks on `youbetterslide.com`
  - [ ] HTTP 200 checks on `www.youbetterslide.com`
  - [ ] Verify commit SHA in deployment inspector
- [ ] **Runtime monitoring**: 15-minute error watch post-promotion (Vercel runtime errors dashboard)
- [ ] **Documentation**: Update `docs/PROJECT_LOG.md` with release entry

---

## 8. Next Actions

### Immediate (Before Promotion)

1. **Human decision**: Approve/reject promotion of `390cc78` to production
2. **Smoke test**: Execute 3-viewport Las Olas core path on preview URL
3. **Env audit**: Verify production env vars in Vercel dashboard

### During Promotion

4. **Promote deployment**: Use Vercel dashboard to promote `dpl_3HGNJ15FJSzz8xmoK5vfQe3dctNT` to production
5. **Verify aliases**: Confirm `youbetterslide.com` and `www.youbetterslide.com` resolve to new deployment

### After Promotion

6. **HTTP checks**: Verify 200 responses on both production domains
7. **Runtime monitoring**: Watch Vercel error dashboard for 15 minutes
8. **Tag release**: 
   ```bash
   git tag -a release/2026-09-25-production -m "Production release: Phase 1 proof + 153 improvements" 390cc78
   git push origin release/2026-09-25-production
   ```
9. **Document release**: Add entry to `docs/PROJECT_LOG.md`

---

## ⚠️ Critical Constraints Honored

This investigation made **NO changes** to:
- ❌ Production deployments (not promoted)
- ❌ Vercel project settings (not mutated)
- ❌ Supabase migrations (not applied)
- ❌ Environment variables (not exposed or modified)
- ❌ Branch protection rules
- ❌ GitHub PR merge/auto-merge settings

**All findings are read-only**. Human approval + manual smoke testing + explicit promotion action required before production changes.

---

**Report compiled**: 2026-09-25  
**Investigation agent**: Cloud Agent (Cursor)  
**Issue**: https://github.com/BrandDead/slide/issues/171
