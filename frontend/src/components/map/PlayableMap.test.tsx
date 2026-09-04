import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mapHarness = vi.hoisted(() => {
  type Listener = (...args: any[]) => void;
  const onceListeners: Record<string, Listener | undefined> = {};
  const listeners: Record<string, Listener | undefined> = {};

  const createMap = () => ({
    dragRotate: { disable: vi.fn() },
    touchZoomRotate: { disableRotation: vi.fn() },
    addControl: vi.fn(),
    once: vi.fn((event: string, callback: Listener) => { onceListeners[event] = callback; }),
    on: vi.fn((event: string, callback: Listener) => { listeners[event] = callback; }),
    off: vi.fn(),
    remove: vi.fn(),
    easeTo: vi.fn(),
    getZoom: vi.fn(() => 15),
  });

  const Map = vi.fn(function Map() {
    return createMap();
  });

  return {
    Map,
    onceListeners,
    listeners,
    reset: () => {
      Map.mockClear();
      Object.keys(onceListeners).forEach((key) => delete onceListeners[key]);
      Object.keys(listeners).forEach((key) => delete listeners[key]);
    },
  };
});

vi.mock('maplibre-gl', () => ({
  Map: mapHarness.Map,
  NavigationControl: vi.fn(),
  ScaleControl: vi.fn(),
  setWorkerUrl: vi.fn(),
}));

import PlayableMap, { MAP_LOAD_TIMEOUT_MS } from './PlayableMap';

const props = {
  center: [-80.13, 26.12] as [number, number],
  selectedAddress: 'Home Block',
};

describe('PlayableMap recovery', () => {
  beforeEach(() => {
    mapHarness.reset();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a bounded timeout recovery state and opens the tactical fallback', () => {
    vi.useFakeTimers();
    const onUseTacticalBoard = vi.fn();
    const onStatusChange = vi.fn();
    render(<PlayableMap {...props} onUseTacticalBoard={onUseTacticalBoard} onStatusChange={onStatusChange} />);

    act(() => {
      vi.advanceTimersByTime(MAP_LOAD_TIMEOUT_MS);
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Street view unavailable');
    expect(screen.getByRole('alert')).toHaveTextContent('took too long to load');
    expect(onStatusChange).toHaveBeenCalledWith('error');

    fireEvent.click(screen.getByRole('button', { name: 'Use tactical board' }));
    expect(onUseTacticalBoard).toHaveBeenCalledTimes(1);
  });

  it('shows a connection recovery state and rebuilds the map after retry', async () => {
    const onStatusChange = vi.fn();
    render(<PlayableMap {...props} onStatusChange={onStatusChange} />);

    act(() => {
      mapHarness.listeners.error?.({ error: new Error('provider unavailable') });
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Street view is unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Retry street view' }));

    await waitFor(() => expect(mapHarness.Map).toHaveBeenCalledTimes(2));
    expect(onStatusChange).toHaveBeenCalledWith('loading');
  });

  it('keeps an already loaded strategy map available when a later tile error occurs', () => {
    const onStatusChange = vi.fn();
    render(<PlayableMap {...props} onStatusChange={onStatusChange} />);

    act(() => {
      mapHarness.onceListeners.load?.();
      mapHarness.listeners.error?.({ error: new Error('late tile error') });
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('Loading streets and buildings…')).not.toBeInTheDocument();
    expect(onStatusChange).toHaveBeenLastCalledWith('ready');
  });
});
