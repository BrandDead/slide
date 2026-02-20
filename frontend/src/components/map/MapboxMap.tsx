// ============================================================
// MapboxMap - Full-screen Mapbox GL JS integration
// Renders the city map with dark theme for the Hood view
// ============================================================

import React, { useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface MapboxMapProps {
  onMapLoad?: (map: mapboxgl.Map) => void;
  center?: [number, number];
  zoom?: number;
}

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

const MapboxMap: React.FC<MapboxMapProps> = ({
  onMapLoad,
  center = [-118.2437, 34.0522], // Default: Los Angeles
  zoom = 14,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (!MAPBOX_TOKEN) {
      // Render a placeholder if no token
      containerRef.current.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:#1a1a2e;color:#888;font-family:monospace;">
          <div style="font-size:48px;margin-bottom:16px;">🗺️</div>
          <div style="font-size:14px;">Mapbox token not configured</div>
          <div style="font-size:12px;margin-top:8px;color:#555;">Set VITE_MAPBOX_TOKEN in .env</div>
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
      pitch: 45,
      bearing: -17.6,
      antialias: true,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-left');
    map.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserHeading: true,
      }),
      'top-left'
    );

    map.on('load', () => {
      mapRef.current = map;
      // Add 3D buildings layer for immersion
      const layers = map.getStyle().layers;
      const labelLayerId = layers?.find(
        (layer) => layer.type === 'symbol' && (layer.layout as any)?.['text-field']
      )?.id;

      map.addLayer(
        {
          id: '3d-buildings',
          source: 'composite',
          'source-layer': 'building',
          filter: ['==', 'extrude', 'true'],
          type: 'fill-extrusion',
          minzoom: 12,
          paint: {
            'fill-extrusion-color': '#1a1a2e',
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'min_height'],
            'fill-extrusion-opacity': 0.6,
          },
        },
        labelLayerId
      );

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
      style={{ width: '100%', height: '100%', borderRadius: '12px', overflow: 'hidden' }}
    />
  );
};

export default MapboxMap;
