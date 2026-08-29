import { useEffect, useRef } from 'react';
import { Engine } from '@babylonjs/core/Engines/engine';
import type { EncounterPreparation } from '../../game/combat/types';
import type { CombatSessionController } from '../../game/combat/CombatSessionController';
import { createModernOpsScene } from '../../game/ops/createModernOpsScene';

interface ModernOpsCanvasProps {
  controller: CombatSessionController;
  preparation: EncounterPreparation;
  demo?: boolean;
  onReady?(): void;
  onError?(message: string): void;
}

export function ModernOpsCanvas({
  controller,
  preparation,
  demo = false,
  onReady,
  onError,
}: ModernOpsCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || mountedRef.current) return;
    mountedRef.current = true;

    let cancelled = false;
    let engine: Engine | null = null;
    let sceneHandle: Awaited<ReturnType<typeof createModernOpsScene>> | null = null;

    const resize = () => engine?.resize();

    void (async () => {
      try {
        engine = new Engine(canvas, true, {
          antialias: true,
          preserveDrawingBuffer: true,
          stencil: true,
          disableWebGL2Support: false,
        }, true);
        sceneHandle = await createModernOpsScene(engine, canvas, controller, preparation, { demo });
        if (cancelled) {
          sceneHandle.dispose();
          engine.dispose();
          return;
        }
        window.addEventListener('resize', resize);
        engine.runRenderLoop(() => sceneHandle?.scene.render());
        onReady?.();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        onError?.(message);
        sceneHandle?.dispose();
        engine?.dispose();
      }
    })();

    return () => {
      cancelled = true;
      window.removeEventListener('resize', resize);
      sceneHandle?.dispose();
      sceneHandle = null;
      engine?.stopRenderLoop();
      engine?.dispose();
      engine = null;
      mountedRef.current = false;
    };
  }, [controller, demo, onError, onReady, preparation]);

  return (
    <canvas
      ref={canvasRef}
      className="modern-ops-canvas"
      aria-label="Modern Ops tactical action scene"
      tabIndex={0}
    />
  );
}

export default ModernOpsCanvas;
