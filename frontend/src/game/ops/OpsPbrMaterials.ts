import { Color3 } from '@babylonjs/core/Maths/math.color';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { Scene } from '@babylonjs/core/scene';

export type OpsPbrSurfaceId = 'asphalt033' | 'concrete034' | 'bricks097';

const PBR_ROOT = '/assets/packages/blocks/las-olas-1208/materials';

export function createOpsPbrMaterial(
  scene: Scene,
  surfaceId: OpsPbrSurfaceId,
  name: string,
  tiling: { u: number; v: number },
): PBRMaterial {
  const material = new PBRMaterial(name, scene);
  const albedo = new Texture(`${PBR_ROOT}/${surfaceId}-color.webp`, scene, true, false);
  const normal = new Texture(`${PBR_ROOT}/${surfaceId}-normal.webp`, scene, true, false);
  const roughness = new Texture(`${PBR_ROOT}/${surfaceId}-roughness.webp`, scene, true, false);
  [albedo, normal, roughness].forEach((texture) => {
    texture.uScale = tiling.u;
    texture.vScale = tiling.v;
  });

  material.albedoTexture = albedo;
  material.bumpTexture = normal;
  material.metallicTexture = roughness;
  material.metallic = 0;
  material.roughness = 0.88;
  material.useRoughnessFromMetallicTextureGreen = true;
  material.useMetallnessFromMetallicTextureBlue = false;
  material.useAmbientOcclusionFromMetallicTextureRed = false;
  material.invertNormalMapX = false;
  material.invertNormalMapY = false;
  material.environmentIntensity = surfaceId === 'asphalt033' ? 0.72 : 0.42;
  material.albedoColor = surfaceId === 'asphalt033'
    ? new Color3(0.2, 0.23, 0.27)
    : Color3.White();
  return material;
}
