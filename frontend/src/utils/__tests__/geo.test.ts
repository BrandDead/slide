import { describe, expect, it } from 'vitest';
import { formatDistance, haversineMeters, offsetLatLng } from '../geo';

describe('geo', () => {
  it('returns ~0 for the same point', () => {
    expect(haversineMeters(26.1224, -80.1373, 26.1224, -80.1373)).toBeLessThan(1);
  });

  it('measures a short Fort Lauderdale hop', () => {
    const meters = haversineMeters(26.1224, -80.1373, 26.1300, -80.1373);
    expect(meters).toBeGreaterThan(700);
    expect(meters).toBeLessThan(1000);
  });

  it('formats walking distance', () => {
    expect(formatDistance(80)).toBe('80 m');
    expect(formatDistance(2400)).toBe('2.4 km');
  });

  it('offsets north without flipping longitude wildly', () => {
    const moved = offsetLatLng(26.1224, -80.1373, 100, 0);
    expect(moved.lat).toBeGreaterThan(26.1224);
    expect(moved.lng).toBeCloseTo(-80.1373, 5);
  });
});
