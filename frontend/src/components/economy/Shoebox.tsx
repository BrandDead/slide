// ============================================================
// Shoebox - Banking & Money Management
// Deposit/withdraw cash, view transaction history, earn interest
// ============================================================
import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigationStore, usePlayerStore, useEconomyStore } from '../../stores/gameStore';
import type { Transaction } from '../../types/game.types';
import { soundManager } from '../../utils/SoundManager';
import LaunderMoneyModal from './LaunderMoneyModal';
import './Shoebox.css';

type ModalMode = 'deposit' | 'withdraw' | null;

const formatMoney = (amount: number): string => {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  return `$${amount.toLocaleString()}`;
};

const formatTime = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
    ' ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const getTransactionDescription = (tx: Transaction): string => {
  const detailDescription = (tx.details as Record<string, unknown>)?.description;
  if (typeof detailDescription === 'string' && detailDescription.length > 0) {
    return detailDescription;
  }
  const legacyTx = tx as Transaction & { description?: string };
  return legacyTx.description || tx.type;
};

const getTransactionTime = (tx: Transaction): string => {
  if (tx.createdAt) return tx.createdAt;
  const legacyTx = tx as Transaction & { timestamp?: string };
  return legacyTx.timestamp || new Date().toISOString();
};

const Shoebox: React.FC = () => {
  const { goBack, navigateTo } = useNavigationStore();
  const { player, updateMoney, updatePlayer } = usePlayerStore();
  const { transactions, addTransaction } = useEconomyStore();

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [showLaunderModal, setShowLaunderModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const maxForMode = modalMode === 'deposit' ? player.money : player.bankBalance;

  const setQuickAmount = useCallback((pct: number) => {
    const val = Math.floor(maxForMode * pct);
    setAmount(val.toString());
    setError('');
  }, [maxForMode]);

  const handleConfirm = useCallback(() => {
    const val = parseInt(amount, 10);
    if (isNaN(val) || val <= 0) {
      setError('Enter a valid amount');
      return;
    }
    if (val > maxForMode) {
      setError(`Not enough ${modalMode === 'deposit' ? 'cash' : 'bank balance'}`);
      return;
    }

    if (modalMode === 'deposit') {
      updateMoney(-val);
      updatePlayer({ bankBalance: player.bankBalance + val });
      addTransaction({
        id: Date.now().toString(),
        type: 'purchase',
        userId: player.id,
        amount: -val,
        details: { action: 'deposit', description: `Deposited ${formatMoney(val)} into shoebox` },
        createdAt: new Date().toISOString(),
      });
    } else {
      updateMoney(val);
      updatePlayer({ bankBalance: player.bankBalance - val });
      addTransaction({
        id: Date.now().toString(),
        type: 'deal_income',
        userId: player.id,
        amount: val,
        details: { action: 'withdrawal', description: `Withdrew ${formatMoney(val)} from shoebox` },
        createdAt: new Date().toISOString(),
      });
    }

    soundManager.play('cash_register');
    setSuccessMsg(`${modalMode === 'deposit' ? 'Deposited' : 'Withdrew'} ${formatMoney(val)}`);
    setAmount('');
    setError('');
    setTimeout(() => {
      setSuccessMsg('');
      setModalMode(null);
    }, 1200);
  }, [amount, maxForMode, modalMode, player, updateMoney, updatePlayer, addTransaction]);

  return (
    <div className="shoebox-container">
      {/* Header */}
      <div className="shoebox-header">
        <motion.button className="back-btn" onClick={goBack} whileTap={{ scale: 0.9 }}>
          ← Back
        </motion.button>
        <h1>💰 SHOEBOX</h1>
        <div className="header-spacer" />
      </div>

      {/* Balance Cards */}
      <div className="balance-section">
        <div className="balance-card cash-card">
          <div className="balance-label">CASH ON HAND</div>
          <div className="balance-value cash">{formatMoney(player.money)}</div>
          <div className="balance-icon">💵</div>
        </div>
        <div className="balance-card bank-card">
          <div className="balance-label">IN THE SHOEBOX</div>
          <div className="balance-value bank">{formatMoney(player.bankBalance)}</div>
          <div className="balance-icon">📦</div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="action-buttons">
        <motion.button
          className="action-btn deposit-btn"
          onClick={() => { setModalMode('deposit'); setAmount(''); setError(''); }}
          whileTap={{ scale: 0.95 }}
        >
          ⬇️ Deposit
        </motion.button>
        <motion.button
          className="action-btn withdraw-btn"
          onClick={() => { setModalMode('withdraw'); setAmount(''); setError(''); }}
          whileTap={{ scale: 0.95 }}
        >
          ⬆️ Withdraw
        </motion.button>
        <motion.button
          className="action-btn launder-btn"
          onClick={() => setShowLaunderModal(true)}
          whileTap={{ scale: 0.95 }}
          style={{ gridColumn: '1 / -1', background: '#fbbf24', color: 'black', fontWeight: '900', marginTop: '10px' }}
        >
          💸 Launder Money
        </motion.button>
        <motion.button
          className="action-btn"
          onClick={() => navigateTo('cocaine_crush')}
          whileTap={{ scale: 0.95 }}
          style={{ gridColumn: '1 / -1', background: '#4ade80', color: 'black', fontWeight: '900', marginTop: '10px' }}
        >
          💊 Play Cocaine Crush
        </motion.button>
      </div>

      {/* Launder Money Modal */}
      {showLaunderModal && (
        <LaunderMoneyModal onClose={() => setShowLaunderModal(false)} />
      )}

      {/* Info Box */}
      <div className="info-box">
        <p>💡 Money in the shoebox is safe from raids and seizures. Cash on hand can be lost if you get busted.</p>
      </div>

      {/* Transaction History */}
      <div className="transaction-section">
        <h2>Transaction History</h2>
        <div className="transaction-list">
          {transactions.length === 0 ? (
            <div className="no-transactions">No transactions yet</div>
          ) : (
            transactions.slice(0, 30).map((tx, i) => {
              const desc = getTransactionDescription(tx);
              return (
                <div key={tx.id || i} className="transaction-item">
                  <div className="tx-left">
                    <div className="tx-icon">
                      {tx.amount >= 0 ? '📈' : '📉'}
                    </div>
                    <div className="tx-info">
                      <div className="tx-desc">{desc}</div>
                      <div className="tx-time">{formatTime(getTransactionTime(tx))}</div>
                    </div>
                  </div>
                  <div className={`tx-amount ${tx.amount >= 0 ? 'positive' : 'negative'}`}>
                    {tx.amount >= 0 ? '+' : ''}{formatMoney(Math.abs(tx.amount))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {modalMode && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setModalMode(null)}
          >
            <motion.div
              className="modal-content"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3>{modalMode === 'deposit' ? '⬇️ Deposit Cash' : '⬆️ Withdraw Cash'}</h3>
              <p className="modal-balance">
                Available: <span className="modal-avail">{formatMoney(maxForMode)}</span>
              </p>

              {successMsg ? (
                <div className="success-msg">✅ {successMsg}</div>
              ) : (
                <>
                  <div className="amount-input-group">
                    <span className="dollar-sign">$</span>
                    <input
                      type="number"
                      className="amount-input"
                      value={amount}
                      onChange={(e) => { setAmount(e.target.value); setError(''); }}
                      placeholder="0"
                      min="0"
                      max={maxForMode}
                    />
                  </div>

                  <div className="quick-amounts">
                    <button onClick={() => setQuickAmount(0.25)}>25%</button>
                    <button onClick={() => setQuickAmount(0.50)}>50%</button>
                    <button onClick={() => setQuickAmount(0.75)}>75%</button>
                    <button onClick={() => setQuickAmount(1.0)}>MAX</button>
                  </div>

                  {error && <div className="error-msg">{error}</div>}

                  <motion.button
                    className="confirm-btn"
                    onClick={handleConfirm}
                    whileTap={{ scale: 0.95 }}
                  >
                    Confirm {modalMode === 'deposit' ? 'Deposit' : 'Withdrawal'}
                  </motion.button>
                </>
              )}

              <button className="cancel-btn" onClick={() => setModalMode(null)}>Cancel</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Shoebox;
