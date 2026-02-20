// ============================================================
// BlockDetailPanel - Slide-up panel showing block details
// Shows stats, 8x8 grid preview, and action buttons
// ============================================================

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { BlockData } from './BlockOverlay';
import './BlockDetailPanel.css';

interface BlockDetailPanelProps {
  block: BlockData | null;
  onClose: () => void;
  onCollectIncome: (block: BlockData) => void;
  onDeployMember: (block: BlockData) => void;
  onStartSlide: (block: BlockData) => void;
  onClaimBlock?: (block: BlockData) => void;
}

const BlockDetailPanel: React.FC<BlockDetailPanelProps> = ({
  block,
  onClose,
  onCollectIncome,
  onDeployMember,
  onStartSlide,
  onClaimBlock,
}) => {
  if (!block) return null;

  const isPlayer = block.owner === 'player';
  const isUnclaimed = block.owner === 'unclaimed';
  const isNpc = block.owner === 'npc';

  return (
    <AnimatePresence>
      {block && (
        <motion.div
          className="block-detail-panel"
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          {/* Header */}
          <div className="panel-header">
            <div className="panel-handle" />
            <button className="panel-close" onClick={onClose}>✕</button>
          </div>

          {/* Block info */}
          <div className="panel-block-info">
            <span className={`owner-badge ${block.owner}`}>
              {isPlayer ? '🏠 YOUR BLOCK' : isNpc ? '⚔️ OPP BLOCK' : '🏘️ UNCLAIMED'}
            </span>
            <h3 className="panel-address">{block.address}</h3>
          </div>

          {/* Stats grid */}
          <div className="panel-stats">
            <div className="panel-stat">
              <span className="stat-icon">💰</span>
              <span className="stat-val">${block.income || 0}</span>
              <span className="stat-lbl">Income/hr</span>
            </div>
            <div className="panel-stat">
              <span className="stat-icon">🔥</span>
              <span className="stat-val">{block.heat || 0}</span>
              <span className="stat-lbl">Heat</span>
            </div>
            <div className="panel-stat">
              <span className="stat-icon">👥</span>
              <span className="stat-val">{block.members || 0}</span>
              <span className="stat-lbl">Members</span>
            </div>
          </div>

          {/* Mini grid preview (8x8 thumbnail) */}
          <div className="panel-grid-preview">
            {Array.from({ length: 8 }, (_, y) => (
              <div key={y} className="grid-preview-row">
                {Array.from({ length: 8 }, (_, x) => {
                  const isStreet = y === 0 || y === 7;
                  const hasMember = isPlayer && Math.random() < (block.members || 0) / 64;
                  return (
                    <div
                      key={x}
                      className={`grid-preview-cell ${isStreet ? 'street' : ''} ${hasMember ? 'has-member' : ''}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="panel-actions">
            {isPlayer && (
              <>
                <button className="panel-btn collect" onClick={() => onCollectIncome(block)}>
                  💰 Collect Income
                </button>
                <button className="panel-btn deploy" onClick={() => onDeployMember(block)}>
                  👥 Deploy Member
                </button>
              </>
            )}
            {isNpc && (
              <button className="panel-btn slide" onClick={() => onStartSlide(block)}>
                🚗 Slide On Them
              </button>
            )}
            {isUnclaimed && onClaimBlock && (
              <button className="panel-btn claim" onClick={() => onClaimBlock(block)}>
                🏴 Claim Block ($2,000)
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BlockDetailPanel;
