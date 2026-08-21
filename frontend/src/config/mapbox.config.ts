/**
 * DEALT/SLIDE - Mapbox Configuration
 * City definitions, API settings, and styling
 */

import type { CityConfig, SupportedCity, MapboxStaticImageParams } from '../types/location.types';
import { getMapboxToken } from './mapboxToken';

// ============================================================================
// MAPBOX API CONFIG
// ============================================================================

export const MAPBOX_CONFIG = {
  // API Settings
  baseUrl: 'https://api.mapbox.com',
  geocodingEndpoint: '/geocoding/v5/mapbox.places',
  staticImageEndpoint: '/styles/v1',
  
  // Get from environment
  get accessToken(): string {
    const token = getMapboxToken();
    if (!token) {
      console.error('MAPBOX_ACCESS_TOKEN not configured');
      return '';
    }
    return token;
  },
  
  // Rate Limiting
  requestsPerSecond: 10,
  maxRetries: 3,
  retryDelay: 1000,
  
  // Caching
  geocodeCacheTTL: 24 * 60 * 60 * 1000, // 24 hours
  imageCacheTTL: 7 * 24 * 60 * 60 * 1000, // 7 days
  
  // Default Image Settings
  defaultImageConfig: {
    zoom: 18,
    width: 512,
    height: 512,
    style: 'satellite-streets-v12' as const,
    highRes: true,
  },
} as const;

// ============================================================================
// CITY CONFIGURATIONS
// ============================================================================

export const CITY_CONFIGS: Record<SupportedCity, CityConfig> = {
  nyc: {
    name: 'nyc',
    displayName: 'New York City',
    bounds: {
      north: 40.917577,
      south: 40.477399,
      east: -73.700272,
      west: -74.259090,
    },
    centerCoords: { lat: 40.7128, lng: -74.0060 },
    timezone: 'America/New_York',
    gangStyle: {
      primaryColor: '#1a1a1a',
      secondaryColor: '#d4af37',
      accentColor: '#c41e3a',
      motifs: ['timbs', 'yankees', 'fitted', 'designer', 'bodega'],
      slang: {
        block: 'block',
        money: 'bread',
        gun: 'hammer',
        police: 'jakes',
        run: 'dip',
      },
    },
  },
  
  la: {
    name: 'la',
    displayName: 'Los Angeles',
    bounds: {
      north: 34.337306,
      south: 33.703652,
      east: -118.155289,
      west: -118.668176,
    },
    centerCoords: { lat: 34.0522, lng: -118.2437 },
    timezone: 'America/Los_Angeles',
    gangStyle: {
      primaryColor: '#c41e3a',
      secondaryColor: '#1e90ff',
      accentColor: '#ffd700',
      motifs: ['lowrider', 'bandana', 'palm', 'chucks', 'dickies'],
      slang: {
        block: 'hood',
        money: 'feria',
        gun: 'strap',
        police: 'one time',
        run: 'bail',
      },
    },
  },
  
  miami: {
    name: 'miami',
    displayName: 'Miami',
    bounds: {
      north: 25.979434,
      south: 25.598074,
      east: -80.087280,
      west: -80.533424,
    },
    centerCoords: { lat: 25.7617, lng: -80.1918 },
    timezone: 'America/New_York',
    gangStyle: {
      primaryColor: '#ff69b4',
      secondaryColor: '#00ced1',
      accentColor: '#ffffff',
      motifs: ['speedboat', 'cuban_link', 'palm', 'pastel', 'art_deco'],
      slang: {
        block: 'bloque',
        money: 'plata',
        gun: 'hierro',
        police: 'la jura',
        run: 'corre',
      },
    },
  },
  
  chicago: {
    name: 'chicago',
    displayName: 'Chicago',
    bounds: {
      north: 42.023131,
      south: 41.644335,
      east: -87.524044,
      west: -87.940101,
    },
    centerCoords: { lat: 41.8781, lng: -87.6298 },
    timezone: 'America/Chicago',
    gangStyle: {
      primaryColor: '#1a1a1a',
      secondaryColor: '#c41e3a',
      accentColor: '#4169e1',
      motifs: ['ski_mask', 'glock_switch', 'coat', 'drill', 'projects'],
      slang: {
        block: 'block',
        money: 'gwop',
        gun: 'pole',
        police: 'opps',
        run: 'slide',
      },
    },
  },
  
  detroit: {
    name: 'detroit',
    displayName: 'Detroit',
    bounds: {
      north: 42.450440,
      south: 42.255192,
      east: -82.910451,
      west: -83.287959,
    },
    centerCoords: { lat: 42.3314, lng: -83.0458 },
    timezone: 'America/Detroit',
    gangStyle: {
      primaryColor: '#4a4a4a',
      secondaryColor: '#ff6600',
      accentColor: '#87ceeb',
      motifs: ['muscle_car', 'abandoned', 'factory', 'carhartt', 'hustle'],
      slang: {
        block: 'zone',
        money: 'bands',
        gun: 'stick',
        police: 'twelve',
        run: 'ghost',
      },
    },
  },
  
  nola: {
    name: 'nola',
    displayName: 'New Orleans',
    bounds: {
      north: 30.199430,
      south: 29.865203,
      east: -89.848477,
      west: -90.140533,
    },
    centerCoords: { lat: 29.9511, lng: -90.0715 },
    timezone: 'America/Chicago',
    gangStyle: {
      primaryColor: '#4b0082',
      secondaryColor: '#ffd700',
      accentColor: '#228b22',
      motifs: ['voodoo', 'mask', 'gator', 'cemetery', 'brass'],
      slang: {
        block: 'ward',
        money: 'paper',
        gun: 'chopper',
        police: 'people',
        run: 'bounce',
      },
    },
  },

  // ── Broward County / South Florida ────────────────────────────────────────
  // Covers Fort Lauderdale, Hollywood, Pompano Beach, Deerfield Beach,
  // Coral Springs, Plantation, and surrounding Broward County cities.
  fort_lauderdale: {
    name: 'fort_lauderdale',
    displayName: 'Fort Lauderdale',
    bounds: {
      north: 26.3200,
      south: 25.9700,
      east: -80.0500,
      west: -80.3500,
    },
    centerCoords: { lat: 26.1186239, lng: -80.1574818 },
    timezone: 'America/New_York',
    gangStyle: {
      primaryColor: '#0a0a1a',
      secondaryColor: '#ff6b35',
      accentColor: '#00d4ff',
      motifs: ['yachts', 'palm_trees', 'strip_clubs', 'ocean', 'lowrider'],
      slang: {
        block: 'strip',
        money: 'bread',
        gun: 'blick',
        police: 'boys',
        run: 'dip',
      },
    },
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Determine which city a coordinate belongs to
 */
export function getCityFromCoordinates(lat: number, lng: number): SupportedCity | null {
  for (const [cityKey, config] of Object.entries(CITY_CONFIGS)) {
    const { bounds } = config;
    if (
      lat >= bounds.south &&
      lat <= bounds.north &&
      lng >= bounds.west &&
      lng <= bounds.east
    ) {
      return cityKey as SupportedCity;
    }
  }
  return null;
}

/**
 * Check if coordinates are within service area
 */
export function isInServiceArea(lat: number, lng: number): boolean {
  return getCityFromCoordinates(lat, lng) !== null;
}

/**
 * Get city config by name
 */
export function getCityConfig(city: SupportedCity): CityConfig {
  return CITY_CONFIGS[city];
}

/**
 * Build Mapbox Geocoding URL
 */
export function buildGeocodeUrl(query: string, options?: {
  limit?: number;
  bbox?: [number, number, number, number];
  types?: string[];
}): string {
  const params = new URLSearchParams({
    access_token: MAPBOX_CONFIG.accessToken,
    limit: String(options?.limit ?? 5),
    country: 'US',
  });
  
  if (options?.bbox) {
    params.set('bbox', options.bbox.join(','));
  }
  
  if (options?.types) {
    params.set('types', options.types.join(','));
  }
  
  const encodedQuery = encodeURIComponent(query);
  return `${MAPBOX_CONFIG.baseUrl}${MAPBOX_CONFIG.geocodingEndpoint}/${encodedQuery}.json?${params}`;
}

/**
 * Build Mapbox Static Image URL
 */
export function buildStaticImageUrl(params: MapboxStaticImageParams): string {
  const {
    coordinates,
    zoom = MAPBOX_CONFIG.defaultImageConfig.zoom,
    width = MAPBOX_CONFIG.defaultImageConfig.width,
    height = MAPBOX_CONFIG.defaultImageConfig.height,
    style = MAPBOX_CONFIG.defaultImageConfig.style,
    highRes = MAPBOX_CONFIG.defaultImageConfig.highRes,
  } = params;
  
  const retina = highRes ? '@2x' : '';
  const owner = 'mapbox';
  
  return `${MAPBOX_CONFIG.baseUrl}${MAPBOX_CONFIG.staticImageEndpoint}/${owner}/${style}/static/${coordinates.lng},${coordinates.lat},${zoom}/${width}x${height}${retina}?access_token=${MAPBOX_CONFIG.accessToken}`;
}

/**
 * Build bounding box for a block (approximately 1 city block)
 */
export function buildBlockBounds(lat: number, lng: number, blockSizeMeters: number = 100): {
  north: number;
  south: number;
  east: number;
  west: number;
} {
  // Approximate conversion at US latitudes
  const latOffset = blockSizeMeters / 111320;
  const lngOffset = blockSizeMeters / (111320 * Math.cos(lat * Math.PI / 180));
  
  return {
    north: lat + latOffset / 2,
    south: lat - latOffset / 2,
    east: lng + lngOffset / 2,
    west: lng - lngOffset / 2,
  };
}

/**
 * Generate a deterministic hash for caching
 */
export function generateBlockHash(lat: number, lng: number, precision: number = 6): string {
  const roundedLat = lat.toFixed(precision);
  const roundedLng = lng.toFixed(precision);
  return `block_${roundedLat}_${roundedLng}`;
}
