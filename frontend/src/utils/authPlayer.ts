import type { User } from '@supabase/supabase-js';
import type { Player } from '../types/game.types';

export type PlayerIdentityUpdate = Pick<Player, 'id' | 'email' | 'username'>;

/**
 * Convert a Supabase user into the identity fields consumed by gameplay stores.
 * Keeping this mapping pure prevents auth callbacks from drifting across sign-in
 * and session-restoration paths.
 */
export function toPlayerIdentity(user: User): PlayerIdentityUpdate {
  const metadata = user.user_metadata ?? {};

  return {
    id: user.id,
    email: user.email ?? '',
    username:
      metadata.username ??
      metadata.name ??
      user.email?.split('@')[0] ??
      'Player',
  };
}

/** Return true when browser-local progression belongs to another account. */
export function isAccountSwitch(currentPlayerId: string, userId: string): boolean {
  return Boolean(currentPlayerId && currentPlayerId !== userId);
}
