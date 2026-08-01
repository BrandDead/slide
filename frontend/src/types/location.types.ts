/**
 * DEALT/SLIDE - Location & Grid Type Definitions
 * Real-world location → Playable grid transformation
 */

// ============================================================================
// GEOGRAPHIC TYPES
// ============================================================================

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export type SupportedCity = 'nyc' | 'la' | 'miami' | 'chicago' | 'detroit' | 'nola' | 'fort_lauderdale';

export interface CityConfig {
  name: string;
  displayName: string;
  bounds: BoundingBox;
  centerCoords: Coordinates;
  timezone: string;
  gangStyle: GangStyleConfig;
}

export interface GangStyleConfig {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  motifs: string[];
  slang: Record<string, string>;
}

// ============================================================================
// MAPBOX RESPONSE TYPES
// ============================================================================

export interface MapboxGeocodeResponse {
  type: 'FeatureCollection';
  features: MapboxFeature[];
  attribution: string;
}

export interface MapboxFeature {
  id: string;
  type: 'Feature';
  place_type: string[];
  relevance: number;
  properties: {
    accuracy?: string;
    mapbox_id: string;
  };
  text: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  context?: MapboxContext[];
}

export interface MapboxContext {
  id: string;
  text: string;
  short_code?: string;
}

export interface MapboxStaticImageParams {
  coordinates: Coordinates;
  zoom: number;
  width: number;
  height: number;
  style?: 'streets-v12' | 'satellite-v9' | 'satellite-streets-v12' | 'dark-v11';
  highRes?: boolean;
}

// ============================================================================
// BLOCK TYPES
// ============================================================================

export interface BlockClaimRequest {
  address: string;
  userId: string;
}

export interface BlockClaimResponse {
  success: boolean;
  block?: Block;
  error?: string;
  reason?: 'already_claimed' | 'invalid_address' | 'outside_service_area' | 'rate_limited';
}

export interface Block {
  id: string;
  
  // Location Data
  address: string;
  formattedAddress: string;
  city: SupportedCity;
  neighborhood?: string;
  coordinates: Coordinates;
  bounds: BoundingBox;
  
  // Generated Assets
  satelliteImageUrl: string;
  stylizedImageUrl?: string; // AI-generated version
  gridData: BlockGrid;
  
  // Gameplay Data
  trafficScore: number;      // 1-100, affects income
  dangerScore: number;       // 1-100, affects raids
  coverDensity: number;      // Average cover across tiles
  incomePerHour: number;     // Calculated from traffic + dealers
  
  // Ownership
  ownerId: string | null;
  ownerGangName?: string;
  claimedAt?: string;        // ISO timestamp
  
  // Status
  heat: number;              // 0-100
  lastRaidAt?: string;
  isContested: boolean;
  
  // Stats
  totalEarnings: number;
  timesDefended: number;
  timesLost: number;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  generationVersion: string; // For cache invalidation
}

// ============================================================================
// GRID TYPES
// ============================================================================

export interface BlockGrid {
  width: number;
  height: number;
  tiles: GridTile[][];
  
  // Precomputed data for performance
  streetRow: number[];       // Y indices of street tiles
  sidewalkRows: {
    top: number[];
    bottom: number[];
  };
  spawnPoints: {
    attackerEntry: Coordinates[];
    attackerExit: Coordinates[];
    defenderSpawns: Coordinates[];
  };
}

export interface GridTile {
  x: number;
  y: number;
  
  // Tile Classification
  type: TileType;
  subtype?: TileSubtype;
  
  // Combat Modifiers
  cover: number;             // 0.0-1.0, damage reduction
  visibility: number;        // 0.0-1.0, detection chance
  movementCost: number;      // 1.0 = normal, 2.0 = slow
  
  // Features
  features: TileFeature[];
  
  // State
  occupiedBy?: string;       // Unit ID
  deployable: boolean;       // Can place units here
  destructible: boolean;     // Can be damaged
  health?: number;           // If destructible
  
  // Visuals
  spriteKey?: string;
  rotation?: number;
  elevation?: number;
}

export type TileType = 
  | 'street'
  | 'sidewalk'
  | 'building'
  | 'alley'
  | 'parking'
  | 'grass'
  | 'water';

export type TileSubtype =
  | 'crosswalk'
  | 'intersection'
  | 'median'
  | 'curb'
  | 'entrance'
  | 'fire_escape'
  | 'loading_dock';

export interface TileFeature {
  type: FeatureType;
  coverBonus: number;
  visibilityPenalty: number;
  destructible: boolean;
  health?: number;
  lootable?: boolean;
  interactable?: boolean;
}

export type FeatureType =
  | 'dumpster'
  | 'parked_car'
  | 'mailbox'
  | 'fire_hydrant'
  | 'streetlight'
  | 'bench'
  | 'trash_can'
  | 'newspaper_box'
  | 'phone_booth'
  | 'bus_stop'
  | 'barricade'
  | 'crate'
  | 'barrel'
  | 'scaffold'
  | 'vendor_cart';

// ============================================================================
// GENERATION TYPES
// ============================================================================

export interface GridGenerationConfig {
  gridWidth: number;
  gridHeight: number;
  streetWidth: number;        // Rows dedicated to street
  sidewalkWidth: number;      // Rows per sidewalk
  featureDensity: number;     // 0.0-1.0
  coverBias: number;          // Higher = more cover
  seed?: string;              // For reproducibility
}

export interface GridGenerationResult {
  grid: BlockGrid;
  metadata: {
    generatedAt: string;
    seed: string;
    config: GridGenerationConfig;
    stats: {
      totalTiles: number;
      streetTiles: number;
      sidewalkTiles: number;
      buildingTiles: number;
      featureCount: number;
      averageCover: number;
      averageVisibility: number;
    };
  };
}

export interface TileGenerationContext {
  position: { x: number; y: number };
  neighbors: (GridTile | null)[];
  cityStyle: GangStyleConfig;
  trafficScore: number;
  seed: string;
}

// ============================================================================
// CACHE TYPES
// ============================================================================

export interface BlockCacheEntry {
  block: Block;
  cachedAt: string;
  expiresAt: string;
  hitCount: number;
}

export interface GridCacheEntry {
  gridData: BlockGrid;
  hash: string;              // Hash of generation params
  cachedAt: string;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface LocationSearchResult {
  suggestions: AddressSuggestion[];
  query: string;
  cached: boolean;
}

export interface AddressSuggestion {
  address: string;
  formattedAddress: string;
  coordinates: Coordinates;
  city: SupportedCity | null;
  inServiceArea: boolean;
  mapboxId: string;
}

export interface BlockPreview {
  address: string;
  coordinates: Coordinates;
  city: SupportedCity;
  satelliteImageUrl: string;
  estimatedTraffic: number;
  estimatedIncome: number;
  isAvailable: boolean;
  currentOwner?: {
    gangName: string;
    claimedAt: string;
  };
}

// ============================================================================
// EVENT TYPES
// ============================================================================

export type LocationEventType =
  | 'block_claimed'
  | 'block_lost'
  | 'block_contested'
  | 'grid_generated'
  | 'satellite_loaded'
  | 'claim_failed';

export interface LocationEvent {
  type: LocationEventType;
  blockId?: string;
  userId: string;
  timestamp: string;
  data: Record<string, unknown>;
}
