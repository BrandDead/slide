import { describe, expect, it } from 'vitest';
import {
  anchorsForZone,
  hitZoneForNode,
  isBlockPackageV1,
  isCharacterPackageV1,
  type BlockPackageV1,
  type CharacterPackageV1,
} from '../assetPackages';

const character: CharacterPackageV1 = {
  schemaVersion: 1,
  packageId: 'character.test.v1',
  memberId: 'crew-1',
  displayName: 'Test Member',
  role: 'shooter',
  source: { editableFiles: ['test.blend'] },
  runtime: { babylonGlb: '/assets/packages/characters/test.glb' },
  skeleton: {
    profileId: 'dealt.humanoid.v1',
    rootBone: 'root',
    forwardAxis: '+Z',
    upAxis: '+Y',
    metersPerUnit: 1,
  },
  hitZones: {
    head: 'hit_head',
    torso: 'hit_torso',
    leftArm: 'hit_arm_l',
    rightArm: 'hit_arm_r',
    leftLeg: 'hit_leg_l',
    rightLeg: 'hit_leg_r',
  },
  animations: {
    idle: 'idle',
    walk: 'walk',
    sprint: 'sprint',
    strafe: 'strafe',
    aim: 'aim',
    aimWalk: 'aim_walk',
    fire: 'fire',
    reload: 'reload',
    crouch: 'crouch',
    hit: 'hit',
    downed: 'downed',
    coverEnter: 'cover_enter',
    coverIdle: 'cover_idle',
    coverExit: 'cover_exit',
  },
  lods: [{ level: 0, maxTriangles: 50000, maxBones: 100, screenCoverage: 0.3 }],
  provenance: {
    creator: 'Test',
    sourceUrl: 'internal://test',
    licenseId: 'test',
    commercialUse: true,
    aiInvolvement: 'none',
  },
};

const block: BlockPackageV1 = {
  schemaVersion: 1,
  packageId: 'block.test.v1',
  blockId: 'block-1',
  dnaId: 'test-dna',
  version: 1,
  locationLabel: 'Test Block',
  source: { editableFiles: ['block.blend'] },
  runtime: { babylonGlb: '/assets/packages/blocks/test.glb' },
  gridProjection: {
    width: 8,
    height: 8,
    cellSizeMeters: 3.2,
    origin: { x: 0, y: 0, z: 0 },
    xAxis: '+X',
    yAxis: '+Z',
  },
  anchors: [
    {
      id: 'cover-1',
      kind: 'cover',
      position: { x: 1, y: 0, z: 1 },
      gridPoint: { x: 1, y: 1 },
      tags: ['zone:parking'],
    },
  ],
  lighting: { profileId: 'night', timeOfDay: 'night', weather: 'rain', wetness: 0.8 },
  performanceBudget: {
    maxDownloadBytes: 25000000,
    maxTriangles: 500000,
    maxMaterials: 32,
    maxDrawCalls: 180,
    maxTextureBytes: 16000000,
  },
  provenance: [{
    assetId: 'block',
    creator: 'Test',
    sourceUrl: 'internal://test',
    licenseId: 'test',
    commercialUse: true,
    aiInvolvement: 'none',
  }],
};

describe('production asset packages', () => {
  it('accepts complete v1 character and block packages and rejects incomplete data', () => {
    expect(isCharacterPackageV1(character)).toBe(true);
    expect(isBlockPackageV1(block)).toBe(true);
    expect(isCharacterPackageV1({ schemaVersion: 1, packageId: 'broken' })).toBe(false);
    expect(isBlockPackageV1({ schemaVersion: 1, packageId: 'broken' })).toBe(false);
  });

  it('maps authored character nodes to renderer-neutral hit zones', () => {
    expect(hitZoneForNode(character, 'hit_head')).toBe('head');
    expect(hitZoneForNode(character, 'hit_arm_r')).toBe('arm');
    expect(hitZoneForNode(character, 'unknown')).toBeUndefined();
  });

  it('filters semantic block anchors by gameplay zone rather than mesh names', () => {
    expect(anchorsForZone(block, 'parking')).toEqual([block.anchors[0]]);
    expect(anchorsForZone(block, 'street')).toEqual([]);
  });
});
