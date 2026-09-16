import type { BlockData, BlockPlacement, BlockZone } from '../../types/block.types';
import type { CraftedDrug, DrugTier } from '../../stores/useDrugInventory';
import type { CombatResult } from '../combat/types';

export const BLOCK_LOOP_LEDGER_KEY = 'dealt-slide-authoritative-block-loop-v1';

export const BLOCK_LOOP_IDS = {
  blockId: 'demo-block-las-olas',
  dealerId: 'demo-dealer-1',
  shooterId: 'demo-shooter-1',
  lookoutId: 'demo-lookout-1',
  enforcerId: 'demo-enforcer-1',
  productId: 'demo-product-river-cut',
  dnaId: 'las-olas-1208',
} as const;

export type LoopPhase =
  | 'crew'
  | 'placement'
  | 'product'
  | 'deal'
  | 'threat'
  | 'encounter'
  | 'consequence'
  | 'returned';

export type ThreatRoute = 'slide' | 'raid';

export type PlacementRejectReason =
  | 'out-of-bounds'
  | 'not-passable'
  | 'not-deployable'
  | 'occupied'
  | 'duplicate-cell'
  | 'over-capacity'
  | 'unknown-member'
  | 'missing-block';

export interface LoopMember {
  id: string;
  name: string;
  nickname: string;
  role: 'dealer' | 'shooter' | 'lookout' | 'enforcer';
  level: number;
  morale: number;
  health: number;
  maxHealth: number;
  equipment: string;
  assignment: string;
}

export interface StreetSafetyPreview {
  street: {
    x: number;
    y: number;
    zoneType: string;
    incomePerTick: number;
    exposureRisk: number;
  };
  safety: {
    x: number;
    y: number;
    zoneType: string;
    incomePerTick: number;
    exposureRisk: number;
  };
  incomeDelta: number;
  exposureDelta: number;
  explanation: string;
}

export interface DealReceipt {
  key: string;
  dealerId: string;
  productId: string;
  productName: string;
  productTier: DrugTier;
  cell: { x: number; y: number; zoneType: string; exposureRisk: number };
  moneyDelta: number;
  productDelta: number;
  heatDelta: number;
  exposureDelta: number;
  reputationDelta: number;
  demandBonusPct: number;
  leftoverQuantity: number;
  explanation: string;
}

export interface RecoveryOffer {
  memberId: string;
  memberName: string;
  kind: 'hospital' | 'bail';
  cost: number;
  affordable: boolean;
  waitLabel: string;
  unpaidLabel: string;
}

export interface LoopState {
  phase: LoopPhase;
  dnaId: string;
  catalogVersion: string;
  block: BlockData;
  members: LoopMember[];
  selectedDealerId: string | null;
  selectedShooterId: string | null;
  inventory: CraftedDrug[];
  assignments: Record<string, string>;
  money: number;
  playerHeat: number;
  reputation: number;
  lastDeal: DealReceipt | null;
  threat: { route: ThreatRoute; reason: string } | null;
  lastEncounter: CombatResult | null;
  appliedEncounterKeys: string[];
  economyKeys: string[];
  pendingHealthIds: string[];
  briefing: string[];
  recovery: RecoveryOffer | null;
  rejection: string | null;
  mapFallbackNotice: string;
}

export interface LoopLedgerV1 {
  version: 1;
  phase: LoopPhase;
  money: number;
  playerHeat: number;
  reputation: number;
  blockHeat: number;
  blockMorale: number;
  pendingIncome: number;
  productQuantity: number;
  assignments: Record<string, string>;
  placements: BlockPlacement[];
  appliedEncounterKeys: string[];
  economyKeys: string[];
  dealKey: string | null;
  encounterKey: string | null;
  briefing: string[];
  threatRoute: ThreatRoute | null;
  pendingHealthIds: string[];
  recovery: RecoveryOffer | null;
}

export type LoopCommand =
  | { type: 'select-crew'; dealerId: string; shooterId: string }
  | { type: 'place'; memberId: string; x: number; y: number }
  | { type: 'assign-product'; dealerId: string; productId: string }
  | { type: 'run-deal' }
  | { type: 'begin-encounter' }
  | { type: 'apply-encounter'; result: CombatResult; healthWrite?: 'ok' | 'failed' }
  | { type: 'retry-health' }
  | { type: 'recover'; pay: boolean }
  | { type: 'return-desktop' }
  | { type: 'hydrate-ledger'; ledger: LoopLedgerV1 };

export type { BlockData, BlockPlacement, BlockZone, CombatResult, CraftedDrug };
