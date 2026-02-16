// ============================================================
// DEALT Engine - Client Generation & Deal Resolution
// ============================================================

import type { Client, ClientType, DealOutcome } from '../types/game.types';

// ============ CLIENT TYPE CONFIGURATIONS ============

interface ClientTypeConfig {
  name: string;
  emoji: string;
  buyAmountRange: [number, number];
  paymentMultiplier: [number, number];
  heatImpact: number;
  riskPercentage: number;
  possibleOutcomes: ('success' | 'undercover' | 'robbery' | 'snitch' | 'overdose')[];
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  descriptions: string[];
  redFlags: string[];
}

const CLIENT_TYPES: Record<ClientType, ClientTypeConfig> = {
  regular: {
    name: 'Regular Customer',
    emoji: '👤',
    buyAmountRange: [2, 5],
    paymentMultiplier: [0.9, 1.1],
    heatImpact: 3,
    riskPercentage: 10,
    possibleOutcomes: ['success', 'robbery'],
    riskLevel: 'low',
    descriptions: [
      'Steady customer, nothing special.',
      'Just needs their regular fix.',
      'Been around the block before.',
    ],
    redFlags: [],
  },

  fiend: {
    name: 'Fiend',
    emoji: '💀',
    buyAmountRange: [5, 10],
    paymentMultiplier: [0.5, 0.8],
    heatImpact: 5,
    riskPercentage: 30,
    possibleOutcomes: ['success', 'robbery', 'overdose'],
    riskLevel: 'high',
    descriptions: [
      'Desperate. Will do anything.',
      'Shaking hands, sunken eyes.',
      'Been up for days straight.',
    ],
    redFlags: ['Might try something stupid', 'Unpredictable behavior'],
  },

  prep_kid: {
    name: 'Prep School Kid',
    emoji: '🎒',
    buyAmountRange: [2, 4],
    paymentMultiplier: [1.3, 1.8],
    heatImpact: 2,
    riskPercentage: 15,
    possibleOutcomes: ['success', 'snitch'],
    riskLevel: 'medium',
    descriptions: [
      "Rich kid with daddy's money.",
      'Designer clothes, nervous energy.',
      'First time buying, overpaying.',
    ],
    redFlags: ['Might tell parents', 'Could snitch if caught'],
  },

  hustler: {
    name: 'Fellow Hustler',
    emoji: '🔄',
    buyAmountRange: [10, 25],
    paymentMultiplier: [0.7, 0.85],
    heatImpact: 8,
    riskPercentage: 25,
    possibleOutcomes: ['success', 'robbery'],
    riskLevel: 'medium',
    descriptions: [
      'Looking to flip. Knows the game.',
      'Buying wholesale for resale.',
      'Competitor or partner? Hard to tell.',
    ],
    redFlags: ['Might be setting you up', 'Could undercut your territory'],
  },

  celebrity: {
    name: 'Celebrity',
    emoji: '⭐',
    buyAmountRange: [5, 15],
    paymentMultiplier: [2.0, 3.0],
    heatImpact: 15,
    riskPercentage: 20,
    possibleOutcomes: ['success', 'snitch'],
    riskLevel: 'medium',
    descriptions: [
      'VIP client. Pays premium.',
      'Needs discretion above all.',
      'Famous face, expensive taste.',
    ],
    redFlags: ['High profile = high heat', 'Paparazzi nearby?'],
  },

  undercover: {
    name: 'Undercover Cop',
    emoji: '👮',
    buyAmountRange: [3, 8],
    paymentMultiplier: [1.0, 1.2],
    heatImpact: 50,
    riskPercentage: 95,
    possibleOutcomes: ['undercover'],
    riskLevel: 'extreme',
    descriptions: [
      'Something feels off...',
      'Too clean. Too eager.',
      'Asking too many questions.',
    ],
    redFlags: ['New face, perfect timing', 'Clean shoes', 'Wire bulge?'],
  },

  paranoid: {
    name: 'Paranoid Buyer',
    emoji: '😰',
    buyAmountRange: [1, 3],
    paymentMultiplier: [1.1, 1.3],
    heatImpact: 4,
    riskPercentage: 20,
    possibleOutcomes: ['success', 'snitch'],
    riskLevel: 'low',
    descriptions: [
      'Looking over shoulder constantly.',
      'Wants to meet in weird spots.',
      'Takes forever to commit.',
    ],
    redFlags: ['Might bolt', 'Could panic and call cops'],
  },

  high_roller: {
    name: 'High Roller',
    emoji: '🎰',
    buyAmountRange: [20, 50],
    paymentMultiplier: [1.2, 1.5],
    heatImpact: 12,
    riskPercentage: 15,
    possibleOutcomes: ['success', 'robbery'],
    riskLevel: 'medium',
    descriptions: [
      'Big money, big orders.',
      'Hosting a party tonight.',
      'Drops bands like nothing.',
    ],
    redFlags: ['This much cash attracts attention'],
  },

  snitch: {
    name: 'Known Snitch',
    emoji: '🐀',
    buyAmountRange: [2, 5],
    paymentMultiplier: [0.8, 1.0],
    heatImpact: 25,
    riskPercentage: 80,
    possibleOutcomes: ['snitch', 'undercover'],
    riskLevel: 'extreme',
    descriptions: [
      'Word is they talk to cops.',
      'Got caught before, made a deal.',
      'Everyone knows they snitch.',
    ],
    redFlags: ['KNOWN RAT', 'Definitely wired', 'Stay away'],
  },

  robber: {
    name: 'Sketchy Character',
    emoji: '🔫',
    buyAmountRange: [5, 15],
    paymentMultiplier: [0.9, 1.1],
    heatImpact: 10,
    riskPercentage: 70,
    possibleOutcomes: ['robbery'],
    riskLevel: 'extreme',
    descriptions: [
      'Eyes darting, hand in pocket.',
      'Brought friends who stayed back.',
      'Something about this feels wrong.',
    ],
    redFlags: ['Might be strapped', 'Friends watching', 'Lick incoming?'],
  },
};

// ============ DRUG CONFIGURATIONS ============

const DRUG_PRICES: Record<string, number> = {
  weed: 10,
  coke: 80,
  crack: 40,
  pills: 15,
  molly: 25,
  shrooms: 20,
  lsd: 30,
  heroin: 100,
  meth: 60,
  lean: 50,
};

const DRUG_NAMES = Object.keys(DRUG_PRICES);

// ============ NAME GENERATORS ============

const FIRST_NAMES = [
  'Marcus', 'DeShawn', 'Tyrone', 'Jerome', 'Jamal', 'Andre', 'Malik',
  'Tiffany', 'Keisha', 'Shaniqua', 'Latoya', 'Diamond', 'Crystal',
  'Chad', 'Brad', 'Kyle', 'Trevor', 'Becky', 'Karen', 'Ashley',
  'Miguel', 'Carlos', 'Jose', 'Maria', 'Rosa', 'Elena',
];

const NICKNAMES = [
  'Lil', 'Big', 'Young', 'OG', 'Baby', 'Slim', 'Fat',
  'Crazy', 'Mad', 'Wild', 'Smooth', 'Quick', 'Slick',
];

function generateName(): string {
  const useNickname = Math.random() < 0.3;
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];

  if (useNickname) {
    const nickname = NICKNAMES[Math.floor(Math.random() * NICKNAMES.length)];
    return `${nickname} ${firstName}`;
  }

  return firstName;
}

// ============ CLIENT GENERATION ============

export function generateClient(playerHeat: number, playerLevel: number): Client {
  // Calculate client type weights based on heat
  const typeWeights: { type: ClientType; weight: number }[] = [
    { type: 'regular', weight: 30 - playerHeat * 0.1 },
    { type: 'fiend', weight: 15 + playerHeat * 0.05 },
    { type: 'prep_kid', weight: 15 },
    { type: 'hustler', weight: 10 + playerLevel * 0.5 },
    { type: 'celebrity', weight: 5 + playerLevel * 0.3 },
    { type: 'undercover', weight: 5 + playerHeat * 0.3 }, // More likely at high heat
    { type: 'paranoid', weight: 10 },
    { type: 'high_roller', weight: 5 + playerLevel * 0.5 },
    { type: 'snitch', weight: 3 + playerHeat * 0.1 },
    { type: 'robber', weight: 7 + playerHeat * 0.1 },
  ];

  // Weighted random selection
  const totalWeight = typeWeights.reduce((sum, t) => sum + Math.max(0, t.weight), 0);
  let random = Math.random() * totalWeight;

  let selectedType: ClientType = 'regular';
  for (const tw of typeWeights) {
    random -= Math.max(0, tw.weight);
    if (random <= 0) {
      selectedType = tw.type;
      break;
    }
  }

  const config = CLIENT_TYPES[selectedType];

  // Generate deal details
  const drugType = DRUG_NAMES[Math.floor(Math.random() * DRUG_NAMES.length)];
  const basePrice = DRUG_PRICES[drugType];
  const amount =
    Math.floor(Math.random() * (config.buyAmountRange[1] - config.buyAmountRange[0] + 1)) +
    config.buyAmountRange[0];

  const multiplier =
    config.paymentMultiplier[0] +
    Math.random() * (config.paymentMultiplier[1] - config.paymentMultiplier[0]);

  const marketPrice = basePrice * amount;
  const offerPrice = Math.round(marketPrice * multiplier);

  // Select random description
  const description = config.descriptions[Math.floor(Math.random() * config.descriptions.length)];

  // Determine which red flags to show (not all, for some mystery)
  const visibleRedFlags = config.redFlags.filter(() => Math.random() < 0.7);

  return {
    id: `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: selectedType,
    name: generateName(),
    avatar: config.emoji,
    description,
    requestedDrug: drugType as any,
    requestedAmount: amount,
    offerPrice,
    marketPrice,
    riskLevel: config.riskLevel,
    redFlags: visibleRedFlags,
    trustScore: 100 - config.riskPercentage,
    heatImpact: config.heatImpact,
  };
}

// ============ DEAL RESOLUTION ============

export function resolveDeal(client: Client, playerHeat: number, streak: number): DealOutcome {
  const config = CLIENT_TYPES[client.type];

  // Calculate actual risk (affected by heat and streak)
  const heatModifier = playerHeat * 0.5; // High heat = more risk
  const streakBonus = Math.min(streak * 5, 25); // Streak reduces risk slightly
  const effectiveRisk = Math.max(5, config.riskPercentage + heatModifier - streakBonus);

  const roll = Math.random() * 100;

  // Check if deal goes bad
  if (roll < effectiveRisk) {
    // Something went wrong - pick a bad outcome
    const badOutcome = config.possibleOutcomes.find((o) => o !== 'success') || 'robbery';

    switch (badOutcome) {
      case 'undercover':
        return {
          success: false,
          type: 'undercover',
          message: "IT'S A SETUP! 5-0 coming in hot!",
          moneyChange: -Math.min(client.offerPrice * 2, 5000),
          heatChange: 50,
          xpGained: 0,
          streakBonus: 0,
          consequences: [
            {
              type: 'arrest',
              severity: 3,
              description: 'Narrowly escaped arrest. Laying low for a while.',
            },
          ],
        };

      case 'robbery':
        const stolenAmount = Math.floor(client.offerPrice * (0.5 + Math.random() * 0.5));
        return {
          success: false,
          type: 'robbery',
          message: 'They pulled a strap on you! Lost the product and some cash.',
          moneyChange: -stolenAmount,
          heatChange: 15,
          xpGained: 10,
          streakBonus: 0,
          consequences: [
            {
              type: 'injury',
              severity: 1,
              description: 'Minor injuries from the scuffle.',
            },
          ],
        };

      case 'snitch':
        return {
          success: false,
          type: 'snitch',
          message: 'They talked. Cops are on their way.',
          moneyChange: client.offerPrice,
          heatChange: 30,
          xpGained: 20,
          streakBonus: 0,
          consequences: [
            {
              type: 'reputation_loss',
              severity: 2,
              description: 'Word is spreading that you dealt to a rat.',
            },
          ],
        };

      case 'overdose':
        return {
          success: false,
          type: 'overdose',
          message: 'They OD\'d. This is bad for business.',
          moneyChange: client.offerPrice,
          heatChange: 25,
          xpGained: 0,
          streakBonus: 0,
          consequences: [
            {
              type: 'reputation_loss',
              severity: 2,
              description: 'News of the OD is spreading.',
            },
          ],
        };

      default:
        return {
          success: false,
          type: 'refused',
          message: 'Deal fell through.',
          moneyChange: 0,
          heatChange: 5,
          xpGained: 5,
          streakBonus: 0,
        };
    }
  }

  // Deal succeeded!
  const streakMultiplier = 1 + streak * 0.1; // 10% bonus per streak
  const finalAmount = Math.round(client.offerPrice * streakMultiplier);

  return {
    success: true,
    type: 'success',
    message: getSuccessMessage(client.type),
    moneyChange: finalAmount,
    heatChange: config.heatImpact,
    xpGained: 25 + Math.floor(client.offerPrice / 10),
    streakBonus: streakMultiplier - 1,
  };
}

function getSuccessMessage(clientType: ClientType): string {
  const messages: Record<ClientType, string[]> = {
    regular: ['Clean deal.', 'Easy money.', 'Another satisfied customer.'],
    fiend: ['They practically ran off with it.', 'Desperate times.', 'Hope they make it.'],
    prep_kid: ['Trust fund money hits different.', 'They overpaid. Nice.', 'Easy mark.'],
    hustler: ['Wholesale rates. Good business.', 'They know the game.', 'Mutual respect.'],
    celebrity: ['VIP treatment pays off.', 'Discretion is worth the premium.', 'A-list money.'],
    undercover: ['Wait, that was actually legit?', 'Close call.', 'Got lucky there.'],
    paranoid: ['Finally closed it.', 'That took forever.', 'Patience pays.'],
    high_roller: ['Big spender!', 'Party supplies secured.', 'Major bag alert.'],
    snitch: ['Risky but it paid off.', 'Maybe they changed.', 'Watch your back.'],
    robber: ['They were actually just buying.', 'Misjudged that one.', 'All good.'],
  };

  const typeMessages = messages[clientType];
  return typeMessages[Math.floor(Math.random() * typeMessages.length)];
}

export { CLIENT_TYPES, DRUG_PRICES };
