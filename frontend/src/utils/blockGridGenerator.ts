// ═══════════════════════════════════════════════════════════════════════════
// DEALT/SLIDE - Block Grid Generator
// Converts real-world location data into playable tactical grids
// This is the core system that makes real addresses playable
// ═══════════════════════════════════════════════════════════════════════════

import type { 
  BlockGrid, 
  Tile, 
  TileType, 
  EnvironmentTag, 
  BlockMetadata,
  Coordinates 
} from '../types/game.types';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

export interface GridGeneratorConfig {
  width: number;           // Grid width (default 8)
  height: number;          // Grid height (default 8)
  streetRows: number[];    // Which rows are street
  seed?: string;           // For deterministic generation
}

const DEFAULT_CONFIG: GridGeneratorConfig = {
  width: 8,
  height: 8,
  streetRows: [3, 4],      // Middle two rows are street
};

// ─────────────────────────────────────────────────────────────────────────────
// SEEDED RANDOM NUMBER GENERATOR
// Ensures same address always generates same grid
// ─────────────────────────────────────────────────────────────────────────────

class SeededRandom {
  private seed: number;
  
  constructor(seed: string) {
    this.seed = this.hashString(seed);
  }
  
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
  
  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }
  
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  
  nextBool(probability: number = 0.5): boolean {
    return this.next() < probability;
  }
  
  pick<T>(array: T[]): T {
    return array[this.nextInt(0, array.length - 1)];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GRID GENERATOR CLASS
// ─────────────────────────────────────────────────────────────────────────────

export class BlockGridGenerator {
  private config: GridGeneratorConfig;
  private rng: SeededRandom;
  private metadata?: BlockMetadata;
  
  constructor(
    seed: string,
    metadata?: BlockMetadata,
    config: Partial<GridGeneratorConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rng = new SeededRandom(seed);
    this.metadata = metadata;
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // MAIN GENERATION METHOD
  // ─────────────────────────────────────────────────────────────────────────
  
  generate(): BlockGrid {
    const { width, height, streetRows } = this.config;
    
    // Initialize empty grid
    const tiles: Tile[][] = [];
    
    // Determine sidewalk rows (adjacent to street)
    const sidewalkTop = [Math.min(...streetRows) - 1];
    const sidewalkBottom = [Math.max(...streetRows) + 1];
    
    // Generate each tile
    for (let y = 0; y < height; y++) {
      const row: Tile[] = [];
      for (let x = 0; x < width; x++) {
        row.push(this.generateTile(x, y, streetRows, sidewalkTop, sidewalkBottom));
      }
      tiles.push(row);
    }
    
    // Apply post-processing for coherent structures
    this.addAlleys(tiles);
    this.addCornerFeatures(tiles);
    this.balanceCover(tiles);
    
    return {
      width,
      height,
      tiles,
      sidewalkTop,
      sidewalkBottom,
      streetRows,
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // TILE GENERATION
  // ─────────────────────────────────────────────────────────────────────────
  
  private generateTile(
    x: number,
    y: number,
    streetRows: number[],
    sidewalkTop: number[],
    sidewalkBottom: number[]
  ): Tile {
    // Determine base tile type
    let type: TileType;
    let coverScore: number;
    let visibilityScore: number;
    
    const isStreet = streetRows.includes(y);
    const isSidewalkTop = sidewalkTop.includes(y);
    const isSidewalkBottom = sidewalkBottom.includes(y);
    const isEdge = x === 0 || x === this.config.width - 1;
    const isCorner = isEdge && (y === 0 || y === this.config.height - 1);
    
    if (isStreet) {
      type = 'street';
      coverScore = 0.1; // Very low cover on street
      visibilityScore = 0.95; // High visibility
    } else if (isSidewalkTop || isSidewalkBottom) {
      type = 'sidewalk';
      coverScore = this.rng.nextBool(0.3) ? 0.4 : 0.2; // Some sidewalk cover (cars, planters)
      visibilityScore = 0.8;
    } else if (isCorner) {
      type = 'corner';
      coverScore = 0.6;
      visibilityScore = 0.5;
    } else {
      // Building/structure area
      type = this.generateBuildingType();
      coverScore = this.calculateBuildingCover(type);
      visibilityScore = this.calculateBuildingVisibility(type);
    }
    
    // Calculate distance to street
    const distanceToStreet = Math.min(...streetRows.map(r => Math.abs(y - r)));
    
    // Calculate traffic modifier based on position
    const trafficModifier = this.calculateTrafficModifier(x, y, isStreet, isEdge);
    
    // Calculate police risk based on visibility and traffic
    const policeRisk = (visibilityScore * 0.6) + (trafficModifier * 0.4);
    
    // Generate environment tags
    const environmentTags = this.generateEnvironmentTags(
      type, isCorner, isEdge, coverScore, visibilityScore
    );
    
    return {
      x,
      y,
      type,
      coverScore,
      visibilityScore,
      distanceToStreet,
      trafficModifier,
      policeRisk,
      environmentTags,
      occupied: false,
      occupantId: null,
    };
  }
  
  private generateBuildingType(): TileType {
    const zoning = this.metadata?.zoning || 'mixed';
    
    const typeWeights: Record<string, Record<TileType, number>> = {
      residential: { building: 60, storefront: 10, alley: 15, parking: 10, vacant: 5 },
      commercial: { building: 30, storefront: 40, alley: 10, parking: 15, vacant: 5 },
      industrial: { building: 40, storefront: 5, alley: 20, parking: 25, vacant: 10 },
      mixed: { building: 40, storefront: 25, alley: 15, parking: 15, vacant: 5 },
    };
    
    const weights = typeWeights[zoning];
    const roll = this.rng.nextInt(1, 100);
    let cumulative = 0;
    
    for (const [type, weight] of Object.entries(weights)) {
      cumulative += weight;
      if (roll <= cumulative) {
        return type as TileType;
      }
    }
    
    return 'building';
  }
  
  private calculateBuildingCover(type: TileType): number {
    const baseCover: Record<TileType, number> = {
      building: 0.9,
      storefront: 0.5,
      alley: 0.7,
      parking: 0.3,
      vacant: 0.2,
      street: 0.1,
      sidewalk: 0.2,
      corner: 0.6,
    };
    
    const base = baseCover[type] || 0.5;
    // Add some variation
    return Math.min(1, Math.max(0, base + (this.rng.next() - 0.5) * 0.2));
  }
  
  private calculateBuildingVisibility(type: TileType): number {
    const baseVis: Record<TileType, number> = {
      building: 0.3,
      storefront: 0.7,
      alley: 0.4,
      parking: 0.8,
      vacant: 0.9,
      street: 0.95,
      sidewalk: 0.8,
      corner: 0.5,
    };
    
    const base = baseVis[type] || 0.5;
    return Math.min(1, Math.max(0, base + (this.rng.next() - 0.5) * 0.15));
  }
  
  private calculateTrafficModifier(
    x: number, 
    y: number, 
    isStreet: boolean, 
    isEdge: boolean
  ): number {
    let base = 0.3;
    
    if (isStreet) base += 0.4;
    if (isEdge) base += 0.2; // Edge streets have more traffic
    
    // Time-based variation would be added in actual gameplay
    return Math.min(1, base + this.rng.next() * 0.1);
  }
  
  private generateEnvironmentTags(
    type: TileType,
    isCorner: boolean,
    isEdge: boolean,
    cover: number,
    visibility: number
  ): EnvironmentTag[] {
    const tags: EnvironmentTag[] = [];
    
    if (isCorner) tags.push('corner');
    if (type === 'alley') tags.push('alley');
    if (type === 'storefront') tags.push('storefront');
    
    // Zoning-based tags
    const zoning = this.metadata?.zoning;
    if (zoning === 'residential') tags.push('residential');
    else if (zoning === 'commercial') tags.push('commercial');
    else if (zoning === 'industrial') tags.push('industrial');
    
    // Cover/visibility based tags
    if (cover > 0.7) tags.push('cover_heavy');
    if (visibility < 0.4) tags.push('low_visibility');
    if (visibility > 0.8 && cover < 0.3) tags.push('open_area');
    
    // Traffic tag based on metadata
    if (this.metadata?.crimeIndex && this.metadata.crimeIndex > 70) {
      tags.push('high_traffic');
    }
    
    return tags;
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // POST-PROCESSING
  // ─────────────────────────────────────────────────────────────────────────
  
  private addAlleys(tiles: Tile[][]): void {
    if (!this.metadata?.hasAlleys) return;
    
    // Add vertical alley (randomly placed)
    const alleyX = this.rng.nextInt(2, this.config.width - 3);
    
    for (let y = 0; y < tiles.length; y++) {
      const tile = tiles[y][alleyX];
      if (tile.type !== 'street' && tile.type !== 'sidewalk') {
        tile.type = 'alley';
        tile.coverScore = 0.7;
        tile.visibilityScore = 0.4;
        if (!tile.environmentTags.includes('alley')) {
          tile.environmentTags.push('alley');
        }
      }
    }
  }
  
  private addCornerFeatures(tiles: Tile[][]): void {
    if (!this.metadata?.cornerBlock) return;
    
    // Enhance corner tiles with special features
    const corners = [
      [0, 0],
      [0, this.config.height - 1],
      [this.config.width - 1, 0],
      [this.config.width - 1, this.config.height - 1],
    ];
    
    for (const [x, y] of corners) {
      const tile = tiles[y][x];
      tile.type = 'corner';
      tile.coverScore = Math.min(tile.coverScore + 0.2, 1);
      if (!tile.environmentTags.includes('corner')) {
        tile.environmentTags.push('corner');
      }
    }
  }
  
  private balanceCover(tiles: Tile[][]): void {
    // Ensure there's reasonable cover distribution
    // Not too much, not too little
    let totalCover = 0;
    let buildingTiles = 0;
    
    for (const row of tiles) {
      for (const tile of row) {
        if (tile.type !== 'street' && tile.type !== 'sidewalk') {
          totalCover += tile.coverScore;
          buildingTiles++;
        }
      }
    }
    
    const avgCover = totalCover / buildingTiles;
    
    // If average cover is too high or low, adjust
    if (avgCover < 0.4 || avgCover > 0.8) {
      const adjustment = avgCover < 0.4 ? 0.15 : -0.15;
      
      for (const row of tiles) {
        for (const tile of row) {
          if (tile.type !== 'street' && tile.type !== 'sidewalk') {
            tile.coverScore = Math.min(1, Math.max(0, tile.coverScore + adjustment));
          }
        }
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Generate grid from address
// ─────────────────────────────────────────────────────────────────────────────

export async function generateGridFromAddress(
  address: string,
  metadata?: BlockMetadata,
  config?: Partial<GridGeneratorConfig>
): Promise<BlockGrid> {
  // Use address as seed for deterministic generation
  const generator = new BlockGridGenerator(address, metadata, config);
  return generator.generate();
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Generate grid from coordinates
// ─────────────────────────────────────────────────────────────────────────────

export function generateGridFromCoordinates(
  coordinates: Coordinates,
  metadata?: BlockMetadata,
  config?: Partial<GridGeneratorConfig>
): BlockGrid {
  // Use coordinates as seed
  const seed = `${coordinates.lat.toFixed(6)},${coordinates.lng.toFixed(6)}`;
  const generator = new BlockGridGenerator(seed, metadata, config);
  return generator.generate();
}

// ─────────────────────────────────────────────────────────────────────────────
// GRID ANALYSIS HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export function analyzeGrid(grid: BlockGrid): {
  avgCover: number;
  avgVisibility: number;
  alleyCount: number;
  coverHotspots: Array<{ x: number; y: number }>;
  openAreas: Array<{ x: number; y: number }>;
} {
  let totalCover = 0;
  let totalVisibility = 0;
  let alleyCount = 0;
  const coverHotspots: Array<{ x: number; y: number }> = [];
  const openAreas: Array<{ x: number; y: number }> = [];
  let tileCount = 0;
  
  for (const row of grid.tiles) {
    for (const tile of row) {
      totalCover += tile.coverScore;
      totalVisibility += tile.visibilityScore;
      tileCount++;
      
      if (tile.type === 'alley') alleyCount++;
      if (tile.coverScore > 0.8) coverHotspots.push({ x: tile.x, y: tile.y });
      if (tile.coverScore < 0.3 && tile.visibilityScore > 0.7) {
        openAreas.push({ x: tile.x, y: tile.y });
      }
    }
  }
  
  return {
    avgCover: totalCover / tileCount,
    avgVisibility: totalVisibility / tileCount,
    alleyCount,
    coverHotspots,
    openAreas,
  };
}

export default BlockGridGenerator;
