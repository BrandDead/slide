// ═══════════════════════════════════════════════════════════════════════════
// DEALT/SLIDE - Core Game Types
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// REGION & LOCATION TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type CityRegion = 'nyc' | 'la' | 'miami' | 'chicago' | 'detroit' | 'nola';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface GeoBlock {
  id: string;
  address: string;
  city: CityRegion;
  coordinates: Coordinates;
  boundingBox: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  streetViewUrl?: string;
  satelliteImageUrl?: string;
  generatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOCK & TERRITORY TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface Block {
  id: string;
  geoBlock: GeoBlock;
  ownerId: string | null;
  ownerGangId: string | null;
  claimedAt: string | null;
  
  // Grid system
  grid: BlockGrid;
  
  // Economics
  trafficScore: number;      // 0-100, affects income
  heatLevel: number;         // 0-5, police attention
  incomePerTick: number;
  
  // Defenses
  units: Unit[];
  fortifications: Fortification[];
  
  // Metadata from real-world data
  metadata: BlockMetadata;
}

export interface BlockGrid {
  width: number;              // Default 8
  height: number;             // Default 8
  tiles: Tile[][];
  sidewalkTop: number[];      // Y coordinates of top sidewalk tiles
  sidewalkBottom: number[];   // Y coordinates of bottom sidewalk tiles
  streetRows: number[];       // Y coordinates of street tiles
}

export interface Tile {
  x: number;
  y: number;
  type: TileType;
  coverScore: number;         // 0.0-1.0 how much cover
  visibilityScore: number;    // 0.0-1.0 how visible
  distanceToStreet: number;
  trafficModifier: number;
  policeRisk: number;
  environmentTags: EnvironmentTag[];
  occupied: boolean;
  occupantId: string | null;
}

export type TileType = 
  | 'street'
  | 'sidewalk'
  | 'building'
  | 'alley'
  | 'corner'
  | 'storefront'
  | 'parking'
  | 'vacant';

export type EnvironmentTag = 
  | 'corner'
  | 'alley'
  | 'storefront'
  | 'residential'
  | 'commercial'
  | 'industrial'
  | 'high_traffic'
  | 'low_visibility'
  | 'cover_heavy'
  | 'open_area';

export interface BlockMetadata {
  neighborhood: string;
  zoning: 'residential' | 'commercial' | 'industrial' | 'mixed';
  avgBuildingHeight: number;
  hasAlleys: boolean;
  cornerBlock: boolean;
  nearbyPOI: string[];
  crimeIndex: number;         // Historical crime data weight
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIT & CHARACTER TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type UnitType = 'dealer' | 'shooter' | 'driver' | 'lookout' | 'enforcer';
export type UnitStatus = 'idle' | 'working' | 'combat' | 'wounded' | 'dead' | 'arrested' | 'hiding';

export interface Unit {
  id: string;
  type: UnitType;
  gangMemberId: string;       // Reference to GangMember
  memberId?: string;            // Simplified assignment context: short-form reference matching gangMemberId
  
  // Position
  blockId: string;
  position: { x: number; y: number } | null;
  
  // Stats (derived from GangMember + modifiers)
  health: number;
  maxHealth: number;
  accuracy: number;           // 0.0-1.0
  nerve: number;              // 0.0-1.0, affects combat under pressure
  speed: number;
  
  // Equipment
  weaponId: string | null;
  armorLevel: number;
  
  // State
  status: UnitStatus;
  assignedTask: string | null;
}

export interface GangMember {
  id: string;
  gangId: string;
  
  // Identity
  name: string;
  nickname: string;
  avatarUrl: string;
  backstory: string;
  
  // Demographics
  age: number;
  region: CityRegion;
  
  // Core stats
  stats: MemberStats;
  
  // Progression
  level: number;
  experience: number;
  skillPoints: number;
  skills: Skill[];
  
  // Relationships
  loyalty: number;            // 0-100
  morale: number;             // 0-100
  respect: number;            // 0-100
  
  // History
  kills: number;
  arrests: number;
  dealsCompleted: number;
  moneyEarned: number;
  
  // Status
  status: MemberStatus;
  currentAssignment: string | null;
  joinedAt: string;
  hiredAt?: string;

  // Role
  role?: string;

  // Combat stats (optional overrides)
  health?: number;
  maxHealth?: number;

  // Inventory
  inventory?: InventoryItem[];
}

export interface MemberStats {
  strength: number;
  agility: number;
  intelligence: number;
  charisma: number;
  luck: number;
  intimidation: number;
}

export type MemberStatus = 
  | 'active'
  | 'injured'
  | 'hospitalized'
  | 'arrested'
  | 'on_the_run'
  | 'dead'
  | 'missing'
  | 'jailed'                // Serving time (longer-term than arrested)
  | 'hospital'              // Alternate form used in store operations
  | 'backdoored';           // Removed from gang / turned

export interface Skill {
  id: string;
  name: string;
  category: SkillCategory;
  level: number;
  maxLevel: number;
  effect: string;
  unlockRequirement?: string;
}

export type SkillCategory = 
  | 'combat'
  | 'dealing'
  | 'driving'
  | 'alchemy'
  | 'leadership'
  | 'stealth';

// ─────────────────────────────────────────────────────────────────────────────
// WEAPON & EQUIPMENT TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface Weapon {
  id: string;
  name: string;
  type: WeaponType;
  tier: 'common' | 'uncommon' | 'rare' | 'legendary';
  
  // Combat stats
  damage: number;
  accuracy: number;           // Base accuracy modifier
  range: number;
  fireRate: number;
  penetration: number;        // Armor piercing
  chaosFactor: number;        // How much randomness in outcomes
  
  // Characteristics
  caliber: string;
  magazineSize: number;
  reloadTime: number;
  concealability: number;     // 0-1, affects heat
  
  // Visual
  spriteUrl: string;
  soundEffect: string;
}

export type WeaponType = 
  | 'pistol'
  | 'revolver'
  | 'smg'
  | 'shotgun'
  | 'rifle'
  | 'assault_rifle'
  | 'sniper'
  | 'melee';

export interface Fortification {
  id: string;
  type: FortificationType;
  position: { x: number; y: number };
  health: number;
  coverBonus: number;
  visibilityReduction: number;
}

export type FortificationType = 
  | 'sandbags'
  | 'barricade'
  | 'lookout_post'
  | 'stash_house'
  | 'trap';

// ─────────────────────────────────────────────────────────────────────────────
// DRUG & ALCHEMY TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface Drug {
  id: string;
  name: string;
  streetName: string;
  tier: 'base' | 'processed' | 'premium' | 'designer';
  
  // Economics
  basePrice: number;
  volatility: number;         // Price fluctuation
  demand: number;
  
  // Risk
  heatGeneration: number;     // How much heat per sale
  addictionRate: number;
  
  // Production
  recipe?: Recipe;
  
  // Visual
  iconUrl: string;
  color: string;
}

export interface Recipe {
  id: string;
  name: string;
  outputDrugId: string;
  outputQuantity: number;
  
  ingredients: RecipeIngredient[];
  
  craftingTime: number;       // Seconds
  difficultyLevel: number;
  failureChance: number;
  
  discoveredBy: string | null;
}

export interface RecipeIngredient {
  drugId: string;
  quantity: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMBAT TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface CombatSession {
  id: string;
  type: 'slide' | 'driveby' | 'raid' | 'defense';
  
  attackerId: string;
  defenderId: string;
  targetBlockId: string;
  
  state: CombatState;
  
  startedAt: string;
  endedAt: string | null;
  
  // Results
  outcome: CombatOutcome | null;
  casualties: Casualty[];
  combatLog: CombatEvent[];
}

export type CombatState = 
  | 'preparing'
  | 'in_progress'
  | 'resolving'
  | 'completed'
  | 'aborted';

export interface CombatOutcome {
  winner: 'attacker' | 'defender' | 'draw';
  territoryTransferred: boolean;
  attackerCasualties: number;
  defenderCasualties: number;
  moneyLost: number;
  moneyGained: number;
  heatGenerated: number;
  experienceGained: number;
}

export interface Casualty {
  unitId: string;
  memberId: string;
  result: 'wounded' | 'critical' | 'dead' | 'captured';
  causedBy: string | null;
}

export interface CombatEvent {
  id: string;
  timestamp: string;
  type: CombatEventType;
  
  actorId: string;
  targetId: string | null;
  
  tile?: { x: number; y: number };
  
  weaponUsed?: string;
  result: CombatEventResult;
  
  details: Record<string, unknown>;
}

export type CombatEventType = 
  | 'shot_fired'
  | 'hit'
  | 'miss'
  | 'graze'
  | 'critical_hit'
  | 'kill'
  | 'wounded'
  | 'move'
  | 'reload'
  | 'take_cover'
  | 'return_fire'
  | 'vehicle_move'
  | 'vehicle_damaged'
  | 'police_arrival'
  | 'retreat';

export interface CombatEventResult {
  success: boolean;
  damage?: number;
  hitProbability?: number;
  actualRoll?: number;
  modifiers?: CombatModifier[];
}

export interface CombatModifier {
  source: string;
  value: number;
  type: 'accuracy' | 'damage' | 'cover' | 'distance' | 'chaos';
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIVE-BY SPECIFIC TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface DriveBySession extends CombatSession {
  vehicle: Vehicle;
  route: DriveByRoute;
  speed: number;
  passengers: DriveByPassenger[];
}

export interface Vehicle {
  id: string;
  type: VehicleType;
  seats: number;
  armor: number;
  speed: number;
  handling: number;
  health: number;
}

export type VehicleType = 
  | 'sedan'
  | 'suv'
  | 'sports'
  | 'van'
  | 'motorcycle';

export interface DriveByRoute {
  startPosition: { x: number; y: number };
  endPosition: { x: number; y: number };
  waypoints: { x: number; y: number }[];
  estimatedDuration: number;
}

export interface DriveByPassenger {
  unitId: string;
  seat: 'driver' | 'front_passenger' | 'back_left' | 'back_right';
  canShoot: boolean;
  firingArc: { min: number; max: number };
}

// ─────────────────────────────────────────────────────────────────────────────
// DEALER MODE TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface DealerClient {
  id: string;
  name: string;
  avatarUrl: string;
  
  // Request
  drugRequested: string;
  quantity: number;
  offerPrice: number;
  
  // Risk assessment
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  isCop: boolean;
  isRobber: boolean;
  isAddict: boolean;
  
  // Timing
  patience: number;           // Seconds before they leave
  expiresAt: string;
  
  // Location
  location: string;
  distanceFromBlock: number;
}

export interface DealResult {
  clientId: string;
  accepted: boolean;
  
  revenue?: number;
  profit?: number;
  heatGenerated?: number;
  
  outcome?: 'success' | 'busted' | 'robbed' | 'shortchanged';
  
  consequences?: DealConsequence[];
}

export interface DealConsequence {
  type: 'heat_increase' | 'money_lost' | 'member_arrested' | 'reputation_change';
  value: number;
  description: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// GANG & ORGANIZATION TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface Gang {
  id: string;
  name: string;
  tag: string;                // 2-4 letter tag
  colorPrimary: string;
  colorSecondary: string;
  region: CityRegion;
  
  // Leadership
  leaderId: string;
  foundedAt: string;
  
  // Members
  memberCount: number;
  maxMembers: number;
  
  // Territory
  blocksOwned: string[];
  influence: number;
  
  // Economics
  bankroll: number;
  dailyIncome: number;
  
  // Reputation
  respect: number;
  fear: number;
  heat: number;
  
  // Alliances
  allies: string[];
  enemies: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// USER & PLAYER TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  
  // Game state
  gangId: string | null;
  homeBlockId: string | null;
  
  // Resources
  cash: number;
  reputation: number;
  
  // Stats
  totalEarnings: number;
  blocksClaimedTotal: number;
  combatWins: number;
  combatLosses: number;
  
  // Progression
  level: number;
  experience: number;
  
  // Settings
  settings: UserSettings;
  
  // Timestamps
  createdAt: string;
  lastLoginAt: string;
}

export interface UserSettings {
  notifications: boolean;
  soundEnabled: boolean;
  musicEnabled: boolean;
  hapticFeedback: boolean;
  language: string;
  theme: 'dark' | 'light' | 'system';
}

// ─────────────────────────────────────────────────────────────────────────────
// HEAT & POLICE TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface HeatState {
  blockId: string;
  currentLevel: number;       // 0-5
  decayRate: number;
  
  recentEvents: HeatEvent[];
  policePresence: PolicePresence;
  
  raidProbability: number;
  nextDecayAt: string;
}

export interface HeatEvent {
  id: string;
  type: 'deal' | 'combat' | 'murder' | 'noise' | 'report';
  heatGenerated: number;
  timestamp: string;
}

export interface PolicePresence {
  level: 'none' | 'patrol' | 'watching' | 'active' | 'raid';
  unitsInArea: number;
  responseTime: number;       // Seconds
  alertness: number;
}

export interface Raid {
  id: string;
  blockId: string;
  triggeredBy: string;
  
  policeUnits: number;
  difficulty: number;
  
  state: 'incoming' | 'in_progress' | 'escaped' | 'busted';
  
  startedAt: string;
  endedAt: string | null;
  
  casualties: Casualty[];
  arrestsMade: string[];
  assetsSeized: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// ECONOMY TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface MarketState {
  drugPrices: Record<string, DrugPriceInfo>;
  lastUpdated: string;
  volatilityIndex: number;
}

export interface DrugPriceInfo {
  drugId: string;
  currentPrice: number;
  previousPrice: number;
  priceChange: number;
  trend: 'rising' | 'falling' | 'stable';
  supply: number;
  demand: number;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  
  userId: string;
  amount: number;
  
  details: Record<string, unknown>;
  
  createdAt: string;
}

export type TransactionType = 
  | 'deal_income'
  | 'block_income'
  | 'combat_loot'
  | 'purchase'
  | 'salary'
  | 'bribe'
  | 'tax'
  | 'asset_seized';

// ─────────────────────────────────────────────────────────────────────────────
// INVENTORY & MARKET TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface InventoryItem {
  itemId: string;
  type: 'drug' | 'weapon' | 'armor' | 'vehicle' | 'consumable' | 'tool';
  name: string;
  quantity: number;
  quality?: number;          // 0-100 for drugs (purity)
  potency?: number;          // 0-100 for drugs
  odRisk?: number;           // 0-100 for drugs
  tier?: number;             // Drug tier (1-5)
  damage?: number;           // For weapons
  accuracy?: number;         // For weapons
  defense?: number;          // For armor
  isEquipped?: boolean;
  acquiredAt: string;
  value: number;             // Per-unit market value
  data?: Record<string, unknown>; // Extensible metadata
}

export interface MarketListing {
  id: string;
  name: string;
  description: string;
  category: 'weapons' | 'armor' | 'vehicles' | 'consumables' | 'tools';
  price: number;
  icon: string;
  tier: number;
  available: boolean;
  stock: number;
  stats?: Record<string, number>;
}
