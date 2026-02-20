# DEALT/SLIDE API Documentation

All API endpoints are served from the **Flask** backend. In development:

```
http://localhost:5000
```

The backend uses **Supabase JWT** for authentication. Include the JWT in the `Authorization` header:
```
Authorization: Bearer <access_token>
```

In dev mode, authentication is bypassed and a mock user is provided.

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Blocks](#2-blocks)
3. [Combat](#3-combat)
4. [World](#4-world)
5. [Inventory](#5-inventory)
6. [Driveby](#6-driveby)
7. [Error Codes](#7-error-codes)

---

## 1. Authentication

Base path: `/auth`

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| `POST` | `/auth/register` | Create account | `{ email, password, username }` | `201` `{ access_token, refresh_token, user }` |
| `POST` | `/auth/login` | Log in | `{ email, password }` | `200` `{ access_token, refresh_token, user }` |
| `POST` | `/auth/refresh` | Refresh token | `{ refresh_token }` | `200` `{ access_token }` |
| `GET` | `/auth/me` | Get current user | — | `200` `{ user_id, email, username }` |
| `POST` | `/auth/logout` | Log out | — | `200` `{ message }` |

### Login Flow

1. `POST /auth/login` → receive `access_token` (15 min) and `refresh_token` (7 days)
2. Store `access_token` in memory
3. Include `Authorization: Bearer <access_token>` on every API call
4. On `401`, call `/auth/refresh` with the refresh token

---

## 2. Blocks

Base path: `/api/blocks`

| Method | Endpoint | Description | Request | Response |
|--------|----------|-------------|---------|----------|
| `GET` | `/api/blocks` | List all blocks | — | `[{ id, address, city, ... }]` |
| `GET` | `/api/blocks/search?q=<query>&limit=5` | Search addresses via Mapbox | query params | `{ results: [{ address, city, state, lat, lng, bbox, mapboxId }] }` |
| `POST` | `/api/blocks/claim` | Claim a block | `{ address, city, lat, lng }` | `{ block: { id, address, city, lat, lng, gridData, trafficScore, incomePerHour, heatLevel } }` |
| `GET` | `/api/blocks/<id>` | Get block details | — | `{ id, address, gridData, ... }` |
| `GET` | `/api/blocks/<id>/snapshot` | Get block snapshot for combat | — | `BlockSnapshot` object |
| `POST` | `/api/blocks/<id>/members/place` | Place member on tile | `{ member_id, x, y }` | `{ success, grid }` |
| `POST` | `/api/blocks/<id>/collect` | Collect accumulated income | — | `{ collected, total }` |

### BlockSnapshot Shape

```json
{
  "block_id": "uuid",
  "snapshot_id": "uuid",
  "address": "123 Main St",
  "city": "Los Angeles",
  "bbox": [-118.25, 34.05, -118.24, 34.06],
  "center": [-118.245, 34.055],
  "grid_width": 8,
  "grid_height": 8,
  "tiles": [[{ "terrain": "sidewalk", "feature": "none", "cover": 0.0 }]],
  "members": [{ "id": "uuid", "name": "Lil D", "role": "dealer", "x": 3, "y": 5 }],
  "heat_level": 25,
  "income_per_hour": 150.0,
  "defense_rating": 0.6,
  "traffic_score": 0.8,
  "seed": 42
}
```

---

## 3. Combat

Base path: `/api/combat`

| Method | Endpoint | Description | Request | Response |
|--------|----------|-------------|---------|----------|
| `POST` | `/api/combat/start` | Start combat session | `{ attacker_gang_id, target_block_id, attacker_members: [ids] }` | `{ session_id, target_snapshot, attacker_members, max_turns }` |
| `POST` | `/api/combat/<session_id>/turn` | Submit turn action | `{ attacker_id, action_type, target_id?, position? }` | `{ turn_number, result, combat_log, status }` |
| `GET` | `/api/combat/<session_id>` | Get combat state | — | Full combat session state |

### Action Types

| Action | Description | Required Fields |
|--------|-------------|-----------------|
| `shoot` | Fire at target | `target_id` |
| `move` | Move to position | `position: { x, y }` |
| `reload` | Reload weapon | — |
| `take_cover` | Take cover (reduce damage) | — |

### Turn Result Shape

```json
{
  "turn_number": 5,
  "result": {
    "hit": true,
    "damage": 35,
    "killed": false,
    "counterattack": true
  },
  "combat_log": ["Lil D fires at position (3,4)", "HIT! 35 damage"],
  "status": "ongoing"
}
```

---

## 4. World

Base path: `/api/world`

| Method | Endpoint | Description | Request | Response |
|--------|----------|-------------|---------|----------|
| `GET` | `/api/world/state` | Get world state | — | `{ day, heat, events }` |
| `POST` | `/api/world/tick` | Manual tick (dev) | — | `{ day, events, income }` |
| `GET` | `/api/world/events` | Get recent events | `?limit=20` | `[{ type, message, timestamp }]` |

---

## 5. Inventory

Base path: `/api/inventory`

| Method | Endpoint | Description | Request | Response |
|--------|----------|-------------|---------|----------|
| `GET` | `/api/inventory/` | List inventory | — | `[{ id, item_type, item_id, quantity }]` |
| `POST` | `/api/inventory/add` | Add item | `{ type, item_id, quantity }` | `{ item }` |
| `POST` | `/api/inventory/transfer` | Transfer to member | `{ item_id, member_id, quantity }` | `{ success }` |

---

## 6. Driveby

Base path: `/api/driveby`

| Method | Endpoint | Description | Request | Response |
|--------|----------|-------------|---------|----------|
| `POST` | `/api/driveby/start` | Start drive-by | `{ attacker_id, target_block_id }` | `{ session_id, target_grid }` |
| `POST` | `/api/driveby/<session_id>/shoot` | Fire shot | `{ x, y }` | `{ hit, damage, target_member }` |

---

## 7. Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| 1001 | 401 | Invalid or expired JWT token |
| 1002 | 403 | Insufficient permissions |
| 1003 | 404 | Resource not found |
| 1004 | 409 | Block already claimed by another gang |
| 1005 | 422 | Invalid request body |
| 1006 | 429 | Rate limit exceeded |
| 1007 | 500 | Internal server error |

### Error Response Shape

```json
{
  "error": "Block already claimed",
  "code": 1004,
  "details": {
    "blockId": "uuid",
    "ownerGangId": "uuid"
  }
}
```

---

**End of API.md**
