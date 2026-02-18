// ═══════════════════════════════════════════════════════════════════════════
// DEALT/SLIDE - Probabilistic Combat Resolver
// War Thunder-style combat with realistic probability calculations
// No guaranteed outcomes - every shot is a calculation of multiple factors
// ═══════════════════════════════════════════════════════════════════════════

import type {
  Unit,
  Weapon,
  Tile,
  CombatEvent,
  CombatEventResult,
  CombatModifier,
  Casualty,
} from '../types/game.types';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

interface CombatConfig {
  baseHitChance: number;           // Base hit probability (0.5 = 50%)
  minHitChance: number;            // Minimum possible hit chance
  maxHitChance: number;            // Maximum possible hit chance
  criticalMultiplier: number;      // Damage multiplier for crits
  grazeThreshold: number;          // Miss margin that counts as graze
  counterFireChance: number;       // Base chance to return fire
  chaosCeiling: number;            // Maximum chaos factor impact
}

const DEFAULT_CONFIG: CombatConfig = {
  baseHitChance: 0.45,
  minHitChance: 0.05,
  maxHitChance: 0.95,
  criticalMultiplier: 2.5,
  grazeThreshold: 0.15,
  counterFireChance: 0.4,
  chaosCeiling: 0.3,
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMBAT RESOLVER CLASS
// ─────────────────────────────────────────────────────────────────────────────

export class CombatResolver {
  private config: CombatConfig;
  
  constructor(config: Partial<CombatConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // SHOT RESOLUTION - The core combat mechanic
  // ─────────────────────────────────────────────────────────────────────────
  
  resolveShot(params: {
    shooter: Unit;
    target: Unit;
    weapon: Weapon;
    shooterTile: Tile;
    targetTile: Tile;
    distance: number;         // Grid units
    vehicleSpeed?: number;    // 0-1 for drive-by
    isCounterFire?: boolean;
  }): ShotResult {
    const {
      shooter,
      target,
      weapon,
      shooterTile,
      targetTile,
      distance,
      vehicleSpeed = 0,
      isCounterFire = false,
    } = params;
    
    // Collect all modifiers
    const modifiers: CombatModifier[] = [];
    
    // 1. Base accuracy from shooter stats
    const shooterAccuracyMod = this.calculateShooterAccuracy(shooter, isCounterFire);
    modifiers.push({
      source: 'shooter_skill',
      value: shooterAccuracyMod,
      type: 'accuracy',
    });
    
    // 2. Weapon accuracy
    const weaponAccuracyMod = weapon.accuracy - 0.5; // Normalize around 0
    modifiers.push({
      source: 'weapon_accuracy',
      value: weaponAccuracyMod,
      type: 'accuracy',
    });
    
    // 3. Distance penalty
    const distanceMod = this.calculateDistanceModifier(distance, weapon.range);
    modifiers.push({
      source: 'distance',
      value: distanceMod,
      type: 'distance',
    });
    
    // 4. Target cover
    const coverMod = -targetTile.coverScore * 0.5; // Cover reduces hit chance
    modifiers.push({
      source: 'target_cover',
      value: coverMod,
      type: 'cover',
    });
    
    // 5. Visibility conditions
    const visibilityMod = (shooterTile.visibilityScore + targetTile.visibilityScore) / 4 - 0.25;
    modifiers.push({
      source: 'visibility',
      value: visibilityMod,
      type: 'accuracy',
    });
    
    // 6. Vehicle speed penalty (for drive-bys)
    if (vehicleSpeed > 0) {
      const speedPenalty = -vehicleSpeed * 0.4; // High speed = less accuracy
      modifiers.push({
        source: 'vehicle_speed',
        value: speedPenalty,
        type: 'accuracy',
      });
    }
    
    // 7. Nerve check (shooting under pressure)
    const nerveMod = this.calculateNerveModifier(shooter, target);
    modifiers.push({
      source: 'nerve',
      value: nerveMod,
      type: 'accuracy',
    });
    
    // 8. Chaos factor (randomness)
    const chaosMod = this.calculateChaosModifier(weapon.chaosFactor);
    modifiers.push({
      source: 'chaos',
      value: chaosMod,
      type: 'chaos',
    });
    
    // Calculate final hit probability
    const totalModifier = modifiers.reduce((sum, m) => sum + m.value, 0);
    const hitProbability = Math.min(
      this.config.maxHitChance,
      Math.max(
        this.config.minHitChance,
        this.config.baseHitChance + totalModifier
      )
    );
    
    // Roll the dice
    const roll = Math.random();
    const hit = roll <= hitProbability;
    const margin = hitProbability - roll;
    
    // Determine outcome
    let outcome: ShotOutcome;
    let damage = 0;
    let isCritical = false;
    
    if (hit) {
      // Check for critical hit
      isCritical = roll <= hitProbability * 0.15; // Top 15% of hits are crits
      
      damage = this.calculateDamage(weapon, target, targetTile, isCritical);
      outcome = isCritical ? 'critical' : 'hit';
    } else if (Math.abs(margin) <= this.config.grazeThreshold) {
      // Close miss = graze
      damage = Math.floor(weapon.damage * 0.25);
      outcome = 'graze';
    } else {
      outcome = 'miss';
    }
    
    return {
      success: hit || outcome === 'graze',
      outcome,
      damage,
      isCritical,
      hitProbability,
      actualRoll: roll,
      modifiers,
      counterFireTriggered: !hit && this.checkCounterFire(target, shooter),
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // MODIFIER CALCULATIONS
  // ─────────────────────────────────────────────────────────────────────────
  
  private calculateShooterAccuracy(shooter: Unit, isCounterFire: boolean): number {
    let base = shooter.accuracy - 0.5; // Normalize around 0
    
    // Reduced accuracy when counter-firing
    if (isCounterFire) {
      base *= 0.7;
    }
    
    // Health affects accuracy
    const healthRatio = shooter.health / shooter.maxHealth;
    if (healthRatio < 0.5) {
      base -= (1 - healthRatio) * 0.2;
    }
    
    return base;
  }
  
  private calculateDistanceModifier(distance: number, weaponRange: number): number {
    // Optimal range is 40-60% of weapon range
    const optimalMin = weaponRange * 0.4;
    const optimalMax = weaponRange * 0.6;
    
    if (distance >= optimalMin && distance <= optimalMax) {
      return 0.05; // Slight bonus at optimal range
    } else if (distance < optimalMin) {
      // Too close - slight penalty
      return -0.05;
    } else if (distance <= weaponRange) {
      // Beyond optimal but within range
      const beyondOptimal = (distance - optimalMax) / (weaponRange - optimalMax);
      return -beyondOptimal * 0.3;
    } else {
      // Beyond range - severe penalty
      const beyondRange = (distance - weaponRange) / weaponRange;
      return -0.3 - beyondRange * 0.4;
    }
  }
  
  private calculateNerveModifier(shooter: Unit, target: Unit): number {
    const nerveDiff = shooter.nerve - 0.5;
    
    // Being shot at reduces nerve effectiveness
    // (simulated by target threat level)
    const threatLevel = target.accuracy * 0.5;
    
    return (nerveDiff - threatLevel) * 0.15;
  }
  
  private calculateChaosModifier(chaosFactor: number): number {
    // Chaos adds unpredictability - can help or hurt
    const chaosImpact = chaosFactor * this.config.chaosCeiling;
    return (Math.random() * 2 - 1) * chaosImpact;
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // DAMAGE CALCULATION
  // ─────────────────────────────────────────────────────────────────────────
  
  private calculateDamage(
    weapon: Weapon,
    target: Unit,
    targetTile: Tile,
    isCritical: boolean
  ): number {
    let baseDamage = weapon.damage;
    
    // Penetration vs armor
    const armorReduction = Math.max(0, target.armorLevel - weapon.penetration) * 0.1;
    baseDamage *= (1 - armorReduction);
    
    // Cover damage reduction
    const coverReduction = targetTile.coverScore * 0.3;
    baseDamage *= (1 - coverReduction);
    
    // Critical multiplier
    if (isCritical) {
      baseDamage *= this.config.criticalMultiplier;
    }
    
    // Add variance (±15%)
    const variance = 1 + (Math.random() * 0.3 - 0.15);
    baseDamage *= variance;
    
    return Math.max(1, Math.floor(baseDamage));
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // COUNTER-FIRE CHECK
  // ─────────────────────────────────────────────────────────────────────────
  
  private checkCounterFire(defender: Unit, attacker: Unit): boolean {
    if (defender.health <= 0 || defender.status !== 'idle') {
      return false;
    }
    
    // Base counter-fire chance modified by defender's nerve
    const counterChance = this.config.counterFireChance * defender.nerve;
    
    return Math.random() <= counterChance;
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // CASUALTY DETERMINATION
  // ─────────────────────────────────────────────────────────────────────────
  
  determineCasualty(unit: Unit, damageDealt: number): Casualty | null {
    const newHealth = unit.health - damageDealt;
    
    if (newHealth <= 0) {
      // Dead or critical
      const survivalRoll = Math.random();
      const survivalChance = unit.nerve * 0.3; // Tough units might survive
      
      if (survivalRoll <= survivalChance) {
        return {
          unitId: unit.id,
          memberId: unit.gangMemberId,
          result: 'critical',
          causedBy: null,
        };
      } else {
        return {
          unitId: unit.id,
          memberId: unit.gangMemberId,
          result: 'dead',
          causedBy: null,
        };
      }
    } else if (newHealth <= unit.maxHealth * 0.3) {
      // Low health = wounded
      return {
        unitId: unit.id,
        memberId: unit.gangMemberId,
        result: 'wounded',
        causedBy: null,
      };
    }
    
    return null;
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // DRIVE-BY SPECIFIC RESOLUTION
  // ─────────────────────────────────────────────────────────────────────────
  
  resolveDriveByPass(params: {
    vehicle: { speed: number; passengers: Array<{ unit: Unit; weapon: Weapon; seat: string }> };
    targets: Array<{ unit: Unit; tile: Tile }>;
    route: Array<{ x: number; y: number }>;
    vehicleTile: Tile;
  }): DriveByResult {
    const { vehicle, targets, route, vehicleTile } = params;
    const events: CombatEvent[] = [];
    const casualties: Casualty[] = [];
    
    // Each passenger takes shots
    for (const passenger of vehicle.passengers) {
      if (!passenger.weapon) continue;
      
      // Passengers can shoot at targets in their firing arc
      for (const target of targets) {
        // Calculate distance
        const distance = Math.sqrt(
          Math.pow(vehicleTile.x - target.tile.x, 2) +
          Math.pow(vehicleTile.y - target.tile.y, 2)
        );
        
        // Resolve the shot
        const result = this.resolveShot({
          shooter: passenger.unit,
          target: target.unit,
          weapon: passenger.weapon,
          shooterTile: vehicleTile,
          targetTile: target.tile,
          distance,
          vehicleSpeed: vehicle.speed,
        });
        
        // Create combat event
        const event: CombatEvent = {
          id: `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          timestamp: new Date().toISOString(),
          type: result.success ? (result.isCritical ? 'critical_hit' : 'hit') : 'miss',
          actorId: passenger.unit.id,
          targetId: target.unit.id,
          tile: { x: target.tile.x, y: target.tile.y },
          weaponUsed: passenger.weapon.id,
          result: {
            success: result.success,
            damage: result.damage,
            hitProbability: result.hitProbability,
            actualRoll: result.actualRoll,
            modifiers: result.modifiers,
          },
          details: {
            seat: passenger.seat,
            vehicleSpeed: vehicle.speed,
            outcome: result.outcome,
          },
        };
        
        events.push(event);
        
        // Check for casualty
        if (result.damage > 0) {
          const casualty = this.determineCasualty(target.unit, result.damage);
          if (casualty) {
            casualty.causedBy = passenger.unit.id;
            casualties.push(casualty);
          }
        }
        
        // Handle counter-fire
        if (result.counterFireTriggered && target.unit.status === 'idle') {
          // Defender shoots back at the vehicle
          // This would trigger another shot resolution...
          events.push({
            id: `evt_${Date.now()}_cf`,
            timestamp: new Date().toISOString(),
            type: 'return_fire',
            actorId: target.unit.id,
            targetId: passenger.unit.id,
            result: { success: false }, // Simplified for now
            details: { counterFireTriggered: true },
          });
        }
      }
    }
    
    return {
      events,
      casualties,
      totalDamageDealt: events.reduce((sum, e) => sum + (e.result.damage || 0), 0),
      shotsFirered: events.filter(e => e.type !== 'return_fire').length,
      hitsLanded: events.filter(e => e.result.success).length,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type ShotOutcome = 'hit' | 'critical' | 'graze' | 'miss';

export interface ShotResult {
  success: boolean;
  outcome: ShotOutcome;
  damage: number;
  isCritical: boolean;
  hitProbability: number;
  actualRoll: number;
  modifiers: CombatModifier[];
  counterFireTriggered: boolean;
}

export interface DriveByResult {
  events: CombatEvent[];
  casualties: Casualty[];
  totalDamageDealt: number;
  shotsFirered: number;
  hitsLanded: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON INSTANCE
// ─────────────────────────────────────────────────────────────────────────────

export const combatResolver = new CombatResolver();

export default CombatResolver;
