import { resolveBlockDNA } from '../../utils/blockDNAResolver';
import type { BlockData, BlockPlacement, BlockZoneType } from '../../types/block.types';
import type {
  CombatTerrainCell,
  Combatant,
  EncounterPreparation,
  GridPoint,
} from './types';

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededIndex(seed: number, index: number, modulo: number): number {
  const value = Math.imul(seed ^ (index + 1) * 0x9e3779b9, 0x85ebca6b) >>> 0;
  return value % modulo;
}

const DNA_ZONE_PROFILE: Record<BlockZoneType, { cover: number; exposure: number; passable: boolean }> = {
  street: { cover: 0.05, exposure: 0.95, passable: false },
  curb: { cover: 0.15, exposure: 0.8, passable: true },
  sidewalk: { cover: 0.3, exposure: 0.5, passable: true },
  storefront: { cover: 0.6, exposure: 0.25, passable: true },
  alley: { cover: 0.8, exposure: 0.1, passable: true },
  parking: { cover: 0.35, exposure: 0.4, passable: true },
  rooftop: { cover: 0.9, exposure: 0.05, passable: true },
  building: { cover: 1, exposure: 0, passable: false },
};

function toTerrain(block: BlockData, coverBonus: number, zoneLayout: BlockZoneType[]): CombatTerrainCell[][] {
  return block.grid.map((row) => row.map((zone) => {
    const zoneType = zoneLayout[zone.y] ?? zone.zoneType;
    const profile = DNA_ZONE_PROFILE[zoneType];
    return {
      x: zone.x,
      y: zone.y,
      zoneType,
      passable: zone.passable && profile.passable,
      cover: Math.max(0, Math.min(1, Math.max(zone.coverScore, profile.cover) + coverBonus)),
      exposure: Math.max(0, Math.min(1, Math.min(zone.exposureRisk / 100, profile.exposure))),
    };
  }));
}

function toCrew(placements: BlockPlacement[]): Combatant[] {
  return placements
    .filter((placement) => placement.health > 0)
    .slice(0, 4)
    .map((placement) => ({
      id: placement.memberId,
      name: placement.memberName,
      team: 'crew' as const,
      role: placement.role,
      position: { x: placement.x, y: placement.y },
      health: Math.max(1, placement.health),
      maxHealth: 100,
      armor: placement.role === 'enforcer' ? 2 : placement.role === 'shooter' ? 1 : 0,
      ammo: placement.role === 'shooter' ? 8 + placement.level : 5 + placement.level,
      maxAmmo: placement.role === 'shooter' ? 8 + placement.level : 5 + placement.level,
      reloadUntilTick: null,
      nextFireTick: 0,
      level: Math.max(1, placement.level),
      lastSequence: -1,
      isDown: false,
    }));
}

function findSafePoint(terrain: CombatTerrainCell[][]): CombatTerrainCell {
  return terrain
    .flat()
    .filter((cell) => cell.passable)
    .sort((left, right) => (right.cover - left.cover) || (left.exposure - right.exposure))[0] ?? {
      x: 0,
      y: 0,
      zoneType: 'sidewalk',
      passable: true,
      cover: 0,
      exposure: 1,
    };
}

function findExtractionPoint(terrain: CombatTerrainCell[][], origin: GridPoint): CombatTerrainCell {
  return terrain
    .flat()
    .filter((cell) => cell.passable && (cell.x !== origin.x || cell.y !== origin.y))
    .sort((left, right) => {
      const leftDistance = Math.abs(left.x - origin.x) + Math.abs(left.y - origin.y);
      const rightDistance = Math.abs(right.x - origin.x) + Math.abs(right.y - origin.y);
      const leftScore = leftDistance * 10 + (7 - left.y) * 5 + left.cover * 3 - left.exposure;
      const rightScore = rightDistance * 10 + (7 - right.y) * 5 + right.cover * 3 - right.exposure;
      return rightScore - leftScore;
    })[0] ?? findSafePoint(terrain);
}

function findOppositionStart(terrain: CombatTerrainCell[][], seed: number, index: number): GridPoint {
  const cells = terrain
    .flat()
    .filter((cell) => cell.passable && cell.y <= 3)
    .sort((left, right) => right.exposure - left.exposure);
  return cells[seededIndex(seed, index, Math.max(cells.length, 1))] ?? { x: 0, y: 0 };
}

export function prepareEncounter(block: BlockData): EncounterPreparation {
  const resolved = resolveBlockDNA(block.lat, block.lng, block.address);
  const seed = hashString(`${block.id}:${resolved.seed}:${block.heat}:${block.morale}`);
  const terrain = toTerrain(block, resolved.dna.globalCoverBonus, resolved.zoneLayout);
  const crew = toCrew(block.placements);
  const fallbackCrew: Combatant[] = crew.length > 0 ? crew : [{
    id: 'crew-scout',
    name: 'Scout',
    team: 'crew',
    role: 'recruit',
    position: findSafePoint(terrain),
    health: 80,
    maxHealth: 80,
    armor: 0,
    ammo: 6,
    maxAmmo: 6,
    reloadUntilTick: null,
    nextFireTick: 0,
    level: 1,
    lastSequence: -1,
    isDown: false,
  }];
  const oppositionCount = Math.min(4, Math.max(2, 1 + Math.ceil(block.heat / 2)));
  const opposition = Array.from({ length: oppositionCount }, (_, index) => ({
    id: `opposition-${index + 1}`,
    name: index === 0 ? 'Lookout' : `Rival ${index + 1}`,
    team: 'opposition' as const,
    role: 'opposition' as const,
    position: findOppositionStart(terrain, seed, index),
    health: index === 0 ? 70 : 55,
    maxHealth: index === 0 ? 70 : 55,
    armor: 0,
    ammo: 7,
    maxAmmo: 7,
    reloadUntilTick: null,
    nextFireTick: 0,
    level: 1 + Math.floor(block.heat / 3),
    lastSequence: -1,
    isDown: false,
  }));
  const extraction = findExtractionPoint(terrain, fallbackCrew[0].position);
  const coverPercent = Math.round(extraction.cover * 100);
  const exposurePercent = Math.round(extraction.exposure * 100);

  return {
    sessionId: `encounter-${block.id}-${seed.toString(36)}`,
    seed,
    sceneLabel: resolved.dna.name,
    locationReference: block.address,
    fictionNotice: 'This scene is a fictionalized, gameplay-only interpretation of local street character.',
    backgroundUrl: block.topdownBgUrl ?? block.streetBackdropUrl,
    terrain,
    crew: fallbackCrew,
    opposition,
    objective: {
      kind: 'extract',
      label: 'Reach the secure exit with your active crew',
      extraction,
      requiredCrew: 1,
      progress: 0,
      target: 1,
    },
    heatAtStart: block.heat,
    moraleAtStart: block.morale,
    tacticalBrief: [
      `${resolved.dna.name} is shaped by ${resolved.dna.tags.join(' · ')} terrain cues.`,
      `Secure exit has ${coverPercent}% cover and ${exposurePercent}% exposure.`,
      `Current pressure: heat ${block.heat}/5 · morale ${block.morale}%.`,
      'Placement, cover, and crew condition carry directly into this encounter.',
    ],
  };
}
