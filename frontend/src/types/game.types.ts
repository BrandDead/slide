// ============================================================
// DEALT/SLIDE - Complete Game Type Definitions
// ============================================================

// ============ CORE ENUMS ============

export type CityRegion = 'miami' | 'nyc' | 'la' | 'chicago' | 'detroit' | 'nola' | 'atlanta' | 'houston';

export type MemberRole = 'shooter' | 'dealer' | 'enforcer' | 'driver' | 'lookout' | 'cook';

export type MemberStatus = 'active' | 'injured' | 'hospitalized' | 'jailed' | 'dead' | 'defected' | 'backdoored';

export type LoyaltyLevel = 'snake' | 'wavering' | 'neutral' | 'loyal' | 'ride_or_die' | 'blood_in_blood_out';

export type MoraleLevel = 'critical' | 'very_low' | 'low' | 'neutral' | 'high' | 'very_high' | 'ride_or_die';

export type ClientType = 'regular' | 'fiend' | 'prep_kid' | 'hustler' | 'celebrity' | 'undercover' | 'paranoid' | 'high_roller' | 'snitch' | 'robber';

export type DrugType = 'weed' | 'coke' | 'crack' | 'pills' | 'molly' | 'shrooms' | 'lsd' | 'heroin' | 'meth' | 'lean';

export type WeaponType = 'knife' | 'pistol' | 'revolver' | 'smg' | 'rifle' | 'shotgun' | 'draco';

export type VehicleType = 'sedan' | 'coupe' | 'suv' | 'motorcycle' | 'lowrider' | 'truck';

// ============ PLAYER ============

export interface Player {
  id: string;
  username: string;
  email: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  money: number;
  bankBalance: number;
  heat: number;
  reputation: number;
  region: CityRegion;
  gangName: string;
  gangColor: string;
  createdAt: string;
  lastLogin: string;
  settings: PlayerSettings;
}

export interface PlayerSettings {
  notifications: boolean;
  sound: boolean;
  haptics: boolean;
  autoSave: boolean;
  darkMode: boolean;
}

// ============ GANG MEMBERS ============

export interface GangMember {
  id: string;
  name: string;
  nickname?: string;
  role: MemberRole;
  status: MemberStatus;
  level: number;
  xp: number;
  
  // Stats
  shooting: number;
  driving: number;
  dealing: number;
  loyalty: number;
  morale: number;
  heatResistance: number;
  stealth: number;
  
  // Health
  health: number;
  maxHealth: number;
  armor: number;
  
  // Equipment
  weapon?: Weapon;
  weaponMods: WeaponMod[];
  gear: TacticalGear[];
  vehicle?: Vehicle;
  inventory: InventoryItem[];
  
  // Appearance
  appearance: MemberAppearance;
  customAvatarUrl?: string; // For friend selfie uploads
  
  // Backstory & Connections
  backstory: MemberBackstory;
  connections: MemberConnection[];
  
  // Assignment
  assignedBlockId?: string;
  position?: GridPosition;
  
  // Meta
  hiredAt: string;
  deathDate?: string;
  deathCause?: string;
  killedBy?: string;
}

export interface MemberAppearance {
  gender: 'male' | 'female';
  skinTone: string;
  hairStyle: string;
  hairColor: string;
  facialHair?: string;
  headwear?: string;
  eyewear?: string;
  jewelry: string[];
  tattoos: Tattoo[];
  top: string;
  outerwear?: string;
  bottom: string;
  shoes: string;
  gangColorAccent: boolean;
}

export interface Tattoo {
  placement: string;
  design: string;
}

export interface MemberBackstory {
  origin: string;
  reason: string; // Why they're in the game
  struggles: string[];
  personality: string[];
  skills: string[];
  quirks: string[];
  dreams: string[];
  fears: string[];
}

export interface MemberConnection {
  id: string;
  name: string;
  relationship: 'family' | 'friend' | 'romantic' | 'rival' | 'enemy';
  type: 'mother' | 'father' | 'sibling' | 'child' | 'spouse' | 'bestfriend' | 'homie' | 'ex';
  status: 'alive' | 'dead' | 'missing' | 'jailed';
  canBeTargeted: boolean;
  locationKnown: boolean;
  blockId?: string;
}

// ============ EQUIPMENT ============

export interface Weapon {
  id: string;
  name: string;
  type: WeaponType;
  damage: number;
  accuracy: number;
  fireRate: number;
  clipSize: number;
  range: number;
  icon: string;
  price: number;
  requiredLevel: number;
}

export interface WeaponMod {
  id: string;
  name: string;
  type: 'extended_mag' | 'drum_mag' | 'double_drum' | 'silencer' | 'laser' | 'red_dot' | 'scope' | 'grip' | 'stock';
  bonusDamage: number;
  bonusAccuracy: number;
  bonusClipSize: number;
  price: number;
}

export interface TacticalGear {
  id: string;
  name: string;
  type: 'vest' | 'helmet' | 'backpack' | 'gloves' | 'boots';
  defense: number;
  capacity?: number;
  icon: string;
  price: number;
}

export interface Vehicle {
  id: string;
  name: string;
  type: VehicleType;
  speed: number;
  armor: number;
  capacity: number; // Crew members
  icon: string;
  price: number;
}

export interface InventoryItem {
  id: string;
  type: 'drug' | 'weapon' | 'gear' | 'consumable' | 'key_item';
  itemId: string;
  quantity: number;
}

// ============ BLOCKS & TERRITORY ============

export interface Block {
  id: string;
  address: string;
  city: CityRegion;
  coordinates: {
    lat: number;
    lng: number;
  };
  ownerId?: string;
  ownerName?: string;
  gangColor?: string;
  
  // Stats
  traffic: number; // 1-100, determines income
  heat: number;
  reputation: number;
  income: number; // Per hour
  
  // Units
  units: BlockUnit[];
  maxUnits: number;
  
  // Visual
  imageUrl?: string;
  gridLayout: GridCell[][];
  
  // Combat
  inCombat: boolean;
  contestedBy?: string;
  
  // Meta
  claimedAt?: string;
  lastAttacked?: string;
}

export interface BlockUnit {
  memberId: string;
  memberName: string;
  role: MemberRole;
  position: GridPosition;
  health: number;
  maxHealth: number;
}

export interface GridPosition {
  row: number;
  col: number;
}

export interface GridCell {
  row: number;
  col: number;
  type: 'sidewalk' | 'street' | 'building' | 'alley' | 'corner';
  occupied: boolean;
  occupantId?: string;
  visible: boolean; // Fog of war
  hazard?: string;
}

// ============ DEALT MODE (Dealing) ============

export interface Client {
  id: string;
  type: ClientType;
  name: string;
  avatar: string;
  description: string;
  requestedDrug: DrugType;
  requestedAmount: number;
  offerPrice: number;
  marketPrice: number;
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  redFlags: string[];
  trustScore: number;
  heatImpact: number;
}

export interface DealOutcome {
  success: boolean;
  type: 'success' | 'undercover' | 'robbery' | 'snitch' | 'overdose' | 'refused';
  message: string;
  moneyChange: number;
  heatChange: number;
  xpGained: number;
  streakBonus: number;
  consequences?: DealConsequence[];
}

export interface DealConsequence {
  type: 'arrest' | 'injury' | 'reputation_loss' | 'member_captured' | 'block_raided';
  severity: number;
  description: string;
}

// ============ SLIDE MODE (Combat) ============

export interface CombatSession {
  id: string;
  attackerId: string;
  defenderId: string;
  blockId: string;
  phase: 'placement' | 'combat' | 'resolution';
  turn: 'attacker' | 'defender';
  turnNumber: number;
  
  attackerGrid: CombatGrid;
  defenderGrid: CombatGrid;
  
  attackerUnits: CombatUnit[];
  defenderUnits: CombatUnit[];
  
  combatLog: CombatLogEntry[];
  
  startedAt: string;
  lastAction: string;
  outcome?: CombatOutcome;
}

export interface CombatGrid {
  cells: GridCell[][];
  fogOfWar: boolean[][];
  revealedCells: GridPosition[];
}

export interface CombatUnit {
  memberId: string;
  name: string;
  role: MemberRole;
  position: GridPosition;
  health: number;
  maxHealth: number;
  weapon: Weapon;
  hasMoved: boolean;
  hasAttacked: boolean;
  isRevealed: boolean;
}

export interface CombatLogEntry {
  turn: number;
  actor: string;
  action: 'move' | 'attack' | 'counter' | 'kill' | 'retreat' | 'special';
  target?: string;
  position?: GridPosition;
  damage?: number;
  result: string;
  timestamp: string;
}

export interface CombatOutcome {
  winner: 'attacker' | 'defender' | 'draw';
  attackerCasualties: string[];
  defenderCasualties: string[];
  territoryChanged: boolean;
  lootCaptured: InventoryItem[];
  xpGained: { attacker: number; defender: number };
  reputationChange: { attacker: number; defender: number };
}

// ============ ALCHEMY MODE (Crafting) ============

export interface Drug {
  id: string;
  name: string;
  type: DrugType;
  tier: 1 | 2 | 3 | 4 | 5;
  basePrice: number;
  ingredients?: string[];
  effects: string[];
  icon: string;
  color: string;
  description: string;
}

export interface Recipe {
  id: string;
  name: string;
  inputs: { drugId: string; amount: number }[];
  output: { drugId: string; amount: number };
  unlocked: boolean;
  discovered: boolean;
  successRate: number;
  craftTime: number; // seconds
}

export interface CraftingSession {
  recipeId: string;
  startedAt: string;
  completesAt: string;
  success?: boolean;
  output?: Drug;
}

// ============ DRIVE-BY MODE (FPS) ============

export interface DriveBySession {
  id: string;
  blockId: string;
  vehicleId: string;
  crew: string[];
  
  // Game state
  phase: 'approach' | 'combat' | 'escape' | 'complete';
  score: number;
  combo: number;
  ammo: number;
  maxAmmo: number;
  
  // Targets
  enemies: DriveByEnemy[];
  civilians: DriveByEnemy[];
  
  // Results
  enemiesKilled: number;
  civiliansKilled: number;
  damageDealt: number;
  damageTaken: number;
  
  heatGained: number;
  moneyEarned: number;
  xpEarned: number;
}

export interface DriveByEnemy {
  id: string;
  type: 'rival_gang' | 'cop' | 'civilian' | 'armored' | 'boss';
  position: { x: number; y: number; layer: number };
  health: number;
  maxHealth: number;
  pointValue: number;
  isCivilian: boolean;
  behavior: 'stationary' | 'moving' | 'ducking' | 'shooting_back';
  sprite: string;
}

// ============ ECONOMY ============

export interface Transaction {
  id: string;
  type: 'income' | 'expense' | 'transfer' | 'deal' | 'purchase' | 'loot';
  amount: number;
  description: string;
  category: string;
  relatedEntityId?: string;
  timestamp: string;
}

export interface MarketListing {
  id: string;
  type: 'weapon' | 'drug' | 'gear' | 'vehicle' | 'member' | 'intel';
  itemId: string;
  name: string;
  description: string;
  price: number;
  sellerId?: string;
  quantity: number;
  available: boolean;
}

export interface Bill {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  recurring: boolean;
  frequency?: 'daily' | 'weekly' | 'monthly';
  autoPay: boolean;
  paid: boolean;
}

// ============ MISSIONS ============

export interface Mission {
  id: string;
  type: 'slide' | 'stalk' | 'deal' | 'collect' | 'defend' | 'escort' | 'hit';
  name: string;
  description: string;
  objectives: MissionObjective[];
  rewards: MissionReward;
  difficulty: 1 | 2 | 3 | 4 | 5;
  requiredLevel: number;
  assignedMembers: string[];
  status: 'available' | 'active' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  expiresAt?: string;
}

export interface MissionObjective {
  id: string;
  description: string;
  type: 'kill' | 'collect' | 'reach' | 'survive' | 'earn';
  target: string | number;
  current: string | number;
  completed: boolean;
}

export interface MissionReward {
  money: number;
  xp: number;
  reputation: number;
  items?: InventoryItem[];
  unlocks?: string[];
}

// ============ NOTIFICATIONS ============

export interface Notification {
  id: string;
  type: 'attack_incoming' | 'attack_result' | 'block_income' | 'member_event' | 'mission_complete' | 'level_up' | 'market' | 'system';
  title: string;
  message: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  read: boolean;
  actionUrl?: string;
  createdAt: string;
}

// ============ CONTACT BOOK ============

export interface Contact {
  id: string;
  memberId: string;
  name: string;
  nickname?: string;
  role: MemberRole;
  status: MemberStatus;
  avatar: string;
  lastSeen?: string;
  notes: string[];
  tags: string[];
  
  // Status indicators
  statusEmoji: string; // 💀 dead, ⛓️ jailed, 🔙 backdoored
  
  // History
  hireDate: string;
  deathDate?: string;
  deathCause?: string;
  killedBy?: string;
  backdooredBy?: string;
  
  // Stats at time of death/capture
  finalStats?: {
    level: number;
    kills: number;
    deals: number;
    earnings: number;
  };
}

// ============ MORALE & LOYALTY EVENTS ============

export interface MoraleEvent {
  id: string;
  memberId: string;
  type: 'positive' | 'negative';
  category: string;
  description: string;
  moraleChange: number;
  loyaltyChange: number;
  timestamp: string;
}

export interface GetBackRequest {
  id: string;
  memberId: string;
  memberName: string;
  targetType: 'revenge' | 'rescue' | 'retaliation';
  targetId: string;
  targetName: string;
  reason: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  deadline?: string;
  loyaltyPenaltyIfIgnored: number;
  moralePenaltyIfIgnored: number;
  status: 'pending' | 'accepted' | 'completed' | 'failed' | 'ignored';
  createdAt: string;
}

// ============ FRIEND SELFIE SYSTEM ============

export interface SelfieUpload {
  id: string;
  imageUrl: string;
  processedUrl?: string;
  faceData?: FaceData;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  uploadedAt: string;
}

export interface FaceData {
  landmarks: { [key: string]: { x: number; y: number } };
  skinTone: string;
  estimatedAge: number;
  gender: 'male' | 'female';
  facialHair?: string;
  hairColor?: string;
}

export interface GeneratedMemberFromSelfie extends GangMember {
  selfieId: string;
  resemblanceScore: number; // How closely AI matched the selfie
  generatedBackstoryId: string;
}
