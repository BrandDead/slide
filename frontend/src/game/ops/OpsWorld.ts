import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Observer } from '@babylonjs/core/Misc/observable';
import type { Scene } from '@babylonjs/core/scene';
import type {
  CombatEvent,
  CombatHitZone,
  CombatImpactCandidate,
  CombatImpactKind,
  CombatSnapshot,
  Combatant,
  EncounterPreparation,
} from '../combat/types';
import type { ActionCameraMode, CombatControllerState } from '../combat/CombatSessionController';
import { CombatSessionController } from '../combat/CombatSessionController';
import { OpsInput } from './OpsInput';
import { gridToWorld, movementToGridStep, OPS_CELL_SIZE } from './opsCoordinates';

const FACADE_URL = '/assets/runtime/generated/environments/street/block_modern_ops_storefront_v001.webp';
const MOVE_INTERVAL_MS = 155;
const SIM_TICK_MS = 100;
const OPS_FIRE_RANGE = 40;

interface ActorVisual {
  root: TransformNode;
  body: Mesh;
  head: Mesh;
  marker: Mesh;
  target: Vector3;
}

interface TimedEffect {
  mesh: AbstractMesh;
  remaining: number;
}

interface OpsImpactMetadata {
  impactKind: Exclude<CombatImpactKind, 'miss'>;
  entityId: string;
  hitZone?: CombatHitZone;
}

export interface OpsWorldOptions {
  demo?: boolean;
}

function material(
  scene: Scene,
  name: string,
  diffuse: Color3,
  specular = new Color3(0.18, 0.18, 0.2),
  emissive = Color3.Black(),
): StandardMaterial {
  const result = new StandardMaterial(name, scene);
  result.diffuseColor = diffuse;
  result.specularColor = specular;
  result.emissiveColor = emissive;
  return result;
}

function actorPosition(actor: Combatant): Vector3 {
  const world = gridToWorld(actor.position, actor.isDown ? 0.22 : 0.9);
  return new Vector3(world.x, world.y, world.z);
}

export class OpsWorld {
  private readonly input: OpsInput;
  private readonly actorVisuals = new Map<string, ActorVisual>();
  private readonly effects: TimedEffect[] = [];
  private readonly materials: StandardMaterial[] = [];
  private readonly observers: Observer<Scene>[] = [];
  private readonly tacticalCamera: ArcRotateCamera;
  private readonly firstPersonCamera: UniversalCamera;
  private readonly thirdPersonCamera: UniversalCamera;
  private readonly extractionMesh: Mesh;
  private readonly unsubscribeController: () => void;
  private snapshot: CombatSnapshot;
  private latestEventId: string | null = null;
  private yaw = Math.PI;
  private pitch = 0;
  private movementCooldown = 0;
  private tickAccumulator = 0;
  private elapsed = 0;
  private demoAccumulator = 0;
  private demoStep = 0;
  private disposed = false;

  constructor(
    private readonly scene: Scene,
    canvas: HTMLCanvasElement,
    private readonly controller: CombatSessionController,
    private readonly preparation: EncounterPreparation,
    private readonly options: OpsWorldOptions = {},
  ) {
    this.snapshot = controller.getSnapshot();
    const selected = controller.getSelectedCrew();
    if (selected) {
      const source = gridToWorld(selected.position, 0);
      const extraction = gridToWorld(preparation.objective.extraction, 0);
      this.yaw = Math.atan2(extraction.x - source.x, extraction.z - source.z);
    }
    this.input = new OpsInput(canvas);

    this.createEnvironment();
    this.createFacade();
    this.createStreetLights();
    this.extractionMesh = this.createExtraction();

    this.tacticalCamera = this.createTacticalCamera();
    this.firstPersonCamera = this.createUniversalCamera('ops-first-person', 0.94);
    this.thirdPersonCamera = this.createUniversalCamera('ops-third-person', 0.82);

    this.syncSnapshot(this.snapshot);
    this.applyCameraMode(controller.getCameraMode());

    this.unsubscribeController = controller.subscribe((state) => this.onControllerState(state));
    this.observers.push(scene.onBeforeRenderObservable.add(() => {
      this.update(scene.getEngine().getDeltaTime() / 1000);
    }));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribeController();
    this.input.dispose();
    this.observers.forEach((observer) => this.scene.onBeforeRenderObservable.remove(observer));
    this.effects.forEach((effect) => effect.mesh.dispose());
    this.materials.forEach((item) => item.dispose());
    if (document.pointerLockElement) void document.exitPointerLock?.();
  }

  private createEnvironment(): void {
    this.scene.clearColor.set(0.012, 0.025, 0.045, 1);
    this.scene.ambientColor = new Color3(0.08, 0.11, 0.16);

    const sky = new HemisphericLight('ops-sky-light', new Vector3(0.2, 1, 0.1), this.scene);
    sky.intensity = 0.82;
    sky.diffuse = new Color3(0.34, 0.5, 0.68);
    sky.groundColor = new Color3(0.11, 0.08, 0.16);

    const palette = {
      street: material(this.scene, 'ops-road', new Color3(0.035, 0.055, 0.075), new Color3(0.95, 0.95, 1)),
      curb: material(this.scene, 'ops-curb', new Color3(0.19, 0.21, 0.23), new Color3(0.4, 0.4, 0.44)),
      sidewalk: material(this.scene, 'ops-sidewalk', new Color3(0.13, 0.18, 0.2), new Color3(0.5, 0.54, 0.58)),
      storefront: material(this.scene, 'ops-storefront-ground', new Color3(0.11, 0.09, 0.14)),
      alley: material(this.scene, 'ops-alley', new Color3(0.035, 0.08, 0.085)),
      parking: material(this.scene, 'ops-parking', new Color3(0.095, 0.09, 0.085), new Color3(0.38, 0.35, 0.34)),
      rooftop: material(this.scene, 'ops-rooftop', new Color3(0.105, 0.08, 0.13)),
      building: material(this.scene, 'ops-building', new Color3(0.055, 0.045, 0.075)),
      cover: material(this.scene, 'ops-cover', new Color3(0.22, 0.24, 0.26), new Color3(0.35, 0.35, 0.38)),
    };
    this.materials.push(...Object.values(palette));

    this.preparation.terrain.flat().forEach((cell) => {
      const point = gridToWorld(cell, 0);
      const cellMesh = MeshBuilder.CreateBox(`ops-cell-${cell.x}-${cell.y}`, {
        width: OPS_CELL_SIZE - 0.08,
        depth: OPS_CELL_SIZE - 0.08,
        height: cell.zoneType === 'building' ? 1.6 : 0.12,
      }, this.scene);
      cellMesh.position.set(point.x, cell.zoneType === 'building' ? 0.75 : -0.08, point.z);
      cellMesh.material = palette[cell.zoneType] ?? palette.sidewalk;
      cellMesh.receiveShadows = true;
      cellMesh.metadata = {
        impactKind: cell.zoneType === 'parking' ? 'vehicle' : 'environment',
        entityId: `terrain-${cell.x}-${cell.y}`,
      } satisfies OpsImpactMetadata;

      if (cell.cover >= 0.45 && cell.passable) {
        const cover = MeshBuilder.CreateBox(`ops-cover-${cell.x}-${cell.y}`, {
          width: OPS_CELL_SIZE * 0.62,
          depth: OPS_CELL_SIZE * 0.34,
          height: 0.9,
        }, this.scene);
        cover.position.set(point.x, 0.45, point.z);
        cover.material = palette.cover;
        cover.metadata = {
          impactKind: 'cover',
          entityId: `cover-${cell.x}-${cell.y}`,
        } satisfies OpsImpactMetadata;
      }
    });

    const laneLine = material(this.scene, 'ops-lane-line', new Color3(0.7, 0.52, 0.08), Color3.Black(), new Color3(0.18, 0.11, 0.01));
    this.materials.push(laneLine);
    for (let index = -3; index <= 3; index += 1) {
      const stripe = MeshBuilder.CreateBox(`ops-lane-${index}`, { width: 1.5, depth: 0.09, height: 0.03 }, this.scene);
      stripe.position.set(index * 4.3, 0.02, 0);
      stripe.material = laneLine;
    }
  }

  private createFacade(): void {
    const facadeMaterial = material(this.scene, 'ops-facade-material', new Color3(1, 1, 1));
    const facadeTexture = new Texture(FACADE_URL, this.scene, true, false);
    facadeTexture.hasAlpha = false;
    facadeTexture.vScale = -1;
    facadeTexture.vOffset = 1;
    facadeMaterial.diffuseTexture = facadeTexture;
    facadeMaterial.emissiveTexture = facadeTexture;
    facadeMaterial.emissiveColor = new Color3(0.42, 0.42, 0.46);
    facadeMaterial.backFaceCulling = false;
    this.materials.push(facadeMaterial);

    const facade = MeshBuilder.CreatePlane('ops-storefront-facade-north', { width: 30, height: 16.875 }, this.scene);
    facade.position.set(0, 4.1, -15.7);
    facade.rotation.y = Math.PI;
    facade.scaling.y = 0.49;
    facade.material = facadeMaterial;
    facade.metadata = { impactKind: 'environment', entityId: 'facade-north' } satisfies OpsImpactMetadata;

    const oppositeFacade = MeshBuilder.CreatePlane('ops-storefront-facade-south', { width: 30, height: 16.875 }, this.scene);
    oppositeFacade.position.set(0, 4.1, 15.7);
    oppositeFacade.scaling.y = 0.49;
    oppositeFacade.material = facadeMaterial;
    oppositeFacade.metadata = { impactKind: 'environment', entityId: 'facade-south' } satisfies OpsImpactMetadata;

    const roofMaterial = material(this.scene, 'ops-roof-material', new Color3(0.045, 0.045, 0.055));
    this.materials.push(roofMaterial);
    const northRoof = MeshBuilder.CreateBox('ops-storefront-roof-north', { width: 31, height: 0.5, depth: 3 }, this.scene);
    northRoof.position.set(0, 7.95, -16.55);
    northRoof.material = roofMaterial;
    northRoof.metadata = { impactKind: 'environment', entityId: 'roof-north' } satisfies OpsImpactMetadata;
    const southRoof = MeshBuilder.CreateBox('ops-storefront-roof-south', { width: 31, height: 0.5, depth: 3 }, this.scene);
    southRoof.position.set(0, 7.95, 16.55);
    southRoof.material = roofMaterial;
    southRoof.metadata = { impactKind: 'environment', entityId: 'roof-south' } satisfies OpsImpactMetadata;
  }

  private createStreetLights(): void {
    const poleMaterial = material(this.scene, 'ops-pole', new Color3(0.06, 0.07, 0.08), new Color3(0.55, 0.55, 0.58));
    const lampMaterial = material(this.scene, 'ops-lamp', new Color3(0.75, 0.45, 0.16), Color3.Black(), new Color3(1, 0.48, 0.12));
    this.materials.push(poleMaterial, lampMaterial);

    [
      { x: -10.5, z: -4.5 },
      { x: 10.5, z: -4.5 },
      { x: -8.5, z: 8.5 },
      { x: 8.5, z: 8.5 },
    ].forEach(({ x, z }, index) => {
      const pole = MeshBuilder.CreateCylinder(`ops-light-pole-${index}`, { height: 6.5, diameter: 0.16 }, this.scene);
      pole.position.set(x, 3.25, z);
      pole.material = poleMaterial;
      pole.metadata = { impactKind: 'environment', entityId: `light-pole-${index}` } satisfies OpsImpactMetadata;
      const lamp = MeshBuilder.CreateSphere(`ops-light-lamp-${index}`, { diameter: 0.48, segments: 12 }, this.scene);
      lamp.position.set(x, 6.35, z);
      lamp.material = lampMaterial;
      lamp.metadata = { impactKind: 'environment', entityId: `light-lamp-${index}` } satisfies OpsImpactMetadata;
      const light = new PointLight(`ops-light-${index}`, lamp.position.clone(), this.scene);
      light.diffuse = index % 2 === 0 ? new Color3(0.2, 0.65, 0.95) : new Color3(1, 0.4, 0.22);
      light.intensity = 3.6;
      light.range = 18;
    });
  }

  private createExtraction(): Mesh {
    const position = gridToWorld(this.preparation.objective.extraction, 0.08);
    const extractionMaterial = material(
      this.scene,
      'ops-extraction-material',
      new Color3(0.05, 0.65, 0.22),
      Color3.Black(),
      new Color3(0.02, 0.85, 0.25),
    );
    extractionMaterial.alpha = 0.72;
    this.materials.push(extractionMaterial);
    const marker = MeshBuilder.CreateCylinder('ops-extraction', { height: 0.18, diameter: 2.1, tessellation: 32 }, this.scene);
    marker.position.set(position.x, position.y, position.z);
    marker.material = extractionMaterial;
    const beam = MeshBuilder.CreateCylinder('ops-extraction-beam', { height: 5.8, diameter: 0.18, tessellation: 16 }, this.scene);
    beam.parent = marker;
    beam.position.y = 2.9;
    beam.material = extractionMaterial;
    return marker;
  }

  private createTacticalCamera(): ArcRotateCamera {
    const camera = new ArcRotateCamera('ops-tactical', Math.PI * 1.5, 1.02, 35, new Vector3(0, 0.2, 0), this.scene);
    camera.fov = 0.72;
    camera.lowerRadiusLimit = 24;
    camera.upperRadiusLimit = 42;
    camera.lowerBetaLimit = 0.72;
    camera.upperBetaLimit = 1.25;
    return camera;
  }

  private createUniversalCamera(name: string, fov: number): UniversalCamera {
    const camera = new UniversalCamera(name, new Vector3(0, 2, 10), this.scene);
    camera.fov = fov;
    camera.minZ = 0.08;
    camera.speed = 0;
    camera.angularSensibility = 8000;
    return camera;
  }

  private onControllerState(state: CombatControllerState): void {
    const previousMode = this.scene.activeCamera?.name;
    this.snapshot = state.snapshot;
    this.syncSnapshot(state.snapshot);
    this.handleEvents(state.snapshot.events);
    this.applyCameraMode(state.hud.cameraMode);
    if (previousMode !== this.scene.activeCamera?.name) this.input.consumeLookDelta();
  }

  private syncSnapshot(snapshot: CombatSnapshot): void {
    const activeIds = new Set(snapshot.combatants.map((actor) => actor.id));
    this.actorVisuals.forEach((visual, id) => {
      if (activeIds.has(id)) return;
      visual.root.dispose(false, true);
      this.actorVisuals.delete(id);
    });

    snapshot.combatants.forEach((actor) => {
      let visual = this.actorVisuals.get(actor.id);
      if (!visual) {
        visual = this.createActorVisual(actor);
        this.actorVisuals.set(actor.id, visual);
      }
      visual.target.copyFrom(actorPosition(actor));
      const selected = actor.id === this.controller.getHudState().selectedId;
      visual.marker.setEnabled(selected && !actor.isDown);
      visual.root.rotation.z = actor.isDown ? Math.PI / 2 : 0;
      visual.body.visibility = actor.isDown ? 0.42 : 1;
      visual.head.visibility = actor.isDown ? 0.42 : 1;
    });
  }

  private createActorVisual(actor: Combatant): ActorVisual {
    const root = new TransformNode(`ops-actor-${actor.id}`, this.scene);
    root.position.copyFrom(actorPosition(actor));

    const bodyMaterial = material(
      this.scene,
      `ops-actor-material-${actor.id}`,
      actor.team === 'crew' ? new Color3(0.025, 0.19, 0.23) : new Color3(0.26, 0.035, 0.075),
      new Color3(0.2, 0.2, 0.22),
      actor.team === 'crew' ? new Color3(0.005, 0.035, 0.045) : new Color3(0.045, 0.003, 0.008),
    );
    this.materials.push(bodyMaterial);

    const body = MeshBuilder.CreateCapsule(`ops-body-${actor.id}`, { height: 1.45, radius: 0.34, tessellation: 10 }, this.scene);
    body.parent = root;
    body.position.y = 0.6;
    body.material = bodyMaterial;
    body.metadata = {
      impactKind: 'actor',
      entityId: actor.id,
      hitZone: 'torso',
    } satisfies OpsImpactMetadata;

    const head = MeshBuilder.CreateSphere(`ops-head-${actor.id}`, { diameter: 0.48, segments: 10 }, this.scene);
    head.parent = root;
    head.position.y = 1.48;
    head.material = bodyMaterial;
    head.metadata = {
      impactKind: 'actor',
      entityId: actor.id,
      hitZone: 'head',
    } satisfies OpsImpactMetadata;

    const markerMaterial = material(
      this.scene,
      `ops-marker-material-${actor.id}`,
      Color3.Black(),
      Color3.Black(),
      new Color3(0.05, 0.85, 0.8),
    );
    this.materials.push(markerMaterial);
    const marker = MeshBuilder.CreateTorus(`ops-marker-${actor.id}`, { diameter: 1.35, thickness: 0.06, tessellation: 24 }, this.scene);
    marker.parent = root;
    marker.rotation.x = Math.PI / 2;
    marker.position.y = -0.78;
    marker.material = markerMaterial;
    marker.isPickable = false;

    return { root, body, head, marker, target: root.position.clone() };
  }

  private handleEvents(events: CombatEvent[]): void {
    const startIndex = this.latestEventId
      ? events.findIndex((event) => event.id === this.latestEventId) + 1
      : 0;
    const nextEvents = startIndex > 0 ? events.slice(startIndex) : events;
    nextEvents.forEach((event) => this.renderEvent(event));
    this.latestEventId = events.at(-1)?.id ?? this.latestEventId;
  }

  private renderEvent(event: CombatEvent): void {
    if (event.type === 'weapon-fired' && event.actorId) {
      const source = this.actorVisuals.get(event.actorId)?.root.position;
      const impactPoint = event.impact
        ? new Vector3(event.impact.point.x, event.impact.point.y, event.impact.point.z)
        : event.targetId
          ? this.actorVisuals.get(event.targetId)?.root.position.add(new Vector3(0, 1.15, 0))
          : undefined;
      if (source && impactPoint) {
        const tracer = MeshBuilder.CreateLines(`ops-tracer-${event.id}`, {
          points: [source.add(new Vector3(0, 1.2, 0)), impactPoint],
          updatable: false,
        }, this.scene) as LinesMesh;
        tracer.color = new Color3(1, 0.72, 0.16);
        tracer.alpha = 0.95;
        this.effects.push({ mesh: tracer, remaining: 0.11 });
      }
    }

    const visibleImpactTypes = new Set<CombatEvent['type']>([
      'impact-actor',
      'impact-cover',
      'impact-vehicle',
      'impact-environment',
      'actor-downed',
    ]);
    if (!visibleImpactTypes.has(event.type)) return;

    const impactPoint = event.impact
      ? new Vector3(event.impact.point.x, event.impact.point.y, event.impact.point.z)
      : event.targetId
        ? this.actorVisuals.get(event.targetId)?.root.position.add(new Vector3(0, 1, 0))
        : undefined;
    if (!impactPoint) return;

    const actorImpact = event.type === 'impact-actor' || event.type === 'actor-downed';
    const vehicleImpact = event.type === 'impact-vehicle';
    const flashColor = actorImpact
      ? new Color3(1, 0.16, 0.03)
      : vehicleImpact
        ? new Color3(1, 0.54, 0.08)
        : new Color3(0.65, 0.78, 0.9);
    const flashMaterial = material(
      this.scene,
      `ops-impact-material-${event.id}`,
      flashColor,
      Color3.Black(),
      flashColor.scale(0.9),
    );
    this.materials.push(flashMaterial);
    const flash = MeshBuilder.CreateSphere(`ops-impact-${event.id}`, {
      diameter: event.type === 'actor-downed' ? 0.9 : actorImpact ? 0.55 : 0.38,
      segments: 8,
    }, this.scene);
    flash.position.copyFrom(impactPoint);
    flash.material = flashMaterial;
    this.effects.push({ mesh: flash, remaining: actorImpact ? 0.18 : 0.1 });
  }

  private applyCameraMode(mode: ActionCameraMode): void {
    const camera: Camera = mode === 'tactical'
      ? this.tacticalCamera
      : mode === 'first-person'
        ? this.firstPersonCamera
        : this.thirdPersonCamera;
    if (this.scene.activeCamera !== camera) this.scene.activeCamera = camera;
  }

  private update(delta: number): void {
    if (this.disposed) return;
    const boundedDelta = Math.min(delta, 0.1);
    this.elapsed += boundedDelta;
    this.movementCooldown = Math.max(0, this.movementCooldown - boundedDelta * 1000);

    const look = this.input.consumeLookDelta();
    this.yaw -= look.x * 0.0022;
    this.pitch = Math.max(-0.62, Math.min(0.55, this.pitch - look.y * 0.0017));

    if (this.input.consume('pause')) this.controller.setPaused(!this.controller.isPaused());
    if (this.input.consume('camera')) this.controller.cycleCameraMode();
    if (this.input.consume('next-member')) this.controller.cycleSelectedCrew(1);
    if (this.input.consume('previous-member')) this.controller.cycleSelectedCrew(-1);
    if (this.input.consume('fire')) this.fireSelectedWeapon();
    if (this.input.consume('reload')) this.controller.reloadSelected();
    if (this.input.consume('interact')) this.controller.interactSelected();
    if (this.input.consume('retreat')) this.controller.retreatSelected();

    if (!this.controller.isPaused() && this.snapshot.phase === 'active') {
      this.updateMovement();
      this.tickAccumulator += boundedDelta * 1000;
      while (this.tickAccumulator >= SIM_TICK_MS) {
        this.tickAccumulator -= SIM_TICK_MS;
        this.controller.advance(2);
      }
      if (this.options.demo) this.updateDemo(boundedDelta);
    }

    this.actorVisuals.forEach((visual) => {
      visual.root.position.copyFrom(Vector3.Lerp(visual.root.position, visual.target, Math.min(1, boundedDelta * 11)));
    });
    this.updateCamera();
    this.updateEffects(boundedDelta);
    const pulse = 1 + Math.sin(this.elapsed * 4.5) * 0.12;
    this.extractionMesh.scaling.set(pulse, 1, pulse);
  }

  private fireSelectedWeapon(): void {
    if (this.controller.getCameraMode() === 'tactical') {
      this.controller.fireNearest();
      return;
    }

    const camera = this.scene.activeCamera;
    const engine = this.scene.getEngine();
    const selectedId = this.controller.getControlledCrewId();
    if (!camera || !selectedId) return;

    const ray = this.scene.createPickingRay(
      engine.getRenderWidth() / 2,
      engine.getRenderHeight() / 2,
      Matrix.Identity(),
      camera,
      false,
    );
    ray.length = OPS_FIRE_RANGE;
    const pick = this.scene.pickWithRay(ray, (mesh) => {
      if (!mesh.isEnabled() || !mesh.isVisible || !mesh.isPickable) return false;
      const metadata = mesh.metadata as OpsImpactMetadata | undefined;
      if (!metadata) return false;
      return metadata.impactKind !== 'actor' || metadata.entityId !== selectedId;
    }, false);

    const point = pick?.hit && pick.pickedPoint
      ? pick.pickedPoint
      : ray.origin.add(ray.direction.scale(OPS_FIRE_RANGE));
    const metadata = pick?.hit && pick.pickedMesh
      ? pick.pickedMesh.metadata as OpsImpactMetadata | undefined
      : undefined;
    const candidate: CombatImpactCandidate = metadata
      ? {
          kind: metadata.impactKind,
          entityId: metadata.entityId,
          hitZone: metadata.hitZone,
          point: { x: point.x, y: point.y, z: point.z },
          distance: Vector3.Distance(ray.origin, point),
        }
      : {
          kind: 'miss',
          point: { x: point.x, y: point.y, z: point.z },
          distance: OPS_FIRE_RANGE,
        };

    this.controller.fireRay({
      origin: { x: ray.origin.x, y: ray.origin.y, z: ray.origin.z },
      direction: { x: ray.direction.x, y: ray.direction.y, z: ray.direction.z },
      maxDistance: OPS_FIRE_RANGE,
      clientTick: this.snapshot.tick,
    }, candidate);
  }

  private updateMovement(): void {
    if (this.movementCooldown > 0) return;
    const movement = this.input.movement();
    const step = movementToGridStep(movement.forward, movement.strafe, this.yaw);
    if (!step) return;
    this.controller.moveSelected(step.x, step.y);
    this.movementCooldown = MOVE_INTERVAL_MS;
  }

  private updateDemo(delta: number): void {
    this.demoAccumulator += delta;
    if (this.demoAccumulator < 0.68 || this.snapshot.phase !== 'active') return;
    this.demoAccumulator = 0;
    this.demoStep += 1;

    if (this.demoStep === 2) this.controller.setCameraMode('first-person');
    if (this.demoStep === 5) this.controller.setCameraMode('third-person');
    if (this.demoStep === 8) this.controller.setCameraMode('tactical');

    const opposition = this.snapshot.combatants.filter((actor) => actor.team === 'opposition' && !actor.isDown);
    if (opposition.length > 0) {
      this.controller.fireNearest();
      return;
    }

    const actor = this.controller.getSelectedCrew();
    if (!actor) return;
    const target = this.snapshot.objective.extraction;
    const dx = Math.sign(target.x - actor.position.x);
    const dy = Math.sign(target.y - actor.position.y);
    if (dx !== 0) this.controller.moveSelected(dx, 0);
    else if (dy !== 0) this.controller.moveSelected(0, dy);
    else this.controller.interactSelected();
  }

  private updateCamera(): void {
    const selected = this.controller.getSelectedCrew();
    if (!selected) return;
    const actor = this.actorVisuals.get(selected.id);
    if (!actor) return;
    const position = actor.root.position;
    const forward = new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    if (this.controller.getCameraMode() === 'tactical') {
      this.tacticalCamera.target.copyFrom(position.add(new Vector3(0, 0.6, 0)));
      this.tacticalCamera.alpha = this.yaw - Math.PI / 2;
      actor.body.visibility = selected.isDown ? 0.42 : 1;
      actor.head.visibility = selected.isDown ? 0.42 : 1;
      return;
    }

    if (this.controller.getCameraMode() === 'first-person') {
      this.firstPersonCamera.position.copyFrom(position.add(new Vector3(0, 1.55, 0)));
      this.firstPersonCamera.rotation.set(this.pitch, this.yaw, 0);
      actor.body.visibility = 0;
      actor.head.visibility = 0;
      return;
    }

    const shoulder = position
      .subtract(forward.scale(9.4))
      .add(right.scale(2.35))
      .add(new Vector3(0, 2.35, 0));
    this.thirdPersonCamera.position.copyFrom(shoulder);
    this.thirdPersonCamera.setTarget(position.add(new Vector3(0, 1 + this.pitch * 1.5, 0)).add(forward.scale(6.2)));
    actor.body.visibility = selected.isDown ? 0.42 : 1;
    actor.head.visibility = selected.isDown ? 0.42 : 1;
  }

  private updateEffects(delta: number): void {
    for (let index = this.effects.length - 1; index >= 0; index -= 1) {
      const effect = this.effects[index];
      effect.remaining -= delta;
      effect.mesh.scaling.scaleInPlace(1 + delta * 2.5);
      if (effect.remaining > 0) continue;
      effect.mesh.dispose();
      this.effects.splice(index, 1);
    }
  }
}
