# Game Plan: DEALT/SLIDE — Returning Empire Command Brief

## Visual Target

The visual QA reference is maintained outside the repository at `/home/ubuntu/slide-artifact-audit/returning_empire_command_desktop_reference.png`. It defines a grounded tropical-noir command desktop: deep midnight purple and charcoal surfaces, restrained cyan/amber/violet/red status accents, an iOS-like icon grid, and a high-priority persistent City Briefing that explains why the empire changed while the player was away.

## Risk Tasks

### 1. Durable-event to command-desktop projection

- **Why isolated:** The authoritative-world foundation safely hydrates server events into the Ghost Crew store, while the desktop already has its own notification system. A direct or repeated bridge can create duplicate alerts, erase unread state, or make an offline/demo session appear to have server-confirmed events.
- **Approach:** Derive a stable, idempotent briefing projection from the existing Ghost Crew feed. Add only newly hydrated event IDs to the existing notification store, preserve offline/demo behavior, and make the visible briefing clearly distinguish a return-state update from a transient in-session threat banner.
- **Verify:** Hydrating the same events twice creates one notification per event; a later event appears once; demo/offline mode receives only local deterministic feed events; a player can read, dismiss, and revisit the briefing without losing the underlying Ghost Crew state.

### 2. Command-desktop readability across desktop and touch-sized viewports

- **Why isolated:** The current iOS-style shell is dense. Adding a persistent briefing can push the app grid below a usable viewport or overlap status/notification controls.
- **Approach:** Use the established `OSShell` visual system and current notification store instead of introducing a second app. Keep the brief compact, render only its newest bounded items, provide a clear empty state, and use responsive layout rules rather than fixed pixel overlays.
- **Verify:** At desktop width the briefing, status cards, app icons, and dock remain visible without overlap. At touch-sized width the panel remains readable, keyboard reachable, and does not cover navigation. No emoji or hard-coded sprite URLs are introduced.

## Main Build

The milestone adds one player-visible **City Briefing** to the existing command desktop. It connects the durable Ghost Crew/world-event feed already hydrated on authenticated boot to the desktop’s established notification path. Players should see what changed, why it matters, when it occurred, and the next practical move after returning to the game.

The slice must preserve existing contracts: `worldPersistence.service.ts` remains the authoritative transport; `useGhostCrewSync.ts` remains the hydration boundary; `ghostCrewStore.ts` remains the source for Ghost Crew/world events; `useNotificationStore` remains the desktop notification mechanism; and `OSShell` remains the command-center presentation.

- **Assets needed:** No production runtime asset is required for this thin vertical slice. The generated reference image is a visual QA target only; the implementation reuses existing `GameSprite` icons and the established desktop palette.
- **Verify:**
  - Newly hydrated world events appear once in the command desktop’s persistent briefing and the existing notification panel.
  - Threat events remain usable through the existing top threat banner, without duplicate alert storms.
  - Empty, loading/fallback, and error-safe states are understandable.
  - Existing desktop navigation, map, DEALT, and crew routes remain reachable.
  - Typecheck, focused tests, full tests, asset audit, build, and backend tests pass.
  - Desktop and touch-sized visual checks show no overlap, clipping, flat placeholder UI, or browser console errors.
  - Reference consistency: tropical-noir palette, iOS-style hierarchy, clear state distinction, and bounded information density.

## What NOT to Include

- New game engines, a combat rewrite, multiplayer, live chat, payments, real-address targeting, or broad content expansion.
- A browser-owned production world scheduler. Live world ticks remain guarded pending non-production database/RLS proof.
- A second rival-event store, duplicate data fetcher, new notification framework, or generated runtime art bundle.
- Live Supabase migrations, server secrets, or deployment configuration changes from this branch.
