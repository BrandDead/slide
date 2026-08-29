import '@babylonjs/loaders/glTF';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import type { AssetContainer, InstantiatedEntries } from '@babylonjs/core/assetContainer';
import type { Bone } from '@babylonjs/core/Bones/bone';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import type { Scene } from '@babylonjs/core/scene';
import type { BlockPackageV1, CharacterPackageV1 } from '../assets/assetPackages';
import type { CombatHitZone, Combatant } from '../combat/types';
import type {
  OpsActorAnimationState,
  OpsActorVisual,
  OpsImpactMetadata,
  RegisterOpsMaterial,
} from './OpsCharacterFactory';

function splitAssetUrl(url: string): { rootUrl: string; fileName: string } {
  const separator = url.lastIndexOf('/');
  if (separator < 0) return { rootUrl: './', fileName: url };
  return {
    rootUrl: url.slice(0, separator + 1),
    fileName: url.slice(separator + 1),
  };
}

function uniqueMeshes(nodes: InstantiatedEntries['rootNodes']): AbstractMesh[] {
  const meshes = new Set<AbstractMesh>();
  nodes.forEach((node) => {
    if ('getBoundingInfo' in node) meshes.add(node as AbstractMesh);
    node.getChildMeshes(false).forEach((mesh) => meshes.add(mesh));
  });
  return [...meshes];
}

function findAnimation(groups: AnimationGroup[], expectedName: string): AnimationGroup | undefined {
  return groups.find((group) => group.name === expectedName)
    ?? groups.find((group) => group.name.startsWith(`${expectedName}-`))
    ?? groups.find((group) => group.name.includes(expectedName));
}

const HIT_PROXY_SPECS: Array<{
  packageKey: keyof CharacterPackageV1['hitZones'];
  zone: CombatHitZone;
  dimensions: { width: number; height: number; depth: number };
  offset: Vector3;
}> = [
  { packageKey: 'head', zone: 'head', dimensions: { width: 0.38, height: 0.44, depth: 0.38 }, offset: new Vector3(0, 0.1, 0) },
  { packageKey: 'torso', zone: 'torso', dimensions: { width: 0.7, height: 0.82, depth: 0.36 }, offset: new Vector3(0, -0.12, 0) },
  { packageKey: 'leftArm', zone: 'arm', dimensions: { width: 0.22, height: 0.62, depth: 0.22 }, offset: new Vector3(0, -0.23, 0) },
  { packageKey: 'rightArm', zone: 'arm', dimensions: { width: 0.22, height: 0.62, depth: 0.22 }, offset: new Vector3(0, -0.23, 0) },
  { packageKey: 'leftLeg', zone: 'leg', dimensions: { width: 0.28, height: 0.78, depth: 0.3 }, offset: new Vector3(0, -0.34, 0) },
  { packageKey: 'rightLeg', zone: 'leg', dimensions: { width: 0.28, height: 0.78, depth: 0.3 }, offset: new Vector3(0, -0.34, 0) },
];

function findBone(entries: InstantiatedEntries, name: string): Bone | undefined {
  return entries.skeletons.flatMap((skeleton) => skeleton.bones).find((bone) => bone.name === name);
}

function createMarker(
  scene: Scene,
  actor: Combatant,
  root: TransformNode,
  localGroundY: number,
  registerMaterial: RegisterOpsMaterial,
): Mesh {
  const markerMaterial = new StandardMaterial(`ops-marker-material-${actor.id}`, scene);
  markerMaterial.diffuseColor = Color3.Black();
  markerMaterial.specularColor = Color3.Black();
  markerMaterial.emissiveColor = actor.team === 'crew'
    ? new Color3(0.05, 0.85, 0.8)
    : new Color3(0.85, 0.08, 0.18);
  registerMaterial(markerMaterial);
  const marker = MeshBuilder.CreateTorus(`ops-marker-${actor.id}`, { diameter: 1.2, thickness: 0.045, tessellation: 32 }, scene);
  marker.parent = root;
  marker.rotation.x = Math.PI / 2;
  marker.position.y = localGroundY + 0.025;
  marker.material = markerMaterial;
  marker.isPickable = false;
  return marker;
}

function createHitProxies(
  scene: Scene,
  packageDefinition: CharacterPackageV1,
  actor: Combatant,
  entries: InstantiatedEntries,
  renderMeshes: AbstractMesh[],
  registerMaterial: RegisterOpsMaterial,
): AbstractMesh[] {
  const skinnedMesh = renderMeshes.find((mesh) => 'skeleton' in mesh && Boolean((mesh as Mesh).skeleton)) as Mesh | undefined;
  if (!skinnedMesh) return [];

  const proxyMaterial = new StandardMaterial(`ops-hit-proxy-material-${actor.id}`, scene);
  proxyMaterial.alpha = 0;
  proxyMaterial.disableColorWrite = true;
  proxyMaterial.disableDepthWrite = true;
  registerMaterial(proxyMaterial);

  return HIT_PROXY_SPECS.flatMap((spec) => {
    const bone = findBone(entries, packageDefinition.hitZones[spec.packageKey]);
    if (!bone) return [];
    const proxy = MeshBuilder.CreateBox(`ops-hit-${spec.zone}-${spec.packageKey}-${actor.id}`, spec.dimensions, scene);
    proxy.material = proxyMaterial;
    proxy.position.copyFrom(spec.offset);
    proxy.attachToBone(bone, skinnedMesh);
    proxy.metadata = {
      impactKind: 'actor',
      entityId: actor.id,
      hitZone: spec.zone,
    } satisfies OpsImpactMetadata;
    proxy.isPickable = true;
    return [proxy];
  });
}

function createWeapon(
  scene: Scene,
  packageDefinition: CharacterPackageV1,
  actor: Combatant,
  entries: InstantiatedEntries,
  renderMeshes: AbstractMesh[],
  root: TransformNode,
  registerMaterial: RegisterOpsMaterial,
): TransformNode {
  const metal = new StandardMaterial(`ops-package-weapon-${actor.id}`, scene);
  metal.diffuseColor = new Color3(0.035, 0.04, 0.045);
  metal.specularColor = new Color3(0.62, 0.64, 0.68);
  registerMaterial(metal);

  const receiver = MeshBuilder.CreateBox(`ops-package-weapon-receiver-${actor.id}`, {
    width: 0.13,
    height: 0.17,
    depth: 0.58,
  }, scene);
  receiver.material = metal;
  receiver.isPickable = false;
  const barrel = MeshBuilder.CreateBox(`ops-package-weapon-barrel-${actor.id}`, {
    width: 0.052,
    height: 0.052,
    depth: 0.42,
  }, scene);
  barrel.parent = receiver;
  barrel.position.z = 0.43;
  barrel.material = metal;
  barrel.isPickable = false;

  const socketName = packageDefinition.weaponSockets?.rightHand;
  const socket = socketName ? findBone(entries, socketName) : undefined;
  const skinnedMesh = renderMeshes.find((mesh) => 'skeleton' in mesh && Boolean((mesh as Mesh).skeleton)) as Mesh | undefined;
  if (socket && skinnedMesh) {
    receiver.attachToBone(socket, skinnedMesh);
    receiver.position.set(0.02, 0.03, 0.2);
    receiver.rotation.set(Math.PI / 2, 0, 0);
  } else {
    receiver.parent = root;
    receiver.position.set(0.27, 1.05, 0.35);
  }
  return receiver;
}

export interface OpsCharacterTemplate {
  instantiate(actor: Combatant, position: Vector3): OpsActorVisual;
  dispose(): void;
}

export async function loadPackagedCharacterTemplate(
  scene: Scene,
  packageDefinition: CharacterPackageV1,
  registerMaterial: RegisterOpsMaterial,
): Promise<OpsCharacterTemplate> {
  const { rootUrl, fileName } = splitAssetUrl(packageDefinition.runtime.babylonGlb);
  const container: AssetContainer = await SceneLoader.LoadAssetContainerAsync(rootUrl, fileName, scene);
  const requiredClips = new Set(Object.values(packageDefinition.animations));
  const availableClips = new Set(container.animationGroups.map((group) => group.name));
  const missingClips = [...requiredClips].filter((clip) => !availableClips.has(clip));
  if (missingClips.length > 0) {
    container.dispose();
    throw new Error(`Character package ${packageDefinition.packageId} is missing animations: ${missingClips.join(', ')}`);
  }

  return {
    instantiate(actor, position) {
      const entries = container.instantiateModelsToScene(
        (sourceName) => `${sourceName}-${actor.id}`,
        false,
        { doNotInstantiate: true },
      );
      const root = new TransformNode(`ops-actor-${actor.id}`, scene);
      root.position.copyFrom(position);
      root.scaling.setAll(1 / packageDefinition.skeleton.metersPerUnit);
      const modelRoot = new TransformNode(`ops-model-${actor.id}`, scene);
      modelRoot.parent = root;
      entries.rootNodes.forEach((node) => {
        if (!node.parent) node.parent = modelRoot;
      });

      const renderMeshes = uniqueMeshes(entries.rootNodes);
      renderMeshes.forEach((mesh) => {
        mesh.isPickable = false;
        mesh.receiveShadows = true;
      });
      root.computeWorldMatrix(true);
      renderMeshes.forEach((mesh) => mesh.computeWorldMatrix(true));
      const minimumY = Math.min(...renderMeshes.map((mesh) => mesh.getBoundingInfo().boundingBox.minimumWorld.y));
      const localGroundY = 0.06 - root.position.y;
      if (Number.isFinite(minimumY)) modelRoot.position.y += 0.06 - minimumY;

      const hitMeshes = createHitProxies(scene, packageDefinition, actor, entries, renderMeshes, registerMaterial);
      const marker = createMarker(scene, actor, root, localGroundY, registerMaterial);
      const weapon = createWeapon(scene, packageDefinition, actor, entries, renderMeshes, root, registerMaterial);
      const groups = entries.animationGroups;
      let activeGroup: AnimationGroup | undefined;
      let activeState: OpsActorAnimationState | undefined;
      let transient = false;

      const playAnimation = (state: OpsActorAnimationState): void => {
        if (transient && !['fire', 'reload', 'hit', 'downed'].includes(state)) return;
        if (state === activeState && (activeGroup?.isPlaying || state === 'downed')) return;
        const clipName = packageDefinition.animations[state];
        const nextGroup = findAnimation(groups, clipName);
        if (!nextGroup) return;
        activeGroup?.stop();
        activeGroup = nextGroup;
        activeState = state;
        const loop = ['idle', 'walk', 'sprint', 'strafe', 'aim', 'aimWalk', 'crouch', 'coverIdle'].includes(state);
        transient = ['fire', 'reload', 'hit'].includes(state);
        nextGroup.start(loop);
        if (transient) {
          nextGroup.onAnimationGroupEndObservable.addOnce(() => {
            transient = false;
            activeState = undefined;
            playAnimation('idle');
          });
        }
      };
      playAnimation('idle');

      return {
        root,
        meshes: renderMeshes,
        hitMeshes,
        marker,
        target: root.position.clone(),
        weapon,
        presentation: 'production-glb',
        playAnimation,
        dispose() {
          activeGroup?.stop();
          groups.forEach((group) => group.stop());
          hitMeshes.forEach((mesh) => mesh.dispose(false, false));
          entries.dispose();
          root.dispose(false, false);
        },
      };
    },
    dispose() {
      container.dispose();
    },
  };
}

export async function loadPackagedCharacter(
  scene: Scene,
  packageDefinition: CharacterPackageV1,
  actor: Combatant,
  position: Vector3,
  registerMaterial: RegisterOpsMaterial,
): Promise<OpsActorVisual> {
  const template = await loadPackagedCharacterTemplate(scene, packageDefinition, registerMaterial);
  const visual = template.instantiate(actor, position);
  const disposeVisual = visual.dispose;
  visual.dispose = () => {
    disposeVisual();
    template.dispose();
  };
  return visual;
}

export interface OpsBlockVisual {
  root: TransformNode;
  meshes: AbstractMesh[];
}

export async function loadPackagedBlock(
  scene: Scene,
  packageDefinition: BlockPackageV1,
): Promise<OpsBlockVisual> {
  const root = new TransformNode(`ops-block-${packageDefinition.blockId}`, scene);
  const { rootUrl, fileName } = splitAssetUrl(packageDefinition.runtime.babylonGlb);
  const imported = await SceneLoader.ImportMeshAsync(null, rootUrl, fileName, scene);

  imported.meshes.forEach((mesh) => {
    if (!mesh.parent) mesh.parent = root;
    const lowerName = mesh.name.toLowerCase();
    const vehicleAnchor = packageDefinition.anchors.find((anchor) => anchor.kind === 'vehicle' && lowerName.includes(anchor.id.toLowerCase()));
    const coverAnchor = packageDefinition.anchors.find((anchor) => anchor.kind === 'cover' && lowerName.includes(anchor.id.toLowerCase()));
    mesh.metadata = {
      impactKind: vehicleAnchor ? 'vehicle' : coverAnchor ? 'cover' : 'environment',
      entityId: vehicleAnchor?.entityId ?? coverAnchor?.entityId ?? `${packageDefinition.blockId}:${mesh.name}`,
    } satisfies OpsImpactMetadata;
    mesh.isPickable = true;
    mesh.receiveShadows = true;
  });

  return { root, meshes: imported.meshes };
}
