# ASSET GAPS & RECOMMENDATIONS — 2026-09-21

**Context:** Visual asset audit for DEALT/SLIDE Las Olas beta path  
**Status:** Asset pipeline functional, 7.38MB / 20MB budget, 0 errors  
**Testing:** UI verified via computerUse subagent, all major flows accessible

---

## EXECUTIVE SUMMARY

**Current State:** ✅ GOOD
- Asset manifest and resolver working correctly
- All 5 primary roles have base visual identity
- Topdown and street renderers using manifest-driven sprites
- Las Olas hero block assets exist and are registered
- No emoji or legacy sprite sheets in active gameplay paths

**Gaps:** MINOR
- Some combat states missing for non-primary roles
- Shooter missing dedicated `aim` pose (borrows dealer's)
- Enforcer/Lookout/Driver missing full combat state coverage

**Recommendation:** These gaps are **non-blocking** for beta. The fallback chain
ensures gameplay is never broken. Address in polish pass if time permits.

---

## DETAILED ASSET COVERAGE

### Shooter (Priority Role - Armed Combat)

| State | Asset ID | Status | Notes |
|-------|----------|--------|-------|
| idle (street) | `character_shooter_male_street_idle_v001.webp` | ✅ EXISTS | 29KB |
| aim (street) | — | ⚠️ MISSING | **Borrows dealer's aim pose** |
| hit (street) | `character_shooter_male_street_hit_v001.webp` | ✅ EXISTS | 56KB |
| downed (street) | `character_shooter_male_street_downed_v001.webp` | ✅ EXISTS | 20KB |
| idle (topdown) | `character_shooter_male_topdown_idle_v001.webp` | ✅ EXISTS | 11KB |
| downed (topdown) | `character_shooter_male_topdown_downed_v001.webp` | ✅ EXISTS | 21KB |
| arrested (topdown) | `character_shooter_male_topdown_arrested_v001.webp` | ✅ EXISTS | 14KB |
| portrait | `character_shooter_male_portrait_v001.webp` | ✅ EXISTS | 124KB |
| fullbody | `character_shooter_male_fullbody_front_v001.webp` | ✅ EXISTS | 83KB |

**Recommendation:**
- **ASSET_SHOOTER_STREET_AIM_V001** — Generate armed ready stance, weapon visible,
  angled profile. Should match existing shooter idle style but with weapon raised.
  Target size: ~30KB WebP. Priority: **P1 (Important)** — improves threat indication.

---

### Enforcer (Melee/Intimidation Role)

| State | Asset ID | Status | Notes |
|-------|----------|--------|-------|
| idle (street) | `character_enforcer_male_street_idle_v001.webp` | ✅ EXISTS | 27KB |
| aim (street) | — | ⚠️ MISSING | Borrows dealer/shooter |
| hit (street) | — | ⚠️ MISSING | **Borrows shooter's hit** |
| downed (street) | — | ⚠️ MISSING | **Borrows shooter's downed** |
| idle (topdown) | `character_enforcer_male_topdown_idle_v001.webp` | ✅ EXISTS | 17KB |
| downed (topdown) | `character_enforcer_male_topdown_downed_v001.webp` | ✅ EXISTS | 19KB |
| arrested (topdown) | `character_enforcer_male_topdown_arrested_v001.webp` | ✅ EXISTS | 18KB |
| portrait | `character_enforcer_male_portrait_v001.webp` | ✅ EXISTS | 162KB |
| fullbody | `character_enforcer_male_fullbody_front_v001.webp` | ✅ EXISTS | 34KB |

**Recommendation:**
- **ASSET_ENFORCER_STREET_HIT_V001** — Impact reaction, bat/vest visible. ~30KB WebP.
- **ASSET_ENFORCER_STREET_DOWNED_V001** — Ground pose, bat nearby. ~35KB WebP.
- Priority: **P2 (Polish)** — Enforcer silhouette is distinct enough that borrowing
  doesn't break readability, but dedicated assets improve immersion.

---

### Lookout (Reconnaissance/Alert Role)

| State | Asset ID | Status | Notes |
|-------|----------|--------|-------|
| idle (street) | `character_lookout_female_street_idle_v001.webp` | ✅ EXISTS | 22KB |
| hit (street) | — | ⚠️ MISSING | Borrows dealer |
| downed (street) | — | ⚠️ MISSING | Borrows dealer |
| idle (topdown) | `character_lookout_female_topdown_idle_v001.webp` | ✅ EXISTS | 19KB |
| downed (topdown) | `character_lookout_female_topdown_downed_v001.webp` | ✅ EXISTS | 19KB |
| arrested (topdown) | `character_lookout_female_topdown_arrested_v001.webp` | ✅ EXISTS | 16KB |
| portrait | `character_lookout_female_portrait_v001.webp` | ✅ EXISTS | 56KB |
| fullbody | `character_lookout_female_fullbody_front_v001.webp` | ✅ EXISTS | 35KB |

**Recommendation:**
- **ASSET_LOOKOUT_STREET_HIT_V001** — Defensive reaction, radio visible. ~25KB WebP.
- **ASSET_LOOKOUT_STREET_DOWNED_V001** — Ground pose, smaller frame. ~30KB WebP.
- Priority: **P2 (Polish)** — Lookout is support role; combat states less critical.

---

### Driver (Vehicle Operation Role)

| State | Asset ID | Status | Notes |
|-------|----------|--------|-------|
| idle (street) | `character_driver_male_street_idle_v001.webp` | ✅ EXISTS | 24KB |
| hit (street) | — | ⚠️ MISSING | Borrows dealer |
| downed (street) | — | ⚠️ MISSING | Borrows dealer |
| idle (topdown) | `character_driver_male_topdown_idle_v001.webp` | ✅ EXISTS | 17KB |
| portrait | `character_driver_male_portrait_v001.webp` | ✅ EXISTS | 50KB |
| fullbody | `character_driver_male_fullbody_front_v001.webp` | ✅ EXISTS | 34KB |

**Recommendation:**
- **ASSET_DRIVER_TOPDOWN_DOWNED_V001** — Ground pose, cap visible. ~20KB WebP.
- Priority: **P3 (Nice-to-have)** — Driver rarely in direct combat; borrowing acceptable.

---

### Dealer (Base Role - Complete)

| State | Asset ID | Status |
|-------|----------|--------|
| idle (street) | `character_dealer_male_street_idle_v001.webp` | ✅ EXISTS |
| aim (street) | `character_dealer_male_street_aim_v001.webp` | ✅ EXISTS |
| hit (street) | `character_dealer_male_street_hit_v001.webp` | ✅ EXISTS |
| downed (street) | `character_dealer_male_street_downed_v001.webp` | ✅ EXISTS |
| idle (topdown) | `character_dealer_male_blacktee_topdown_idle_v001.webp` | ✅ EXISTS |
| downed (topdown) | `character_dealer_male_topdown_downed_v001.webp` | ✅ EXISTS |
| arrested (topdown) | `character_dealer_male_topdown_arrested_v001.webp` | ✅ EXISTS |

**No action needed.** Dealer is the fallback template; complete coverage.

---

## ENVIRONMENT ASSETS

### Las Olas Hero Block (1208 W Las Olas)

| Asset | Path | Status | Size |
|-------|------|--------|------|
| Topdown plate | `/assets/runtime/generated/environments/topdown/block_lasolas_topdown_v001.webp` | ✅ EXISTS | 143KB |
| Street backdrop | `/assets/runtime/generated/environments/street/block_lasolas_driveby_street_v001.webp` | ✅ EXISTS | 92KB |

**Verdict:** ✅ Las Olas hero assets exist and are registered in manifest.

### Strip Plaza (Default/Fallback)

| Asset | Path | Status | Size |
|-------|------|--------|------|
| Topdown plate | `block_stripplaza_topdown_v001.webp` | ✅ EXISTS | 382KB |
| Street day | `block_stripplaza_day_street_v001.webp` | ✅ EXISTS | 212KB |
| Street night | `block_stripplaza_night_street_v001.webp` | ✅ EXISTS | 226KB |

**Verdict:** ✅ Complete coverage.

---

## PRIORITY MATRIX

### P0 — Blocking (None)
All critical assets exist. Fallback chain prevents broken gameplay.

### P1 — Important (1 asset)
- `ASSET_SHOOTER_STREET_AIM_V001` — Shooter armed stance for threat indication

### P2 — Polish (4 assets)
- `ASSET_ENFORCER_STREET_HIT_V001`
- `ASSET_ENFORCER_STREET_DOWNED_V001`
- `ASSET_LOOKOUT_STREET_HIT_V001`
- `ASSET_LOOKOUT_STREET_DOWNED_V001`

### P3 — Nice-to-have (2 assets)
- `ASSET_DRIVER_TOPDOWN_DOWNED_V001`
- `ASSET_DRIVER_STREET_HIT_V001` (if driver in combat scenarios)

**Total Gap:** 7 assets  
**Budget Impact:** ~200–250KB (well within 20MB budget)  
**Timeline:** Optional polish pass, not blocking beta launch

---

## GENERATION SPECIFICATIONS

If generating the P1 asset (`ASSET_SHOOTER_STREET_AIM_V001`):

**Style:**
- Match existing shooter street idle style
- Urban streetwear, tactical mask
- Night lighting, Miami Vice aesthetic
- 2.5D oblique angle (same as existing street assets)

**Pose:**
- Weapon raised in ready position
- Angled profile (not straight-on)
- Visible weapon prop (compact firearm)
- Alert/focused stance

**Technical:**
- Target dimensions: 1536×2304 (portrait orientation, like existing street assets)
- Output: WebP format, ~30KB after processing
- Alpha channel required (composited over street backdrop)
- Pivot point: (0.5, 1.0) — foot contact at bottom center

**Process:**
1. Generate source PNG at 1536×2304
2. Run through `frontend/scripts/assets/process.mjs` for alpha repair + WebP conversion
3. Place at: `frontend/public/assets/runtime/generated/characters/street/character_shooter_male_street_aim_v001.webp`
4. Verify with: `npm run assets:audit`

---

## LICENSING & ATTRIBUTION

All existing character assets follow the established pipeline:
- Source art processed through automated WebP conversion
- Alpha channel repair applied for clean compositing
- No external attribution required (in-house or commissioned art)

**Note:** If new assets are commissioned or sourced externally, document in
`docs/PRODUCTION_ART_SOURCES.md` with:
- Asset ID
- Source (commissioned artist / stock / AI-generated)
- License terms
- Date added

---

## MANIFEST INTEGRATION

If new assets are added, update these files:

### 1. `frontend/src/assets/assetManifest.ts`
Add entry under `characterAssets` → `shooter_male_001`:
```typescript
streetAim: `${CHARS}/street/character_shooter_male_street_aim_v001.webp`,
```

### 2. `frontend/src/assets/runtimeManifest.json` (auto-generated)
Will be updated automatically when running `npm run assets:process`

### 3. Verify with audit:
```bash
npm run assets:audit
```

---

## CONCLUSION

**Current Asset State: ✅ PRODUCTION-READY**

- All 5 roles visually distinct
- Core gameplay states covered
- Las Olas hero block assets exist
- No blocking gaps
- Budget healthy (7.38MB / 20MB)
- Fallback chain ensures graceful degradation

**Optional Enhancements:**
- P1: Shooter aim pose (~30KB, 1 asset)
- P2: Enforcer/Lookout combat states (~120KB, 4 assets)
- Total enhancement budget: ~150KB

**Recommendation:** Ship beta as-is. The visual language is strong, readability is
excellent, and the fallback system prevents any broken experiences. Polish pass can
add P1/P2 assets post-launch if metrics show player confusion about shooter threats
or enforcer combat states.
