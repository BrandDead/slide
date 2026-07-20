# Report — Graphics Wiring Milestone (2026-07-20)

**Audience:** owner + any AI/dev session picking up the build.
**Companion docs:** `docs/PROJECT_LOG.md` (running record), `docs/graphics-audit/` (diagnosis),
issues #77–#81 (roadmap).

---

## 1. What was done today

### Repo management (morning)

- Merged **PR #76** — Las Olas V3 combat renderer (destruction, vehicle damage, ragdolls),
  auth hydration fix, block-sync mounting, 18+ gate, entitlement schema. Rollback anchor:
  branch `backup/pre-pr76`.
- Closed superseded draft PR #75. Filed roadmap issues **#77–#81**. Landed **PR #82**
  (manifest repairs, graphics audit into `docs/graphics-audit/`, `docs/PROJECT_LOG.md`,
  `npm test` now runs the real vitest suite).

### Issue #78 implementation (this change)

The audit's core finding was: *the expensive art exists, the game never draws it.*
This change wires the generated art library into every live block/combat surface.

| Surface | Before | Now |
|---|---|---|
| Top-down block board | Flat colored 8×8 CSS grid, 28px pixel-sprite tokens, emoji fallbacks | Aerial block photography under a translucent tactical grid; members are circular portrait tokens with role ring, level chip, health readout |
| Street view | Gradient-rectangle backdrop, pixel-sprite tokens | Real night-street environment art; members render as full photoreal street sprites where the art exists (dealer, shooter, enforcer), portrait chips where it doesn't yet (lookout, driver) |
| V3 combat renderer | All standing actors from the legacy 4-frame `gang_members.png` sheet | Standing actors draw the high-res street art (green-matte residue cleaned at load time); ragdolls still take over on impact; roles without street art keep the legacy fallback |
| Placement flow | Every deployed member became `"Member" / dealer / Lv1` (identity thrown away) | Deploy panel's member identity (name, role, level) is carried through the store and rendered on the board |

**New module:** `frontend/src/services/assetResolver.ts` — the single lookup layer between
game roles and the art library. It only ever returns files verified to exist on disk with
usable alpha, handles per-state fallback chains (idle→aim, hit→downed, …), preloads
block-mode art, and de-fringes chroma residue for canvas sprites. **All renderers must go
through it** — no more hardcoded sprite URLs in components.

**Visual evidence** (captured from a clean production build via the graphics lab):

- `docs/qa/2026-07-20-topdown-board.png` — tactical board over aerial photography
- `docs/qa/2026-07-20-street-view.png` — neon-noir street scene with real actors
- `docs/qa/2026-07-20-v3-combat-hires-actors.png` — combat scene, hi-res standing actors

**Validation:** `tsc --noEmit` clean · 22/22 vitest tests pass · production build passes ·
screenshots taken against the built preview.

---

## 2. Design direction (the picture to hold in your head)

One canonical style, per #77: **cinematic 2.5D tactical diorama**. The player looks at a
*place* — an authored, location-specific block — and the 8×8 gameplay grid is a thin
tactical overlay on top of it, not the thing itself. Characters are photoreal/painted
raster actors matched to one camera; SVG/DOM is reserved for HUD (rings, badges, bars).
Neon-noir grade: wet night streets, neon accents, glass UI.

Today's milestone is the first real step onto that path: the board became a place, the
actors became people. What's still missing to fully reach it: one shared camera contract
for all art, per-location plates (the current board reuses one strip-plaza aerial for
every block), and actor animation states beyond single poses.

---

## 3. Where the build is

**Working now:** phone-OS shell → DEALT economy → crew roster → block claim → deploy
members onto the tactical board → income ticks → drive-by combat with destruction,
ragdolls, and hi-res actors → bail/consequences. Auth + persistence plumbing (Supabase)
are mounted; entitlement schema exists read-only. The game *looks* like a game now on its
three main combat/territory surfaces.

**Not yet real:** payments (schema only), server-authoritative game state (most progress
still lives in browser-persisted Zustand stores), NPC opposition with memory (#81),
block variety (#80 — every block plays on the same template), multiplayer.

---

## 4. What needs attention

### In the art library (blocks issue #78 from fully closing)
1. Missing sprites: street-idle for dealer, lookout, driver; aim/fire for everyone except
   dealer; any street art at all for lookout + driver. Until generated, those roles show
   portrait chips / legacy fallbacks.
2. Vehicle cutouts: the sedan's top-down and side views have baked backgrounds (no alpha),
   so cars are still drawn procedurally everywhere. Recut per #79.
3. Ten assets carry green chroma residue at the source (runtime cleanup masks the worst).

### In the code
1. `TopDownShooter.tsx` (turn-based prototype) still renders text/emoji units and is
   disconnected from block mode — fold into the diorama path or park it (#77).
2. `DriveByEngine`/`SecurityCamRenderer` still draw primitive-shape worlds (#77 scope).
3. The StreetBlock lane→backdrop alignment is approximate; actors sit slightly high on
   the storefront band. Real per-plate scene coordinates arrive with #77's projection layer.
4. Zone stats (`ZONE_STATS`) are hardcoded per zone type — Block DNA (#80) replaces this.

### In the build/infra
1. ~276 MB of images ship to the frontend; portraits render at 34px from 1920×1920
   sources. #79 (downscale, WebP, budget, CI gate) is the next highest-leverage task.
2. Mapbox vendor chunk is 1.66 MB minified; circular chunk warnings persist.
3. Stale branches still need GitHub-UI deletion: `agent/las-olas-graphics-destruction`,
   `agent/mvp-readiness-2026-07-16`, `copilot/research-audit-dealt-slide`,
   `docs/gameplay-bible`. Keep `backup/pre-pr76`.

---

## 5. What's next (recommended order)

1. **#79 asset cleanup** — regenerate the broken/missing sprites listed above with proper
   alpha, downscale runtime copies, convert to WebP, wire `analyze_game_assets.py` as a
   regression gate. This finishes #78's acceptance criteria as a side effect.
2. **#77 art bible + Las Olas hero plate** — lock the camera contract, author one
   end-to-end hero block in the final style, add the grid→scene projection layer.
3. **#80 Block DNA** — 5–10 authored block cards first, then grow toward 30–40.
4. **#81 NPC rival crews** — the computer plays the opposition.
5. Payments/server-authority P0s per `docs/MVP_STATUS_AND_DEV_PLAN_2026-07-16.md` run in
   parallel on the backend track.
