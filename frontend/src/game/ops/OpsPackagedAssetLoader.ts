import '@babylonjs/loaders/glTF';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import type { Scene } from '@babylonjs/core/scene';
import type { BlockPackageV1, CharacterPackageV1 } from '../assets/assetPackages';
import { hitZoneForNode } from '../assets/assetPackages';
import type { Combatant } from '../combat/types';
import type { OpsActorVisual, OpsImpactMetadata, RegisterOpsMaterial } from './OpsCharacterFactory';

function splitAssetUrl(url: string): { rootUrl: string; fileName: string } {
  const separator = url.lastIndexOf('/');
  if (separator < 0) return { rootUrl: './', fileName: url };
  return {
    rootUrl: url.slice(0, separator + 1),
    fileName: url.slice(separator + 1),
  };
}

function setActorMetadata(mesh: AbstractMesh, actor: Combatant, packageDefinition: CharacterPackageV1): void {
  mesh.metadata = {
    impactKind: 'actor',
    entityId: actor.id,
    hitZone: hitZoneForNode(packageDefinition, mesh.name) ?? 'torso',
  } satisfies OpsImpactMetadata;
  mesh.isPickable = true;
  mesh.receiveShadows = true;
}

export async function loadPackagedCharacter(
  scene: Scene,
  packageDefinition: CharacterPackageV1,
  actor: Combatant,
  position: Vector3,
  registerMaterial: RegisterOpsMaterial,
): Promise<OpsActorVisual> {
  const root = new TransformNode(`ops-actor-${actor.id}`, scene);
  root.position.copyFrom(position);
  root.scaling.setAll(1 / packageDefinition.skeleton.metersPerUnit);

  const { rootUrl, fileName } = splitAssetUrl(packageDefinition.runtime.babylonGlb);
  const imported = await SceneLoader.ImportMeshAsync(null, rootUrl, fileName, scene);
  imported.meshes.forEach((mesh) => {
    if (!mesh.parent) mesh.parent = root;
    setActorMetadata(mesh, actor, packageDefinition);
  });

  const weapon = new TransformNode(`ops-weapon-root-${actor.id}`, scene);
  weapon.parent = root;
  const weaponSocket = packageDefinition.weaponSockets?.rightHand;
  const socketNode = weaponSocket
    ? imported.transformNodes.find((node) => node.name === weaponSocket)
    : undefined;
  if (socketNode) weapon.parent = socketNode;

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
  marker.position.y = -0.67;
  marker.material = markerMaterial;
  marker.isPickable = false;

  const idleGroup = imported.animationGroups.find((group) => group.name === packageDefinition.animations.idle);
  idleGroup?.start(true);

  return {
    root,
    meshes: imported.meshes,
    marker,
    target: root.position.clone(),
    weapon,
    presentation: 'production-glb',
  };
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
