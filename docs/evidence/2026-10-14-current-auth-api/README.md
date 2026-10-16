# Current Supabase session → Flask HTTP requests

Source base: `9eef5aac28a82275d7a2e1596e8658b167953ed7`. Implementation is byte-identical to locally reviewed commit `e21ec500caa970626df3fd9e7f941980c51b76bd`.

## Automated verification

- Regression-first final suite against the unchanged base: 12 failed / 4 passed. Corrected source: 16 passed.
- Independent auth + existing offline Ghost Crew store suites with no VITE environment: 27 passed.
- Repair-only full frontend: 1,049 passed / 4 existing skips, 92 files; TypeScript passed; lint 0 errors / 200 existing warnings / 0 new lint warnings; runtime audit 112 assets / 7.70 MB of 20 MB / 0 errors or warnings; packages 5 / schemas 4; production build passed.
- The source also passed in the local #204 + #205 candidate: 1,069 frontend tests / 4 skips and 131 backend tests; full build/type/lint/assets/packages gates passed. This does not imply those other PRs are merged.
- Independent review found and repaired an eager SDK import which broke offline test collection before the final gates. No test environment credential override was added to hide that failure.

## Browser evidence and limits

The exact auth-service SHA-256 is `14aaa66c10f57acf19e4f3b80abff27092e5eeb83769f8939e9114aed7a2e6e9`. It was rebuilt with #204/#205 and independently exercised through real demo controls at 390×844 touch, 1440×900 pointer, and phone actor-image failure: age gate → Strip → crew/placement/product/deal → Nightfall → move/fire/reload → retreat/apply → strategy/reload. All three cases had zero page exceptions, one receipt and an unchanged full local ledger after reload. Existing shell image 404s and deliberately failed image requests are recorded as existing/expected. Direct ATTACK routing and encounter-chunk recovery were also checked in the combined source.

The isolated harness served actual built bytes through Playwright request interception because tool sessions could not share localhost. It used system-font fallback and read-only session/texture inspection, without replacing commands or results. Screenshots and raw textual evidence are in the approved review package; they are not attached by this text-only source PR.

This proves local rendering compatibility and session-adapter contracts, not live Supabase authentication, RLS or durable saved-game continuity. #175 remains open. No physical-device GPU or live PvP claim is made.

## Diagnostics and rollback

The same 200 lint warnings remain. The new request-time SDK import produces a Rollup advisory because the app also imports the SDK module statically; it does not create another client or separate bundle. Existing legacy-image references and large-chunk warnings remain.

Revert this focused PR to restore the previous HTTP adapter. No database migration or data rollback is needed. New API/session source and tests are independent of #204, #205, #202 and #169; only their append-only project-log entries require reconciliation.
