// ============================================================
// App.tsx - Main Application Component
// ============================================================

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigationStore } from './stores/gameStore';

// Layout Components
import OSShell from './components/layout/OSShell';

// Game Mode Components
import DealtMode from './components/dealt/DealtMode';
import Contacts from './components/contacts/Contacts';
import SlideGame from './components/slide/SlideGame';
import DriveByGame from './components/driveby/DriveByGame';
import AlchemyLab from './components/alchemy/AlchemyLab';
import TerritoryMap from './components/map/TerritoryMap';

import './App.css';

// Placeholder components for modes still in development
const PlaceholderScreen: React.FC<{ title: string; icon: string }> = ({ title, icon }) => {
  const { goBack } = useNavigationStore();
  
  return (
    <div className="placeholder-screen">
      <motion.button className="back-button" onClick={goBack} whileTap={{ scale: 0.9 }}>
        ← Back
      </motion.button>
      <div className="placeholder-content">
        <span className="placeholder-icon">{icon}</span>
        <h2>{title}</h2>
        <p>Coming Soon</p>
      </div>
    </div>
  );
};

const pageVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

const App: React.FC = () => {
  const { currentApp } = useNavigationStore();

  const renderCurrentApp = () => {
    switch (currentApp) {
      case 'home':
        return <OSShell key="home" />;
      
      case 'dealt':
        return <DealtMode key="dealt" />;
      
      case 'contacts':
        return <Contacts key="contacts" />;
      
      case 'slide':
        return <SlideGame key="slide" />;
      
      case 'driveby':
        return <DriveByGame key="driveby" />;
      
      case 'alchemy':
        return <AlchemyLab key="alchemy" />;
      
      case 'map':
        return <TerritoryMap key="map" />;
      
      case 'shoebox':
        return <PlaceholderScreen key="shoebox" title="SHOEBOX" icon="💰" />;
      
      case 'market':
        return <PlaceholderScreen key="market" title="UNDERWORLD MARKET" icon="🏪" />;
      
      case 'missions':
        return <PlaceholderScreen key="missions" title="MISSION CONTROL" icon="📋" />;
      
      case 'casino':
        return <PlaceholderScreen key="casino" title="CASINO" icon="🎰" />;
      
      case 'phone':
        return <PlaceholderScreen key="phone" title="PHONE" icon="📱" />;
      
      case 'settings':
        return <PlaceholderScreen key="settings" title="SETTINGS" icon="⚙️" />;
      
      default:
        return <OSShell key="home" />;
    }
  };

  return (
    <div className="app-container">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentApp}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="page-container"
        >
          {renderCurrentApp()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default App;
