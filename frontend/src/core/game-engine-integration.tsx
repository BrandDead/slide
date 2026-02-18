// ============================================
// DEALT/SLIDE - GAME ENGINE INTEGRATION
// Core systems that connect all game components
// ============================================

// ============================================
// FILE 1: /core/EventBus.ts
// Cross-system event communication
// ============================================

type EventCallback = (data: any) => void;

interface EventSubscription {
  id: string;
  callback: EventCallback;
}

class GameEventBus {
  private events: Map<string, EventSubscription[]> = new Map();
  private eventHistory: Array<{ event: string; data: any; timestamp: number }> = [];
  
  // Subscribe to an event
  on(event: string, callback: EventCallback): () => void {
    const id = `${event}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    
    this.events.get(event)!.push({ id, callback });
    
    // Return unsubscribe function
    return () => this.off(event, id);
  }
  
  // Unsubscribe from an event
  off(event: string, id: string): void {
    const subs = this.events.get(event);
    if (subs) {
      const index = subs.findIndex(s => s.id === id);
      if (index > -1) subs.splice(index, 1);
    }
  }
  
  // Emit an event
  emit(event: string, data?: any): void {
    // Log event
    this.eventHistory.push({
      event,
      data,
      timestamp: Date.now()
    });
    
    // Keep only last 100 events
    if (this.eventHistory.length > 100) {
      this.eventHistory.shift();
    }
    
    // Notify subscribers
    const subs = this.events.get(event);
    if (subs) {
      subs.forEach(sub => {
        try {
          sub.callback(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }
  
  // Get event history (for debugging)
  getHistory(): Array<{ event: string; data: any; timestamp: number }> {
    return [...this.eventHistory];
  }
  
  // Clear all subscriptions
  clear(): void {
    this.events.clear();
    this.eventHistory = [];
  }
}

// Singleton instance
export const eventBus = new GameEventBus();

// Event type constants
export const GameEvents = {
  // Economy events
  INCOME_GENERATED: 'economy:income_generated',
  EXPENSE_PAID: 'economy:expense_paid',
  BALANCE_CHANGED: 'economy:balance_changed',
  BILL_DUE: 'economy:bill_due',
  DEBT_WARNING: 'economy:debt_warning',
  
  // Combat events
  ATTACK_INITIATED: 'combat:attack_initiated',
  ATTACK_RESOLVED: 'combat:attack_resolved',
  MEMBER_HIT: 'combat:member_hit',
  MEMBER_KILLED: 'combat:member_killed',
  BLOCK_CAPTURED: 'combat:block_captured',
  BLOCK_LOST: 'combat:block_lost',
  
  // Member events
  MEMBER_DEPLOYED: 'member:deployed',
  MEMBER_RECALLED: 'member:recalled',
  MEMBER_HOSPITALIZED: 'member:hospitalized',
  MEMBER_JAILED: 'member:jailed',
  MEMBER_RELEASED: 'member:released',
  MEMBER_DIED: 'member:died',
  MORALE_CHANGED: 'member:morale_changed',
  LOYALTY_CHANGED: 'member:loyalty_changed',
  MEMBER_BETRAYED: 'member:betrayed',
  
  // Territory events
  BLOCK_CLAIMED: 'territory:block_claimed',
  BLOCK_ABANDONED: 'territory:block_abandoned',
  TRAFFIC_CHANGED: 'territory:traffic_changed',
  HEAT_CHANGED: 'territory:heat_changed',
  
  // Game events
  DEALT_COMPLETE: 'game:dealt_complete',
  SLIDE_COMPLETE: 'game:slide_complete',
  DRIVEBY_COMPLETE: 'game:driveby_complete',
  ALCHEMY_COMPLETE: 'game:alchemy_complete',
  LEVEL_UP: 'game:level_up',
  
  // System events
  NOTIFICATION: 'system:notification',
  RAID_WARNING: 'system:raid_warning',
  RAID_STARTED: 'system:raid_started',
  GAME_SAVED: 'system:game_saved',
  
  // Market events
  ORDER_PLACED: 'market:order_placed',
  ORDER_DELIVERED: 'market:order_delivered',
  ITEM_EQUIPPED: 'market:item_equipped'
} as const;

export type GameEventType = typeof GameEvents[keyof typeof GameEvents];


// ============================================
// FILE 2: /core/IncomeEngine.ts
// Calculates dealer income based on position
// ============================================

import { GangMember, GridTile, GameBlock } from '../types/territory.types';

interface IncomeBreakdown {
  memberId: string;
  memberName: string;
  baseIncome: number;
  positionMultiplier: number;
  trafficBonus: number;
  heatPenalty: number;
  finalIncome: number;
}

interface BlockIncomeResult {
  blockId: string;
  totalIncome: number;
  breakdown: IncomeBreakdown[];
  timestamp: number;
}

export class IncomeEngine {
  // Base income per dealer per tick (15 minutes)
  private static BASE_INCOME_PER_TICK = 100;
  
  // Position multipliers based on grid position
  private static getPositionMultiplier(tile: GridTile): number {
    // Street edge positions (y=0 or y=7) = highest income
    if (tile.y === 0 || tile.y === 7) {
      return tile.type === 'CORNER' ? 2.0 : 1.5;
    }
    // Near street (y=1,2 or y=5,6)
    if (tile.y <= 2 || tile.y >= 5) {
      return tile.type === 'CORNER' ? 1.75 : 1.25;
    }
    // Middle of block (safest but lowest income)
    return 1.0;
  }
  
  // Calculate traffic bonus (0-50%)
  private static getTrafficBonus(trafficLevel: number): number {
    // Traffic level is 1-10
    return (trafficLevel / 10) * 0.5; // 0-50% bonus
  }
  
  // Calculate heat penalty (0-75%)
  private static getHeatPenalty(heatLevel: number): number {
    // Heat level is 0-10
    // Higher heat = more police = less customers = less income
    return (heatLevel / 10) * 0.75; // 0-75% penalty
  }
  
  // Calculate income for a single dealer
  static calculateDealerIncome(
    member: GangMember,
    tile: GridTile,
    block: GameBlock
  ): IncomeBreakdown {
    // Only dealers generate passive income
    if (member.role !== 'DEALER') {
      return {
        memberId: member.id,
        memberName: member.name,
        baseIncome: 0,
        positionMultiplier: 0,
        trafficBonus: 0,
        heatPenalty: 0,
        finalIncome: 0
      };
    }
    
    const baseIncome = this.BASE_INCOME_PER_TICK;
    const positionMultiplier = this.getPositionMultiplier(tile);
    const trafficBonus = this.getTrafficBonus(block.resources.trafficLevel);
    const heatPenalty = this.getHeatPenalty(block.resources.heatLevel);
    
    // Level bonus (5% per level)
    const levelBonus = 1 + (member.level * 0.05);
    
    // Morale modifier (50-100% based on morale)
    const moraleModifier = 0.5 + (member.morale / 200);
    
    // Calculate final income
    let income = baseIncome * positionMultiplier * levelBonus * moraleModifier;
    income = income * (1 + trafficBonus); // Add traffic bonus
    income = income * (1 - heatPenalty);   // Subtract heat penalty
    
    return {
      memberId: member.id,
      memberName: member.name,
      baseIncome,
      positionMultiplier,
      trafficBonus,
      heatPenalty,
      finalIncome: Math.floor(income)
    };
  }
  
  // Calculate total income for a block
  static calculateBlockIncome(
    block: GameBlock,
    members: GangMember[],
    playerId: string
  ): BlockIncomeResult {
    const breakdown: IncomeBreakdown[] = [];
    let totalIncome = 0;
    
    // Find player's deployed members on this block
    const player = block.players.find(p => p.playerId === playerId);
    if (!player) {
      return {
        blockId: block.id,
        totalIncome: 0,
        breakdown: [],
        timestamp: Date.now()
      };
    }
    
    // Calculate income for each deployed member
    for (const deployment of player.deployedMembers) {
      const member = members.find(m => m.id === deployment.memberId);
      if (!member || member.role !== 'DEALER') continue;
      
      const tile = block.grid[deployment.position.x]?.[deployment.position.y];
      if (!tile) continue;
      
      const income = this.calculateDealerIncome(member, tile, block);
      breakdown.push(income);
      totalIncome += income.finalIncome;
    }
    
    return {
      blockId: block.id,
      totalIncome,
      breakdown,
      timestamp: Date.now()
    };
  }
  
  // Calculate total income across all blocks
  static calculateTotalIncome(
    blocks: GameBlock[],
    members: GangMember[],
    playerId: string
  ): { total: number; byBlock: BlockIncomeResult[] } {
    const byBlock: BlockIncomeResult[] = [];
    let total = 0;
    
    for (const block of blocks) {
      // Check if player has presence on this block
      if (!block.players.some(p => p.playerId === playerId)) continue;
      
      const blockIncome = this.calculateBlockIncome(block, members, playerId);
      byBlock.push(blockIncome);
      total += blockIncome.totalIncome;
    }
    
    return { total, byBlock };
  }
  
  // Estimate hourly income
  static estimateHourlyIncome(
    blocks: GameBlock[],
    members: GangMember[],
    playerId: string
  ): number {
    const { total } = this.calculateTotalIncome(blocks, members, playerId);
    // Income is per 15-minute tick, so multiply by 4 for hourly
    return total * 4;
  }
}


// ============================================
// FILE 3: /core/CombatResolver.ts
// Resolves SLIDE game combat
// ============================================

import { GangMember, GridTile, GameBlock } from '../types/territory.types';

interface Weapon {
  name: string;
  type: 'PISTOL' | 'SMG' | 'RIFLE' | 'SHOTGUN' | 'MELEE';
  damage: number;
  accuracy: number;
  caliber: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface ShotResult {
  shooterId: string;
  targetId: string | null;
  targetPosition: { x: number; y: number };
  hit: boolean;
  damage: number;
  isKill: boolean;
  isCritical: boolean;
}

interface CombatResult {
  attackerId: string;
  defenderId: string;
  blockId: string;
  attackerShots: ShotResult[];
  defenderShots: ShotResult[];
  attackerCasualties: string[]; // Member IDs
  defenderCasualties: string[];
  attackerHospitalized: string[];
  defenderHospitalized: string[];
  winner: 'attacker' | 'defender' | 'draw';
  blockCaptured: boolean;
  heatGenerated: number;
}

export class CombatResolver {
  // Caliber damage ranges
  private static CALIBER_DAMAGE = {
    LOW: { min: 20, max: 40, killChance: 0.1 },
    MEDIUM: { min: 40, max: 70, killChance: 0.35 },
    HIGH: { min: 70, max: 100, killChance: 0.65 }
  };
  
  // Distance modifier (closer to street = more damage)
  private static getDistanceModifier(row: number): number {
    // Rows 0-2 or 5-7 = close to street = high damage
    if (row <= 2 || row >= 5) return 1.5;
    // Rows 3-4 = middle = normal damage
    return 1.0;
  }
  
  // Cover modifier based on tile type
  private static getCoverModifier(tile: GridTile): number {
    const coverReduction = tile.cover / 100; // 0-1
    return 1 - (coverReduction * 0.5); // Max 50% damage reduction
  }
  
  // Calculate single shot
  static resolveShot(
    shooter: GangMember,
    weapon: Weapon,
    targetPosition: { x: number; y: number },
    targetTile: GridTile,
    targetMember?: GangMember
  ): ShotResult {
    // Base accuracy from weapon
    let hitChance = weapon.accuracy / 100;
    
    // Shooter skill bonus
    const skillBonus = shooter.stats?.shooting || 50;
    hitChance += (skillBonus - 50) / 200; // +/- 25% based on skill
    
    // Visibility penalty
    hitChance *= (targetTile.visibility / 100);
    
    // Check if hit
    const hit = Math.random() < hitChance;
    
    if (!hit || !targetMember) {
      return {
        shooterId: shooter.id,
        targetId: targetMember?.id || null,
        targetPosition,
        hit: false,
        damage: 0,
        isKill: false,
        isCritical: false
      };
    }
    
    // Calculate damage
    const { min, max, killChance } = this.CALIBER_DAMAGE[weapon.caliber];
    let damage = Math.floor(Math.random() * (max - min + 1)) + min;
    
    // Apply modifiers
    damage *= this.getDistanceModifier(targetPosition.y);
    damage *= this.getCoverModifier(targetTile);
    
    // Critical hit (10% chance for 1.5x damage)
    const isCritical = Math.random() < 0.1;
    if (isCritical) damage *= 1.5;
    
    damage = Math.floor(damage);
    
    // Determine if kill
    const isKill = Math.random() < killChance && damage >= 60;
    
    return {
      shooterId: shooter.id,
      targetId: targetMember.id,
      targetPosition,
      hit: true,
      damage,
      isKill,
      isCritical
    };
  }
  
  // Full combat resolution
  static resolveCombat(
    attacker: {
      playerId: string;
      members: GangMember[];
      weapons: Map<string, Weapon>;
      targetPositions: { x: number; y: number }[];
    },
    defender: {
      playerId: string;
      members: GangMember[];
      weapons: Map<string, Weapon>;
      targetPositions: { x: number; y: number }[];
    },
    block: GameBlock
  ): CombatResult {
    const result: CombatResult = {
      attackerId: attacker.playerId,
      defenderId: defender.playerId,
      blockId: block.id,
      attackerShots: [],
      defenderShots: [],
      attackerCasualties: [],
      defenderCasualties: [],
      attackerHospitalized: [],
      defenderHospitalized: [],
      winner: 'draw',
      blockCaptured: false,
      heatGenerated: 0
    };
    
    // Track member health
    const memberHealth: Map<string, number> = new Map();
    [...attacker.members, ...defender.members].forEach(m => {
      memberHealth.set(m.id, 100);
    });
    
    // Resolve attacker shots (drive-by)
    for (let i = 0; i < attacker.members.length && i < attacker.targetPositions.length; i++) {
      const shooter = attacker.members[i];
      const targetPos = attacker.targetPositions[i];
      const weapon = attacker.weapons.get(shooter.id);
      
      if (!weapon) continue;
      
      // Find defender at target position
      const targetTile = block.grid[targetPos.x]?.[targetPos.y];
      if (!targetTile) continue;
      
      const targetMember = targetTile.occupant
        ? defender.members.find(m => m.id === targetTile.occupant?.memberId)
        : undefined;
      
      const shotResult = this.resolveShot(shooter, weapon, targetPos, targetTile, targetMember);
      result.attackerShots.push(shotResult);
      
      if (shotResult.hit && shotResult.targetId) {
        const currentHealth = memberHealth.get(shotResult.targetId) || 100;
        memberHealth.set(shotResult.targetId, currentHealth - shotResult.damage);
      }
    }
    
    // Resolve defender shots (return fire)
    for (let i = 0; i < defender.members.length && i < defender.targetPositions.length; i++) {
      const shooter = defender.members[i];
      if (shooter.role === 'DEALER') continue; // Dealers can't shoot
      
      const targetPos = defender.targetPositions[i];
      const weapon = defender.weapons.get(shooter.id);
      
      if (!weapon) continue;
      
      // Target is in the car (street row)
      const targetTile: GridTile = {
        x: targetPos.x,
        y: targetPos.y,
        type: 'STREET',
        cover: 30, // Car provides some cover
        visibility: 80,
        incomeMultiplier: 0
      };
      
      const targetMember = attacker.members[i % attacker.members.length];
      
      const shotResult = this.resolveShot(shooter, weapon, targetPos, targetTile, targetMember);
      result.defenderShots.push(shotResult);
      
      if (shotResult.hit && shotResult.targetId) {
        const currentHealth = memberHealth.get(shotResult.targetId) || 100;
        memberHealth.set(shotResult.targetId, currentHealth - shotResult.damage);
      }
    }
    
    // Determine casualties
    for (const [memberId, health] of memberHealth) {
      if (health <= 0) {
        // Killed
        if (attacker.members.some(m => m.id === memberId)) {
          result.attackerCasualties.push(memberId);
        } else {
          result.defenderCasualties.push(memberId);
        }
      } else if (health < 50) {
        // Hospitalized
        if (attacker.members.some(m => m.id === memberId)) {
          result.attackerHospitalized.push(memberId);
        } else {
          result.defenderHospitalized.push(memberId);
        }
      }
    }
    
    // Determine winner
    const attackerLosses = result.attackerCasualties.length + result.attackerHospitalized.length;
    const defenderLosses = result.defenderCasualties.length + result.defenderHospitalized.length;
    
    if (attackerLosses < defenderLosses) {
      result.winner = 'attacker';
      // Block captured if all defenders down
      if (defenderLosses >= defender.members.length) {
        result.blockCaptured = true;
      }
    } else if (defenderLosses < attackerLosses) {
      result.winner = 'defender';
    }
    
    // Calculate heat generated
    const totalShots = result.attackerShots.length + result.defenderShots.length;
    const casualties = result.attackerCasualties.length + result.defenderCasualties.length;
    result.heatGenerated = Math.min(10, Math.floor(totalShots / 3) + casualties);
    
    return result;
  }
  
  // Calculate hospital bill
  static calculateHospitalBill(damage: number): number {
    // Base $500 + $100 per 10 damage
    return 500 + Math.floor(damage / 10) * 100;
  }
  
  // Calculate bail amount
  static calculateBail(heatLevel: number, priors: number): number {
    // Base $1000, +$500 per heat level, +$1000 per prior
    return 1000 + (heatLevel * 500) + (priors * 1000);
  }
}


// ============================================
// FILE 4: /core/HospitalJailManager.ts
// Manages member status timers
// ============================================

import { eventBus, GameEvents } from './EventBus';

interface StatusEntry {
  memberId: string;
  memberName: string;
  type: 'HOSPITAL' | 'JAIL';
  reason: string;
  startTime: number;
  releaseTime: number;
  cost: number; // Hospital bill or bail
  paid: boolean;
}

export class HospitalJailManager {
  private entries: Map<string, StatusEntry> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    // Check for releases every minute
    this.checkInterval = setInterval(() => this.checkReleases(), 60000);
  }
  
  // Add member to hospital
  hospitalize(
    memberId: string,
    memberName: string,
    damage: number,
    reason: string
  ): StatusEntry {
    // Hospital time: 1 hour per 20 damage (min 1 hour, max 24 hours)
    const hoursInHospital = Math.max(1, Math.min(24, Math.floor(damage / 20)));
    const releaseTime = Date.now() + (hoursInHospital * 60 * 60 * 1000);
    
    // Hospital bill
    const cost = 500 + Math.floor(damage / 10) * 100;
    
    const entry: StatusEntry = {
      memberId,
      memberName,
      type: 'HOSPITAL',
      reason,
      startTime: Date.now(),
      releaseTime,
      cost,
      paid: false
    };
    
    this.entries.set(memberId, entry);
    
    eventBus.emit(GameEvents.MEMBER_HOSPITALIZED, {
      memberId,
      memberName,
      releaseTime,
      cost,
      reason
    });
    
    eventBus.emit(GameEvents.NOTIFICATION, {
      type: 'HOSPITAL',
      title: 'Member Hospitalized',
      message: `${memberName} was hospitalized. Bill: $${cost.toLocaleString()}`,
      memberId
    });
    
    return entry;
  }
  
  // Add member to jail
  jail(
    memberId: string,
    memberName: string,
    charge: string,
    heatLevel: number,
    priors: number = 0
  ): StatusEntry {
    // Jail time: 2-48 hours based on heat and priors
    const baseHours = 2 + (heatLevel * 2);
    const priorBonus = priors * 4;
    const hoursInJail = Math.min(48, baseHours + priorBonus);
    const releaseTime = Date.now() + (hoursInJail * 60 * 60 * 1000);
    
    // Bail amount
    const cost = 1000 + (heatLevel * 500) + (priors * 1000);
    
    const entry: StatusEntry = {
      memberId,
      memberName,
      type: 'JAIL',
      reason: charge,
      startTime: Date.now(),
      releaseTime,
      cost,
      paid: false
    };
    
    this.entries.set(memberId, entry);
    
    eventBus.emit(GameEvents.MEMBER_JAILED, {
      memberId,
      memberName,
      releaseTime,
      cost,
      charge
    });
    
    eventBus.emit(GameEvents.NOTIFICATION, {
      type: 'JAIL',
      title: 'Member Arrested',
      message: `${memberName} was arrested for ${charge}. Bail: $${cost.toLocaleString()}`,
      memberId
    });
    
    return entry;
  }
  
  // Pay hospital bill or bail
  payRelease(memberId: string): boolean {
    const entry = this.entries.get(memberId);
    if (!entry) return false;
    
    entry.paid = true;
    entry.releaseTime = Date.now(); // Immediate release
    
    return true;
  }
  
  // Check for natural releases
  private checkReleases(): void {
    const now = Date.now();
    
    for (const [memberId, entry] of this.entries) {
      if (now >= entry.releaseTime) {
        // Time served, release member
        this.entries.delete(memberId);
        
        eventBus.emit(GameEvents.MEMBER_RELEASED, {
          memberId,
          memberName: entry.memberName,
          type: entry.type,
          billPaid: entry.paid
        });
        
        eventBus.emit(GameEvents.NOTIFICATION, {
          type: entry.type === 'HOSPITAL' ? 'HOSPITAL' : 'JAIL',
          title: `Member Released`,
          message: `${entry.memberName} has been released from ${entry.type.toLowerCase()}.`,
          memberId
        });
      }
    }
  }
  
  // Get member status
  getStatus(memberId: string): StatusEntry | null {
    return this.entries.get(memberId) || null;
  }
  
  // Get all entries
  getAllEntries(): StatusEntry[] {
    return Array.from(this.entries.values());
  }
  
  // Get time remaining
  getTimeRemaining(memberId: string): number {
    const entry = this.entries.get(memberId);
    if (!entry) return 0;
    
    return Math.max(0, entry.releaseTime - Date.now());
  }
  
  // Format time remaining
  formatTimeRemaining(memberId: string): string {
    const ms = this.getTimeRemaining(memberId);
    if (ms <= 0) return 'Ready for release';
    
    const hours = Math.floor(ms / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }
    return `${minutes}m remaining`;
  }
  
  // Cleanup
  destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}

// Singleton instance
export const hospitalJailManager = new HospitalJailManager();


// ============================================
// FILE 5: /core/GameLoop.tsx
// Master game tick manager
// ============================================

import React, { useEffect, useRef, useCallback } from 'react';
import { eventBus, GameEvents } from './EventBus';
import { IncomeEngine } from './IncomeEngine';
import { hospitalJailManager } from './HospitalJailManager';

// Game tick intervals (in milliseconds)
const TICK_INTERVALS = {
  INCOME: 15 * 60 * 1000,      // 15 minutes
  MORALE_DECAY: 60 * 60 * 1000, // 1 hour
  HEAT_DECAY: 60 * 60 * 1000,   // 1 hour
  RAID_CHECK: 30 * 60 * 1000,   // 30 minutes
  AUTO_SAVE: 5 * 60 * 1000      // 5 minutes
};

// For development/testing, use shorter intervals
const DEV_TICK_INTERVALS = {
  INCOME: 30 * 1000,            // 30 seconds
  MORALE_DECAY: 60 * 1000,      // 1 minute
  HEAT_DECAY: 60 * 1000,        // 1 minute
  RAID_CHECK: 2 * 60 * 1000,    // 2 minutes
  AUTO_SAVE: 60 * 1000          // 1 minute
};

interface GameLoopProps {
  children: React.ReactNode;
  devMode?: boolean;
  // Store hooks passed as props
  useEconomyStore: () => any;
  useTerritoryStore: () => any;
  useGangStore: () => any;
}

export const GameLoop: React.FC<GameLoopProps> = ({
  children,
  devMode = false,
  useEconomyStore,
  useTerritoryStore,
  useGangStore
}) => {
  const intervals = devMode ? DEV_TICK_INTERVALS : TICK_INTERVALS;
  const tickRefs = useRef<{ [key: string]: NodeJS.Timeout }>({});
  
  // Get stores
  const economy = useEconomyStore();
  const territory = useTerritoryStore();
  const gang = useGangStore();
  
  // Income tick
  const processIncomeTick = useCallback(() => {
    console.log('[GameLoop] Processing income tick...');
    
    const { blocks, playerId } = territory;
    const { members } = gang;
    
    const incomeResult = IncomeEngine.calculateTotalIncome(blocks, members, playerId);
    
    if (incomeResult.total > 0) {
      // Add income to balance
      economy.addIncome(incomeResult.total, 'DEALER_INCOME', 'Dealer earnings');
      
      // Emit event
      eventBus.emit(GameEvents.INCOME_GENERATED, {
        amount: incomeResult.total,
        breakdown: incomeResult.byBlock
      });
      
      // Notification
      eventBus.emit(GameEvents.NOTIFICATION, {
        type: 'INCOME',
        title: 'Income Generated',
        message: `Your dealers made $${incomeResult.total.toLocaleString()}`,
        data: incomeResult
      });
    }
  }, [territory, gang, economy]);
  
  // Morale decay tick
  const processMoraleTick = useCallback(() => {
    console.log('[GameLoop] Processing morale decay...');
    
    const { members, updateMember } = gang;
    const { heat } = territory;
    
    for (const member of members) {
      let moraleChange = -1; // Base decay
      
      // Heat affects morale
      if (heat > 5) moraleChange -= 2;
      if (heat > 8) moraleChange -= 3;
      
      // Low loyalty = faster decay
      if (member.loyalty < 30) moraleChange -= 2;
      
      const newMorale = Math.max(0, Math.min(100, member.morale + moraleChange));
      
      if (newMorale !== member.morale) {
        updateMember(member.id, { morale: newMorale });
        
        eventBus.emit(GameEvents.MORALE_CHANGED, {
          memberId: member.id,
          oldMorale: member.morale,
          newMorale,
          change: moraleChange
        });
        
        // Check for betrayal
        if (newMorale < 10 && member.loyalty < 30) {
          if (Math.random() < 0.1) { // 10% chance
            eventBus.emit(GameEvents.MEMBER_BETRAYED, {
              memberId: member.id,
              memberName: member.name
            });
          }
        }
      }
    }
  }, [gang, territory]);
  
  // Heat decay tick
  const processHeatTick = useCallback(() => {
    console.log('[GameLoop] Processing heat decay...');
    
    const { blocks, updateBlockHeat, playerId } = territory;
    
    for (const block of blocks) {
      if (block.resources.heatLevel > 0) {
        const newHeat = Math.max(0, block.resources.heatLevel - 1);
        updateBlockHeat(block.id, newHeat);
        
        // Also restore some traffic as heat decreases
        if (block.resources.trafficLevel < 10) {
          // Traffic slowly recovers
        }
        
        eventBus.emit(GameEvents.HEAT_CHANGED, {
          blockId: block.id,
          oldHeat: block.resources.heatLevel,
          newHeat
        });
      }
    }
  }, [territory]);
  
  // Raid check tick
  const processRaidCheck = useCallback(() => {
    console.log('[GameLoop] Checking for raid triggers...');
    
    const { blocks, playerId } = territory;
    
    for (const block of blocks) {
      const player = block.players.find(p => p.playerId === playerId);
      if (!player) continue;
      
      // High heat = chance of police raid
      if (block.resources.heatLevel >= 8) {
        const raidChance = (block.resources.heatLevel - 7) * 0.1; // 10-30%
        
        if (Math.random() < raidChance) {
          eventBus.emit(GameEvents.RAID_WARNING, {
            blockId: block.id,
            address: block.address
          });
          
          eventBus.emit(GameEvents.NOTIFICATION, {
            type: 'HEAT',
            title: '⚠️ RAID WARNING',
            message: `Police are approaching ${block.address}! Move your members!`,
            urgent: true
          });
        }
      }
    }
  }, [territory]);
  
  // Auto-save tick
  const processAutoSave = useCallback(() => {
    console.log('[GameLoop] Auto-saving game...');
    
    // Trigger save to backend/localStorage
    eventBus.emit(GameEvents.GAME_SAVED, {
      timestamp: Date.now()
    });
  }, []);
  
  // Start all ticks
  useEffect(() => {
    console.log('[GameLoop] Starting game loop ticks...');
    
    // Clear any existing intervals
    Object.values(tickRefs.current).forEach(clearInterval);
    
    // Start new intervals
    tickRefs.current.income = setInterval(processIncomeTick, intervals.INCOME);
    tickRefs.current.morale = setInterval(processMoraleTick, intervals.MORALE_DECAY);
    tickRefs.current.heat = setInterval(processHeatTick, intervals.HEAT_DECAY);
    tickRefs.current.raid = setInterval(processRaidCheck, intervals.RAID_CHECK);
    tickRefs.current.save = setInterval(processAutoSave, intervals.AUTO_SAVE);
    
    // Run initial ticks
    setTimeout(processIncomeTick, 1000);
    
    // Cleanup on unmount
    return () => {
      console.log('[GameLoop] Stopping game loop ticks...');
      Object.values(tickRefs.current).forEach(clearInterval);
    };
  }, [intervals, processIncomeTick, processMoraleTick, processHeatTick, processRaidCheck, processAutoSave]);
  
  return <>{children}</>;
};

export default GameLoop;
