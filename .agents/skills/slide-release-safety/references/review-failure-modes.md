# Review failure modes

Use this during implementation and final diff review. These are verified failure classes from the SLIDE codebase, not hypothetical style advice.

| Failure class | What to inspect | Required regression |
|---|---|---|
| Stale closure | Every value read inside `useCallback`, `useEffect`, timers, subscriptions, and event handlers must be in the dependency strategy or intentionally read from a current ref/store. | Enter fields in the exact visual order and in a different order; action must use current values. |
| Cleanup coupling | A cleanup must own one lifecycle. Do not let preview URL replacement, prop change, or unrelated rerender cancel an async poll or listener. | Replace a file/input while a queued job runs; polling still reaches terminal state. Unmount cancels it. |
| Validate only at start | Mutable inputs can become invalid after generation/preview and before commit. Validate at the irreversible mutation boundary too. | Make valid → reach confirmation → invalidate → confirm must not mutate. |
| Duplicate action | React state updates are not a synchronous lock. A double tap can enter twice before disabled state renders. | Fire the action twice in one `act`; service and domain mutation each occur once. |
| Incomplete object hidden by `as any` | Search every domain constructor and store mutation. A visually working card can still lack fields used later by morale, combat, jail, health, assignment, or persistence. | Assert the complete typed contract and reload it. Never accept a cast as proof. |
| Destructive fallback merge | Sparse polling/approve responses can replace a richer generated object and erase URLs or metadata. | Merge only defined fields; assert original generated fields survive a sparse response. |
| Pretend-success fallback | A fallback may silently use stock art or mock data after accepting player-specific input. | Tell the player it is a preview/fallback or fail honestly. Do not label stock output as generated from their input. |
| Two authorities | New code may mirror cash, heat, crew, territory, encounter, or notification state instead of extending the existing path. | Trace one writer and one idempotent result. Assert no double reward/consequence. |
| Key/contact duplication | Removing and reseeding one entity may leave derived or linked records. | Remove/add/reload twice; rendered keys and logical IDs stay unique. |
| Code-only verification | Unit tests may pass while a banner blocks a phone action, a route opens a different app, or the deployed bundle fails. | Play the real entry route at phone and desktop widths; capture screenshots and console/page errors. |

## React and async review questions

- What values can change between render and click?
- Which effect owns each timer, object URL, subscription, animation loop, and request?
- What happens if the user replaces input, closes the modal, retries, navigates away, or taps twice?
- Does a failed request leave the UI retryable and the store unchanged?
- Does the final mutation re-read and validate the latest state?
- Does a sparse response preserve richer local fields?

## Shared-state review questions

- Which store/service is authoritative for this value?
- Is the action adapter emitting a typed result instead of mutating strategy state directly?
- What idempotency key prevents repeat application?
- Does reload, route change, or a second session show the same outcome?
- Is optional Mapbox or backend availability incorrectly blocking the local core loop?

## Visual review questions for code PRs

- Is the control visible and reachable at 390×844 and 1440×900?
- Does a fixed banner, keyboard, modal, safe-area inset, or scroll container cover it?
- Does the component use the intended runtime asset through the resolver/manifest, or a hardcoded URL/placeholder?
- Are loading, empty, unavailable, and error states visually distinct from success?
