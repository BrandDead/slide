// ============================================================
// BailModal — Post-incident bail / hospital decision UI
// Shown after a drive-by resolves with casualties.
// Player chooses to pay bail / hospital bill or abandon the member.
// Declining reduces block morale via moraleSystem.
// Sprint: morale-heat-photo-batch2
// ============================================================

import React, { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBlockStore } from '../../stores/blockStore';
import { usePlayerStore, useGangStore } from '../../stores/gameStore';
import { calculateBailImpact, calculateHospitalImpact } from '../../utils/moraleSystem';
import './BailModal.css';

// ─── Types ───────────────────────────────────────────────────

export type IncidentType = 'jailed' | 'injured';

export interface IncidentMember {
  memberId: string;
  memberName: string;
  incidentType: IncidentType;
  cost: number;
  blockId: string;
}

interface BailModalProps {
  incidents: IncidentMember[];
  onClose: () => void;
}

// ─── Component ───────────────────────────────────────────────

const BailModal: React.FC<BailModalProps> = ({ incidents, onClose }) => {
  const { blocks, upsertBlock } = useBlockStore();
  const { player, updateMoney } = usePlayerStore();
  const { members, updateMember } = useGangStore();

  const gangSize = members.filter(m => m.status === 'active').length;

  const applyMoralePenalty = useCallback(
    (blockId: string, delta: number) => {
      const block = blocks[blockId];
      if (!block) return;
      const newMorale = Math.max(0, Math.min(100, (block.morale ?? 80) + delta));
      upsertBlock({ ...block, morale: newMorale });
    },
    [blocks, upsertBlock]
  );

  const handlePay = useCallback(
    (incident: IncidentMember) => {
      if ((player?.money ?? 0) < incident.cost) return;
      updateMoney(-incident.cost);
      // Update member status back to active
      updateMember(incident.memberId, {
        status: 'active',
      });
      // Morale bonus
      applyMoralePenalty(incident.blockId, incident.incidentType === 'jailed' ? 10 : 8);
    },
    [player, updateMoney, updateMember, applyMoralePenalty]
  );

  const handleAbandon = useCallback(
    (incident: IncidentMember) => {
      // Mark member as permanently jailed or dead
      updateMember(incident.memberId, {
        status: incident.incidentType === 'jailed' ? 'jailed' : 'dead',
      });
      // Morale penalty
      const impact =
        incident.incidentType === 'jailed'
          ? calculateBailImpact(gangSize, incident.memberName)
          : calculateHospitalImpact(gangSize, incident.memberName);
      applyMoralePenalty(incident.blockId, impact.moraleChange);
    },
    [updateMember, gangSize, applyMoralePenalty]
  );

  if (incidents.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="bail-modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bail-modal"
          initial={{ scale: 0.9, y: 40 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 40 }}
          onClick={e => e.stopPropagation()}
        >
          <div className="bm-header">
            <h2 className="bm-title">⚠️ Crew Down</h2>
            <p className="bm-subtitle">
              Your crew took casualties. Decide who you're riding for.
            </p>
          </div>

          <div className="bm-list">
            {incidents.map(incident => {
              const canAfford = (player?.money ?? 0) >= incident.cost;
              const label =
                incident.incidentType === 'jailed' ? '🔒 Bail Out' : '🏥 Pay Hospital';
              const abandonLabel =
                incident.incidentType === 'jailed' ? 'Leave in Jail' : 'Leave to Die';
              const warningMsg =
                incident.incidentType === 'jailed'
                  ? 'Abandoning will drop morale and he may snitch.'
                  : 'Abandoning will drop morale and he won\'t make it.';

              return (
                <div key={incident.memberId} className="bm-incident">
                  <div className="bm-member-info">
                    <span className="bm-member-icon">
                      {incident.incidentType === 'jailed' ? '🔒' : '🩸'}
                    </span>
                    <div>
                      <div className="bm-member-name">{incident.memberName}</div>
                      <div className="bm-member-status">
                        {incident.incidentType === 'jailed' ? 'Arrested' : 'Wounded'}
                      </div>
                    </div>
                    <div className="bm-cost">${incident.cost.toLocaleString()}</div>
                  </div>

                  <p className="bm-warning">{warningMsg}</p>

                  <div className="bm-actions">
                    <motion.button
                      className={`bm-btn pay ${!canAfford ? 'disabled' : ''}`}
                      onClick={() => canAfford && handlePay(incident)}
                      whileTap={canAfford ? { scale: 0.95 } : {}}
                      disabled={!canAfford}
                    >
                      {label} — ${incident.cost.toLocaleString()}
                      {!canAfford && <span className="bm-broke"> (Broke)</span>}
                    </motion.button>
                    <motion.button
                      className="bm-btn abandon"
                      onClick={() => handleAbandon(incident)}
                      whileTap={{ scale: 0.95 }}
                    >
                      {abandonLabel}
                    </motion.button>
                  </div>
                </div>
              );
            })}
          </div>

          <button className="bm-close" onClick={onClose}>Done</button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default BailModal;
