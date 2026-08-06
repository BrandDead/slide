// ============================================================
// marketMembersCatalog tests — Sprint 15-B
//
// The catalog is procedural, so the tests assert invariants rather
// than exact values: tiers must stay legibly priced relative to each
// other, stats must respect their band, K9s must not be given family,
// and a given listing id must always regenerate identically so the
// buy flow does not lose the listing mid-purchase.
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  TIER_BANDS,
  ROLE_PROFILES,
  RELATION_LABELS,
  generateHireable,
  generateMemberBoard,
  generateSpecialPeople,
  hireableToMemberPayload,
} from '../marketMembersCatalog';
import type { HireableRole, HireableTier } from '../../types/game.types';

const ALL_TIERS: HireableTier[] = ['street', 'seasoned', 'certified', 'legend'];
const ALL_ROLES: HireableRole[] = [
  'recruit', 'dealer', 'shooter', 'enforcer', 'driver', 'lookout', 'k9',
];

/** Small deterministic RNG for exercising helpers directly. */
function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

describe('TIER_BANDS', () => {
  it('covers every tier', () => {
    for (const t of ALL_TIERS) expect(TIER_BANDS[t]).toBeDefined();
  });

  it('prices rise monotonically with tier', () => {
    const mults = ALL_TIERS.map((t) => TIER_BANDS[t].priceMultiplier);
    for (let i = 1; i < mults.length; i++) {
      expect(mults[i]).toBeGreaterThan(mults[i - 1]);
    }
  });

  it('level ranges rise and do not overlap', () => {
    for (let i = 1; i < ALL_TIERS.length; i++) {
      const prev = TIER_BANDS[ALL_TIERS[i - 1]].levelRange;
      const cur = TIER_BANDS[ALL_TIERS[i]].levelRange;
      expect(cur[0]).toBeGreaterThan(prev[1]);
    }
  });

  it('loyalty falls as tier rises — the good ones are harder to hold', () => {
    const floors = ALL_TIERS.map((t) => TIER_BANDS[t].loyaltyRange[0]);
    for (let i = 1; i < floors.length; i++) {
      expect(floors[i]).toBeLessThan(floors[i - 1]);
    }
  });

  it('heat factor rises as tier rises — reputation attracts police', () => {
    const heat = ALL_TIERS.map((t) => TIER_BANDS[t].heatFactorRange[0]);
    for (let i = 1; i < heat.length; i++) {
      expect(heat[i]).toBeGreaterThanOrEqual(heat[i - 1]);
    }
  });

  it('baggage odds rise with tier', () => {
    const odds = ALL_TIERS.map((t) => TIER_BANDS[t].baggageChance);
    for (let i = 1; i < odds.length; i++) {
      expect(odds[i]).toBeGreaterThan(odds[i - 1]);
    }
  });

  it('stat bands are ordered and valid', () => {
    for (const t of ALL_TIERS) {
      const b = TIER_BANDS[t];
      expect(b.statFloor).toBeLessThan(b.statCeiling);
      expect(b.statCeiling).toBeLessThanOrEqual(100);
    }
  });
});

describe('ROLE_PROFILES', () => {
  it('covers every role', () => {
    for (const r of ALL_ROLES) expect(ROLE_PROFILES[r]).toBeDefined();
  });

  it('gives each role a primary stat and positive pricing', () => {
    for (const r of ALL_ROLES) {
      const p = ROLE_PROFILES[r];
      expect(['shooting', 'dealing', 'nerve', 'stealth']).toContain(p.primary);
      expect(p.basePrice).toBeGreaterThan(0);
      expect(p.baseSalary).toBeGreaterThan(0);
    }
  });

  it('keeps a K9 cheap to feed relative to a person of similar cost', () => {
    expect(ROLE_PROFILES.k9.baseSalary).toBeLessThan(ROLE_PROFILES.shooter.baseSalary);
  });

  it('prices a recruit lowest of all roles', () => {
    const cheapest = Math.min(...ALL_ROLES.map((r) => ROLE_PROFILES[r].basePrice));
    expect(ROLE_PROFILES.recruit.basePrice).toBe(cheapest);
  });
});

describe('RELATION_LABELS', () => {
  it('has a readable label for every relation used by the generator', () => {
    const people = generateSpecialPeople(seededRng(7), 'm_test');
    for (const p of people) {
      expect(RELATION_LABELS[p.relation]).toBeTruthy();
    }
  });
});

describe('generateSpecialPeople', () => {
  it('always returns exactly two people', () => {
    for (let seed = 1; seed < 30; seed++) {
      expect(generateSpecialPeople(seededRng(seed), `m_${seed}`)).toHaveLength(2);
    }
  });

  it('never assigns the same relation twice', () => {
    for (let seed = 1; seed < 30; seed++) {
      const people = generateSpecialPeople(seededRng(seed), `m_${seed}`);
      expect(new Set(people.map((p) => p.relation)).size).toBe(2);
    }
  });

  it('gives each person a stable id derived from the member', () => {
    const people = generateSpecialPeople(seededRng(3), 'm_abc');
    expect(people[0].id).toBe('m_abc_sp1');
    expect(people[1].id).toBe('m_abc_sp2');
  });

  it('starts everybody safe', () => {
    const people = generateSpecialPeople(seededRng(11), 'm_x');
    for (const p of people) expect(p.status).toBe('safe');
  });
});

describe('generateHireable', () => {
  it('is deterministic for a given id, role, and tier', () => {
    const a = generateHireable('listing_1', 'shooter', 'certified');
    const b = generateHireable('listing_1', 'shooter', 'certified');
    expect(a).toEqual(b);
  });

  it('produces different listings for different ids', () => {
    const a = generateHireable('listing_1', 'shooter', 'certified');
    const b = generateHireable('listing_2', 'shooter', 'certified');
    // Same tier and role, but the rolled details should differ.
    expect(a).not.toEqual(b);
  });

  it('keeps level inside the tier band', () => {
    for (const tier of ALL_TIERS) {
      for (let i = 0; i < 12; i++) {
        const h = generateHireable(`l_${tier}_${i}`, 'dealer', tier);
        const [lo, hi] = TIER_BANDS[tier].levelRange;
        expect(h.level).toBeGreaterThanOrEqual(lo);
        expect(h.level).toBeLessThanOrEqual(hi);
      }
    }
  });

  it('keeps loyalty inside the tier band', () => {
    for (const tier of ALL_TIERS) {
      for (let i = 0; i < 12; i++) {
        const h = generateHireable(`y_${tier}_${i}`, 'dealer', tier);
        const [lo, hi] = TIER_BANDS[tier].loyaltyRange;
        expect(h.startingLoyalty).toBeGreaterThanOrEqual(lo);
        expect(h.startingLoyalty).toBeLessThanOrEqual(hi);
      }
    }
  });

  it('keeps heat factor inside the tier band', () => {
    for (const tier of ALL_TIERS) {
      for (let i = 0; i < 12; i++) {
        const h = generateHireable(`h_${tier}_${i}`, 'shooter', tier);
        const [lo, hi] = TIER_BANDS[tier].heatFactorRange;
        // Rounded to 2dp, so allow a hair of slack at the edges.
        expect(h.heatFactor).toBeGreaterThanOrEqual(lo - 0.01);
        expect(h.heatFactor).toBeLessThanOrEqual(hi + 0.01);
      }
    }
  });

  it('never produces a stat above 100', () => {
    for (const tier of ALL_TIERS) {
      for (const role of ALL_ROLES) {
        const h = generateHireable(`s_${tier}_${role}`, role, tier);
        for (const v of Object.values(h.stats)) {
          expect(v).toBeLessThanOrEqual(100);
          expect(v).toBeGreaterThan(0);
        }
      }
    }
  });

  it('bumps the role primary stat above the band floor', () => {
    const h = generateHireable('primary_test', 'shooter', 'legend');
    expect(h.stats.shooting).toBeGreaterThanOrEqual(TIER_BANDS.legend.statFloor);
  });

  it('prices a higher tier above a lower tier for the same role', () => {
    const street = generateHireable('cmp_a', 'shooter', 'street');
    const legend = generateHireable('cmp_b', 'shooter', 'legend');
    expect(legend.price).toBeGreaterThan(street.price);
  });

  it('rounds price to a clean increment', () => {
    const h = generateHireable('round_test', 'enforcer', 'seasoned');
    expect(h.price % 50).toBe(0);
  });

  it('rounds salary to a clean increment', () => {
    const h = generateHireable('sal_test', 'enforcer', 'seasoned');
    expect(h.salary % 10).toBe(0);
  });

  it('gives a K9 a breed as its nickname and no special people', () => {
    const dog = generateHireable('dog_1', 'k9', 'certified');
    expect(dog.specialPeople).toEqual([]);
    expect(dog.nickname.length).toBeGreaterThan(0);
  });

  it('gives every human listing exactly two special people', () => {
    for (const role of ALL_ROLES.filter((r) => r !== 'k9')) {
      const h = generateHireable(`sp_${role}`, role, 'seasoned');
      expect(h.specialPeople).toHaveLength(2);
    }
  });

  it('always writes an origin story with a hook and a body', () => {
    const h = generateHireable('story_test', 'dealer', 'street');
    expect(h.originStory.hook.length).toBeGreaterThan(0);
    expect(h.originStory.body.length).toBeGreaterThan(0);
    expect(h.originStory.cameUpOn.length).toBeGreaterThan(0);
  });

  it('sets baggage to either a string or null, never undefined', () => {
    for (let i = 0; i < 20; i++) {
      const h = generateHireable(`bag_${i}`, 'shooter', 'legend');
      expect(h.baggage === null || typeof h.baggage === 'string').toBe(true);
    }
  });
});

describe('generateMemberBoard', () => {
  it('returns the requested number of listings', () => {
    expect(generateMemberBoard('seed_a', 14)).toHaveLength(14);
  });

  it('is deterministic for a given seed', () => {
    expect(generateMemberBoard('seed_a', 8)).toEqual(generateMemberBoard('seed_a', 8));
  });

  it('produces a different board for a different seed', () => {
    const a = generateMemberBoard('seed_a', 8);
    const b = generateMemberBoard('seed_b', 8);
    expect(a.map((h) => h.id)).not.toEqual(b.map((h) => h.id));
  });

  it('sorts cheapest first so players browse by affordability', () => {
    const board = generateMemberBoard('sorted_seed', 14);
    for (let i = 1; i < board.length; i++) {
      expect(board[i].price).toBeGreaterThanOrEqual(board[i - 1].price);
    }
  });

  it('gives every listing a unique id', () => {
    const board = generateMemberBoard('unique_seed', 14);
    expect(new Set(board.map((h) => h.id)).size).toBe(14);
  });

  it('returns an empty board for a zero count rather than throwing', () => {
    expect(generateMemberBoard('empty_seed', 0)).toEqual([]);
  });
});

describe('hireableToMemberPayload', () => {
  it('carries level, loyalty, salary, and heat factor across', () => {
    const h = generateHireable('conv_1', 'shooter', 'certified');
    const p = hireableToMemberPayload(h, 'gang_1');
    expect(p.level).toBe(h.level);
    expect(p.loyalty).toBe(h.startingLoyalty);
    expect(p.salary).toBe(h.salary);
    expect(p.heatFactor).toBe(h.heatFactor);
  });

  it('namespaces the member id off the listing id', () => {
    const h = generateHireable('conv_2', 'dealer', 'street');
    expect(hireableToMemberPayload(h, 'gang_1').id).toBe(`m_${h.id}`);
  });

  it('starts a bought member active with a clean record', () => {
    const h = generateHireable('conv_3', 'enforcer', 'seasoned');
    const p = hireableToMemberPayload(h, 'gang_1');
    expect(p.status).toBe('active');
    expect(p.arrests).toBe(0);
    expect(p.kills).toBe(0);
    expect(p.health).toBe(100);
    expect(p.inventory).toEqual([]);
  });

  it('starts morale at the listing loyalty so a disloyal hire is not also happy', () => {
    const h = generateHireable('conv_4', 'shooter', 'legend');
    expect(hireableToMemberPayload(h, 'gang_1').morale).toBe(h.startingLoyalty);
  });

  it('preserves the origin story and special people for bounty targeting', () => {
    const h = generateHireable('conv_5', 'dealer', 'certified');
    const p = hireableToMemberPayload(h, 'gang_1');
    expect(p.originStory).toEqual(h.originStory);
    expect(p.specialPeople).toEqual(h.specialPeople);
  });

  it('ages a K9 like a dog, not a person', () => {
    const dog = generateHireable('conv_dog', 'k9', 'seasoned');
    expect(hireableToMemberPayload(dog, 'gang_1').age).toBe(3);
  });

  it('maps listing stats onto the gang member stat block', () => {
    const h = generateHireable('conv_6', 'driver', 'seasoned');
    const p = hireableToMemberPayload(h, 'gang_1');
    expect(p.stats.agility).toBe(h.stats.stealth);
    expect(p.stats.strength).toBe(h.stats.nerve);
    expect(p.stats.intelligence).toBe(h.stats.dealing);
  });

  it('attaches the member to the given gang', () => {
    const h = generateHireable('conv_7', 'lookout', 'street');
    expect(hireableToMemberPayload(h, 'gang_xyz').gangId).toBe('gang_xyz');
  });
});
