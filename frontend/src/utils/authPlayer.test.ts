import { describe, expect, it } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { isAccountSwitch, toPlayerIdentity } from './authPlayer';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-123',
    email: 'player@example.com',
    user_metadata: { username: 'StreetKing' },
    app_metadata: {},
    aud: 'authenticated',
    created_at: '2026-07-16T00:00:00.000Z',
    ...overrides,
  } as User;
}

describe('toPlayerIdentity', () => {
  it('maps the Supabase identity used by gameplay persistence', () => {
    expect(toPlayerIdentity(makeUser())).toEqual({
      id: 'user-123',
      email: 'player@example.com',
      username: 'StreetKing',
    });
  });

  it('falls back to the email prefix when profile metadata has no name', () => {
    expect(toPlayerIdentity(makeUser({ user_metadata: {} })).username).toBe('player');
  });

  it('uses a safe default when no display identity is available', () => {
    expect(toPlayerIdentity(makeUser({ email: undefined, user_metadata: {} })).username).toBe('Player');
  });
});

describe('isAccountSwitch', () => {
  it('does not treat an unclaimed local profile as another account', () => {
    expect(isAccountSwitch('', 'user-123')).toBe(false);
  });

  it('detects progression cached for another authenticated user', () => {
    expect(isAccountSwitch('user-old', 'user-123')).toBe(true);
  });
});
