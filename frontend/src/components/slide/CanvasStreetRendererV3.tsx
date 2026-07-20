// ============================================================
// CanvasStreetRenderer — Las Olas destruction / ragdoll renderer
// Procedural 2.5D scene with persistent surface and vehicle damage.
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type {
  BlockPlacement,
  DriveByEvent,
  DriveByPhase,
  DriveByShot,
  MemberRole,
} from '../../types/block.types';
import {
  ImpactEngine,
  type ImpactSurface,
  type ImpactSurfaceKind,
} from '../../utils/ImpactEngine';
import { RagdollEngine } from '../../utils/RagdollEngine';
import {
  LAS_OLAS_1208_SCENE,
  getAllSceneSurfaces,
  type NormalizedRect,
  type SceneSurface,
} from '../../config/lasOlas1208Scene';
import { getStreetSpriteUrl, loadDefringedSprite } from '../../services/assetResolver';

export interface CanvasStreetRendererProps {
  placements: BlockPlacement[];
  activeDriveBy?: DriveByEvent;
  width: number;
  height: number;
  onDefendShot: (x: number, y: number) => void;
}

interface RenderPoint {
  x: number;
  y: number;
}

interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CarGeometry extends PixelRect {
  scale: number;
  baselineY: number;
  frontWindow: PixelRect;
  rearWindow: PixelRect;
  frontDoor: PixelRect;
  rearDoor: PixelRect;
}

type VehicleMarkKind = 'bullet-hole' | 'dent' | 'glass-crack';
type VehiclePanel = 'front-window' | 'rear-window' | 'front-door' | 'rear-door' | 'body';

interface VehicleDamageMark {
  id: number;
  panel: VehiclePanel;
  kind: VehicleMarkKind;
  localX: number;
  localY: number;
  radius: number;
  rotation: number;
  seed: number;
}

interface VehicleDamageState {
  marks: VehicleDamageMark[];
  frontWindowHits: number;
  rearWindowHits: number;
  frontWindowBroken: boolean;
  rearWindowBroken: boolean;
  bodyIntegrity: number;
  nextId: number;
}

interface MuzzleFlash {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  angle: number;
  size: number;
}

interface Tracer {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  life: number;
  maxLife: number;
}

const MEMBER_FRAMES: Partial<Record<MemberRole, number>> = {
  dealer: 0,
  shooter: 1,
  enforcer: 2,
  lookout: 3,
};

const ROLE_COLORS: Record<MemberRole, string> = {
  dealer: '#367c54',
  shooter: '#7f2932',
  enforcer: '#a45a24',
  lookout: '#285d8b',
  driver: '#673b85',
  chemist: '#247d80',
  runner: '#8a7225',
  boss: '#8c315e',
};

const SKIN_TONES = ['#6d442f', '#8b5a3c', '#a86f4b', '#c58c65', '#7b5038'];
const SPRITE_URL = '/assets/sprites/gang_members.png';
const SPRITE_SHEET_COLS = 4;
const SPRITE_FRAME_WIDTH = 688;
const SPRITE_FRAME_HEIGHT = 1536;
const MEMBER_RENDER_WIDTH = 40;
const MEMBER_RENDER_HEIGHT = Math.round(
  MEMBER_RENDER_WIDTH * (SPRITE_FRAME_HEIGHT / SPRITE_FRAME_WIDTH),
);

const ZONE_Y_MAP: Record<string, number> = {
  rooftop: 0.25,
  building: 0.35,
  storefront: 0.57,
  alley: 0.59,
  sidewalk: 0.68,
  parking: 0.73,
  curb: 0.76,
  street: 0.83,
};

const SCENE_SURFACES = getAllSceneSurfaces();

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const smoothstep = (value: number): number => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

const hashNumber = (value: number): number => {
  const result = Math.sin(value * 12.9898 + 78.233) * 43758.5453;
  return result - Math.floor(result);
};

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
};

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function toPixelRect(rect: NormalizedRect, width: number, height: number): PixelRect {
  return {
    x: rect.x * width,
    y: rect.y * height,
    width: rect.width * width,
    height: rect.height * height,
  };
}

function toImpactSurface(
  surface: SceneSurface,
  width: number,
  height: number,
): ImpactSurface {
  const rect = toPixelRect(surface, width, height);
  return {
    id: surface.id,
    kind: surface.kind,
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    integrity: surface.integrity,
  };
}

function pointInRect(x: number, y: number, rect: PixelRect): boolean {
  return (
    x >= rect.x &&
    x <= rect.x + rect.width &&
    y >= rect.y &&
    y <= rect.y + rect.height
  );
}

function memberRenderPoint(member: BlockPlacement, width: number, height: number): RenderPoint {
  const x = ((member.x + 0.5) / 8) * width;
  const baseY = height * (ZONE_Y_MAP[member.zoneType] ?? 0.68);
  const stagger = ((member.y % 3) - 1) * 2.2;
  return { x, y: baseY + stagger };
}

function getCarGeometry(
  phase: DriveByPhase,
  phaseElapsed: number,
  width: number,
  height: number,
): CarGeometry | undefined {
  if (phase === 'idle' || phase === 'resolved') return undefined;

  const scale = clamp(Math.min(width / 480, height / 270), 0.72, 1.65);
  const carWidth = 172 * scale;
  const carHeight = 72 * scale;
  const baselineY = height * 0.84;
  let x: number;

  if (phase === 'incoming') {
    const progress = smoothstep(phaseElapsed / 2000);
    x = -carWidth - 20 + progress * (width * 0.24 + carWidth + 20);
  } else if (phase === 'active') {
    x = width * 0.24;
  } else {
    const progress = smoothstep(phaseElapsed / 1500);
    x = width * 0.24 + progress * (width + carWidth);
  }

  const y = baselineY - carHeight;
  const frontWindow: PixelRect = {
    x: x + 91 * scale,
    y: y + 9 * scale,
    width: 39 * scale,
    height: 22 * scale,
  };
  const rearWindow: PixelRect = {
    x: x + 48 * scale,
    y: y + 9 * scale,
    width: 39 * scale,
    height: 22 * scale,
  };
  const frontDoor: PixelRect = {
    x: x + 88 * scale,
    y: y + 30 * scale,
    width: 48 * scale,
    height: 29 * scale,
  };
  const rearDoor: PixelRect = {
    x: x + 40 * scale,
    y: y + 30 * scale,
    width: 48 * scale,
    height: 29 * scale,
  };

  return {
    x,
    y,
    width: carWidth,
    height: carHeight,
    scale,
    baselineY,
    frontWindow,
    rearWindow,
    frontDoor,
    rearDoor,
  };
}

function findMemberAtGrid(
  placements: readonly BlockPlacement[],
  x: number,
  y: number,
): BlockPlacement | undefined {
  return placements.find((member) => member.x === Math.round(x) && member.y === Math.round(y));
}

function findMemberNearPixel(
  placements: readonly BlockPlacement[],
  x: number,
  y: number,
  width: number,
  height: number,
): BlockPlacement | undefined {
  let nearest: BlockPlacement | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const member of placements) {
    const point = memberRenderPoint(member, width, height);
    const dx = x - point.x;
    const dy = y - (point.y - MEMBER_RENDER_HEIGHT * 0.25);
    const normalized = (dx * dx) / (24 * 24) + (dy * dy) / (48 * 48);
    if (normalized <= 1 && normalized < nearestDistance) {
      nearestDistance = normalized;
      nearest = member;
    }
  }
  return nearest;
}

function initialVehicleDamage(): VehicleDamageState {
  return {
    marks: [],
    frontWindowHits: 0,
    rearWindowHits: 0,
    frontWindowBroken: false,
    rearWindowBroken: false,
    bodyIntegrity: 420,
    nextId: 1,
  };
}

function classifyVehiclePanel(
  x: number,
  y: number,
  car: CarGeometry,
): VehiclePanel | undefined {
  if (!pointInRect(x, y, car)) return undefined;
  if (pointInRect(x, y, car.frontWindow)) return 'front-window';
  if (pointInRect(x, y, car.rearWindow)) return 'rear-window';
  if (pointInRect(x, y, car.frontDoor)) return 'front-door';
  if (pointInRect(x, y, car.rearDoor)) return 'rear-door';
  return 'body';
}

function findSceneSurface(
  x: number,
  y: number,
  width: number,
  height: number,
): ImpactSurface | undefined {
  const candidates = SCENE_SURFACES
    .map((surface) => toImpactSurface(surface, width, height))
    .filter((surface) => pointInRect(x, y, surface))
    .sort((a, b) => a.width * a.height - b.width * b.height);
  return candidates[0];
}

function drawPalm(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  scale: number,
  lean: number,
  elapsed: number,
): void {
  const trunkHeight = 112 * scale;
  const topX = x + lean * trunkHeight;
  const topY = groundY - trunkHeight;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#5b4839';
  ctx.lineWidth = 8 * scale;
  ctx.beginPath();
  ctx.moveTo(x, groundY);
  ctx.bezierCurveTo(
    x + lean * 18,
    groundY - trunkHeight * 0.36,
    topX - lean * 18,
    groundY - trunkHeight * 0.72,
    topX,
    topY,
  );
  ctx.stroke();

  ctx.strokeStyle = 'rgba(205,177,137,0.32)';
  ctx.lineWidth = 1.2 * scale;
  for (let band = 0; band < 9; band++) {
    const t = band / 9;
    const bandX = x + (topX - x) * t;
    const bandY = groundY + (topY - groundY) * t;
    ctx.beginPath();
    ctx.moveTo(bandX - 4 * scale, bandY);
    ctx.lineTo(bandX + 4 * scale, bandY - 2 * scale);
    ctx.stroke();
  }

  const sway = Math.sin(elapsed * 0.0008 + x * 0.02) * 0.06;
  for (let frond = 0; frond < 11; frond++) {
    const angle = (Math.PI * 2 * frond) / 11 - Math.PI / 2 + sway;
    const length = (31 + (frond % 3) * 7) * scale;
    const endX = topX + Math.cos(angle) * length;
    const endY = topY + Math.sin(angle) * length * 0.58;
    ctx.strokeStyle = frond % 2 === 0 ? '#1c523f' : '#28634b';
    ctx.lineWidth = 3.4 * scale;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(
      topX + Math.cos(angle) * length * 0.55,
      topY + Math.sin(angle) * length * 0.2 - 4 * scale,
      endX,
      endY,
    );
    ctx.stroke();
  }

  ctx.fillStyle = '#2b5a43';
  ctx.beginPath();
  ctx.arc(topX, topY, 7 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawWindowCrack(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  seed: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = 'rgba(218,241,255,0.88)';
  ctx.lineWidth = 0.72;
  for (let ray = 0; ray < 8; ray++) {
    const angle = (Math.PI * 2 * ray) / 8 + hashNumber(seed + ray) * 0.25;
    const length = radius * (0.55 + hashNumber(seed + ray * 3) * 0.6);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(
      Math.cos(angle) * length * 0.45,
      Math.sin(angle) * length * 0.45 + (hashNumber(seed + ray * 7) - 0.5) * 5,
      Math.cos(angle) * length,
      Math.sin(angle) * length,
    );
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.9)';
  ctx.beginPath();
  ctx.arc(0, 0, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawVehicleBulletHole(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
): void {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 2.1);
  gradient.addColorStop(0, 'rgba(0,0,0,1)');
  gradient.addColorStop(0.35, 'rgba(8,8,9,0.95)');
  gradient.addColorStop(0.58, 'rgba(145,135,122,0.45)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius * 2.1, 0, Math.PI * 2);
  ctx.fill();
}

export function CanvasStreetRenderer({
  placements,
  activeDriveBy,
  width,
  height,
  onDefendShot,
}: CanvasStreetRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef(0);
  const startTimeRef = useRef(performance.now());
  const phaseStartRef = useRef(performance.now());
  const lastFrameRef = useRef(performance.now());
  const lastPhaseRef = useRef<DriveByPhase>('idle');
  const lastEventIdRef = useRef<string | null>(null);

  const placementsRef = useRef(placements);
  const driveByRef = useRef(activeDriveBy);
  const widthRef = useRef(width);
  const heightRef = useRef(height);
  const onDefendShotRef = useRef(onDefendShot);
  const processedShotsRef = useRef(new Set<string>());
  const visualHealthRef = useRef(new Map<string, number>());
  const vehicleDamageRef = useRef<VehicleDamageState>(initialVehicleDamage());
  const cameraShakeRef = useRef(0);

  const impactRef = useRef(new ImpactEngine(width, height));
  const ragdollRef = useRef(new RagdollEngine());
  const muzzleFlashesRef = useRef<MuzzleFlash[]>([]);
  const tracersRef = useRef<Tracer[]>([]);

  const spriteRef = useRef<HTMLImageElement | null>(null);
  const spriteReadyRef = useRef(false);
  const hiResSpritesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const [dpr, setDpr] = useState(1);

  useEffect(() => {
    setDpr(window.devicePixelRatio || 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      spriteRef.current = image;
      spriteReadyRef.current = true;
    };
    image.onerror = () => {
      spriteReadyRef.current = false;
    };
    image.src = SPRITE_URL;
    return () => {
      cancelled = true;
    };
  }, []);

  // High-fidelity standing sprites from the generated art library.
  // Roles without usable street art keep the legacy sheet / vector body.
  useEffect(() => {
    let cancelled = false;
    const roles: MemberRole[] = [
      'dealer',
      'shooter',
      'enforcer',
      'lookout',
      'driver',
      'chemist',
      'runner',
      'boss',
    ];
    for (const role of roles) {
      const url = getStreetSpriteUrl(role, 'idle');
      if (!url) continue;
      loadDefringedSprite(url)
        .then((sprite) => {
          if (!cancelled) hiResSpritesRef.current.set(role, sprite);
        })
        .catch(() => {
          /* keep legacy rendering for this role */
        });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    placementsRef.current = placements;
    const activeIds = new Set<string>();
    for (const placement of placements) {
      activeIds.add(placement.memberId);
      if (!visualHealthRef.current.has(placement.memberId)) {
        visualHealthRef.current.set(placement.memberId, placement.health);
      }
    }
    ragdollRef.current.removeMissing(activeIds);
  }, [placements]);

  useEffect(() => {
    driveByRef.current = activeDriveBy;
    const eventId = activeDriveBy?.id ?? null;
    if (eventId !== lastEventIdRef.current) {
      lastEventIdRef.current = eventId;
      processedShotsRef.current.clear();
      vehicleDamageRef.current = initialVehicleDamage();
      impactRef.current.clear();
      ragdollRef.current.clear();
      visualHealthRef.current.clear();
      for (const placement of placementsRef.current) {
        visualHealthRef.current.set(placement.memberId, placement.health);
      }
    }

    const phase = activeDriveBy?.phase ?? 'idle';
    if (phase !== lastPhaseRef.current) {
      lastPhaseRef.current = phase;
      phaseStartRef.current = performance.now();
    }
  }, [activeDriveBy]);

  useEffect(() => {
    widthRef.current = width;
    heightRef.current = height;
    impactRef.current.resize(width, height);
    impactRef.current.registerSurfaces(
      SCENE_SURFACES.map((surface) => toImpactSurface(surface, width, height)),
    );
  }, [width, height]);

  useEffect(() => {
    onDefendShotRef.current = onDefendShot;
  }, [onDefendShot]);

  const spawnMuzzleFlash = useCallback((x: number, y: number, angle: number, size = 1) => {
    muzzleFlashesRef.current.push({
      x,
      y,
      life: 0.11,
      maxLife: 0.11,
      angle,
      size,
    });
  }, []);

  const addTracer = useCallback(
    (startX: number, startY: number, endX: number, endY: number) => {
      tracersRef.current.push({
        startX,
        startY,
        endX,
        endY,
        life: 0.085,
        maxLife: 0.085,
      });
    },
    [],
  );

  const applyEnvironmentImpact = useCallback(
    (x: number, y: number, angle: number, energy: number) => {
      const sceneWidth = widthRef.current;
      const sceneHeight = heightRef.current;
      const surface = findSceneSurface(x, y, sceneWidth, sceneHeight);
      if (surface) {
        impactRef.current.hitSurface(surface, x, y, angle, energy);
      } else {
        const fallback: ImpactSurface = {
          id: y > sceneHeight * 0.74 ? 'street-asphalt' : 'main-stucco-wall',
          kind: y > sceneHeight * 0.74 ? 'asphalt' : 'concrete',
          x: 0,
          y: 0,
          width: sceneWidth,
          height: sceneHeight,
          integrity: 1000,
        };
        impactRef.current.hitSurface(fallback, x, y, angle, energy);
      }
      cameraShakeRef.current = Math.max(cameraShakeRef.current, 1.8);
    },
    [],
  );

  const applyVehicleImpact = useCallback(
    (x: number, y: number, car: CarGeometry, damage: number): boolean => {
      const panel = classifyVehiclePanel(x, y, car);
      if (!panel) return false;

      const state = vehicleDamageRef.current;
      const localX = x - car.x;
      const localY = y - car.y;
      const isWindow = panel === 'front-window' || panel === 'rear-window';
      state.marks.push({
        id: state.nextId,
        panel,
        kind: isWindow ? 'glass-crack' : 'bullet-hole',
        localX,
        localY,
        radius: isWindow ? 10 + Math.random() * 7 : 2.3 + Math.random() * 1.8,
        rotation: Math.random() * Math.PI * 2,
        seed: state.nextId * 13.17 + x * 0.11,
      });
      state.nextId += 1;

      if (!isWindow) {
        state.marks.push({
          id: state.nextId,
          panel,
          kind: 'dent',
          localX,
          localY,
          radius: 8 + Math.min(10, damage * 0.12),
          rotation: Math.random() * Math.PI * 2,
          seed: state.nextId * 19.03,
        });
        state.nextId += 1;
        state.bodyIntegrity = Math.max(0, state.bodyIntegrity - Math.max(8, damage));
        impactRef.current.spawnSparks(x, y, Math.PI, 1.15);
        if (state.bodyIntegrity < 180) impactRef.current.spawnSmoke(x, car.y + 30 * car.scale, 0.6, 2);
      } else {
        impactRef.current.spawnGlass(x, y, Math.PI, 0.8);
        if (panel === 'front-window') {
          state.frontWindowHits += 1;
          if (state.frontWindowHits >= 3) state.frontWindowBroken = true;
        } else {
          state.rearWindowHits += 1;
          if (state.rearWindowHits >= 3) state.rearWindowBroken = true;
        }
      }

      if (state.marks.length > 140) state.marks.splice(0, state.marks.length - 140);
      cameraShakeRef.current = Math.max(cameraShakeRef.current, isWindow ? 2.8 : 3.5);
      return true;
    },
    [],
  );

  const processShots = useCallback(
    (phaseElapsed: number) => {
      const driveBy = driveByRef.current;
      if (!driveBy) return;

      const sceneWidth = widthRef.current;
      const sceneHeight = heightRef.current;
      const placementsNow = placementsRef.current;
      const car = getCarGeometry(driveBy.phase, phaseElapsed, sceneWidth, sceneHeight);
      const shots: Array<{ shot: DriveByShot; kind: 'attack' | 'defend' }> = [
        ...driveBy.shots.map((shot) => ({ shot, kind: 'attack' as const })),
        ...driveBy.defenderShots.map((shot) => ({ shot, kind: 'defend' as const })),
      ];

      for (const { shot, kind } of shots) {
        const key = `${kind}:${shot.timestamp}:${shot.shooterId}:${shot.targetX}:${shot.targetY}`;
        if (processedShotsRef.current.has(key)) continue;
        processedShotsRef.current.add(key);

        const shotSeed = shot.timestamp * 0.001 + shot.targetX * 7.1 + shot.targetY * 13.7;
        const gridCoordinates =
          Number.isFinite(shot.targetX) &&
          Number.isFinite(shot.targetY) &&
          shot.targetX >= 0 &&
          shot.targetX <= 7 &&
          shot.targetY >= 0 &&
          shot.targetY <= 7;

        let targetX = shot.targetX;
        let targetY = shot.targetY;
        let targetMember: BlockPlacement | undefined;

        if (gridCoordinates) {
          targetMember = findMemberAtGrid(placementsNow, shot.targetX, shot.targetY);
          if (targetMember) {
            const point = memberRenderPoint(targetMember, sceneWidth, sceneHeight);
            targetX = point.x + (hashNumber(shotSeed) - 0.5) * 12;
            targetY =
              point.y -
              MEMBER_RENDER_HEIGHT * (0.16 + hashNumber(shotSeed + 3) * 0.45);
          } else {
            targetX = ((shot.targetX + 0.5) / 8) * sceneWidth;
            targetY = ((shot.targetY + 0.5) / 8) * sceneHeight;
          }
        } else if (kind === 'attack') {
          targetMember = findMemberNearPixel(
            placementsNow,
            targetX,
            targetY,
            sceneWidth,
            sceneHeight,
          );
        }

        if (!shot.hit) {
          targetX += (hashNumber(shotSeed + 11) - 0.5) * 58;
          targetY += (hashNumber(shotSeed + 17) - 0.5) * 42;
          targetMember = undefined;
        }

        if (kind === 'attack') {
          const originX = car ? car.x + car.width * 0.62 : 0;
          const originY = car ? car.y + car.height * 0.33 : sceneHeight * 0.82;
          const angle = Math.atan2(targetY - originY, targetX - originX);
          addTracer(originX, originY, targetX, targetY);
          spawnMuzzleFlash(originX, originY, angle, 1.15);

          if (shot.hit && targetMember) {
            const memberPoint = memberRenderPoint(targetMember, sceneWidth, sceneHeight);
            const roleColor = ROLE_COLORS[targetMember.role];
            const skinColor = SKIN_TONES[hashString(targetMember.memberId) % SKIN_TONES.length];
            ragdollRef.current.ensure(
              targetMember.memberId,
              memberPoint.x,
              memberPoint.y,
              1,
              roleColor,
              skinColor,
            );

            const previousHealth =
              visualHealthRef.current.get(targetMember.memberId) ?? targetMember.health;
            const nextHealth = Math.max(0, previousHealth - Math.max(1, shot.damage));
            visualHealthRef.current.set(targetMember.memberId, nextHealth);
            const lethal = nextHealth <= 0;
            ragdollRef.current.applyHit(targetMember.memberId, {
              hitX: targetX,
              hitY: targetY,
              directionX: targetX - originX,
              directionY: targetY - originY,
              force: 130 + shot.damage * 4.2,
              lethal,
            });
            impactRef.current.spawnBlood(
              targetX,
              targetY,
              angle,
              lethal ? 1.55 : 0.75 + shot.damage / 90,
            );
            cameraShakeRef.current = Math.max(cameraShakeRef.current, lethal ? 5 : 3.2);
          } else {
            applyEnvironmentImpact(targetX, targetY, angle, Math.max(18, shot.damage || 26));
          }
        } else {
          const originX = sceneWidth * 0.52;
          const originY = sceneHeight * 0.97;
          const angle = Math.atan2(targetY - originY, targetX - originX);
          addTracer(originX, originY, targetX, targetY);
          spawnMuzzleFlash(originX, originY, angle, 0.85);
          const vehicleHit = car
            ? applyVehicleImpact(targetX, targetY, car, Math.max(15, shot.damage))
            : false;
          if (!vehicleHit) {
            applyEnvironmentImpact(targetX, targetY, angle, Math.max(18, shot.damage || 24));
          }
        }
      }

      if (processedShotsRef.current.size > 900) {
        const latest = Array.from(processedShotsRef.current).slice(-600);
        processedShotsRef.current = new Set(latest);
      }
    },
    [addTracer, applyEnvironmentImpact, applyVehicleImpact, spawnMuzzleFlash],
  );

  const handleCanvasClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const bounds = canvas.getBoundingClientRect();
      const x = ((event.clientX - bounds.left) / bounds.width) * widthRef.current;
      const y = ((event.clientY - bounds.top) / bounds.height) * heightRef.current;
      onDefendShotRef.current(x, y);
    },
    [],
  );

  const drawSkyAndAtmosphere = useCallback(
    (ctx: CanvasRenderingContext2D, elapsed: number, sceneWidth: number, sceneHeight: number) => {
      const palette = LAS_OLAS_1208_SCENE.palette;
      const sky = ctx.createLinearGradient(0, 0, 0, sceneHeight * 0.68);
      sky.addColorStop(0, palette.skyTop);
      sky.addColorStop(0.58, '#182334');
      sky.addColorStop(1, palette.skyHorizon);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, sceneWidth, sceneHeight * 0.68);

      const moonX = sceneWidth * 0.82;
      const moonY = sceneHeight * 0.15;
      const moonGlow = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, sceneHeight * 0.22);
      moonGlow.addColorStop(0, 'rgba(255,177,93,0.2)');
      moonGlow.addColorStop(0.35, 'rgba(216,112,66,0.08)');
      moonGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = moonGlow;
      ctx.fillRect(0, 0, sceneWidth, sceneHeight * 0.5);

      ctx.fillStyle = '#d77845';
      ctx.globalAlpha = 0.72;
      ctx.beginPath();
      ctx.arc(moonX, moonY, sceneHeight * 0.04, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.fillStyle = 'rgba(10,14,20,0.9)';
      for (let index = 0; index < 13; index++) {
        const buildingWidth = sceneWidth * (0.045 + (index % 4) * 0.008);
        const x = index * sceneWidth * 0.078 - sceneWidth * 0.03;
        const buildingHeight = sceneHeight * (0.14 + (index % 5) * 0.023);
        ctx.fillRect(x, sceneHeight * 0.38 - buildingHeight, buildingWidth, buildingHeight);
        ctx.fillStyle = 'rgba(244,183,92,0.16)';
        for (let row = 0; row < 4; row++) {
          for (let column = 0; column < 3; column++) {
            if ((index + row + column) % 3 !== 0) continue;
            ctx.fillRect(
              x + 7 + column * 11,
              sceneHeight * 0.38 - buildingHeight + 9 + row * 13,
              4,
              6,
            );
          }
        }
        ctx.fillStyle = 'rgba(10,14,20,0.9)';
      }

      const haze = ctx.createLinearGradient(0, sceneHeight * 0.25, 0, sceneHeight * 0.7);
      haze.addColorStop(0, 'rgba(160,178,195,0)');
      haze.addColorStop(1, 'rgba(154,173,188,0.11)');
      ctx.fillStyle = haze;
      ctx.fillRect(0, sceneHeight * 0.2, sceneWidth, sceneHeight * 0.5);

      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      for (let speck = 0; speck < 32; speck++) {
        const x = (speck * 83 + elapsed * 0.004) % sceneWidth;
        const y = sceneHeight * 0.1 + ((speck * 37) % Math.max(1, sceneHeight * 0.48));
        ctx.fillRect(x, y, 1, 1);
      }
    },
    [],
  );

  const drawStorefronts = useCallback(
    (ctx: CanvasRenderingContext2D, sceneWidth: number, sceneHeight: number) => {
      const impact = impactRef.current;

      ctx.fillStyle = LAS_OLAS_1208_SCENE.palette.buildingShadow;
      ctx.fillRect(0, sceneHeight * 0.245, sceneWidth, sceneHeight * 0.39);

      for (const storefront of LAS_OLAS_1208_SCENE.storefronts) {
        const facade = toPixelRect(storefront.facade, sceneWidth, sceneHeight);
        ctx.fillStyle = storefront.facadeTone;
        ctx.fillRect(facade.x, facade.y, facade.width, facade.height);

        const facadeShade = ctx.createLinearGradient(
          facade.x,
          facade.y,
          facade.x + facade.width,
          facade.y + facade.height,
        );
        facadeShade.addColorStop(0, 'rgba(255,255,255,0.11)');
        facadeShade.addColorStop(0.52, 'rgba(255,255,255,0)');
        facadeShade.addColorStop(1, 'rgba(0,0,0,0.24)');
        ctx.fillStyle = facadeShade;
        ctx.fillRect(facade.x, facade.y, facade.width, facade.height);

        ctx.fillStyle = storefront.trimTone;
        ctx.fillRect(facade.x, facade.y, facade.width, 5);
        ctx.fillRect(facade.x, facade.y + facade.height - 5, facade.width, 5);

        const awningY = facade.y + facade.height * 0.31;
        ctx.fillStyle = storefront.awningTone;
        ctx.beginPath();
        ctx.moveTo(facade.x + 4, awningY);
        ctx.lineTo(facade.x + facade.width - 4, awningY);
        ctx.lineTo(facade.x + facade.width - 10, awningY + 11);
        ctx.lineTo(facade.x + 10, awningY + 11);
        ctx.closePath();
        ctx.fill();

        ctx.font = `600 ${Math.max(7, sceneHeight * 0.028)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = storefront.id === '1208-main' ? '#111418' : 'rgba(20,24,28,0.9)';
        ctx.fillText(storefront.sign, facade.x + facade.width / 2, awningY - 7);

        for (const windowSurface of storefront.windows) {
          const windowRect = toPixelRect(windowSurface, sceneWidth, sceneHeight);
          const broken = impact.isSurfaceBroken(windowSurface.id);
          ctx.save();
          roundedRectPath(
            ctx,
            windowRect.x,
            windowRect.y,
            windowRect.width,
            windowRect.height,
            2,
          );
          ctx.clip();

          if (broken) {
            const interior = ctx.createLinearGradient(
              windowRect.x,
              windowRect.y,
              windowRect.x,
              windowRect.y + windowRect.height,
            );
            interior.addColorStop(0, '#070a0d');
            interior.addColorStop(1, '#15100d');
            ctx.fillStyle = interior;
            ctx.fillRect(windowRect.x, windowRect.y, windowRect.width, windowRect.height);
            ctx.fillStyle = 'rgba(245,177,83,0.08)';
            ctx.fillRect(
              windowRect.x + windowRect.width * 0.12,
              windowRect.y + windowRect.height * 0.12,
              windowRect.width * 0.2,
              windowRect.height * 0.76,
            );
          } else {
            const glass = ctx.createLinearGradient(
              windowRect.x,
              windowRect.y,
              windowRect.x + windowRect.width,
              windowRect.y + windowRect.height,
            );
            glass.addColorStop(0, 'rgba(11,28,39,0.95)');
            glass.addColorStop(0.5, 'rgba(28,58,70,0.88)');
            glass.addColorStop(1, 'rgba(8,19,27,0.96)');
            ctx.fillStyle = glass;
            ctx.fillRect(windowRect.x, windowRect.y, windowRect.width, windowRect.height);
            ctx.fillStyle = 'rgba(160,224,239,0.14)';
            ctx.beginPath();
            ctx.moveTo(windowRect.x - 8, windowRect.y + windowRect.height * 0.25);
            ctx.lineTo(windowRect.x + windowRect.width * 0.62, windowRect.y);
            ctx.lineTo(windowRect.x + windowRect.width * 0.88, windowRect.y);
            ctx.lineTo(windowRect.x + windowRect.width * 0.18, windowRect.y + windowRect.height * 0.45);
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();

          ctx.strokeStyle = broken ? 'rgba(194,222,230,0.38)' : storefront.trimTone;
          ctx.lineWidth = 2;
          roundedRectPath(
            ctx,
            windowRect.x,
            windowRect.y,
            windowRect.width,
            windowRect.height,
            2,
          );
          ctx.stroke();

          if (broken) {
            ctx.fillStyle = 'rgba(197,228,238,0.48)';
            for (let shard = 0; shard < 8; shard++) {
              const shardX = windowRect.x + (shard / 7) * windowRect.width;
              const shardHeight = 3 + hashNumber(hashString(windowSurface.id) + shard) * 8;
              ctx.beginPath();
              ctx.moveTo(shardX, windowRect.y);
              ctx.lineTo(shardX + 4, windowRect.y);
              ctx.lineTo(shardX + 2, windowRect.y + shardHeight);
              ctx.closePath();
              ctx.fill();
            }
          }
        }

        const doorRect = toPixelRect(storefront.door, sceneWidth, sceneHeight);
        const doorBroken = impact.isSurfaceBroken(storefront.door.id);
        ctx.fillStyle = doorBroken
          ? '#080b0e'
          : storefront.door.kind === 'glass'
            ? '#152b36'
            : storefront.door.kind === 'metal'
              ? '#30343a'
              : '#493326';
        ctx.fillRect(doorRect.x, doorRect.y, doorRect.width, doorRect.height);
        ctx.strokeStyle = storefront.trimTone;
        ctx.lineWidth = 2;
        ctx.strokeRect(doorRect.x, doorRect.y, doorRect.width, doorRect.height);
        ctx.fillStyle = '#d1ad61';
        ctx.beginPath();
        ctx.arc(
          doorRect.x + doorRect.width * 0.82,
          doorRect.y + doorRect.height * 0.52,
          1.6,
          0,
          Math.PI * 2,
        );
        ctx.fill();

        if (storefront.id === '1208-main') {
          ctx.fillStyle = '#14171b';
          roundedRectPath(
            ctx,
            facade.x + facade.width * 0.34,
            facade.y + 9,
            facade.width * 0.32,
            18,
            3,
          );
          ctx.fill();
          ctx.fillStyle = '#f0c270';
          ctx.font = `700 ${Math.max(9, sceneHeight * 0.041)}px ui-monospace, monospace`;
          ctx.textAlign = 'center';
          ctx.fillText('1208', facade.x + facade.width * 0.5, facade.y + 23);
        }
      }
      ctx.textAlign = 'left';
    },
    [],
  );

  const drawStreet = useCallback(
    (ctx: CanvasRenderingContext2D, elapsed: number, sceneWidth: number, sceneHeight: number) => {
      const palette = LAS_OLAS_1208_SCENE.palette;
      const sidewalkY = sceneHeight * 0.62;
      const curbY = sceneHeight * 0.745;

      const sidewalk = ctx.createLinearGradient(0, sidewalkY, 0, curbY);
      sidewalk.addColorStop(0, '#66676a');
      sidewalk.addColorStop(0.7, palette.sidewalk);
      sidewalk.addColorStop(1, '#3d4145');
      ctx.fillStyle = sidewalk;
      ctx.fillRect(0, sidewalkY, sceneWidth, curbY - sidewalkY);

      ctx.strokeStyle = 'rgba(25,27,29,0.42)';
      ctx.lineWidth = 1;
      for (let seam = 0; seam < 10; seam++) {
        const x = (seam / 10) * sceneWidth;
        ctx.beginPath();
        ctx.moveTo(x, sidewalkY);
        ctx.lineTo(x + 8, curbY);
        ctx.stroke();
      }

      ctx.fillStyle = '#b7a36e';
      ctx.fillRect(0, curbY - 4, sceneWidth, 4);
      ctx.fillStyle = '#2b2e31';
      ctx.fillRect(0, curbY, sceneWidth, 4);

      const road = ctx.createLinearGradient(0, curbY + 4, 0, sceneHeight);
      road.addColorStop(0, '#171a1e');
      road.addColorStop(1, palette.road);
      ctx.fillStyle = road;
      ctx.fillRect(0, curbY + 4, sceneWidth, sceneHeight - curbY - 4);

      ctx.strokeStyle = 'rgba(240,190,77,0.42)';
      ctx.lineWidth = 2;
      ctx.setLineDash([22, 17]);
      ctx.beginPath();
      ctx.moveTo(0, sceneHeight * 0.895);
      ctx.lineTo(sceneWidth, sceneHeight * 0.895);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(255,255,255,0.022)';
      for (let mark = 0; mark < 56; mark++) {
        const x = (mark * 97 + elapsed * 0.008) % sceneWidth;
        const y = curbY + 12 + ((mark * 43) % Math.max(1, sceneHeight - curbY - 15));
        ctx.fillRect(x, y, mark % 3 === 0 ? 3 : 1, 1);
      }

      ctx.fillStyle = '#2a2e31';
      ctx.fillRect(sceneWidth * 0.742, sceneHeight * 0.19, 5, sceneHeight * 0.47);
      ctx.fillStyle = '#0b594a';
      roundedRectPath(ctx, sceneWidth * 0.69, sceneHeight * 0.2, sceneWidth * 0.16, 18, 3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(218,240,231,0.65)';
      ctx.lineWidth = 1;
      roundedRectPath(ctx, sceneWidth * 0.69, sceneHeight * 0.2, sceneWidth * 0.16, 18, 3);
      ctx.stroke();
      ctx.fillStyle = '#eef8f3';
      ctx.font = `700 ${Math.max(7, sceneHeight * 0.031)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('LAS OLAS BLVD', sceneWidth * 0.77, sceneHeight * 0.2 + 13);
      ctx.textAlign = 'left';
    },
    [],
  );

  const drawLightPoles = useCallback(
    (ctx: CanvasRenderingContext2D, sceneWidth: number, sceneHeight: number) => {
      const poles = LAS_OLAS_1208_SCENE.fixedSurfaces.filter((surface) =>
        surface.id.startsWith('light-pole'),
      );
      for (const pole of poles) {
        const rect = toPixelRect(pole, sceneWidth, sceneHeight);
        const broken = impactRef.current.isSurfaceBroken(pole.id);
        ctx.save();
        ctx.translate(rect.x + rect.width * 0.5, rect.y + rect.height);
        if (broken) ctx.rotate(pole.id.endsWith('left') ? -0.34 : 0.31);
        ctx.fillStyle = '#24282c';
        ctx.fillRect(-rect.width * 0.5, -rect.height, rect.width, rect.height);
        ctx.fillRect(-rect.width * 0.5, -rect.height, sceneWidth * 0.055, 4);
        const glowX = sceneWidth * 0.052;
        const glowY = -rect.height + 2;
        const glow = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, 35);
        glow.addColorStop(0, 'rgba(255,198,111,0.26)');
        glow.addColorStop(1, 'rgba(255,170,70,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(glowX, glowY, 35, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f4bd72';
        ctx.fillRect(glowX - 4, glowY - 2, 8, 3);
        ctx.restore();
      }
    },
    [],
  );

  const drawScene = useCallback(
    (ctx: CanvasRenderingContext2D, elapsed: number, sceneWidth: number, sceneHeight: number) => {
      drawSkyAndAtmosphere(ctx, elapsed, sceneWidth, sceneHeight);

      for (const palm of LAS_OLAS_1208_SCENE.palms.filter((item) => item.depth === 'rear')) {
        drawPalm(
          ctx,
          palm.x * sceneWidth,
          palm.groundY * sceneHeight,
          palm.scale * Math.min(sceneWidth / 480, sceneHeight / 270),
          palm.lean,
          elapsed,
        );
      }

      drawStorefronts(ctx, sceneWidth, sceneHeight);
      drawStreet(ctx, elapsed, sceneWidth, sceneHeight);
      drawLightPoles(ctx, sceneWidth, sceneHeight);

      for (const palm of LAS_OLAS_1208_SCENE.palms.filter((item) => item.depth === 'front')) {
        drawPalm(
          ctx,
          palm.x * sceneWidth,
          palm.groundY * sceneHeight,
          palm.scale * Math.min(sceneWidth / 480, sceneHeight / 270),
          palm.lean,
          elapsed,
        );
      }
    },
    [drawLightPoles, drawSkyAndAtmosphere, drawStorefronts, drawStreet],
  );

  const drawMembers = useCallback(
    (ctx: CanvasRenderingContext2D, sceneWidth: number, sceneHeight: number) => {
      const sprite = spriteRef.current;
      const activeIds = new Set<string>();

      for (const member of placementsRef.current) {
        activeIds.add(member.memberId);
        const point = memberRenderPoint(member, sceneWidth, sceneHeight);
        const clothing = ROLE_COLORS[member.role];
        const skin = SKIN_TONES[hashString(member.memberId) % SKIN_TONES.length];
        ragdollRef.current.ensure(member.memberId, point.x, point.y, 1, clothing, skin);

        const health = visualHealthRef.current.get(member.memberId) ?? member.health;
        if (health <= 0) ragdollRef.current.setDowned(member.memberId, true);
        if (ragdollRef.current.isActive(member.memberId)) continue;

        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(point.x, point.y + MEMBER_RENDER_HEIGHT * 0.5 + 4, 14, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        const hiRes = hiResSpritesRef.current.get(member.role);
        if (hiRes && hiRes.width > 0 && hiRes.height > 0) {
          const renderHeight = MEMBER_RENDER_HEIGHT * 1.04;
          const renderWidth = renderHeight * (hiRes.width / hiRes.height);
          ctx.drawImage(
            hiRes,
            point.x - renderWidth / 2,
            point.y - renderHeight / 2,
            renderWidth,
            renderHeight,
          );
        } else if (sprite && spriteReadyRef.current) {
          const frame = MEMBER_FRAMES[member.role] ?? 0;
          const sourceX = (frame % SPRITE_SHEET_COLS) * SPRITE_FRAME_WIDTH;
          ctx.drawImage(
            sprite,
            sourceX,
            0,
            SPRITE_FRAME_WIDTH,
            SPRITE_FRAME_HEIGHT,
            point.x - MEMBER_RENDER_WIDTH / 2,
            point.y - MEMBER_RENDER_HEIGHT / 2,
            MEMBER_RENDER_WIDTH,
            MEMBER_RENDER_HEIGHT,
          );
        } else {
          ctx.fillStyle = clothing;
          roundedRectPath(ctx, point.x - 11, point.y - 22, 22, 42, 5);
          ctx.fill();
          ctx.fillStyle = skin;
          ctx.beginPath();
          ctx.arc(point.x, point.y - 28, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#171b20';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(point.x - 5, point.y + 18);
          ctx.lineTo(point.x - 7, point.y + 34);
          ctx.moveTo(point.x + 5, point.y + 18);
          ctx.lineTo(point.x + 7, point.y + 34);
          ctx.stroke();
        }

        const healthRatio = clamp(health / 100, 0, 1);
        const barWidth = 29;
        const barY = point.y - MEMBER_RENDER_HEIGHT / 2 - 9;
        ctx.fillStyle = 'rgba(7,8,10,0.85)';
        ctx.fillRect(point.x - barWidth / 2, barY, barWidth, 4);
        ctx.fillStyle =
          healthRatio > 0.55 ? '#48d17a' : healthRatio > 0.25 ? '#e6b74b' : '#ef4e58';
        ctx.fillRect(point.x - barWidth / 2, barY, barWidth * healthRatio, 4);

        ctx.fillStyle = 'rgba(245,247,250,0.72)';
        ctx.font = '9px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(member.memberName, point.x, barY - 4);
      }

      ctx.textAlign = 'left';
      ragdollRef.current.removeMissing(activeIds);
    },
    [],
  );

  const drawCar = useCallback(
    (ctx: CanvasRenderingContext2D, car: CarGeometry | undefined, elapsed: number) => {
      if (!car) return;
      const state = vehicleDamageRef.current;
      const s = car.scale;
      const bounce = Math.sin(elapsed * 0.018) * 0.65 * s;

      ctx.save();
      ctx.translate(0, bounce);

      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.ellipse(
        car.x + car.width * 0.5,
        car.baselineY + 5 * s,
        car.width * 0.47,
        8 * s,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();

      const bodyGradient = ctx.createLinearGradient(car.x, car.y, car.x, car.baselineY);
      bodyGradient.addColorStop(0, '#303946');
      bodyGradient.addColorStop(0.45, '#1c2530');
      bodyGradient.addColorStop(1, '#10151c');
      ctx.fillStyle = bodyGradient;
      ctx.beginPath();
      ctx.moveTo(car.x + 8 * s, car.y + 36 * s);
      ctx.lineTo(car.x + 31 * s, car.y + 28 * s);
      ctx.lineTo(car.x + 46 * s, car.y + 7 * s);
      ctx.lineTo(car.x + 122 * s, car.y + 6 * s);
      ctx.lineTo(car.x + 145 * s, car.y + 27 * s);
      ctx.lineTo(car.x + 166 * s, car.y + 34 * s);
      ctx.quadraticCurveTo(
        car.x + 173 * s,
        car.y + 39 * s,
        car.x + 169 * s,
        car.y + 57 * s,
      );
      ctx.lineTo(car.x + 5 * s, car.y + 57 * s);
      ctx.quadraticCurveTo(car.x - 1 * s, car.y + 47 * s, car.x + 8 * s, car.y + 36 * s);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(180,201,218,0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();

      const drawVehicleWindow = (rect: PixelRect, broken: boolean, front: boolean) => {
        if (broken) {
          ctx.fillStyle = '#070b0f';
          ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
          ctx.fillStyle = 'rgba(201,228,239,0.45)';
          for (let shard = 0; shard < 6; shard++) {
            const x = rect.x + (shard / 5) * rect.width;
            ctx.beginPath();
            ctx.moveTo(x, rect.y);
            ctx.lineTo(x + 4 * s, rect.y);
            ctx.lineTo(x + 2 * s, rect.y + (3 + (shard % 3) * 3) * s);
            ctx.closePath();
            ctx.fill();
          }
        } else {
          const windowGradient = ctx.createLinearGradient(
            rect.x,
            rect.y,
            rect.x + rect.width,
            rect.y + rect.height,
          );
          windowGradient.addColorStop(0, 'rgba(35,64,80,0.97)');
          windowGradient.addColorStop(0.55, 'rgba(12,27,38,0.97)');
          windowGradient.addColorStop(1, 'rgba(4,10,15,0.98)');
          ctx.fillStyle = windowGradient;
          ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
          ctx.fillStyle = 'rgba(174,220,238,0.12)';
          ctx.beginPath();
          ctx.moveTo(rect.x + rect.width * 0.08, rect.y + rect.height * 0.12);
          ctx.lineTo(rect.x + rect.width * 0.68, rect.y);
          ctx.lineTo(rect.x + rect.width * 0.9, rect.y);
          ctx.lineTo(rect.x + rect.width * 0.25, rect.y + rect.height * 0.48);
          ctx.closePath();
          ctx.fill();
        }
        ctx.strokeStyle = '#0b0f14';
        ctx.lineWidth = 2 * s;
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

        if (!broken) {
          ctx.fillStyle = 'rgba(3,4,6,0.72)';
          ctx.beginPath();
          ctx.arc(
            front ? rect.x + rect.width * 0.68 : rect.x + rect.width * 0.42,
            rect.y + rect.height * 0.62,
            7 * s,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      };

      drawVehicleWindow(car.rearWindow, state.rearWindowBroken, false);
      drawVehicleWindow(car.frontWindow, state.frontWindowBroken, true);

      ctx.strokeStyle = 'rgba(5,8,11,0.72)';
      ctx.lineWidth = 1.2 * s;
      ctx.strokeRect(car.rearDoor.x, car.rearDoor.y, car.rearDoor.width, car.rearDoor.height);
      ctx.strokeRect(car.frontDoor.x, car.frontDoor.y, car.frontDoor.width, car.frontDoor.height);
      ctx.fillStyle = 'rgba(195,211,219,0.28)';
      ctx.fillRect(car.rearDoor.x + car.rearDoor.width - 10 * s, car.rearDoor.y + 8 * s, 7 * s, 1.6 * s);
      ctx.fillRect(car.frontDoor.x + car.frontDoor.width - 10 * s, car.frontDoor.y + 8 * s, 7 * s, 1.6 * s);

      ctx.fillStyle = '#090b0f';
      for (const wheelX of [car.x + 37 * s, car.x + 137 * s]) {
        ctx.beginPath();
        ctx.arc(wheelX, car.y + 59 * s, 14 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#343a42';
        ctx.beginPath();
        ctx.arc(wheelX, car.y + 59 * s, 7 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#090b0f';
        ctx.beginPath();
        ctx.arc(wheelX, car.y + 59 * s, 2.5 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#090b0f';
      }

      ctx.fillStyle = '#f4d995';
      ctx.fillRect(car.x + 164 * s, car.y + 38 * s, 5 * s, 7 * s);
      ctx.fillStyle = '#8c1f26';
      ctx.fillRect(car.x + 4 * s, car.y + 37 * s, 4 * s, 8 * s);

      for (const mark of state.marks) {
        const x = car.x + mark.localX;
        const y = car.y + mark.localY;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(mark.rotation);
        if (mark.kind === 'glass-crack') {
          drawWindowCrack(ctx, 0, 0, mark.radius * s, mark.seed);
        } else if (mark.kind === 'bullet-hole') {
          drawVehicleBulletHole(ctx, 0, 0, mark.radius * s);
        } else {
          const dent = ctx.createRadialGradient(0, 0, 0, 0, 0, mark.radius * s);
          dent.addColorStop(0, 'rgba(255,255,255,0.15)');
          dent.addColorStop(0.45, 'rgba(0,0,0,0.08)');
          dent.addColorStop(0.78, 'rgba(0,0,0,0.38)');
          dent.addColorStop(1, 'rgba(255,255,255,0.05)');
          ctx.fillStyle = dent;
          ctx.beginPath();
          ctx.ellipse(0, 0, mark.radius * s, mark.radius * 0.66 * s, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      if (state.bodyIntegrity < 180) {
        const smokeX = car.x + 153 * s;
        const smokeY = car.y + 22 * s;
        const smoke = ctx.createRadialGradient(smokeX, smokeY, 0, smokeX, smokeY, 22 * s);
        smoke.addColorStop(0, 'rgba(20,22,24,0.34)');
        smoke.addColorStop(1, 'rgba(30,32,35,0)');
        ctx.fillStyle = smoke;
        ctx.beginPath();
        ctx.arc(smokeX, smokeY, 22 * s, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    },
    [],
  );

  const drawCombatEffects = useCallback(
    (ctx: CanvasRenderingContext2D, dt: number) => {
      const liveTracers: Tracer[] = [];
      for (const tracer of tracersRef.current) {
        tracer.life -= dt;
        if (tracer.life <= 0) continue;
        const alpha = tracer.life / tracer.maxLife;
        const gradient = ctx.createLinearGradient(
          tracer.startX,
          tracer.startY,
          tracer.endX,
          tracer.endY,
        );
        gradient.addColorStop(0, `rgba(255,173,69,${alpha * 0.2})`);
        gradient.addColorStop(0.45, `rgba(255,231,157,${alpha * 0.9})`);
        gradient.addColorStop(1, `rgba(255,255,244,${alpha * 0.15})`);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(tracer.startX, tracer.startY);
        ctx.lineTo(tracer.endX, tracer.endY);
        ctx.stroke();
        liveTracers.push(tracer);
      }
      tracersRef.current = liveTracers;

      const liveFlashes: MuzzleFlash[] = [];
      for (const flash of muzzleFlashesRef.current) {
        flash.life -= dt;
        if (flash.life <= 0) continue;
        const alpha = flash.life / flash.maxLife;
        const radius = 18 * flash.size * alpha;
        ctx.save();
        ctx.translate(flash.x, flash.y);
        ctx.rotate(flash.angle);
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 2.2);
        glow.addColorStop(0, `rgba(255,255,222,${alpha})`);
        glow.addColorStop(0.28, `rgba(255,188,57,${alpha * 0.9})`);
        glow.addColorStop(1, 'rgba(255,74,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255,241,178,${alpha})`;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(radius * 1.5, -radius * 0.38);
        ctx.lineTo(radius * 2.6, 0);
        ctx.lineTo(radius * 1.5, radius * 0.38);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        liveFlashes.push(flash);
      }
      muzzleFlashesRef.current = liveFlashes;
    },
    [],
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const now = performance.now();
    const elapsed = now - startTimeRef.current;
    const phaseElapsed = now - phaseStartRef.current;
    const dt = clamp((now - lastFrameRef.current) / 1000, 0, 0.05);
    lastFrameRef.current = now;
    const sceneWidth = widthRef.current;
    const sceneHeight = heightRef.current;

    processShots(phaseElapsed);
    impactRef.current.update(dt);
    ragdollRef.current.update(dt, sceneHeight * 0.965, sceneWidth, sceneHeight);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, sceneWidth, sceneHeight);
    ctx.save();

    const shake = cameraShakeRef.current;
    if (shake > 0.05) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      cameraShakeRef.current *= Math.pow(0.12, dt);
    } else {
      cameraShakeRef.current = 0;
    }

    drawScene(ctx, elapsed, sceneWidth, sceneHeight);
    impactRef.current.drawDecals(ctx);
    drawMembers(ctx, sceneWidth, sceneHeight);
    ragdollRef.current.draw(ctx);

    const driveBy = driveByRef.current;
    const car = driveBy
      ? getCarGeometry(driveBy.phase, phaseElapsed, sceneWidth, sceneHeight)
      : undefined;
    drawCar(ctx, car, elapsed);
    drawCombatEffects(ctx, dt);
    impactRef.current.draw(ctx);

    const vignette = ctx.createRadialGradient(
      sceneWidth * 0.5,
      sceneHeight * 0.55,
      sceneHeight * 0.18,
      sceneWidth * 0.5,
      sceneHeight * 0.55,
      Math.max(sceneWidth, sceneHeight) * 0.72,
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.54)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, sceneWidth, sceneHeight);

    ctx.restore();
    rafRef.current = requestAnimationFrame(draw);
  }, [dpr, drawCar, drawCombatEffects, drawMembers, drawScene, processShots]);

  useEffect(() => {
    lastFrameRef.current = performance.now();
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      width={Math.round(width * dpr)}
      height={Math.round(height * dpr)}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        cursor: 'crosshair',
        display: 'block',
        background: '#090d18',
      }}
      onClick={handleCanvasClick}
      data-testid="canvas-street-renderer"
      aria-label="1208 Las Olas destructible combat scene"
    />
  );
}

export default CanvasStreetRenderer;
