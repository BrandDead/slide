/**
 * DEALT/SLIDE - Grid Generator
 * Converts real-world location data into playable tactical grids
 * 
 * Grid Layout (8x8 default):
 * Row 0-1: Top Sidewalk (defender territory)
 * Row 2-5: Street (drive-by path)
 * Row 6-7: Bottom Sidewalk (defender territory)
 */

import type {
  BlockGrid,
  GridTile,
  TileType,
  TileFeature,
  FeatureType,
  GridGenerationConfig,
  GridGenerationResult,
  TileGenerationContext,
  Coordinates,
  SupportedCity,
} from '../types/location.types';

import { getCityConfig } from '../config/mapbox.config';

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export const DEFAULT_GRID_CONFIG: GridGenerationConfig = {
  gridWidth: 8,
  gridHeight: 8,
  streetWidth: 4,      // Rows 2-5
  sidewalkWidth: 2,    // Rows 0-1 and 6-7
  featureDensity: 0.3, // 30% of tiles have features
  coverBias: 0.5,      // Balanced cover distribution
};

// ============================================================================
// FEATURE DEFINITIONS
// ============================================================================

const FEATURE_CONFIGS: Record<FeatureType, {
  coverBonus: number;
  visibilityPenalty: number;
  destructible: boolean;
  health?: number;
  spawnWeight: number;
  validTileTypes: TileType[];
}> = {
  dumpster: {
    coverBonus: 0.7,
    visibilityPenalty: 0.3,
    destructible: false,
    spawnWeight: 8,
    validTileTypes: ['sidewalk', 'alley'],
  },
  parked_car: {
    coverBonus: 0.6,
    visibilityPenalty: 0.2,
    destructible: true,
    health: 100,
    spawnWeight: 15,
    validTileTypes: ['street', 'parking'],
  },
  mailbox: {
    coverBonus: 0.3,
    visibilityPenalty: 0.1,
    destructible: true,
    health: 30,
    spawnWeight: 10,
    validTileTypes: ['sidewalk'],
  },
  fire_hydrant: {
    coverBonus: 0.2,
    visibilityPenalty: 0.05,
    destructible: false,
    spawnWeight: 8,
    validTileTypes: ['sidewalk'],
  },
  streetlight: {
    coverBonus: 0.1,
    visibilityPenalty: -0.2, // Increases visibility at night
    destructible: true,
    health: 50,
    spawnWeight: 12,
    validTileTypes: ['sidewalk'],
  },
  bench: {
    coverBonus: 0.25,
    visibilityPenalty: 0.1,
    destructible: true,
    health: 40,
    spawnWeight: 6,
    validTileTypes: ['sidewalk'],
  },
  trash_can: {
    coverBonus: 0.2,
    visibilityPenalty: 0.05,
    destructible: true,
    health: 20,
    spawnWeight: 12,
    validTileTypes: ['sidewalk'],
  },
  newspaper_box: {
    coverBonus: 0.15,
    visibilityPenalty: 0.05,
    destructible: true,
    health: 25,
    spawnWeight: 6,
    validTileTypes: ['sidewalk'],
  },
  phone_booth: {
    coverBonus: 0.5,
    visibilityPenalty: 0.2,
    destructible: true,
    health: 60,
    spawnWeight: 3,
    validTileTypes: ['sidewalk'],
  },
  bus_stop: {
    coverBonus: 0.4,
    visibilityPenalty: 0.15,
    destructible: false,
    spawnWeight: 4,
    validTileTypes: ['sidewalk'],
  },
  barricade: {
    coverBonus: 0.8,
    visibilityPenalty: 0.4,
    destructible: true,
    health: 150,
    spawnWeight: 2,
    validTileTypes: ['street', 'sidewalk'],
  },
  crate: {
    coverBonus: 0.35,
    visibilityPenalty: 0.15,
    destructible: true,
    health: 35,
    spawnWeight: 8,
    validTileTypes: ['sidewalk', 'alley'],
  },
  barrel: {
    coverBonus: 0.3,
    visibilityPenalty: 0.1,
    destructible: true,
    health: 30,
    spawnWeight: 6,
    validTileTypes: ['sidewalk', 'alley'],
  },
  scaffold: {
    coverBonus: 0.5,
    visibilityPenalty: 0.3,
    destructible: false,
    spawnWeight: 3,
    validTileTypes: ['sidewalk'],
  },
  vendor_cart: {
    coverBonus: 0.4,
    visibilityPenalty: 0.2,
    destructible: true,
    health: 45,
    spawnWeight: 4,
    validTileTypes: ['sidewalk'],
  },
};

// ============================================================================
// SEEDED RANDOM NUMBER GENERATOR
// ============================================================================

class SeededRandom {
  private seed: number;
  
  constructor(seed: string) {
    // Convert string seed to number using simple hash
    this.seed = this.hashString(seed);
  }
  
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) || 1;
  }
  
  /**
   * Generate next random number between 0 and 1
   */
  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }
  
  /**
   * Generate random integer in range [min, max]
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  
  /**
   * Pick random item from array
   */
  pick<T>(array: T[]): T {
    return array[this.nextInt(0, array.length - 1)];
  }
  
  /**
   * Shuffle array in place
   */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}

// ============================================================================
// GRID GENERATOR
// ============================================================================

export class GridGenerator {
  private config: GridGenerationConfig;
  private rng: SeededRandom;
  private city: SupportedCity;
  private trafficScore: number;
  
  constructor(
    city: SupportedCity,
    trafficScore: number,
    config: Partial<GridGenerationConfig> = {},
    seed?: string
  ) {
    this.config = { ...DEFAULT_GRID_CONFIG, ...config };
    this.city = city;
    this.trafficScore = trafficScore;
    
    // Generate deterministic seed if not provided
    const finalSeed = seed || this.generateSeed();
    this.rng = new SeededRandom(finalSeed);
    this.config.seed = finalSeed;
  }
  
  /**
   * Generate seed from city + traffic (deterministic per location)
   */
  private generateSeed(): string {
    return `${this.city}_${this.trafficScore}_${Date.now()}`;
  }
  
  /**
   * Generate complete grid for a block
   */
  generate(): GridGenerationResult {
    const { gridWidth, gridHeight } = this.config;
    
    // Initialize empty grid
    const tiles: GridTile[][] = [];
    
    // Generate each tile
    for (let y = 0; y < gridHeight; y++) {
      const row: GridTile[] = [];
      for (let x = 0; x < gridWidth; x++) {
        row.push(this.generateTile(x, y));
      }
      tiles.push(row);
    }
    
    // Add features to tiles
    this.populateFeatures(tiles);
    
    // Calculate precomputed data
    const grid = this.buildBlockGrid(tiles);
    
    // Calculate stats
    const stats = this.calculateStats(tiles);
    
    return {
      grid,
      metadata: {
        generatedAt: new Date().toISOString(),
        seed: this.config.seed!,
        config: this.config,
        stats,
      },
    };
  }
  
  /**
   * Generate a single tile
   */
  private generateTile(x: number, y: number): GridTile {
    const type = this.determineTileType(y);
    const subtype = this.determineTileSubtype(x, y, type);
    
    // Base values before features
    const baseCover = this.getBaseCover(type);
    const baseVisibility = this.getBaseVisibility(type);
    
    return {
      x,
      y,
      type,
      subtype: subtype as any,
      cover: baseCover,
      visibility: baseVisibility,
      movementCost: this.getMovementCost(type),
      features: [],
      deployable: this.isDeployable(type, y),
      destructible: false,
    };
  }
  
  /**
   * Determine tile type based on row position
   */
  private determineTileType(y: number): TileType {
    const { gridHeight, sidewalkWidth, streetWidth } = this.config;
    
    // Top sidewalk
    if (y < sidewalkWidth) {
      return 'sidewalk';
    }
    
    // Street
    if (y < sidewalkWidth + streetWidth) {
      return 'street';
    }
    
    // Bottom sidewalk
    return 'sidewalk';
  }
  
  /**
   * Determine tile subtype for special variations
   */
  private determineTileSubtype(x: number, y: number, type: TileType): string | undefined {
    const { gridWidth, sidewalkWidth, streetWidth } = this.config;
    
    if (type === 'sidewalk') {
      // Curb tiles are adjacent to street
      const streetStart = sidewalkWidth;
      const streetEnd = sidewalkWidth + streetWidth - 1;
      
      if (y === streetStart - 1 || y === streetEnd + 1) {
        return 'curb';
      }
    }
    
    if (type === 'street') {
      // Crosswalks at edges
      if (x === 0 || x === gridWidth - 1) {
        return 'crosswalk';
      }
      
      // Median in center (some blocks)
      if (this.rng.next() < 0.3 && x === Math.floor(gridWidth / 2)) {
        return 'median';
      }
    }
    
    return undefined;
  }
  
  /**
   * Get base cover value for tile type
   */
  private getBaseCover(type: TileType): number {
    const baseCovers: Record<TileType, number> = {
      street: 0.0,
      sidewalk: 0.1,
      building: 0.9,
      alley: 0.3,
      parking: 0.05,
      grass: 0.05,
      water: 0.0,
    };
    
    return baseCovers[type];
  }
  
  /**
   * Get base visibility for tile type
   */
  private getBaseVisibility(type: TileType): number {
    const baseVisibility: Record<TileType, number> = {
      street: 1.0,
      sidewalk: 0.9,
      building: 0.3,
      alley: 0.6,
      parking: 0.95,
      grass: 0.85,
      water: 1.0,
    };
    
    return baseVisibility[type];
  }
  
  /**
   * Get movement cost for tile type
   */
  private getMovementCost(type: TileType): number {
    const costs: Record<TileType, number> = {
      street: 1.0,
      sidewalk: 1.0,
      building: 999, // Impassable
      alley: 1.2,
      parking: 1.0,
      grass: 1.3,
      water: 999,
    };
    
    return costs[type];
  }
  
  /**
   * Check if tile can have units deployed
   */
  private isDeployable(type: TileType, y: number): boolean {
    // Only sidewalks are deployable (defender territory)
    if (type !== 'sidewalk') {
      return false;
    }
    
    // Don't deploy on curbs (too exposed)
    const { sidewalkWidth, streetWidth } = this.config;
    const streetStart = sidewalkWidth;
    const streetEnd = sidewalkWidth + streetWidth - 1;
    
    if (y === streetStart - 1 || y === streetEnd + 1) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Populate tiles with features (cover objects)
   */
  private populateFeatures(tiles: GridTile[][]): void {
    const { gridWidth, gridHeight, featureDensity } = this.config;
    
    // Calculate total features to place
    const totalTiles = gridWidth * gridHeight;
    const targetFeatures = Math.floor(totalTiles * featureDensity);
    
    // Get valid feature positions
    const validPositions: { x: number; y: number; type: TileType }[] = [];
    
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const tile = tiles[y][x];
        if (tile.type !== 'building') {
          validPositions.push({ x, y, type: tile.type });
        }
      }
    }
    
    // Shuffle positions
    this.rng.shuffle(validPositions);
    
    // Place features
    let featuresPlaced = 0;
    
    for (const pos of validPositions) {
      if (featuresPlaced >= targetFeatures) break;
      
      const feature = this.selectFeatureForTile(pos.type);
      if (feature) {
        const tile = tiles[pos.y][pos.x];
        tile.features.push(feature);
        
        // Update tile stats based on feature
        tile.cover = Math.min(1, tile.cover + feature.coverBonus);
        tile.visibility = Math.max(0, tile.visibility - feature.visibilityPenalty);
        
        if (feature.destructible) {
          tile.destructible = true;
          tile.health = feature.health;
        }
        
        featuresPlaced++;
      }
    }
    
    // Ensure some minimum cover on sidewalks (gameplay balance)
    this.ensureMinimumCover(tiles);
  }
  
  /**
   * Select appropriate feature for tile type
   */
  private selectFeatureForTile(tileType: TileType): TileFeature | null {
    // Get valid features for this tile type
    const validFeatures = Object.entries(FEATURE_CONFIGS)
      .filter(([_, config]) => config.validTileTypes.includes(tileType));
    
    if (validFeatures.length === 0) {
      return null;
    }
    
    // Weight-based selection
    const totalWeight = validFeatures.reduce((sum, [_, config]) => sum + config.spawnWeight, 0);
    let roll = this.rng.next() * totalWeight;
    
    for (const [featureType, config] of validFeatures) {
      roll -= config.spawnWeight;
      if (roll <= 0) {
        return {
          type: featureType as FeatureType,
          coverBonus: config.coverBonus,
          visibilityPenalty: config.visibilityPenalty,
          destructible: config.destructible,
          health: config.health,
          lootable: featureType === 'vendor_cart' || featureType === 'crate',
          interactable: featureType === 'parked_car' || featureType === 'phone_booth',
        };
      }
    }
    
    return null;
  }
  
  /**
   * Ensure sidewalks have minimum cover for gameplay
   */
  private ensureMinimumCover(tiles: GridTile[][]): void {
    const { gridWidth, gridHeight, sidewalkWidth, streetWidth } = this.config;
    const minCoverPerSidewalk = 2;
    
    // Check top sidewalk
    let topCoverCount = 0;
    for (let y = 0; y < sidewalkWidth; y++) {
      for (let x = 0; x < gridWidth; x++) {
        if (tiles[y][x].cover >= 0.3) {
          topCoverCount++;
        }
      }
    }
    
    // Add cover if needed
    if (topCoverCount < minCoverPerSidewalk) {
      this.addForcedCover(tiles, 0, sidewalkWidth - 1, minCoverPerSidewalk - topCoverCount);
    }
    
    // Check bottom sidewalk
    let bottomCoverCount = 0;
    const bottomStart = sidewalkWidth + streetWidth;
    for (let y = bottomStart; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        if (tiles[y][x].cover >= 0.3) {
          bottomCoverCount++;
        }
      }
    }
    
    if (bottomCoverCount < minCoverPerSidewalk) {
      this.addForcedCover(tiles, bottomStart, gridHeight - 1, minCoverPerSidewalk - bottomCoverCount);
    }
  }
  
  /**
   * Force add cover features to a row range
   */
  private addForcedCover(tiles: GridTile[][], yStart: number, yEnd: number, count: number): void {
    const { gridWidth } = this.config;
    const candidates: { x: number; y: number }[] = [];
    
    for (let y = yStart; y <= yEnd; y++) {
      for (let x = 0; x < gridWidth; x++) {
        if (tiles[y][x].features.length === 0) {
          candidates.push({ x, y });
        }
      }
    }
    
    this.rng.shuffle(candidates);
    
    for (let i = 0; i < Math.min(count, candidates.length); i++) {
      const pos = candidates[i];
      const tile = tiles[pos.y][pos.x];
      
      // Add a dumpster (reliable cover)
      const feature: TileFeature = {
        type: 'dumpster',
        coverBonus: 0.7,
        visibilityPenalty: 0.3,
        destructible: false,
      };
      
      tile.features.push(feature);
      tile.cover = Math.min(1, tile.cover + feature.coverBonus);
      tile.visibility = Math.max(0, tile.visibility - feature.visibilityPenalty);
    }
  }
  
  /**
   * Build final BlockGrid structure with precomputed data
   */
  private buildBlockGrid(tiles: GridTile[][]): BlockGrid {
    const { gridWidth, gridHeight, sidewalkWidth, streetWidth } = this.config;
    
    // Calculate street rows
    const streetRow: number[] = [];
    for (let y = sidewalkWidth; y < sidewalkWidth + streetWidth; y++) {
      streetRow.push(y);
    }
    
    // Calculate sidewalk rows
    const topSidewalk: number[] = [];
    for (let y = 0; y < sidewalkWidth; y++) {
      topSidewalk.push(y);
    }
    
    const bottomSidewalk: number[] = [];
    for (let y = sidewalkWidth + streetWidth; y < gridHeight; y++) {
      bottomSidewalk.push(y);
    }
    
    // Calculate spawn points
    const attackerEntry: Coordinates[] = [
      { lat: 0, lng: 0 }, // Left side of street
    ];
    const attackerExit: Coordinates[] = [
      { lat: gridWidth - 1, lng: 0 }, // Right side of street
    ];
    const defenderSpawns: Coordinates[] = [];
    
    // Find deployable tiles
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        if (tiles[y][x].deployable) {
          defenderSpawns.push({ lat: x, lng: y });
        }
      }
    }
    
    return {
      width: gridWidth,
      height: gridHeight,
      tiles,
      streetRow,
      sidewalkRows: {
        top: topSidewalk,
        bottom: bottomSidewalk,
      },
      spawnPoints: {
        attackerEntry,
        attackerExit,
        defenderSpawns,
      },
    };
  }
  
  /**
   * Calculate grid statistics
   */
  private calculateStats(tiles: GridTile[][]): GridGenerationResult['metadata']['stats'] {
    const { gridWidth, gridHeight } = this.config;
    
    let streetTiles = 0;
    let sidewalkTiles = 0;
    let buildingTiles = 0;
    let featureCount = 0;
    let totalCover = 0;
    let totalVisibility = 0;
    
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const tile = tiles[y][x];
        
        if (tile.type === 'street') streetTiles++;
        if (tile.type === 'sidewalk') sidewalkTiles++;
        if (tile.type === 'building') buildingTiles++;
        
        featureCount += tile.features.length;
        totalCover += tile.cover;
        totalVisibility += tile.visibility;
      }
    }
    
    const totalTiles = gridWidth * gridHeight;
    
    return {
      totalTiles,
      streetTiles,
      sidewalkTiles,
      buildingTiles,
      featureCount,
      averageCover: totalCover / totalTiles,
      averageVisibility: totalVisibility / totalTiles,
    };
  }
}

// ============================================================================
// CONVENIENCE FUNCTION
// ============================================================================

/**
 * Generate a grid for a block
 */
export function generateBlockGrid(
  city: SupportedCity,
  trafficScore: number,
  options?: {
    config?: Partial<GridGenerationConfig>;
    seed?: string;
  }
): GridGenerationResult {
  const generator = new GridGenerator(
    city,
    trafficScore,
    options?.config,
    options?.seed
  );
  
  return generator.generate();
}

/**
 * Regenerate grid with new seed (for block refresh)
 */
export function regenerateGrid(
  city: SupportedCity,
  trafficScore: number,
  config?: Partial<GridGenerationConfig>
): GridGenerationResult {
  const generator = new GridGenerator(city, trafficScore, config);
  return generator.generate();
}
