import type { GhostFeedEvent } from '../../stores/ghostCrewStore';
import type { Notification } from '../../types/game.types';
import { BLOCK_LOOP_IDS } from '../../game/loop/blockLoopTypes';
import { isDefenseReason } from '../../utils/ghostCrewEngine';

export const CITY_BRIEF_LIMIT = 3;

export type CityBriefTone = 'danger' | 'warning' | 'info' | 'success';

export type CityBriefAction = {
  label: string;
  destination: CityBriefDestination;
};

export type CityBriefDestination = 'map' | 'gang_hq' | 'dealt_v2' | 'block_loop';

type BriefEvent = Pick<GhostFeedEvent, 'action' | 'reason' | 'targetBlockId'>;

/** Attacks on the Strip block (and their results) are answered on the Strip. */
function isStripEvent(event: BriefEvent): boolean {
  return event.targetBlockId === BLOCK_LOOP_IDS.blockId;
}

export type CityBriefItem = GhostFeedEvent & {
  tone: CityBriefTone;
  category: string;
  cta: CityBriefAction;
};

export function getCityBriefTone(action: GhostFeedEvent['action'], reason?: GhostFeedEvent['reason']): CityBriefTone {
  if (reason === 'defense-held') return 'success';
  if (reason === 'defense-overrun') return 'danger';
  if (reason === 'defense-retreated') return 'warning';
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

export function getCityBriefCategory(action: GhostFeedEvent['action'], reason?: GhostFeedEvent['reason']): string {
  if (isDefenseReason(reason)) return 'DEFENSE RESULT';
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

export function getCityBriefAction(
  action: GhostFeedEvent['action'],
  event: Partial<BriefEvent> = {},
): CityBriefAction {
  const full = { action, reason: event.reason, targetBlockId: event.targetBlockId };
  if (isDefenseReason(full.reason)) {
    return { label: 'REVIEW THE STRIP', destination: isStripEvent(full) ? 'block_loop' : 'map' };
  }
  if (action === 'attack' && isStripEvent(full)) {
    return { label: 'DEFEND THE STRIP', destination: 'block_loop' };
  }
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
  const tone = getCityBriefTone(event.action, event.reason);
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
    title: `${getCityBriefCategory(event.action, event.reason)}: ${event.crewName}`,
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
export function toCityBriefItems(feed: GhostFeedEvent[], answeredKeys: string[] = []): CityBriefItem[] {
  // An attack answered on the Strip is superseded by its defense result.
  const answered = new Set(answeredKeys);
  return feed
    .filter((event) => !(
      event.action === 'attack'
      && !isDefenseReason(event.reason)
      && answered.has(event.actionKey?.trim() || event.id)
    ))
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, CITY_BRIEF_LIMIT)
    .map((event) => ({
      ...event,
      tone: getCityBriefTone(event.action, event.reason),
      category: getCityBriefCategory(event.action, event.reason),
      cta: getCityBriefAction(event.action, event),
    }));
}
