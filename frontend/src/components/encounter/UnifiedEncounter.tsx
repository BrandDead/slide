import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Phaser from 'phaser';
import type { BlockData } from '../../types/block.types';
import { createCombatSession, getCombatSnapshot } from '../../game/combat/combatSession';
import { prepareEncounter } from '../../game/combat/prepareEncounter';
import type { CombatResult, CombatSnapshot } from '../../game/combat/types';
import { UnifiedEncounterScene } from './UnifiedEncounterScene';
import './UnifiedEncounter.css';

interface UnifiedEncounterProps {
  block: BlockData;
  onResolved: (result: CombatResult) => void;
  onClose: () => void;
}

function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(media.matches);
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  return reducedMotion;
}

export const UnifiedEncounter: React.FC<UnifiedEncounterProps> = ({ block, onResolved, onClose }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<UnifiedEncounterScene | null>(null);
  const resolvedRef = useRef(false);
  const [preparation] = useState(() => prepareEncounter(block));
  const reducedMotion = useReducedMotion();
  const [snapshot, setSnapshot] = useState<CombatSnapshot>(() => getCombatSnapshot(createCombatSession(preparation)));
  const [result, setResult] = useState<CombatResult | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    resolvedRef.current = false;
    setError(null);

    try {
      const scene = new UnifiedEncounterScene();
      scene.configure(preparation, reducedMotion);
      sceneRef.current = scene;

      scene.whenReady(() => {
        if (cancelled) return;
        scene.events.on('snapshot', (next: CombatSnapshot) => setSnapshot(next));
        scene.events.on('combatResult', (next: CombatResult | null) => {
          if (next) setResult(next);
        });
        setIsReady(true);
      });

      const game = new Phaser.Game({
        type: Phaser.AUTO,
        width: 960,
        height: 600,
        parent: containerRef.current,
        backgroundColor: '#07111d',
        scene,
        banner: false,
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        render: { antialias: true, pixelArt: false, roundPixels: true },
        audio: { noAudio: true },
      });
      gameRef.current = game;
    } catch (encounterError) {
      setError(encounterError instanceof Error ? encounterError.message : String(encounterError));
    }

    return () => {
      cancelled = true;
      gameRef.current?.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
      setIsReady(false);
    };
  }, [preparation, reducedMotion]);

  const commitResult = () => {
    if (!result || resolvedRef.current) return;
    resolvedRef.current = true;
    onResolved(result);
  };

  const activeCrew = snapshot.combatants.filter((actor) => actor.team === 'crew' && !actor.isDown).length;
  const opposition = snapshot.combatants.filter((actor) => actor.team === 'opposition' && !actor.isDown).length;

  return createPortal(
    <section className="unified-encounter" aria-label="Tactical encounter">
      <header className="ue-briefing">
        <div>
          <span className="ue-kicker">TACTICAL BRIEF · FICTIONALIZED LOCAL REFERENCE</span>
          <h2>{preparation.sceneLabel}</h2>
          <p>{preparation.locationReference}</p>
        </div>
        <button type="button" className="ue-close" onClick={onClose} aria-label="Return to block planning">Return to planning</button>
      </header>

      <div className="ue-modifiers" aria-label="Encounter modifiers">
        {preparation.tacticalBrief.map((item) => <span key={item}>{item}</span>)}
      </div>

      <div className="ue-stage-shell">
        {!isReady && !error && <div className="ue-loading" role="status">Building your tactical scene…</div>}
        {error && (
          <div className="ue-loading ue-loading--error" role="alert">
            <strong>Encounter failed to load.</strong>
            <span>{error}</span>
            <button type="button" onClick={onClose}>Return to planning</button>
          </div>
        )}
        <div ref={containerRef} className={`ue-stage ${isReady ? 'ue-stage--ready' : ''}`} />
      </div>

      <div className="ue-controls" aria-label="Encounter actions">
        <div className="ue-live-stats">
          <span><strong>{activeCrew}</strong> crew active</span>
          <span><strong>{opposition}</strong> opposition visible</span>
          <span><strong>{snapshot.objective.progress}/{snapshot.objective.target}</strong> secure exits</span>
        </div>
        <div className="ue-action-row">
          <button type="button" disabled={!isReady || snapshot.phase !== 'active'} onClick={() => sceneRef.current?.fireNearestSelected()}>Fire nearest</button>
          <button type="button" disabled={!isReady || snapshot.phase !== 'active'} onClick={() => sceneRef.current?.reloadSelected()}>Reload</button>
          <button type="button" className="ue-extract" disabled={!isReady || snapshot.phase !== 'active'} onClick={() => sceneRef.current?.interactSelected()}>Secure exit</button>
          <button type="button" className="ue-retreat" disabled={!isReady || snapshot.phase !== 'active'} onClick={() => sceneRef.current?.retreatSelected()}>Retreat safely</button>
        </div>
      </div>

      <div className="ue-event-log" aria-live="polite" aria-label="Combat status">
        {snapshot.events.slice(-4).reverse().map((item) => <p key={item.id}>{item.message}</p>)}
        {snapshot.events.length === 0 && <p>Choose a crew member, use cover, and reach the highlighted secure exit.</p>}
      </div>

      {result && (
        <div className="ue-result" role="dialog" aria-modal="true" aria-label="Encounter result">
          <span className={`ue-result__badge outcome-${result.outcome}`}>{result.outcome.toUpperCase()}</span>
          <h3>{result.summary}</h3>
          <p>{result.oppositionDown.length} opposition down · {result.crewDown.length} crew needing recovery · heat {result.heatDelta >= 0 ? '+' : ''}{result.heatDelta}</p>
          <button type="button" onClick={commitResult}>Apply result and return</button>
        </div>
      )}
    </section>,
    document.body,
  );
};

export default UnifiedEncounter;
