import { beforeEach, describe, expect, it } from 'vitest';
import { usePlayerStore } from '../../stores/gameStore';
import { applyDemoSeed } from '../demoSeed';

function resetPlayer() {
  const player = usePlayerStore.getState().player;
  usePlayerStore.setState({
    isAuthenticated: false,
    player: {
      ...player,
      id: '',
      level: 1,
      xp: 0,
      xpToNextLevel: 100,
    },
  });
}

describe('applyDemoSeed player progression', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetPlayer();
  });

  it('keeps a numeric XP threshold for a fresh demo player', () => {
    applyDemoSeed();

    const seeded = usePlayerStore.getState().player;
    expect(seeded.id).toBe('demo-player');
    expect(seeded.xpToNextLevel).toBe(100);
    expect(Number.isFinite(seeded.xpToNextLevel)).toBe(true);

    usePlayerStore.getState().addXP(10);
    const progressed = usePlayerStore.getState().player;
    expect(progressed.level).toBe(4);
    expect(progressed.xpToNextLevel).toBe(150);
    expect(Number.isFinite(progressed.xpToNextLevel)).toBe(true);
  });

  it('preserves an advanced demo player threshold when reseeding', () => {
    usePlayerStore.setState((state) => ({
      player: {
        ...state.player,
        id: 'demo-player',
        level: 4,
        xp: 50,
        xpToNextLevel: 250,
      },
    }));

    applyDemoSeed();

    expect(usePlayerStore.getState().player).toMatchObject({
      id: 'demo-player',
      level: 4,
      xp: 50,
      xpToNextLevel: 250,
    });
  });
});
