import type { Session } from '@supabase/supabase-js';
import type { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { BlockData } from '../../types/block.types';

const auth = vi.hoisted(() => ({ getSession: vi.fn(), refreshSession: vi.fn() }));
vi.mock('../../services/supabase', () => ({ supabase: { auth } }));
vi.mock('../../services/worldPersistence.service', () => ({
  commitEncounterResult: vi.fn(async () => null),
}));
vi.mock('./TacticalDiorama', () => ({
  default: () => <div>Diorama scene</div>,
}));
vi.mock('./TopDownBlock', () => ({
  default: () => <div>Legal board fallback</div>,
}));
vi.mock('../encounter/UnifiedEncounter', () => ({
  default: () => <div>Encounter board</div>,
}));
vi.mock('../ops/ModernOpsEncounter', () => ({
  default: () => <div>Modern ops</div>,
}));
vi.mock('../slide/BlockDriveByEngine', () => ({
  default: () => <div>Drive-by</div>,
}));

const BLOCK_ID = 'alice-block';
const MOUNTED_OWNER = 'mounted-local-owner';
const PENDING = 250;
const VAULT = 1_000;
const STREET = 400;

function session(userId = 'alice', token = `${userId}-token`): Session {
  return {
    access_token: token,
    refresh_token: `${userId}-refresh`,
    token_type: 'bearer',
    expires_in: 3600,
    user: {
      id: userId,
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2026-10-14T00:00:00Z',
    },
  };
}

function httpResponse(
  config: InternalAxiosRequestConfig,
  data: Record<string, unknown>,
  status = 200,
): AxiosResponse {
  return { config, status, statusText: status === 200 ? 'OK' : 'Unauthorized', headers: {}, data };
}

describe('collection during an account switch', () => {
  let axios: typeof import('axios');
  let client: AxiosInstance;
  let current: Session | null;
  let BlockModeView: typeof import('./BlockModeView').default;
  let useBlockStore: typeof import('../../stores/blockStore').useBlockStore;
  let usePlayerStore: typeof import('../../stores/gameStore').usePlayerStore;
  let useShoeboxStore: typeof import('../../stores/useShoeboxStore').useShoeboxStore;

  beforeAll(async () => {
    axios = await import('axios');
    client = axios.default.create();
    const create = vi.spyOn(axios.default, 'create').mockReturnValue(client);
    ({ default: BlockModeView } = await import('./BlockModeView'));
    ({ useBlockStore } = await import('../../stores/blockStore'));
    ({ usePlayerStore } = await import('../../stores/gameStore'));
    ({ useShoeboxStore } = await import('../../stores/useShoeboxStore'));
    create.mockRestore();
  });

  beforeEach(() => {
    localStorage.clear();
    current = session('alice');
    auth.getSession.mockReset();
    auth.refreshSession.mockReset();
    auth.getSession.mockImplementation(async () => ({ data: { session: current }, error: null }));
    auth.refreshSession.mockImplementation(async () => ({ data: { session: current }, error: null }));
    client.defaults.adapter = vi.fn(async (config) => httpResponse(config, { ok: true }));

    const block: BlockData = {
      id: BLOCK_ID,
      address: '1208 W Las Olas',
      lat: 26.1195,
      lng: -80.142,
      owner: 'player',
      grid: useBlockStore.getState().generateDefaultGrid(),
      placements: [],
      incomePerTick: 40,
      heat: 1,
      morale: 80,
      members: 0,
      viewMode: 'topdown',
      pendingIncome: PENDING,
    };
    useBlockStore.setState({
      blocks: { [BLOCK_ID]: block },
      selectedBlockId: BLOCK_ID,
      activeDriveBys: {},
      isPlacementMode: false,
      pendingPlacementMemberId: null,
      pendingPlacementMember: null,
    });
    usePlayerStore.setState({
      player: {
        ...usePlayerStore.getState().player,
        id: MOUNTED_OWNER,
        money: STREET,
        heat: 0,
      },
    });
    useShoeboxStore.setState({
      bankBalance: VAULT,
      totalDeposited: VAULT,
      ledger: [],
    });
  });

  afterEach(() => {
    cleanup();
  });

  function collectButton() {
    return screen.getByRole('button', { name: `Collect $${PENDING}` });
  }

  function mountedRewards() {
    const block = useBlockStore.getState().blocks[BLOCK_ID];
    return {
      ownerId: usePlayerStore.getState().player.id,
      street: usePlayerStore.getState().player.money,
      vault: useShoeboxStore.getState().bankBalance,
      pending: block?.pendingIncome,
      ledger: useShoeboxStore.getState().ledger.map((entry) => entry.description),
    };
  }

  async function clickCollect(confirmation: string) {
    render(<BlockModeView initialBlockId={BLOCK_ID} />);
    fireEvent.click(collectButton());
    expect(await screen.findByText(confirmation)).toBeInTheDocument();
  }

  it('does not pay the mounted local owner when a committed collect changes accounts', async () => {
    client.defaults.adapter = vi.fn(async (config) => {
      current = session('bob');
      return httpResponse(config, {
        success: true,
        collected: PENDING,
        player: { cash: 9_000, heat: 4 },
        block: { id: BLOCK_ID },
      });
    });

    await clickCollect('Account changed. Collection was not applied to this save.');

    expect(mountedRewards()).toEqual({
      ownerId: MOUNTED_OWNER,
      street: STREET,
      vault: VAULT,
      pending: PENDING,
      ledger: [],
    });
    expect(client.defaults.adapter).toHaveBeenCalledTimes(1);
  });

  it('does not pay the mounted local owner when collect is unauthorized after the account changes', async () => {
    client.defaults.adapter = vi.fn(async (config) => {
      current = session('bob');
      throw new axios.AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, {
        ...httpResponse(config, { error: 'unauthorized' }, 401),
        status: 401,
        statusText: 'Unauthorized',
      });
    });

    await clickCollect('Account changed. Collection was not applied to this save.');

    expect(mountedRewards()).toEqual({
      ownerId: MOUNTED_OWNER,
      street: STREET,
      vault: VAULT,
      pending: PENDING,
      ledger: [],
    });
    expect(client.defaults.adapter).toHaveBeenCalledTimes(1);
    expect(auth.refreshSession).not.toHaveBeenCalled();
  });

  it('applies one same-account collection exactly once, including a double tap', async () => {
    client.defaults.adapter = vi.fn(async (config) => httpResponse(config, {
      success: true,
      collected: PENDING,
      player: { cash: 650, heat: 1 },
      block: { id: BLOCK_ID },
    }));

    render(<BlockModeView initialBlockId={BLOCK_ID} />);
    const button = collectButton();
    fireEvent.click(button);
    fireEvent.click(button);
    expect(await screen.findByText('Collected $250!')).toBeInTheDocument();

    expect(client.defaults.adapter).toHaveBeenCalledTimes(1);
    expect(mountedRewards()).toMatchObject({
      ownerId: MOUNTED_OWNER,
      street: 650,
      vault: VAULT + PENDING,
      pending: 0,
    });
    expect(useShoeboxStore.getState().ledger).toHaveLength(1);
    expect(useShoeboxStore.getState().ledger[0]).toMatchObject({
      type: 'block_income',
      amount: PENDING,
      blockId: BLOCK_ID,
    });
  });

  it('still collects once locally when the same account is offline', async () => {
    client.defaults.adapter = vi.fn(async () => {
      throw new axios.AxiosError('offline');
    });

    render(<BlockModeView initialBlockId={BLOCK_ID} />);
    const button = collectButton();
    fireEvent.click(button);
    fireEvent.click(button);
    expect(await screen.findByText('Collected $250')).toBeInTheDocument();

    expect(mountedRewards()).toMatchObject({
      ownerId: MOUNTED_OWNER,
      street: STREET,
      vault: VAULT + PENDING,
      pending: 0,
    });
    expect(useShoeboxStore.getState().ledger).toHaveLength(1);
  });
});
