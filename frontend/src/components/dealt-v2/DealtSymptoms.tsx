// ============================================================
// DEALT Symptoms - Drug Matching by Visual Cues
// Players identify what drug a client wants based on their
// appearance/symptoms, then set a price to sell at.
// Wrong drug = lost traffic. Right drug + good price = profit.
// ============================================================

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigationStore, usePlayerStore, useDealtStore, useEconomyStore } from '../../stores/gameStore';
import {
  generateClientVisualProfile,
  generatePlaceholderAvatar,
  type ClientVisualProfile,
} from '../../services/ai/artPipeline';
import './DealtV2.css';

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

interface SymptomClient {
  id: string;
  name: string;
  type: string;
  profile: ClientVisualProfile;
  correctDrug: string;
  maxPrice: number;
  minPrice: number;
  patience: number; // seconds before they leave
  isUndercover: boolean;
  redFlags: string[];
}

interface DrugOption {
  id: string;
  name: string;
  icon: string;
  basePrice: number;
  description: string;
}

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════

const DRUG_OPTIONS: DrugOption[] = [
  { id: 'weed', name: 'Weed', icon: '🌿', basePrice: 20, description: 'Relaxed, red eyes, hungry' },
  { id: 'cocaine', name: 'Cocaine', icon: '❄️', basePrice: 80, description: 'Wide eyes, energetic, sniffling' },
  { id: 'meth', name: 'Meth', icon: '💎', basePrice: 60, description: 'Bugged out, twitching, paranoid' },
  { id: 'heroin', name: 'Heroin', icon: '💉', basePrice: 100, description: 'Droopy, pale, desperate' },
  { id: 'pills', name: 'Pills', icon: '💊', basePrice: 40, description: 'Glazed, off-balance, calm' },
  { id: 'lean', name: 'Lean', icon: '🥤', basePrice: 50, description: 'Droopy, styrofoam cup, slow' },
];

const CLIENT_NAMES = [
  'Shaky Pete', 'Lil Mama', 'College Kid', 'Old Head', 'Tourist',
  'Tweaker Mike', 'Sleepy Joe', 'Fast Eddie', 'Corner Boy', 'Nurse Betty',
  'Frat Bro', 'Homeless Dave', 'Soccer Mom', 'Club Girl', 'Truck Driver',
];

const CLIENT_TYPES = [
  'regular', 'new_customer', 'tourist', 'college_kid', 'addict',
  'casual_user', 'party_goer', 'desperate', 'suspicious',
];

// ═══════════════════════════════════════════════════════════
// CLIENT GENERATOR
// ═══════════════════════════════════════════════════════════

function generateSymptomClient(heat: number, level: number): SymptomClient {
  const drugs = ['weed', 'cocaine', 'meth', 'heroin', 'pills', 'lean'];
  const correctDrug = drugs[Math.floor(Math.random() * drugs.length)];
  const drugInfo = DRUG_OPTIONS.find(d => d.id === correctDrug)!;
  const clientType = CLIENT_TYPES[Math.floor(Math.random() * CLIENT_TYPES.length)];
  
  const profile = generateClientVisualProfile(clientType, correctDrug);
  
  // Price range varies by client type
  const typeMultiplier = clientType === 'tourist' || clientType === 'college_kid' ? 1.5 :
    clientType === 'addict' || clientType === 'desperate' ? 0.7 : 1.0;
  
  const basePrice = drugInfo.basePrice * typeMultiplier;
  const maxPrice = Math.floor(basePrice * (1.3 + Math.random() * 0.5));
  const minPrice = Math.floor(basePrice * (0.5 + Math.random() * 0.3));
  
  const isUndercover = Math.random() < (heat / 200);
  const redFlags: string[] = [];
  if (isUndercover) {
    if (Math.random() > 0.5) redFlags.push('Too clean-cut');
    if (Math.random() > 0.5) redFlags.push('Asking too many questions');
    if (Math.random() > 0.6) redFlags.push('Wire bulge under shirt');
  }
  
  return {
    id: `client-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: CLIENT_NAMES[Math.floor(Math.random() * CLIENT_NAMES.length)],
    type: clientType,
    profile,
    correctDrug,
    maxPrice,
    minPrice,
    patience: 15 + Math.floor(Math.random() * 10),
    isUndercover,
    redFlags,
  };
}

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════

const DealtSymptoms: React.FC = () => {
  const { goBack } = useNavigationStore();
  const { player, updateMoney, updateHeat, addXP } = usePlayerStore();
  const { streak, completeDeal } = useDealtStore();
  
  const [client, setClient] = useState<SymptomClient | null>(null);
  const [selectedDrug, setSelectedDrug] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState('');
  const [phase, setPhase] = useState<'observe' | 'pick_drug' | 'set_price' | 'result'>('observe');
  const [result, setResult] = useState<{ success: boolean; message: string; money: number; heat: number } | null>(null);
  const [timer, setTimer] = useState(0);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [traffic, setTraffic] = useState(50); // 0-100 traffic level
  
  // Generate first client
  useEffect(() => {
    nextClient();
  }, []);
  
  // Timer countdown
  useEffect(() => {
    if (phase !== 'observe' && phase !== 'pick_drug' && phase !== 'set_price') return;
    if (!client) return;
    
    const interval = setInterval(() => {
      setTimer(prev => {
        if (prev <= 0) {
          // Client left - too slow
          setResult({ success: false, message: `${client.name} got tired of waiting and left.`, money: 0, heat: 1 });
          setPhase('result');
          setTraffic(prev => Math.max(0, prev - 5));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [phase, client]);
  
  const nextClient = useCallback(() => {
    const newClient = generateSymptomClient(player.heat, player.level);
    setClient(newClient);
    setTimer(newClient.patience);
    setPhase('observe');
    setSelectedDrug(null);
    setPriceInput('');
    setResult(null);
    setRound(r => r + 1);
  }, [player.heat, player.level]);
  
  const handleDrugSelect = (drugId: string) => {
    setSelectedDrug(drugId);
    setPhase('set_price');
    
    // Pre-fill with base price
    const drug = DRUG_OPTIONS.find(d => d.id === drugId);
    if (drug) setPriceInput(drug.basePrice.toString());
  };
  
  const handleSell = () => {
    if (!client || !selectedDrug) return;
    
    const price = parseInt(priceInput) || 0;
    
    // Check if undercover
    if (client.isUndercover) {
      const moneyLost = Math.floor(player.money * 0.1);
      setResult({
        success: false,
        message: `👮 ${client.name} was UNDERCOVER! You got caught selling. Lost $${moneyLost} in fines.`,
        money: -moneyLost,
        heat: 15,
      });
      updateMoney(-moneyLost);
      updateHeat(15);
      setPhase('result');
      return;
    }
    
    // Check if correct drug
    if (selectedDrug !== client.correctDrug) {
      setResult({
        success: false,
        message: `Wrong read! ${client.name} wanted ${client.correctDrug}, not ${selectedDrug}. They walked away.`,
        money: 0,
        heat: 2,
      });
      updateHeat(2);
      setTraffic(prev => Math.max(0, prev - 8));
      setPhase('result');
      return;
    }
    
    // Check if price is acceptable
    if (price > client.maxPrice) {
      setResult({
        success: false,
        message: `Too expensive! ${client.name} wanted to pay max $${client.maxPrice}. Your price of $${price} scared them off.`,
        money: 0,
        heat: 1,
      });
      updateHeat(1);
      setTraffic(prev => Math.max(0, prev - 3));
      setPhase('result');
      return;
    }
    
    if (price < client.minPrice) {
      // They'll take it but you're losing money
      setResult({
        success: true,
        message: `Deal done but you undersold! ${client.name} would've paid up to $${client.maxPrice}. You left money on the table.`,
        money: price,
        heat: 3,
      });
    } else {
      // Good deal
      const bonus = price >= client.maxPrice * 0.8 ? ' Perfect price!' : '';
      setResult({
        success: true,
        message: `Deal complete! ${client.name} paid $${price} for ${selectedDrug}.${bonus}`,
        money: price,
        heat: 3 + Math.floor(price / 50),
      });
      setTraffic(prev => Math.min(100, prev + 3));
    }
    
    updateMoney(price);
    updateHeat(3);
    addXP(20 + (selectedDrug === client.correctDrug ? 10 : 0));
    setScore(s => s + price);
    setPhase('result');
  };
  
  if (!client) return null;
  
  return (
    <div className="dealt-v2">
      {/* Header */}
      <div className="dealt-v2-header">
        <button className="back-btn" onClick={goBack}>← Back</button>
        <span className="game-title">💊 DEALT: Read the Fiend</span>
        <span className="round-info">Round {round}</span>
      </div>
      
      {/* Stats bar */}
      <div className="stats-bar">
        <div className="stat-item">
          <span className="stat-label">Score</span>
          <span className="stat-value">${score}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Traffic</span>
          <span className="stat-value" style={{ color: traffic > 60 ? '#44ff44' : traffic > 30 ? '#ffaa00' : '#ff4444' }}>
            {traffic}%
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Timer</span>
          <span className="stat-value" style={{ color: timer < 5 ? '#ff4444' : '#fff' }}>{timer}s</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Heat</span>
          <span className="stat-value">🔥{player.heat}%</span>
        </div>
      </div>
      
      {/* Client Card */}
      <div className="client-display">
        <div className="client-avatar-large" style={{ background: `linear-gradient(135deg, ${generatePlaceholderAvatar(client.name).includes('#') ? '#333' : '#222'}, #111)` }}>
          <img src={client.profile.avatarUrl} alt={client.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
        </div>
        
        <div className="client-name-tag">{client.name}</div>
        <div className="client-type-tag">{client.type.replace('_', ' ').toUpperCase()}</div>
        
        {/* Visual symptoms */}
        <div className="symptoms-display">
          <div className="symptoms-label">What you see:</div>
          <div className="symptoms-list">
            {client.profile.symptoms.map((s, i) => (
              <span key={i} className="symptom-tag">{s}</span>
            ))}
          </div>
          <div className="body-language">
            <span className="bl-label">Body Language:</span> {client.profile.bodyLanguage}
          </div>
        </div>
        
        {/* Red flags */}
        {client.redFlags.length > 0 && (
          <div className="red-flags-display">
            {client.redFlags.map((f, i) => (
              <span key={i} className="red-flag">⚠️ {f}</span>
            ))}
          </div>
        )}
      </div>
      
      {/* Phase: Pick Drug */}
      <AnimatePresence mode="wait">
        {(phase === 'observe' || phase === 'pick_drug') && (
          <motion.div
            className="drug-picker"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="picker-label">What do they want?</div>
            <div className="drug-options">
              {DRUG_OPTIONS.map(drug => (
                <motion.button
                  key={drug.id}
                  className={`drug-option ${selectedDrug === drug.id ? 'selected' : ''}`}
                  onClick={() => handleDrugSelect(drug.id)}
                  whileTap={{ scale: 0.95 }}
                >
                  <span className="drug-icon">{drug.icon}</span>
                  <span className="drug-name">{drug.name}</span>
                  <span className="drug-hint">{drug.description}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
        
        {/* Phase: Set Price */}
        {phase === 'set_price' && selectedDrug && (
          <motion.div
            className="price-setter"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="price-label">
              Selling {DRUG_OPTIONS.find(d => d.id === selectedDrug)?.icon} {selectedDrug.toUpperCase()} — Set your price:
            </div>
            <div className="price-input-row">
              <span className="price-symbol">$</span>
              <input
                type="number"
                className="price-input"
                value={priceInput}
                onChange={e => setPriceInput(e.target.value)}
                placeholder="0"
                autoFocus
              />
            </div>
            <div className="price-presets">
              {[10, 25, 50, 75, 100, 150].map(p => (
                <button key={p} className="preset-btn" onClick={() => setPriceInput(p.toString())}>
                  ${p}
                </button>
              ))}
            </div>
            <div className="price-actions">
              <button className="cancel-btn" onClick={() => { setSelectedDrug(null); setPhase('pick_drug'); }}>
                ← Change Drug
              </button>
              <motion.button className="sell-btn" onClick={handleSell} whileTap={{ scale: 0.95 }}>
                💰 Sell for ${priceInput || '0'}
              </motion.button>
            </div>
          </motion.div>
        )}
        
        {/* Phase: Result */}
        {phase === 'result' && result && (
          <motion.div
            className={`result-display ${result.success ? 'success' : 'failure'}`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="result-icon">{result.success ? '✅' : '❌'}</div>
            <div className="result-message">{result.message}</div>
            {result.money !== 0 && (
              <div className={`result-money ${result.money > 0 ? 'positive' : 'negative'}`}>
                {result.money > 0 ? '+' : ''}${result.money}
              </div>
            )}
            <motion.button className="next-btn" onClick={nextClient} whileTap={{ scale: 0.95 }}>
              Next Customer →
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DealtSymptoms;
