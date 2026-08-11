// Tests for driveByTarget — structured target → procedural street (#108)
import { describe, it, expect } from 'vitest';
import {
  normalizeAddressText,
  textSeedFromAddress,
  resolveStreetForTarget,
  type DriveByTarget,
} from '../driveByTarget';

// Two real, coordinate-distinct targets (the same pair the dev
// autocomplete mocks use).
const LAS_OLAS: DriveByTarget = {
  address: '1208 W Las Olas Blvd, Fort Lauderdale, FL 33312',
  lat: 26.1224,
  lng: -80.1373,
  placeId: 'mock-las-olas-1208',
  seedMode: 'geocoded',
};

const OVERTOWN: DriveByTarget = {
  address: '1400 NW 3rd Ave, Miami, FL 33136',
  lat: 25.7895,
  lng: -80.2101,
  placeId: 'mock-overtown-1400',
  seedMode: 'geocoded',
};

describe('normalizeAddressText', () => {
  it('trims, collapses whitespace and lower-cases', () => {
    expect(normalizeAddressText('  63rd  &   King  Drive  ')).toBe('63rd & king drive');
  });
});

describe('textSeedFromAddress', () => {
  it('is deterministic for the same normalized address', () => {
    expect(textSeedFromAddress('63rd & king drive')).toBe(textSeedFromAddress('63rd & king drive'));
  });

  it('differs for different addresses', () => {
    expect(textSeedFromAddress('63rd & king drive')).not.toBe(textSeedFromAddress('las olas blvd'));
  });

  it('is labelled as an address seed, not a coordinate seed', () => {
    expect(textSeedFromAddress('x')).toMatch(/^addr_/);
  });
});

describe('resolveStreetForTarget — geocoded', () => {
  it('produces distinct street seeds for two coordinate-distinct targets', () => {
    const a = resolveStreetForTarget(LAS_OLAS);
    const b = resolveStreetForTarget(OVERTOWN);
    expect(a.seed).not.toBe(b.seed);
    expect(a.segments.map(s => s.id + s.sign + s.widthM))
      .not.toEqual(b.segments.map(s => s.id + s.sign + s.widthM));
  });

  it('is stable — re-selecting the same address yields the same seed and scene', () => {
    const a = resolveStreetForTarget(LAS_OLAS);
    const again = resolveStreetForTarget({ ...LAS_OLAS });
    expect(again.seed).toBe(a.seed);
    expect(again.segments).toEqual(a.segments);
  });

  it('uses the coordinate seed, never a fixed Fort Lauderdale fallback', () => {
    const a = resolveStreetForTarget(LAS_OLAS);
    // The geocoded seed is the block hash for the target's own coords.
    expect(a.seed).toContain('26.1224');
    expect(a.seed).toContain('-80.1373');
  });
});

describe('resolveStreetForTarget — offline text-seed fallback', () => {
  const typedA: DriveByTarget = { address: normalizeAddressText('63rd & King Drive'), seedMode: 'text-seed' };
  const typedB: DriveByTarget = { address: normalizeAddressText('Las Olas Blvd'), seedMode: 'text-seed' };

  it('marks the result as text-seed mode', () => {
    expect(resolveStreetForTarget(typedA).seedMode).toBe('text-seed');
  });

  it('produces distinct scenes for two different typed addresses', () => {
    const a = resolveStreetForTarget(typedA);
    const b = resolveStreetForTarget(typedB);
    expect(a.seed).not.toBe(b.seed);
    expect(a.segments).not.toEqual(b.segments);
  });

  it('is stable for the same typed address across retry', () => {
    expect(resolveStreetForTarget(typedA).seed).toBe(resolveStreetForTarget({ ...typedA }).seed);
  });
});
