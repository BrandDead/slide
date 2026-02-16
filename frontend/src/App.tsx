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
// import SlideGame from './components/slide/SlideGame';
// import DriveByGame from './components/driveby/DriveByGame';
// import AlchemyLab from './components/alchemy/AlchemyLab';
// import ShoeboxApp from './components/economy/ShoeboxApp';
// import MapView from './components/map/MapView';
// import MissionControl from './components/missions/MissionControl';
// import CasinoLobby from './components/casino/CasinoLobby';

import './App.css';

// Placeholder components for unfinished modes
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
        return <PlaceholderScreen key="slide" title="SLIDE" icon="🎯" />;
      
      case 'driveby':
        return <PlaceholderScreen key="driveby" title="DRIVE-BY" icon="🚗" />;
      
      case 'alchemy':
        return <PlaceholderScreen key="alchemy" title="COOK LAB" icon="⚗️" />;
      
      case 'shoebox':
        return <PlaceholderScreen key="shoebox" title="SHOEBOX" icon="💰" />;
      
      case 'market':
        return <PlaceholderScreen key="market" title="UNDERWORLD MARKET" icon="🏪" />;
      
      case 'map':
        return <PlaceholderScreen key="map" title="TERRITORY MAP" icon="📍" />;
      
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
