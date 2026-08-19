import { describe, expect, it } from 'vitest';
import {
  attackableNearby,
  buildNearbyRecon,
  recommendHit,
  rankThreats,
  searchRecon,
  seedReconRing,
} from '../nearbyBlocks';

describe('nearbyBlocks', () => {
  const origin = { lat: 26.1224, lng: -80.1373 };

  it('seeds a ring of attackable and claimable strips', () => {
    const ring = seedReconRing(origin);
    expect(ring.length).toBeGreaterThanOrEqual(6);
    expect(attackableNearby(ring).length).toBeGreaterThan(0);
    expect(ring.some((b) => b.owner === 'unclaimed')).toBe(true);
    expect(ring.every((b) => b.distanceMeters > 0)).toBe(true);
  });

  it('keeps the player block and sorts by distance', () => {
    const recon = buildNearbyRecon([
      {
        id: 'home',
        address: '1208 W Las Olas Blvd',
        lat: origin.lat,
        lng: origin.lng,
        owner: 'player',
        income: 67,
        heat: 5,
        members: 1,
      },
    ], origin);
    expect(recon[0].id).toBe('home');
    expect(recon[0].action).toBe('hold');
    const distances = recon.map((b) => b.distanceMeters);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it('filters search by rival name or address', () => {
    const recon = seedReconRing(origin);
    const hits = searchRecon(recon, 'eastside');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => /eastside|sistrunk/i.test(`${h.address} ${h.gangName}`))).toBe(true);
  });

  it('recommends the richest cool rival as the war-room hit', () => {
    const recon = seedReconRing(origin);
    const rec = recommendHit(recon);
    expect(rec?.owner).toBe('npc');
    expect(rec?.income).toBeGreaterThan(0);
    const threats = rankThreats(recon, 3);
    expect(threats.length).toBeGreaterThan(0);
    expect(threats[0].income).toBeGreaterThanOrEqual(threats[threats.length - 1].income);
  });
});
