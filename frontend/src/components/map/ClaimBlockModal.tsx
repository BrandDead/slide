// ============================================================
// ClaimBlockModal — Address search + block claiming UI
// Uses the useBlockClaim hook to search and claim real addresses
// ============================================================
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBlockClaim } from '../../hooks/useBlockClaim';
import { usePlayerStore } from '../../stores/gameStore';
import './ClaimBlockModal.css';

interface ClaimBlockModalProps {
  onClose: () => void;
}

const CLAIM_COST = 5000;

const ClaimBlockModal: React.FC<ClaimBlockModalProps> = ({ onClose }) => {
  const { player, updateMoney } = usePlayerStore();
  const [{ searchQuery, suggestions, isSearching, preview, isClaiming, claimError, claimedBlock, selectedLocation },
         { setSearchQuery, selectSuggestion, claimBlock, reset }] = useBlockClaim(player.id ?? '');
  const [showSuccess, setShowSuccess] = useState(false);

  const canAfford = player.money >= CLAIM_COST;

  const handleClaim = async () => {
    if (!canAfford) return;
    await claimBlock(player.gangName ?? 'My Gang');
    if (!claimError) {
      updateMoney(-CLAIM_COST);
      setShowSuccess(true);
    }
  };

  const trafficColor = (score: number) => {
    if (score >= 70) return '#ef4444';
    if (score >= 40) return '#fbbf24';
    return '#4ade80';
  };

  return (
    <div className="cbm-overlay" onClick={onClose}>
      <motion.div
        className="cbm-modal"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.25 }}
      >
        <div className="cbm-header">
          <h2>🗺️ CLAIM A BLOCK</h2>
          <button className="cbm-close" onClick={onClose}>✕</button>
        </div>

        <AnimatePresence mode="wait">
          {showSuccess && claimedBlock ? (
            <motion.div
              key="success"
              className="cbm-success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="cbm-success-icon">✅</div>
              <h3>Block Claimed!</h3>
              <p className="cbm-address">{(claimedBlock as any).address}</p>
              <p className="cbm-cost-note">-${CLAIM_COST.toLocaleString()} deducted</p>
              <button className="cbm-btn" onClick={onClose}>DONE</button>
            </motion.div>
          ) : (
            <motion.div key="search" className="cbm-body">
              {/* Search Input */}
              <div className="cbm-search-wrap">
                <input
                  className="cbm-input"
                  type="text"
                  placeholder="Enter an address (e.g. 125th St, Harlem, NY)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
                {isSearching && <div className="cbm-spinner">⏳</div>}
              </div>

              {/* Suggestions */}
              {suggestions.length > 0 && !selectedLocation && (
                <ul className="cbm-suggestions">
                  {suggestions.map((s: any, i: number) => (
                    <li key={i} className="cbm-suggestion" onClick={() => selectSuggestion(s)}>
                      📍 {s.place_name}
                    </li>
                  ))}
                </ul>
              )}

              {/* Preview Card */}
              {preview && (
                <motion.div
                  className="cbm-preview"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="cbm-preview-address">{(preview as any).address}</div>
                  <div className="cbm-preview-stats">
                    <div className="cbm-stat">
                      <span className="cbm-stat-label">Traffic</span>
                      <div className="cbm-bar">
                        <div
                          className="cbm-bar-fill"
                          style={{
                            width: `${(preview as any).trafficScore ?? 50}%`,
                            background: trafficColor((preview as any).trafficScore ?? 50)
                          }}
                        />
                      </div>
                      <span className="cbm-stat-val">{(preview as any).trafficScore ?? 50}/100</span>
                    </div>
                    <div className="cbm-stat">
                      <span className="cbm-stat-label">Est. Income/tick</span>
                      <span className="cbm-stat-val green">
                        ${Math.round(((preview as any).trafficScore ?? 50) * 0.8 + 20)}
                      </span>
                    </div>
                    <div className="cbm-stat">
                      <span className="cbm-stat-label">Claim Cost</span>
                      <span className="cbm-stat-val gold">${CLAIM_COST.toLocaleString()}</span>
                    </div>
                  </div>

                  {claimError && <div className="cbm-error">{claimError}</div>}

                  {!canAfford && (
                    <div className="cbm-error">
                      Insufficient funds. Need ${CLAIM_COST.toLocaleString()}, have ${player.money.toLocaleString()}
                    </div>
                  )}

                  <button
                    className={`cbm-btn ${!canAfford || isClaiming ? 'disabled' : ''}`}
                    onClick={handleClaim}
                    disabled={!canAfford || isClaiming}
                  >
                    {isClaiming ? 'CLAIMING...' : `CLAIM THIS BLOCK ($${CLAIM_COST.toLocaleString()})`}
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default ClaimBlockModal;
