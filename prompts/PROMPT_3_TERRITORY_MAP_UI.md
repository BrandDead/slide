# PROMPT 3: Territory Map UI — Mapbox-Powered Block Control

**Recommended AI Model:** `deepseek-v3.1:671b-cloud`

**Estimated Complexity:** High (Mapbox GL JS integration + real-time territory visualization)

---

## TASK

Generate the complete React/TypeScript UI for the **Territory Map** — a Mapbox GL JS-powered map where players can claim real-world city blocks, view their territory, deploy gang members to blocks, and see enemy territories. The map is the strategic hub of the game, connecting all other mini-games.

---

## TECH STACK

- React 18 with functional components and hooks
- TypeScript (strict mode)
- Zustand 4 for state management
- Mapbox GL JS (via `mapbox-gl` npm package)
- Tailwind CSS for UI panels (dark theme)
- Framer Motion for panel animations

---

## EXISTING DATABASE SCHEMA (Supabase)

The `blocks` table in Supabase has the following structure:

```sql
CREATE TABLE blocks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  address TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  owner_id UUID REFERENCES profiles(id),
  heat INTEGER DEFAULT 0,
  traffic_level INTEGER DEFAULT 50,
  income_per_hour NUMERIC DEFAULT 0,
  max_units INTEGER DEFAULT 8,
  grid_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

The `gang_members` table:

```sql
CREATE TABLE gang_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES profiles(id),
  name TEXT NOT NULL,
  role TEXT CHECK (role IN ('dealer','shooter','enforcer','driver','chemist')),
  level INTEGER DEFAULT 1,
  loyalty INTEGER DEFAULT 50,
  morale INTEGER DEFAULT 50,
  status TEXT CHECK (status IN ('active','injured','jailed','dead','awol')),
  assigned_block_id UUID REFERENCES blocks(id),
  stats JSONB DEFAULT '{}',
  equipment JSONB DEFAULT '{}',
  salary NUMERIC DEFAULT 100,
  arrests INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## EXISTING SUPABASE CLIENT (`frontend/src/services/supabase.ts`)

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = createClient(supabaseUrl, supabaseKey);

// Auth service
export const authService = {
  signUp: async (email: string, password: string, username: string) => { ... },
  signIn: async (email: string, password: string) => { ... },
  signOut: async () => { ... },
  getSession: async () => { ... },
};

// Block service
export const blockService = {
  getBlocks: async () => supabase.from('blocks').select('*'),
  getBlockById: async (id: string) => supabase.from('blocks').select('*').eq('id', id).single(),
  claimBlock: async (blockData: any) => supabase.from('blocks').insert(blockData),
  updateBlock: async (id: string, data: any) => supabase.from('blocks').update(data).eq('id', id),
};

// Gang member service
export const gangService = {
  getMembers: async (ownerId: string) => supabase.from('gang_members').select('*').eq('owner_id', ownerId),
  assignToBlock: async (memberId: string, blockId: string) => supabase.from('gang_members').update({ assigned_block_id: blockId }).eq('id', memberId),
};
```

---

## FILES TO GENERATE

Generate the following 7 files:

1. **`frontend/src/stores/territoryStore.ts`** — Zustand store. State: `blocks: Block[]`, `selectedBlockId: string | null`, `playerBlocks: Block[]`, `enemyBlocks: Block[]`, `isLoading: boolean`. Actions: `fetchBlocks()`, `selectBlock(id)`, `claimBlock(address, lat, lng)`, `deployMember(blockId, memberId, position)`, `recallMember(memberId)`.

2. **`frontend/src/components/map/TerritoryMap.tsx`** — Main map component. Initialize Mapbox GL JS with dark style (`mapbox://styles/mapbox/dark-v11`). Center on the player's first block or default to a US city. Add GeoJSON sources for player blocks (green polygons) and enemy blocks (red polygons). On block click, call `selectBlock` and open `BlockInfoPanel`. Add a floating "Claim Block" button that opens `ClaimBlockModal`.

3. **`frontend/src/components/map/BlockInfoPanel.tsx`** — Slide-in panel from the right side. Shows: block address, owner name, heat level (with color indicator), income per hour, traffic level, number of units deployed (with list), and action buttons ("Deploy Units", "Attack This Block", "View Grid"). Use Framer Motion for slide animation.

4. **`frontend/src/components/map/ClaimBlockModal.tsx`** — Modal overlay. Contains: an address input field, a "Search" button that calls the Mapbox Geocoding API (`https://api.mapbox.com/geocoding/v5/mapbox.places/{query}.json?access_token={token}`), a preview map showing the found location, and a "Claim" button. On claim, create a new block in Supabase with the geocoded coordinates.

5. **`frontend/src/components/map/BlockGridOverlay.tsx`** — When a block is selected and "View Grid" is clicked, this component overlays an 8x8 grid on the map at the block's location. Each cell shows the terrain type and any deployed units. This connects to the SLIDE combat system.

6. **`frontend/src/components/map/MemberDeployPanel.tsx`** — A panel that lists all available (unassigned) gang members. Each member card shows: name, role icon, level, and stats. Clicking a member and then clicking a grid cell deploys them to that position.

7. **`frontend/src/components/map/index.ts`** — Barrel export.

---

## DESIGN GUIDELINES

- **Map style**: Mapbox dark-v11 with custom layers for territory.
- **Player territory**: Green semi-transparent polygons with green borders. Pulsing glow effect.
- **Enemy territory**: Red semi-transparent polygons with red borders.
- **Neutral blocks**: Gray outlines, no fill.
- **Block markers**: Custom markers showing the block's heat level (green/yellow/red circle).
- **Info panel**: Glass morphism effect, slides in from right, 350px wide.
- **Claim modal**: Centered modal with dark background, address autocomplete.
- **Grid overlay**: Semi-transparent grid over the map, cells are clickable.

---

## MAPBOX INTEGRATION NOTES

- The Mapbox access token comes from `import.meta.env.VITE_MAPBOX_ACCESS_TOKEN`.
- Use `mapbox-gl` npm package (already in package.json).
- Import the Mapbox CSS: `import 'mapbox-gl/dist/mapbox-gl.css'`.
- Create the map in a `useEffect` with cleanup.
- Use `map.addSource` and `map.addLayer` for GeoJSON territory polygons.
- For the grid overlay, use a custom Mapbox layer or a DOM overlay.

---

## BLOCK POLYGON GENERATION

To create a polygon for a block from a center point (lat, lng), generate a square polygon approximately 100m x 100m:

```typescript
function blockPolygon(lat: number, lng: number, sizeMeters: number = 100): GeoJSON.Feature {
  const offset = sizeMeters / 111320; // Approximate degrees per meter at equator
  const lngOffset = offset / Math.cos(lat * Math.PI / 180);
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [lng - lngOffset, lat - offset],
        [lng + lngOffset, lat - offset],
        [lng + lngOffset, lat + offset],
        [lng - lngOffset, lat + offset],
        [lng - lngOffset, lat - offset],
      ]],
    },
  };
}
```
