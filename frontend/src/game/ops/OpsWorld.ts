import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import '@babylonjs/core/Culling/ray';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
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
  CombatImpactCandidate,
  CombatSnapshot,
  Combatant,
  EncounterPreparation,
} from '../combat/types';
import type { ActionCameraMode, CombatControllerState } from '../combat/CombatSessionController';
import { CombatSessionController } from '../combat/CombatSessionController';
import {
  createArticulatedActorFallback,
  type OpsActorVisual,
  type OpsImpactMetadata,
} from './OpsCharacterFactory';
import {
  createConcretePlanter,
  createDetailedSedan,
  createPalmTree,
  createWetPuddle,
} from './OpsEnvironmentFactory';
import { OpsInput } from './OpsInput';
import { gridToWorld, movementToGridStep, OPS_CELL_SIZE } from './opsCoordinates';

const FACADE_URL = '/assets/runtime/generated/environments/street/block_modern_ops_storefront_v001.webp';
const MOVE_INTERVAL_MS = 155;
const SIM_TICK_MS = 100;
const OPS_FIRE_RANGE = 40;

interface TimedEffect {
  mesh: AbstractMesh;
  remaining: number;
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
  const world = gridToWorld(actor.position, 0.68);
  return new Vector3(world.x, world.y, world.z);
}

export class OpsWorld {
  private readonly input: OpsInput;
  private readonly actorVisuals = new Map<string, OpsActorVisual>();
  private readonly effects: TimedEffect[] = [];
  private readonly materials: StandardMaterial[] = [];
  private readonly observers: Observer<Scene>[] = [];
  private readonly shadowGenerator: ShadowGenerator;
  private readonly tacticalCamera: ArcRotateCamera;
  private readonly firstPersonCamera: UniversalCamera;
  private readonly thirdPersonCamera: UniversalCamera;
  private readonly firstPersonWeapon: TransformNode;
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
  private weaponKick = 0;
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

    this.shadowGenerator = this.createLighting();
    this.createEnvironment();
    this.createFacade();
    this.createStreetLights();
    this.createSetDressing();
    this.extractionMesh = this.createExtraction();

    this.tacticalCamera = this.createTacticalCamera();
    this.firstPersonCamera = this.createUniversalCamera('ops-first-person', 0.94);
    this.thirdPersonCamera = this.createUniversalCamera('ops-third-person', 0.82);
    this.firstPersonWeapon = this.createFirstPersonWeapon();

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

  private createLighting(): ShadowGenerator {
    const sky = new HemisphericLight('ops-sky-light', new Vector3(0.2, 1, 0.1), this.scene);
    sky.intensity = 0.72;
    sky.diffuse = new Color3(0.3, 0.44, 0.62);
    sky.groundColor = new Color3(0.09, 0.055, 0.13);

    const moon = new DirectionalLight('ops-moon-key', new Vector3(0.28, -1, 0.34), this.scene);
    moon.position.set(-16, 24, -12);
    moon.diffuse = new Color3(0.36, 0.48, 0.72);
    moon.specular = new Color3(0.52, 0.63, 0.82);
    moon.intensity = 1.12;

    const shadows = new ShadowGenerator(1024, moon);
    shadows.useBlurExponentialShadowMap = true;
    shadows.blurKernel = 16;
    shadows.bias = 0.0008;
    return shadows;
  }

  private createEnvironment(): void {
    this.scene.clearColor.set(0.012, 0.025, 0.045, 1);
    this.scene.ambientColor = new Color3(0.08, 0.11, 0.16);

    const palette = {
      street: material(this.scene, 'ops-road', new Color3(0.035, 0.055, 0.075), new Color3(0.95, 0.95, 1)),
      curb: material(this.scene, 'ops-curb', new Color3(0.19, 0.21, 0.23), new Color3(0.4, 0.4, 0.44)),
      sidewalk: material(this.scene, 'ops-sidewalk', new Color3(0.13, 0.18, 0.2), new Color3(0.5, 0.54, 0.58)),
      storefront: material(this.scene, 'ops-storefront-ground', new Color3(0.11, 0.09, 0.14)),
      alley: material(this.scene, 'ops-alley', new Color3(0.035, 0.08, 0.085)),
      parking: material(this.scene, 'ops-parking', new Color3(0.095, 0.09, 0.085), new Color3(0.38, 0.35, 0.34)),
      rooftop: material(this.scene, 'ops-rooftop', new Color3(0.105, 0.08, 0.13)),
      building: material(this.scene, 'ops-building', new Color3(0.055, 0.045, 0.075)),
    };
    this.materials.push(...Object.values(palette));

    this.preparation.terrain.flat().forEach((cell) => {
      const point = gridToWorld(cell, 0);
      const cellMesh = MeshBuilder.CreateBox(`ops-cell-${cell.x}-${cell.y}`, {
        width: OPS_CELL_SIZE + 0.04,
        depth: OPS_CELL_SIZE + 0.04,
        height: cell.zoneType === 'building' ? 0.38 : 0.12,
      }, this.scene);
      cellMesh.position.set(point.x, cell.zoneType === 'building' ? 0.12 : -0.08, point.z);
      cellMesh.material = palette[cell.zoneType] ?? palette.sidewalk;
      cellMesh.receiveShadows = true;
      cellMesh.metadata = {
        impactKind: 'environment',
        entityId: `terrain-${cell.x}-${cell.y}`,
      } satisfies OpsImpactMetadata;

      if (cell.cover >= 0.45 && cell.passable && (cell.x + cell.y) % 2 === 0) {
        const planter = createConcretePlanter(
          this.scene,
          `cover-${cell.x}-${cell.y}`,
          new Vector3(point.x, 0, point.z),
          (propMaterial) => this.materials.push(propMaterial),
          cell.x % 2 === 0 ? 0 : Math.PI / 2,
        );
        planter.getChildMeshes().forEach((mesh) => this.shadowGenerator.addShadowCaster(mesh));
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

    const awningMaterials = [
      material(this.scene, 'ops-awning-cyan', new Color3(0.02, 0.16, 0.19), new Color3(0.28, 0.4, 0.44), new Color3(0.01, 0.12, 0.14)),
      material(this.scene, 'ops-awning-magenta', new Color3(0.18, 0.025, 0.14), new Color3(0.4, 0.24, 0.38), new Color3(0.13, 0.008, 0.1)),
      material(this.scene, 'ops-awning-amber', new Color3(0.19, 0.11, 0.018), new Color3(0.4, 0.34, 0.18), new Color3(0.14, 0.07, 0.004)),
      material(this.scene, 'ops-awning-green', new Color3(0.018, 0.17, 0.09), new Color3(0.23, 0.42, 0.3), new Color3(0.004, 0.13, 0.055)),
    ];
    const columnMaterial = material(this.scene, 'ops-storefront-columns', new Color3(0.11, 0.1, 0.12), new Color3(0.32, 0.3, 0.34));
    this.materials.push(...awningMaterials, columnMaterial);

    [-11.25, -3.75, 3.75, 11.25].forEach((x, bay) => {
      [-1, 1].forEach((side) => {
        const z = side < 0 ? -14.5 : 14.5;
        const awning = MeshBuilder.CreateBox(`ops-awning-${side}-${bay}`, { width: 6.7, height: 0.18, depth: 1.25 }, this.scene);
        awning.position.set(x, 4.72, z);
        awning.material = awningMaterials[bay];
        awning.metadata = { impactKind: 'environment', entityId: `awning-${side}-${bay}` } satisfies OpsImpactMetadata;
        this.shadowGenerator.addShadowCaster(awning);

        const sill = MeshBuilder.CreateBox(`ops-sill-${side}-${bay}`, { width: 6.35, height: 0.32, depth: 0.42 }, this.scene);
        sill.position.set(x, 0.35, side < 0 ? -15.05 : 15.05);
        sill.material = columnMaterial;
        sill.metadata = { impactKind: 'cover', entityId: `sill-${side}-${bay}` } satisfies OpsImpactMetadata;
        this.shadowGenerator.addShadowCaster(sill);
      });
    });

    [-15, -7.5, 0, 7.5, 15].forEach((x, column) => {
      [-1, 1].forEach((side) => {
        const post = MeshBuilder.CreateBox(`ops-storefront-post-${side}-${column}`, { width: 0.28, height: 5.2, depth: 0.42 }, this.scene);
        post.position.set(x, 2.6, side < 0 ? -15.1 : 15.1);
        post.material = columnMaterial;
        post.metadata = { impactKind: 'environment', entityId: `storefront-post-${side}-${column}` } satisfies OpsImpactMetadata;
        this.shadowGenerator.addShadowCaster(post);
      });
    });

    [-18, -9, 1, 11, 20].forEach((x, index) => {
      [-1, 1].forEach((side) => {
        const background = MeshBuilder.CreateBox(`ops-background-building-${side}-${index}`, {
          width: 7 + (index % 2) * 2.5,
          height: 8 + (index % 3) * 2.4,
          depth: 5,
        }, this.scene);
        background.position.set(x, 4 + (index % 3) * 1.2, side * 21.5);
        background.material = roofMaterial;
        background.metadata = { impactKind: 'environment', entityId: `background-building-${side}-${index}` } satisfies OpsImpactMetadata;
        this.shadowGenerator.addShadowCaster(background);
      });
    });
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

  private createSetDressing(): void {
    const registerMaterial = (propMaterial: StandardMaterial) => this.materials.push(propMaterial);
    const westSedan = createDetailedSedan(
      this.scene,
      'sedan-west',
      new Vector3(-8.8, 0, 5.5),
      Math.PI / 2,
      registerMaterial,
      new Color3(0.018, 0.026, 0.045),
    );
    const eastSedan = createDetailedSedan(
      this.scene,
      'sedan-east',
      new Vector3(8.4, 0, -5.2),
      -Math.PI / 2,
      registerMaterial,
      new Color3(0.28, 0.29, 0.31),
    );
    [...westSedan.getChildMeshes(), ...eastSedan.getChildMeshes()]
      .forEach((mesh) => this.shadowGenerator.addShadowCaster(mesh));

    [
      { id: 'north-west', x: -13.4, z: -13.6, scale: 1.12 },
      { id: 'north-east', x: 12.8, z: -13.2, scale: 0.96 },
      { id: 'south-west', x: -13, z: 12.6, scale: 1.02 },
      { id: 'south-east', x: 13.5, z: 11.8, scale: 1.08 },
    ].forEach((palm) => {
      const tree = createPalmTree(
        this.scene,
        `palm-${palm.id}`,
        new Vector3(palm.x, 0, palm.z),
        registerMaterial,
        palm.scale,
      );
      tree.getChildMeshes().forEach((mesh) => this.shadowGenerator.addShadowCaster(mesh));
    });

    [
      { id: 'puddle-neon-west', x: -5.4, z: -1.7, sx: 2.6, sz: 0.85 },
      { id: 'puddle-neon-east', x: 4.9, z: 2.1, sx: 2.1, sz: 0.68 },
      { id: 'puddle-curb', x: 0.4, z: -8.9, sx: 3.2, sz: 0.48 },
    ].forEach((puddle) => createWetPuddle(
      this.scene,
      puddle.id,
      new Vector3(puddle.x, 0.035, puddle.z),
      registerMaterial,
      new Vector3(puddle.sx, puddle.sz, 1),
    ));
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

  private createFirstPersonWeapon(): TransformNode {
    const root = new TransformNode('ops-first-person-weapon', this.scene);
    root.parent = this.firstPersonCamera;
    root.position.set(0.34, -0.28, 0.78);
    root.rotation.set(-0.08, 0.02, -0.015);

    const metal = material(this.scene, 'ops-fps-weapon-metal', new Color3(0.045, 0.05, 0.055), new Color3(0.72, 0.75, 0.78));
    const grip = material(this.scene, 'ops-fps-weapon-grip', new Color3(0.035, 0.022, 0.018), new Color3(0.22, 0.18, 0.16));
    const sight = material(this.scene, 'ops-fps-weapon-sight', new Color3(0.05, 0.38, 0.39), Color3.Black(), new Color3(0.02, 0.55, 0.56));
    this.materials.push(metal, grip, sight);

    const receiver = MeshBuilder.CreateBox('ops-fps-receiver', { width: 0.16, height: 0.17, depth: 0.78 }, this.scene);
    receiver.parent = root;
    receiver.material = metal;
    const barrel = MeshBuilder.CreateBox('ops-fps-barrel', { width: 0.055, height: 0.055, depth: 0.72 }, this.scene);
    barrel.parent = root;
    barrel.position.set(0, 0.035, 0.7);
    barrel.material = metal;
    const magazine = MeshBuilder.CreateBox('ops-fps-magazine', { width: 0.12, height: 0.34, depth: 0.19 }, this.scene);
    magazine.parent = root;
    magazine.position.set(0, -0.23, -0.05);
    magazine.rotation.x = -0.2;
    magazine.material = grip;
    const optic = MeshBuilder.CreateBox('ops-fps-optic', { width: 0.1, height: 0.11, depth: 0.22 }, this.scene);
    optic.parent = root;
    optic.position.set(0, 0.13, 0.05);
    optic.material = sight;
    [receiver, barrel, magazine, optic].forEach((mesh) => { mesh.isPickable = false; });
    root.setEnabled(false);
    return root;
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
      visual.meshes.forEach((mesh) => {
        mesh.visibility = actor.isDown ? 0.42 : 1;
        mesh.isPickable = !actor.isDown;
      });
    });
  }

  private createActorVisual(actor: Combatant): OpsActorVisual {
    const visual = createArticulatedActorFallback(
      this.scene,
      actor,
      actorPosition(actor),
      (actorMaterial) => this.materials.push(actorMaterial),
    );
    visual.meshes.forEach((mesh) => this.shadowGenerator.addShadowCaster(mesh));
    return visual;
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
      if (event.actorId === this.controller.getControlledCrewId()) this.weaponKick = 0.13;
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
    this.firstPersonWeapon?.setEnabled(mode === 'first-person');
  }

  private update(delta: number): void {
    if (this.disposed) return;
    const boundedDelta = Math.min(delta, 0.1);
    this.elapsed += boundedDelta;
    this.movementCooldown = Math.max(0, this.movementCooldown - boundedDelta * 1000);
    this.weaponKick = Math.max(0, this.weaponKick - boundedDelta * 1.6);
    if (this.firstPersonWeapon) this.firstPersonWeapon.rotation.x = -0.08 + this.weaponKick;

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

    this.actorVisuals.forEach((visual, actorId) => {
      const movement = visual.target.subtract(visual.root.position);
      const actor = this.snapshot.combatants.find((candidate) => candidate.id === actorId);
      if (!actor?.isDown && movement.lengthSquared() > 0.0025) {
        visual.root.rotation.y = Math.atan2(movement.x, movement.z);
      }
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
    const hitActor = metadata?.impactKind === 'actor'
      ? this.snapshot.combatants.find((combatant) => combatant.id === metadata.entityId)
      : undefined;
    const allyBlocksShot = hitActor?.team === 'crew';
    const candidate: CombatImpactCandidate = metadata
      ? {
          kind: allyBlocksShot ? 'cover' : metadata.impactKind,
          entityId: metadata.entityId,
          hitZone: allyBlocksShot ? undefined : metadata.hitZone,
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
      actor.meshes.forEach((mesh) => {
        mesh.visibility = selected.isDown ? 0.42 : 1;
        mesh.isPickable = !selected.isDown;
      });
      return;
    }

    if (this.controller.getCameraMode() === 'first-person') {
      this.firstPersonCamera.position.copyFrom(position.add(new Vector3(0, 1.55, 0)));
      this.firstPersonCamera.rotation.set(this.pitch, this.yaw, 0);
      actor.meshes.forEach((mesh) => {
        mesh.visibility = 0;
        mesh.isPickable = false;
      });
      return;
    }

    const shoulder = position
      .subtract(forward.scale(5.8))
      .add(right.scale(1.25))
      .add(new Vector3(0, 2.05, 0));
    this.thirdPersonCamera.position.copyFrom(shoulder);
    this.thirdPersonCamera.setTarget(position.add(new Vector3(0, 1.12 + this.pitch * 1.35, 0)).add(forward.scale(7.5)));
    actor.meshes.forEach((mesh) => {
      mesh.visibility = selected.isDown ? 0.42 : 1;
      mesh.isPickable = !selected.isDown;
    });
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
