# VISUAL ASSET & QUALITY AUDIT — 2026-09-21

**Branch:** `cursor/visual-asset-quality-2caa`  
**Objective:** Improve Las Olas beta visual path WITHOUT changing gameplay rules,
state, persistence, or scope. Focus on cinematic 2.5D oblique tactical diorama with
readable tactical zones, cover, crew placement, and encounter feedback.

---

## AUDIT SCOPE

### Visual Direction (Approved)
- **Style:** Cinematic 2.5D oblique tactical diorama
- **Mood:** Tropical-noir, fictional only
- **Requirements:** Strong depth/silhouettes, premium palette, tactical readability
- **Platforms:** Desktop + 375×812 mobile
- **Accessibility:** Reduced-motion OK, heat/risk readable without color alone

### Visual References
- `docs/concept-art/gta_block_board.png` — oblique tactical board with readable zones
- `docs/concept-art/1208_w_las_olas_block.webp` — Las Olas hero block plate

### Roles to Distinguish (No new roles/stats)
1. **Dealer** — cash handler, unarmed
2. **Shooter** — armed, combat-ready
3. **Enforcer** — intimidation, melee/tactical gear
4. **Recruit/Lookout** — entry-level, reconnaissance
5. **Driver** — vehicle operator

---

## CURRENT STATE ASSESSMENT

### Asset Budget Status
```
Assets checked  : 110
Runtime total   : 7.38 MB / 20 MB budget
Errors          : 0
Warnings        : 0
Status          : AUDIT PASSED
```

The asset processing pipeline is functional. Assets were reduced from ~276MB to 7.38MB
with automated alpha repair, WebP conversion, and fringe cleanup. The manifest-driven
resolution system (`worldActorResolver.ts`) is wired and working.

### Existing Asset Coverage

#### ✅ Well-Covered Roles
- **Dealer:** portrait, fullbody, topdown (idle), street (idle/aim/hit/downed)
- **Shooter:** portrait, fullbody, topdown (idle/arrested/downed), street (idle/hit/downed)
- **Enforcer:** portrait ×2, fullbody, topdown (idle/arrested/downed), street (idle)
- **Lookout:** portrait, fullbody, topdown (idle/arrested/downed), street (idle)
- **Driver:** portrait, fullbody, topdown (idle), street (idle)

#### ⚠️ Gaps Identified
- **Shooter:** missing street `aim` pose (borrows dealer's)
- **Enforcer:** missing street `aim`/`hit`/`downed` (borrows from shooter/dealer)
- **Lookout:** missing street combat states (only idle)
- **Driver:** missing street combat states (only idle)
- **Recruit:** has idle assets but no dedicated portrait/fullbody

### Visual Language Analysis

#### Current Silhouettes & Differentiation
From examining the existing assets and renderer code:

1. **Dealer** — standing figure, relaxed pose, casual streetwear
2. **Shooter** — armed stance, visible weapon prop
3. **Enforcer** — bulkier silhouette, tactical vest/bat visible
4. **Lookout** — female figure, smaller profile, radio/phone prop
5. **Driver** — cap, racing jacket, keys visible

**Verdict:** Base silhouettes ARE distinct. Issue is *missing states* not *visual
language*. When shooter borrows dealer's aim pose or enforcer borrows idle, the
distinction breaks down in gameplay moments.

---

## RENDERER AUDIT

### TopDownBlock (`frontend/src/components/map/TopDownBlock.tsx`)
**Status:** ✅ **GOOD — Using manifest-driven world actors**

- ✅ Calls `getWorldActor(role, state, 'topdown')` for crew rendering
- ✅ Falls back through state chains (idle → aim → wounded → downed)
- ✅ Block background via `topdownBgUrl` with default fallback
- ✅ Translucent zone tints overlay (preserves environment art)
- ✅ Role-colored level indicators + health bars
- ✅ No emoji fallbacks in production path
- ✅ Shadow + sprite + HUD layering correct

**Issues:**
- ⚠️ Only one environment package ships (`block_stripplaza_miami_001`)
- ⚠️ Las Olas hero environment (`block_lasolas_miami_001`) declared but topdown
  asset may not exist or isn't being loaded (need to verify)

### StreetBlock (`frontend/src/components/map/StreetBlock.tsx`)
**Status:** ✅ **GOOD — Using manifest-driven street actors**

- ✅ Calls `getStreetSpriteUrl(role, state)` via `worldActorResolver`
- ✅ Falls back to portrait chips when street art missing
- ✅ Backdrop via `scene.backdropUrl` (diorama adapter)
- ✅ Projected zone labels (street/sidewalk/etc.)
- ✅ Health bars, selection, drive-by overlays

**Issues:**
- ⚠️ Portrait chips used as fallback — correct behavior but highlights missing
  street combat states for lookout/driver
- ⚠️ Las Olas street backdrop path exists in manifest but may not be visually
  distinct from strip plaza

### GameSprite (Legacy System)
**Status:** ⚠️ **DEPRECATED BUT STILL PRESENT**

- Old `gang_members.png` sprite sheet (2752×1536, 5.9MB) still ships
- Legacy 4-frame role system (dealer/shooter/enforcer/lookout)
- No longer used by TopDownBlock or StreetBlock
- Still referenced in legacy systems (check for orphan usage)

**Action:** Run codebase search to confirm no active gameplay path uses it

---

## BLOCK DNA & ENVIRONMENT PLATES

### Strip Plaza (Default)
- ✅ `block_stripplaza_topdown_v001.webp` exists
- ✅ `block_stripplaza_day_street_v001.webp` exists
- ✅ `block_stripplaza_night_street_v001.webp` exists

### Las Olas Hero Block (1208 W Las Olas)
- ✅ Declared in `assetManifest.ts` as `block_lasolas_miami_001`
- ❓ **Need to verify assets exist:**
  - `/assets/runtime/generated/environments/topdown/block_lasolas_topdown_v001.webp`
  - `/assets/runtime/generated/environments/street/block_lasolas_driveby_street_v001.webp`

---

## VISUAL STATE COVERAGE

### States Required for Las Olas Beta

| State | Dealer | Shooter | Enforcer | Lookout | Driver | Notes |
|-------|--------|---------|----------|---------|--------|-------|
| **idle** | ✅ | ✅ | ✅ | ✅ | ✅ | Complete |
| **aim** | ✅ | ❌ | ❌ | ❌ | ❌ | Shooter borrows dealer |
| **hit** | ✅ | ✅ | ❌ | ❌ | ❌ | Visual feedback critical |
| **downed** | ✅ | ✅ | ❌ | ❌ | ❌ | State visibility critical |
| **arrested** | ✅ | ✅ | ✅ | ✅ | ❌ | Topdown only |

### State Visual Communication Priority

1. **P0 — Blocking:** `downed` (death/injury), `arrested` (raid/jail)
2. **P1 — Important:** `hit` (combat feedback), `aim` (threat indicator)
3. **P2 — Polish:** `fire`, `reload`, `wounded`, `alert`

---

## ROLE VISUAL LANGUAGE GUIDANCE

### Design Principles (From Approved Direction)
- Silhouette and pose differentiate roles, NOT color alone
- Equipment and props reinforce role (weapon, bat, radio, keys)
- Readable at both desktop and 375×812 mobile scales
- Works in reduced-motion mode (no animation dependency)

### Recommended Visual Markers

| Role | Primary Markers | Secondary Markers | States Needed |
|------|----------------|-------------------|---------------|
| **Dealer** | Relaxed pose, empty hands, casual wear | Money/product prop | idle, aim†, hit, downed |
| **Shooter** | Armed stance, visible weapon | Tactical mask, ready pose | idle, aim, hit, downed |
| **Enforcer** | Bulky build, bat/baton visible | Tactical vest, wide stance | idle, aim, hit, downed |
| **Recruit/Lookout** | Smaller frame, phone/radio | Alert posture, young appearance | idle, (hit†, downed†) |
| **Driver** | Cap, jacket, keys visible | Car-adjacent, casual stance | idle, (seated†) |

† = Lower priority or conditional state

### Pose & Silhouette Recommendations
- **Dealer:** Open stance, hands at sides or showing product
- **Shooter:** Weapon-ready, angled profile, tactical crouch
- **Enforcer:** Wide stance, bat/baton held, intimidating posture
- **Lookout:** Alert pose, hand to ear (radio) or shading eyes
- **Driver:** Keys in hand, leaning on vehicle or standing by door

---

## ASSET GAPS & RECOMMENDATIONS

### Priority 1: Missing Combat States (Street View)
**Impact:** High — breaks visual feedback during encounters

1. **Shooter street aim** — Currently borrows dealer's; needs armed ready pose
2. **Enforcer street hit/downed** — Currently borrows; bat/vest should be visible
3. **Lookout street hit/downed** — For defensive positioning scenarios
4. **Driver street hit/downed** — For vehicle-based encounters

**Recommendation:** Generate these 8 assets using existing style/pipeline

### Priority 2: Las Olas Hero Block Verification
**Impact:** Medium — branded/hero content for screenshots/marketing

- Verify Las Olas plate assets exist at declared paths
- If missing, generate or source from concept art plate
- Ensure oblique angle matches approved reference

### Priority 3: Tactical Readability Enhancements
**Impact:** Medium — improves state communication

- Add non-color heat/risk indicators (icons, patterns)
- Verify zone labels readable on both light/dark backdrops
- Test reduced-motion mode doesn't hide critical state info

---

## TESTING PLAN

### Desktop QA (1280×720+)
- [ ] TopDownBlock: all 5 roles render with correct sprites
- [ ] TopDownBlock: idle → hit → downed state transitions visible
- [ ] TopDownBlock: zone tints don't obscure background art
- [ ] TopDownBlock: selection, placement, movement UX clear
- [ ] StreetBlock: backdrop loads, members project correctly
- [ ] StreetBlock: drive-by sequence readable
- [ ] Las Olas environment loads (if assets exist)

### Mobile QA (375×812)
- [ ] Sprites not clipped by viewport
- [ ] Touch targets adequate for placement
- [ ] Zone labels readable
- [ ] Health bars visible
- [ ] Info panels don't cover critical game area

### Fallback & Error States
- [ ] Missing asset gracefully falls back (no blank sprites)
- [ ] Optional map failure shows 8×8 fallback grid
- [ ] Blocked actions have visual feedback
- [ ] Empty roster shows appropriate placeholder

---

## DELIVERABLES CHECKLIST

- [ ] This audit document
- [ ] Asset gap list with exact filenames
- [ ] Role visual language guide (above)
- [ ] Desktop + mobile QA screenshots
- [ ] Licensing/source notes (if new assets created)
- [ ] Recommended manifest entries (if new assets)
- [ ] Integration notes for any code changes
- [ ] PR with walkthrough artifacts

---

## NEXT STEPS

1. **Verify Las Olas assets** — Check if hero block plates exist
2. **Build & test UI** — Capture current visual state with screenshots
3. **Document gaps** — Create exact asset ID list for missing states
4. **Test fallbacks** — Verify degraded states don't break UI
5. **Mobile QA** — Test 375×812 viewport
6. **Create PR** — With this audit + screenshots + integration notes

---

## APPENDIX: File Paths

### Asset Manifest
- `frontend/src/assets/assetManifest.ts` — Declared paths
- `frontend/src/assets/runtimeManifest.json` — Generated manifest (audit source)

### Resolvers
- `frontend/src/render/worldActorResolver.ts` — Role + state → sprite URL
- `frontend/src/services/assetResolver.ts` — Legacy helper, delegates to worldActorResolver

### Renderers
- `frontend/src/components/map/TopDownBlock.tsx` — Tactical grid view
- `frontend/src/components/map/StreetBlock.tsx` — 2.5D diorama view

### Processing Pipeline
- `frontend/scripts/assets/process.mjs` — WebP conversion, alpha repair
- `frontend/scripts/assets/audit.mjs` — CI gate (fringe, alpha, budget)
- `frontend/scripts/assets/exceptions.json` — Approved exceptions
