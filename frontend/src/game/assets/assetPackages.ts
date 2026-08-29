import type { BlockZoneType, MemberRole } from '../../types/block.types';
import type { CombatHitZone, EncounterVector3, GridPoint } from '../combat/types';

export type AxisDirection = '+X' | '-X' | '+Y' | '-Y' | '+Z' | '-Z';
export type AiAssetInvolvement = 'none' | 'concept-only' | 'generated-base' | 'generated-final' | 'unknown';

export interface AssetProvenance {
  creator: string;
  sourceUrl: string;
  licenseId: string;
  commercialUse: boolean;
  engineRestrictions?: string[];
  aiInvolvement: AiAssetInvolvement;
  modificationNotes?: string;
}

export interface CharacterLod {
  level: number;
  maxTriangles: number;
  maxBones: number;
  screenCoverage: number;
}

export interface CharacterPackageV1 {
  schemaVersion: 1;
  packageId: string;
  memberId: string;
  displayName: string;
  role: MemberRole | 'opposition';
  wardrobeIds?: string[];
  materialVariantIds?: string[];
  portraitAssetId?: string;
  source: {
    editableFiles: string[];
    exportFbx?: string;
  };
  runtime: {
    babylonGlb: string;
    firstPersonArmsGlb?: string;
    unrealSkeletalMesh?: string;
  };
  skeleton: {
    profileId: string;
    rootBone: string;
    forwardAxis: AxisDirection;
    upAxis: AxisDirection;
    metersPerUnit: number;
  };
  hitZones: Record<'head' | 'torso' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg', string>;
  animations: Record<'idle' | 'walk' | 'sprint' | 'strafe' | 'aim' | 'aimWalk' | 'fire' | 'reload' | 'crouch' | 'hit' | 'downed' | 'coverEnter' | 'coverIdle' | 'coverExit', string>;
  weaponSockets?: {
    rightHand?: string;
    leftHandIk?: string;
    holster?: string;
  };
  lods: CharacterLod[];
  provenance: AssetProvenance;
}

export type BlockAnchorKind =
  | 'crew-spawn'
  | 'opposition-spawn'
  | 'cover'
  | 'objective'
  | 'extraction'
  | 'vehicle'
  | 'interaction'
  | 'navigation'
  | 'occlusion';

export interface BlockAnchor {
  id: string;
  kind: BlockAnchorKind;
  position: EncounterVector3;
  rotationDegrees?: EncounterVector3;
  gridPoint: GridPoint;
  entityId?: string;
  tags?: string[];
}

export interface BlockPackageV1 {
  schemaVersion: 1;
  packageId: string;
  blockId: string;
  dnaId: string;
  version: number;
  locationLabel: string;
  source: {
    editableFiles: string[];
    exportFbx?: string;
  };
  runtime: {
    babylonGlb: string;
    unrealMap?: string;
    textureRoot?: string;
  };
  gridProjection: {
    width: number;
    height: number;
    cellSizeMeters: number;
    origin: EncounterVector3;
    xAxis: Extract<AxisDirection, '+X' | '-X' | '+Z' | '-Z'>;
    yAxis: Extract<AxisDirection, '+X' | '-X' | '+Z' | '-Z'>;
  };
  anchors: BlockAnchor[];
  lighting: {
    profileId: string;
    timeOfDay: 'day' | 'dusk' | 'night' | 'dawn';
    weather: 'clear' | 'overcast' | 'rain' | 'storm';
    wetness: number;
    reflectionProbeIds?: string[];
  };
  performanceBudget: {
    maxDownloadBytes: number;
    maxTriangles: number;
    maxMaterials: number;
    maxDrawCalls: number;
    maxTextureBytes: number;
  };
  provenance: Array<AssetProvenance & { assetId: string }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasString(record: Record<string, unknown>, key: string): boolean {
  return typeof record[key] === 'string' && (record[key] as string).length > 0;
}

export function isCharacterPackageV1(value: unknown): value is CharacterPackageV1 {
  if (!isRecord(value) || value.schemaVersion !== 1) return false;
  if (!hasString(value, 'packageId') || !hasString(value, 'memberId') || !hasString(value, 'displayName')) return false;
  if (!isRecord(value.runtime) || !hasString(value.runtime, 'babylonGlb')) return false;
  if (!isRecord(value.skeleton) || !hasString(value.skeleton, 'profileId')) return false;
  if (!isRecord(value.hitZones) || !isRecord(value.animations)) return false;
  return Array.isArray(value.lods) && isRecord(value.provenance);
}

export function isBlockPackageV1(value: unknown): value is BlockPackageV1 {
  if (!isRecord(value) || value.schemaVersion !== 1) return false;
  if (!hasString(value, 'packageId') || !hasString(value, 'blockId') || !hasString(value, 'dnaId')) return false;
  if (!isRecord(value.runtime) || !hasString(value.runtime, 'babylonGlb')) return false;
  if (!isRecord(value.gridProjection) || !Array.isArray(value.anchors)) return false;
  return isRecord(value.lighting) && isRecord(value.performanceBudget) && Array.isArray(value.provenance);
}

async function loadJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Asset package request failed (${response.status}) for ${url}`);
  return response.json() as Promise<unknown>;
}

export async function loadCharacterPackage(url: string, signal?: AbortSignal): Promise<CharacterPackageV1> {
  const value = await loadJson(url, signal);
  if (!isCharacterPackageV1(value)) throw new Error(`Invalid character package: ${url}`);
  return value;
}

export async function loadBlockPackage(url: string, signal?: AbortSignal): Promise<BlockPackageV1> {
  const value = await loadJson(url, signal);
  if (!isBlockPackageV1(value)) throw new Error(`Invalid block package: ${url}`);
  return value;
}

export function hitZoneForNode(packageDefinition: CharacterPackageV1, nodeName: string): CombatHitZone | undefined {
  if (nodeName === packageDefinition.hitZones.head) return 'head';
  if (nodeName === packageDefinition.hitZones.torso) return 'torso';
  if (nodeName === packageDefinition.hitZones.leftArm || nodeName === packageDefinition.hitZones.rightArm) return 'arm';
  if (nodeName === packageDefinition.hitZones.leftLeg || nodeName === packageDefinition.hitZones.rightLeg) return 'leg';
  return undefined;
}

export function anchorsForZone(packageDefinition: BlockPackageV1, zone: BlockZoneType): BlockAnchor[] {
  return packageDefinition.anchors.filter((anchor) => anchor.tags?.includes(`zone:${zone}`));
}
