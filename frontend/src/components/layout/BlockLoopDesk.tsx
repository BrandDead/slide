import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import UnifiedEncounter from '../encounter/UnifiedEncounter';
import TacticalDiorama from '../map/TacticalDiorama';
import { useNavigationStore, useGangStore } from '../../stores/gameStore';
import { useBlockStore } from '../../stores/blockStore';
import { useBlockLoopStore } from '../../stores/blockLoopStore';
import { streetVsSafetyPreview } from '../../game/loop/placementRules';
import { BLOCK_LOOP_IDS } from '../../game/loop/blockLoopTypes';
import type { LoopPhase } from '../../game/loop/blockLoopTypes';
import './BlockLoopDesk.css';

const PHASES: { id: LoopPhase; label: string }[] = [
  { id: 'crew', label: 'Crew' },
  { id: 'placement', label: 'Place' },
  { id: 'product', label: 'Product' },
  { id: 'deal', label: 'Deal' },
  { id: 'threat', label: 'Threat' },
  { id: 'encounter', label: 'Slide' },
  { id: 'consequence', label: 'Hit' },
  { id: 'returned', label: 'Return' },
];

const BlockLoopDesk: React.FC = () => {
  const { goHome, navigateTo } = useNavigationStore();
  const { members } = useGangStore();
  const selectBlock = useBlockStore((state) => state.selectBlock);
  const {
    loop,
    started,
    startLoop,
    selectCrew,
    place,
    assignProduct,
    runDeal,
    beginEncounter,
    resolveEncounter,
    resolveSeededEncounter,
    retryHealth,
    recover,
    returnToDesktop,
  } = useBlockLoopStore();
  const [placingId, setPlacingId] = useState<string>(BLOCK_LOOP_IDS.dealerId);

  React.useEffect(() => {
    if (!started) startLoop();
  }, [started, startLoop]);

  const preview = useMemo(
    () => streetVsSafetyPreview(loop.block, loop.members[0]?.level ?? 2),
    [loop.block, loop.members],
  );
  const dealer = loop.members.find((member) => member.id === (loop.selectedDealerId ?? BLOCK_LOOP_IDS.dealerId));
  const shooter = loop.members.find((member) => member.id === (loop.selectedShooterId ?? BLOCK_LOOP_IDS.shooterId));
  const product = loop.inventory[0];

  return (
    <div className="block-loop-desk">
      <header className="bld-top">
        <button type="button" className="bld-back" onClick={goHome}>Desktop</button>
        <div>
          <p className="bld-kicker">Las Olas closed-beta path</p>
          <h1>1208 Las Olas</h1>
        </div>
        <p className="bld-dna">DNA {loop.dnaId}</p>
      </header>

      <section className="bld-strip" aria-label="Empire state">
        <div><span>Dealer</span><strong>{dealer ? `${dealer.name} · ${dealer.health} hp` : '—'}</strong></div>
        <div><span>Shooter</span><strong>{shooter ? `${shooter.name} · ${shooter.health} hp` : '—'}</strong></div>
        <div><span>Product</span><strong>{product ? `${product.name} ×${product.quantity}` : 'None'}</strong></div>
        <div><span>Cash</span><strong>${loop.money.toLocaleString()}</strong></div>
        <div><span>Heat</span><strong>{loop.playerHeat}</strong></div>
        <div><span>Threat</span><strong>{loop.threat?.route?.toUpperCase() ?? 'QUIET'}</strong></div>
      </section>

      <ol className="bld-phases">
        {PHASES.map((phase) => (
          <li key={phase.id} className={loop.phase === phase.id ? 'is-current' : ''}>{phase.label}</li>
        ))}
      </ol>

      <p className="bld-map-fallback">{loop.mapFallbackNotice}</p>

      {loop.rejection && <p className="bld-reject" role="alert">{loop.rejection}</p>}

      <div className="bld-briefing" aria-live="polite">
        {loop.briefing.map((line) => <p key={line}>{line}</p>)}
      </div>

      {loop.phase === 'crew' && (
        <section className="bld-panel">
          <h2>Select the crew</h2>
          <div className="bld-crew">
            {[dealer, shooter].map((member) => member && (
              <article key={member.id}>
                <p className="bld-role">{member.role}</p>
                <h3>{member.name}</h3>
                <p>Lv{member.level} · morale {member.morale} · health {member.health}</p>
                <p>{member.equipment} · {member.assignment}</p>
              </article>
            ))}
          </div>
          <button type="button" className="bld-cta" data-testid="lock-las-olas-crew" onClick={() => selectCrew(BLOCK_LOOP_IDS.dealerId, BLOCK_LOOP_IDS.shooterId)}>
            Lock Dre and Rome
          </button>
          <div className="bld-routes">
            <button type="button" onClick={() => navigateTo('contacts')}>Open Contacts</button>
            <button type="button" onClick={() => navigateTo('gang_hq')}>Open Crew</button>
          </div>
        </section>
      )}

      {(loop.phase === 'placement' || loop.phase === 'product' || loop.phase === 'deal') && (
        <section className="bld-panel">
          <div className="bld-place-head">
            <h2>1208 Las Olas diorama</h2>
            <div className="bld-place-switch" role="group" aria-label="Member to place">
              <button type="button" className={placingId === BLOCK_LOOP_IDS.dealerId ? 'is-on' : ''} onClick={() => setPlacingId(BLOCK_LOOP_IDS.dealerId)}>Dealer</button>
              <button type="button" className={placingId === BLOCK_LOOP_IDS.shooterId ? 'is-on' : ''} onClick={() => setPlacingId(BLOCK_LOOP_IDS.shooterId)}>Shooter</button>
            </div>
          </div>
          <p className="bld-compare">{preview.explanation}</p>
          <TacticalDiorama
            block={loop.block}
            mapContext={{ status: 'missing', reason: 'STRIP desk does not load street tiles' }}
            placingMemberId={placingId}
            placingMemberName={placingId === BLOCK_LOOP_IDS.dealerId ? dealer?.name : shooter?.name}
            onPlace={(col, row) => place(placingId, col, row)}
          />
          <div className="bld-routes">
            <button type="button" data-testid="open-map-diorama" onClick={() => { selectBlock(loop.block.id); navigateTo('map'); }}>Open MAP diorama</button>
            <button type="button" data-testid="place-street-dre" onClick={() => place(BLOCK_LOOP_IDS.dealerId, preview.street.x, preview.street.y)}>Street-near Dre</button>
            <button type="button" onClick={() => place(BLOCK_LOOP_IDS.dealerId, preview.safety.x, preview.safety.y)}>Safer Dre</button>
          </div>
        </section>
      )}

      {loop.phase === 'product' && product && (
        <section className="bld-panel">
          <h2>Equip product</h2>
          <p>{product.name} · {product.tier} · potency {product.quality} · qty {product.quantity}</p>
          <p>Expected demand follows street exposure. Heat risk uses the street-tier table. Nothing here is a real-world recipe.</p>
          <button type="button" className="bld-cta" data-testid="assign-river-cut" onClick={assignProduct}>Put River Cut on Dre</button>
          <button type="button" onClick={() => navigateTo('alchemy')}>Open Cook</button>
        </section>
      )}

      {loop.phase === 'deal' && (
        <section className="bld-panel">
          <h2>Run the deal</h2>
          <p>The receipt writes cash, product, reputation, and heat through the shared empire books.</p>
          <button type="button" className="bld-cta" data-testid="close-the-deal" onClick={runDeal}>Close the deal</button>
          <button type="button" onClick={() => navigateTo('dealt_v2')}>Open DEALT</button>
        </section>
      )}

      {loop.phase === 'threat' && loop.lastDeal && (
        <section className="bld-panel">
          <h2>Threat handoff</h2>
          <p className="bld-receipt">{loop.lastDeal.explanation}</p>
          <p>{loop.threat?.reason}</p>
          <button type="button" className="bld-cta" data-testid="enter-slide" onClick={beginEncounter}>
            Enter {loop.threat?.route === 'raid' ? 'raid' : 'SLIDE'}
          </button>
        </section>
      )}

      {loop.phase === 'encounter' && (
        <section className="bld-panel bld-encounter">
          <h2>{loop.threat?.route === 'raid' ? 'Raid' : 'SLIDE'} on this DNA board</h2>
          <p>UnifiedEncounter is running on {loop.dnaId} with the placed crew and loadout. Map tiles are optional.</p>
          <UnifiedEncounter
              block={loop.block}
              onResolved={(result) => resolveEncounter(result)}
              onClose={() => resolveSeededEncounter()}
            />
          {typeof document !== 'undefined' && createPortal(
            <div className="bld-wound-dock" role="region" aria-label="Hospital and wound booking">
              <div>
                <p className="bld-wound-kicker">Exact-once demo hit</p>
                <p>Books Dre's wound on this DNA board. Replaying the same ticket does nothing.</p>
              </div>
              <button type="button" className="bld-cta" data-testid="book-the-wound" onClick={resolveSeededEncounter}>
                Book the wound
              </button>
            </div>,
            document.body,
          )}
        </section>
      )}

      {loop.phase === 'consequence' && (
        <section className="bld-panel">
          <h2>Consequence</h2>
          {loop.pendingHealthIds.length > 0 && (
            <button type="button" onClick={retryHealth}>Retry health write</button>
          )}
          {loop.recovery && (
            <div className="bld-recovery">
              <p>{loop.recovery.affordable ? `Hospital ${loop.recovery.memberName} for $${loop.recovery.cost}.` : loop.recovery.unpaidLabel}</p>
              <button type="button" className="bld-cta" onClick={() => recover(true)} disabled={!loop.recovery.affordable}>
                Pay hospital
              </button>
              <button type="button" onClick={() => recover(false)}>Rest it off</button>
            </div>
          )}
          <button type="button" className="bld-cta" onClick={() => { returnToDesktop(); goHome(); }}>
            Return to desktop
          </button>
        </section>
      )}

      {loop.phase === 'returned' && (
        <section className="bld-panel">
          <h2>Return briefing</h2>
          <button type="button" className="bld-cta" onClick={goHome}>Back to the command desk</button>
        </section>
      )}

      <p className="bld-roster-note">
        {members.filter((member) => member.id === BLOCK_LOOP_IDS.dealerId || member.id === BLOCK_LOOP_IDS.shooterId).map((member) => member.name).join(' · ') || 'Demo crew loads from Contacts.'}
      </p>
    </div>
  );
};

export default BlockLoopDesk;
