// ============================================================
// SLIDE / DEALT — Block System Types
// Sprint: block-mode-combat-assets
// ============================================================

// ─── Zone / Tile ────────────────────────────────────────────

export type BlockZoneType =
  | 'street'      // Highest income, highest risk (drive-by lane)
  | 'curb'        // High income, high risk
  | 'sidewalk'    // Medium income, medium risk
  | 'storefront'  // Medium income, lower risk (cover from building)
  | 'alley'       // Low income, low risk (hidden)
  | 'parking'     // Low income, low risk
  | 'rooftop'     // Sniper position — no dealing, high cover
  | 'building';   // Impassable

export interface BlockZone {
  x: number;
  y: number;
  zoneType: BlockZoneType;
  /** 0-100: how much income a dealer earns per tick */
  incomeModifier: number;
  /** 0-100: probability of being hit during a drive-by */
  exposureRisk: number;
  /** 0.0-1.0: cover factor (reduces incoming damage) */
  coverScore: number;
  /** Whether a unit can be placed here */
  passable: boolean;
  /** Unit currently occupying this zone */
  occupantId: string | null;
}

// ─── Placement ──────────────────────────────────────────────

export type MemberRole =
  | 'dealer'
  | 'shooter'
  | 'enforcer'
  | 'lookout'
  | 'driver'
  | 'chemist'
  | 'runner'
  | 'boss'
  // Hireable from marketplace — must be kept in sync with HireableRole
  | 'recruit'  // Entry-level gang member; no dealing, low combat
  | 'k9'       // Attack dog; no income, high combat
  // NPC / system roles — never placed by the player directly
  | 'police';  // Police officer (NPC only)

export interface BlockPlacement {
  memberId: string;
  memberName: string;
  role: MemberRole;
  x: number;
  y: number;
  zoneType: BlockZoneType;
  /** Calculated income per tick based on zone + member level */
  incomePerTick: number;
  /** Calculated exposure risk 0-100 */
  exposureRisk: number;
  /** Member level (1-10) */
  level: number;
  /** Member health 0-100 */
  health: number;
  /** Portrait / sprite asset path */
  portraitUrl?: string;
  topdownUrl?: string;
}

// ─── Block Data ─────────────────────────────────────────────

export type BlockOwner = 'player' | 'npc' | 'unclaimed';

export type BlockViewMode = 'topdown' | 'street' | 'drugs';

export interface BlockData {
  id: string;
  address: string;
  lat: number;
  lng: number;
  owner: BlockOwner;
  ownerGangName?: string;
  /** 8×8 zone grid */
  grid: BlockZone[][];
  /** Active placements on this block */
  placements: BlockPlacement[];
  /** Aggregate income per tick (sum of all dealer placements) */
  incomePerTick: number;
  /** Heat level 0-5 */
  heat: number;
  /** Morale 0-100 */
  morale: number;
  /** Members count shorthand */
  members: number;
  /** Income shorthand (legacy compat) */
  income?: number;
  /** Current view mode */
  viewMode: BlockViewMode;
  /** Street backdrop asset */
  streetBackdropUrl?: string;
  /** Top-down background asset */
  topdownBgUrl?: string;
  /** Timestamp when last income was collected */
  lastCollectedAt?: string;
  /** Pending income not yet collected */
  pendingIncome: number;
  /**
   * Gang name of whoever last landed a successful tag here. Set by the
   * graffiti mission so the territory layer can show a block as contested
   * even while its owner is unchanged — tagging pressures a block, it does
   * not capture it.
   */
  taggedBy?: string;
  /** ISO timestamp of the tag recorded in `taggedBy`. */
  taggedAt?: string;
}

// ─── Attack / Drive-By ──────────────────────────────────────

export type DriveByPhase =
  | 'idle'
  | 'incoming'   // Car approaching
  | 'active'     // Shooting window open
  | 'retreating' // Car driving away
  | 'resolved';  // Outcome calculated

export interface DriveByShot {
  shooterId: string;
  targetX: number;
  targetY: number;
  hit: boolean;
  damage: number;
  timestamp: number;
}

export interface DriveByEvent {
  id: string;
  blockId: string;
  attackerGangId: string;
  attackerGangName: string;
  vehicleType: 'sedan' | 'suv' | 'coupe' | 'van';
  phase: DriveByPhase;
  shots: DriveByShot[];
  defenderShots: DriveByShot[];
  casualties: string[];   // member IDs
  startedAt: number;
  resolvedAt?: number;
  outcome?: 'repelled' | 'successful' | 'fled';
}

// ─── Block Store State ───────────────────────────────────────

/** Snapshot of the member being placed, captured at deploy time */
export interface PendingPlacementMember {
  memberId: string;
  memberName: string;
  role: MemberRole;
  level: number;
}

export interface BlockStoreState {
  /** All blocks the player has claimed or is watching */
  blocks: Record<string, BlockData>;
  /** Currently selected block ID */
  selectedBlockId: string | null;
  /** Active drive-by event per block */
  activeDriveBys: Record<string, DriveByEvent>;
  /** Whether the block placement UI is open */
  isPlacementMode: boolean;
  /** Member being dragged for placement */
  pendingPlacementMemberId: string | null;
  /** Identity/role/level of the member being placed */
  pendingPlacementMember: PendingPlacementMember | null;
}

export interface BlockStoreActions {
  /** Add or update a block */
  upsertBlock: (block: BlockData) => void;
  /** Select a block */
  selectBlock: (blockId: string | null) => void;
  /** Get a block by ID */
  getBlock: (blockId: string) => BlockData | undefined;
  /** Place a member on a block zone */
  placeMember: (blockId: string, placement: BlockPlacement) => void;
  /** Remove a member from a block */
  removeMemberFromBlock: (blockId: string, memberId: string) => void;
  /** Move a member to a new zone */
  moveMember: (blockId: string, memberId: string, newX: number, newY: number) => void;
  /** Switch view mode for a block */
  setBlockViewMode: (blockId: string, mode: BlockViewMode) => void;
  /** Start a drive-by event */
  startDriveBy: (event: DriveByEvent) => void;
  /** Record a shot during a drive-by */
  recordShot: (blockId: string, shot: DriveByShot, isDefender: boolean) => void;
  /** Resolve a drive-by */
  resolveDriveBy: (blockId: string, outcome: DriveByEvent['outcome']) => void;
  /** Collect pending income from a block */
  collectIncome: (blockId: string) => number;
  /** Tick income for all blocks (call from game loop) */
  tickIncome: () => void;
  /** Set placement mode; pass the member snapshot when activating */
  setPlacementMode: (active: boolean, member?: PendingPlacementMember) => void;
  /** Generate a default 8×8 grid for a block */
  generateDefaultGrid: () => BlockZone[][];
  /** Get all resolved drive-by events for news feed / replays */
  getResolvedDriveBys: () => DriveByEvent[];
}

export type BlockStore = BlockStoreState & BlockStoreActions;
