// ============================================================
// DEALT Speed - Fast Problem-Solving Drug Dealing
// Players have X seconds to evaluate deals (accept/decline).
// Shows inventory legend, cost basis, and incoming offers.
// Good deals accepted = more traffic. Bad decisions = less.
// ============================================================

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigationStore, usePlayerStore, useEconomyStore } from '../../stores/gameStore';
import { generatePlaceholderAvatar } from '../../services/ai/artPipeline';
import './DealtV2.css';

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

interface DrugStock {
  id: string;
  name: string;
  icon: string;
  totalAmount: number; // in grams or units
  costPerUnit: number; // what player paid per unit
  unit: string; // 'g', 'oz', 'pill', 'vial'
}

interface SpeedDeal {
  id: string;
  clientName: string;
  clientAvatar: string;
  drugId: string;
  drugName: string;
  requestedAmount: number;
  requestedUnit: string;
  offerPrice: number;
  timeLimit: number; // seconds
  isGoodDeal: boolean;
  profitMargin: number; // percentage
  costBasis: number; // what the requested amount cost the player
}

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════

const INITIAL_STOCK: DrugStock[] = [
  { id: 'weed', name: 'Weed', icon: '🌿', totalAmount: 56, costPerUnit: 7.14, unit: 'g' }, // 2oz at $200 each
  { id: 'cocaine', name: 'Cocaine', icon: '❄️', totalAmount: 28, costPerUnit: 35.71, unit: 'g' }, // 1oz at $1000
  { id: 'pills', name: 'Pills', icon: '💊', totalAmount: 50, costPerUnit: 5, unit: 'pill' }, // 50 pills at $250
  { id: 'lean', name: 'Lean', icon: '🥤', totalAmount: 10, costPerUnit: 30, unit: 'pint' }, // 10 pints at $300
];

const CLIENT_NAMES = [
  'Shaky Pete', 'Lil Mama', 'College Kid', 'Old Head', 'Tourist',
  'Tweaker Mike', 'Sleepy Joe', 'Fast Eddie', 'Corner Boy', 'Nurse Betty',
  'Frat Bro', 'Homeless Dave', 'Soccer Mom', 'Club Girl', 'Truck Driver',
  'Big Smoke', 'Tiny', 'Preacher', 'Schoolboy', 'Grandma Rose',
];

// Unit conversions
const UNIT_CONVERSIONS: Record<string, Record<string, number>> = {
  g: { g: 1, eighth: 3.5, quarter: 7, half: 14, oz: 28 },
  pill: { pill: 1, strip: 10, bottle: 30 },
  pint: { cup: 0.25, half: 0.5, pint: 1 },
};

const UNIT_LABELS: Record<string, string[]> = {
  g: ['1g', '3.5g (eighth)', '7g (quarter)', '14g (half)', '28g (oz)'],
  pill: ['1 pill', '5 pills', '10 pills (strip)', '30 pills (bottle)'],
  pint: ['1 cup', 'half pint', '1 pint'],
};

// ═══════════════════════════════════════════════════════════
// DEAL GENERATOR
// ═══════════════════════════════════════════════════════════

function generateSpeedDeal(stock: DrugStock[], round: number): SpeedDeal | null {
  const availableStock = stock.filter(s => s.totalAmount > 0);
  if (availableStock.length === 0) return null;
  
  const drug = availableStock[Math.floor(Math.random() * availableStock.length)];
  
  // Generate a random amount request
  let requestedAmount: number;
  const requestedUnit = drug.unit;
  
  if (drug.unit === 'g') {
    const amounts = [1, 3.5, 7, 14, 28];
    requestedAmount = amounts[Math.floor(Math.random() * amounts.length)];
    if (requestedAmount > drug.totalAmount) requestedAmount = Math.min(drug.totalAmount, 1);
  } else if (drug.unit === 'pill') {
    const amounts = [1, 5, 10, 30];
    requestedAmount = amounts[Math.floor(Math.random() * amounts.length)];
    if (requestedAmount > drug.totalAmount) requestedAmount = Math.min(drug.totalAmount, 1);
  } else {
    const amounts = [0.25, 0.5, 1];
    requestedAmount = amounts[Math.floor(Math.random() * amounts.length)];
    if (requestedAmount > drug.totalAmount) requestedAmount = Math.min(drug.totalAmount, 0.25);
  }
  
  const costBasis = requestedAmount * drug.costPerUnit;
  
  // Generate offer price - sometimes good, sometimes bad
  const isGoodDeal = Math.random() > 0.4; // 60% chance of good deal
  let profitMargin: number;
  let offerPrice: number;
  
  if (isGoodDeal) {
    profitMargin = 0.1 + Math.random() * 0.8; // 10% to 80% profit
    offerPrice = Math.round(costBasis * (1 + profitMargin));
  } else {
    profitMargin = -(0.1 + Math.random() * 0.5); // -10% to -50% loss
    offerPrice = Math.max(1, Math.round(costBasis * (1 + profitMargin)));
  }
  
  // Timer gets shorter as rounds progress
  const timeLimit = Math.max(5, 12 - Math.floor(round / 5));
  
  const clientName = CLIENT_NAMES[Math.floor(Math.random() * CLIENT_NAMES.length)];
  
  return {
    id: `deal-${Date.now()}`,
    clientName,
    clientAvatar: generatePlaceholderAvatar(clientName),
    drugId: drug.id,
    drugName: drug.name,
    requestedAmount,
    requestedUnit,
    offerPrice,
    timeLimit,
    isGoodDeal,
    profitMargin,
    costBasis,
  };
}

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════

const DealtSpeed: React.FC = () => {
  const { goBack } = useNavigationStore();
  const { player, updateMoney, updateHeat, addXP } = usePlayerStore();
  
  const [stock, setStock] = useState<DrugStock[]>(INITIAL_STOCK);
  const [currentDeal, setCurrentDeal] = useState<SpeedDeal | null>(null);
  const [timer, setTimer] = useState(10);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [traffic, setTraffic] = useState(50);
  const [streak, setStreak] = useState(0);
  const [result, setResult] = useState<{ type: 'accept' | 'decline' | 'timeout'; message: string; profit: number } | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [history, setHistory] = useState<{ round: number; profit: number; correct: boolean }[]>([]);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Generate first deal
  useEffect(() => {
    nextDeal();
  }, []);
  
  // Timer
  useEffect(() => {
    if (!currentDeal || result) return;
    
    timerRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          // Time's up
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentDeal, result]);
  
  const nextDeal = useCallback(() => {
    const deal = generateSpeedDeal(stock, round);
    if (!deal) {
      setGameOver(true);
      return;
    }
    setCurrentDeal(deal);
    setTimer(deal.timeLimit);
    setResult(null);
    setRound(r => r + 1);
  }, [stock, round]);
  
  const handleAccept = useCallback(() => {
    if (!currentDeal || result) return;
    if (timerRef.current) clearInterval(timerRef.current);
    
    const profit = currentDeal.offerPrice - currentDeal.costBasis;
    const isCorrectDecision = currentDeal.isGoodDeal;
    
    // Deduct from stock
    setStock(prev => prev.map(s => 
      s.id === currentDeal.drugId 
        ? { ...s, totalAmount: Math.max(0, s.totalAmount - currentDeal.requestedAmount) }
        : s
    ));
    
    updateMoney(currentDeal.offerPrice);
    
    if (isCorrectDecision) {
      setStreak(s => s + 1);
      setTraffic(t => Math.min(100, t + 3));
      addXP(15);
    } else {
      setStreak(0);
      setTraffic(t => Math.max(0, t - 5));
    }
    
    setScore(s => s + profit);
    setHistory(h => [...h, { round, profit, correct: isCorrectDecision }]);
    
    setResult({
      type: 'accept',
      message: profit >= 0 
        ? `+$${profit} profit! ${isCorrectDecision ? 'Good call!' : 'Lucky break, but that was risky.'}`
        : `-$${Math.abs(profit)} loss! ${!isCorrectDecision ? 'Bad deal.' : 'Should have taken it differently.'}`,
      profit,
    });
    
    updateHeat(2);
    
    setTimeout(nextDeal, 1500);
  }, [currentDeal, result, round, nextDeal, updateMoney, updateHeat, addXP]);
  
  const handleDecline = useCallback(() => {
    if (!currentDeal || result) return;
    if (timerRef.current) clearInterval(timerRef.current);
    
    const isCorrectDecision = !currentDeal.isGoodDeal;
    const missedProfit = currentDeal.isGoodDeal ? currentDeal.offerPrice - currentDeal.costBasis : 0;
    
    if (isCorrectDecision) {
      setStreak(s => s + 1);
      setTraffic(t => Math.min(100, t + 1));
    } else {
      setStreak(0);
      setTraffic(t => Math.max(0, t - 3));
    }
    
    setHistory(h => [...h, { round, profit: 0, correct: isCorrectDecision }]);
    
    setResult({
      type: 'decline',
      message: isCorrectDecision 
        ? 'Smart pass! That was a bad deal.' 
        : `Missed out! You could have made $${missedProfit} profit.`,
      profit: 0,
    });
    
    setTimeout(nextDeal, 1500);
  }, [currentDeal, result, round, nextDeal]);
  
  const handleTimeout = useCallback(() => {
    if (!currentDeal) return;
    
    setTraffic(t => Math.max(0, t - 5));
    setStreak(0);
    setHistory(h => [...h, { round, profit: 0, correct: false }]);
    
    setResult({
      type: 'timeout',
      message: `Too slow! ${currentDeal.clientName} walked away.`,
      profit: 0,
    });
    
    setTimeout(nextDeal, 1500);
  }, [currentDeal, round, nextDeal]);
  
  // ─── GAME OVER ───
  if (gameOver) {
    const totalProfit = history.reduce((sum, h) => sum + h.profit, 0);
    const accuracy = history.length > 0 ? Math.round((history.filter(h => h.correct).length / history.length) * 100) : 0;
    
    return (
      <div className="dealt-v2">
        <div className="dealt-v2-header">
          <button className="back-btn" onClick={goBack}>← Back</button>
          <span className="game-title">💊 DEALT: Speed Deals</span>
        </div>
        <div className="game-over-screen">
          <div className="game-over-title">📦 SOLD OUT</div>
          <div className="game-over-subtitle">All stock has been moved.</div>
          <div className="game-over-stats">
            <div className="go-stat">
              <div className="go-stat-label">Total Profit</div>
              <div className="go-stat-value" style={{ color: totalProfit >= 0 ? '#44ff44' : '#ff4444' }}>
                {totalProfit >= 0 ? '+' : ''}${totalProfit}
              </div>
            </div>
            <div className="go-stat">
              <div className="go-stat-label">Rounds</div>
              <div className="go-stat-value">{round}</div>
            </div>
            <div className="go-stat">
              <div className="go-stat-label">Accuracy</div>
              <div className="go-stat-value">{accuracy}%</div>
            </div>
            <div className="go-stat">
              <div className="go-stat-label">Best Streak</div>
              <div className="go-stat-value">{streak}</div>
            </div>
          </div>
          <button className="next-btn" onClick={goBack}>Go Home</button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="dealt-v2">
      {/* Header */}
      <div className="dealt-v2-header">
        <button className="back-btn" onClick={goBack}>← Back</button>
        <span className="game-title">💊 Speed Deals</span>
        <span className="round-info">Round {round}</span>
      </div>
      
      {/* Stats bar */}
      <div className="stats-bar">
        <div className="stat-item">
          <span className="stat-label">Profit</span>
          <span className="stat-value" style={{ color: score >= 0 ? '#44ff44' : '#ff4444' }}>
            {score >= 0 ? '+' : ''}${score}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Traffic</span>
          <span className="stat-value" style={{ color: traffic > 60 ? '#44ff44' : traffic > 30 ? '#ffaa00' : '#ff4444' }}>
            {traffic}%
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Streak</span>
          <span className="stat-value">🔥{streak}</span>
        </div>
      </div>
      
      {/* Inventory Legend */}
      <div className="inventory-legend">
        <div className="legend-title">📦 Your Stock</div>
        <div className="legend-items">
          {stock.map(s => (
            <div key={s.id} className={`legend-item ${s.totalAmount <= 0 ? 'empty' : ''}`}>
              <span className="legend-icon">{s.icon}</span>
              <span className="legend-name">{s.name}</span>
              <span className="legend-amount">{s.totalAmount}{s.unit}</span>
              <span className="legend-cost">${s.costPerUnit.toFixed(0)}/{s.unit}</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Timer Bar */}
      {currentDeal && !result && (
        <div className="timer-bar-container">
          <div
            className="timer-bar-fill"
            style={{
              width: `${(timer / (currentDeal?.timeLimit || 10)) * 100}%`,
              background: timer <= 3 ? '#ff4444' : timer <= 5 ? '#ffaa00' : '#44ff44',
            }}
          />
          <span className="timer-text">{timer}s</span>
        </div>
      )}
      
      {/* Deal Card */}
      <AnimatePresence mode="wait">
        {currentDeal && !result && (
          <motion.div
            className="speed-deal-card"
            key={currentDeal.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
          >
            <div className="deal-client-row">
              <div className="deal-client-avatar">
                <img src={currentDeal.clientAvatar} alt={currentDeal.clientName} />
              </div>
              <div className="deal-client-info">
                <div className="deal-client-name">{currentDeal.clientName}</div>
                <div className="deal-client-request">
                  Wants: <strong>{currentDeal.requestedAmount}{currentDeal.requestedUnit}</strong> of {currentDeal.drugName}
                </div>
              </div>
            </div>
            
            <div className="deal-offer-row">
              <div className="deal-offer-label">Offering:</div>
              <div className="deal-offer-price">${currentDeal.offerPrice}</div>
            </div>
            
            <div className="deal-math-hint">
              <span>Your cost for {currentDeal.requestedAmount}{currentDeal.requestedUnit}: </span>
              <span style={{ color: '#ffaa00' }}>${currentDeal.costBasis.toFixed(0)}</span>
            </div>
            
            <div className="deal-actions">
              <motion.button
                className="deal-btn decline"
                onClick={handleDecline}
                whileTap={{ scale: 0.95 }}
              >
                ✗ PASS
              </motion.button>
              <motion.button
                className="deal-btn accept"
                onClick={handleAccept}
                whileTap={{ scale: 0.95 }}
              >
                ✓ DEAL
              </motion.button>
            </div>
          </motion.div>
        )}
        
        {/* Result */}
        {result && (
          <motion.div
            className={`speed-result ${result.profit >= 0 ? 'positive' : 'negative'}`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="result-icon">
              {result.type === 'accept' ? (result.profit >= 0 ? '💰' : '📉') :
               result.type === 'decline' ? '🤚' : '⏰'}
            </div>
            <div className="result-message">{result.message}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DealtSpeed;
