# DEALT/SLIDE Architecture Overview

This document provides an architectural snapshot of the DEALT/SLIDE game, showing how the
frontend, backend, state-management, and data layers interact. All diagrams are expressed
in **Mermaid** for easy visualisation.

---

## 1. System Architecture

```mermaid
graph TD
    subgraph Frontend
        FE[React + Vite TS UI] -->|dispatch actions| STATE[Zustand Store]
        FE -->|HTTP API| API_SRV[apiClient.ts]
        STATE -->|calls| API_SRV
    end

    subgraph Backend
        API_SRV -->|REST| FLASK[Flask Python API]
        FLASK -->|Supabase Auth| SUPABASE_AUTH[Supabase Auth]
        FLASK -->|Supabase DB| DB[(PostgreSQL)]
        FLASK -->|Geocoding| GEO[Geocoding Service - Mapbox]
        FLASK -->|Engine| BLOCK_ENG[block_state_engine]
        FLASK -->|Engine| GRID_ENG[grid_generator]
        FLASK -->|Scheduler| SCHED[APScheduler World Tick]
        FLASK -->|AI| NPC[NPC AI Engine]
    end

    GEO -->|HTTP| MAP_API[Mapbox API]

    API_SRV -.->|JWT in Authorization header| SUPABASE_AUTH
    BLOCK_ENG -.->|read/write| DB
    GRID_ENG -.->|read/write| DB
    SCHED -.->|periodic tick| BLOCK_ENG
    NPC -.->|spawn/decide| DB

    style FE fill:#f9f,stroke:#333,stroke-width:2px
    style FLASK fill:#bbf,stroke:#333,stroke-width:2px
    style DB fill:#bfb,stroke:#333,stroke-width:2px
```

- **Frontend** — Built with React, Vite, TypeScript and **Zustand** for client-side state.
- **Backend** — Flask serves a REST API. Business logic lives in the `api/` blueprints and in service modules (`block_state_engine`, `geocoding_service`, `grid_generator`, `npc_ai`, `scheduler`).
- **Supabase** — Provides PostgreSQL storage and authentication (JWT).
- **External** — Mapbox for geocoding and map visualization.

---

## 2. Frontend Component Tree

```mermaid
graph TD
    App[App.tsx] --> OSShell[OSShell - iOS Desktop]
    OSShell --> MAP[TerritoryMap]
    OSShell --> DEALT[DealtMode]
    OSShell --> SLIDE[SlideGame]
    OSShell --> DRIVE[DriveByGame]
    OSShell --> COOK[AlchemyLab]
    OSShell --> CREW[Contacts]
    OSShell --> SHOEBOX[Shoebox]
    OSShell --> MARKET[Market]
    OSShell --> OPS[Missions]
    OSShell --> CASINO[Casino]
    OSShell --> SETTINGS[SettingsPage]

    subgraph Mini-Games
        MAP --> NPCPanel[NPCPanel]
        MAP --> MapboxMap[MapboxMap]
        MAP --> BlockSearch[BlockSearch]
        MAP --> BlockOverlay[BlockOverlay]
        MAP --> BlockDetailPanel[BlockDetailPanel]

        SLIDE --> DualGrid[dualGrid.ts]
        SLIDE --> TurnLogic[turnLogic.ts]

        COOK --> AlchemyEngine[alchemyEngine.ts]

        DRIVE --> DriveByEngine[DriveByEngine]
    end

    subgraph Stores
        GS[gameStore.ts] --> PlayerStore
        GS --> GangStore
        GS --> EconomyStore
        GS --> NotificationStore
        GS --> MoraleStore
        GS --> SelfieStore
    end

    subgraph Services
        AC[apiClient.ts]
        SS[syncService.ts]
        API[api.service.ts]
    end
```

The tree shows the high-level UI modules and the major component files under each app.

---

## 3. Frontend State Management Flow (Zustand)

```mermaid
sequenceDiagram
    participant UI as UI Component
    participant Store as Zustand Store (gameStore.ts)
    participant Client as apiClient.ts
    participant Backend as Flask API

    UI->>Store: dispatch(action)
    Store->>Store: setState()
    Store->>Client: async API call (if needed)
    Client->>Backend: HTTP request (JWT in header)
    Backend-->>Client: JSON response
    Client-->>Store: update(state)
    Store-->>UI: re-render with new state
```

All game-wide data (player, gang, economy, notifications, morale, selfie) lives in a single
Zustand store file (`gameStore.ts`), providing a predictable, hook-based API for React components.

---

## 4. Backend API Flow

```mermaid
flowchart LR
    FE[Frontend - React] -->|REST| GATE[Flask Router - Blueprints]
    GATE --> AUTH[Auth Blueprint /auth]
    GATE --> BLOCKS[Blocks Blueprint /api/blocks]
    GATE --> COMBAT[Combat Blueprint /api/combat]
    GATE --> WORLD[World Blueprint /api/world]
    GATE --> INVENTORY[Inventory Blueprint /api/inventory]
    GATE --> DRIVEBY[Driveby Blueprint /api/driveby]

    AUTH -->|validate JWT| SUPABASE_AUTH[Supabase Auth]
    BLOCKS -->|call| BLOCK_ENG[block_state_engine]
    BLOCKS -->|call| GEO[Geocoding Service]
    COMBAT -->|read/write| DB[Supabase PostgreSQL]
    WORLD -->|call| SCHED[Scheduler]
    BLOCK_ENG -->|update| DB
    SCHED -->|tick| BLOCK_ENG
```

Requests travel through Flask blueprints, which delegate business logic to service modules.
All persistence is handled by Supabase.

---

## 5. Database Schema (Supabase/PostgreSQL)

```mermaid
erDiagram
    PROFILES {
        uuid id PK
        text username
        text avatar_url
        int level
        int xp
        timestamptz created_at
        timestamptz updated_at
    }
    GANGS {
        uuid id PK
        uuid owner_id FK
        text name
        text motto
        int reputation
        int heat_level
        int morale
        numeric cash_balance
        timestamptz created_at
    }
    GANG_MEMBERS {
        uuid id PK
        uuid gang_id FK
        text name
        text role
        int level
        int xp
        int shooting
        int dealing
        int driving
        int loyalty
        int morale
        text status
        timestamptz recruited_at
    }
    BLOCKS {
        uuid id PK
        uuid owner_gang_id FK
        text address
        text city
        float lat
        float lng
        jsonb grid_data
        float traffic_score
        float income_per_hour
        int heat_level
        float defense_rating
        timestamptz claimed_at
    }
    INVENTORY {
        uuid id PK
        uuid gang_id FK
        text item_type
        text item_id
        int quantity
        jsonb metadata
    }
    TRANSACTIONS {
        uuid id PK
        uuid gang_id FK
        text type
        numeric amount
        text description
        text category
        timestamptz created_at
    }
    COMBAT_SESSIONS {
        uuid id PK
        uuid attacker_gang_id FK
        uuid target_block_id FK
        text status
        int current_turn
        int max_turns
        jsonb combat_log
        timestamptz started_at
        timestamptz ended_at
    }

    PROFILES ||--o{ GANGS : owns
    GANGS ||--o{ GANG_MEMBERS : has
    GANGS ||--o{ BLOCKS : claims
    GANGS ||--o{ INVENTORY : stores
    GANGS ||--o{ TRANSACTIONS : records
    GANGS ||--o{ COMBAT_SESSIONS : initiates
    BLOCKS ||--o{ COMBAT_SESSIONS : targeted_by
```

The schema captures the core entities: profiles, gangs, members, blocks (territories), inventory, financial transactions, and combat sessions.

---

**End of ARCHITECTURE.md**
