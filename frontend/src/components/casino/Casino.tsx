// ============================================================
// Casino - Gambling Hub with Dice, Hi-Lo, and Slots
// ============================================================
import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigationStore, usePlayerStore, useEconomyStore } from '../../stores/gameStore';
import './Casino.css';

type CasinoGame = 'lobby' | 'dice' | 'hilo' | 'slots';

const formatMoney = (n: number) => `$${n.toLocaleString()}`;

// ── DICE GAME (Simplified Craps) ──
const DiceGame: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { player, updateMoney } = usePlayerStore();
  const { addTransaction } = useEconomyStore();
  const [bet, setBet] = useState(100);
  const [dice, setDice] = useState<[number, number]>([0, 0]);
  const [point, setPoint] = useState<number | null>(null);
  const [result, setResult] = useState<string>('');
  const [rolling, setRolling] = useState(false);

  const roll = useCallback(() => {
    if (rolling) return;
    if (!point && player.money < bet) { setResult('NOT ENOUGH CASH'); return; }

    setRolling(true);
    setResult('');

    // Animate dice
    const animInterval = setInterval(() => {
      setDice([Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6)]);
    }, 80);

    setTimeout(() => {
      clearInterval(animInterval);
      const d1 = Math.ceil(Math.random() * 6);
      const d2 = Math.ceil(Math.random() * 6);
      const sum = d1 + d2;
      setDice([d1, d2]);
      setRolling(false);

      if (!point) {
        // Come-out roll
        if (sum === 7 || sum === 11) {
          const winnings = bet * 2;
          updateMoney(winnings);
          addTransaction({ id: Date.now().toString(), type: 'deal_income', userId: '', amount: winnings, details: { description: `Casino Dice: Won ${formatMoney(winnings)}` }, createdAt: new Date().toISOString() } as any);
          setResult(`🎉 ${sum}! YOU WIN ${formatMoney(winnings)}`);
        } else if (sum === 2 || sum === 3 || sum === 12) {
          updateMoney(-bet);
          addTransaction({ id: Date.now().toString(), type: 'purchase', userId: '', amount: -bet, details: { description: `Casino Dice: Lost ${formatMoney(bet)}` }, createdAt: new Date().toISOString() } as any);
          setResult(`💀 ${sum}! CRAPS - YOU LOSE`);
        } else {
          updateMoney(-bet);
          setPoint(sum);
          setResult(`Point is ${sum}. Roll again!`);
        }
      } else {
        // Point roll
        if (sum === point) {
          const winnings = bet * 3;
          updateMoney(winnings);
          addTransaction({ id: Date.now().toString(), type: 'deal_income', userId: '', amount: winnings, details: { description: `Casino Dice: Hit point! Won ${formatMoney(winnings)}` }, createdAt: new Date().toISOString() } as any);
          setResult(`🎉 HIT THE POINT! WIN ${formatMoney(winnings)}`);
          setPoint(null);
        } else if (sum === 7) {
          addTransaction({ id: Date.now().toString(), type: 'purchase', userId: '', amount: -bet, details: { description: `Casino Dice: Seven out! Lost ${formatMoney(bet)}` }, createdAt: new Date().toISOString() } as any);
          setResult(`💀 SEVEN OUT! YOU LOSE`);
          setPoint(null);
        } else {
          setResult(`Rolled ${sum}. Need ${point}. Roll again!`);
        }
      }
    }, 600);
  }, [bet, point, rolling, player.money, updateMoney, addTransaction]);

  const DICE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

  return (
    <div className="casino-game dice-game">
      <div className="game-header">
        <button className="game-back" onClick={onBack}>← Lobby</button>
        <h2>🎲 DICE</h2>
        <div className="game-cash">{formatMoney(player.money)}</div>
      </div>

      <div className="dice-display">
        <motion.span className="die" animate={rolling ? { rotate: 360 } : {}} transition={{ duration: 0.3, repeat: rolling ? Infinity : 0 }}>
          {dice[0] > 0 ? DICE_FACES[dice[0]] : '🎲'}
        </motion.span>
        <motion.span className="die" animate={rolling ? { rotate: -360 } : {}} transition={{ duration: 0.3, repeat: rolling ? Infinity : 0 }}>
          {dice[1] > 0 ? DICE_FACES[dice[1]] : '🎲'}
        </motion.span>
      </div>

      {dice[0] > 0 && <div className="dice-sum">= {dice[0] + dice[1]}</div>}
      {point && <div className="point-display">Point: {point}</div>}
      {result && <div className={`dice-result ${result.includes('WIN') ? 'win' : result.includes('LOSE') || result.includes('CRAPS') ? 'lose' : ''}`}>{result}</div>}

      {!point && (
        <div className="bet-controls">
          <label>Bet Amount</label>
          <div className="bet-buttons">
            {[50, 100, 250, 500, 1000].map((b) => (
              <button key={b} className={`bet-btn ${bet === b ? 'active' : ''}`} onClick={() => setBet(b)}>
                {formatMoney(b)}
              </button>
            ))}
          </div>
        </div>
      )}

      <motion.button className="roll-btn" onClick={roll} disabled={rolling} whileTap={{ scale: 0.95 }}>
        {rolling ? 'ROLLING...' : point ? 'ROLL AGAIN' : 'ROLL DICE'}
      </motion.button>
    </div>
  );
};

// ── HI-LO CARD GAME ──
const HiLoGame: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { player, updateMoney } = usePlayerStore();
  const { addTransaction } = useEconomyStore();
  const [bet, setBet] = useState(100);
  const [currentCard, setCurrentCard] = useState(0);
  const [streak, setStreak] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [gameActive, setGameActive] = useState(false);
  const [result, setResult] = useState('');

  const CARDS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const SUITS = ['♠', '♥', '♦', '♣'];

  const startGame = () => {
    if (player.money < bet) { setResult('NOT ENOUGH CASH'); return; }
    updateMoney(-bet);
    setCurrentCard(Math.floor(Math.random() * 13));
    setStreak(0);
    setMultiplier(1);
    setGameActive(true);
    setResult('');
  };

  const guess = (higher: boolean) => {
    const nextCard = Math.floor(Math.random() * 13);
    const correct = higher ? nextCard > currentCard : nextCard < currentCard;
    const tie = nextCard === currentCard;

    if (tie) {
      setCurrentCard(nextCard);
      setResult(`PUSH! ${CARDS[nextCard]} - Same card. Go again.`);
      return;
    }

    if (correct) {
      const newStreak = streak + 1;
      const newMult = 1 + newStreak * 0.5;
      setStreak(newStreak);
      setMultiplier(newMult);
      setCurrentCard(nextCard);
      setResult(`✅ ${CARDS[nextCard]}! Streak: ${newStreak} (${newMult}x)`);
    } else {
      addTransaction({ id: Date.now().toString(), type: 'purchase', userId: '', amount: -bet, details: { description: `Casino Hi-Lo: Lost ${formatMoney(bet)}` }, createdAt: new Date().toISOString() } as any);
      setCurrentCard(nextCard);
      setResult(`💀 ${CARDS[nextCard]}! WRONG - Lost ${formatMoney(bet)}`);
      setGameActive(false);
      setStreak(0);
      setMultiplier(1);
    }
  };

  const cashOut = () => {
    const winnings = Math.floor(bet * multiplier);
    updateMoney(winnings);
    addTransaction({ id: Date.now().toString(), type: 'deal_income', userId: '', amount: winnings, details: { description: `Casino Hi-Lo: Cashed out ${formatMoney(winnings)} (${multiplier}x)` }, createdAt: new Date().toISOString() } as any);
    setResult(`💰 CASHED OUT: ${formatMoney(winnings)}`);
    setGameActive(false);
    setStreak(0);
    setMultiplier(1);
  };

  return (
    <div className="casino-game hilo-game">
      <div className="game-header">
        <button className="game-back" onClick={onBack}>← Lobby</button>
        <h2>🃏 HI-LO</h2>
        <div className="game-cash">{formatMoney(player.money)}</div>
      </div>

      <div className="card-display">
        <div className="playing-card">
          <span className="card-value">{currentCard >= 0 && gameActive ? CARDS[currentCard] : '?'}</span>
          <span className="card-suit">{currentCard >= 0 && gameActive ? SUITS[Math.floor(Math.random() * 4)] : ''}</span>
        </div>
      </div>

      {gameActive && (
        <div className="hilo-info">
          <span>Streak: {streak}</span>
          <span>Multiplier: {multiplier}x</span>
          <span>Pot: {formatMoney(Math.floor(bet * multiplier))}</span>
        </div>
      )}

      {result && <div className={`hilo-result ${result.includes('WRONG') || result.includes('Lost') ? 'lose' : 'win'}`}>{result}</div>}

      {gameActive ? (
        <div className="hilo-actions">
          <motion.button className="hi-btn" onClick={() => guess(true)} whileTap={{ scale: 0.95 }}>
            ⬆️ HIGHER
          </motion.button>
          <motion.button className="lo-btn" onClick={() => guess(false)} whileTap={{ scale: 0.95 }}>
            ⬇️ LOWER
          </motion.button>
          {streak > 0 && (
            <motion.button className="cashout-btn" onClick={cashOut} whileTap={{ scale: 0.95 }}>
              💰 CASH OUT ({formatMoney(Math.floor(bet * multiplier))})
            </motion.button>
          )}
        </div>
      ) : (
        <>
          <div className="bet-controls">
            <label>Bet Amount</label>
            <div className="bet-buttons">
              {[50, 100, 250, 500, 1000].map((b) => (
                <button key={b} className={`bet-btn ${bet === b ? 'active' : ''}`} onClick={() => setBet(b)}>
                  {formatMoney(b)}
                </button>
              ))}
            </div>
          </div>
          <motion.button className="roll-btn" onClick={startGame} whileTap={{ scale: 0.95 }}>
            DEAL CARD
          </motion.button>
        </>
      )}
    </div>
  );
};

// ── SLOTS GAME ──
const SlotsGame: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { player, updateMoney } = usePlayerStore();
  const { addTransaction } = useEconomyStore();
  const [bet, setBet] = useState(100);
  const [reels, setReels] = useState(['🎰', '🎰', '🎰']);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState('');

  const SYMBOLS = ['🍒', '🍋', '🍊', '💎', '7️⃣', '🔔', '⭐', '💰'];
  const PAYOUTS: Record<string, number> = {
    '💰💰💰': 50,
    '7️⃣7️⃣7️⃣': 25,
    '💎💎💎': 15,
    '⭐⭐⭐': 10,
    '🔔🔔🔔': 8,
    '🍊🍊🍊': 5,
    '🍋🍋🍋': 3,
    '🍒🍒🍒': 2,
  };

  const spin = useCallback(() => {
    if (spinning || player.money < bet) {
      if (player.money < bet) setResult('NOT ENOUGH CASH');
      return;
    }

    updateMoney(-bet);
    setSpinning(true);
    setResult('');

    // Animate reels
    const animInterval = setInterval(() => {
      setReels([
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      ]);
    }, 80);

    setTimeout(() => {
      clearInterval(animInterval);
      const finalReels = [
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      ];
      setReels(finalReels);
      setSpinning(false);

      const key = finalReels.join('');
      const payout = PAYOUTS[key];

      if (payout) {
        const winnings = bet * payout;
        updateMoney(winnings);
        addTransaction({ id: Date.now().toString(), type: 'deal_income', userId: '', amount: winnings, details: { description: `Casino Slots: Won ${formatMoney(winnings)} (${payout}x)` }, createdAt: new Date().toISOString() } as any);
        setResult(`🎉 ${payout}x! WIN ${formatMoney(winnings)}`);
      } else if (finalReels[0] === finalReels[1] || finalReels[1] === finalReels[2]) {
        // Two matching = small win
        const smallWin = Math.floor(bet * 0.5);
        if (smallWin > 0) {
          updateMoney(smallWin);
          setResult(`Close! Partial: +${formatMoney(smallWin)}`);
        } else {
          setResult('No match. Try again!');
        }
      } else {
        addTransaction({ id: Date.now().toString(), type: 'purchase', userId: '', amount: -bet, details: { description: `Casino Slots: Lost ${formatMoney(bet)}` }, createdAt: new Date().toISOString() } as any);
        setResult('No match. Try again!');
      }
    }, 1200);
  }, [spinning, bet, player.money, updateMoney, addTransaction]);

  return (
    <div className="casino-game slots-game">
      <div className="game-header">
        <button className="game-back" onClick={onBack}>← Lobby</button>
        <h2>🎰 SLOTS</h2>
        <div className="game-cash">{formatMoney(player.money)}</div>
      </div>

      <div className="slots-machine">
        <div className="slots-frame">
          {reels.map((symbol, i) => (
            <motion.div
              key={i}
              className="slot-reel"
              animate={spinning ? { y: [0, -10, 10, 0] } : {}}
              transition={{ duration: 0.15, repeat: spinning ? Infinity : 0 }}
            >
              {symbol}
            </motion.div>
          ))}
        </div>
      </div>

      {result && <div className={`slots-result ${result.includes('WIN') || result.includes('Partial') ? 'win' : result.includes('ENOUGH') ? 'lose' : ''}`}>{result}</div>}

      <div className="payout-table">
        <h4>Payouts</h4>
        <div className="payout-rows">
          {Object.entries(PAYOUTS).slice(0, 4).map(([combo, mult]) => (
            <div key={combo} className="payout-row">
              <span>{combo}</span>
              <span>{mult}x</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bet-controls">
        <label>Bet Amount</label>
        <div className="bet-buttons">
          {[50, 100, 250, 500, 1000].map((b) => (
            <button key={b} className={`bet-btn ${bet === b ? 'active' : ''}`} onClick={() => setBet(b)}>
              {formatMoney(b)}
            </button>
          ))}
        </div>
      </div>

      <motion.button className="roll-btn spin-btn" onClick={spin} disabled={spinning} whileTap={{ scale: 0.95 }}>
        {spinning ? 'SPINNING...' : 'PULL LEVER'}
      </motion.button>
    </div>
  );
};

// ── CASINO LOBBY ──
const Casino: React.FC = () => {
  const { goBack } = useNavigationStore();
  const { player } = usePlayerStore();
  const [activeGame, setActiveGame] = useState<CasinoGame>('lobby');

  if (activeGame === 'dice') return <DiceGame onBack={() => setActiveGame('lobby')} />;
  if (activeGame === 'hilo') return <HiLoGame onBack={() => setActiveGame('lobby')} />;
  if (activeGame === 'slots') return <SlotsGame onBack={() => setActiveGame('lobby')} />;

  return (
    <div className="casino-container">
      <div className="casino-header">
        <motion.button className="back-btn" onClick={goBack} whileTap={{ scale: 0.9 }}>
          ← Back
        </motion.button>
        <h1>🎰 CASINO</h1>
        <div style={{ width: 60 }} />
      </div>

      <div className="casino-cash">
        Cash: <span className="cash-value">{formatMoney(player.money)}</span>
      </div>

      <div className="casino-games-grid">
        <motion.div className="casino-game-card" onClick={() => setActiveGame('dice')} whileTap={{ scale: 0.97 }}>
          <div className="cgc-icon">🎲</div>
          <div className="cgc-name">DICE</div>
          <div className="cgc-desc">Roll the dice. 7 or 11 wins. Hit the point for 3x.</div>
          <div className="cgc-tag">Min: $50</div>
        </motion.div>

        <motion.div className="casino-game-card" onClick={() => setActiveGame('hilo')} whileTap={{ scale: 0.97 }}>
          <div className="cgc-icon">🃏</div>
          <div className="cgc-name">HI-LO</div>
          <div className="cgc-desc">Guess higher or lower. Chain streaks for bigger multipliers.</div>
          <div className="cgc-tag">Min: $50</div>
        </motion.div>

        <motion.div className="casino-game-card" onClick={() => setActiveGame('slots')} whileTap={{ scale: 0.97 }}>
          <div className="cgc-icon">🎰</div>
          <div className="cgc-name">SLOTS</div>
          <div className="cgc-desc">Pull the lever. Match 3 symbols for up to 50x payout.</div>
          <div className="cgc-tag">Min: $50</div>
        </motion.div>
      </div>

      <div className="casino-disclaimer">
        The house always wins. Gamble responsibly.
      </div>
    </div>
  );
};

export default Casino;
