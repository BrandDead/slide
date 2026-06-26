// ============================================================
// DEALT Mode - Tinder-Style Drug Dealing
// ============================================================

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { useNavigationStore, usePlayerStore, useDealtStore, useEconomyStore } from '../../stores/gameStore';
import { useTutorialProgressStore } from '../../stores/tutorialProgressStore';
import { generateClient, resolveDeal } from '../../utils/dealtEngine';
import type { Client, DealOutcome } from '../../types/game.types';
import { soundManager } from '../../utils/SoundManager';
import './DealtMode.css';

const formatMoney = (amount: number): string => {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  return `$${amount.toLocaleString()}`;
};

const DealtMode: React.FC = () => {
  const { goBack } = useNavigationStore();
  const { player, updateMoney, updateHeat, addXP } = usePlayerStore();
  const { streak, completeDeal } = useDealtStore();
  const { inventory, removeInventoryItem, addTransaction } = useEconomyStore();
  const { completeStep: completeTutorialStep } = useTutorialProgressStore();

  const [currentClient, setCurrentClient] = useState<Client | null>(null);
  const [currentOutcome, setCurrentOutcome] = useState<DealOutcome | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const acceptOpacity = useTransform(x, [0, 100], [0, 1]);
  const rejectOpacity = useTransform(x, [-100, 0], [1, 0]);

  useEffect(() => {
    if (!currentClient && !currentOutcome) {
      generateNewClient();
    }
  }, []);

  const generateNewClient = () => {
    const client = generateClient(player.heat, player.level);
    setCurrentClient(client);
    setCurrentOutcome(null);
  };

  const handleDeal = async (accepted: boolean) => {
    if (!currentClient || isAnimating) return;
    setIsAnimating(true);
    soundManager.play(accepted ? 'deal_accept' : 'deal_reject');

    if (accepted) {
      // Check if player has the drug
      const drugItem = inventory.find(
        (i) => i.itemId === currentClient.requestedDrug && i.quantity >= currentClient.requestedAmount
      );

      if (!drugItem) {
        setCurrentOutcome({
          success: false,
          type: 'refused',
          message: `You don't have enough ${currentClient.requestedDrug}!`,
          moneyChange: 0,
          heatChange: 2,
          xpGained: 0,
          streakBonus: 0,
        });
        setTimeout(() => {
          setIsAnimating(false);
          generateNewClient();
        }, 2000);
        return;
      }

      // Resolve the deal
      const outcome = resolveDeal(currentClient, player.heat, streak);

      // Apply outcome
      if (outcome.success) {
        updateMoney(outcome.moneyChange);
        removeInventoryItem(currentClient.requestedDrug, currentClient.requestedAmount);
        addTransaction({
          id: Date.now().toString(),
          type: 'deal',
          amount: outcome.moneyChange,
          description: `Sold ${currentClient.requestedAmount}x ${currentClient.requestedDrug} to ${currentClient.name}`,
          category: 'dealing',
          timestamp: new Date().toISOString(),
        });
      }

      updateHeat(outcome.heatChange);
      addXP(outcome.xpGained);
      completeDeal(outcome);
      setCurrentOutcome(outcome);
      // Tutorial: first deal made
      if (outcome.success) completeTutorialStep('first_deal_made');
    } else {
      // Rejected the deal
      updateHeat(1);
      completeDeal({
        success: false,
        type: 'refused',
        message: 'You passed on this one.',
        moneyChange: 0,
        heatChange: 1,
        xpGained: 5,
        streakBonus: 0,
      });
    }

    setTimeout(() => {
      setIsAnimating(false);
      generateNewClient();
    }, 2500);
  };

  const handleDragEnd = (_: any, info: { offset: { x: number }; velocity: { x: number } }) => {
    const threshold = 100;
    const velocity = info.velocity.x;

    if (info.offset.x > threshold || velocity > 500) {
      handleDeal(true);
    } else if (info.offset.x < -threshold || velocity < -500) {
      handleDeal(false);
    }
  };

  const getRiskColor = (risk: string): string => {
    switch (risk) {
      case 'low': return '#00ff88';
      case 'medium': return '#ffd700';
      case 'high': return '#ff4444';
      case 'extreme': return '#ff0066';
      default: return '#888888';
    }
  };

  return (
    <div className="dealt-mode">
      {/* Header */}
      <div className="dealt-header">
        <motion.button className="back-button" onClick={goBack} whileTap={{ scale: 0.9 }}>
          ← Back
        </motion.button>
        <div className="dealt-title">
          <span className="title-icon">💊</span>
          <span className="title-text">DEALT</span>
        </div>
        <div className="heat-display">
          <span className="heat-icon">🔥</span>
          <span className="heat-value">{player.heat}%</span>
        </div>
      </div>

      {/* Streak Display */}
      {streak > 0 && (
        <motion.div className="streak-display" initial={{ scale: 0 }} animate={{ scale: 1 }} key={streak}>
          <span className="streak-flames">🔥</span>
          <span className="streak-count">{streak}</span>
          <span className="streak-label">STREAK</span>
        </motion.div>
      )}

      {/* Card Stack */}
      <div className="card-container">
        <AnimatePresence mode="wait">
          {currentClient && !currentOutcome && (
            <motion.div
              className="client-card"
              key={currentClient.id}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              style={{ x, rotate }}
              onDragEnd={handleDragEnd}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              {/* Swipe Indicators */}
              <motion.div className="swipe-indicator accept" style={{ opacity: acceptOpacity }}>
                ✓ DEAL
              </motion.div>
              <motion.div className="swipe-indicator reject" style={{ opacity: rejectOpacity }}>
                ✗ PASS
              </motion.div>

              {/* Client Avatar */}
              <div className="client-avatar">
                <span className="avatar-emoji">{currentClient.avatar}</span>
              </div>

              {/* Client Info */}
              <div className="client-info">
                <h2 className="client-name">{currentClient.name}</h2>
                <p className="client-type">{currentClient.type.replace('_', ' ').toUpperCase()}</p>
                <p className="client-description">{currentClient.description}</p>
              </div>

              {/* Deal Details */}
              <div className="deal-details">
                <div className="deal-item">
                  <span className="deal-label">Wants</span>
                  <span className="deal-value drug">
                    {currentClient.requestedAmount}x {currentClient.requestedDrug}
                  </span>
                </div>
                <div className="deal-item">
                  <span className="deal-label">Offering</span>
                  <span className="deal-value money">{formatMoney(currentClient.offerPrice)}</span>
                </div>
                <div className="deal-item">
                  <span className="deal-label">Market Value</span>
                  <span className="deal-value market">{formatMoney(currentClient.marketPrice)}</span>
                </div>
              </div>

              {/* Risk Indicator */}
              <div className="risk-indicator" style={{ borderColor: getRiskColor(currentClient.riskLevel) }}>
                <span className="risk-label">RISK</span>
                <span className="risk-value" style={{ color: getRiskColor(currentClient.riskLevel) }}>
                  {currentClient.riskLevel.toUpperCase()}
                </span>
              </div>

              {/* Red Flags */}
              {currentClient.redFlags.length > 0 && (
                <div className="red-flags">
                  <span className="flags-label">⚠️ Red Flags:</span>
                  {currentClient.redFlags.map((flag, index) => (
                    <span key={index} className="flag-item">{flag}</span>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Outcome Display */}
          {currentOutcome && (
            <motion.div
              className={`outcome-display ${currentOutcome.success ? 'success' : 'failure'}`}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
            >
              <div className="outcome-icon">
                {currentOutcome.success ? '✅' :
                  currentOutcome.type === 'undercover' ? '👮' :
                  currentOutcome.type === 'robbery' ? '🔫' :
                  currentOutcome.type === 'snitch' ? '🐀' :
                  currentOutcome.type === 'overdose' ? '💀' : '❌'}
              </div>
              <h2 className="outcome-title">
                {currentOutcome.success ? 'DEAL COMPLETE' : 'DEAL FAILED'}
              </h2>
              <p className="outcome-message">{currentOutcome.message}</p>

              <div className="outcome-stats">
                <div className={`outcome-stat ${currentOutcome.moneyChange >= 0 ? 'positive' : 'negative'}`}>
                  {currentOutcome.moneyChange >= 0 ? '+' : ''}{formatMoney(currentOutcome.moneyChange)}
                </div>
                {currentOutcome.heatChange > 0 && (
                  <div className="outcome-stat heat">+{currentOutcome.heatChange} 🔥</div>
                )}
                {currentOutcome.xpGained > 0 && (
                  <div className="outcome-stat xp">+{currentOutcome.xpGained} XP</div>
                )}
                {currentOutcome.streakBonus > 0 && (
                  <div className="outcome-stat streak">+{Math.round(currentOutcome.streakBonus * 100)}% BONUS</div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Action Buttons */}
      <div className="action-buttons">
        <motion.button
          className="action-btn reject-btn"
          onClick={() => handleDeal(false)}
          disabled={isAnimating || !currentClient}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <span className="btn-icon">✗</span>
          <span className="btn-text">PASS</span>
        </motion.button>

        <motion.button
          className="action-btn accept-btn"
          onClick={() => handleDeal(true)}
          disabled={isAnimating || !currentClient}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <span className="btn-icon">✓</span>
          <span className="btn-text">DEAL</span>
        </motion.button>
      </div>

      {/* Money Display */}
      <div className="money-display">
        <span className="money-label">Balance</span>
        <span className="money-amount">{formatMoney(player.money)}</span>
      </div>
    </div>
  );
};

export default DealtMode;
