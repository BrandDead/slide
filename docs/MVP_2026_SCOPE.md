# SLIDE Paid MVP Scope

**Prepared by:** Manus AI  
**Date:** 2026-07-16  
**Target:** A small, controlled web beta in which a new adult player can pay for access, complete one coherent empire loop, lose progress through understandable risk, and return to the same saved game.

## Product definition

SLIDE should not launch as a collection of every proposed mini-game. The MVP is one connected loop in which each included screen changes the same persistent player state:

> **Choose a block → recruit a crew → position members → equip product → make deals → generate heat → defend against one attack or raid → resolve wounds/arrests → reinvest → return later to the same empire.**

The current codebase contains many playable-looking modes, but the launch criterion is not the number of icons. The launch criterion is whether one player can complete the loop above without developer intervention, contradictory balances, lost state, or a dead end.

## MVP gates

| Gate | Required player outcome | Verified current state | MVP acceptance criterion | Priority |
| --- | --- | --- | --- | --- |
| Account | Create an account and return later | UI exists; deployment credentials and end-to-end production flow are not verified | Email sign-up, sign-in, password recovery, sign-out, session restore, and explicit error states work against the production database | P0 |
| Age/content | Enter an adults-only fictional crime game with clear boundaries | No verified launch gate | Age affirmation and fictional-content notice appear before account completion; storefront copy avoids targeting minors | P0 |
| Onboarding | Create identity and claim a starting block | Onboarding and block-claim code exist but depend on unverified services | A new player names a gang, selects a color, claims one valid starter block, and reaches the desktop in under five minutes | P0 |
| Shared state | Every included mini-game changes one server-authoritative empire | Rich local state plus partial server services | Money, heat, inventory, crew status, territory, wounds, arrests, and loadout survive refresh and a second device | P0 |
| Crew | Recruit and assign a minimal functional roster | Contacts/crew screens exist | Player can recruit at least one dealer and one shooter, understand their role/level/morale, and assign or recall them | P0 |
| Product | Create/equip a small drug catalog | Alchemy/cook systems exist | Three base recipes and one risky upgraded recipe have clear cost, demand, potency, profit, overdose, and heat tradeoffs | P0 |
| Dealing | Convert equipped inventory and placement into income/heat | DEALT mode exists | A short deal session produces deterministic server-validated deltas and shows why money, product, reputation, and heat changed | P0 |
| Block placement | Make street-vs-safety positioning meaningful | Map/grid systems exist | Dealer placement near the street visibly raises earnings and exposure; deeper placement lowers both, using one documented formula | P0 |
| Combat | Defend the block through one readable shooter loop | Several combat modes exist; presentation is inconsistent | One primary SLIDE/DRIVE encounter uses the selected block layout, assigned crew, equipped weapons, cover, wounds, ammunition, and persistent consequences | P0 |
| Heat/raid | Make aggressive play create understandable risk | Heat and raid concepts exist in multiple layers | A visible heat ladder forecasts raid risk; a raid can seize carried product/weapons and arrest members without silently deleting unrelated state | P0 |
| Consequences | Resolve injured or arrested members and morale | Concepts and UI fragments exist | Hospital and bail choices have clear prices/timers; unresolved cases lower morale; morale effects are bounded, explained, and never appear as arbitrary corruption | P0 |
| Economy | Prevent trivial exploits and soft-locks | Multiple local simulations exist | All grants/spends are server-validated; starter recovery path prevents a bankrupt player from becoming permanently stuck | P0 |
| Payment | Accept payment without trusting the client | No executable implementation | One narrow paid entitlement is fulfilled only after verified server-side payment confirmation; duplicate events are idempotent; refunds/revocations are supported | P0 |
| Operations | Detect failures and support players | Not verified | Production error logging, audit trails for economy/payment events, backup/restore, support contact, privacy/terms, and an admin grant/revoke tool exist | P0 |
| Performance | Run well enough on target devices | Build passes; Mapbox bundle is large | Core desktop and combat route load acceptably on a defined low/mid-tier phone and desktop; large routes are lazy-loaded | P1 |
| Extra mini-games | Add breadth after the core loop retains users | Casino, graffiti, top-down, Cocaine Crush, shoe box, news, and other modes exist | Excluded from the critical launch path unless they already operate on authoritative shared state and require no P0 time | Post-MVP |

## Shooter-style graphics bar

The combat MVP should have a **consistent visual language**, not merely more effects. The accepted direction is grounded tropical noir: recognizable South Florida street geometry, readable tactical silhouettes, believable vehicles/weapons, strong cover and hit feedback, restrained HUD design, and destruction that communicates game state.

| Visual requirement | MVP standard | Not required for first paid beta |
| --- | --- | --- |
| Environment | One polished, scalable Las Olas-style block with road, sidewalk, storefront depth, cover, street clutter, and coherent night lighting | Multiple cities, photogrammetric digital twins, weather seasons |
| Characters | Role-readable dealer/shooter/enforcer silhouettes, consistent scale, clear facing and damage states | Full facial customization, motion capture, dozens of skins |
| Weapons | Distinct handgun/SMG/shotgun silhouettes, muzzle flash, tracer, recoil, impact type, ammunition state | Large arsenal or licensed replicas |
| Damage | Persistent bullet marks, glass breakage, sparks/debris, vehicle panel damage, downed-state reactions | Full structural destruction or simulation-grade physics |
| Tactical clarity | Player can identify targets, cover, friendly positions, street edge, danger zones, and consequences within seconds | Cinematic effects that obscure targeting |
| Performance | Effects degrade gracefully; pooled particles; device-pixel-ratio cap; reduced-motion mode | High-end-only WebGL post-processing |

The validated `agent/las-olas-graphics-destruction` work already supplies much of the environment, impact, vehicle-damage, ragdoll, and coordinate-repair foundation. The MVP implementation should integrate and test that work before commissioning another renderer.

## Paid-access approaches

The payment architecture must be server-authoritative and event-driven regardless of the offer. Actual financial account configuration and final pricing remain owner decisions.

| Approach | Player experience and tradeoffs | Operating cost | Setup complexity |
| --- | --- | --- | --- |
| Founders access pass | A player makes one purchase to unlock the beta. It is the fastest path to real demand validation, avoids balancing a virtual-currency store before the economy is stable, and makes refunds/entitlements straightforward. It creates less repeat revenue and requires clear expectations that the product is an early beta. | Payment processor fees plus hosting/database costs | Low to medium |
| Cosmetic supporter packs | The beta is open or access-controlled separately; players can purchase non-pay-to-win cosmetics such as crew colorways, vehicle paint, UI themes, or block banners. It protects competitive fairness but requires a cosmetic inventory/equip system and enough visual quality to make the items desirable. | Payment processor fees plus asset-production cost | Medium |
| Premium currency and power items | Players buy currency, weapons, slots, boosts, or recovery. It can monetize repeatedly, but it is the highest-risk MVP choice because it couples payments to economy exploits, fairness, refunds, minors/content policy, and platform rules before retention is proven. | Higher support, fraud, balance, and compliance cost | High |

For build sequencing, implement the **entitlement plumbing needed by either of the first two approaches**: product catalog, checkout-session creation, verified webhook, idempotent event store, entitlement grant/revoke, receipt linkage, and an in-game locked/unlocked state. Do not ship power-item sales until the core economy is authoritative and instrumented.

## Deliberately excluded from the critical path

The first paid beta does not require life-sentence incarceration, a complete inter-gang market, large-scale synchronous multiplayer, every proposed drug combination, every casino game, photorealistic versions of many addresses, real-time police AI, clan chat, push notifications, rewarded ads, or native iOS/Android store release. These are backlog items only after the web loop is stable and early players return voluntarily.

## Definition of ready for paying players

The build reaches paid-MVP status when all P0 gates above pass in a production-like environment; a clean account can complete the whole loop; a returning session preserves the same state; a payment test grants exactly one entitlement through a verified server event; a refund test revokes it correctly; a combat session presents the integrated shooter art direction at stable performance; and support can reconstruct every money, inventory, crew, and entitlement change from audit records.
