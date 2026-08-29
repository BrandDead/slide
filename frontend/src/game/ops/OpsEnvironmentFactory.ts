import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { StandardMaterial as BabylonStandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { OpsImpactMetadata, RegisterOpsMaterial } from './OpsCharacterFactory';

function environmentMaterial(
  scene: Scene,
  name: string,
  diffuse: Color3,
  register: RegisterOpsMaterial,
  options: { specular?: Color3; emissive?: Color3; alpha?: number } = {},
): StandardMaterial {
  const result = new BabylonStandardMaterial(name, scene);
  result.diffuseColor = diffuse;
  result.specularColor = options.specular ?? new Color3(0.22, 0.24, 0.27);
  result.emissiveColor = options.emissive ?? Color3.Black();
  result.alpha = options.alpha ?? 1;
  register(result);
  return result;
}

function tag(mesh: AbstractMesh, metadata: OpsImpactMetadata): void {
  mesh.metadata = metadata;
  mesh.receiveShadows = true;
}

export function createDetailedSedan(
  scene: Scene,
  id: string,
  position: Vector3,
  rotationY: number,
  registerMaterial: RegisterOpsMaterial,
  bodyColor = new Color3(0.025, 0.035, 0.055),
): TransformNode {
  const root = new TransformNode(`ops-vehicle-${id}`, scene);
  root.position.copyFrom(position);
  root.rotation.y = rotationY;
  const metadata: OpsImpactMetadata = { impactKind: 'vehicle', entityId: id };

  const paint = environmentMaterial(scene, `${id}-paint`, bodyColor, registerMaterial, {
    specular: new Color3(0.78, 0.8, 0.85),
  });
  const trim = environmentMaterial(scene, `${id}-trim`, new Color3(0.015, 0.017, 0.02), registerMaterial, {
    specular: new Color3(0.35, 0.37, 0.4),
  });
  const glass = environmentMaterial(scene, `${id}-glass`, new Color3(0.015, 0.04, 0.06), registerMaterial, {
    specular: new Color3(0.82, 0.92, 1),
    alpha: 0.88,
  });
  const headlight = environmentMaterial(scene, `${id}-headlight`, new Color3(0.8, 0.76, 0.58), registerMaterial, {
    emissive: new Color3(0.7, 0.62, 0.35),
  });
  const taillight = environmentMaterial(scene, `${id}-taillight`, new Color3(0.55, 0.025, 0.02), registerMaterial, {
    emissive: new Color3(0.5, 0.01, 0.005),
  });

  const lower = MeshBuilder.CreateBox(`${id}-lower`, { width: 1.86, height: 0.52, depth: 4.35 }, scene);
  lower.parent = root;
  lower.position.y = 0.58;
  lower.material = paint;
  tag(lower, metadata);

  const hood = MeshBuilder.CreateBox(`${id}-hood`, { width: 1.72, height: 0.26, depth: 1.25 }, scene);
  hood.parent = root;
  hood.position.set(0, 0.91, 1.38);
  hood.rotation.x = -0.035;
  hood.material = paint;
  tag(hood, metadata);

  const trunk = MeshBuilder.CreateBox(`${id}-trunk`, { width: 1.7, height: 0.3, depth: 0.92 }, scene);
  trunk.parent = root;
  trunk.position.set(0, 0.86, -1.54);
  trunk.material = paint;
  tag(trunk, metadata);

  const cabin = MeshBuilder.CreateBox(`${id}-cabin`, { width: 1.55, height: 0.77, depth: 1.78 }, scene);
  cabin.parent = root;
  cabin.position.set(0, 1.21, -0.14);
  cabin.scaling.set(0.96, 1, 1);
  cabin.material = glass;
  tag(cabin, metadata);

  const roof = MeshBuilder.CreateBox(`${id}-roof`, { width: 1.42, height: 0.12, depth: 1.36 }, scene);
  roof.parent = root;
  roof.position.set(0, 1.62, -0.2);
  roof.material = paint;
  tag(roof, metadata);

  [-0.98, 0.98].forEach((xSign) => {
    [-1.34, 1.34].forEach((z) => {
      const wheel = MeshBuilder.CreateCylinder(`${id}-wheel-${xSign}-${z}`, { diameter: 0.66, height: 0.26, tessellation: 20 }, scene);
      wheel.parent = root;
      wheel.position.set(xSign * 0.78, 0.44, z);
      wheel.rotation.z = Math.PI / 2;
      wheel.material = trim;
      tag(wheel, metadata);
    });
  });

  [-0.55, 0.55].forEach((x) => {
    const lamp = MeshBuilder.CreateBox(`${id}-headlight-${x}`, { width: 0.38, height: 0.16, depth: 0.05 }, scene);
    lamp.parent = root;
    lamp.position.set(x, 0.79, 2.2);
    lamp.material = headlight;
    tag(lamp, metadata);
    const tail = MeshBuilder.CreateBox(`${id}-taillight-${x}`, { width: 0.34, height: 0.14, depth: 0.05 }, scene);
    tail.parent = root;
    tail.position.set(x, 0.76, -2.2);
    tail.material = taillight;
    tag(tail, metadata);
  });

  return root;
}

export function createConcretePlanter(
  scene: Scene,
  id: string,
  position: Vector3,
  registerMaterial: RegisterOpsMaterial,
  rotationY = 0,
): TransformNode {
  const root = new TransformNode(`ops-planter-${id}`, scene);
  root.position.copyFrom(position);
  root.rotation.y = rotationY;
  const concrete = environmentMaterial(scene, `${id}-concrete`, new Color3(0.19, 0.2, 0.2), registerMaterial, {
    specular: new Color3(0.3, 0.31, 0.32),
  });
  const soil = environmentMaterial(scene, `${id}-soil`, new Color3(0.055, 0.028, 0.018), registerMaterial);
  const foliage = environmentMaterial(scene, `${id}-foliage`, new Color3(0.025, 0.17, 0.09), registerMaterial, {
    specular: new Color3(0.12, 0.2, 0.14),
  });
  const coverMetadata: OpsImpactMetadata = { impactKind: 'cover', entityId: id };

  const base = MeshBuilder.CreateBox(`${id}-base`, { width: 2.45, height: 0.84, depth: 1.06 }, scene);
  base.parent = root;
  base.position.y = 0.42;
  base.material = concrete;
  tag(base, coverMetadata);

  const soilBed = MeshBuilder.CreateBox(`${id}-soil-bed`, { width: 2.14, height: 0.12, depth: 0.78 }, scene);
  soilBed.parent = root;
  soilBed.position.y = 0.88;
  soilBed.material = soil;
  tag(soilBed, coverMetadata);

  [-0.72, 0, 0.72].forEach((x, cluster) => {
    for (let leafIndex = 0; leafIndex < 5; leafIndex += 1) {
      const leaf = MeshBuilder.CreateBox(`${id}-leaf-${cluster}-${leafIndex}`, { width: 0.12, height: 0.66, depth: 0.24 }, scene);
      leaf.parent = root;
      leaf.position.set(x + (leafIndex - 2) * 0.045, 1.16, (leafIndex % 2 === 0 ? -1 : 1) * 0.16);
      leaf.rotation.z = (leafIndex - 2) * 0.19;
      leaf.rotation.x = (leafIndex % 2 === 0 ? -1 : 1) * 0.34;
      leaf.material = foliage;
      tag(leaf, { impactKind: 'environment', entityId: `${id}-foliage` });
    }
  });

  return root;
}

export function createPalmTree(
  scene: Scene,
  id: string,
  position: Vector3,
  registerMaterial: RegisterOpsMaterial,
  scale = 1,
): TransformNode {
  const root = new TransformNode(`ops-palm-${id}`, scene);
  root.position.copyFrom(position);
  root.scaling.setAll(scale);
  const bark = environmentMaterial(scene, `${id}-bark`, new Color3(0.18, 0.1, 0.05), registerMaterial);
  const frond = environmentMaterial(scene, `${id}-frond`, new Color3(0.018, 0.11, 0.055), registerMaterial);

  for (let index = 0; index < 4; index += 1) {
    const trunk = MeshBuilder.CreateCylinder(`${id}-trunk-${index}`, {
      height: 1.75,
      diameterTop: 0.3 - index * 0.025,
      diameterBottom: 0.42 - index * 0.025,
      tessellation: 8,
    }, scene);
    trunk.parent = root;
    trunk.position.set(Math.sin(index * 0.38) * 0.08, 0.88 + index * 1.7, 0);
    trunk.rotation.z = -0.035 * index;
    trunk.material = bark;
    tag(trunk, { impactKind: 'environment', entityId: id });
  }

  for (let index = 0; index < 9; index += 1) {
    const leaf = MeshBuilder.CreateBox(`${id}-frond-${index}`, { width: 0.22, height: 0.08, depth: 3.25 }, scene);
    leaf.parent = root;
    leaf.position.set(0.24, 6.65, 0);
    leaf.rotation.y = (Math.PI * 2 * index) / 9;
    leaf.rotation.x = -0.28 + (index % 2) * 0.12;
    leaf.material = frond;
    tag(leaf, { impactKind: 'environment', entityId: id });
  }

  return root;
}

export function createWetPuddle(
  scene: Scene,
  id: string,
  position: Vector3,
  registerMaterial: RegisterOpsMaterial,
  scale: Vector3,
): AbstractMesh {
  const puddle = MeshBuilder.CreateDisc(id, { radius: 1, tessellation: 28 }, scene);
  puddle.position.copyFrom(position);
  puddle.rotation.x = Math.PI / 2;
  puddle.scaling.copyFrom(scale);
  puddle.material = environmentMaterial(scene, `${id}-material`, new Color3(0.02, 0.055, 0.08), registerMaterial, {
    specular: new Color3(0.95, 0.98, 1),
    emissive: new Color3(0.006, 0.018, 0.03),
    alpha: 0.5,
  });
  puddle.isPickable = false;
  return puddle;
}
