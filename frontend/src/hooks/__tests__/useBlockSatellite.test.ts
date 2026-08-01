// Tests for useBlockSatellite hook — satellite image cache utilities
import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearSatelliteCache,
  isSatelliteCached,
  primeSatelliteCache,
  PLACEHOLDER_URI,
} from '../useBlockSatellite';

const LAS_OLAS = { lat: 26.1195, lng: -80.1368 };
const MIAMI    = { lat: 25.7617, lng: -80.1918 };

beforeEach(() => {
  clearSatelliteCache();
});

describe('satellite cache utilities', () => {
  it('isSatelliteCached returns false for uncached coordinates', () => {
    expect(isSatelliteCached(LAS_OLAS.lat, LAS_OLAS.lng)).toBe(false);
  });

  it('primeSatelliteCache + isSatelliteCached round-trip', () => {
    primeSatelliteCache(LAS_OLAS.lat, LAS_OLAS.lng, 18, 'https://example.com/sat.png');
    expect(isSatelliteCached(LAS_OLAS.lat, LAS_OLAS.lng)).toBe(true);
  });

  it('clearSatelliteCache removes all entries', () => {
    primeSatelliteCache(LAS_OLAS.lat, LAS_OLAS.lng, 18, 'https://example.com/sat.png');
    primeSatelliteCache(MIAMI.lat, MIAMI.lng, 18, 'https://example.com/sat2.png');
    clearSatelliteCache();
    expect(isSatelliteCached(LAS_OLAS.lat, LAS_OLAS.lng)).toBe(false);
    expect(isSatelliteCached(MIAMI.lat, MIAMI.lng)).toBe(false);
  });

  it('cache is keyed by zoom level — different zooms are separate entries', () => {
    primeSatelliteCache(LAS_OLAS.lat, LAS_OLAS.lng, 18, 'https://example.com/z18.png');
    expect(isSatelliteCached(LAS_OLAS.lat, LAS_OLAS.lng, 18)).toBe(true);
    expect(isSatelliteCached(LAS_OLAS.lat, LAS_OLAS.lng, 16)).toBe(false);
  });

  it('different coordinates are stored independently', () => {
    primeSatelliteCache(LAS_OLAS.lat, LAS_OLAS.lng, 18, 'https://example.com/las_olas.png');
    expect(isSatelliteCached(LAS_OLAS.lat, LAS_OLAS.lng)).toBe(true);
    expect(isSatelliteCached(MIAMI.lat, MIAMI.lng)).toBe(false);
  });
});

describe('PLACEHOLDER_URI', () => {
  it('is a valid data URI', () => {
    expect(PLACEHOLDER_URI).toMatch(/^data:image\//);
  });

  it('is non-empty', () => {
    expect(PLACEHOLDER_URI.length).toBeGreaterThan(20);
  });
});
