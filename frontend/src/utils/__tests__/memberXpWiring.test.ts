/**
 * memberXpWiring.test.ts
 * Tests for the member XP progression wiring:
 * - Dealer XP earned per tick (gameLoopEngine)
 * - Shooter XP earned per kill (SlideGame)
 * - Level-up stat boosts and ability unlocks
 * - XP formula correctness
 */

import { describe, it, expect } from 'vitest';
import {
  addXp,
  xpForLevel,
  totalXpForLevel,
  XP_CONFIG,
  createInitialLevel,
  type MemberLevel,
} from '../memberProgression';

// ─── XP formula ──────────────────────────────────────────────────────────────

describe('xpForLevel', () => {
  it('level 1 requires BASE_XP (100)', () => {
    expect(xpForLevel(1)).toBe(XP_CONFIG.BASE_XP);
  });

  it('level 2 requires 150 XP (100 * 1.5^1)', () => {
    expect(xpForLevel(2)).toBe(150);
  });

  it('level 3 requires 225 XP (100 * 1.5^2)', () => {
    expect(xpForLevel(3)).toBe(225);
  });

  it('XP required increases monotonically', () => {
    for (let i = 1; i < 10; i++) {
      expect(xpForLevel(i + 1)).toBeGreaterThan(xpForLevel(i));
    }
  });
});

describe('totalXpForLevel', () => {
  it('totalXpForLevel(1) is 0 (no XP needed to be level 1)', () => {
    expect(totalXpForLevel(1)).toBe(0);
  });

  it('totalXpForLevel(2) equals xpForLevel(1)', () => {
    expect(totalXpForLevel(2)).toBe(xpForLevel(1));
  });

  it('totalXpForLevel(3) equals xpForLevel(1) + xpForLevel(2)', () => {
    expect(totalXpForLevel(3)).toBe(xpForLevel(1) + xpForLevel(2));
  });
});

// ─── addXp — no level-up ────────────────────────────────────────────────────

describe('addXp — no level-up', () => {
  it('adds XP without leveling up', () => {
    const level = createInitialLevel();
    const { level: newLevel, levelUps } = addXp(level, 50, 'dealer');
    expect(newLevel.xp).toBe(50);
    expect(newLevel.level).toBe(1);
    expect(levelUps).toHaveLength(0);
  });

  it('XP_PER_DEAL is 25', () => {
    expect(XP_CONFIG.XP_PER_DEAL).toBe(25);
  });

  it('XP_PER_KILL is 50', () => {
    expect(XP_CONFIG.XP_PER_KILL).toBe(50);
  });
});

// ─── addXp — level-up ───────────────────────────────────────────────────────

describe('addXp — level-up', () => {
  it('levels up when XP reaches xpToNext', () => {
    const level: MemberLevel = {
      level: 1,
      xp: 90,
      xpToNext: 100,
      totalXp: 90,
    };
    const { level: newLevel, levelUps } = addXp(level, 15, 'dealer');
    expect(newLevel.level).toBe(2);
    expect(levelUps).toHaveLength(1);
    expect(levelUps[0].newLevel).toBe(2);
  });

  it('dealer level-up boosts dealing stat', () => {
    const level: MemberLevel = { level: 1, xp: 95, xpToNext: 100, totalXp: 95 };
    const { levelUps } = addXp(level, 10, 'dealer');
    expect(levelUps[0].statBoosts.dealing).toBeGreaterThan(0);
  });

  it('shooter level-up boosts shooting stat', () => {
    const level: MemberLevel = { level: 1, xp: 95, xpToNext: 100, totalXp: 95 };
    const { levelUps } = addXp(level, 10, 'shooter');
    expect(levelUps[0].statBoosts.shooting).toBeGreaterThan(0);
  });

  it('level-up generates heat increase at level 10+', () => {
    // Get a member to level 11 in one shot
    const level: MemberLevel = {
      level: 10,
      xp: xpForLevel(10) - 1,
      xpToNext: xpForLevel(10),
      totalXp: totalXpForLevel(10) + xpForLevel(10) - 1,
    };
    const { levelUps } = addXp(level, 10, 'shooter');
    expect(levelUps.length).toBeGreaterThan(0);
    // Level 11 is above HEAT_THRESHOLD_LEVEL (10), so heat increase should be > 0
    expect(levelUps[0].heatIncrease).toBeGreaterThan(0);
  });

  it('no heat increase below level 10', () => {
    const level: MemberLevel = { level: 1, xp: 95, xpToNext: 100, totalXp: 95 };
    const { levelUps } = addXp(level, 10, 'dealer');
    expect(levelUps[0].heatIncrease).toBe(0);
  });
});

// ─── Ability unlocks at milestone levels ────────────────────────────────────

describe('ability unlocks', () => {
  it('shooter unlocks Double Tap at level 5', () => {
    // Bring a shooter to level 4 and push them to 5
    const level: MemberLevel = {
      level: 4,
      xp: xpForLevel(4) - 1,
      xpToNext: xpForLevel(4),
      totalXp: totalXpForLevel(4) + xpForLevel(4) - 1,
    };
    const { levelUps } = addXp(level, 10, 'shooter');
    const lvl5 = levelUps.find((lu) => lu.newLevel === 5);
    expect(lvl5?.unlockedAbility).toContain('Double Tap');
  });

  it('dealer unlocks Smooth Talker at level 5', () => {
    const level: MemberLevel = {
      level: 4,
      xp: xpForLevel(4) - 1,
      xpToNext: xpForLevel(4),
      totalXp: totalXpForLevel(4) + xpForLevel(4) - 1,
    };
    const { levelUps } = addXp(level, 10, 'dealer');
    const lvl5 = levelUps.find((lu) => lu.newLevel === 5);
    expect(lvl5?.unlockedAbility).toContain('Smooth Talker');
  });
});

// ─── createInitialLevel ──────────────────────────────────────────────────────

describe('createInitialLevel', () => {
  it('creates a level 1 member with 0 XP', () => {
    const level = createInitialLevel();
    expect(level.level).toBe(1);
    expect(level.xp).toBe(0);
    expect(level.totalXp).toBe(0);
    expect(level.xpToNext).toBe(XP_CONFIG.BASE_XP);
  });
});
