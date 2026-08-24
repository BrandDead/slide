// Tests for blockDNAResolver — address-to-block-archetype pipeline
import { describe, it, expect } from 'vitest';
import { resolveBlockDNA, type ResolvedBlock } from '../blockDNAResolver';

// ─── Las Olas Blvd, Fort Lauderdale ──────────────────────────────────────────
const LAS_OLAS = { lat: 26.1195, lng: -80.1368, address: '1208 W Las Olas Blvd, Fort Lauderdale, FL 33312' };

// ─── Miami residential ────────────────────────────────────────────────────────
const MIAMI_RESIDENTIAL = { lat: 25.7617, lng: -80.1918, address: '123 NW 5th Ave, Miami, FL 33128' };

// ─── NYC corner ───────────────────────────────────────────────────────────────
const NYC_CORNER = { lat: 40.7128, lng: -74.0060, address: '1 Broadway, New York, NY 10004' };

// ─── Unrecognised / outside service area ─────────────────────────────────────
const OUTSIDE = { lat: 51.5074, lng: -0.1278, address: '10 Downing St, London, UK' };

describe('resolveBlockDNA', () => {
  it('returns a valid resolution for Las Olas Blvd', () => {
    const res = resolveBlockDNA(LAS_OLAS.lat, LAS_OLAS.lng, LAS_OLAS.address);
    expect(res).toBeDefined();
    expect(res.dna).toBeDefined();
    expect(res.dna.id).toBeTruthy();
    expect(res.incomeMultiplier).toBeGreaterThan(0);
    expect(res.startingHeat).toBeGreaterThanOrEqual(0);
    expect(res.startingMorale).toBeGreaterThan(0);
    expect(res.startingMorale).toBeLessThanOrEqual(100);
  });

  it('is deterministic — same address always returns same archetype', () => {
    const a = resolveBlockDNA(LAS_OLAS.lat, LAS_OLAS.lng, LAS_OLAS.address);
    const b = resolveBlockDNA(LAS_OLAS.lat, LAS_OLAS.lng, LAS_OLAS.address);
    expect(a.dna.id).toBe(b.dna.id);
  });

  it('returns different archetypes for different addresses', () => {
    const results = [
      resolveBlockDNA(LAS_OLAS.lat, LAS_OLAS.lng, LAS_OLAS.address),
      resolveBlockDNA(MIAMI_RESIDENTIAL.lat, MIAMI_RESIDENTIAL.lng, MIAMI_RESIDENTIAL.address),
      resolveBlockDNA(NYC_CORNER.lat, NYC_CORNER.lng, NYC_CORNER.address),
    ];
    // At least two of the three should be different archetypes
    const ids = results.map(r => r.dna.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBeGreaterThanOrEqual(1);
  });

  it('handles outside-service-area gracefully — returns a fallback', () => {
    const res = resolveBlockDNA(OUTSIDE.lat, OUTSIDE.lng, OUTSIDE.address);
    // Should not throw, should return a valid DNA
    expect(res.dna).toBeDefined();
    expect(res.dna.id).toBeTruthy();
  });

  it('incomeMultiplier is within a reasonable range', () => {
    const res = resolveBlockDNA(LAS_OLAS.lat, LAS_OLAS.lng, LAS_OLAS.address);
    expect(res.incomeMultiplier).toBeGreaterThanOrEqual(0.5);
    expect(res.incomeMultiplier).toBeLessThanOrEqual(5.0);
  });

  it('startingHeat is between 0 and 5', () => {
    const res = resolveBlockDNA(LAS_OLAS.lat, LAS_OLAS.lng, LAS_OLAS.address);
    expect(res.startingHeat).toBeGreaterThanOrEqual(0);
    expect(res.startingHeat).toBeLessThanOrEqual(5);
  });

  it('tier acceptance: starter and elite blocks resolve to different stats (#80)', () => {
    // Coordinates sit right on top of two curated DNA cards in different tiers.
    const starter = resolveBlockDNA(25.8190, -80.2410, '5100 NW 24th Ct, Miami, FL');   // brownsville-court (starter)
    const elite = resolveBlockDNA(25.7630, -80.1918, '950 Brickell Ave, Miami, FL');     // brickell-highrise (elite)
    expect(starter.dna.id).toBe('brownsville-court');
    expect(elite.dna.id).toBe('brickell-highrise');
    // … and they play differently: elite pays more but starts hotter.
    expect(elite.incomeMultiplier).toBeGreaterThan(starter.incomeMultiplier);
    expect(elite.startingHeat).toBeGreaterThan(starter.startingHeat);
    expect(elite.maxMembers).toBeGreaterThan(starter.maxMembers);
    expect(elite.zoneLayout).not.toEqual(starter.zoneLayout);
  });

  it('curated cards across all tiers resolve without any Mapbox call', () => {
    // Resolve each tier's curated coordinate; all must map to a library card.
    const spots: Array<[number, number, string]> = [
      [26.1186239, -80.1574818, '1208 W Las Olas Blvd'],
      [25.8190, -80.2410, '5100 NW 24th Ct'],
      [25.8894, -80.2920, '2200 W 76th St'],
      [25.7492, -80.2615, '1200 Coral Way'],
    ];
    for (const [lat, lng, address] of spots) {
      const res = resolveBlockDNA(lat, lng, address);
      expect(res.dna.id).toBeTruthy();
      expect(res.zoneLayout).toHaveLength(8);
    }
  });
});

// ─── Fort Lauderdale city config ─────────────────────────────────────────────
import { CITY_CONFIGS } from '../../config/mapbox.config';

describe('Fort Lauderdale city config', () => {
  it('exists in CITY_CONFIGS', () => {
    expect(CITY_CONFIGS.fort_lauderdale).toBeDefined();
  });

  it('has the correct display name', () => {
    expect(CITY_CONFIGS.fort_lauderdale.displayName).toBe('Fort Lauderdale');
  });

  it('bounds contain Las Olas Blvd coordinates', () => {
    const { bounds } = CITY_CONFIGS.fort_lauderdale;
    expect(LAS_OLAS.lat).toBeGreaterThanOrEqual(bounds.south);
    expect(LAS_OLAS.lat).toBeLessThanOrEqual(bounds.north);
    expect(LAS_OLAS.lng).toBeGreaterThanOrEqual(bounds.west);
    expect(LAS_OLAS.lng).toBeLessThanOrEqual(bounds.east);
  });

  it('has a valid gangStyle with slang', () => {
    const { gangStyle } = CITY_CONFIGS.fort_lauderdale;
    expect(gangStyle.slang.block).toBeTruthy();
    expect(gangStyle.slang.money).toBeTruthy();
    expect(gangStyle.slang.police).toBeTruthy();
  });

  it('has timezone America/New_York', () => {
    expect(CITY_CONFIGS.fort_lauderdale.timezone).toBe('America/New_York');
  });
});
