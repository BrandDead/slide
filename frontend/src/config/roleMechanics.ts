// ============================================================
// roleMechanics.ts — Complete role, weapon, vehicle, and
// progression system for DEALT/SLIDE
//
// ─── ROLE RULES ──────────────────────────────────────────────
//
//  DEALER   → Drugs only + armor/vest. Cannot shoot. Makes money.
//             Most expensive member on the block.
//             Can be upgraded to CHEMIST (via scaling or black market).
//
//  SHOOTER  → Ranged weapons + armor/vest. Cannot hold drugs.
//             Protects dealers. Tiers: Novice → Marksman → Sharpshooter
//             → Gunsmith (can craft new weapons).
//             Can equip accessories: scopes, lasers, extended mags,
//             drums, and fire-mode switches (semi → full auto).
//
//  ENFORCER → Melee weapons (bats, brass knuckles) + armor/vest.
//             No ranged weapons. Patrols block, strong-arms for small
//             income. Can be a DRIVER.
//
//  RECRUIT  → Knives, tasers + armor/vest. No guns.
//             Makes money by stealing/selling cars or using them for
//             drive-bys and attacks on other blocks.
//             Scales up to: Enforcer, Shooter, or Dealer.
//             More successful missions = more XP = higher tier.
//
//  DRIVER   → Any role can be a driver (Enforcer, Dealer, Recruit,
//             Shooter). While driving, they CANNOT shoot.
//             Can exit the car to attack on foot.
//             Car seat limits apply (4-door = 5 people, 2-door = 2, etc.)
//             Center back seat passenger CANNOT shoot from the car.
//
//  CHEMIST  → Chemicals + lab tools. Cannot be deployed to the block.
//             Synthesizes drugs: Coke→Crack, Meth, MDMA, Fentanyl, etc.
//             Earned by: scaling/upgrading a Dealer, or buying from the
//             black market.
//
//  BOSS     → Holds anything. Boosts morale of all members on same block.
//
// ─── UNIVERSAL ───────────────────────────────────────────────
//  ARMOR / BULLETPROOF VESTS can be given to ANY role.
//  GIFTS (clothing, jewelry, accessories) can be given to ANY role
//  and improve morale + contribute to level upgrades.
// ============================================================

export type MemberRole =
  | 'dealer'
  | 'shooter'
  | 'enforcer'
  | 'recruit'
  | 'driver'
  | 'chemist'
  | 'boss'
  | 'lookout'   // legacy alias → recruit
  | 'runner';   // legacy alias → recruit

export type ItemCategory =
  | 'drug'
  | 'weapon_ranged'
  | 'weapon_melee'
  | 'weapon_accessory'   // scopes, lasers, mags, switches
  | 'armor'              // bulletproof vests — universal
  | 'vehicle'
  | 'consumable'
  | 'tool'               // recon tools (binoculars, burner phones)
  | 'gift'               // clothing, jewelry — morale/level boost
  | 'chemical';          // chemist lab supplies

// ─── WHAT EACH ROLE CAN HOLD ─────────────────────────────────
export const ROLE_ALLOWED_ITEMS: Record<MemberRole, ItemCategory[]> = {
  // Dealers: drugs + armor. No weapons.
  dealer:   ['drug', 'armor', 'gift'],

  // Shooters: ranged weapons + accessories + armor.
  shooter:  ['weapon_ranged', 'weapon_accessory', 'armor', 'gift'],

  // Enforcers: melee only + armor. No guns.
  enforcer: ['weapon_melee', 'armor', 'gift'],

  // Recruits: knives/tasers + armor. No guns.
  recruit:  ['weapon_melee', 'tool', 'armor', 'gift'],

  // Drivers: vehicle keys + armor. While driving, cannot shoot.
  driver:   ['vehicle', 'armor', 'gift'],

  // Chemists: chemicals + lab tools. Lab only.
  chemist:  ['chemical', 'tool', 'armor', 'gift'],

  // Boss: everything.
  boss:     ['drug', 'weapon_ranged', 'weapon_melee', 'weapon_accessory',
             'armor', 'vehicle', 'consumable', 'tool', 'gift', 'chemical'],

  // Legacy aliases
  lookout:  ['weapon_melee', 'tool', 'armor', 'gift'],
  runner:   ['weapon_melee', 'tool', 'armor', 'gift'],
};

// ─── CAN SHOOT (ranged) ──────────────────────────────────────
export const ROLE_CAN_SHOOT_RANGED: Record<MemberRole, boolean> = {
  dealer:   false,
  shooter:  true,
  enforcer: false,  // melee only
  recruit:  false,
  driver:   false,  // cannot shoot while driving
  chemist:  false,
  boss:     true,
  lookout:  false,
  runner:   false,
};

// ─── CAN FIGHT (melee) ───────────────────────────────────────
export const ROLE_CAN_FIGHT_MELEE: Record<MemberRole, boolean> = {
  dealer:   false,
  shooter:  false,  // shooters use guns, not melee
  enforcer: true,
  recruit:  true,
  driver:   false,
  chemist:  false,
  boss:     true,
  lookout:  true,
  runner:   true,
};

// ─── CAN DRIVE ───────────────────────────────────────────────
// Any role can drive. While driving they cannot shoot.
export const ROLE_CAN_DRIVE: Record<MemberRole, boolean> = {
  dealer:   true,
  shooter:  true,
  enforcer: true,
  recruit:  true,
  driver:   true,
  chemist:  false,
  boss:     true,
  lookout:  true,
  runner:   true,
};

// ─── GENERATES INCOME ────────────────────────────────────────
export const ROLE_GENERATES_INCOME: Record<MemberRole, boolean> = {
  dealer:   true,   // passive drug income
  shooter:  false,
  enforcer: true,   // small patrol/strong-arm income
  recruit:  true,   // car theft income
  driver:   false,
  chemist:  false,
  boss:     false,
  lookout:  true,
  runner:   true,
};

// ─── CAN BE DEPLOYED TO BLOCK ────────────────────────────────
export const ROLE_CAN_DEPLOY: Record<MemberRole, boolean> = {
  dealer:   true,
  shooter:  true,
  enforcer: true,
  recruit:  true,
  driver:   true,
  chemist:  false,  // stays in the lab
  boss:     true,
  lookout:  true,
  runner:   true,
};

// ─── VEHICLE SEAT RULES ──────────────────────────────────────
export type VehicleType = '4door' | '2door' | 'suv' | 'van' | 'motorcycle';

export interface VehicleSeatConfig {
  totalSeats: number;
  shooterSeats: number;     // seats that can shoot from the car
  driverSeat: 1;            // always 1 driver
  centerBackSeat: boolean;  // if true, center back passenger cannot shoot
}

export const VEHICLE_SEAT_CONFIGS: Record<VehicleType, VehicleSeatConfig> = {
  '4door':     { totalSeats: 5, shooterSeats: 3, driverSeat: 1, centerBackSeat: true },
  '2door':     { totalSeats: 2, shooterSeats: 1, driverSeat: 1, centerBackSeat: false },
  'suv':       { totalSeats: 7, shooterSeats: 5, driverSeat: 1, centerBackSeat: false },
  'van':       { totalSeats: 8, shooterSeats: 6, driverSeat: 1, centerBackSeat: false },
  'motorcycle':{ totalSeats: 2, shooterSeats: 1, driverSeat: 1, centerBackSeat: false },
};

// ─── SHOOTER TIERS ───────────────────────────────────────────
export type ShooterTier =
  | 'novice'       // Level 1-4: basic accuracy, standard weapons
  | 'gunner'       // Level 5-9: improved accuracy, can use extended mags
  | 'marksman'     // Level 10-14: high accuracy, can equip scopes/lasers
  | 'sharpshooter' // Level 15-19: very high accuracy, can add fire switches
  | 'gunsmith';    // Level 20+: can CRAFT new weapons, modify existing ones

export function getShooterTier(level: number): ShooterTier {
  if (level >= 20) return 'gunsmith';
  if (level >= 15) return 'sharpshooter';
  if (level >= 10) return 'marksman';
  if (level >= 5)  return 'gunner';
  return 'novice';
}

export const SHOOTER_TIER_LABELS: Record<ShooterTier, string> = {
  novice:       'Novice',
  gunner:       'Gunner',
  marksman:     'Marksman',
  sharpshooter: 'Sharpshooter',
  gunsmith:     'Gunsmith',
};

// Accuracy bonus per tier (additive %)
export const SHOOTER_TIER_ACCURACY_BONUS: Record<ShooterTier, number> = {
  novice:       0,
  gunner:       10,
  marksman:     20,
  sharpshooter: 35,
  gunsmith:     50,
};

// ─── WEAPON ACCESSORIES ──────────────────────────────────────
export interface WeaponAccessory {
  id: string;
  name: string;
  slot: 'optic' | 'barrel' | 'magazine' | 'grip' | 'switch';
  requiredTier: ShooterTier;
  accuracyBonus: number;    // % accuracy improvement
  damageBonus: number;      // flat damage bonus
  magCapacityBonus: number; // extra rounds
  rpmMultiplier: number;    // rounds per minute multiplier (1.0 = no change)
  description: string;
}

export const WEAPON_ACCESSORIES: WeaponAccessory[] = [
  // Optics
  { id: 'red_dot',      name: 'Red Dot Sight',    slot: 'optic',    requiredTier: 'novice',       accuracyBonus: 8,  damageBonus: 0,  magCapacityBonus: 0,  rpmMultiplier: 1.0, description: 'Basic red dot. Improves close-range accuracy.' },
  { id: 'scope_4x',     name: '4x Scope',         slot: 'optic',    requiredTier: 'marksman',     accuracyBonus: 20, damageBonus: 0,  magCapacityBonus: 0,  rpmMultiplier: 0.9, description: 'Long-range scope. Slows fire rate slightly.' },
  { id: 'laser_sight',  name: 'Laser Sight',      slot: 'optic',    requiredTier: 'gunner',       accuracyBonus: 12, damageBonus: 0,  magCapacityBonus: 0,  rpmMultiplier: 1.0, description: 'Green laser. Intimidates targets, improves hip-fire.' },

  // Barrels
  { id: 'suppressor',   name: 'Suppressor',       slot: 'barrel',   requiredTier: 'marksman',     accuracyBonus: 5,  damageBonus: -2, magCapacityBonus: 0,  rpmMultiplier: 1.0, description: 'Reduces heat generated per shot. Slight damage loss.' },
  { id: 'comp',         name: 'Compensator',      slot: 'barrel',   requiredTier: 'gunner',       accuracyBonus: 10, damageBonus: 0,  magCapacityBonus: 0,  rpmMultiplier: 1.0, description: 'Reduces recoil. Improves sustained fire accuracy.' },

  // Magazines
  { id: 'ext_mag_30',   name: '30-Round Mag',     slot: 'magazine', requiredTier: 'novice',       accuracyBonus: 0,  damageBonus: 0,  magCapacityBonus: 15, rpmMultiplier: 1.0, description: 'Extended magazine. More rounds before reload.' },
  { id: 'ext_mag_50',   name: '50-Round Drum',    slot: 'magazine', requiredTier: 'gunner',       accuracyBonus: -5, damageBonus: 0,  magCapacityBonus: 35, rpmMultiplier: 1.0, description: 'Drum magazine. Huge capacity but slightly less accurate.' },
  { id: 'drum_100',     name: '100-Round Belt',   slot: 'magazine', requiredTier: 'marksman',     accuracyBonus: -10, damageBonus: 0, magCapacityBonus: 85, rpmMultiplier: 1.1, description: 'Belt-fed drum. Suppressive fire capability.' },

  // Switches (fire mode)
  { id: 'switch_auto',  name: 'Auto Switch',      slot: 'switch',   requiredTier: 'sharpshooter', accuracyBonus: -15, damageBonus: 0, magCapacityBonus: 0,  rpmMultiplier: 3.0, description: 'Converts semi-auto pistol to full-auto (Glock switch). Massive RPM, reduced accuracy.' },
  { id: 'switch_burst', name: 'Burst Fire Mod',   slot: 'switch',   requiredTier: 'marksman',     accuracyBonus: 5,  damageBonus: 2,  magCapacityBonus: 0,  rpmMultiplier: 1.5, description: '3-round burst. Better accuracy than full-auto with more damage per trigger pull.' },
];

// ─── MEMBER SCALING / UPGRADE PATHS ──────────────────────────
export interface UpgradePath {
  fromRole: MemberRole;
  toRole: MemberRole;
  requiredLevel: number;
  requiredMissions: number;
  cost: number;
  description: string;
}

export const UPGRADE_PATHS: UpgradePath[] = [
  // Recruit can scale to any combat role
  { fromRole: 'recruit', toRole: 'enforcer', requiredLevel: 5,  requiredMissions: 10, cost: 0,     description: 'Recruit earns their stripes. Promoted to Enforcer.' },
  { fromRole: 'recruit', toRole: 'shooter',  requiredLevel: 8,  requiredMissions: 15, cost: 0,     description: 'Recruit proves their aim. Promoted to Shooter.' },
  { fromRole: 'recruit', toRole: 'dealer',   requiredLevel: 6,  requiredMissions: 8,  cost: 0,     description: 'Recruit learns the trade. Promoted to Dealer.' },

  // Dealer can scale to Chemist
  { fromRole: 'dealer',  toRole: 'chemist',  requiredLevel: 12, requiredMissions: 20, cost: 5000,  description: 'Dealer learns to cook. Promoted to Chemist.' },

  // Enforcer can scale to Shooter
  { fromRole: 'enforcer', toRole: 'shooter', requiredLevel: 10, requiredMissions: 18, cost: 2000,  description: 'Enforcer picks up a gun. Promoted to Shooter.' },

  // Lookout/Runner (legacy) → Recruit
  { fromRole: 'lookout', toRole: 'recruit',  requiredLevel: 1,  requiredMissions: 0,  cost: 0,     description: 'Lookout reclassified as Recruit.' },
  { fromRole: 'runner',  toRole: 'recruit',  requiredLevel: 1,  requiredMissions: 0,  cost: 0,     description: 'Runner reclassified as Recruit.' },
];

// ─── GIFT SYSTEM ─────────────────────────────────────────────
export interface GiftItem {
  id: string;
  name: string;
  category: 'clothing' | 'jewelry' | 'accessory' | 'weapon_gift';
  moraleBonus: number;    // flat morale increase
  xpBonus: number;        // XP toward next level
  cost: number;
  description: string;
}

export const GIFT_CATALOG: GiftItem[] = [
  // Clothing
  { id: 'fresh_kicks',    name: 'Fresh Kicks',         category: 'clothing',    moraleBonus: 5,  xpBonus: 50,  cost: 200,  description: 'New shoes. Member feels respected.' },
  { id: 'designer_fit',   name: 'Designer Fit',        category: 'clothing',    moraleBonus: 12, xpBonus: 120, cost: 800,  description: 'Full designer outfit. Major morale boost.' },
  { id: 'hoodie',         name: 'Hoodie',              category: 'clothing',    moraleBonus: 3,  xpBonus: 20,  cost: 80,   description: 'Comfortable and low-key.' },

  // Jewelry
  { id: 'chain_gold',     name: 'Gold Chain',          category: 'jewelry',     moraleBonus: 10, xpBonus: 100, cost: 500,  description: 'Gold chain. Member feels like a boss.' },
  { id: 'chain_diamond',  name: 'Diamond Chain',       category: 'jewelry',     moraleBonus: 20, xpBonus: 250, cost: 2500, description: 'Iced out. Massive morale and loyalty boost.' },
  { id: 'watch',          name: 'AP Watch',            category: 'jewelry',     moraleBonus: 15, xpBonus: 180, cost: 1500, description: 'Audemars Piguet. Status symbol.' },
  { id: 'ring',           name: 'Pinky Ring',          category: 'jewelry',     moraleBonus: 8,  xpBonus: 80,  cost: 400,  description: 'Gold pinky ring. Respect on the block.' },

  // Accessories
  { id: 'phone',          name: 'Burner Phone',        category: 'accessory',   moraleBonus: 4,  xpBonus: 40,  cost: 150,  description: 'Encrypted burner. Better communication.' },
  { id: 'vest_gift',      name: 'Bulletproof Vest',    category: 'accessory',   moraleBonus: 8,  xpBonus: 60,  cost: 600,  description: 'Protection. Member knows you care.' },

  // Weapon gifts (for shooters/enforcers)
  { id: 'glock_gift',     name: 'Glock 19',            category: 'weapon_gift', moraleBonus: 15, xpBonus: 200, cost: 1200, description: 'Personal piece. Shooter feels equipped.' },
  { id: 'ak47_gift',      name: 'AK-47',               category: 'weapon_gift', moraleBonus: 25, xpBonus: 350, cost: 3500, description: 'The big dog. Shooter loyalty goes way up.' },
];

// ─── CHEMIST DRUG SYNTHESIS ──────────────────────────────────
export interface DrugRecipe {
  id: string;
  outputDrug: string;
  outputName: string;
  inputs: Array<{ itemId: string; name: string; quantity: number }>;
  requiredChemistLevel: number;
  yieldQuantity: number;
  purity: number;        // 0-100
  odRisk: number;        // 0-100
  streetValue: number;   // per unit
  description: string;
}

export const CHEMIST_RECIPES: DrugRecipe[] = [
  { id: 'cook_crack',     outputDrug: 'crack',        outputName: 'Crack',        inputs: [{ itemId: 'coke', name: 'Cocaine', quantity: 2 }, { itemId: 'baking_soda', name: 'Baking Soda', quantity: 1 }], requiredChemistLevel: 1,  yieldQuantity: 3,  purity: 70, odRisk: 30, streetValue: 80,  description: 'Convert powder cocaine to crack rocks.' },
  { id: 'cook_meth',      outputDrug: 'meth',         outputName: 'Meth',         inputs: [{ itemId: 'pseudo', name: 'Pseudoephedrine', quantity: 3 }, { itemId: 'chemicals', name: 'Lab Chemicals', quantity: 2 }], requiredChemistLevel: 3,  yieldQuantity: 4,  purity: 80, odRisk: 45, streetValue: 120, description: 'Cook crystal meth. Requires lab setup.' },
  { id: 'cook_mdma',      outputDrug: 'mdma',         outputName: 'MDMA',         inputs: [{ itemId: 'safrole', name: 'Safrole', quantity: 2 }, { itemId: 'chemicals', name: 'Lab Chemicals', quantity: 3 }], requiredChemistLevel: 4,  yieldQuantity: 5,  purity: 85, odRisk: 25, streetValue: 150, description: 'Synthesize pure MDMA. High value, lower OD risk.' },
  { id: 'cook_fentanyl',  outputDrug: 'fentanyl',     outputName: 'Fentanyl',     inputs: [{ itemId: 'precursor', name: 'Fentanyl Precursor', quantity: 1 }, { itemId: 'chemicals', name: 'Lab Chemicals', quantity: 4 }], requiredChemistLevel: 8,  yieldQuantity: 10, purity: 95, odRisk: 90, streetValue: 300, description: 'Extremely potent. High value but very high OD risk. Will spike heat if customers die.' },
  { id: 'cook_heroin',    outputDrug: 'heroin',       outputName: 'Heroin',       inputs: [{ itemId: 'opium', name: 'Opium', quantity: 3 }, { itemId: 'chemicals', name: 'Lab Chemicals', quantity: 2 }], requiredChemistLevel: 5,  yieldQuantity: 4,  purity: 75, odRisk: 60, streetValue: 200, description: 'Process opium into heroin. High demand, high risk.' },
  { id: 'cook_blue_sky',  outputDrug: 'blue_sky',     outputName: 'Blue Sky',     inputs: [{ itemId: 'meth', name: 'Meth', quantity: 2 }, { itemId: 'catalyst', name: 'Secret Catalyst', quantity: 1 }], requiredChemistLevel: 15, yieldQuantity: 2,  purity: 99, odRisk: 70, streetValue: 800, description: 'Legendary 99% pure meth. Massive income but extreme heat risk.' },
];

// ─── VALIDATION HELPERS ──────────────────────────────────────

/** Check if a role can hold a given item category */
export function canRoleHoldItem(role: MemberRole, itemType: ItemCategory): boolean {
  // Armor and gifts are universal
  if (itemType === 'armor' || itemType === 'gift') return true;
  const allowed = ROLE_ALLOWED_ITEMS[role] ?? [];
  return allowed.includes(itemType);
}

/** Get a user-facing error message when an equip is rejected */
export function getEquipRejectionMessage(role: MemberRole, itemType: ItemCategory): string {
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  switch (itemType) {
    case 'drug':
      return `${roleLabel}s can't hold drugs. Only Dealers carry product.`;
    case 'weapon_ranged':
      if (role === 'enforcer') return `Enforcers don't use guns — give them a bat or brass knuckles.`;
      if (role === 'recruit')  return `Recruits carry knives and tasers, not guns. Level them up to a Shooter first.`;
      if (role === 'dealer')   return `Dealers don't carry guns — that's what Shooters are for.`;
      return `${roleLabel}s cannot use ranged weapons.`;
    case 'weapon_melee':
      if (role === 'shooter')  return `Shooters use guns, not melee weapons.`;
      if (role === 'dealer')   return `Dealers don't fight. Get a Shooter or Enforcer for protection.`;
      return `${roleLabel}s cannot use melee weapons.`;
    case 'weapon_accessory':
      return `Only Shooters can equip weapon accessories. Upgrade this member to a Shooter first.`;
    case 'chemical':
      return `Only Chemists work with chemicals. Upgrade a Dealer to Chemist first.`;
    case 'vehicle':
      return `${roleLabel}s cannot drive. Assign a Driver role or use any member as a driver.`;
    default:
      return `A ${roleLabel} cannot hold a ${itemType}.`;
  }
}

/** Check if a shooter can equip a specific accessory based on their tier */
export function canEquipAccessory(shooterLevel: number, accessoryId: string): boolean {
  const accessory = WEAPON_ACCESSORIES.find((a) => a.id === accessoryId);
  if (!accessory) return false;
  const tier = getShooterTier(shooterLevel);
  const tierOrder: ShooterTier[] = ['novice', 'gunner', 'marksman', 'sharpshooter', 'gunsmith'];
  const memberTierIndex = tierOrder.indexOf(tier);
  const requiredTierIndex = tierOrder.indexOf(accessory.requiredTier);
  return memberTierIndex >= requiredTierIndex;
}

/** Check if a member can be upgraded to a new role */
export function canUpgradeToRole(
  fromRole: MemberRole,
  toRole: MemberRole,
  level: number,
  completedMissions: number,
  money: number,
): { eligible: boolean; reason?: string } {
  const path = UPGRADE_PATHS.find((p) => p.fromRole === fromRole && p.toRole === toRole);
  if (!path) return { eligible: false, reason: `No upgrade path from ${fromRole} to ${toRole}.` };
  if (level < path.requiredLevel) return { eligible: false, reason: `Needs level ${path.requiredLevel} (currently ${level}).` };
  if (completedMissions < path.requiredMissions) return { eligible: false, reason: `Needs ${path.requiredMissions} missions (completed ${completedMissions}).` };
  if (money < path.cost) return { eligible: false, reason: `Costs $${path.cost.toLocaleString()} (have $${money.toLocaleString()}).` };
  return { eligible: true };
}
