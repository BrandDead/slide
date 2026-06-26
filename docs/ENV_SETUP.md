# Environment Setup Guide

## Quick Start

```bash
# Clone and setup
git clone https://github.com/BrandDead/slide.git
cd slide
./setup.sh
```

## Environment Variables

### Frontend (`frontend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | Yes | `http://localhost:5000` | Backend API base URL |
| `VITE_SUPABASE_URL` | No | - | Supabase project URL (leave empty for dev mode) |
| `VITE_SUPABASE_ANON_KEY` | No | - | Supabase anonymous key |
| `VITE_MAPBOX_ACCESS_TOKEN` | No | - | Mapbox GL JS token for territory maps |
| `VITE_SOCKET_URL` | No | `ws://localhost:3001` | WebSocket server URL |
| `VITE_ENV` | No | `development` | Environment identifier |

### Backend (`backend/python/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | No | - | PostgreSQL connection string |
| `SUPABASE_URL` | No | - | Supabase URL (leave empty for dev mode) |
| `SUPABASE_SERVICE_ROLE_KEY` | No | - | Supabase service role key |
| `MAPBOX_ACCESS_TOKEN` | No | - | Mapbox token for geocoding |
| `SECRET_KEY` | Yes | `dev-secret-key...` | Flask session/JWT secret |
| `FLASK_DEBUG` | No | `True` | Enable debug mode |
| `CORS_ORIGINS` | No | `http://localhost:5173` | Allowed CORS origins |
| `HOST` | No | `0.0.0.0` | Server bind address |
| `PORT` | No | `5000` | Server port |

## Dev Mode

When `SUPABASE_URL` is not set, the backend runs in **dev mode**:
- Authentication uses a mock user (`dev-user-001`)
- Database operations use in-memory mock stores
- All game modes are fully playable without external services

## Docker Setup

```bash
docker compose up
```

This starts:
- **PostgreSQL** (port 5432) with PostGIS
- **Redis** (port 6379) for caching
- **Backend** (port 5000) Flask API
- **Frontend** (port 3000) Vite dev server

## Manual Setup

```bash
# Backend
cd backend/python
cp .env.example .env
pip install -r requirements.txt
python app.py

# Frontend (separate terminal)
cd frontend
cp .env.example .env
npm install
npm run dev
```
