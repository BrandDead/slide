import { useEffect } from 'react';
import { useGhostStore } from '../stores/ghostCrewStore';
import { useNotificationStore } from '../stores/gameStore';
import { toCityBriefNotification } from '../components/layout/cityBriefing';
import { loadAuthoritativeWorld } from '../services/worldPersistence.service';
import { IS_DEMO_MODE } from '../utils/demoSeed';

/**
 * Hydrates the existing Ghost Crew store from the additive authoritative-world
 * tables. The local Ghost Crew engine remains the deterministic offline/demo
 * fallback; this hook never starts a new tick or owns a second cache.
 */
export function useGhostCrewSync(profileId: string | null, enabled: boolean): void {
  const replaceAuthoritativeState = useGhostStore((state) => state.replaceAuthoritativeState);

  useEffect(() => {
    if (!enabled || IS_DEMO_MODE || !profileId) return;

    let cancelled = false;
    void loadAuthoritativeWorld(profileId)
      .then(({ crews, feed }) => {
        if (cancelled) return;

        replaceAuthoritativeState(crews, feed);

        // Local Ghost Crew ticks already notify as they occur. Server-hydrated
        // events need this bridge so a returning authenticated player receives
        // the same durable update in the established notification center.
        const notificationStore = useNotificationStore.getState();
        const mirroredWorldEventIds = new Set(
          notificationStore.notifications
            .map((notification) => notification.data?.worldEventId)
            .filter((value): value is string => typeof value === 'string'),
        );

        for (const event of feed) {
          if (!event.id.startsWith('server-') || mirroredWorldEventIds.has(event.id)) continue;
          notificationStore.addNotification(toCityBriefNotification(event));
          mirroredWorldEventIds.add(event.id);
        }
      })
      .catch((error: unknown) => {
        // The local persistent state remains a safe offline fallback until the
        // configured project has the additive migration and edge functions.
        console.warn('[GhostCrewSync] Authoritative world hydration skipped:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, profileId, replaceAuthoritativeState]);
}
