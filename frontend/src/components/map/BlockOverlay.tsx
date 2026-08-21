import { useEffect } from 'react';
import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent } from 'maplibre-gl';

interface BlockData {
  id: string;
  address: string;
  lat: number;
  lng: number;
  owner: 'player' | 'npc' | 'unclaimed';
  ownerGangName?: string;
  income?: number;
  heat?: number;
  members?: number;
}

interface BlockOverlayProps {
  map: MapLibreMap | null;
  blocks: BlockData[];
  selectedId?: string | null;
  onBlockClick?: (block: BlockData) => void;
}

const BLOCK_COLORS: Record<BlockData['owner'], string> = {
  player: '#16a34a',
  npc: '#e11d48',
  unclaimed: '#64748b',
};

function metersToLongitude(meters: number, latitude: number): number {
  const cos = Math.max(0.2, Math.cos((latitude * Math.PI) / 180));
  return meters / (111_320 * cos);
}

export function blockFootprint(lat: number, lng: number): number[][] {
  const halfHeight = 26 / 110_540;
  const halfWidth = metersToLongitude(38, lat);
  return [
    [lng - halfWidth, lat - halfHeight],
    [lng + halfWidth, lat - halfHeight],
    [lng + halfWidth, lat + halfHeight],
    [lng - halfWidth, lat + halfHeight],
    [lng - halfWidth, lat - halfHeight],
  ];
}

export function toFeatureCollection(blocks: BlockData[], selectedId?: string | null) {
  return {
    type: 'FeatureCollection' as const,
    features: blocks.flatMap((block) => {
      const common = {
        id: block.id,
        owner: block.owner,
        address: block.address,
        label: block.owner === 'player' ? 'Your block' : block.ownerGangName ?? (block.owner === 'npc' ? 'Rival block' : 'Open block'),
        income: block.income ?? 0,
        heat: block.heat ?? 0,
        members: block.members ?? 0,
        color: BLOCK_COLORS[block.owner],
        selected: block.id === selectedId ? 1 : 0,
      };
      return [
        {
          type: 'Feature' as const,
          properties: { ...common, kind: 'footprint' },
          geometry: {
            type: 'Polygon' as const,
            coordinates: [blockFootprint(block.lat, block.lng)],
          },
        },
        {
          type: 'Feature' as const,
          properties: { ...common, kind: 'pin' },
          geometry: {
            type: 'Point' as const,
            coordinates: [block.lng, block.lat],
          },
        },
      ];
    }),
  };
}

const SOURCE_ID = 'slide-territories';
const FOOTPRINT_FILL_ID = 'slide-territories-footprint-fill';
const FOOTPRINT_LINE_ID = 'slide-territories-footprint-line';
const PIN_HALO_ID = 'slide-territories-pin-halo';
const PIN_ID = 'slide-territories-pin';
const LABEL_ID = 'slide-territories-label';

const BlockOverlay: React.FC<BlockOverlayProps> = ({ map, blocks, selectedId, onBlockClick }) => {
  useEffect(() => {
    if (!map || !map.isStyleLoaded()) return;

    const data = toFeatureCollection(blocks, selectedId);
    const existingSource = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (existingSource) {
      existingSource.setData(data);
      return;
    }

    map.addSource(SOURCE_ID, { type: 'geojson', data });

    map.addLayer({
      id: FOOTPRINT_FILL_ID,
      type: 'fill',
      source: SOURCE_ID,
      minzoom: 16.25,
      filter: ['==', ['get', 'kind'], 'footprint'],
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': [
          'case',
          ['==', ['get', 'selected'], 1], 0.12,
          ['==', ['get', 'owner'], 'player'], 0.16,
          0.1,
        ],
      },
    });

    map.addLayer({
      id: FOOTPRINT_LINE_ID,
      type: 'line',
      source: SOURCE_ID,
      minzoom: 16,
      filter: ['==', ['get', 'kind'], 'footprint'],
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['case', ['==', ['get', 'selected'], 1], 4, 2],
        'line-opacity': 0.94,
      },
    });

    map.addLayer({
      id: PIN_HALO_ID,
      type: 'circle',
      source: SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'pin'],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 11, 16, 17, 19, 12],
        'circle-color': ['get', 'color'],
        'circle-opacity': ['case', ['==', ['get', 'selected'], 1], 0.2, 0.08],
        'circle-blur': 0.35,
      },
    });

    map.addLayer({
      id: PIN_ID,
      type: 'circle',
      source: SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'pin'],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 4.5, 16, 7.5, 19, 6],
        'circle-color': ['get', 'color'],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': ['case', ['==', ['get', 'selected'], 1], 3, 1.5],
        'circle-opacity': 0.98,
      },
    });

    map.addLayer({
      id: LABEL_ID,
      type: 'symbol',
      source: SOURCE_ID,
      minzoom: 13.5,
      filter: ['==', ['get', 'kind'], 'pin'],
      layout: {
        'text-field': ['get', 'label'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 13, 10, 17, 12],
        'text-offset': [0, 1.25],
        'text-anchor': 'top',
        'text-allow-overlap': false,
        'text-optional': true,
      },
      paint: {
        'text-color': '#111827',
        'text-halo-color': 'rgba(255,255,255,0.96)',
        'text-halo-width': 2,
      },
    });

    const resolveClick = (event: MapLayerMouseEvent) => {
      const id = event.features?.[0]?.properties?.id as string | undefined;
      const block = id ? blocks.find((candidate) => candidate.id === id) : undefined;
      if (block) onBlockClick?.(block);
    };
    const enter = () => { map.getCanvas().style.cursor = 'pointer'; };
    const leave = () => { map.getCanvas().style.cursor = ''; };

    [PIN_ID, FOOTPRINT_FILL_ID].forEach((layerId) => {
      map.on('click', layerId, resolveClick);
      map.on('mouseenter', layerId, enter);
      map.on('mouseleave', layerId, leave);
    });

    return () => {
      [PIN_ID, FOOTPRINT_FILL_ID].forEach((layerId) => {
        map.off('click', layerId, resolveClick);
        map.off('mouseenter', layerId, enter);
        map.off('mouseleave', layerId, leave);
      });
      [LABEL_ID, PIN_ID, PIN_HALO_ID, FOOTPRINT_LINE_ID, FOOTPRINT_FILL_ID].forEach((layerId) => {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
      });
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    };
  }, [map, blocks, onBlockClick, selectedId]);

  return null;
};

export default BlockOverlay;
export type { BlockData };
