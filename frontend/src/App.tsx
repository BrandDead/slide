// ============================================================
// App.tsx - Main Application Component
// Sprint 8: Auth, Salary System, NPC Retaliation, new screens
// Birthday-demo patch: VITE_DEMO_MODE=1 bypasses Supabase auth
//   and seeds a pre-claimed block so the full
//   claim → place → earn → combat loop is playable without creds.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useNavigationStore, usePlayerStore } from './stores/gameStore';
import { useGameLoop } from './utils/gameLoopEngine';
import { useHeatDecay } from './hooks/useHeatDecay';
import { useRaidCheck } from './hooks/useRaidCheck';
import { useBlockSync } from './hooks/useBlockSync';
import { useEmpireHydration } from './hooks/useEmpireHydration';
import { useGhostCrewSync } from './hooks/useGhostCrewSync';
import { useSoundManager } from './hooks/useSoundManager';
import { useSalarySystem } from './hooks/useSalarySystem';
import PayrollModal from './components/economy/PayrollModal';
import { useNPCRetaliation } from './utils/npcRetaliationEngine';
import { useTutorialProgressStore } from './stores/tutorialProgressStore';
import { useNPCTick } from './stores/npcStore';
import { useGhostTick } from './stores/ghostCrewStore';
import { useTerritoryStore, useGangStore } from './stores/gameStore';
import { supabase } from './services/supabase';
import type { User } from '@supabase/supabase-js';
import type { GangProfile } from './types/game.types';
import { isAccountSwitch, toPlayerIdentity } from './utils/authPlayer';
import { IS_DEMO_MODE, seedDemoState } from './utils/demoSeed';
import { useBlockStore } from './stores/blockStore';
import { useShoeboxStore } from './stores/useShoeboxStore';

// Layout
import OSShell from './components/layout/OSShell';
import GameEventOverlay from './components/layout/GameEventOverlay';
import RaidEventOverlay from './components/layout/RaidEventOverlay';
import GetBackClock from './components/common/GetBackClock';
import TutorialOverlay from './components/tutorial/TutorialOverlay';
import NPCThreatBanner from './components/map/NPCThreatBanner';
import GhostThreatBanner from './components/map/GhostThreatBanner';

// Always-loaded core screens (gate, desktop shell, light hubs)
import DealtMode from './components/dealt/DealtMode';
import Contacts from './components/contacts/Contacts';
import Onboarding from './components/onboarding/Onboarding';
import SettingsPage from './components/settings/SettingsPage';
import AuthScreen from './components/auth/AuthScreen';
import AgeGate, { initialAgeAffirmed } from './components/compliance/AgeGate';
import SplashScreen from './components/layout/SplashScreen';
import { LazyRoute } from './components/system/RouteLoadBoundary';

// Lazy-loaded mini-games and heavy screens
const TerritoryMap      = React.lazy(() => import('./components/map/TerritoryMap'));
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
const BipNDipGame       = React.lazy(() => import('./components/topdown/BipNDipGame'));
const PoliceRaidGame    = React.lazy(() => import('./components/raid/PoliceRaidGame'));
const GangManagement    = React.lazy(() => import('./components/gang/GangManagement'));
const DealtModeSelector = React.lazy(() => import('./components/dealt-v2/DealtModeSelector'));
const CocaineCrush      = React.lazy(() => import('./components/cocaine-crush/CocaineCrush'));
const WeeklyUpdateRoute = React.lazy(() => import('./components/news/WeeklyUpdateRoute'));
const PhoneApp          = React.lazy(() => import('./components/phone/PhoneApp'));
const AttackPlanner     = React.lazy(() => import('./components/missions/AttackPlanner'));
const TrapApp           = React.lazy(() => import('./components/trap/TrapApp'));
const MostWantedApp     = React.lazy(() => import('./components/economy/MostWantedApp'));
const BlockLoopDesk     = React.lazy(() => import('./components/layout/BlockLoopDesk'));

import './App.css';

const pageVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit:    { opacity: 0, x: -20 },
};

/**
 * Development-only deep links keep each phone app independently testable
 * without making normal production navigation depend on URL routing.
 */
const DEMO_APP_IDS = new Set([
  'home', 'map', 'dealt', 'dealt_v2', 'contacts', 'settings', 'slide',
  'driveby', 'topdown', 'bipndip', 'raid', 'gang_hq', 'alchemy', 'shoebox',
  'market', 'missions', 'planner', 'casino', 'graffiti', 'cocaine_crush',
  'leaderboard', 'news', 'phone', 'trap', 'most_wanted', 'block_loop',
]);

function demoAppFromLocation(): string | null {
  const candidate = new URLSearchParams(window.location.search).get('app');
  return candidate && DEMO_APP_IDS.has(candidate) ? candidate : null;
}

// ─── App ──────────────────────────────────────────────────────
const App: React.FC = () => {
  const { currentApp, navigateTo } = useNavigationStore();
  const { player, updatePlayer, logout } = usePlayerStore();
  const [showOnboarding, setShowOnboarding] = useState(!player?.gangProfile);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const reduceMotion = useReducedMotion();
  const [ageAffirmed, setAgeAffirmed] = useState(() => initialAgeAffirmed());

  const hydrateAuthenticatedPlayer = useCallback((user: User | null) => {
    setAuthUser(user);
    if (!user) return;

    const cachedPlayer = usePlayerStore.getState().player;
    const switchedAccounts = isAccountSwitch(cachedPlayer.id, user.id);

    if (switchedAccounts) {
      // Player persistence predates account-scoped storage. Reset the player profile
      // rather than leaking the previous account's gang, money, or progression.
      logout();
    }

    updatePlayer(toPlayerIdentity(user));

    const hydratedPlayer = usePlayerStore.getState().player;
    setShowOnboarding(switchedAccounts || !hydratedPlayer.gangProfile);
  }, [logout, updatePlayer]);

  // Core game systems
  const gameLoop = useGameLoop();
  useHeatDecay();
  const { raidBlockId, clearRaid } = useRaidCheck();
  useBlockSync(!IS_DEMO_MODE);
  useEmpireHydration(Boolean(authUser) && authChecked && !IS_DEMO_MODE);
  useGhostCrewSync(authUser?.id ?? null, Boolean(authUser) && authChecked && !IS_DEMO_MODE);
  useSoundManager();
  const salarySystem = useSalarySystem();
  useNPCRetaliation();
  // NPC AI Tick — drives rival gang behavior every 30s
  const playerBlockIds = useTerritoryStore((s) => s.blocks.map((b) => b.id));
  useNPCTick(playerBlockIds);
  // Demo/offline sessions retain the local deterministic rival loop. An
  // authenticated production session hydrates durable crew state instead, so
  // browser ticks cannot drift ahead of the server-led world timeline.
  useGhostTick(IS_DEMO_MODE || !authChecked || !authUser);

  const { completeStep } = useTutorialProgressStore();

  // Demo mode — seed stores once on mount and skip all auth gates.
  // In production (VITE_DEMO_MODE !== '1') this branch is dead code and
  // tree-shaken by Vite/Rollup.
  useEffect(() => {
    if (IS_DEMO_MODE) {
      seedDemoState();
      const requestedApp = demoAppFromLocation();
      if (requestedApp) navigateTo(requestedApp);
      setAuthChecked(true);
      setShowOnboarding(false);
      // Persist rehydration can overwrite the seed with a stale local snapshot.
      const persistStores = [useBlockStore, useShoeboxStore, useGangStore] as Array<{
        persist?: {
          hasHydrated?: () => boolean;
          onFinishHydration?: (cb: () => void) => () => void;
        };
      }>;
      const unsubs: Array<() => void> = [];
      for (const store of persistStores) {
        const api = store.persist;
        if (!api?.onFinishHydration) continue;
        unsubs.push(api.onFinishHydration(() => seedDemoState()));
      }
      return () => unsubs.forEach((u) => u());
    }
    // Check Supabase auth session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      hydrateAuthenticatedPlayer(session?.user ?? null);
      setAuthChecked(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      hydrateAuthenticatedPlayer(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [hydrateAuthenticatedPlayer, navigateTo]);

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
      case 'dealt_v2':    return <LazyRoute label="DEALT"><DealtModeSelector key="dealt_v2" /></LazyRoute>;
      case 'contacts':    return <Contacts key="contacts" />;
      case 'map':         return <LazyRoute label="MAP" testId="route-map"><TerritoryMap key="map" /></LazyRoute>;
      case 'settings':    return <SettingsPage key="settings" />;
      // Lazy-loaded screens wrapped in Suspense + recovery
      case 'slide':       return <LazyRoute label="SLIDE"><SlideGame key="slide" /></LazyRoute>;
      case 'driveby':     return <LazyRoute label="Drive-by"><DriveByGame key="driveby" /></LazyRoute>;
      case 'topdown':     return <LazyRoute label="Top-down"><TopDownShooter key="topdown" /></LazyRoute>;
      case 'bipndip':     return <LazyRoute label="Bip N Dip"><BipNDipGame key="bipndip" /></LazyRoute>;
      case 'raid':        return <LazyRoute label="Raid"><PoliceRaidGame key="raid" /></LazyRoute>;
      case 'gang_hq':     return <LazyRoute label="Crew"><GangManagement key="gang_hq" /></LazyRoute>;
      case 'alchemy':     return <LazyRoute label="Cook"><AlchemyLab key="alchemy" /></LazyRoute>;
      case 'shoebox':     return <LazyRoute label="Shoebox"><Shoebox key="shoebox" /></LazyRoute>;
      case 'market':      return <LazyRoute label="Market"><Market key="market" /></LazyRoute>;
      case 'missions':    return <LazyRoute label="Missions"><Missions key="missions" /></LazyRoute>;
      case 'planner':     return <LazyRoute label="Planner"><AttackPlanner key="planner" /></LazyRoute>;
      case 'casino':      return <LazyRoute label="Casino"><Casino key="casino" /></LazyRoute>;
      case 'graffiti':    return <LazyRoute label="Graffiti"><GraffitiGame key="graffiti" /></LazyRoute>;
      case 'cocaine_crush': return <LazyRoute label="Crush"><CocaineCrush key="cocaine_crush" /></LazyRoute>;
      case 'leaderboard': return <LazyRoute label="Leaderboard"><Leaderboard key="leaderboard" /></LazyRoute>;
      case 'news':        return <LazyRoute label="News"><WeeklyUpdateRoute key="news" /></LazyRoute>;
      case 'phone':       return <LazyRoute label="Phone"><PhoneApp key="phone" /></LazyRoute>;
      case 'trap':        return <LazyRoute label="Trap"><TrapApp key="trap" /></LazyRoute>;
      case 'most_wanted': return <LazyRoute label="Most Wanted"><MostWantedApp key="most_wanted" /></LazyRoute>;
      case 'block_loop':  return (
        <LazyRoute label="Las Olas STRIP" testId="route-block-loop">
          <BlockLoopDesk key="block_loop" />
        </LazyRoute>
      );
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

  // Mature-content notice must be accepted before account creation or gameplay.
  // Demo evaluation builds keep this gate; acknowledgement is local-only.
  if (!ageAffirmed) {
    return <AgeGate evaluationBuild={IS_DEMO_MODE} onConfirm={() => setAgeAffirmed(true)} />;
  }

  // Show loading while checking auth — cinematic splash (Sprint 16, P0)
  if (!authChecked) {
    return <SplashScreen label="LOADING" />;
  }

  // Show auth screen if not logged in (skipped in demo mode)
  if (!IS_DEMO_MODE && !authUser) {
    return <AuthScreen onAuthSuccess={hydrateAuthenticatedPlayer} />;
  }

  // Show onboarding if gang not set up yet (skipped in demo mode)
  if (!IS_DEMO_MODE && showOnboarding) {
    return <Onboarding onComplete={handleOnboardingCompleteWithTutorial} />;
  }

  return (
    <div className="app-container">
      {/* NPC threat banner — fixed top bar, shows on any screen */}
      <NPCThreatBanner />
      {/* Ghost crew activity banner — surfaces rival claims/attacks (#81) */}
      <GhostThreatBanner />
      <TutorialOverlay hidden={currentApp === 'block_loop'} />

      {/* Get Back shot clock — global HUD. Hides itself when no debt is open. */}
      <GetBackClock />

      {/* Payroll modal — renders when Shoebox can't cover weekly wages */}
      {salarySystem.payrollDue && <PayrollModal />}

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
          variants={reduceMotion ? undefined : pageVariants}
          initial={reduceMotion ? false : 'initial'}
          animate={reduceMotion ? undefined : 'animate'}
          exit={reduceMotion ? undefined : 'exit'}
          transition={{ duration: reduceMotion ? 0 : 0.2, ease: 'easeInOut' }}
          className="page-container"
        >
          {renderCurrentApp()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default App;
