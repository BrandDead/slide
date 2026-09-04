import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNotificationStore } from '../gameStore';

describe('notification store', () => {
  beforeEach(() => {
    useNotificationStore.setState({ notifications: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('assigns distinct identifiers to notifications created in the same millisecond', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const store = useNotificationStore.getState();

    store.addNotification({ type: 'info', title: 'First', message: 'First event.' });
    store.addNotification({ type: 'warning', title: 'Second', message: 'Second event.' });

    const ids = useNotificationStore.getState().notifications.map((notification) => notification.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it('preserves an authoritative event timestamp as the notification display time', () => {
    const eventTimestamp = 1_700_000_000_000;
    useNotificationStore.getState().addNotification({
      type: 'danger',
      title: 'RIVAL PRESSURE: Nightfall',
      message: 'A durable event.',
      timestamp: eventTimestamp,
    });

    const notification = useNotificationStore.getState().notifications[0];
    expect(notification.timestamp).toBe(eventTimestamp);
    expect(notification.createdAt).toBe(new Date(eventTimestamp).toISOString());
  });
});
