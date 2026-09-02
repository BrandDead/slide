import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc, from, upsert } = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock('./supabase', () => ({
  supabase: { rpc, from },
}));

import { persistBlock } from './blockPersistence.service';

const block = {
  id: '11111111-1111-4111-8111-111111111111',
  address: 'Fictional Home Block',
  lat: 25.7617,
  lng: -80.1918,
  owner: 'player' as const,
  grid: [],
  placements: [],
  incomePerTick: 120,
  heat: 2,
  morale: 80,
  members: 0,
  viewMode: 'topdown' as const,
  pendingIncome: 90,
  appliedEncounterResultKeys: ['result-1'],
};

describe('blockPersistence.service authoritative projection', () => {
  beforeEach(() => {
    rpc.mockReset();
    from.mockReset();
    upsert.mockReset();
    from.mockReturnValue({ upsert });
    upsert.mockResolvedValue({ error: null });
  });

  it('uses the atomic projection RPC for UUID-backed player blocks', async () => {
    rpc.mockResolvedValue({ data: { applied: true }, error: null });

    await persistBlock(block, '11111111-1111-4111-8111-111111111111');

    expect(rpc).toHaveBeenCalledWith('persist_player_block_projection', expect.objectContaining({
      p_block_id: block.id,
      p_client_result_key: 'result-1',
      p_block_heat: 40,
      p_base_income: 120,
    }));
    expect(from).not.toHaveBeenCalled();
  });

  it('does not fall through to an unguarded upsert when the server rejects a stale projection', async () => {
    rpc.mockResolvedValue({ data: { applied: false, reason: 'stale_encounter_projection' }, error: null });

    await persistBlock(block, '11111111-1111-4111-8111-111111111111');

    expect(from).not.toHaveBeenCalled();
  });

  it('retains the legacy upsert path only when the new RPC is absent from an older server schema', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Function not found' } });

    await persistBlock(block, '11111111-1111-4111-8111-111111111111');

    expect(from).toHaveBeenCalledWith('blocks');
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      id: block.id,
      metadata: expect.objectContaining({ lastEncounterResultKey: 'result-1' }),
    }), { onConflict: 'id' });
  });
});
