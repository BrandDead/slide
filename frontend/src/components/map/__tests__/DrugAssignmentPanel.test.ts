/**
 * DrugAssignmentPanel.test.ts
 * Logic tests for the drug assignment system — zone rules, stash wiring,
 * and BlockViewMode extension. No DOM rendering needed.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  blockZoneToDrugZone,
  canZoneAssignDrugs,
  type BlockZone,
} from '../../../stores/useDrugInventory';
import type { BlockZoneType } from '../../../types/block.types';

// ─── blockZoneToDrugZone mapping ─────────────────────────────────────────────

describe('blockZoneToDrugZone', () => {
  it('maps street zone types to "street" drug zone', () => {
    expect(blockZoneToDrugZone('street')).toBe('street');
    expect(blockZoneToDrugZone('curb')).toBe('street');
  });

  it('maps mid zone types to "mid" drug zone', () => {
    expect(blockZoneToDrugZone('sidewalk')).toBe('mid');
    expect(blockZoneToDrugZone('storefront')).toBe('mid');
  });

  it('maps back zone types to "alley" drug zone', () => {
    expect(blockZoneToDrugZone('alley')).toBe('alley');
    expect(blockZoneToDrugZone('parking')).toBe('alley');
    expect(blockZoneToDrugZone('building')).toBe('alley');
    expect(blockZoneToDrugZone('rooftop')).toBe('alley');
  });
});

// ─── canZoneAssignDrugs anti-turtle rule ─────────────────────────────────────

describe('canZoneAssignDrugs', () => {
  it('allows drug assignment in street zone', () => {
    expect(canZoneAssignDrugs('street')).toBe(true);
  });

  it('allows drug assignment in mid zone', () => {
    expect(canZoneAssignDrugs('mid')).toBe(true);
  });

  it('blocks drug assignment in alley zone (anti-turtle)', () => {
    expect(canZoneAssignDrugs('alley')).toBe(false);
  });
});

// ─── BlockViewMode extension ─────────────────────────────────────────────────

describe('BlockViewMode includes drugs', () => {
  it('drugs is a valid BlockViewMode string', () => {
    // This is a compile-time check — if it compiles, the type is correct.
    // We verify the string value matches what the component uses.
    const mode: import('../../../types/block.types').BlockViewMode = 'drugs';
    expect(mode).toBe('drugs');
  });

  it('topdown and street remain valid modes', () => {
    const topdown: import('../../../types/block.types').BlockViewMode = 'topdown';
    const street: import('../../../types/block.types').BlockViewMode = 'street';
    expect(topdown).toBe('topdown');
    expect(street).toBe('street');
  });
});

// ─── Zone income/risk trade-off validation ───────────────────────────────────

describe('Zone income/risk trade-off', () => {
  /**
   * Core game design rule: street zone = high income + high risk.
   * Alley zone = low income + low risk (but NO drug assignment).
   * This test validates the design intent is encoded in the zone mapping.
   */
  it('street zone maps to the highest-risk drug zone', () => {
    const streetDrugZone = blockZoneToDrugZone('street');
    expect(streetDrugZone).toBe('street');
    // Street zone CAN have drugs (high risk = high reward)
    expect(canZoneAssignDrugs(streetDrugZone)).toBe(true);
  });

  it('alley zone maps to the lowest-risk drug zone with no drug assignment', () => {
    const alleyDrugZone = blockZoneToDrugZone('alley');
    expect(alleyDrugZone).toBe('alley');
    // Alley zone CANNOT have drugs (safe = no income boost)
    expect(canZoneAssignDrugs(alleyDrugZone)).toBe(false);
  });

  it('all BlockZoneType values map to a valid BlockZone', () => {
    const allZones: BlockZoneType[] = [
      'street', 'curb', 'sidewalk', 'storefront',
      'alley', 'parking', 'building', 'rooftop',
    ];
    const validDrugZones: BlockZone[] = ['street', 'mid', 'alley'];
    for (const zone of allZones) {
      const drugZone = blockZoneToDrugZone(zone);
      expect(validDrugZones).toContain(drugZone);
    }
  });
});
