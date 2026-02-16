/**
 * DEALT/SLIDE - Location Service
 * Handles Mapbox API integration, address search, and block claiming
 */

import {
  MAPBOX_CONFIG,
  buildGeocodeUrl,
  buildStaticImageUrl,
  buildBlockBounds,
  getCityFromCoordinates,
  isInServiceArea,
  generateBlockHash,
  getCityConfig,
} from '../config/mapbox.config';

import type {
  Coordinates,
  MapboxGeocodeResponse,
  MapboxFeature,
  Block,
  BlockClaimRequest,
  BlockClaimResponse,
  BlockPreview,
  LocationSearchResult,
  AddressSuggestion,
  SupportedCity,
} from '../types/location.types';

// ============================================================================
// CACHE IMPLEMENTATION
// ============================================================================

class LocationCache {
  private geocodeCache = new Map<string, { data: MapboxGeocodeResponse; timestamp: number }>();
  private blockCache = new Map<string, { data: Block; timestamp: number }>();
  
  setGeocode(query: string, data: MapboxGeocodeResponse): void {
    this.geocodeCache.set(query.toLowerCase(), {
      data,
      timestamp: Date.now(),
    });
  }
  
  getGeocode(query: string): MapboxGeocodeResponse | null {
    const entry = this.geocodeCache.get(query.toLowerCase());
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > MAPBOX_CONFIG.geocodeCacheTTL) {
      this.geocodeCache.delete(query.toLowerCase());
      return null;
    }
    
    return entry.data;
  }
  
  setBlock(hash: string, data: Block): void {
    this.blockCache.set(hash, {
      data,
      timestamp: Date.now(),
    });
  }
  
  getBlock(hash: string): Block | null {
    const entry = this.blockCache.get(hash);
    if (!entry) return null;
    
    // Blocks don't expire from local cache (server is source of truth)
    return entry.data;
  }
  
  clear(): void {
    this.geocodeCache.clear();
    this.blockCache.clear();
  }
}

const cache = new LocationCache();

// ============================================================================
// RATE LIMITER
// ============================================================================

class RateLimiter {
  private timestamps: number[] = [];
  private maxRequests: number;
  private windowMs: number;
  
  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }
  
  async acquire(): Promise<void> {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);
    
    if (this.timestamps.length >= this.maxRequests) {
      const oldestAllowed = now - this.windowMs;
      const waitTime = this.timestamps[0] - oldestAllowed + 50;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.acquire();
    }
    
    this.timestamps.push(now);
  }
}

const rateLimiter = new RateLimiter(MAPBOX_CONFIG.requestsPerSecond, 1000);

// ============================================================================
// LOCATION SERVICE
// ============================================================================

export class LocationService {
  private static instance: LocationService;
  private apiBaseUrl: string;
  
  private constructor() {
    this.apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
  }
  
  static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }
  
  // ==========================================================================
  // ADDRESS SEARCH
  // ==========================================================================
  
  /**
   * Search for addresses with autocomplete
   */
  async searchAddress(query: string): Promise<LocationSearchResult> {
    if (!query || query.length < 3) {
      return { suggestions: [], query, cached: false };
    }
    
    // Check cache first
    const cached = cache.getGeocode(query);
    if (cached) {
      return {
        suggestions: this.mapFeaturesToSuggestions(cached.features),
        query,
        cached: true,
      };
    }
    
    await rateLimiter.acquire();
    
    try {
      const url = buildGeocodeUrl(query, {
        limit: 5,
        types: ['address', 'poi'],
      });
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Geocoding failed: ${response.status}`);
      }
      
      const data: MapboxGeocodeResponse = await response.json();
      cache.setGeocode(query, data);
      
      return {
        suggestions: this.mapFeaturesToSuggestions(data.features),
        query,
        cached: false,
      };
    } catch (error) {
      console.error('Address search failed:', error);
      return { suggestions: [], query, cached: false };
    }
  }
  
  /**
   * Convert Mapbox features to our suggestion format
   */
  private mapFeaturesToSuggestions(features: MapboxFeature[]): AddressSuggestion[] {
    return features.map(feature => {
      const [lng, lat] = feature.center;
      const city = getCityFromCoordinates(lat, lng);
      
      return {
        address: feature.text,
        formattedAddress: feature.place_name,
        coordinates: { lat, lng },
        city,
        inServiceArea: city !== null,
        mapboxId: feature.properties.mapbox_id,
      };
    });
  }
  
  /**
   * Get detailed location info for a specific address
   */
  async geocodeAddress(address: string): Promise<AddressSuggestion | null> {
    const result = await this.searchAddress(address);
    return result.suggestions[0] || null;
  }
  
  // ==========================================================================
  // BLOCK PREVIEW
  // ==========================================================================
  
  /**
   * Generate a preview of a block before claiming
   */
  async getBlockPreview(coordinates: Coordinates): Promise<BlockPreview | null> {
    const city = getCityFromCoordinates(coordinates.lat, coordinates.lng);
    
    if (!city) {
      return null;
    }
    
    // Get satellite image URL
    const satelliteImageUrl = buildStaticImageUrl({
      coordinates,
      zoom: 18,
      width: 512,
      height: 512,
      style: 'satellite-streets-v12',
      highRes: true,
    });
    
    // Estimate traffic based on location (simplified - real version would use more data)
    const estimatedTraffic = this.estimateTrafficScore(coordinates, city);
    const estimatedIncome = Math.round(estimatedTraffic * 10); // $10 per traffic point per hour
    
    // Check if block is available (call backend)
    const blockHash = generateBlockHash(coordinates.lat, coordinates.lng);
    const availability = await this.checkBlockAvailability(blockHash);
    
    // Reverse geocode to get address
    const url = buildGeocodeUrl(`${coordinates.lng},${coordinates.lat}`, {
      limit: 1,
      types: ['address'],
    });
    
    let address = `${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)}`;
    
    try {
      await rateLimiter.acquire();
      const response = await fetch(url);
      if (response.ok) {
        const data: MapboxGeocodeResponse = await response.json();
        if (data.features[0]) {
          address = data.features[0].place_name;
        }
      }
    } catch (error) {
      console.error('Reverse geocode failed:', error);
    }
    
    return {
      address,
      coordinates,
      city,
      satelliteImageUrl,
      estimatedTraffic,
      estimatedIncome,
      isAvailable: availability.isAvailable,
      currentOwner: availability.currentOwner,
    };
  }
  
  /**
   * Estimate traffic score based on location characteristics
   */
  private estimateTrafficScore(coordinates: Coordinates, city: SupportedCity): number {
    // Base score varies by city (simplified model)
    const cityBaseScores: Record<SupportedCity, number> = {
      nyc: 70,
      la: 55,
      miami: 60,
      chicago: 50,
      detroit: 35,
      nola: 45,
    };
    
    const baseScore = cityBaseScores[city];
    
    // Add some randomness based on coordinates (deterministic)
    const hash = Math.abs(
      Math.sin(coordinates.lat * 12345) * 10000 +
      Math.cos(coordinates.lng * 67890) * 10000
    );
    const variance = (hash % 30) - 15; // -15 to +15
    
    return Math.max(10, Math.min(100, baseScore + variance));
  }
  
  /**
   * Check if a block is available for claiming
   */
  private async checkBlockAvailability(blockHash: string): Promise<{
    isAvailable: boolean;
    currentOwner?: { gangName: string; claimedAt: string };
  }> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/blocks/availability/${blockHash}`);
      
      if (!response.ok) {
        // Assume available if we can't check
        return { isAvailable: true };
      }
      
      return await response.json();
    } catch (error) {
      console.error('Availability check failed:', error);
      return { isAvailable: true };
    }
  }
  
  // ==========================================================================
  // BLOCK CLAIMING
  // ==========================================================================
  
  /**
   * Claim a block for the player
   */
  async claimBlock(request: BlockClaimRequest): Promise<BlockClaimResponse> {
    try {
      // First, geocode the address if needed
      const location = await this.geocodeAddress(request.address);
      
      if (!location) {
        return {
          success: false,
          error: 'Could not find address',
          reason: 'invalid_address',
        };
      }
      
      if (!location.inServiceArea) {
        return {
          success: false,
          error: `Address is outside service area. We currently support: NYC, LA, Miami, Chicago, Detroit, and New Orleans.`,
          reason: 'outside_service_area',
        };
      }
      
      // Call backend to claim
      const response = await fetch(`${this.apiBaseUrl}/blocks/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`,
        },
        body: JSON.stringify({
          address: location.formattedAddress,
          coordinates: location.coordinates,
          city: location.city,
          userId: request.userId,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: error.message || 'Failed to claim block',
          reason: error.reason,
        };
      }
      
      const block: Block = await response.json();
      
      // Cache the block
      const blockHash = generateBlockHash(block.coordinates.lat, block.coordinates.lng);
      cache.setBlock(blockHash, block);
      
      return {
        success: true,
        block,
      };
    } catch (error) {
      console.error('Block claim failed:', error);
      return {
        success: false,
        error: 'Network error - please try again',
      };
    }
  }
  
  // ==========================================================================
  // SATELLITE IMAGERY
  // ==========================================================================
  
  /**
   * Get satellite image URL for coordinates
   */
  getSatelliteImageUrl(coordinates: Coordinates, options?: {
    zoom?: number;
    width?: number;
    height?: number;
  }): string {
    return buildStaticImageUrl({
      coordinates,
      zoom: options?.zoom ?? 18,
      width: options?.width ?? 512,
      height: options?.height ?? 512,
      style: 'satellite-v9',
      highRes: true,
    });
  }
  
  /**
   * Get street map overlay URL
   */
  getStreetMapUrl(coordinates: Coordinates, options?: {
    zoom?: number;
    width?: number;
    height?: number;
  }): string {
    return buildStaticImageUrl({
      coordinates,
      zoom: options?.zoom ?? 18,
      width: options?.width ?? 512,
      height: options?.height ?? 512,
      style: 'dark-v11',
      highRes: true,
    });
  }
  
  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================
  
  /**
   * Get auth token from storage
   */
  private getAuthToken(): string {
    return localStorage.getItem('auth_token') || '';
  }
  
  /**
   * Get all supported cities
   */
  getSupportedCities(): { code: SupportedCity; name: string }[] {
    return [
      { code: 'nyc', name: 'New York City' },
      { code: 'la', name: 'Los Angeles' },
      { code: 'miami', name: 'Miami' },
      { code: 'chicago', name: 'Chicago' },
      { code: 'detroit', name: 'Detroit' },
      { code: 'nola', name: 'New Orleans' },
    ];
  }
  
  /**
   * Check if location is within city bounds
   */
  isWithinCity(coordinates: Coordinates, city: SupportedCity): boolean {
    const config = getCityConfig(city);
    const { bounds } = config;
    
    return (
      coordinates.lat >= bounds.south &&
      coordinates.lat <= bounds.north &&
      coordinates.lng >= bounds.west &&
      coordinates.lng <= bounds.east
    );
  }
  
  /**
   * Calculate distance between two points (Haversine formula)
   */
  calculateDistance(point1: Coordinates, point2: Coordinates): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (point1.lat * Math.PI) / 180;
    const φ2 = (point2.lat * Math.PI) / 180;
    const Δφ = ((point2.lat - point1.lat) * Math.PI) / 180;
    const Δλ = ((point2.lng - point1.lng) * Math.PI) / 180;
    
    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c; // Distance in meters
  }
  
  /**
   * Clear all caches
   */
  clearCache(): void {
    cache.clear();
  }
}

// Export singleton
export const locationService = LocationService.getInstance();
