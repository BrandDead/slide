# Legacy HTTP encounter session ownership

Source base: `9eef5aac28a82275d7a2e1596e8658b167953ed7`. The two runtime source files and request-level regression test are byte-identical to independently reviewed local commit `37dddc1e1f672bb34ca12145f88bdd2499fb9d15` (original worker implementation `39c32abdd7b5acf986249d4004f4b4d3bab113f8`).

## Contract and checks

Session creation derives its creator from the server-verified caller, not a submitted owner field. Existing-session reads and mutations check that creator before session-derived work. Missing, foreign and ownerless sessions use the existing not-found response. Ordinary creator and offline development paths remain usable.

The regression suite uses two synthetic verified identities through the real Flask blueprints with local snapshot mocks. It checks server-derived creator binding, access denial without snapshot work/state mutation, ordinary creator continuation, invalid authentication and offline dev behavior. No real user, token, database or network access is used.

- Unchanged base with the new tests: 12 failed / 12 passed.
- Corrected focused suite: 24 passed.
- Full backend: 131 passed, zero warnings; root independently inspected the diff and re-ran the complete backend gate.
- Complete local #204/#205 plus both reviewed repairs: 1,069 frontend tests / 4 existing skips; 131 backend tests; type/lint/build/assets/packages passed. This is supporting compatibility evidence, not a claim that other drafts are merged.

## Scope and limits

Only `api/combat.py`, `api/driveby.py`, the new ownership test, this text record and a new project-log entry change. There is no frontend renderer or result-writer change. The legacy sessions remain in memory; this PR does not add a match server, durable results, roster authorization or complete command validation. Live authenticated staging (#175), gameplay integrity and human PvP require their separate proofs.

No browser behavior changes in this backend-only PR. Its request-level creator/denial sequence is the relevant direct integration proof. No migration, RLS, secret, scheduler or deployment action was performed.

Revert this focused PR for source rollback; restarting the process discards these existing in-memory sessions. No database data or schema rollback is needed. Integration is independent of #204/#205/#202/#169, with append-only project-log reconciliation required.
