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
  home:           'menu',
  map:            'street',
  contacts:       'street',
  gang_hq:        'street',
  dealt:          'street',
  dealt_v2:       'street',
  slide:          'combat',
  driveby:        'combat',
  topdown:        'combat',
  alchemy:        'lab',
  shoebox:        'menu',
  market:         'menu',
  missions:       'menu',
  casino:         'casino',
  cocaine_crush:  'casino',
  leaderboard:    'menu',
  news:           'street',
  settings:       'menu',
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
