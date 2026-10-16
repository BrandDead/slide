import type { Session } from '@supabase/supabase-js';
import type { AxiosAdapter, AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ getSession: vi.fn(), refreshSession: vi.fn() }));
vi.mock('../supabase', () => ({ supabase: { auth } }));

function session(userId = 'alice', token = `${userId}-token`): Session {
  return {
    access_token: token,
    refresh_token: `${userId}-refresh`,
    token_type: 'bearer',
    expires_in: 3600,
    user: {
      id: userId, app_metadata: {}, user_metadata: {}, aud: 'authenticated',
      created_at: '2026-10-14T00:00:00Z',
    },
  };
}

function response(config: InternalAxiosRequestConfig): AxiosResponse {
  return {
    config, status: 200, statusText: 'OK', headers: {},
    data: { player: { user_id: 'alice', username: 'Alice', cash: 100, heat: 0, level: 1, xp: 0 } },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}

describe('Flask requests follow the active Supabase session', () => {
  let api: typeof import('../api.service');
  let axios: typeof import('axios');
  let client: AxiosInstance;
  let current: Session | null;

  beforeAll(async () => {
    axios = await import('axios');
    client = axios.default.create();
    const create = vi.spyOn(axios.default, 'create').mockReturnValue(client);
    api = await import('../api.service');
    create.mockRestore();
  });

  beforeEach(() => {
    localStorage.clear();
    auth.getSession.mockReset();
    auth.refreshSession.mockReset();
    current = session();
    auth.getSession.mockImplementation(async () => ({ data: { session: current }, error: null }));
    auth.refreshSession.mockImplementation(async () => {
      current = session('alice', 'alice-rotated');
      return { data: { session: current }, error: null };
    });
    delete client.defaults.headers.common.Authorization;
    client.defaults.adapter = vi.fn(async (config) => response(config));
  });

  afterEach(() => vi.restoreAllMocks());

  function unauthorized(config: InternalAxiosRequestConfig): never {
    throw new axios.AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, {
      ...response(config), status: 401, statusText: 'Unauthorized',
    });
  }

  function requests() {
    return vi.mocked(client.defaults.adapter as AxiosAdapter).mock.calls;
  }

  it('sends the normal Supabase login token without legacy localStorage keys', async () => {
    await api.playerApi.getState();
    const config = requests()[0][0];
    expect(config.headers.get('Authorization')).toBe('Bearer alice-token');
  });

  it('uses the current account instead of a leftover legacy token', async () => {
    localStorage.setItem('access_token', 'previous-account');
    await api.playerApi.getState();
    const config = requests()[0][0];
    expect(config.headers.get('Authorization')).toBe('Bearer alice-token');
  });

  it('reads rotation and account changes for every new request', async () => {
    await api.playerApi.getState();
    current = session('alice', 'alice-new');
    await api.playerApi.getState();
    current = session('bob');
    await api.playerApi.getState();
    expect(requests().map(([config]) =>
      config.headers.get('Authorization'))).toEqual([
      'Bearer alice-token', 'Bearer alice-new', 'Bearer bob-token',
    ]);
  });

  it('removes inherited authorization after sign-out while keeping anonymous requests usable', async () => {
    current = null;
    localStorage.setItem('access_token', 'old-legacy');
    client.defaults.headers.common.Authorization = 'Bearer inherited';
    await api.blocksApi.getSupportedCities();
    const config = requests()[0][0];
    expect(config.headers.has('Authorization')).toBe(false);
    expect(auth.refreshSession).not.toHaveBeenCalled();
  });

  it('does not dispatch if reading the SDK session fails', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: new Error('session unavailable') });
    await expect(api.playerApi.getState()).rejects.toThrow('session unavailable');
    expect(client.defaults.adapter).not.toHaveBeenCalled();
  });

  it('refreshes through the SDK once and retries a request with the updated token', async () => {
    const seen: unknown[] = [];
    client.defaults.adapter = vi.fn(async (config) => {
      seen.push(config.headers.get('Authorization'));
      if (seen.length === 1) unauthorized(config);
      return response(config);
    });
    await expect(api.playerApi.getState()).resolves.toMatchObject({ user_id: 'alice' });
    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(seen).toEqual(['Bearer alice-token', 'Bearer alice-rotated']);
    expect(localStorage.getItem('access_token')).toBeNull();
  });

  it('shares one refresh between simultaneous 401 responses', async () => {
    const refresh = deferred<{ data: { session: Session }; error: null }>();
    auth.refreshSession.mockReturnValue(refresh.promise);
    client.defaults.adapter = vi.fn(async (config) => {
      if (config.headers.get('Authorization') === 'Bearer alice-token') unauthorized(config);
      return response(config);
    });
    const results = Promise.all([api.playerApi.getState(), api.playerApi.getState()]);
    await vi.waitFor(() => expect(auth.refreshSession).toHaveBeenCalledTimes(1));
    current = session('alice', 'alice-rotated');
    refresh.resolve({ data: { session: current }, error: null });
    await results;
    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(client.defaults.adapter).toHaveBeenCalledTimes(4);
  });

  it('uses an already rotated SDK token for a delayed 401 without another refresh', async () => {
    const seen: unknown[] = [];
    client.defaults.adapter = vi.fn(async (config) => {
      seen.push(config.headers.get('Authorization'));
      if (seen.length === 1) {
        current = session('alice', 'alice-new');
        unauthorized(config);
      }
      return response(config);
    });
    await api.playerApi.getState();
    expect(seen).toEqual(['Bearer alice-token', 'Bearer alice-new']);
    expect(auth.refreshSession).not.toHaveBeenCalled();
  });

  it('does not retry anonymous 401s or rely on a legacy refresh token', async () => {
    current = null;
    localStorage.setItem('refresh_token', 'legacy-refresh');
    vi.spyOn(axios.default, 'post').mockRejectedValue(new Error('legacy route must not be used'));
    client.defaults.adapter = vi.fn(async (config) => unauthorized(config));
    await expect(api.playerApi.getState()).rejects.toMatchObject({ response: { status: 401 } });
    expect(client.defaults.adapter).toHaveBeenCalledTimes(1);
    expect(auth.refreshSession).not.toHaveBeenCalled();
    expect(axios.default.post).not.toHaveBeenCalled();
  });

  it('does not loop on a second 401', async () => {
    client.defaults.adapter = vi.fn(async (config) => unauthorized(config));
    await expect(api.playerApi.getState()).rejects.toMatchObject({ response: { status: 401 } });
    expect(client.defaults.adapter).toHaveBeenCalledTimes(2);
    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
  });

  it('preserves the SDK session and rejects when refresh is temporarily unavailable', async () => {
    auth.refreshSession.mockRejectedValue(new Error('network unavailable'));
    client.defaults.adapter = vi.fn(async (config) => unauthorized(config));
    await expect(api.playerApi.getState()).rejects.toMatchObject({ response: { status: 401 } });
    expect(client.defaults.adapter).toHaveBeenCalledTimes(1);
    expect(current?.access_token).toBe('alice-token');
    expect(window.location.pathname).toBe('/');
  });

  it('does not replay a pending mutation under a newly signed-in account', async () => {
    client.defaults.adapter = vi.fn(async (config) => {
      current = session('bob');
      unauthorized(config);
    });
    await expect(api.blocksApi.collect('alice-block')).rejects.toSatisfy(api.isAccountChangedError);
    expect(client.defaults.adapter).toHaveBeenCalledTimes(1);
    expect(auth.refreshSession).not.toHaveBeenCalled();
  });

  it('does not replay a pending mutation after sign-out', async () => {
    client.defaults.adapter = vi.fn(async (config) => {
      current = null;
      unauthorized(config);
    });
    await expect(api.blocksApi.collect('alice-block')).rejects.toSatisfy(api.isAccountChangedError);
    expect(client.defaults.adapter).toHaveBeenCalledTimes(1);
    expect(auth.refreshSession).not.toHaveBeenCalled();
  });

  it('does not return a successful old-account response to the new account', async () => {
    client.defaults.adapter = vi.fn(async (config) => {
      current = session('bob');
      return response(config);
    });
    await expect(api.playerApi.getState()).rejects.toSatisfy(api.isAccountChangedError);
    expect(client.defaults.adapter).toHaveBeenCalledTimes(1);
  });

  it('rechecks identity after an asynchronous refresh before retrying a mutation', async () => {
    auth.refreshSession.mockImplementation(async () => {
      current = session('bob');
      return { data: { session: current }, error: null };
    });
    client.defaults.adapter = vi.fn(async (config) => unauthorized(config));
    await expect(api.blocksApi.collect('alice-block')).rejects.toSatisfy(api.isAccountChangedError);
    expect(client.defaults.adapter).toHaveBeenCalledTimes(1);
    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
  });

  it('passes network failures through without refreshing or dereferencing a missing config', async () => {
    client.defaults.adapter = vi.fn(async () => { throw new axios.AxiosError('offline'); });
    await expect(api.playerApi.getState()).rejects.toThrow('offline');
    expect(auth.refreshSession).not.toHaveBeenCalled();
  });
});
