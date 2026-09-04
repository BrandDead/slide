import { beforeEach, describe, expect, it } from 'vitest';
import { applyDemoSeed } from '../demoSeed';
import { useBlockStore } from '../../stores/blockStore';
import { useGangStore } from '../../stores/gameStore';
import { useShoeboxStore } from '../../stores/useShoeboxStore';
import { useGhostStore } from '../../stores/ghostCrewStore';
import { computeEmpirePnl } from '../shoeboxAnalytics';

describe('applyDemoSeed empire books', () => {
  beforeEach(() => {
    useBlockStore.setState({ blocks: {}, selectedBlockId: null });
    useShoeboxStore.getState().reset();
    applyDemoSeed();
  });

  it('seeds a bounded City Briefing so the returning-player path is visually reviewable', () => {
    const feed = useGhostStore.getState().feed;
    expect(feed).toHaveLength(3);
    expect(feed.map((event) => event.id)).toEqual([
      'demo-city-brief-attack',
      'demo-city-brief-claim',
      'demo-city-brief-reinforce',
    ]);
    expect(feed[0].description).toContain('Las Olas block');
  });

  it('places a dealer so the Las Olas strip has a weekly cost and take', () => {
    const block = Object.values(useBlockStore.getState().blocks)[0];
    expect(block?.placements.some((p) => p.role === 'dealer')).toBe(true);
    expect(block?.placements.some((p) => p.role === 'enforcer')).toBe(true);
    const pnl = computeEmpirePnl({
      streetCash: 12000,
      vault: useShoeboxStore.getState().bankBalance,
      members: useGangStore.getState().members,
      blocks: [block],
      ledger: useShoeboxStore.getState().ledger,
    });
    expect(pnl.blocks[0].weeklyCost).toBeGreaterThan(0);
    expect(pnl.dealerWeekly).toBeGreaterThan(0);
    expect(pnl.enforcerWeekly).toBeGreaterThan(0);
    expect(pnl.pendingCollect).toBeGreaterThan(0);
    expect(pnl.vault).toBeGreaterThan(5000);
  });
});
