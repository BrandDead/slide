import { createPortal } from 'react-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { BlockData } from '../../types/block.types';
import type { ActionCameraMode, CombatControllerState } from '../../game/combat/CombatSessionController';
import { CombatSessionController } from '../../game/combat/CombatSessionController';
import { prepareEncounter } from '../../game/combat/prepareEncounter';
import type { CombatResult } from '../../game/combat/types';
import ModernOpsCanvas from './ModernOpsCanvas';
import './ModernOpsEncounter.css';

interface ModernOpsEncounterProps {
  block: BlockData;
  onResolved(result: CombatResult): void;
  onClose(): void;
}

function initialCameraMode(): ActionCameraMode {
  if (typeof window === 'undefined') return 'third-person';
  const requested = new URLSearchParams(window.location.search).get('camera');
  if (requested === 'tactical' || requested === 'first-person' || requested === 'third-person') return requested;
  return 'third-person';
}

export function ModernOpsEncounter({ block, onResolved, onClose }: ModernOpsEncounterProps) {
  const [preparation] = useState(() => prepareEncounter(block));
  const [controller] = useState(() => new CombatSessionController(preparation, initialCameraMode()));
  const [state, setState] = useState<CombatControllerState>(() => controller.getState());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolvedRef = useRef(false);
  const demo = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo');

  useEffect(() => {
    const unsubscribe = controller.subscribe(setState);
    return () => {
      unsubscribe();
      controller.dispose();
    };
  }, [controller]);

  const handleReady = useCallback(() => setReady(true), []);
  const handleError = useCallback((message: string) => setError(message), []);

  const result = state.snapshot.result;
  const healthRatio = state.hud.maxHealth > 0 ? state.hud.health / state.hud.maxHealth : 0;
  const cameraLabel = state.hud.cameraMode.replace('-', ' ').toUpperCase();

  const commitResult = () => {
    if (!result || resolvedRef.current) return;
    resolvedRef.current = true;
    onResolved(result);
  };

  const setCamera = (mode: ActionCameraMode) => {
    controller.setCameraMode(mode);
  };

  return createPortal(
    <section className="modern-ops" aria-label="Modern Ops encounter">
      <header className="modern-ops__topbar">
        <div>
          <span className="modern-ops__kicker">MODERN OPS · FICTIONALIZED LOCAL REFERENCE</span>
          <h2>{preparation.sceneLabel}</h2>
          <p>{preparation.locationReference}</p>
        </div>
        <div className="modern-ops__top-actions">
          <button type="button" onClick={() => controller.setPaused(!controller.isPaused())}>
            {state.hud.paused ? 'Resume' : 'Pause'}
          </button>
          <button type="button" className="modern-ops__return" onClick={onClose}>Return to planning</button>
        </div>
      </header>

      <div className="modern-ops__stage">
        <ModernOpsCanvas
          controller={controller}
          preparation={preparation}
          demo={demo}
          onReady={handleReady}
          onError={handleError}
        />

        {!ready && !error && <div className="modern-ops__loading">Building Modern Ops scene…</div>}
        {error && (
          <div className="modern-ops__error" role="alert">
            <strong>Modern Ops could not start.</strong>
            <span>{error}</span>
            <button type="button" onClick={onClose}>Return to tactical planning</button>
          </div>
        )}

        <div className="ops-objective-card">
          <span>OBJECTIVE</span>
          <strong>{state.snapshot.objective.label}</strong>
          <p>Secure exits {state.hud.objectiveProgress}/{state.hud.objectiveTarget}</p>
        </div>

        <div className="ops-rival-bar" aria-label={`${state.hud.activeOpposition} opposition active`}>
          <span>RIVAL PRESENCE</span>
          <div><i style={{ width: `${Math.min(100, state.hud.activeOpposition * 32)}%` }} /></div>
        </div>

        {state.hud.cameraMode !== 'tactical' && <div className="ops-crosshair" aria-hidden="true"><i /><b /></div>}

        <div className="ops-vitals">
          <span>{state.hud.controlMode === 'commander' ? 'COMMANDING' : 'POSSESSED'} · {state.hud.selectedName}</span>
          <div className="ops-member-switch" aria-label="Selected crew member">
            <button type="button" onClick={() => controller.cycleSelectedCrew(-1)} aria-label="Previous living crew member">‹</button>
            <strong>{state.hud.selectedName}</strong>
            <button type="button" onClick={() => controller.cycleSelectedCrew(1)} aria-label="Next living crew member">›</button>
          </div>
          <div className="ops-meter"><i style={{ width: `${Math.max(0, healthRatio * 100)}%` }} /></div>
          <small>{state.hud.health}/{state.hud.maxHealth} HEALTH · {state.hud.activeCrew} CREW ACTIVE</small>
        </div>

        <div className="ops-status" aria-live="polite">{state.hud.latestMessage}</div>

        <div className="ops-camera-switcher" aria-label="Camera mode">
          {(['tactical', 'first-person', 'third-person'] as ActionCameraMode[]).map((mode) => (
            <button
              type="button"
              key={mode}
              className={state.hud.cameraMode === mode ? 'active' : ''}
              onClick={() => setCamera(mode)}
            >
              {mode === 'tactical' ? 'TAC' : mode === 'first-person' ? 'FPS' : 'TPS'}
            </button>
          ))}
        </div>

        <div className="ops-ammo">
          <strong>{state.hud.ammo}</strong><span>/ {state.hud.maxAmmo}</span>
          <small>{cameraLabel}</small>
        </div>

        <div className="ops-controls">WASD MOVE · CLICK/SPACE FIRE · R RELOAD · V CAMERA · [ / ] MEMBER · E EXTRACT · Q RETREAT</div>

        {state.hud.paused && !result && (
          <div className="ops-paused" role="dialog" aria-modal="true">
            <span>TACTICAL PAUSE</span>
            <strong>The encounter state is frozen.</strong>
            <button type="button" onClick={() => controller.setPaused(false)}>Resume operation</button>
          </div>
        )}

        {result && (
          <div className="ops-result" role="dialog" aria-modal="true" aria-label="Modern Ops result">
            <span className={`ops-result__badge outcome-${result.outcome}`}>{result.outcome.toUpperCase()}</span>
            <h3>{result.summary}</h3>
            <p>{result.oppositionDown.length} opposition down · {result.crewDown.length} crew injured · heat {result.heatDelta >= 0 ? '+' : ''}{result.heatDelta}</p>
            <button type="button" onClick={commitResult}>Apply result to the block</button>
          </div>
        )}
      </div>
    </section>,
    document.body,
  );
}

export default ModernOpsEncounter;
