// ═══════════════════════════════════════════════════════════════════════════
// DEALT/SLIDE - API Response Types
// Matches the shapes returned by the Flask backend (see docs/openapi.yaml).
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────

export interface ApiUser {
  id: string;
  email: string;
  username: string;
  role?: string;
}

export interface AuthResponse {
  user: ApiUser;
  access_token: string;
  refresh_token: string;
}

export interface RefreshResponse {
  access_token: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOCKS
// ─────────────────────────────────────────────────────────────────────────────

export interface ApiCoordinates {
  lat: number;
  lng: number;
}

export interface AddressResult {
  address: string;
  formattedAddress: string;
  coordinates: ApiCoordinates;
  city: string;
  inServiceArea: boolean;
  mapboxId?: string;
}

export interface BlockSearchResponse {
  results: AddressResult[];
  query: string;
}

export interface BlockBackgrounds {
  topdownUrl?: string;
  streetNUrl?: string;
  streetEUrl?: string;
  streetSUrl?: string;
  streetWUrl?: string;
}

export interface ApiBlock {
  id: string;
  address: string;
  formattedAddress?: string;
  city: string;
  coordinates: ApiCoordinates;
  ownerId?: string;
  gangName?: string;
  gridData?: unknown;
  trafficScore?: number;
  incomePerHour?: number;
  heatLevel?: number;
  claimedAt?: string;
  backgrounds?: BlockBackgrounds;
}

export interface BlockClaimResponse extends ApiBlock {}

export interface MyBlocksResponse {
  blocks: ApiBlock[];
  count: number;
  totalIncome: number;
}

export interface GenerateBackgroundsResponse {
  block_id: string;
  backgrounds: BlockBackgrounds;
  anchors_json: Record<string, { lat: number; lng: number }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// INVENTORY & MARKET
// ─────────────────────────────────────────────────────────────────────────────

export interface ApiInventoryItem {
  id: string;
  itemId: string;
  name: string;
  category: 'weapon' | 'armor' | 'consumable' | 'tool' | 'vehicle';
  quantity: number;
  equippedOnMemberId?: string;
}

export interface ApiMarketListing {
  id: string;
  name: string;
  category: string;
  damage?: number;
  defense?: number;
  basePrice: number;
  rarity: string;
  description?: string;
}

export interface InventoryResponse {
  inventory: ApiInventoryItem[];
}

export interface MarketResponse {
  listings: ApiMarketListing[];
}

export interface BuyItemResponse {
  success: boolean;
  item: ApiInventoryItem;
  remaining_cash: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMBAT
// ─────────────────────────────────────────────────────────────────────────────

export type CombatStatus =
  | 'active'
  | 'attacker_victory'
  | 'defender_victory'
  | 'draw'
  | 'abandoned';

export interface ApiCombatSession {
  sessionId: string;
  targetBlockId: string;
  attackerGangId?: string;
  currentTurn: number;
  maxTurns: number;
  status: CombatStatus;
  combatLog: unknown[];
}

export interface CombatTurnResponse {
  turn: number;
  result: unknown;
  session: ApiCombatSession;
}

// ─────────────────────────────────────────────────────────────────────────────
// WORLD
// ─────────────────────────────────────────────────────────────────────────────

export interface WorldEvent {
  eventType: string;
  description: string;
  blockId?: string;
}

export interface WorldTickResponse {
  success: boolean;
  userId: string;
  minutesProcessed: number;
  income: number;
  heatChange: number;
  events: WorldEvent[];
}

export interface WorldStatusResponse {
  blocks: number;
  members: number;
  heat: number;
  cash: number;
  incomePerTick: number;
  lastTick: string;
}
