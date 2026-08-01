import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigationStore } from '../../stores/gameStore';
import { usePlayerStore, useEconomyStore } from '../../stores/gameStore';
import { depositSessionEarnings } from './cocaineCrushPayout';
import './CocaineCrush.css';

// SVG Icons mapping
const ICONS: Record<string, string> = {
  weed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C8 6 4 10 4 15c0 4.4 3.6 8 8 8s8-3.6 8-8c0-5-4-9-8-13z" fill="#22c55e" stroke="#166534"/></svg>',
  coke: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14l8-10 8 10-8 8-8-8z" fill="#f8fafc" stroke="#94a3b8"/><path d="M12 4l8 10-8 8" stroke="#cbd5e1"/></svg>',
  meth: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l8 6v8l-8 6-8-6V8l8-6z" fill="#60a5fa" stroke="#2563eb"/><path d="M12 2v20M4 8l16 8M20 8L4 16" stroke="#bfdbfe" opacity="0.5"/></svg>',
  pills: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="8" width="18" height="8" rx="4" fill="#fde047" stroke="#ca8a04"/><path d="M12 8v8" stroke="#ca8a04"/></svg>',
  shrooms: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 4c-4.4 0-8 3.6-8 8h16c0-4.4-3.6-8-8-8z" fill="#c2410c" stroke="#7c2d12"/><path d="M10 12v8c0 1.1.9 2 2 2s2-.9 2-2v-8" fill="#fef3c7" stroke="#eab308"/></svg>',
};

// Deal math exact configuration per match (3 tiles)
// Every 1 tile matched beyond 3 adds proportionally.
const DEAL_RULES: Record<string, { deductionPerTile: number; payoutPerTile: number; animationType: 'burn' | 'shatter' | 'crumble' | 'chip' }> = {
  weed: { deductionPerTile: 3.5 / 3, payoutPerTile: 35 / 3, animationType: 'burn' },
  coke: { deductionPerTile: 1 / 3, payoutPerTile: 80 / 3, animationType: 'crumble' },
  meth: { deductionPerTile: 1 / 3, payoutPerTile: 60 / 3, animationType: 'shatter' },
  pills: { deductionPerTile: 2 / 3, payoutPerTile: 20 / 3, animationType: 'chip' },
  shrooms: { deductionPerTile: 3.5 / 3, payoutPerTile: 30 / 3, animationType: 'burn' },
};

type BoardMode = 'playing' | 'no_drugs' | 'start';

export const CocaineCrush: React.FC = () => {
  const { goBack } = useNavigationStore();
  const { player, updateMoney } = usePlayerStore();
  const { inventory, removeInventoryItem } = useEconomyStore();

  const [board, setBoard] = useState<(string | null)[]>(new Array(64).fill(null));
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionEarnings, setSessionEarnings] = useState(0);
  const [gameState, setGameState] = useState<BoardMode>('start');

  const boardRef = useRef<HTMLDivElement>(null);

  // Session takings are credited to the block once, on exit or stash-out.
  // Guarded with a ref because both paths can fire for the same session —
  // running dry sets 'no_drugs', and the player then still presses Back.
  const earningsRef = useRef(0);
  const committedRef = useRef(false);
  earningsRef.current = sessionEarnings;

  const commitSession = useCallback(() => {
    if (committedRef.current) return;
    committedRef.current = true;
    depositSessionEarnings(earningsRef.current);
  }, []);

  const exitGame = useCallback(() => {
    commitSession();
    goBack();
  }, [commitSession, goBack]);

  // Available drugs based strictly on having quantity > 0
  const getAvailableDrugs = useCallback(() => {
    return inventory
      .filter(item => item.type === 'drug' && item.quantity > 0 && DEAL_RULES[item.itemId])
      .map(item => item.itemId);
  }, [inventory]);

  const availableDrugs = getAvailableDrugs();

  // Initial board generation
  const initBoard = useCallback(() => {
    const activeDrugs = getAvailableDrugs();
    if (activeDrugs.length === 0) {
      setGameState('no_drugs');
      return;
    }

    const newBoard = new Array(64).fill(null);
    for (let i = 0; i < 64; i++) {
      newBoard[i] = activeDrugs[Math.floor(Math.random() * activeDrugs.length)];
    }
    setBoard(newBoard);
    setSessionEarnings(0);
    committedRef.current = false;
    setGameState('playing');
  }, [getAvailableDrugs]);

  // Check board for matches (3 or more horizontal/vertical)
  const findMatches = useCallback((currentBoard: (string | null)[]) => {
    const matches = new Set<number>();

    // Horizontal
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 6; x++) {
        const i1 = y * 8 + x;
        const i2 = i1 + 1;
        const i3 = i1 + 2;
        if (currentBoard[i1] && currentBoard[i1] === currentBoard[i2] && currentBoard[i1] === currentBoard[i3]) {
          matches.add(i1); matches.add(i2); matches.add(i3);
        }
      }
    }
    // Vertical
    for (let x = 0; x < 8; x++) {
      for (let y = 0; y < 6; y++) {
        const i1 = y * 8 + x;
        const i2 = (y + 1) * 8 + x;
        const i3 = (y + 2) * 8 + x;
        if (currentBoard[i1] && currentBoard[i1] === currentBoard[i2] && currentBoard[i1] === currentBoard[i3]) {
          matches.add(i1); matches.add(i2); matches.add(i3);
        }
      }
    }
    return Array.from(matches);
  }, []);

  // Strict economy verification for matches
  // Returns actually verifiable matches that the player can afford
  const verifyAndApplyEconomy = useCallback((matchedIndices: number[], currentBoard: (string | null)[]) => {
    const drugsMatched = {} as Record<string, number>;

    // Group by drug type
    matchedIndices.forEach(idx => {
      const type = currentBoard[idx];
      if (type) {
        drugsMatched[type] = (drugsMatched[type] || 0) + 1;
      }
    });

    let totalPayout = 0;
    const validatedMatches: number[] = [];

    // Check affordance
    Object.keys(drugsMatched).forEach(drugId => {
      const matchCount = drugsMatched[drugId];
      const invItem = inventory.find(i => i.itemId === drugId && i.type === 'drug');
      const rules = DEAL_RULES[drugId];

      if (!rules) return;

      const requiredAmt = matchCount * rules.deductionPerTile;

      if (invItem && invItem.quantity >= requiredAmt) {
        // Can afford
        const payout = matchCount * rules.payoutPerTile;
        totalPayout += payout;

        // Apply deductions & rewards
        removeInventoryItem(drugId, requiredAmt);

        // Add valid indices
        matchedIndices.forEach(idx => {
          if (currentBoard[idx] === drugId) validatedMatches.push(idx);
        });
      }
    });

    if (totalPayout > 0) {
      updateMoney(Math.floor(totalPayout));
      setSessionEarnings(prev => prev + Math.floor(totalPayout));
    }

    return { validatedMatches, totalPayout };
  }, [inventory, removeInventoryItem, updateMoney]);

  // Handle specific animations via DOM injection into fx layer
  const applyVisualFx = useCallback((matchedIndices: number[], currentBoard: (string | null)[]) => {
    if (!boardRef.current) return;
    const fxLayer = document.querySelector('.cc-fx-layer');
    if (!fxLayer) return;

    // Add CSS classes to the tiles themselves
    matchedIndices.forEach(idx => {
      const tileEl = document.getElementById(`cc-tile-${idx}`);
      const drugId = currentBoard[idx];
      if (tileEl && drugId && DEAL_RULES[drugId]) {
        const animType = DEAL_RULES[drugId].animationType;
        tileEl.classList.add(`anim-${animType}`);

        // Custom particles per drug
        const rect = tileEl.getBoundingClientRect();
        const wrapperRect = fxLayer.getBoundingClientRect();
        const startX = rect.left - wrapperRect.left + 20;
        const startY = rect.top - wrapperRect.top + 20;

        if (animType === 'burn') { // Weed / Shrooms
          for (let p = 0; p < 5; p++) {
            const particle = document.createElement('div');
            particle.className = 'ash-particle';
            particle.style.left = `${startX}px`;
            particle.style.top = `${startY}px`;
            particle.style.setProperty('--tx', `${(Math.random() - 0.5) * 60}px`);
            particle.style.setProperty('--ty', `${-20 - Math.random() * 40}px`);
            fxLayer.appendChild(particle);
            setTimeout(() => particle.remove(), 800);
          }
        } else if (animType === 'shatter') { // Meth
          for (let p = 0; p < 6; p++) {
            const particle = document.createElement('div');
            particle.className = 'shard-particle';
            particle.style.left = `${startX}px`;
            particle.style.top = `${startY}px`;
            particle.style.setProperty('--tx', `${(Math.random() - 0.5) * 80}px`);
            particle.style.setProperty('--ty', `${(Math.random() - 0.5) * 80}px`);
            particle.style.setProperty('--rot', `${Math.random() * 360}deg`);
            fxLayer.appendChild(particle);
            setTimeout(() => particle.remove(), 500);
          }
        } else if (animType === 'crumble') { // Coke
          for (let p = 0; p < 8; p++) {
            const particle = document.createElement('div');
            particle.className = 'powder-particle';
            particle.style.left = `${startX + (Math.random() - 0.5) * 20}px`;
            particle.style.top = `${startY + (Math.random() - 0.5) * 20}px`;
            particle.style.setProperty('--tx', `${(Math.random() - 0.5) * 30}px`);
            particle.style.setProperty('--ty', `${20 + Math.random() * 40}px`);
            fxLayer.appendChild(particle);
            setTimeout(() => particle.remove(), 600);
          }
        } else if (animType === 'chip') { // Pills
          for (let p = 0; p < 3; p++) {
            const particle = document.createElement('div');
            particle.className = 'chip-particle';
            particle.style.left = `${startX}px`;
            particle.style.top = `${startY}px`;
            particle.style.setProperty('--tx', `${(Math.random() - 0.5) * 60}px`);
            particle.style.setProperty('--ty', `${(Math.random() - 0.5) * 60}px`);
            particle.style.setProperty('--rot', `${Math.random() * 360}deg`);
            fxLayer.appendChild(particle);
            setTimeout(() => particle.remove(), 500);
          }
        }
      }
    });
  }, []);

  const spawnFloatingText = useCallback((totalPayout: number) => {
    if (!boardRef.current) return;
    const fw = document.querySelector('.cc-board-wrapper');
    if (!fw) return;

    const el = document.createElement('div');
    el.className = 'cc-floating-text';
    el.innerText = `+$${Math.floor(totalPayout)}`;
    el.style.left = `50%`;
    el.style.top = `30%`;
    el.style.transform = 'translate(-50%, -50%)';
    fw.appendChild(el);
    setTimeout(() => el.remove(), 800);
  }, []);

  // Main board processing loop
  const processBoard = useCallback(async (currentBoard: (string | null)[]) => {
    const loopBoard = [...currentBoard];
    let hasMatches = true;

    while (hasMatches) {
      const matches = findMatches(loopBoard);

      if (matches.length > 0) {
        // Enforce math rules - do we actually have stash logic to fund this?
        const { validatedMatches, totalPayout } = verifyAndApplyEconomy(matches, loopBoard);

        // Trigger specific FX logic
        applyVisualFx(matches, loopBoard); // Animate all matched (even if un-verifiable, they clear but give $0)

        if (totalPayout > 0) {
          spawnFloatingText(totalPayout);
        }

        // Wait for animations
        await new Promise(r => setTimeout(r, 600));

        // Clear matched tiles
        matches.forEach(m => loopBoard[m] = null);

        // Remove fx classes just in case
        matches.forEach(idx => {
          const tileEl = document.getElementById(`cc-tile-${idx}`);
          if (tileEl) {
            tileEl.classList.remove('anim-burn', 'anim-shatter', 'anim-crumble', 'anim-chip');
          }
        });

        // Collapse empty spaces and spawn new tiles from STRICTLY available drugs
        const activeDrugs = getAvailableDrugs(); // Re-check each drop phase (stash might have hit 0)

        if (activeDrugs.length === 0) {
          setGameState('no_drugs'); // Hard stop
          setBoard([...loopBoard]);
          setIsProcessing(false);
          commitSession();
          return;
        }

        for (let x = 0; x < 8; x++) {
          const column = [];
          for (let y = 7; y >= 0; y--) {
            if (loopBoard[y * 8 + x] !== null) {
              column.push(loopBoard[y * 8 + x]);
            }
          }
          for (let y = 7; y >= 0; y--) {
            if (column.length > 0) {
              loopBoard[y * 8 + x] = column.shift()!;
            } else {
              // Spawn ONLY from active drugs
              loopBoard[y * 8 + x] = activeDrugs[Math.floor(Math.random() * activeDrugs.length)];
            }
          }
        }

        setBoard([...loopBoard]);
        await new Promise(r => setTimeout(r, 200));

      } else {
        hasMatches = false;
      }
    }

    setIsProcessing(false);
  }, [findMatches, verifyAndApplyEconomy, applyVisualFx, spawnFloatingText, getAvailableDrugs]);

  // Wait for initial render then check matches
  useEffect(() => {
    if (gameState === 'playing' && !isProcessing) {
      const initialMatches = findMatches(board);
      if (initialMatches.length > 0) {
        setIsProcessing(true);
        processBoard(board);
      }
    }
  }, [board, gameState, isProcessing, findMatches, processBoard]);

  const handleTileClick = async (idx: number) => {
    if (gameState !== 'playing' || isProcessing) return;

    if (selectedIdx === null) {
      setSelectedIdx(idx);
    } else {
      const isAdjacent =
        Math.abs(selectedIdx - idx) === 1 || Math.abs(selectedIdx - idx) === 8;

      if (isAdjacent) {
        setIsProcessing(true);
        const newBoard = [...board];
        const temp = newBoard[selectedIdx];
        newBoard[selectedIdx] = newBoard[idx];
        newBoard[idx] = temp;

        setSelectedIdx(null);
        setBoard(newBoard);

        // Check if swap is valid (creates a match)
        const newMatches = findMatches(newBoard);
        if (newMatches.length === 0) {
          // Invalid swap, delay and revert
          await new Promise(r => setTimeout(r, 300));
          const revertBoard = [...newBoard];
          revertBoard[idx] = revertBoard[selectedIdx];
          revertBoard[selectedIdx] = temp;
          setBoard(revertBoard);
          setIsProcessing(false);
        } else {
          // Valid swap, trigger physics
          processBoard(newBoard);
        }
      } else {
        setSelectedIdx(idx);
      }
    }
  };

  return (
    <div className="cc-container">
      <div className="cc-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button className="cc-back-btn" onClick={exitGame}>{'<'}</button>
          <div className="cc-title">Cocaine Crush</div>
        </div>
        <div className="cc-score-container">
          <span style={{ fontSize: '14px', color: '#888' }}>Deals:</span>
          <span className="cc-payout-text">+${sessionEarnings}</span>
        </div>
      </div>

      <div className="cc-main">
        <div className="cc-board-wrapper" ref={boardRef}>
          <div className="cc-fx-layer"></div>
          <div className="cc-board">
            {board.map((item, idx) => (
              <div
                id={`cc-tile-${idx}`}
                key={`tile-${idx}`}
                className={`cc-tile ${item ? '' : 'cc-tile-empty'} ${selectedIdx === idx ? 'selected' : ''}`}
                onClick={() => handleTileClick(idx)}
              >
                {item && ICONS[item] && (
                  <div
                    className="cc-tile-icon"
                    dangerouslySetInnerHTML={{ __html: ICONS[item] }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="cc-inventory-panel">
          {inventory.filter(i => i.type === 'drug').map(item => (
            <div key={item.itemId} className={`cc-inventory-item ${item.quantity === 0 ? 'depleted' : ''}`}>
              {ICONS[item.itemId] && <div className="cc-inventory-icon" dangerouslySetInnerHTML={{ __html: ICONS[item.itemId] }} />}
              <div>
                <span style={{ fontWeight: 'bold' }}>{item.quantity.toFixed(1)}g</span>
                <span style={{ color: '#888', marginLeft: '5px' }}>{item.itemId}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {gameState === 'start' && (
        <div className="cc-overlay">
          <h2 style={{ fontSize: '28px', marginBottom: '10px' }}>Match Deals</h2>
          <p style={{ color: '#ddd', maxWidth: '300px' }}>
            Combo blocks based on your real stash. When you run out of a drug, it stops spawning.
          </p>
          <button className="cc-primary-btn" onClick={initBoard}>Start Dealing</button>
        </div>
      )}

      {gameState === 'no_drugs' && (
        <div className="cc-overlay">
          <h2 style={{ fontSize: '28px', color: '#ef4444', marginBottom: '10px' }}>Stash Empty</h2>
          <p style={{ color: '#ddd', maxWidth: '300px' }}>
            You have no drugs left to deal on the board. Go to the Market to re-up.
          </p>
          <div style={{ marginTop: '20px', color: '#10b981', fontSize: '20px', fontWeight: 'bold' }}>
            Total Earned: ${sessionEarnings}
          </div>
          <button className="cc-primary-btn" onClick={exitGame} style={{ marginTop: '30px', background: '#333' }}>Back to Shoebox</button>
        </div>
      )}
    </div>
  );
};

export default CocaineCrush;
