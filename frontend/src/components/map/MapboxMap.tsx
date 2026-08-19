// ============================================================
// MapboxMap - Full-screen Mapbox GL JS integration
// iOS Maps-style dark 3D hood for Fort Lauderdale / player origin
// ============================================================

import React, { useEffect, useRef } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';
import mapboxgl from '../../utils/mapboxClient';
import { getMapboxToken, LAS_OLAS_CENTER } from '../../config/mapboxToken';

interface MapboxMapProps {
  onMapLoad?: (map: mapboxgl.Map) => void;
  center?: [number, number];
  zoom?: number;
}

const MAPBOX_TOKEN = getMapboxToken();

const MapboxMap: React.FC<MapboxMapProps> = ({
  onMapLoad,
  center = LAS_OLAS_CENTER,
  zoom = 15,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (!MAPBOX_TOKEN) {
      containerRef.current.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:#111;color:#888;font-family:sans-serif;padding:24px;text-align:center;">
          <div style="font-size:14px;font-weight:700;color:#f5f5f7;margin-bottom:8px;">Maps unavailable</div>
          <div style="font-size:12px;line-height:1.5;">Set VITE_MAPBOX_ACCESS_TOKEN (or VITE_MAPBOX_TOKEN). Nearby recon still works offline.</div>
        </div>
      `;
      return;
    }

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center,
      zoom,
      pitch: 52,
      bearing: -18,
      antialias: true,
    });

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'bottom-right');
    map.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserHeading: true,
      }),
      'bottom-right',
    );

    map.on('load', () => {
      mapRef.current = map;
      const layers = map.getStyle().layers;
      const labelLayerId = layers?.find(
        (layer) => layer.type === 'symbol' && (layer.layout as any)?.['text-field'],
      )?.id;

      if (!map.getLayer('3d-buildings')) {
        map.addLayer(
          {
            id: '3d-buildings',
            source: 'composite',
            'source-layer': 'building',
            filter: ['==', 'extrude', 'true'],
            type: 'fill-extrusion',
            minzoom: 12,
            paint: {
              'fill-extrusion-color': '#1c1c28',
              'fill-extrusion-height': ['get', 'height'],
              'fill-extrusion-base': ['get', 'min_height'],
              'fill-extrusion-opacity': 0.72,
            },
          },
          labelLayerId,
        );
      }

      onMapLoad?.(map);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [center, zoom, onMapLoad]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', overflow: 'hidden' }}
    />
  );
};

export default MapboxMap;
