// ============================================================
// App.tsx - Main Application Component
// Sprint 8: Auth, Salary System, NPC Retaliation, new screens
// ============================================================

import React, { Suspense, useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigationStore, usePlayerStore } from './stores/gameStore';
import { useGameLoop } from './utils/gameLoopEngine';
import { useHeatDecay } from './hooks/useHeatDecay';
import { useRaidCheck } from './hooks/useRaidCheck';
import { useBlockSync } from './hooks/useBlockSync';
import { useSoundManager } from './hooks/useSoundManager';
import { useSalarySystem } from './hooks/useSalarySystem';
import { useNPCRetaliation } from './utils/npcRetaliationEngine';
import { useTutorialProgressStore } from './stores/tutorialProgressStore';
import { supabase } from './services/supabase';
import type { GangProfile } from './types/game.types';

// Layout
import OSShell from './components/layout/OSShell';
import GameEventOverlay from './components/layout/GameEventOverlay';
import RaidEventOverlay from './components/layout/RaidEventOverlay';
import TutorialOverlay from './components/tutorial/TutorialOverlay';

// Always-loaded core screens
import DealtMode from './components/dealt/DealtMode';
import Contacts from './components/contacts/Contacts';
import TerritoryMap from './components/map/TerritoryMap';
import Onboarding from './components/onboarding/Onboarding';
import SettingsPage from './components/settings/SettingsPage';
import AuthScreen from './components/auth/AuthScreen';

// Lazy-loaded mini-games and heavy screens
const SlideGame         = React.lazy(() => import('./components/slide/SlideGame'));
const DriveByGame       = React.lazy(() => import('./components/driveby/DriveByGame'));
const AlchemyLab        = React.lazy(() => import('./components/alchemy/AlchemyLab'));
const GraffitiGame      = React.lazy(() => import('./components/graffiti/GraffitiGame'));
const Casino            = React.lazy(() => import('./components/casino/Casino'));
const Shoebox           = React.lazy(() => import('./components/economy/Shoebox'));
const Market            = React.lazy(() => import('./components/economy/Market'));
const Missions          = React.lazy(() => import('./components/missions/Missions'));
const Leaderboard       = React.lazy(() => import('./components/hub/Leaderboard'));
const TopDownShooter    = React.lazy(() => import('./components/topdown/TopDownShooter'));
const GangManagement    = React.lazy(() => import('./components/gang/GangManagement'));
const DealtModeSelector = React.lazy(() => import('./components/dealt-v2/DealtModeSelector'));
const CocaineCrush      = React.lazy(() => import('./components/cocaine-crush/CocaineCrush'));
const WeeklyUpdateRoute = React.lazy(() => import('./components/news/WeeklyUpdateRoute'));
const PhoneApp          = React.lazy(() => import('./components/phone/PhoneApp'));
const AttackPlanner     = React.lazy(() => import('./components/missions/AttackPlanner'));

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

const pageVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit:    { opacity: 0, x: -20 },
};

// ─── App ──────────────────────────────────────────────────────
const App: React.FC = () => {
  const { currentApp } = useNavigationStore();
  const { player, updatePlayer } = usePlayerStore();
  const [showOnboarding, setShowOnboarding] = useState(!player?.gangProfile);
  const [authUser, setAuthUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Core game systems
  const gameLoop = useGameLoop();
  useHeatDecay();
  const { raidBlockId, clearRaid } = useRaidCheck();
  useBlockSync();
  useSoundManager();
  useSalarySystem();
  useNPCRetaliation();

  const { completeStep } = useTutorialProgressStore();

  // Check Supabase auth session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user ?? null);
      setAuthChecked(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

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
      case 'dealt':       return <DealtMode key="dealt" />;
      case 'dealt_v2':    return <Suspense fallback={<LazyFallback />}><DealtModeSelector key="dealt_v2" /></Suspense>;
      case 'contacts':    return <Contacts key="contacts" />;
      case 'map':         return <TerritoryMap key="map" />;
      case 'settings':    return <SettingsPage key="settings" />;
      // Lazy-loaded screens wrapped in Suspense
      case 'slide':       return <Suspense fallback={<LazyFallback />}><SlideGame key="slide" /></Suspense>;
      case 'driveby':     return <Suspense fallback={<LazyFallback />}><DriveByGame key="driveby" /></Suspense>;
      case 'topdown':     return <Suspense fallback={<LazyFallback />}><TopDownShooter key="topdown" /></Suspense>;
      case 'gang_hq':     return <Suspense fallback={<LazyFallback />}><GangManagement key="gang_hq" /></Suspense>;
      case 'alchemy':     return <Suspense fallback={<LazyFallback />}><AlchemyLab key="alchemy" /></Suspense>;
      case 'shoebox':     return <Suspense fallback={<LazyFallback />}><Shoebox key="shoebox" /></Suspense>;
      case 'market':      return <Suspense fallback={<LazyFallback />}><Market key="market" /></Suspense>;
      case 'missions':    return <Suspense fallback={<LazyFallback />}><Missions key="missions" /></Suspense>;
      case 'planner':     return <Suspense fallback={<LazyFallback />}><AttackPlanner key="planner" /></Suspense>;
      case 'casino':      return <Suspense fallback={<LazyFallback />}><Casino key="casino" /></Suspense>;
      case 'graffiti':    return <Suspense fallback={<LazyFallback />}><GraffitiGame key="graffiti" /></Suspense>;
      case 'cocaine_crush': return <Suspense fallback={<LazyFallback />}><CocaineCrush key="cocaine_crush" /></Suspense>;
      case 'leaderboard': return <Suspense fallback={<LazyFallback />}><Leaderboard key="leaderboard" /></Suspense>;
      case 'news':        return <Suspense fallback={<LazyFallback />}><WeeklyUpdateRoute key="news" /></Suspense>;
      case 'phone':       return <Suspense fallback={<LazyFallback />}><PhoneApp key="phone" /></Suspense>;
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

  // Show loading while checking auth
  if (!authChecked) {
    return (
      <div style={{ height: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#4ade80', fontFamily: 'monospace', fontSize: 14 }}>Loading...</div>
      </div>
    );
  }

  // Show auth screen if not logged in
  if (!authUser) {
    return <AuthScreen onAuthSuccess={(user) => setAuthUser(user)} />;
  }

  // Show onboarding if gang not set up yet
  if (showOnboarding) {
    return <Onboarding onComplete={handleOnboardingCompleteWithTutorial} />;
  }

  return (
    <div className="app-container">
      <TutorialOverlay />

      {raidBlockId && (
        <RaidEventOverlay blockId={raidBlockId} onClose={clearRaid} />
      )}

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
