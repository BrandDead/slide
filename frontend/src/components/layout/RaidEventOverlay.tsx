// ============================================================
// RaidEventOverlay — Full-screen raid event notification
// Triggered when heat exceeds threshold.
// Shows confiscation results and opens BailModal for arrested members.
// Sprint: morale-heat-photo-batch2
// ============================================================

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBlockStore } from '../../stores/blockStore';
import { usePlayerStore, useGangStore } from '../../stores/gameStore';
import {
  executeRaid,
  getRaidSeverity,
  type RaidResult,
} from '../../utils/heatSystem';
import BailModal, { type IncidentMember } from '../gang/BailModal';
import { soundManager } from '../../utils/SoundManager';
import './RaidEventOverlay.css';

interface RaidEventOverlayProps {
  blockId: string;
  onClose: () => void;
}

const SEVERITY_COLORS = {
  minor:   '#facc15',
  major:   '#f97316',
  federal: '#ef4444',
};

const SEVERITY_LABELS = {
  minor:   '🚔 Minor Raid',
  major:   '🚨 Major Raid',
  federal: '🏛️ Federal Raid',
};

const RaidEventOverlay: React.FC<RaidEventOverlayProps> = ({ blockId, onClose }) => {
  const { blocks, upsertBlock } = useBlockStore();
  const { player, updateMoney, updateHeat } = usePlayerStore();
  const { members } = useGangStore();

  const block = blocks[blockId];
  const [raidResult, setRaidResult] = useState<RaidResult | null>(null);
  // bail visibility is tracked via phase state
  const [_showBail] = useState(false);
  const [bailIncidents, setBailIncidents] = useState<IncidentMember[]>([]);
  const [phase, setPhase] = useState<'incoming' | 'result' | 'bail'>('incoming');

  const executeRaidNow = useCallback(() => {
    if (!block) return;

    const heat = block.heat * 20; // 0-5 → 0-100
    const memberIds = block.placements.map(p => p.memberId);
    const drugQty = 100; // TODO: wire to actual inventory
    const weaponCount = memberIds.length;
    const cashOnHand = player?.money ?? 0;

    const result = executeRaid(heat, memberIds, drugQty, weaponCount, cashOnHand);
    setRaidResult(result);
    setPhase('result');
    soundManager.play('alert_raid');

    // Apply consequences
    updateMoney(-result.confiscatedMoney);
    updateHeat(-result.heatReduction);
    upsertBlock({ ...block, heat: Math.max(0, block.heat - Math.round(result.heatReduction / 20)) });

    // Build bail incidents
    const incidents: IncidentMember[] = [];
    result.arrestedMembers.forEach(memberId => {
      const member = members.find(m => m.id === memberId);
      if (!member) return;
      const bailCost = result.bailCosts.get(memberId) ?? 5000;
      incidents.push({
        memberId,
        memberName: member.name,
        incidentType: 'jailed',
        cost: bailCost,
        blockId,
      });
    });

    if (incidents.length > 0) {
      setBailIncidents(incidents);
    }
  }, [block, player, members, updateMoney, updateHeat, upsertBlock, blockId]); // eslint-disable-line

  const severity = block ? getRaidSeverity(block.heat * 20) : 'minor';
  const severityColor = SEVERITY_COLORS[severity];

  return (
    <>
      <AnimatePresence>
        {phase === 'incoming' && (
          <motion.div
            className="raid-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="raid-incoming"
              initial={{ scale: 0.8, y: 40 }}
              animate={{ scale: 1, y: 0 }}
              style={{ borderColor: severityColor }}
            >
              <div className="raid-siren">🚨</div>
              <h2 className="raid-title" style={{ color: severityColor }}>
                {SEVERITY_LABELS[severity]}
              </h2>
              <p className="raid-desc">
                Cops are moving on your block. Stash what you can.
              </p>
              <div className="raid-heat-bar">
                <div
                  className="raid-heat-fill"
                  style={{ width: `${(block?.heat ?? 0) * 20}%`, background: severityColor }}
                />
              </div>
              <p className="raid-heat-label">Heat: {block?.heat ?? 0}/5</p>
              <motion.button
                className="raid-btn"
                style={{ background: severityColor }}
                onClick={executeRaidNow}
                whileTap={{ scale: 0.95 }}
              >
                Take the Hit
              </motion.button>
            </motion.div>
          </motion.div>
        )}

        {phase === 'result' && raidResult && (
          <motion.div
            className="raid-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="raid-result"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
            >
              <h2 className="raid-result-title">Raid Complete</h2>
              <p className="raid-severity" style={{ color: severityColor }}>
                {SEVERITY_LABELS[severity]}
              </p>

              <div className="raid-losses">
                <div className="loss-item">
                  <span className="loss-icon">💊</span>
                  <span className="loss-label">Product seized</span>
                  <span className="loss-val">{raidResult.confiscatedDrugs} units</span>
                </div>
                <div className="loss-item">
                  <span className="loss-icon">🔫</span>
                  <span className="loss-label">Weapons seized</span>
                  <span className="loss-val">{raidResult.confiscatedWeapons}</span>
                </div>
                <div className="loss-item">
                  <span className="loss-icon">💰</span>
                  <span className="loss-label">Cash seized</span>
                  <span className="loss-val red">${raidResult.confiscatedMoney.toLocaleString()}</span>
                </div>
                <div className="loss-item">
                  <span className="loss-icon">🔒</span>
                  <span className="loss-label">Arrested</span>
                  <span className="loss-val">{raidResult.arrestedMembers.length} members</span>
                </div>
              </div>

              <div className="raid-result-actions">
                {bailIncidents.length > 0 && (
                  <motion.button
                    className="raid-btn bail"
                    onClick={() => { setPhase('bail'); }}
                    whileTap={{ scale: 0.95 }}
                  >
                    🔒 Handle Bail ({bailIncidents.length})
                  </motion.button>
                )}
                <motion.button
                  className="raid-btn dismiss"
                  onClick={onClose}
                  whileTap={{ scale: 0.95 }}
                >
                  Close
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {phase === 'bail' && (
        <BailModal
          incidents={bailIncidents}
          onClose={() => {
            setPhase('result');
          }}
        />
      )}
    </>
  );
};

export default RaidEventOverlay;
