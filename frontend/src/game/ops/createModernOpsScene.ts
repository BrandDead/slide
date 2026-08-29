import type { Engine } from '@babylonjs/core/Engines/engine';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Scene } from '@babylonjs/core/scene';
import type { CombatSessionController } from '../combat/CombatSessionController';
import type { EncounterPreparation } from '../combat/types';
import { OpsWorld } from './OpsWorld';

export interface ModernOpsSceneOptions {
  demo?: boolean;
}

export interface ModernOpsSceneHandle {
  scene: Scene;
  dispose(): void;
}

export async function createModernOpsScene(
  engine: Engine,
  canvas: HTMLCanvasElement,
  controller: CombatSessionController,
  preparation: EncounterPreparation,
  options: ModernOpsSceneOptions = {},
): Promise<ModernOpsSceneHandle> {
  const scene = new Scene(engine);
  scene.imageProcessingConfiguration.contrast = 1.28;
  scene.imageProcessingConfiguration.exposure = 1.08;
  scene.imageProcessingConfiguration.toneMappingEnabled = true;
  scene.imageProcessingConfiguration.vignetteEnabled = true;
  scene.imageProcessingConfiguration.vignetteWeight = 2.2;
  scene.imageProcessingConfiguration.vignetteStretch = 0.25;
  scene.imageProcessingConfiguration.vignetteColor = new Color4(0.002, 0.008, 0.015, 1);
  const glow = new GlowLayer('ops-neon-glow', scene, { blurKernelSize: 32 });
  glow.intensity = 0.52;
  const world = new OpsWorld(scene, canvas, controller, preparation, options);

  await scene.whenReadyAsync();

  let disposed = false;
  return {
    scene,
    dispose() {
      if (disposed) return;
      disposed = true;
      world.dispose();
      scene.dispose();
    },
  };
}
