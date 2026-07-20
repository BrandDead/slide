# Age and Fictional-Content Gate QA

Date: 2026-07-16
Branch: `agent/mvp-r`

## Result

The new mature-content and fictional-crime notice renders correctly as the first visible production entry screen when required frontend runtime variables are present. A clean headless Chromium profile captured `/home/ubuntu/slide/docs/age-gate-qa.png` at 1440×1000 after a production build using non-production Supabase placeholders for deterministic visual QA.

The validated screen clearly states that SLIDE is a mature fictional crime strategy game, contains fictional depictions and references involving crime, drugs, weapons, gambling, and violence, does not provide real-world instructions or endorse illegal activity, and requires the player to affirm that they are 18 years of age or older before continuing.

## Important runtime finding

A first production capture rendered black because the frontend entrypoint throws when `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is absent. This is not a new regression from the age gate, but it is a launch-readiness requirement: staging and production deployments must provide valid Supabase frontend variables before the app can render any screen.

## Evidence

| Artifact | Purpose |
|---|---|
| `docs/age-gate-qa.png` | Clean-browser visual proof that the age/content gate renders correctly when runtime config is present. |
| `/tmp/slide-visual-build.log` | Production build output from the deterministic visual-QA build. |
| `/tmp/slide-age-chromium.log` | Headless Chromium screenshot run log. |
