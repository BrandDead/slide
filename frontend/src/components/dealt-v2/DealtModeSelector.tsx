// ============================================================
// DealtModeSelector - Choose between 3 DEALT game variants
// 1. Classic (Tinder-style swipe dealing)
// 2. Symptoms (Read the fiend, match drug to symptoms)
// 3. Speed Deals (Fast math, accept/decline under pressure)
// ============================================================

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigationStore } from '../../stores/gameStore';
import DealtMode from '../dealt/DealtMode';
import DealtSymptoms from './DealtSymptoms';
import DealtSpeed from './DealtSpeed';
import './DealtV2.css';

type DealtVariant = 'selector' | 'classic' | 'symptoms' | 'speed';

const DealtModeSelector: React.FC = () => {
  const { goBack } = useNavigationStore();
  const [variant, setVariant] = useState<DealtVariant>('selector');
  
  if (variant === 'classic') return <DealtMode />;
  if (variant === 'symptoms') return <DealtSymptoms />;
  if (variant === 'speed') return <DealtSpeed />;
  
  return (
    <div className="dealt-mode-selector">
      <div className="mode-selector-header">
        <button className="back-btn" onClick={goBack}>← Back</button>
        <span className="title">💊 DEALT</span>
        <span style={{ width: 60 }} />
      </div>
      
      <div className="mode-cards">
        <motion.div
          className="mode-card"
          onClick={() => setVariant('classic')}
          whileTap={{ scale: 0.98 }}
        >
          <div className="mode-card-header">
            <span className="mode-card-icon">💊</span>
            <div>
              <div className="mode-card-title">Classic Dealt</div>
              <div className="mode-card-subtitle">Swipe to Deal</div>
            </div>
          </div>
          <div className="mode-card-desc">
            Tinder-style dealing. Swipe right to accept deals, left to pass. 
            Watch for undercover cops, robberies, and snitches. Build your streak 
            for bonus multipliers. Set prices and move product.
          </div>
        </motion.div>
        
        <motion.div
          className="mode-card"
          onClick={() => setVariant('symptoms')}
          whileTap={{ scale: 0.98 }}
        >
          <div className="mode-card-header">
            <span className="mode-card-icon">👁️</span>
            <div>
              <div className="mode-card-title">Read the Fiend</div>
              <div className="mode-card-subtitle">Match Drug to Symptoms</div>
            </div>
          </div>
          <div className="mode-card-desc">
            Study each customer's appearance and body language. Red eyes and munchies? 
            Probably wants weed. Bugged out and twitching? Meth. Match the right drug 
            and set your price. Wrong read = lost traffic. Right read = profit.
          </div>
        </motion.div>
        
        <motion.div
          className="mode-card"
          onClick={() => setVariant('speed')}
          whileTap={{ scale: 0.98 }}
        >
          <div className="mode-card-header">
            <span className="mode-card-icon">⏱️</span>
            <div>
              <div className="mode-card-title">Speed Deals</div>
              <div className="mode-card-subtitle">Fast Math Under Pressure</div>
            </div>
          </div>
          <div className="mode-card-desc">
            You have your stock with known costs. Customers offer prices for specific 
            amounts. You have seconds to decide: is this deal profitable? Accept good 
            deals to build traffic. Pass on bad ones. Timer gets faster each round.
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default DealtModeSelector;
