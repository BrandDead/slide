/**
 * End-to-end reload identity: claim → snapshot → /my-blocks → hydrated block.
 *
 * The bug this locks down: the Flask serializer used to omit a block's DNA, so
 * every reload re-resolved it from (lat, lng, address) against the LIVE
 * catalog. Growing that catalog 25 → 33 moved 485 of 610 sampled generic
 * locations to a different card, silently rewriting layout, income, heat decay,
 * cover, morale and capacity for blocks a player already owned.
 *
 * Two guarantees are asserted here, with batch two present in the catalog:
 *   1. A block claimed WITH a server snapshot hydrates to exactly that
 *      identity, even when the live resolver would now choose differently, and
 *      even if the underlying card is later rebalanced.
 *   2. A legacy record with NO snapshot resolves through the pinned v1 pool —
 *      never the expanded catalog.
 *
 * Snapshots here are built from the same parity fixture the Python service is
 * tested against (backend/python/tests/fixtures/dna_resolver_parity.json), so
 * both sides of the boundary assert against one artifact.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { apiBlockToBlockData, describeDNASource } from '../blockMappers';
import { resolveBlockDNA, resolveLegacyBlockDNA } from '../blockDNAResolver';
import { getDNAById } from '../../config/blockDNA';

interface ParityCase {
  lat: number;
  lng: number;
  address: string;
  catalogVersion: 'v1' | 'v2';
  expected: {
    dnaId: string;
    zoneLayout: string[];
    incomeMultiplier: number;
    heatDecayMultiplier: number;
    globalCoverBonus: number;
    startingMorale: number;
    maxMembers: number;
    startingHeat: number;
    hotBlock: boolean;
  };
}

const PARITY_PATH = resolve(
  __dirname,
  '../../../../backend/python/tests/fixtures/dna_resolver_parity.json',
);
const CASES: ParityCase[] = JSON.parse(readFileSync(PARITY_PATH, 'utf-8')).cases;

/** Cases where the live catalog disagrees with the v1 catalog — the risky set. */
const DRIFTING_V1_CASES = CASES.filter(
  (c) =>
    c.catalogVersion === 'v1' &&
    resolveBlockDNA(c.lat, c.lng, c.address).dna.id !== c.expected.dnaId,
);

/** Shape the Flask serializer returns from claim and /api/blocks/my-blocks. */
function apiPayload(c: ParityCase, withSnapshot: boolean) {
  return {
    id: `block-${c.address}`,
    address: c.address,
    coordinates: { lat: c.lat, lng: c.lng },
    heatLevel: 12,
    morale: 74,
    placements: [],
    ...(withSnapshot
      ? {
          dnaId: c.expected.dnaId,
          dnaSnapshot: {
            ...c.expected,
            schema: 1,
            catalogVersion: c.catalogVersion,
            seed: `block_${c.lat}_${c.lng}`,
          },
        }
      : { dnaId: null, dnaSnapshot: null }),
  };
}

describe('claim → reload keeps a claimed block tactical identity', () => {
  it('has drifting sample cases to test against (otherwise this suite is vacuous)', () => {
    expect(DRIFTING_V1_CASES.length).toBeGreaterThan(0);
  });

  it('hydrates from the server snapshot rather than re-resolving', () => {
    for (const c of DRIFTING_V1_CASES.slice(0, 40)) {
      const payload = apiPayload(c, true);
      expect(describeDNASource(payload)).toBe('snapshot');

      const block = apiBlockToBlockData(payload);
      expect(block.dnaId).toBe(c.expected.dnaId);
      expect(block.incomeMultiplier).toBe(c.expected.incomeMultiplier);
      expect(block.heatDecayMultiplier).toBe(c.expected.heatDecayMultiplier);
      expect(block.maxMembers).toBe(c.expected.maxMembers);
      // The rebuilt grid must use the snapshot's rows, not the live card's.
      expect(block.grid.map((row) => row[0].zoneType)).toEqual(c.expected.zoneLayout);
      // And it must differ from what the live catalog would have produced.
      expect(block.dnaId).not.toBe(resolveBlockDNA(c.lat, c.lng, c.address).dna.id);
    }
  });

  it('survives a later balance edit to the underlying card', () => {
    const c = DRIFTING_V1_CASES[0];
    const snapshotPayload = apiPayload(c, true);
    const rebalanced = {
      ...snapshotPayload,
      dnaSnapshot: {
        ...(snapshotPayload.dnaSnapshot as Record<string, unknown>),
        incomeMultiplier: 3.33,
        maxMembers: 42,
      },
    };
    const block = apiBlockToBlockData(rebalanced);
    expect(block.incomeMultiplier).toBe(3.33);
    expect(block.maxMembers).toBe(42);
    expect(getDNAById(c.expected.dnaId)?.incomeMultiplier).not.toBe(3.33);
  });

  it('falls back to the pinned v1 pool for records with no snapshot', () => {
    for (const c of DRIFTING_V1_CASES.slice(0, 40)) {
      const payload = apiPayload(c, false);
      expect(describeDNASource(payload)).toBe('legacy-resolver');

      const block = apiBlockToBlockData(payload);
      expect(block.dnaId).toBe(c.expected.dnaId);
      expect(block.dnaId).toBe(resolveLegacyBlockDNA(c.lat, c.lng, c.address).dna.id);
      expect(block.dnaId).not.toBe(resolveBlockDNA(c.lat, c.lng, c.address).dna.id);
      expect(block.grid.map((row) => row[0].zoneType)).toEqual(c.expected.zoneLayout);
    }
  });

  it('prefers a stored dnaId over re-resolving when no snapshot is present', () => {
    const c = DRIFTING_V1_CASES[0];
    const payload = { ...apiPayload(c, false), dnaId: 'brickell-highrise' };
    expect(describeDNASource(payload)).toBe('stored-id');
    expect(apiBlockToBlockData(payload).dnaId).toBe('brickell-highrise');
  });

  it('ignores a malformed snapshot instead of half-building the block', () => {
    const c = DRIFTING_V1_CASES[0];
    for (const bad of [
      { dnaId: '', zoneLayout: c.expected.zoneLayout },
      { dnaId: c.expected.dnaId, zoneLayout: ['street', 'curb'] },
      { dnaId: c.expected.dnaId, zoneLayout: c.expected.zoneLayout },
      { dnaId: c.expected.dnaId, zoneLayout: new Array(8).fill('lava'), incomeMultiplier: 1, heatDecayMultiplier: 1, maxMembers: 5 },
      'nonsense',
    ]) {
      const payload = { ...apiPayload(c, false), dnaSnapshot: bad };
      expect(describeDNASource(payload)).toBe('legacy-resolver');
      const block = apiBlockToBlockData(payload);
      expect(block.grid).toHaveLength(8);
      expect(block.dnaId).toBe(c.expected.dnaId);
    }
  });

  it('keeps live state (heat, morale) coming from the record, not the snapshot', () => {
    const block = apiBlockToBlockData(apiPayload(DRIFTING_V1_CASES[0], true));
    expect(block.heat).toBe(12);
    expect(block.morale).toBe(74);
  });
});
