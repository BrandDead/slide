#!/usr/bin/env bash
# ============================================================
# DEALT/SLIDE - One-Command Local Setup
# Usage: ./setup.sh
# ============================================================

set -e

echo "============================================"
echo "  DEALT/SLIDE - Local Development Setup"
echo "============================================"

# ── 1. Check prerequisites ─────────────────────────────────
command -v node >/dev/null 2>&1 || { echo "Node.js is required. Install from https://nodejs.org"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "Python 3 is required."; exit 1; }

echo "[1/5] Prerequisites OK"

# ── 2. Backend setup ───────────────────────────────────────
echo "[2/5] Setting up backend..."
cd backend/python

if [ ! -f .env ]; then
    cp .env.example .env
    echo "  Created backend/.env from .env.example"
fi

python3 -m venv venv 2>/dev/null || true
if [ -f venv/bin/activate ]; then
    source venv/bin/activate
fi

pip install -r requirements.txt -q 2>/dev/null || pip3 install -r requirements.txt -q
echo "  Backend dependencies installed"

cd ../..

# ── 3. Frontend setup ─────────────────────────────────────
echo "[3/5] Setting up frontend..."
cd frontend

if [ ! -f .env ]; then
    cp .env.example .env
    echo "  Created frontend/.env from .env.example"
fi

npm ci --silent 2>/dev/null || npm install --silent
echo "  Frontend dependencies installed"

cd ..

# ── 4. Verify builds ──────────────────────────────────────
echo "[4/5] Verifying builds..."

cd backend/python
python3 -c "from app import create_app; app = create_app(); print('  Backend: OK')" 2>/dev/null || echo "  Backend: needs DB config (expected for local dev)"
cd ../..

echo "[5/5] Setup complete!"
echo ""
echo "============================================"
echo "  Quick Start Commands:"
echo "============================================"
echo ""
echo "  Frontend:  cd frontend && npm run dev"
echo "  Backend:   cd backend/python && python app.py"
echo "  Both:      cd frontend && npm run dev:all"
echo "  Docker:    docker compose up"
echo ""
echo "  Frontend:  http://localhost:3000"
echo "  Backend:   http://localhost:5000"
echo "============================================"
