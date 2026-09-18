import { getDNAById, CURRENT_RESOLVER_CATALOG_VERSION } from '../../config/blockDNA';
import { generateGridForZoneLayout } from '../../stores/blockStore';
import { buildZoneLayout } from '../../utils/blockDNAResolver';
import type { BlockData } from '../../types/block.types';
import type { CraftedDrug } from '../../stores/useDrugInventory';
import {
  BLOCK_LOOP_IDS,
  type LoopMember,
  type LoopState,
} from './blockLoopTypes';

export const BLOCK_LOOP_PRODUCT: CraftedDrug = {
  id: BLOCK_LOOP_IDS.productId,
  name: 'River Cut',
  tier: 'street',
  quality: 62,
  quantity: 12,
  craftedAt: 1_700_000_000_000,
  effects: ['fast-ticket'],
};

export const BLOCK_LOOP_MEMBERS: LoopMember[] = [
  {
    id: BLOCK_LOOP_IDS.dealerId,
    name: 'Lil Dre',
    nickname: 'Dre',
    role: 'dealer',
    level: 2,
    morale: 85,
    health: 100,
    maxHealth: 100,
    equipment: 'none',
    assignment: 'unassigned',
  },
  {
    id: BLOCK_LOOP_IDS.shooterId,
    name: 'Big Rome',
    nickname: 'Rome',
    role: 'shooter',
    level: 3,
    morale: 80,
    health: 100,
    maxHealth: 100,
    equipment: 'sidearm',
    assignment: 'unassigned',
  },
];

export function createAuthoritativeLoopBlock(): BlockData {
  const dna = getDNAById(BLOCK_LOOP_IDS.dnaId);
  if (!dna) {
    throw new Error('Las Olas Block DNA is missing from the catalog.');
  }
  const zoneLayout = buildZoneLayout(dna);
  const grid = generateGridForZoneLayout(zoneLayout);
  return {
    id: BLOCK_LOOP_IDS.blockId,
    address: `${dna.address}, ${dna.city}`,
    lat: dna.lat,
    lng: dna.lng,
    owner: 'player',
    ownerGangName: 'The Demo Crew',
    grid,
    gridSource: 'dna-fallback',
    placements: [],
    incomePerTick: 0,
    heat: dna.startingHeat,
    morale: dna.startingMorale,
    members: 0,
    viewMode: 'topdown',
    pendingIncome: 0,
    dnaId: dna.id,
    incomeMultiplier: dna.incomeMultiplier,
    heatDecayMultiplier: dna.heatDecayMultiplier,
    maxMembers: dna.maxMembers,
    globalCoverBonus: dna.globalCoverBonus,
    topdownBgUrl: '/assets/runtime/generated/environments/topdown/block_lasolas_topdown_v001.webp',
    streetBackdropUrl: '/assets/runtime/generated/environments/street/block_lasolas_driveby_street_v001.webp',
  };
}

export function createLoopState(overrides: Partial<LoopState> = {}): LoopState {
  const block = overrides.block ?? createAuthoritativeLoopBlock();
  return {
    phase: 'crew',
    dnaId: BLOCK_LOOP_IDS.dnaId,
    catalogVersion: CURRENT_RESOLVER_CATALOG_VERSION,
    block,
    members: BLOCK_LOOP_MEMBERS.map((member) => ({ ...member })),
    selectedDealerId: null,
    selectedShooterId: null,
    inventory: [{ ...BLOCK_LOOP_PRODUCT }],
    assignments: {},
    money: 12000,
    playerHeat: 5,
    reputation: 12,
    lastDeal: null,
    threat: null,
    lastEncounter: null,
    appliedEncounterKeys: [],
    economyKeys: [],
    pendingHealthIds: [],
    briefing: [
      'Fictional 1208 Las Olas is claimed. DNA card las-olas-1208 owns this board.',
      'Select Lil Dre and Big Rome, then place them on legal cells.',
    ],
    recovery: null,
    rejection: null,
    mapFallbackNotice: 'Street map imagery is optional. The Strip board stays playable if recon tiles fail.',
    ...overrides,
  };
}
