import type { Engine } from '@babylonjs/core/Engines/engine';
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
