// ============================================================
// App.tsx - Main Application Component
// Integrates game loop engine and event overlay
// ============================================================

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigationStore, usePlayerStore } from './stores/gameStore';
import { useGameLoop } from './utils/gameLoopEngine';

// Layout Components
import OSShell from './components/layout/OSShell';
import GameEventOverlay from './components/layout/GameEventOverlay';

// Game Mode Components
import DealtMode from './components/dealt/DealtMode';
import Contacts from './components/contacts/Contacts';
import SlideGame from './components/slide/SlideGame';
import DriveByGame from './components/driveby/DriveByGame';
import AlchemyLab from './components/alchemy/AlchemyLab';
import TerritoryMap from './components/map/TerritoryMap';
import Shoebox from './components/economy/Shoebox';
import Market from './components/economy/Market';
import Missions from './components/missions/Missions';
import SettingsPage from './components/settings/SettingsPage';
import Casino from './components/casino/Casino';
import GraffitiGame from './components/graffiti/GraffitiGame';
import Onboarding from './components/onboarding/Onboarding';
import CocaineCrush from './components/cocaine-crush/CocaineCrush';
import WeeklyUpdateRoute from './components/news/WeeklyUpdateRoute';
import Leaderboard from './components/hub/Leaderboard';
import type { GangProfile } from './types/game.types';

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
  const { player, updatePlayer } = usePlayerStore();
  const [showOnboarding, setShowOnboarding] = React.useState(!player?.gangProfile);

  // Initialize the game loop - runs every 30 seconds
  const gameLoop = useGameLoop();

  const handleOnboardingComplete = (profile: GangProfile) => {
    updatePlayer({
      gangName: profile.name,
      gangColor: profile.primaryColor,
      gangProfile: profile,
    });
    setShowOnboarding(false);
  };

  const renderCurrentApp = () => {
    switch (currentApp) {
      case 'home':
        return (
          <OSShell
            key="home"
            gangMorale={gameLoop.gangMorale}
            incomePerMinute={gameLoop.incomePerMinute}
          />
        );

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
        return <Shoebox key="shoebox" />;

      case 'market':
        return <Market key="market" />;

      case 'missions':
        return <Missions key="missions" />;

      case 'casino':
        return <Casino key="casino" />;

      case 'graffiti':
        return <GraffitiGame key="graffiti" />;

      case 'cocaine_crush':
        return <CocaineCrush key="cocaine_crush" />;

      case 'news':
        return <WeeklyUpdateRoute key="news" />;

      case 'leaderboard':
        return <Leaderboard key="leaderboard" />;

      case 'phone':
        return <PlaceholderScreen key="phone" title="PHONE" icon="📱" />;

      case 'settings':
        return <SettingsPage key="settings" />;

      default:
        return (
          <OSShell
            key="home"
            gangMorale={gameLoop.gangMorale}
            incomePerMinute={gameLoop.incomePerMinute}
          />
        );
    }
  };

  // Show onboarding for new players
  if (showOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="app-container">
      {/* Game Event Overlay - renders above everything */}
      <GameEventOverlay
        activeRaid={gameLoop.activeRaid}
        lastEvent={gameLoop.lastEvent}
        onDismissRaid={gameLoop.dismissRaid}
        onPayBail={gameLoop.payBail}
        onLeaveMember={gameLoop.leaveMember}
      />

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
