import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
  type ErrorEvent as MapLibreErrorEvent,
  type MapOptions,
} from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import './PlayableMap.css';

setWorkerUrl(workerUrl);

export type PlayableMapMode = 'territory' | 'inspect' | 'placement';
export type PlayableMapStatus = 'loading' | 'ready' | 'error';
export type PlayableMapFailure = 'connection' | 'timeout' | null;

export interface PlayableMapController {
  flyTo: (opts: { center: [number, number]; zoom?: number; duration?: number }) => void;
  getMap: () => MapLibreMap | null;
}

interface PlayableMapProps {
  center: [number, number];
  zoom?: number;
  mode?: PlayableMapMode;
  selectedAddress?: string;
  onMapLoad?: (map: MapLibreMap) => void;
  onControllerReady?: (controller: PlayableMapController) => void;
  onZoomChange?: (zoom: number) => void;
  onStatusChange?: (status: PlayableMapStatus) => void;
  onUseTacticalBoard?: () => void;
}

const DEFAULT_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const MAP_LOAD_TIMEOUT_MS = 10_000;

const MODE_ZOOM: Record<PlayableMapMode, number> = {
  territory: 15,
  inspect: 17.25,
  placement: 19,
};

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

const PlayableMap: React.FC<PlayableMapProps> = ({
  center,
  zoom,
  mode = 'territory',
  selectedAddress,
  onMapLoad,
  onControllerReady,
  onZoomChange,
  onStatusChange,
  onUseTacticalBoard,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const callbacksRef = useRef({ onMapLoad, onControllerReady, onZoomChange, onStatusChange });
  const [status, setStatus] = useState<PlayableMapStatus>('loading');
  const [failure, setFailure] = useState<PlayableMapFailure>(null);
  const [attempt, setAttempt] = useState(0);

  callbacksRef.current = { onMapLoad, onControllerReady, onZoomChange, onStatusChange };

  const restartMap = useCallback(() => {
    setFailure(null);
    setStatus('loading');
    callbacksRef.current.onStatusChange?.('loading');
    setAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // A parent can retain a previous ready state while this view is unmounted.
    // Publish the fresh lifecycle before a replacement controller is created.
    callbacksRef.current.onStatusChange?.('loading');

    const style = ((import.meta.env as Record<string, string | undefined>).VITE_SLIDE_MAP_STYLE_URL || DEFAULT_STYLE).trim();
    const options: MapOptions = {
      container: containerRef.current,
      style,
      center,
      zoom: zoom ?? MODE_ZOOM[mode],
      minZoom: 11,
      maxZoom: 20,
      pitch: 0,
      bearing: 0,
      maxPitch: 0,
      renderWorldCopies: false,
      attributionControl: { compact: true },
      cooperativeGestures: false,
    };

    let map: MapLibreMap;
    let disposed = false;
    let hasLoaded = false;
    let loadTimer: number | undefined;

    const updateStatus = (nextStatus: PlayableMapStatus, nextFailure: PlayableMapFailure = null) => {
      if (disposed) return;
      setFailure(nextFailure);
      setStatus(nextStatus);
      callbacksRef.current.onStatusChange?.(nextStatus);
    };

    try {
      map = new MapLibreMap(options);
    } catch {
      updateStatus('error', 'connection');
      return;
    }

    mapRef.current = map;
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new ScaleControl({ maxWidth: 90, unit: 'imperial' }), 'bottom-left');

    const controller: PlayableMapController = {
      flyTo: ({ center: nextCenter, zoom: nextZoom, duration = 700 }) => {
        const reduced = prefersReducedMotion();
        map.easeTo({
          center: nextCenter,
          zoom: nextZoom ?? map.getZoom(),
          duration: reduced ? 0 : duration,
          essential: false,
          pitch: 0,
          bearing: 0,
        });
      },
      getMap: () => mapRef.current,
    };

    const clearLoadTimer = () => {
      if (loadTimer !== undefined) {
        window.clearTimeout(loadTimer);
        loadTimer = undefined;
      }
    };

    const onLoad = () => {
      hasLoaded = true;
      clearLoadTimer();
      updateStatus('ready');
      callbacksRef.current.onMapLoad?.(map);
      callbacksRef.current.onControllerReady?.(controller);
    };

    const onError = (event: MapLibreErrorEvent) => {
      if (!event.error || disposed || hasLoaded) return;
      if (mapRef.current === map) updateStatus('error', 'connection');
    };

    const onZoomEnd = () => callbacksRef.current.onZoomChange?.(map.getZoom());

    map.once('load', onLoad);
    map.on('error', onError);
    map.on('zoomend', onZoomEnd);
    loadTimer = window.setTimeout(() => {
      // A queued timeout can still run after an initial load or effect cleanup.
      // Never let it overwrite a usable map or a newer failure outcome.
      if (!disposed && !hasLoaded) updateStatus('error', 'timeout');
    }, MAP_LOAD_TIMEOUT_MS);

    return () => {
      disposed = true;
      clearLoadTimer();
      map.off('error', onError);
      map.off('zoomend', onZoomEnd);
      try {
        map.remove();
      } finally {
        if (mapRef.current === map) mapRef.current = null;
      }
    };
  }, [attempt]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== 'ready') return;
    map.easeTo({
      center,
      zoom: zoom ?? MODE_ZOOM[mode],
      duration: prefersReducedMotion() ? 0 : 700,
      essential: false,
      pitch: 0,
      bearing: 0,
    });
  }, [center, mode, status, zoom]);

  const failureMessage = failure === 'timeout'
    ? 'Street view took too long to load. Your territory is still operational.'
    : 'Street view is unavailable. Your territory is still operational.';

  return (
    <div className={`playable-map playable-map--${mode} playable-map--${status}`} data-testid="playable-territory-map">
      <div ref={containerRef} className="playable-map__canvas" aria-label="Interactive territory map" />
      {status === 'loading' && (
        <div className="playable-map__status" role="status" aria-live="polite">
          <span className="playable-map__pulse" />
          Loading streets and buildings…
        </div>
      )}
      {status === 'error' && (
        <section className="playable-map__status playable-map__status--error" role="alert" aria-live="assertive">
          <div className="playable-map__recovery-mark" aria-hidden="true">!</div>
          <div>
            <strong>Street view unavailable</strong>
            <span>{failureMessage}</span>
          </div>
          <div className="playable-map__recovery-actions">
            <button type="button" onClick={restartMap}>Retry street view</button>
            {onUseTacticalBoard && (
              <button type="button" className="playable-map__tactical-button" onClick={onUseTacticalBoard}>
                Use tactical board
              </button>
            )}
          </div>
        </section>
      )}
      {selectedAddress && (
        <div className="playable-map__location" aria-live="polite">
          <span className="playable-map__location-dot" />
          <span>
            <strong>{mode === 'territory' ? 'Home block' : mode === 'inspect' ? 'Inspecting block' : 'Placing crew'}</strong>
            <small>{selectedAddress}</small>
          </span>
        </div>
      )}
      <div className="playable-map__notice">
        Streets are geographic context. Tactical cells and territory boundaries are fictionalized for gameplay.
      </div>
    </div>
  );
};

export { MAP_LOAD_TIMEOUT_MS };
export default PlayableMap;
