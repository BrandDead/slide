// ============================================================
// useSwipeNavigation — React hook
// Swipe left/right to cycle through the main app screens.
// Wraps useTouchGestures with the navigation store.
// Sprint: mobile-leaderboard-onboarding-batch4
// ============================================================

import { useCallback } from 'react';
import { useNavigationStore } from '../stores/gameStore';
import { useTouchGestures } from './useTouchGestures';

// Ordered list of apps for swipe cycling
const APP_ORDER = [
  'map',
  'contacts',
  'dealt',
  'slide',
  'driveby',
  'alchemy',
  'shoebox',
  'market',
  'missions',
  'casino',
  'settings',
] as const;

type AppId = typeof APP_ORDER[number];

export function useSwipeNavigation<T extends HTMLElement>() {
  const { currentApp, navigateTo } = useNavigationStore();

  const handleSwipeLeft = useCallback(() => {
    const idx = APP_ORDER.indexOf(currentApp as AppId);
    if (idx === -1) return;
    const next = APP_ORDER[(idx + 1) % APP_ORDER.length];
    navigateTo(next);
  }, [currentApp, navigateTo]);

  const handleSwipeRight = useCallback(() => {
    const idx = APP_ORDER.indexOf(currentApp as AppId);
    if (idx === -1) return;
    const prev = APP_ORDER[(idx - 1 + APP_ORDER.length) % APP_ORDER.length];
    navigateTo(prev);
  }, [currentApp, navigateTo]);

  const ref = useTouchGestures<T>({
    threshold: 60,
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
  });

  return ref;
}
