// Game Types for Dealt/Slide

// ============ CORE TYPES ============

export interface Player {
  id: string;
  username: string;
  money: number;
  reputation: number;
  heat: number;
  level: number;
  xp: number;
  crewSize: number;
  blocksOwned: number;
}

export interface GangMember {
  id: string;
  name: string;
  nickname: string;
  role: 'dealer' | 'shooter' | 'driver' | 'chemist';
  level: number;
  xp: number;
  stats: MemberStats;
  loyalty: number;
  heat: number;
  status: 'available' | 'assigned' | 'arrested' | 'hospital' | 'dead';
  assignedBlockId?: string;
  equipment: Equipment;
  needs: MemberNeeds;
}

export interface MemberStats {
  aim: number;      // 0-100: Combat accuracy
  nerve: number;    // 0-100: Stress handling
  hustle: number;   // 0-100: Money making
  stealth: number;  // 0-100: Avoiding detection
}

export interface MemberNeeds {
  hunger: number;   // 0-100: Higher = needs food
  rest: number;     // 0-100: Lower = tired
  addiction: number; // 0-100: Drug dependency
}

export interface Equipment {
  weapon?: Weapon;
  armor?: Armor;
  accessory?: Accessory;
}

export interface Weapon {
  id: string;
  name: string;
  damage: number;
  accuracy: number;
  ammo: number;
  tier: 1 | 2 | 3 | 4 | 5;
}

export interface Armor {
  id: string;
  name: string;
  protection: number;
  tier: 1 | 2 | 3 | 4 | 5;
}

export interface Accessory {
  id: string;
  name: string;
  effect: string;
  bonus: number;
}

// ============ BLOCK / TERRITORY ============

export interface Block {
  id: string;
  address: string;
  lat: number;
  lng: number;
  owners: string[]; // Player IDs
  maxPlayers: number;
  heat: number;
  trafficLevel: 1 | 2 | 3 | 4 | 5;
  incomePerHour: number;
  units: PlacedUnit[];
  lastRaid?: Date;
}

export interface PlacedUnit {
  memberId: string;
  gridX: number;
  gridY: number;
  type: 'dealer' | 'shooter' | 'car' | 'pitbull' | 'trap';
}

// ============ DEALT MODE (TINDER DEALING) ============

export type ClientType = 
  | 'regular' 
  | 'fiend' 
  | 'prep_kid' 
  | 'celebrity' 
  | 'undercover' 
  | 'informant' 
  | 'tourist' 
  | 'homeless'
  | 'armed_buyer'
  | 'college_kid';

export interface Client {
  id: string;
  type: ClientType;
  name: string;
  avatar: string;
  age: number;
  location: string;
  requestedDrug: DrugType;
  requestedAmount: number; // grams
  offerPrice: number;
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  riskPercentage: number;
  heatImpact: number;
  description: string;
  redFlags: string[];
}

export interface DealOutcome {
  success: boolean;
  type: 'success' | 'undercover' | 'robbery' | 'snitch' | 'overdose';
  moneyChange: number;
  heatChange: number;
  reputationChange: number;
  message: string;
  arrested?: boolean;
  lostProduct?: number;
}

// ============ DRUGS / ALCHEMY ============

export type DrugType = 
  | 'weed' 
  | 'coke' 
  | 'crack' 
  | 'meth' 
  | 'heroin' 
  | 'lean' 
  | 'pills' 
  | 'lsd'
  | 'shrooms'
  | 'molly';

export type DrugCategory = 'stimulant' | 'depressant' | 'hallucinogen';

export interface Drug {
  id: string;
  type: DrugType;
  name: string;
  category: DrugCategory;
  tier: 1 | 2 | 3 | 4 | 5;
  purity: number; // 0-100%
  potency: number;
  basePrice: number;
  xp: number;
  quantity: number;
}

export interface AlchemyRecipe {
  id: string;
  name: string;
  ingredients: { type: DrugType | string; amount: number }[];
  result: DrugType;
  resultTier: number;
  successRate: number;
  discovered: boolean;
}

// ============ COMBAT / SLIDE MODE ============

export interface SlideGrid {
  width: number;
  height: number;
  tiles: SlideTile[][];
  fogOfWar: boolean[][];
}

export interface SlideTile {
  x: number;
  y: number;
  type: 'street' | 'building' | 'alley' | 'corner' | 'park';
  unit?: CombatUnit;
  revealed: boolean;
  isHit: boolean;
}

export interface CombatUnit {
  id: string;
  type: 'car' | 'shooter' | 'dealer' | 'pitbull' | 'trap';
  health: number;
  maxHealth: number;
  damage: number;
  size: number; // How many tiles it occupies
  canCounterAttack: boolean;
}

export interface CombatState {
  attackerId: string;
  defenderId: string;
  blockId: string;
  turn: 'attacker' | 'defender';
  attackerUnits: CombatUnit[];
  defenderUnits: CombatUnit[];
  attackerGrid: SlideGrid;
  defenderGrid: SlideGrid;
  phase: 'placement' | 'combat' | 'finished';
  winner?: string;
}

// ============ ECONOMY ============

export interface Transaction {
  id: string;
  type: 'deal' | 'purchase' | 'salary' | 'bail' | 'bribe' | 'loot';
  amount: number;
  timestamp: Date;
  description: string;
}

export interface MarketPrices {
  [key: string]: {
    buyPrice: number;
    sellPrice: number;
    demand: 'low' | 'normal' | 'high' | 'extreme';
  };
}

// ============ NOTIFICATIONS ============

export interface Notification {
  id: string;
  type: 'alert' | 'income' | 'raid' | 'attack' | 'loyalty' | 'mission';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionRequired: boolean;
  data?: any;
}

// ============ APP STATE ============

export type AppScreen = 
  | 'home'
  | 'map'
  | 'dealt'
  | 'slide'
  | 'drive'
  | 'cook'
  | 'crew'
  | 'battle'
  | 'casino'
  | 'phone'
  | 'market'
  | 'stats'
  | 'settings';

export interface GameState {
  player: Player;
  crew: GangMember[];
  blocks: Block[];
  inventory: Drug[];
  recipes: AlchemyRecipe[];
  notifications: Notification[];
  transactions: Transaction[];
  currentScreen: AppScreen;
  settings: GameSettings;
}

export interface GameSettings {
  soundEnabled: boolean;
  musicEnabled: boolean;
  hapticEnabled: boolean;
  notificationsEnabled: boolean;
}
