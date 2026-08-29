import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { StandardMaterial as BabylonStandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { CombatHitZone, CombatImpactKind, Combatant } from '../combat/types';

export interface OpsImpactMetadata {
  impactKind: Exclude<CombatImpactKind, 'miss'>;
  entityId: string;
  hitZone?: CombatHitZone;
}

export interface OpsActorVisual {
  root: TransformNode;
  meshes: AbstractMesh[];
  marker: Mesh;
  target: Vector3;
  weapon: TransformNode;
  presentation: 'articulated-fallback' | 'production-glb';
}

export type RegisterOpsMaterial = (material: StandardMaterial) => void;

function actorMaterial(
  scene: Scene,
  name: string,
  diffuse: Color3,
  register: RegisterOpsMaterial,
  emissive = Color3.Black(),
): StandardMaterial {
  const result = new BabylonStandardMaterial(name, scene);
  result.diffuseColor = diffuse;
  result.specularColor = new Color3(0.18, 0.2, 0.23);
  result.emissiveColor = emissive;
  register(result);
  return result;
}

function tagActorPart(mesh: AbstractMesh, actorId: string, hitZone: CombatHitZone): void {
  mesh.metadata = {
    impactKind: 'actor',
    entityId: actorId,
    hitZone,
  } satisfies OpsImpactMetadata;
}

function part(
  scene: Scene,
  name: string,
  dimensions: { width: number; height: number; depth: number },
  position: Vector3,
  parent: TransformNode,
  material: StandardMaterial,
  actorId: string,
  hitZone: CombatHitZone,
): Mesh {
  const mesh = MeshBuilder.CreateBox(name, dimensions, scene);
  mesh.parent = parent;
  mesh.position.copyFrom(position);
  mesh.material = material;
  mesh.receiveShadows = true;
  tagActorPart(mesh, actorId, hitZone);
  return mesh;
}

/**
 * A deliberate non-capsule fallback used until a licensed rigged GLB package is
 * present. It preserves human proportion, clothing separation, a readable
 * weapon silhouette, and semantic hit zones so the runtime contract does not
 * change when a production character replaces it.
 */
export function createArticulatedActorFallback(
  scene: Scene,
  actor: Combatant,
  position: Vector3,
  registerMaterial: RegisterOpsMaterial,
): OpsActorVisual {
  const root = new TransformNode(`ops-actor-${actor.id}`, scene);
  root.position.copyFrom(position);

  const crew = actor.team === 'crew';
  const jacket = actorMaterial(
    scene,
    `ops-jacket-${actor.id}`,
    crew ? new Color3(0.025, 0.16, 0.19) : new Color3(0.24, 0.025, 0.055),
    registerMaterial,
  );
  const shirt = actorMaterial(
    scene,
    `ops-shirt-${actor.id}`,
    crew ? new Color3(0.66, 0.7, 0.65) : new Color3(0.13, 0.12, 0.14),
    registerMaterial,
  );
  const denim = actorMaterial(
    scene,
    `ops-denim-${actor.id}`,
    crew ? new Color3(0.035, 0.055, 0.09) : new Color3(0.07, 0.045, 0.055),
    registerMaterial,
  );
  const skin = actorMaterial(
    scene,
    `ops-skin-${actor.id}`,
    crew ? new Color3(0.34, 0.17, 0.1) : new Color3(0.23, 0.105, 0.065),
    registerMaterial,
  );
  const shoe = actorMaterial(scene, `ops-shoe-${actor.id}`, new Color3(0.018, 0.02, 0.024), registerMaterial);
  const weaponMaterial = actorMaterial(scene, `ops-weapon-${actor.id}`, new Color3(0.055, 0.06, 0.065), registerMaterial);
  weaponMaterial.specularColor = new Color3(0.48, 0.5, 0.52);
  const accent = actorMaterial(
    scene,
    `ops-accent-${actor.id}`,
    crew ? new Color3(0.04, 0.54, 0.56) : new Color3(0.62, 0.05, 0.15),
    registerMaterial,
    crew ? new Color3(0.005, 0.06, 0.07) : new Color3(0.08, 0.004, 0.01),
  );

  const meshes: AbstractMesh[] = [];
  const torso = part(scene, `ops-torso-${actor.id}`, { width: 0.72, height: 0.78, depth: 0.36 }, new Vector3(0, 1.16, 0), root, jacket, actor.id, 'torso');
  const chest = part(scene, `ops-chest-${actor.id}`, { width: 0.34, height: 0.5, depth: 0.025 }, new Vector3(0, 1.16, 0.193), root, shirt, actor.id, 'torso');
  const waist = part(scene, `ops-waist-${actor.id}`, { width: 0.58, height: 0.25, depth: 0.3 }, new Vector3(0, 0.69, 0), root, denim, actor.id, 'torso');
  meshes.push(torso, chest, waist);

  const head = MeshBuilder.CreatePolyhedron(`ops-head-${actor.id}`, { type: 2, size: 0.31 }, scene);
  head.parent = root;
  head.position.set(0, 1.78, 0);
  head.scaling.set(0.82, 1.08, 0.86);
  head.material = skin;
  tagActorPart(head, actor.id, 'head');
  meshes.push(head);

  const hair = MeshBuilder.CreatePolyhedron(`ops-hair-${actor.id}`, { type: 1, size: 0.28 }, scene);
  hair.parent = root;
  hair.position.set(0, 1.96, -0.015);
  hair.scaling.set(0.92, 0.45, 0.92);
  hair.material = shoe;
  tagActorPart(hair, actor.id, 'head');
  meshes.push(hair);

  const armSpecs = [
    { side: 'l', x: -0.48, rotation: -0.16 },
    { side: 'r', x: 0.48, rotation: 0.16 },
  ];
  armSpecs.forEach(({ side, x, rotation }) => {
    const upper = part(scene, `ops-upper-arm-${side}-${actor.id}`, { width: 0.2, height: 0.58, depth: 0.22 }, new Vector3(x, 1.23, 0.06), root, jacket, actor.id, 'arm');
    upper.rotation.z = rotation;
    const fore = part(scene, `ops-forearm-${side}-${actor.id}`, { width: 0.18, height: 0.52, depth: 0.2 }, new Vector3(x * 0.9, 0.83, 0.2), root, skin, actor.id, 'arm');
    fore.rotation.x = -0.35;
    fore.rotation.z = rotation * 0.5;
    meshes.push(upper, fore);
  });

  const legSpecs = [
    { side: 'l', x: -0.18 },
    { side: 'r', x: 0.18 },
  ];
  legSpecs.forEach(({ side, x }) => {
    const upper = part(scene, `ops-thigh-${side}-${actor.id}`, { width: 0.24, height: 0.58, depth: 0.27 }, new Vector3(x, 0.29, 0), root, denim, actor.id, 'leg');
    const lower = part(scene, `ops-shin-${side}-${actor.id}`, { width: 0.21, height: 0.52, depth: 0.23 }, new Vector3(x, -0.25, 0.015), root, denim, actor.id, 'leg');
    const foot = part(scene, `ops-foot-${side}-${actor.id}`, { width: 0.23, height: 0.14, depth: 0.42 }, new Vector3(x, -0.57, 0.09), root, shoe, actor.id, 'leg');
    meshes.push(upper, lower, foot);
  });

  const weapon = new TransformNode(`ops-weapon-root-${actor.id}`, scene);
  weapon.parent = root;
  weapon.position.set(0.26, 1.02, 0.43);
  weapon.rotation.x = -0.12;
  const receiver = part(scene, `ops-weapon-receiver-${actor.id}`, { width: 0.16, height: 0.16, depth: 0.72 }, Vector3.Zero(), weapon, weaponMaterial, actor.id, 'arm');
  const barrel = part(scene, `ops-weapon-barrel-${actor.id}`, { width: 0.055, height: 0.055, depth: 0.58 }, new Vector3(0, 0.03, 0.62), weapon, weaponMaterial, actor.id, 'arm');
  const magazine = part(scene, `ops-weapon-mag-${actor.id}`, { width: 0.11, height: 0.3, depth: 0.16 }, new Vector3(0, -0.2, -0.05), weapon, accent, actor.id, 'arm');
  magazine.rotation.x = -0.16;
  meshes.push(receiver, barrel, magazine);

  const marker = MeshBuilder.CreateTorus(`ops-marker-${actor.id}`, { diameter: 1.2, thickness: 0.045, tessellation: 32 }, scene);
  marker.parent = root;
  marker.rotation.x = Math.PI / 2;
  marker.position.y = -0.67;
  marker.material = accent;
  marker.isPickable = false;

  return {
    root,
    meshes,
    marker,
    target: root.position.clone(),
    weapon,
    presentation: 'articulated-fallback',
  };
}

