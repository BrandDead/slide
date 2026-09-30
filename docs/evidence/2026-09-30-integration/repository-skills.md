# Repository skills integration evidence — #188 / #187

Source: #187 `f96d78624abfb2088fa38072cf087d5bcc1cd8f8`, protected main `3eda24a3cec2a362fd0446297267b3de8cf08068`.

The initial fixture regressions failed 6 cases as expected: an incremental import removed an existing actor, missing registered files and over-budget retained files still wrote, and staged/unstaged/untracked Python edits did not invoke pytest. Dry-run preservation, replacement, and unchanged-backend controls passed on the original source.

The repaired processor/preflight fixtures pass. Additional cases cover package/orphan budget weight and complete visibility of more than ten staged inputs. Fixtures run the actual CLI in disposable repositories; no public assets, manifest, or source masters in this checkout were mutated.

Full `.agents/skills/slide-release-safety/scripts/preflight.sh src/__tests__/assetProcessor.test.ts` passed: 78 test files, 957 passed / 4 skipped; lint/typecheck; 110 registered images and 13 package files, 7.38 MB / 20 MB, zero audit errors/warnings; 5 packages / 4 schemas; production build. Lint has 200 existing warnings and zero warnings in the new regression files. Existing missing legacy CSS image references and large-bundle warnings remain. Final focused fixtures cover the later plan-visibility and staged/unstaged predicate adjustments.

All three skill packages pass skill-creator's `quick_validate.py`; the shell helper passes `bash -n`. Independent read-only forward testing of sprite import and block-GLB acceptance found the missing full input inventory and ambiguous MAP/STRIP route; both were corrected. GLB schema validation alone is explicitly insufficient when no live consumer exists.

Global processor dry-run found ten unreadable staged legacy PNG inputs: `icons/apps/{market,news,shoebox,shot-caller,trap}/{hover,regular}.png`. The plan/error stops before any write. Reserve their cleanup before a later art import; do not silently skip them or run global `--write` against this dirty input tree. The runtime asset audit itself passes and the new import behavior is proved by clean fixtures.

No gameplay, schema, backend, environment secret, Supabase, production-data, or renderer changes. There is no player-facing change requiring a new UI capture in this PR; the combined gameplay stack receives separate phone/desktop proof before integration.
