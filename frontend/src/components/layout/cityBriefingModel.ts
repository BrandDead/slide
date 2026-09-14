import type { GhostFeedEvent } from '../../stores/ghostCrewStore';
import type { Notification } from '../../types/game.types';

export const CITY_BRIEF_LIMIT = 3;

export type CityBriefTone = 'danger' | 'warning' | 'info' | 'success';

export type CityBriefAction = {
  label: string;
  destination: 'map' | 'gang_hq' | 'dealt_v2';
};

export type CityBriefItem = GhostFeedEvent & {
  tone: CityBriefTone;
  category: string;
  cta: CityBriefAction;
};

export function getCityBriefTone(action: GhostFeedEvent['action']): CityBriefTone {
  switch (action) {
    case 'attack':
      return 'danger';
    case 'claim':
      return 'warning';
    case 'reinforce':
      return 'info';
    default:
      return 'success';
  }
}

export function getCityBriefCategory(action: GhostFeedEvent['action']): string {
  switch (action) {
    case 'attack':
      return 'RIVAL PRESSURE';
    case 'claim':
      return 'TURF MOVEMENT';
    case 'reinforce':
      return 'CREW MOVEMENT';
    case 'lay-low':
      return 'CITY WATCH';
    default:
      return 'CITY UPDATE';
  }
}

export function getCityBriefAction(action: GhostFeedEvent['action']): CityBriefAction {
  switch (action) {
    case 'attack':
      return { label: 'REVIEW DEFENSE', destination: 'map' };
    case 'claim':
      return { label: 'REVIEW TURF', destination: 'map' };
    case 'reinforce':
      return { label: 'REVIEW CREW', destination: 'gang_hq' };
    default:
      return { label: 'CHECK DEALS', destination: 'dealt_v2' };
  }
}

export function toCityBriefNotification(event: GhostFeedEvent): Omit<Notification, 'id' | 'read' | 'timestamp'> & { timestamp: number } {
  const tone = getCityBriefTone(event.action);
  const typeByTone: Record<CityBriefTone, Notification['type']> = {
    danger: 'danger',
    warning: 'warning',
    info: 'info',
    success: 'success',
  };
  const priorityByTone: Record<CityBriefTone, NonNullable<Notification['priority']>> = {
    danger: 'high',
    warning: 'high',
    info: 'normal',
    success: 'low',
  };

  return {
    type: typeByTone[tone],
    title: `${getCityBriefCategory(event.action)}: ${event.crewName}`,
    message: event.description,
    timestamp: event.timestamp,
    priority: priorityByTone[tone],
    data: { worldEventId: event.id, source: 'authoritative-world' },
  };
}

export function formatCityBriefTime(timestamp: number, now = Date.now()): string {
  const elapsedSeconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  const minutes = Math.floor(elapsedSeconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}D AGO`;
  if (hours > 0) return `${hours}H AGO`;
  if (minutes > 0) return `${minutes}M AGO`;
  return 'JUST NOW';
}

/**
 * The Ghost Crew store owns feed identity and de-duplication. This projection
 * is presentation-only: it keeps the command desktop bounded and newest first.
 */
export function toCityBriefItems(feed: GhostFeedEvent[]): CityBriefItem[] {
  return [...feed]
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, CITY_BRIEF_LIMIT)
    .map((event) => ({
      ...event,
      tone: getCityBriefTone(event.action),
      category: getCityBriefCategory(event.action),
      cta: getCityBriefAction(event.action),
    }));
}
