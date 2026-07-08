// ============================================================
// roleMechanics.ts — Authoritative role definitions for DEALT/SLIDE
//
// ROLE RULES (source of truth):
//   DEALER    → holds DRUGS only. Generates passive income based on
//               position on block, drug quality, and dealing stat.
//               Cannot hold weapons. Cannot shoot back in drive-bys.
//
//   SHOOTER   → holds WEAPONS only. Does not generate income.
//               Protects dealers during drive-bys and raids.
//               Cannot hold drugs.
//
//   ENFORCER  → holds NOTHING (no equip slot). Patrols the block,
//               acts as security, and strong-arms low-dollar earners
//               for a small passive income bonus. Reduces heat
//               passively by keeping order.
//
//   RECRUIT   → holds RECON TOOLS only (binoculars, burner phones,
//               spray cans). Provides intel on enemy blocks, spots
//               surveillance, steals cars for drive-bys, and can be
//               sent to vandalize opposing blocks.
//
//   DRIVER    → holds VEHICLE KEYS only. Required to launch a
//               drive-by. Without a Driver, the player cannot
//               initiate a SLIDE combat attack.
//
//   CHEMIST   → holds CHEMICALS only. Required to craft drugs in
//               the Alchemy Lab. Cannot be deployed to the block.
//
//   BOSS      → holds ANYTHING. Oversees the operation. Boosts
//               morale of all members on the same block.
// ============================================================

export type MemberRole =
  | 'dealer'
  | 'shooter'
  | 'enforcer'
  | 'recruit'
  | 'driver'
  | 'chemist'
  | 'boss'
  | 'lookout'  // legacy alias for recruit
  | 'runner';  // legacy alias for recruit

export type ItemCategory = 'drug' | 'weapon' | 'armor' | 'vehicle' | 'consumable' | 'tool';

/** What item categories a role is allowed to hold */
export const ROLE_ALLOWED_ITEMS: Record<MemberRole, ItemCategory[]> = {
  dealer:   ['drug'],
  shooter:  ['weapon', 'armor'],
  enforcer: [],
  recruit:  ['tool'],
  driver:   ['vehicle', 'tool'],
  chemist:  ['tool'],
  boss:     ['drug', 'weapon', 'armor', 'vehicle', 'consumable', 'tool'],
  lookout:  ['tool'],   // legacy
  runner:   ['tool'],   // legacy
};

/** Human-readable role descriptions */
export const ROLE_DESCRIPTIONS: Record<MemberRole, string> = {
  dealer:   'Sells product on the block. Holds drugs only. More money closer to the street.',
  shooter:  'Protects the block. Holds weapons only. Returns fire during drive-bys and raids.',
  enforcer: 'Patrols the block. No equip. Strong-arms for small income. Reduces heat passively.',
  recruit:  'Eyes of the block. Holds recon tools. Spots surveillance, steals cars, vandalizes opp blocks.',
  driver:   'Required for drive-bys. Holds vehicle keys. Without a driver, no SLIDE attack can launch.',
  chemist:  'Cooks product in the Alchemy Lab. Cannot be deployed to the block.',
  boss:     'Oversees the operation. Holds anything. Boosts morale of all members on the same block.',
  lookout:  'Watches the block. Holds recon tools.',  // legacy
  runner:   'Runs errands. Holds recon tools.',       // legacy
};

/** Whether a role can be deployed to a block */
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

/** Whether a role generates direct income from dealing */
export const ROLE_GENERATES_INCOME: Record<MemberRole, boolean> = {
  dealer:   true,
  shooter:  false,
  enforcer: false,  // generates small patrol income via enforcer engine
  recruit:  false,
  driver:   false,
  chemist:  false,
  boss:     false,
  lookout:  false,
  runner:   false,
};

/** Whether a role can shoot back during a drive-by or raid */
export const ROLE_CAN_SHOOT: Record<MemberRole, boolean> = {
  dealer:   false,
  shooter:  true,
  enforcer: true,   // can fight but less accurate than shooter
  recruit:  false,
  driver:   false,
  chemist:  false,
  boss:     true,
  lookout:  false,
  runner:   false,
};

/** Enforcer patrol income per tick (small but passive) */
export const ENFORCER_PATROL_INCOME_PER_TICK = 15;

/** Enforcer heat reduction per tick (keeping order) */
export const ENFORCER_HEAT_REDUCTION_PER_TICK = 1;

/** Recruit intel actions */
export const RECRUIT_ACTIONS = {
  SPOT_SURVEILLANCE: 'spot_surveillance',   // detects if a rival is watching the block
  STEAL_CAR:         'steal_car',           // provides a vehicle for a drive-by
  VANDALIZE_BLOCK:   'vandalize_block',     // raises heat on an opp block
  SCOUT_BLOCK:       'scout_block',         // reveals member positions on an opp block
} as const;

export type RecruitAction = typeof RECRUIT_ACTIONS[keyof typeof RECRUIT_ACTIONS];

/**
 * Check if a given role can hold a given item type.
 * This is the single source of truth for equip validation.
 */
export function canRoleHoldItem(role: MemberRole, itemType: ItemCategory): boolean {
  const allowed = ROLE_ALLOWED_ITEMS[role] ?? [];
  return allowed.includes(itemType);
}

/**
 * Get a user-facing error message when an equip is rejected.
 */
export function getEquipRejectionMessage(role: MemberRole, itemType: ItemCategory): string {
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  switch (role) {
    case 'dealer':
      return `${roleLabel}s can only hold drugs. Remove the ${itemType} and give it to a Shooter.`;
    case 'shooter':
      return `${roleLabel}s can only hold weapons and armor. Give drugs to a Dealer.`;
    case 'enforcer':
      return `${roleLabel}s don't hold items — they patrol the block. No equip needed.`;
    case 'recruit':
    case 'lookout':
    case 'runner':
      return `${roleLabel}s can only hold recon tools.`;
    case 'driver':
      return `${roleLabel}s can only hold vehicle keys and tools.`;
    case 'chemist':
      return `${roleLabel}s stay in the lab and can't be equipped for the block.`;
    default:
      return `A ${roleLabel} cannot hold a ${itemType}.`;
  }
}
