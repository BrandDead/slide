// ============================================================
// App.tsx - Main Application Component
// Sprint 7D: Lazy-loaded mini-games for performance
// ============================================================

import React, { Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigationStore, usePlayerStore } from './stores/gameStore';
import { useGameLoop } from './utils/gameLoopEngine';
import { useHeatDecay } from './hooks/useHeatDecay';
import { useRaidCheck } from './hooks/useRaidCheck';
import { useBlockSync } from './hooks/useBlockSync';
import { useSoundManager } from './hooks/useSoundManager';
import { useTutorialProgressStore } from './stores/tutorialProgressStore';
import type { GangProfile } from './types/game.types';

// Layout
import OSShell from './components/layout/OSShell';
import GameEventOverlay from './components/layout/GameEventOverlay';
import RaidEventOverlay from './components/layout/RaidEventOverlay';
import TutorialOverlay from './components/tutorial/TutorialOverlay';

// Always-loaded core screens (small, needed immediately)
import DealtMode from './components/dealt/DealtMode';
import Contacts from './components/contacts/Contacts';
import TerritoryMap from './components/map/TerritoryMap';
import Onboarding from './components/onboarding/Onboarding';
import SettingsPage from './components/settings/SettingsPage';

// Lazy-loaded mini-games and heavy screens (Sprint 7D)
const SlideGame        = React.lazy(() => import('./components/slide/SlideGame'));
const DriveByGame      = React.lazy(() => import('./components/driveby/DriveByGame'));
const AlchemyLab       = React.lazy(() => import('./components/alchemy/AlchemyLab'));
const GraffitiGame     = React.lazy(() => import('./components/graffiti/GraffitiGame'));
const Casino           = React.lazy(() => import('./components/casino/Casino'));
const Shoebox          = React.lazy(() => import('./components/economy/Shoebox'));
const Market           = React.lazy(() => import('./components/economy/Market'));
const Missions         = React.lazy(() => import('./components/missions/Missions'));
const Leaderboard      = React.lazy(() => import('./components/hub/Leaderboard'));
const TopDownShooter   = React.lazy(() => import('./components/topdown/TopDownShooter'));
const DealtModeSelector = React.lazy(() => import('./components/dealt-v2/DealtModeSelector'));
const CocaineCrush     = React.lazy(() => import('./components/cocaine-crush/CocaineCrush'));
const WeeklyUpdateRoute = React.lazy(() => import('./components/news/WeeklyUpdateRoute'));

import './App.css';

// ─── Lazy fallback ────────────────────────────────────────────
const LazyFallback: React.FC = () => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100%', background: '#0a0a0f', color: '#4ade80',
    fontFamily: 'monospace', fontSize: 12,
  }}>
    Loading...
  </div>
);

// ─── Placeholder ──────────────────────────────────────────────
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
  exit:    { opacity: 0, x: -20 },
};

// ─── App ──────────────────────────────────────────────────────
const App: React.FC = () => {
  const { currentApp } = useNavigationStore();
  const { player, updatePlayer } = usePlayerStore();
  const [showOnboarding, setShowOnboarding] = React.useState(!player?.gangProfile);

  const gameLoop = useGameLoop();
  useHeatDecay();
  const { raidBlockId, clearRaid } = useRaidCheck();
  useBlockSync();
  useSoundManager();

  const { completeStep } = useTutorialProgressStore();

  const handleOnboardingComplete = (profile: GangProfile) => {
    updatePlayer({
      gangName: profile.name,
      gangColor: profile.primaryColor,
      gangProfile: profile,
    });
    setShowOnboarding(false);
  };

  const handleOnboardingCompleteWithTutorial = (profile: GangProfile) => {
    handleOnboardingComplete(profile);
    const reward = completeStep('gang_created');
    if (reward.cashReward > 0) updatePlayer({ money: (player?.money ?? 0) + reward.cashReward });
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
      // Classic dealt (direct) — kept for backward compat
      case 'dealt':       return <DealtMode key="dealt" />;
      // Dealt v2 selector (3 variants)
      case 'dealt_v2':    return <Suspense fallback={<LazyFallback />}><DealtModeSelector key="dealt_v2" /></Suspense>;
      case 'contacts':    return <Contacts key="contacts" />;
      case 'map':         return <TerritoryMap key="map" />;
      case 'settings':    return <SettingsPage key="settings" />;

      // Lazy-loaded screens wrapped in Suspense
      case 'slide':
        return <Suspense fallback={<LazyFallback />}><SlideGame key="slide" /></Suspense>;
      case 'driveby':
        return <Suspense fallback={<LazyFallback />}><DriveByGame key="driveby" /></Suspense>;
      case 'topdown':
        return <Suspense fallback={<LazyFallback />}><TopDownShooter key="topdown" /></Suspense>;
      case 'alchemy':
        return <Suspense fallback={<LazyFallback />}><AlchemyLab key="alchemy" /></Suspense>;
      case 'shoebox':
        return <Suspense fallback={<LazyFallback />}><Shoebox key="shoebox" /></Suspense>;
      case 'market':
        return <Suspense fallback={<LazyFallback />}><Market key="market" /></Suspense>;
      case 'missions':
        return <Suspense fallback={<LazyFallback />}><Missions key="missions" /></Suspense>;
      case 'casino':
        return <Suspense fallback={<LazyFallback />}><Casino key="casino" /></Suspense>;
      case 'graffiti':
        return <Suspense fallback={<LazyFallback />}><GraffitiGame key="graffiti" /></Suspense>;
      case 'cocaine_crush':
        return <Suspense fallback={<LazyFallback />}><CocaineCrush key="cocaine_crush" /></Suspense>;
      case 'leaderboard':
        return <Suspense fallback={<LazyFallback />}><Leaderboard key="leaderboard" /></Suspense>;
      case 'news':
        return <Suspense fallback={<LazyFallback />}><WeeklyUpdateRoute key="news" /></Suspense>;

      case 'phone':
        return <PlaceholderScreen key="phone" title="PHONE" icon="📱" />;

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

  if (showOnboarding) {
    return <Onboarding onComplete={handleOnboardingCompleteWithTutorial} />;
  }

  return (
    <div className="app-container">
      {/* Tutorial overlay */}
      <TutorialOverlay />

      {/* Block-store raid overlay */}
      {raidBlockId && (
        <RaidEventOverlay blockId={raidBlockId} onClose={clearRaid} />
      )}

      {/* Game Event Overlay */}
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
