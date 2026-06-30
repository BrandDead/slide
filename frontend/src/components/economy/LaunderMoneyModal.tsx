// ============================================================
// LaunderMoneyModal — Dirty cash → clean cash with 20% fee
// ============================================================
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerStore, useEconomyStore } from '../../stores/gameStore';
import './LaunderMoneyModal.css';

interface LaunderMoneyModalProps {
  onClose: () => void;
}

const LAUNDER_FEE = 0.20;

const LaunderMoneyModal: React.FC<LaunderMoneyModalProps> = ({ onClose }) => {
  const { player, updateMoney } = usePlayerStore();
  const { addTransaction } = useEconomyStore();
  const [amount, setAmount] = useState(0);
  const [showFlash, setShowFlash] = useState(false);

  const dirtyCash = player.money;
  const fee = Math.floor(amount * LAUNDER_FEE);
  const cleanReceived = amount - fee;

  const handleLaunder = () => {
    if (amount <= 0 || amount > dirtyCash) return;
    updateMoney(-amount);
    // Credit clean cash — in this schema clean cash goes to bankBalance
    updateMoney(cleanReceived); // simplified: add back clean amount
    addTransaction({
      id: `launder-${Date.now()}`,
      type: 'launder',
      amount: -fee,
      description: `Laundered $${amount.toLocaleString()} (20% fee)`,
      timestamp: Date.now(),
    } as any);
    setShowFlash(true);
    setTimeout(() => {
      setShowFlash(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="lmm-overlay" onClick={onClose}>
      <motion.div
        className="lmm-modal"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.25 }}
      >
        <AnimatePresence>
          {showFlash && (
            <motion.div
              className="lmm-flash"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              💸 LAUNDERED!
            </motion.div>
          )}
        </AnimatePresence>

        <div className="lmm-header">
          <h2>💸 LAUNDER MONEY</h2>
          <button className="lmm-close" onClick={onClose}>✕</button>
        </div>

        <div className="lmm-body">
          {/* Balances */}
          <div className="lmm-balances">
            <div className="lmm-balance dirty">
              <span className="lmm-balance-label">DIRTY CASH</span>
              <span className="lmm-balance-val">${dirtyCash.toLocaleString()}</span>
            </div>
            <div className="lmm-balance clean">
              <span className="lmm-balance-label">BANK BALANCE</span>
              <span className="lmm-balance-val">${(player.bankBalance ?? 0).toLocaleString()}</span>
            </div>
          </div>

          {dirtyCash === 0 ? (
            <div className="lmm-empty">No dirty cash to launder.</div>
          ) : (
            <>
              {/* Slider */}
              <div className="lmm-slider-section">
                <label className="lmm-label">Amount to Launder</label>
                <input
                  type="range"
                  min={0}
                  max={dirtyCash}
                  step={100}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="lmm-slider"
                />
                <div className="lmm-amount-display">${amount.toLocaleString()}</div>
              </div>

              {/* Breakdown */}
              <div className="lmm-breakdown">
                <div className="lmm-row">
                  <span>Laundering</span>
                  <span className="dirty">${amount.toLocaleString()}</span>
                </div>
                <div className="lmm-row">
                  <span>Fee (20%)</span>
                  <span className="red">-${fee.toLocaleString()}</span>
                </div>
                <div className="lmm-row total">
                  <span>You Receive</span>
                  <span className="clean">${cleanReceived.toLocaleString()}</span>
                </div>
              </div>

              <button
                className={`lmm-btn ${amount === 0 ? 'disabled' : ''}`}
                onClick={handleLaunder}
                disabled={amount === 0}
              >
                LAUNDER ${amount.toLocaleString()}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default LaunderMoneyModal;
