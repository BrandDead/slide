// ============================================================
// useSoundManager — React hook
// Provides access to the SoundManager singleton and wires
// ambient track changes to the current app screen.
// Sprint: impact-engine-sound-perf
// ============================================================

import { useEffect, useCallback } from 'react';
import { soundManager, type SFXEvent, type AmbientTrack } from '../utils/SoundManager';
import { useNavigationStore } from '../stores/gameStore';

// Map app IDs to ambient tracks
const APP_AMBIENT_MAP: Record<string, AmbientTrack> = {
  home:       'menu',
  map:        'street',
  contacts:   'street',
  dealt:      'street',
  slide:      'combat',
  driveby:    'combat',
  alchemy:    'lab',
  shoebox:    'menu',
  market:     'menu',
  missions:   'menu',
  casino:     'casino',
  leaderboard: 'menu',
  settings:   'menu',
};

export function useSoundManager() {
  const { currentApp } = useNavigationStore();

  // Auto-switch ambient track when app changes
  useEffect(() => {
    const track = APP_AMBIENT_MAP[currentApp] ?? 'menu';
    soundManager.playAmbient(track);
  }, [currentApp]);

  const play = useCallback((event: SFXEvent) => {
    soundManager.play(event);
  }, []);

  return { play, soundManager };
}
