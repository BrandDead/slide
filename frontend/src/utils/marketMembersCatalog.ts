// ============================================================
// marketMembersCatalog — hireable members on the underworld
// Sprint 15-B
//
// Members bought here come pre-leveled. You're paying to skip the
// grind, and the price reflects it. The higher tiers carry baggage:
// a legend shooter draws police like a magnet, a certified dealer
// with a habit skims. Every listing states the catch honestly —
// the player's choice is whether the ceiling is worth the tax.
//
// Listings are generated rather than hardcoded so the board is
// different every refresh, but the tier bands are fixed so pricing
// stays legible.
// ============================================================

import type {
  HireableMember,
  HireableRole,
  HireableTier,
  MemberOriginStory,
  SpecialPerson,
  SpecialPersonRelation,
} from '../types/game.types';

// ─── Tier bands ──────────────────────────────────────────────

interface TierBand {
  levelRange: [number, number];
  priceMultiplier: number;
  loyaltyRange: [number, number];
  heatFactorRange: [number, number];
  statFloor: number;
  statCeiling: number;
  /** Odds this tier's listing carries a warning. */
  baggageChance: number;
  label: string;
  blurb: string;
}

export const TIER_BANDS: Record<HireableTier, TierBand> = {
  street: {
    levelRange: [1, 2],
    priceMultiplier: 1,
    loyaltyRange: [55, 75],
    heatFactorRange: [0.8, 1.0],
    statFloor: 20,
    statCeiling: 40,
    baggageChance: 0.1,
    label: 'STREET',
    blurb: 'Fresh off the corner. Cheap, loyal enough, needs work.',
  },
  seasoned: {
    levelRange: [3, 5],
    priceMultiplier: 3.2,
    loyaltyRange: [45, 65],
    heatFactorRange: [1.0, 1.3],
    statFloor: 40,
    statCeiling: 62,
    baggageChance: 0.3,
    label: 'SEASONED',
    blurb: 'Been around. Knows the work, knows their worth.',
  },
  certified: {
    levelRange: [6, 8],
    priceMultiplier: 8.5,
    loyaltyRange: [35, 55],
    heatFactorRange: [1.3, 1.7],
    statFloor: 60,
    statCeiling: 82,
    baggageChance: 0.55,
    label: 'CERTIFIED',
    blurb: 'Proven. Expensive. Comes with a file at the precinct.',
  },
  legend: {
    levelRange: [9, 12],
    priceMultiplier: 22,
    loyaltyRange: [25, 45],
    heatFactorRange: [1.7, 2.4],
    statFloor: 78,
    statCeiling: 97,
    baggageChance: 0.85,
    label: 'LEGEND',
    blurb: 'Everybody knows the name. Including the task force.',
  },
};

// ─── Role base pricing & specialization ──────────────────────

interface RoleProfile {
  basePrice: number;
  baseSalary: number;
  label: string;
  /** Which stat this role is strongest in. */
  primary: 'shooting' | 'dealing' | 'nerve' | 'stealth';
  description: string;
}

export const ROLE_PROFILES: Record<HireableRole, RoleProfile> = {
  recruit: {
    basePrice: 800,
    baseSalary: 120,
    label: 'RECRUIT',
    primary: 'nerve',
    description: 'Runs errands, watches blocks, levels into anything.',
  },
  dealer: {
    basePrice: 2_200,
    baseSalary: 260,
    label: 'DEALER',
    primary: 'dealing',
    description: 'Moves product. Higher level means bigger deals.',
  },
  shooter: {
    basePrice: 3_400,
    baseSalary: 340,
    label: 'SHOOTER',
    primary: 'shooting',
    description: 'Holds the block down. Fewer missed shots at level.',
  },
  enforcer: {
    basePrice: 4_100,
    baseSalary: 420,
    label: 'ENFORCER',
    primary: 'nerve',
    description: 'Collects, intimidates, handles spies on the block.',
  },
  driver: {
    basePrice: 2_600,
    baseSalary: 240,
    label: 'DRIVER',
    primary: 'stealth',
    description: 'Wheels for slides and getaways. Keeps the car clean.',
  },
  lookout: {
    basePrice: 1_400,
    baseSalary: 160,
    label: 'LOOKOUT',
    primary: 'stealth',
    description: 'Calls out cops and opps before they turn the corner.',
  },
  k9: {
    basePrice: 5_200,
    baseSalary: 90,
    label: 'K9',
    primary: 'nerve',
    description: 'Handles spies the way a person cannot. Cheap to keep.',
  },
};

// ─── Name pools ──────────────────────────────────────────────

const FIRST_NAMES = [
  'Marcus', 'Dre', 'Terrell', 'Jamal', 'Quan', 'Rico', 'Deshawn', 'Malik',
  'Tyrone', 'Cedric', 'Andre', 'Darnell', 'Kendrick', 'Rashad', 'Jerome',
  'Xavier', 'Trevon', 'Lamar', 'Devante', 'Corey', 'Damon', 'Isaiah',
  'Nia', 'Keisha', 'Shanice', 'Tamika', 'Brianna', 'Latoya', 'Jasmine',
];

const NICKNAMES = [
  'Smoke', 'Ghost', 'Trigger', 'Slim', 'Ace', 'Blue', 'Reaper', 'Cash',
  'Wolf', 'Zip', 'Cobra', 'Havoc', 'Pistol', 'Rook', 'Static', 'Grave',
  'Nickel', 'Deuce', 'Flip', 'Iron', 'Shadow', 'Bishop', 'Rebel', 'Vex',
];

const K9_NAMES = [
  'Zeus', 'Diesel', 'Killa', 'Tank', 'Brutus', 'Onyx', 'Rex', 'Bane',
  'Titan', 'Nitro', 'Rocco', 'Blitz', 'Havoc', 'Cain',
];

const K9_BREEDS = [
  'Pit Bull', 'Cane Corso', 'Rottweiler', 'Presa Canario', 'Dogo Argentino',
  'Belgian Malinois', 'American Bully',
];

const LAST_NAMES = [
  'Boyd', 'Waller', 'Crews', 'Sampson', 'Vance', 'Kearse', 'Dupree',
  'Malloy', 'Ridley', 'Stovall', 'Fenner', 'Broussard', 'Hines', 'Prather',
];

const NEIGHBORHOODS = [
  'Eastside', 'Northbound', 'The Bottom', 'Sixth Ward', 'Lakeview Courts',
  'Hillside', 'Southgate', 'The Flats', 'Riverbend', 'Kingsway',
];

// ─── Origin story fragments ──────────────────────────────────

const CAME_UP_REASONS = [
  'Rent came due and nobody was hiring.',
  'Older brother did fifteen and left a spot open.',
  'Got tired of watching everybody else eat.',
  'Momma got sick and the bills did not care why.',
  'Took the fall for somebody once and figured out that loyalty pays.',
  'Never had a plan B, so plan A had to work.',
  'Came home from a bid and the block was different.',
  'Wanted the respect more than the money.',
  'Grew up two doors down from the trap and learned by watching.',
  'Lost somebody young and stopped being scared of much.',
];

const HOOKS = [
  'Does not talk much. Does not have to.',
  'Been on this block since before you claimed it.',
  'Knows every alley within ten blocks.',
  'Has never once been late to a job.',
  'Everybody on the strip owes them a favor.',
  'Reliable right up until they are not.',
  'Was somebody else problem last month.',
  'Came recommended, which should worry you.',
  'Not the fastest, but never panics.',
  'Been shot at enough to stop flinching.',
];

const K9_HOOKS = [
  'Raised on the block. Does not like strangers.',
  'Was a fighting dog. Retired into security work.',
  'Sleeps by the door and wakes up mean.',
  'Handled two spies last month without a sound.',
  'Trained on scent. Finds people who do not want finding.',
];

// ─── Baggage pools ───────────────────────────────────────────

const BAGGAGE_BY_TIER: Record<HireableTier, string[]> = {
  street: [
    'Green. Will freeze the first time shots come back.',
    'Talks too much when nervous.',
  ],
  seasoned: [
    'Two prior arrests. Third one sticks longer.',
    'Skims a little. Nothing you would notice at first.',
    'Has beef on the eastside that will follow them here.',
  ],
  certified: [
    'Known to the task force. Draws heat faster than most.',
    'Owes money to people who are not patient.',
    'Been a suspect twice and walked both times. Somebody helped.',
    'Habit. Functional, but it costs.',
  ],
  legend: [
    'Named in an open federal file. Deploying them lights the block up.',
    'Four arrests already. One more and they are gone for good.',
    'Everybody wants them dead, which means everybody watches your block.',
    'Flipped on a crew once. Says it was different circumstances.',
    'Cannot be told anything. Will do it their way regardless.',
  ],
};

// ─── Special people ──────────────────────────────────────────

const RELATIONS: SpecialPersonRelation[] = [
  'mother', 'father', 'brother', 'sister', 'son', 'daughter',
  'girlfriend', 'boyfriend', 'cousin', 'best_friend', 'grandmother', 'auntie',
];

export const RELATION_LABELS: Record<SpecialPersonRelation, string> = {
  mother: 'Mother',
  father: 'Father',
  brother: 'Brother',
  sister: 'Sister',
  son: 'Son',
  daughter: 'Daughter',
  girlfriend: 'Girlfriend',
  boyfriend: 'Boyfriend',
  cousin: 'Cousin',
  best_friend: 'Best Friend',
  grandmother: 'Grandmother',
  auntie: 'Auntie',
};

// ─── Deterministic RNG ───────────────────────────────────────
//
// Seeded so a given listing id always regenerates identically. The board
// can be rebuilt from ids alone without persisting every field.

function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function intBetween(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function floatBetween(rng: () => number, min: number, max: number): number {
  return rng() * (max - min) + min;
}

// ─── Generators ──────────────────────────────────────────────

/** Two special people per member. Never duplicate relations. */
export function generateSpecialPeople(rng: () => number, memberId: string): SpecialPerson[] {
  const used = new Set<SpecialPersonRelation>();
  const people: SpecialPerson[] = [];
  while (people.length < 2) {
    const relation = pick(rng, RELATIONS);
    if (used.has(relation)) continue;
    used.add(relation);
    people.push({
      id: `${memberId}_sp${people.length + 1}`,
      name: `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`,
      relation,
      status: 'safe',
      neighborhood: pick(rng, NEIGHBORHOODS),
    });
  }
  return people;
}

function generateOriginStory(
  rng: () => number,
  role: HireableRole,
  tier: HireableTier,
  cameUpOn: string,
): MemberOriginStory {
  const reason = pick(rng, CAME_UP_REASONS);
  const hook = role === 'k9' ? pick(rng, K9_HOOKS) : pick(rng, HOOKS);
  const roleWord = ROLE_PROFILES[role].label.toLowerCase();

  const body =
    role === 'k9'
      ? `Came off ${cameUpOn}. ${hook} Handled by whoever feeds them, loyal to whoever does it consistently.`
      : `Came up on ${cameUpOn}. ${reason} Worked their way into ${roleWord} work and stuck with it. ` +
        `${TIER_BANDS[tier].blurb}`;

  return { hook, body, cameUpOn, reason };
}

function generateStats(
  rng: () => number,
  role: HireableRole,
  tier: HireableTier,
): HireableMember['stats'] {
  const band = TIER_BANDS[tier];
  const profile = ROLE_PROFILES[role];
  const base = () => intBetween(rng, band.statFloor, band.statCeiling);
  const stats = {
    shooting: base(),
    dealing: base(),
    nerve: base(),
    stealth: base(),
  };
  // Primary stat gets a bump, clamped to 100.
  stats[profile.primary] = Math.min(100, stats[profile.primary] + intBetween(rng, 8, 18));
  return stats;
}

/**
 * Build one listing from a stable id.
 *
 * Price scales on tier multiplier and level within the band, so a level 8
 * certified shooter costs meaningfully more than a level 6 one.
 */
export function generateHireable(
  id: string,
  role: HireableRole,
  tier: HireableTier,
): HireableMember {
  const rng = makeRng(hashString(id));
  const band = TIER_BANDS[tier];
  const profile = ROLE_PROFILES[role];

  const level = intBetween(rng, band.levelRange[0], band.levelRange[1]);
  const levelPremium = 1 + (level - band.levelRange[0]) * 0.22;
  const price = Math.round(
    (profile.basePrice * band.priceMultiplier * levelPremium) / 50,
  ) * 50;

  const salary = Math.round((profile.baseSalary * (1 + (level - 1) * 0.15)) / 10) * 10;
  const cameUpOn = pick(rng, NEIGHBORHOODS);

  const isK9 = role === 'k9';
  const name = isK9
    ? pick(rng, K9_NAMES)
    : `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`;
  const nickname = isK9 ? pick(rng, K9_BREEDS) : pick(rng, NICKNAMES);

  const hasBaggage = rng() < band.baggageChance;
  const baggage = hasBaggage ? pick(rng, BAGGAGE_BY_TIER[tier]) : null;

  return {
    id,
    name,
    nickname,
    role,
    tier,
    level,
    price,
    salary,
    startingLoyalty: intBetween(rng, band.loyaltyRange[0], band.loyaltyRange[1]),
    heatFactor: Number(
      floatBetween(rng, band.heatFactorRange[0], band.heatFactorRange[1]).toFixed(2),
    ),
    stats: generateStats(rng, role, tier),
    originStory: generateOriginStory(rng, role, tier, cameUpOn),
    // Dogs do not have special people the way a person does.
    specialPeople: isK9 ? [] : generateSpecialPeople(rng, id),
    baggage,
  };
}

/** Roles that appear on the board, weighted toward what players actually need. */
const BOARD_ROLES: HireableRole[] = [
  'shooter', 'shooter', 'dealer', 'dealer', 'enforcer',
  'driver', 'lookout', 'recruit', 'k9',
];

const BOARD_TIERS: HireableTier[] = [
  'street', 'street', 'seasoned', 'seasoned', 'seasoned',
  'certified', 'certified', 'legend',
];

/**
 * Generate a full board.
 *
 * `refreshSeed` should change whenever the player refreshes the market, so the
 * same seed always rebuilds the same board — important for the buy flow, which
 * needs the listing to still exist after a re-render.
 */
export function generateMemberBoard(
  refreshSeed: string,
  count: number = 12,
): HireableMember[] {
  const rng = makeRng(hashString(refreshSeed));
  const listings: HireableMember[] = [];
  for (let i = 0; i < count; i++) {
    const role = pick(rng, BOARD_ROLES);
    const tier = pick(rng, BOARD_TIERS);
    listings.push(generateHireable(`${refreshSeed}_${i}`, role, tier));
  }
  // Cheapest first — players browse by what they can afford.
  return listings.sort((a, b) => a.price - b.price);
}

// ─── Conversion to a real gang member ────────────────────────

/**
 * Shape a listing into the payload `useGangStore().addMember` expects.
 *
 * Bought members keep their level and stats but start with the listing's
 * loyalty rather than the default, and carry `heatFactor` forward so the
 * heat system can tax them appropriately.
 */
export function hireableToMemberPayload(h: HireableMember, gangId: string) {
  return {
    id: `m_${h.id}`,
    gangId,
    name: h.name,
    nickname: h.nickname,
    avatarUrl: '',
    backstory: h.originStory.body,
    age: h.role === 'k9' ? 3 : 19 + h.level,
    region: 'east' as const,
    stats: {
      strength: h.stats.nerve,
      agility: h.stats.stealth,
      intelligence: h.stats.dealing,
      charisma: h.stats.dealing,
      luck: 50,
      intimidation: h.stats.nerve,
    },
    level: h.level,
    experience: 0,
    xp: 0,
    skillPoints: 0,
    skills: [],
    loyalty: h.startingLoyalty,
    morale: h.startingLoyalty,
    respect: h.level * 8,
    kills: 0,
    arrests: 0,
    dealsCompleted: 0,
    moneyEarned: 0,
    status: 'active' as const,
    currentAssignment: null,
    joinedAt: new Date().toISOString(),
    hiredAt: new Date().toISOString(),
    role: h.role,
    health: 100,
    maxHealth: 100,
    inventory: [],
    salary: h.salary,
    heatFactor: h.heatFactor,
    specialPeople: h.specialPeople,
    originStory: h.originStory,
  };
}
