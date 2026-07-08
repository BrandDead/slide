// ============================================================
// weaponSystem.ts — Weapon definitions, accessory stacking,
// and shooter tier combat calculations for DEALT/SLIDE
// ============================================================

import {
  WEAPON_ACCESSORIES,
  SHOOTER_TIER_ACCURACY_BONUS,
  getShooterTier,
  canEquipAccessory,
  type WeaponAccessory,
  type ShooterTier,
} from '../config/roleMechanics';

// ─── BASE WEAPONS ────────────────────────────────────────────

export interface BaseWeapon {
  id: string;
  name: string;
  category: 'pistol' | 'smg' | 'shotgun' | 'rifle' | 'melee';
  damage: number;
  baseMagCapacity: number;
  baseRPM: number;          // rounds per minute (semi-auto default)
  baseAccuracy: number;     // 0-100
  range: number;            // grid tiles
  canHaveSwitch: boolean;   // can a fire-mode switch be added?
  defaultFireMode: 'semi' | 'burst' | 'auto';
  cost: number;
  description: string;
}

export const BASE_WEAPONS: BaseWeapon[] = [
  // Pistols
  { id: 'glock17',    name: 'Glock 17',       category: 'pistol',  damage: 22, baseMagCapacity: 17, baseRPM: 120,  baseAccuracy: 65, range: 4, canHaveSwitch: true,  defaultFireMode: 'semi',  cost: 800,  description: 'Standard 9mm. Reliable and concealable.' },
  { id: 'glock19',    name: 'Glock 19',       category: 'pistol',  damage: 20, baseMagCapacity: 15, baseRPM: 120,  baseAccuracy: 68, range: 4, canHaveSwitch: true,  defaultFireMode: 'semi',  cost: 900,  description: 'Compact 9mm. Most popular on the street.' },
  { id: 'desert_eagle', name: 'Desert Eagle', category: 'pistol',  damage: 45, baseMagCapacity: 7,  baseRPM: 60,   baseAccuracy: 55, range: 5, canHaveSwitch: false, defaultFireMode: 'semi',  cost: 2200, description: '.50 cal hand cannon. Slow but devastating.' },
  { id: 'mac10',      name: 'MAC-10',         category: 'smg',     damage: 18, baseMagCapacity: 30, baseRPM: 900,  baseAccuracy: 45, range: 3, canHaveSwitch: false, defaultFireMode: 'auto',  cost: 1500, description: 'Spray and pray. High RPM, low accuracy.' },

  // SMGs
  { id: 'uzi',        name: 'Uzi',            category: 'smg',     damage: 20, baseMagCapacity: 32, baseRPM: 600,  baseAccuracy: 50, range: 3, canHaveSwitch: false, defaultFireMode: 'auto',  cost: 1800, description: 'Classic street SMG. Good for close range.' },
  { id: 'tec9',       name: 'TEC-9',          category: 'smg',     damage: 19, baseMagCapacity: 32, baseRPM: 700,  baseAccuracy: 40, range: 3, canHaveSwitch: false, defaultFireMode: 'auto',  cost: 1200, description: 'Cheap and nasty. High capacity.' },

  // Shotguns
  { id: 'mossberg',   name: 'Mossberg 500',   category: 'shotgun', damage: 55, baseMagCapacity: 6,  baseRPM: 30,   baseAccuracy: 70, range: 2, canHaveSwitch: false, defaultFireMode: 'semi',  cost: 1100, description: 'Pump-action. Devastating at close range.' },
  { id: 'spas12',     name: 'SPAS-12',        category: 'shotgun', damage: 60, baseMagCapacity: 8,  baseRPM: 40,   baseAccuracy: 65, range: 2, canHaveSwitch: false, defaultFireMode: 'semi',  cost: 2000, description: 'Semi-auto shotgun. Fast follow-up shots.' },

  // Rifles
  { id: 'ak47',       name: 'AK-47',          category: 'rifle',   damage: 35, baseMagCapacity: 30, baseRPM: 600,  baseAccuracy: 60, range: 6, canHaveSwitch: false, defaultFireMode: 'auto',  cost: 3500, description: 'Workhorse. Reliable in any condition.' },
  { id: 'ar15',       name: 'AR-15',          category: 'rifle',   damage: 32, baseMagCapacity: 30, baseRPM: 700,  baseAccuracy: 72, range: 7, canHaveSwitch: false, defaultFireMode: 'semi',  cost: 4000, description: 'Accurate semi-auto. Marksman favorite.' },
  { id: 'draco',      name: 'Draco',          category: 'rifle',   damage: 33, baseMagCapacity: 30, baseRPM: 650,  baseAccuracy: 55, range: 5, canHaveSwitch: false, defaultFireMode: 'auto',  cost: 2800, description: 'AK pistol. Compact but powerful.' },

  // Melee (for Enforcers and Recruits)
  { id: 'baseball_bat', name: 'Baseball Bat', category: 'melee',   damage: 30, baseMagCapacity: 0,  baseRPM: 0,    baseAccuracy: 80, range: 1, canHaveSwitch: false, defaultFireMode: 'semi',  cost: 50,   description: 'Classic. Enforcers love this.' },
  { id: 'brass_knuckles', name: 'Brass Knuckles', category: 'melee', damage: 20, baseMagCapacity: 0, baseRPM: 0,   baseAccuracy: 90, range: 1, canHaveSwitch: false, defaultFireMode: 'semi',  cost: 80,   description: 'Silent and brutal. No noise = no heat.' },
  { id: 'machete',    name: 'Machete',        category: 'melee',   damage: 40, baseMagCapacity: 0,  baseRPM: 0,    baseAccuracy: 75, range: 1, canHaveSwitch: false, defaultFireMode: 'semi',  cost: 120,  description: 'Intimidating. Enforcers use for strong-arming.' },
  { id: 'knife',      name: 'Knife',          category: 'melee',   damage: 15, baseMagCapacity: 0,  baseRPM: 0,    baseAccuracy: 85, range: 1, canHaveSwitch: false, defaultFireMode: 'semi',  cost: 30,   description: 'Recruits start with this.' },
  { id: 'taser',      name: 'Taser',          category: 'melee',   damage: 10, baseMagCapacity: 0,  baseRPM: 0,    baseAccuracy: 70, range: 1, canHaveSwitch: false, defaultFireMode: 'semi',  cost: 200,  description: 'Non-lethal. Stuns target. Recruits carry these.' },
];

// ─── EQUIPPED WEAPON STATE ───────────────────────────────────

export interface EquippedWeapon {
  baseWeaponId: string;
  accessories: string[];     // list of accessory IDs equipped
  currentAmmo: number;
  fireMode: 'semi' | 'burst' | 'auto';
}

export interface WeaponStats {
  name: string;
  damage: number;
  magCapacity: number;
  rpm: number;
  accuracy: number;
  range: number;
  fireMode: 'semi' | 'burst' | 'auto';
  accessories: WeaponAccessory[];
}

/**
 * Calculate the final stats of a weapon with all accessories applied.
 */
export function calculateWeaponStats(
  equipped: EquippedWeapon,
  shooterLevel: number,
): WeaponStats | null {
  const base = BASE_WEAPONS.find((w) => w.id === equipped.baseWeaponId);
  if (!base) return null;

  const tier = getShooterTier(shooterLevel);
  const tierAccuracyBonus = SHOOTER_TIER_ACCURACY_BONUS[tier];

  let damage = base.damage;
  let magCapacity = base.baseMagCapacity;
  let rpm = base.baseRPM;
  let accuracy = base.baseAccuracy + tierAccuracyBonus;
  let fireMode = equipped.fireMode;
  const appliedAccessories: WeaponAccessory[] = [];

  for (const accId of equipped.accessories) {
    // Validate the shooter can use this accessory
    if (!canEquipAccessory(shooterLevel, accId)) continue;

    const acc = WEAPON_ACCESSORIES.find((a) => a.id === accId);
    if (!acc) continue;

    damage += acc.damageBonus;
    magCapacity += acc.magCapacityBonus;
    rpm = Math.round(rpm * acc.rpmMultiplier);
    accuracy += acc.accuracyBonus;

    // Fire mode switch
    if (acc.slot === 'switch') {
      if (acc.id === 'switch_auto' && base.canHaveSwitch) {
        fireMode = 'auto';
      } else if (acc.id === 'switch_burst') {
        fireMode = 'burst';
      }
    }

    appliedAccessories.push(acc);
  }

  return {
    name: base.name,
    damage: Math.max(1, damage),
    magCapacity: Math.max(1, magCapacity),
    rpm: Math.max(30, rpm),
    accuracy: Math.min(100, Math.max(5, accuracy)),
    range: base.range,
    fireMode,
    accessories: appliedAccessories,
  };
}

/**
 * Calculate the probability of a hit given weapon stats and distance.
 */
export function calculateHitProbability(
  weaponStats: WeaponStats,
  distance: number,
  inCover: boolean,
): number {
  // Base accuracy drops with distance beyond weapon range
  const rangePenalty = Math.max(0, (distance - weaponStats.range) * 10);
  const coverBonus = inCover ? 30 : 0;
  const finalAccuracy = Math.max(5, weaponStats.accuracy - rangePenalty - coverBonus);
  return finalAccuracy / 100;
}

/**
 * Calculate damage per shot accounting for fire mode.
 */
export function calculateDamagePerShot(weaponStats: WeaponStats): number {
  if (weaponStats.fireMode === 'burst') {
    // Burst fires 3 rounds; each has reduced accuracy but combined damage
    return weaponStats.damage * 2.5;
  }
  return weaponStats.damage;
}

/**
 * Get the available accessories for a shooter based on their level.
 */
export function getAvailableAccessories(shooterLevel: number): WeaponAccessory[] {
  return WEAPON_ACCESSORIES.filter((acc) => canEquipAccessory(shooterLevel, acc.id));
}

/**
 * Get the available base weapons for a role.
 */
export function getWeaponsForRole(role: string): BaseWeapon[] {
  if (role === 'enforcer' || role === 'recruit') {
    return BASE_WEAPONS.filter((w) => w.category === 'melee');
  }
  if (role === 'shooter' || role === 'boss') {
    return BASE_WEAPONS.filter((w) => w.category !== 'melee');
  }
  return [];
}
