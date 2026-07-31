/**
 * Tests for the Block DNA library.
 */
import { describe, it, expect } from 'vitest';
import {
  BLOCK_DNA_LIBRARY,
  getDNAById,
  getNearestDNA,
  resolveProjectionProfile,
  getDNAByTier,
  BLOCK_DNA_BY_INCOME,
} from '../blockDNA';
import { DEFAULT_PROFILE } from '../../render/projection';

describe('BLOCK_DNA_LIBRARY', () => {
  it('has exactly 8 premade blocks', () => {
    expect(BLOCK_DNA_LIBRARY).toHaveLength(8);
  });

  it('every block has a unique id', () => {
    const ids = BLOCK_DNA_LIBRARY.map((b) => b.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('every block has valid lat/lng', () => {
    for (const dna of BLOCK_DNA_LIBRARY) {
      expect(dna.lat).toBeGreaterThan(-90);
      expect(dna.lat).toBeLessThan(90);
      expect(dna.lng).toBeGreaterThan(-180);
      expect(dna.lng).toBeLessThan(180);
    }
  });

  it('incomeMultiplier is positive for all blocks', () => {
    for (const dna of BLOCK_DNA_LIBRARY) {
      expect(dna.incomeMultiplier).toBeGreaterThan(0);
    }
  });

  it('maxMembers is at least 4 for all blocks', () => {
    for (const dna of BLOCK_DNA_LIBRARY) {
      expect(dna.maxMembers).toBeGreaterThanOrEqual(4);
    }
  });

  it('startingHeat is between 0 and 5', () => {
    for (const dna of BLOCK_DNA_LIBRARY) {
      expect(dna.startingHeat).toBeGreaterThanOrEqual(0);
      expect(dna.startingHeat).toBeLessThanOrEqual(5);
    }
  });

  it('globalCoverBonus is between -0.1 and 0.3', () => {
    for (const dna of BLOCK_DNA_LIBRARY) {
      expect(dna.globalCoverBonus).toBeGreaterThanOrEqual(-0.1);
      expect(dna.globalCoverBonus).toBeLessThanOrEqual(0.3);
    }
  });
});

describe('getDNAById', () => {
  it('returns the correct block by id', () => {
    const dna = getDNAById('las-olas-1208');
    expect(dna).toBeDefined();
    expect(dna?.name).toBe('1208 Las Olas');
  });

  it('returns undefined for unknown id', () => {
    expect(getDNAById('nonexistent-block')).toBeUndefined();
  });
});

describe('getNearestDNA', () => {
  it('returns the closest block to a given lat/lng', () => {
    // Ocean Drive is at 25.7814, -80.1300 — nearest should be south-beach-ocean
    const dna = getNearestDNA(25.7814, -80.1300);
    expect(dna.id).toBe('south-beach-ocean');
  });

  it('always returns a result even for distant coordinates', () => {
    // Tokyo
    const dna = getNearestDNA(35.6762, 139.6503);
    expect(dna).toBeDefined();
    expect(typeof dna.id).toBe('string');
  });
});

describe('resolveProjectionProfile', () => {
  it('returns DEFAULT_PROFILE when no overrides', () => {
    const dna = getDNAById('las-olas-1208')!;
    const profile = resolveProjectionProfile(dna);
    expect(profile).toEqual(DEFAULT_PROFILE);
  });

  it('merges overrides onto DEFAULT_PROFILE', () => {
    const dna = getDNAById('wynwood-warehouse')!;
    const profile = resolveProjectionProfile(dna);
    // wynwood-warehouse has groundYRatio: 0.95
    expect(profile.groundYRatio).toBe(0.95);
    // Other fields should still be from DEFAULT_PROFILE
    expect(typeof profile.horizonYRatio).toBe('number');
  });

  it('does not mutate DEFAULT_PROFILE', () => {
    const before = { ...DEFAULT_PROFILE };
    const dna = getDNAById('south-beach-ocean')!;
    resolveProjectionProfile(dna);
    expect(DEFAULT_PROFILE).toEqual(before);
  });
});

describe('getDNAByTier', () => {
  it('returns only starter blocks for tier=starter', () => {
    const starters = getDNAByTier('starter');
    expect(starters.length).toBeGreaterThan(0);
    for (const dna of starters) {
      expect(dna.tier).toBe('starter');
    }
  });

  it('returns only elite blocks for tier=elite', () => {
    const elites = getDNAByTier('elite');
    expect(elites.length).toBeGreaterThan(0);
    for (const dna of elites) {
      expect(dna.tier).toBe('elite');
    }
  });

  it('returns empty array for unknown tier', () => {
    // @ts-expect-error testing invalid tier
    expect(getDNAByTier('legendary')).toHaveLength(0);
  });
});

describe('BLOCK_DNA_BY_INCOME', () => {
  it('is sorted descending by incomeMultiplier', () => {
    for (let i = 0; i < BLOCK_DNA_BY_INCOME.length - 1; i++) {
      expect(BLOCK_DNA_BY_INCOME[i].incomeMultiplier).toBeGreaterThanOrEqual(
        BLOCK_DNA_BY_INCOME[i + 1].incomeMultiplier,
      );
    }
  });

  it('elite blocks appear near the top', () => {
    const topTwo = BLOCK_DNA_BY_INCOME.slice(0, 2);
    const topTiers = topTwo.map((d) => d.tier);
    expect(topTiers).toContain('elite');
  });
});
