import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigationStore, useGangStore } from '../../stores/gameStore';
import { useBlockStore } from '../../stores/blockStore';
import { getBlockResponseReadiness, useCombatIntentStore } from '../../stores/combatIntentStore';
import './AttackPlanner.css';

export const AttackPlanner: React.FC = () => {
  const { goBack, navigateTo } = useNavigationStore();
  const members = useGangStore(state => state.members);
  const { blocks, selectedBlockId, selectBlock } = useBlockStore();
  const ownedBlocks = Object.values(blocks).filter(block => block.owner === 'player');
  const [targetId, setTargetId] = useState(() =>
    ownedBlocks.find(block => block.id === selectedBlockId)?.id ?? ownedBlocks[0]?.id ?? '',
  );
  const block = blocks[targetId];
  const readiness = getBlockResponseReadiness(block, members);

  const handleLaunch = () => {
    // Read current ownership/roster at the command boundary, including two taps
    // in the same render. MAP independently validates when it consumes intent.
    if (useCombatIntentStore.getState().queueBlockResponse(targetId)) navigateTo('map');
  };

  return (
    <div className="attack-planner">
      <div className="ap-header">
        <motion.button type="button" className="back-btn" onClick={goBack} whileTap={{ scale: 0.9 }}>Back</motion.button>
        <h1>OPS PLAN</h1>
      </div>
      <div className="ap-content">
        <div className="ap-section">
          <h3>Respond on your block</h3>
          <p>Hold your territory with the crew already positioned there. This response is fought on foot.</p>
          <label htmlFor="response-block">Your block</label>
          <select id="response-block" value={targetId} onChange={event => setTargetId(event.target.value)} className="ap-select">
            {ownedBlocks.length === 0 && <option value="">Claim a block in MAP first</option>}
            {ownedBlocks.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.address}</option>)}
          </select>
        </div>
        <section className="ap-section" aria-label="Confirmed response crew">
          <h3>Crew on the block</h3>
          {readiness.crew.length === 0 && <p>No confirmed crew positions yet.</p>}
          <ul className="ap-crew-list">
            {readiness.crew.map(placement => (
              <li key={placement.memberId}>
                <div><strong>{placement.memberName}</strong><span>{placement.role} · Lv{placement.level}</span></div>
                <span>{placement.health} HP · {placement.zoneType}</span>
              </li>
            ))}
          </ul>
          <button type="button" className="ap-position" onClick={() => {
            if (block?.owner === 'player') selectBlock(block.id);
            navigateTo('map');
          }}>Position crew in MAP</button>
        </section>
        <section className="ap-section ap-intel" aria-label="Response briefing">
          <h3>Before you move</h3>
          {block && <p>Heat {block.heat}/5 · morale {block.morale}%</p>}
          <p className={`intel-text ${readiness.canLaunch ? 'text-green' : 'text-red'}`} role="status">{readiness.reason}</p>
          <p>Use cover, reach the secure exit, then return to see the consequences. Rival takeovers and vehicle attacks are separate operations.</p>
        </section>
        <button type="button" className={`launch-btn ${readiness.canLaunch ? '' : 'disabled'}`} onClick={handleLaunch} disabled={!readiness.canLaunch}>
          Launch response
        </button>
      </div>
    </div>
  );
};

export default AttackPlanner;
