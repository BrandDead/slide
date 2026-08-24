// ============================================================
// Beta Gate smoke tests (#45)
// One passing assertion per core pillar proves the module boots and its
// primary contract holds. These are deliberately shallow — the deep
// coverage lives in each system's own test file — so a regression in any
// pillar fails fast here before a beta build ships.
// ============================================================
import { describe, it, expect } from 'vitest';

describe('beta gate — core pillars smoke', () => {
  it('territory: Block DNA library loads with all tiers represented', async () => {
    const { BLOCK_DNA_LIBRARY, getDNAByTier } = await import('../config/blockDNA');
    expect(BLOCK_DNA_LIBRARY.length).toBeGreaterThanOrEqual(15);
    for (const tier of ['starter', 'mid', 'high', 'elite'] as const) {
      expect(getDNAByTier(tier).length).toBeGreaterThan(0);
    }
  });

  it('territory: address → DNA resolves deterministically with no Mapbox call', async () => {
    const { resolveBlockDNA } = await import('../utils/blockDNAResolver');
    const a = resolveBlockDNA(26.1186, -80.1575, '1208 W Las Olas Blvd');
    const b = resolveBlockDNA(26.1186, -80.1575, '1208 W Las Olas Blvd');
    expect(a.dna.id).toBe(b.dna.id);
    expect(a.zoneLayout).toHaveLength(8);
  });

  it('economy: block store computes DNA-scaled income', async () => {
    const { useBlockStore } = await import('../stores/blockStore');
    const { generateDefaultGrid } = useBlockStore.getState();
    const grid = generateDefaultGrid();
    expect(grid).toHaveLength(8);
    expect(grid[0]).toHaveLength(8);
    // A dealer on a street cell earns more than on an alley cell.
    expect(grid[0][0].incomeModifier).toBeGreaterThan(grid[4][2].incomeModifier);
  });

  it('combat: encounter preparation builds terrain + crews from a block', async () => {
    const { prepareEncounter } = await import('../game/combat/prepareEncounter');
    const { useBlockStore } = await import('../stores/blockStore');
    const grid = useBlockStore.getState().generateDefaultGrid();
    const prep = prepareEncounter({
      id: 'smoke-block',
      address: '1208 W Las Olas Blvd',
      lat: 26.1186,
      lng: -80.1575,
      owner: 'player',
      grid,
      placements: [],
      incomePerTick: 0,
      heat: 1,
      morale: 70,
      members: 0,
      viewMode: 'topdown',
      pendingIncome: 0,
    });
    expect(prep.terrain).toHaveLength(8);
    expect(prep.crew.length).toBeGreaterThan(0);
    expect(prep.opposition.length).toBeGreaterThan(0);
  });

  it('npc: ghost crews seed and hold persistent state', async () => {
    const { useGhostStore } = await import('../stores/ghostCrewStore');
    useGhostStore.setState({ crews: {}, feed: [], tickIndex: 0, tickActive: false });
    useGhostStore.getState().seedCrews();
    const crews = Object.values(useGhostStore.getState().crews);
    expect(crews.length).toBeGreaterThanOrEqual(3);
    expect(crews.every((c) => c.name && c.roster.length > 0)).toBe(true);
  });

  it('assets: runtime manifest has entries within budget', async () => {
    const manifest = (await import('../assets/runtimeManifest.json')).default;
    expect(manifest.entries.length).toBeGreaterThan(100);
    expect(manifest.totalBytes / 1048576).toBeLessThanOrEqual(manifest.budgetMB);
  });

  it('assets: world actor resolver returns art for every core role', async () => {
    const { getWorldActor } = await import('../render/worldActorResolver');
    for (const role of ['dealer', 'shooter', 'enforcer', 'lookout', 'driver'] as const) {
      const actor = getWorldActor(role, 'idle', 'street');
      expect(actor, `no street art for ${role}`).toBeTruthy();
      expect(actor!.url).toMatch(/\.webp$/);
    }
  });
});
