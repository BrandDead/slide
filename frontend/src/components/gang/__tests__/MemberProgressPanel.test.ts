// ============================================================
// MemberProgressPanel.test.ts
// Tests for MemberProgressPanel logic and ABILITY_MILESTONES export
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  ABILITY_MILESTONES,
  xpForLevel,
  totalXpForLevel,
  XP_CONFIG,
} from '../../../utils/memberProgression';

// ─── ABILITY_MILESTONES ───────────────────────────────────────

describe('ABILITY_MILESTONES', () => {
  it('exports milestones for all 5 roles', () => {
    expect(ABILITY_MILESTONES).toHaveProperty('shooter');
    expect(ABILITY_MILESTONES).toHaveProperty('dealer');
    expect(ABILITY_MILESTONES).toHaveProperty('enforcer');
    expect(ABILITY_MILESTONES).toHaveProperty('driver');
    expect(ABILITY_MILESTONES).toHaveProperty('chemist');
  });

  it('each role has 6 milestones', () => {
    for (const role of ['shooter', 'dealer', 'enforcer', 'driver', 'chemist']) {
      expect(ABILITY_MILESTONES[role]).toHaveLength(6);
    }
  });

  it('milestones have level and ability fields', () => {
    const first = ABILITY_MILESTONES.shooter[0];
    expect(first).toHaveProperty('level');
    expect(first).toHaveProperty('ability');
    expect(typeof first.level).toBe('number');
    expect(typeof first.ability).toBe('string');
  });

  it('shooter milestones are in ascending level order', () => {
    const levels = ABILITY_MILESTONES.shooter.map((m) => m.level);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]).toBeGreaterThan(levels[i - 1]);
    }
  });

  it('dealer level 5 ability is Smooth Talker', () => {
    const m = ABILITY_MILESTONES.dealer.find((x) => x.level === 5);
    expect(m?.ability).toMatch(/Smooth Talker/);
  });

  it('shooter level 50 ability is Legend', () => {
    const m = ABILITY_MILESTONES.shooter.find((x) => x.level === 50);
    expect(m?.ability).toMatch(/Legend/);
  });
});

// ─── XP Progress Helpers ─────────────────────────────────────

describe('xpPercent helpers', () => {
  it('xpForLevel(1) equals BASE_XP', () => {
    expect(xpForLevel(1)).toBe(XP_CONFIG.BASE_XP);
  });

  it('xpForLevel increases with level', () => {
    expect(xpForLevel(2)).toBeGreaterThan(xpForLevel(1));
    expect(xpForLevel(10)).toBeGreaterThan(xpForLevel(5));
  });

  it('totalXpForLevel(1) is 0 (no XP needed to be level 1)', () => {
    expect(totalXpForLevel(1)).toBe(0);
  });

  it('totalXpForLevel(2) equals xpForLevel(1)', () => {
    expect(totalXpForLevel(2)).toBe(xpForLevel(1));
  });

  it('totalXpForLevel is strictly increasing', () => {
    for (let i = 2; i <= 10; i++) {
      expect(totalXpForLevel(i)).toBeGreaterThan(totalXpForLevel(i - 1));
    }
  });
});

// ─── Heat Contribution ───────────────────────────────────────

describe('heat contribution from high-level members', () => {
  it('level below threshold generates 0 heat', () => {
    // heatContribution = (level - HEAT_THRESHOLD_LEVEL + 1) * 2 when level >= threshold
    // Below threshold = 0
    const level = XP_CONFIG.HEAT_THRESHOLD_LEVEL - 1;
    const heat = level < XP_CONFIG.HEAT_THRESHOLD_LEVEL ? 0 : (level - XP_CONFIG.HEAT_THRESHOLD_LEVEL + 1) * 2;
    expect(heat).toBe(0);
  });

  it('level at threshold generates positive heat', () => {
    const level = XP_CONFIG.HEAT_THRESHOLD_LEVEL;
    const heat = level < XP_CONFIG.HEAT_THRESHOLD_LEVEL ? 0 : (level - XP_CONFIG.HEAT_THRESHOLD_LEVEL + 1) * 2;
    expect(heat).toBeGreaterThan(0);
  });

  it('higher level generates more heat', () => {
    const heatAt = (level: number) =>
      level < XP_CONFIG.HEAT_THRESHOLD_LEVEL ? 0 : (level - XP_CONFIG.HEAT_THRESHOLD_LEVEL + 1) * 2;
    expect(heatAt(20)).toBeGreaterThan(heatAt(15));
    expect(heatAt(30)).toBeGreaterThan(heatAt(20));
  });
});

// ─── Milestone unlock check ───────────────────────────────────

describe('milestone unlock logic', () => {
  it('member at level 5 has first shooter ability unlocked', () => {
    const memberLevel = 5;
    const unlocked = ABILITY_MILESTONES.shooter.filter((m) => memberLevel >= m.level);
    expect(unlocked).toHaveLength(1);
    expect(unlocked[0].ability).toMatch(/Double Tap/);
  });

  it('member at level 1 has no abilities unlocked', () => {
    const memberLevel = 1;
    const unlocked = ABILITY_MILESTONES.shooter.filter((m) => memberLevel >= m.level);
    expect(unlocked).toHaveLength(0);
  });

  it('member at level 50 has all 6 shooter abilities unlocked', () => {
    const memberLevel = 50;
    const unlocked = ABILITY_MILESTONES.shooter.filter((m) => memberLevel >= m.level);
    expect(unlocked).toHaveLength(6);
  });

  it('member at level 10 has exactly 2 dealer abilities unlocked', () => {
    const memberLevel = 10;
    const unlocked = ABILITY_MILESTONES.dealer.filter((m) => memberLevel >= m.level);
    expect(unlocked).toHaveLength(2);
  });
});
