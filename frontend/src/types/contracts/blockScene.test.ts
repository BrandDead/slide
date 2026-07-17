import { describe, expect, it } from 'vitest';
import {
  createAttackSnapshot,
  gridCellToAnchorId,
  type BlockSceneManifest,
  type LiveBlockState,
} from './blockScene.types';

describe('Gate 0B block contracts', () => {
  it('maps grid cells to stable anchor ids', () => {
    expect(gridCellToAnchorId(3, 5)).toBe('cell-3-5');
  });

  it('freezes live placements into an AttackSnapshot without sharing mutation', () => {
    const live: LiveBlockState = {
      blockId: 'block-1',
      sceneVersion: 'v1',
      revision: 4,
      ownerId: 'user-1',
      claimStatus: 'owned',
      placements: [
        {
          memberId: 'm1',
          anchorId: 'cell-2-3',
          role: 'dealer',
          localOffsetXM: 0,
          localOffsetYM: 0,
          facingDeg: 90,
          health: 100,
          loadout: { product: 'weed' },
          gridX: 2,
          gridY: 3,
        },
      ],
      heat: 5,
      morale: 80,
      pendingIncome: 120,
      incomePerTick: 40,
      updatedAt: '2026-07-17T00:00:00.000Z',
    };

    const snap = createAttackSnapshot({
      attackId: 'atk-1',
      live,
      seed: 'seed-abc',
      startedAt: '2026-07-17T01:00:00.000Z',
    });

    expect(snap.sceneVersion).toBe('v1');
    expect(snap.liveRevision).toBe(4);
    expect(snap.defenderPlacements).toHaveLength(1);
    expect(snap.defenderPlacements[0].memberId).toBe('m1');

    live.placements[0].health = 10;
    expect(snap.defenderPlacements[0].health).toBe(100);
  });

  it('requires manifest identity fields for an immutable scene', () => {
    const manifest: BlockSceneManifest = {
      blockId: 'b1',
      sceneVersion: 'scene-1',
      status: 'fallback',
      addressDisplay: 'Sample Plaza',
      addressCanonical: 'Sample Plaza',
      geocoderFeatureId: null,
      extent: {
        widthM: 80,
        heightM: 80,
        rotationBearingDeg: 0,
        centerLat: 25.76,
        centerLng: -80.19,
        bounds: {},
      },
      gridWidth: 8,
      gridHeight: 8,
      cellSizeM: 10,
      anchors: [],
      gridZoneTypes: [],
      topdownTextureUrl: null,
      streetStripUrl: null,
      provenance: { source: 'test' },
      createdAt: '2026-07-17T00:00:00.000Z',
    };
    expect(manifest.status).toBe('fallback');
    expect(manifest.extent.widthM).toBe(80);
  });
});
