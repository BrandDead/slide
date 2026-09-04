import { useEffect } from 'react';
import { useGhostStore } from '../stores/ghostCrewStore';
import { useNotificationStore } from '../stores/gameStore';
import { toCityBriefNotification } from '../components/layout/cityBriefing';
import { loadAuthoritativeWorld } from '../services/worldPersistence.service';
import { IS_DEMO_MODE } from '../utils/demoSeed';

const WORLD_EVENT_WATERMARK_PREFIX = 'dealt-slide-world-event-watermark:';

function worldEventWatermarkKey(profileId: string): string {
  return `${WORLD_EVENT_WATERMARK_PREFIX}${profileId}`;
}

function readWorldEventWatermark(profileId: string): number | null {
  try {
    const value = window.localStorage.getItem(worldEventWatermarkKey(profileId));
    const timestamp = value ? Number(value) : Number.NaN;
    return Number.isFinite(timestamp) ? timestamp : null;
  } catch {
    return null;
  }
}

function writeWorldEventWatermark(profileId: string, timestamp: number): void {
  try {
    window.localStorage.setItem(worldEventWatermarkKey(profileId), String(timestamp));
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
    // The briefing still works; a later hydration may repeat a notification.
  }
}

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
        const durableEvents = feed.filter((event) => event.id.startsWith('server-'));
        const priorWatermark = readWorldEventWatermark(profileId);
        const latestTimestamp = durableEvents.reduce(
          (latest, event) => Math.max(latest, event.timestamp),
          Number.NEGATIVE_INFINITY,
        );

        // A first sync establishes the boundary for this profile so public
        // historical city activity remains browseable in the briefing rather
        // than becoming an inbox full of unread alerts. Later syncs surface
        // only events that occurred after the stored boundary.
        if (priorWatermark !== null) {
          const notificationStore = useNotificationStore.getState();
          const mirroredWorldEventIds = new Set(
            notificationStore.notifications
              .map((notification) => notification.data?.worldEventId)
              .filter((value): value is string => typeof value === 'string'),
          );

          for (const event of durableEvents) {
            if (event.timestamp <= priorWatermark || mirroredWorldEventIds.has(event.id)) continue;
            notificationStore.addNotification(toCityBriefNotification(event));
            mirroredWorldEventIds.add(event.id);
          }
        }

        if (Number.isFinite(latestTimestamp)) {
          writeWorldEventWatermark(profileId, Math.max(priorWatermark ?? Number.NEGATIVE_INFINITY, latestTimestamp));
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
