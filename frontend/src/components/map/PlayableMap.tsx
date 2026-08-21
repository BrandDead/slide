import React, { useEffect, useRef, useState } from 'react';
import {
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
  type MapOptions,
} from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import './PlayableMap.css';

setWorkerUrl(workerUrl);

export type PlayableMapMode = 'territory' | 'inspect' | 'placement';

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
}

const DEFAULT_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

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
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const callbacksRef = useRef({ onMapLoad, onControllerReady, onZoomChange });
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  callbacksRef.current = { onMapLoad, onControllerReady, onZoomChange };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

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
    try {
      map = new MapLibreMap(options);
    } catch {
      setStatus('error');
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

    map.once('load', () => {
      setStatus('ready');
      callbacksRef.current.onMapLoad?.(map);
      callbacksRef.current.onControllerReady?.(controller);
    });

    map.on('zoomend', () => callbacksRef.current.onZoomChange?.(map.getZoom()));
    map.on('error', (event) => {
      if (!event.error) return;
      setStatus((current) => current === 'ready' ? current : 'error');
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

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

  return (
    <div className={`playable-map playable-map--${mode}`} data-testid="playable-territory-map">
      <div ref={containerRef} className="playable-map__canvas" aria-label="Interactive territory map" />
      {status === 'loading' && (
        <div className="playable-map__status" role="status">
          <span className="playable-map__pulse" />
          Loading streets and buildings…
        </div>
      )}
      {status === 'error' && (
        <div className="playable-map__status playable-map__status--error" role="alert">
          <strong>Map connection interrupted</strong>
          <span>The selected block is still safe. Check your connection and reopen Maps.</span>
        </div>
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

export default PlayableMap;
