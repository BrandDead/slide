/**
 * Gate 0B contracts — geometry vs live state vs attack freeze.
 * Geometry decides gameplay; AI pixels decide atmosphere only.
 */

export type SceneStatus =
  | 'queued'
  | 'extracting'
  | 'rendering'
  | 'generating'
  | 'validating'
  | 'review'
  | 'ready'
  | 'failed'
  | 'fallback';

export type ContractZoneType =
  | 'street'
  | 'curb'
  | 'sidewalk'
  | 'storefront'
  | 'alley'
  | 'parking'
  | 'rooftop'
  | 'building';

export interface SceneExtent {
  widthM: number;
  heightM: number;
  rotationBearingDeg: number;
  centerLat: number;
  centerLng: number;
  bounds: {
    north?: number;
    south?: number;
    east?: number;
    west?: number;
  };
}

export interface SceneAnchor {
  id: string;
  localXM: number;
  localYM: number;
  normalizedX: number;
  normalizedY: number;
  zoneType: ContractZoneType;
  facingDeg: number;
  payoutMultiplier: number;
  riskMultiplier: number;
  cover: number;
  playable: boolean;
}

/** Immutable physical board version. */
export interface BlockSceneManifest {
  blockId: string;
  sceneVersion: string;
  status: SceneStatus;
  addressDisplay: string;
  addressCanonical: string | null;
  geocoderFeatureId: string | null;
  extent: SceneExtent;
  gridWidth: number;
  gridHeight: number;
  cellSizeM: number;
  anchors: SceneAnchor[];
  gridZoneTypes: ContractZoneType[][];
  topdownTextureUrl: string | null;
  streetStripUrl: string | null;
  provenance: Record<string, unknown>;
  createdAt: string;
}

export interface LivePlacement {
  memberId: string;
  anchorId: string;
  role: string;
  localOffsetXM: number;
  localOffsetYM: number;
  facingDeg: number;
  health: number;
  loadout: Record<string, unknown>;
  /** Transitional 8×8 grid coords until Gate 3 anchors are authoritative. */
  gridX?: number;
  gridY?: number;
}

/** Mutable ownership / crew / economy. */
export interface LiveBlockState {
  blockId: string;
  sceneVersion: string;
  revision: number;
  ownerId: string;
  claimStatus: 'owned' | 'npc' | 'unclaimed' | 'contested';
  placements: LivePlacement[];
  heat: number;
  morale: number;
  pendingIncome: number;
  incomePerTick: number;
  updatedAt: string;
}

/** Immutable defender board frozen at attack start. */
export interface AttackSnapshot {
  attackId: string;
  blockId: string;
  sceneVersion: string;
  liveRevision: number;
  rulesVersion: string;
  seed: string;
  startedAt: string;
  defenderPlacements: LivePlacement[];
  attackerLoadout: Record<string, unknown>;
  civilianSeed: string;
  weather: string;
}

export function gridCellToAnchorId(x: number, y: number): string {
  return `cell-${x}-${y}`;
}

export function createAttackSnapshot(input: {
  attackId: string;
  live: LiveBlockState;
  seed: string;
  attackerLoadout?: Record<string, unknown>;
  rulesVersion?: string;
  startedAt?: string;
}): AttackSnapshot {
  return {
    attackId: input.attackId,
    blockId: input.live.blockId,
    sceneVersion: input.live.sceneVersion,
    liveRevision: input.live.revision,
    rulesVersion: input.rulesVersion ?? '0B.1',
    seed: input.seed,
    startedAt: input.startedAt ?? new Date().toISOString(),
    defenderPlacements: input.live.placements.map((p) => ({ ...p })),
    attackerLoadout: input.attackerLoadout ?? {},
    civilianSeed: `${input.seed}-civ`,
    weather: 'clear',
  };
}
