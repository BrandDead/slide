// ═══════════════════════════════════════════════════════════════════════════
// Unit tests — Economy Pillar 1
// Tests for: wages.ts, useShoeboxStore, reinforcements.ts
// Run with: npx vitest run src/__tests__/economy-pillar1.test.ts
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getWageForRole,
  computeWage,
  LEVEL_WAGE_MULTIPLIER,
  UNPAID_MORALE_HIT,
  UNPAID_LOYALTY_HIT,
  PAID_MORALE_BONUS,
  UNPAID_WEEKS_BEFORE_EXIT_RISK,
} from '../config/wages';
import { getAvailableBackup, assignEntryTiles, buildBackupUnits, MAX_BACKUP_SQUAD } from '../systems/reinforcements';
import type { GangMember, Block, Tile } from '../types/game.types';

// ─────────────────────────────────────────────────────────────────────────────
// WAGES CONFIG TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('wages.ts', () => {
  it('returns correct base wages for known roles', () => {
    expect(getWageForRole('dealer')).toBe(1000);
    expect(getWageForRole('shooter')).toBe(800);
    expect(getWageForRole('enforcer')).toBe(600);
    expect(getWageForRole('driver')).toBe(500);
    expect(getWageForRole('lookout')).toBe(400);
    expect(getWageForRole('boss')).toBe(1500);
  });

  it('falls back to 500 for unknown roles', () => {
    expect(getWageForRole('unknown_role')).toBe(500);
    expect(getWageForRole(undefined)).toBe(500);
  });

  it('is case-insensitive', () => {
    expect(getWageForRole('DEALER')).toBe(1000);
    expect(getWageForRole('Shooter')).toBe(800);
  });

  it('computeWage returns base wage for level 1', () => {
    expect(computeWage('dealer', 1)).toBe(1000);
    expect(computeWage('shooter', 1)).toBe(800);
  });

  it('computeWage scales correctly with level', () => {
    // wage = base * (1 + (level - 1) * LEVEL_WAGE_MULTIPLIER)
    const expected = Math.round(1000 * (1 + 4 * LEVEL_WAGE_MULTIPLIER));
    expect(computeWage('dealer', 5)).toBe(expected);
  });

  it('computeWage never goes below base wage (level 0 treated as 1)', () => {
    expect(computeWage('dealer', 0)).toBe(1000);
    expect(computeWage('dealer', -1)).toBe(1000);
  });

  it('exports correct morale/loyalty constants', () => {
    expect(UNPAID_MORALE_HIT).toBe(25);
    expect(UNPAID_LOYALTY_HIT).toBe(10);
    expect(PAID_MORALE_BONUS).toBe(3);
    expect(UNPAID_WEEKS_BEFORE_EXIT_RISK).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// REINFORCEMENTS TESTS
// ─────────────────────────────────────────────────────────────────────────────

function makeMember(overrides: Partial<GangMember> = {}): GangMember {
  return {
    id: `m-${Math.random().toString(36).slice(2)}`,
    gangId: 'gang-1',
    name: 'Test Member',
    nickname: 'Tester',
    avatarUrl: '',
    backstory: '',
    age: 25,
    region: 'downtown' as any,
    stats: { strength: 50, agility: 50, intelligence: 50, charisma: 50, luck: 50, intimidation: 50 },
    level: 1,
    experience: 0,
    skillPoints: 0,
    skills: [],
    loyalty: 80,
    morale: 80,
    respect: 50,
    kills: 0,
    arrests: 0,
    dealsCompleted: 0,
    moneyEarned: 0,
    status: 'active',
    currentAssignment: null,
    joinedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeBlock(units: Block['units'] = []): Block {
  const tiles: Tile[][] = Array.from({ length: 8 }, (_, y) =>
    Array.from({ length: 8 }, (_, x) => ({
      x,
      y,
      type: (y === 0 || y === 7 ? 'street' : 'sidewalk') as any,
      coverScore: 0.5,
      visibilityScore: 0.5,
      distanceToStreet: 1,
      trafficModifier: 1,
      policeRisk: 0.1,
      environmentTags: [],
      occupied: false,
      occupantId: null,
    }))
  );
  return {
    id: `block-${Math.random().toString(36).slice(2)}`,
    geoBlock: { address: '123 Test St' } as any,
    ownerId: 'player-1',
    ownerGangId: 'gang-1',
    claimedAt: new Date().toISOString(),
    grid: { width: 8, height: 8, tiles, sidewalkTop: [1], sidewalkBottom: [6], streetRows: [0, 7] },
    trafficScore: 50,
    heatLevel: 1,
    incomePerTick: 100,
    units,
    fortifications: [],
    metadata: {
      neighborhood: 'Test',
      zoning: 'commercial',
      avgBuildingHeight: 3,
      hasAlleys: false,
      cornerBlock: false,
      nearbyPOI: [],
      crimeIndex: 50,
    },
  };
}

describe('reinforcements.ts — getAvailableBackup', () => {
  it('returns active undeployed members', () => {
    const m1 = makeMember({ id: 'm1' });
    const m2 = makeMember({ id: 'm2' });
    const block = makeBlock([{ gangMemberId: 'm1', id: 'u1', type: 'shooter', memberId: 'm1', blockId: 'b1', position: null, health: 100, maxHealth: 100, accuracy: 0.5, nerve: 0.5, speed: 1, weaponId: null, armorLevel: 0, status: 'idle', assignedTask: null }]);
    const available = getAvailableBackup([m1, m2], [block]);
    expect(available).toHaveLength(1);
    expect(available[0].id).toBe('m2');
  });

  it('excludes injured members', () => {
    const m1 = makeMember({ id: 'm1', status: 'injured' });
    const available = getAvailableBackup([m1], []);
    expect(available).toHaveLength(0);
  });

  it('excludes members with active assignments', () => {
    const m1 = makeMember({ id: 'm1', currentAssignment: 'backup:session-1' });
    const available = getAvailableBackup([m1], []);
    expect(available).toHaveLength(0);
  });
});

describe('reinforcements.ts — assignEntryTiles', () => {
  it('returns edge tiles for backup spawn', () => {
    const block = makeBlock();
    const entries = assignEntryTiles(block, 2);
    expect(entries).toHaveLength(2);
    // All entries should be on the edge
    for (const e of entries) {
      const isEdge = e.x === 0 || e.y === 0 || e.x === 7 || e.y === 7;
      expect(isEdge).toBe(true);
    }
  });

  it('returns fewer tiles if grid edge is occupied', () => {
    const block = makeBlock();
    // Mark all edge tiles as occupied
    for (const row of block.grid.tiles) {
      for (const tile of row) {
        const isEdge = tile.x === 0 || tile.y === 0 || tile.x === 7 || tile.y === 7;
        if (isEdge) tile.occupied = true;
      }
    }
    const entries = assignEntryTiles(block, 4);
    expect(entries).toHaveLength(0);
  });
});

describe('reinforcements.ts — buildBackupUnits', () => {
  it('builds units with correct blockId and status', () => {
    const member = makeMember({ id: 'm1' });
    const block = makeBlock();
    const entries = [{ x: 0, y: 0 }];
    const units = buildBackupUnits([member], block, entries);
    expect(units).toHaveLength(1);
    expect(units[0].blockId).toBe(block.id);
    expect(units[0].status).toBe('combat');
    expect(units[0].assignedTask).toBe('reinforce');
    expect(units[0].gangMemberId).toBe('m1');
  });

  it('respects MAX_BACKUP_SQUAD limit', () => {
    expect(MAX_BACKUP_SQUAD).toBe(4);
  });
});
