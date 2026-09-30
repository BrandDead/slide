#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" || ! -f "$ROOT/frontend/package.json" ]]; then
  echo "Run this script inside the DEALT/SLIDE repository." >&2
  exit 2
fi

BASE_REF="${BASE_REF:-origin/main-tL2525}"
FOCUSED_TEST="${1:-}"
cd "$ROOT"

printf '\n== Diff hygiene (%s...HEAD) ==\n' "$BASE_REF"
git rev-parse --verify "$BASE_REF" >/dev/null
git diff --check "$BASE_REF"...HEAD
git diff --check
git diff --cached --check

printf '\n== Changed paths ==\n'
git diff --name-status "$BASE_REF"...HEAD

cd frontend
if [[ -n "$FOCUSED_TEST" ]]; then
  printf '\n== Focused regression ==\n'
  npx vitest run "$FOCUSED_TEST"
fi

printf '\n== Full validation ==\n'
npm run validate

printf '\n== Production build ==\n'
npm run build

# Include branch changes, staged/unstaged edits, and new untracked Python
# files. This script is commonly run before the regression fix is committed.
BACKEND_CHANGES="$(
  git -C "$ROOT" diff --name-only "$BASE_REF"...HEAD -- backend/python
  git -C "$ROOT" diff --name-only --cached -- backend/python
  git -C "$ROOT" diff --name-only -- backend/python
  git -C "$ROOT" ls-files --others --exclude-standard -- backend/python
)"
if [[ -n "$BACKEND_CHANGES" ]]; then
  printf '\n== Backend tests (backend changed) ==\n'
  cd "$ROOT/backend/python"
  if [[ ! -x ./venv/bin/python ]]; then
    echo "backend/python/venv is missing; cannot verify backend changes." >&2
    exit 3
  fi
  ./venv/bin/python -m pytest tests -q
fi

cat <<'EOF'

Automated gates passed.
Manual evidence is still required for player-facing changes:
- real entry route at phone and desktop widths
- happy path and one realistic failure path
- page/console errors recorded
- screenshots attached to the PR
EOF
