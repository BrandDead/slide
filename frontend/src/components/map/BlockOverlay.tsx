// ============================================================
// BlockOverlay - Renders claimed/NPC/unclaimed blocks as
// colored polygons on the Mapbox map using GeoJSON sources
// ============================================================

import { useEffect } from 'react';
import mapboxgl from '../../utils/mapboxClient';

interface BlockData {
  id: string;
  address: string;
  lat: number;
  lng: number;
  owner: 'player' | 'npc' | 'unclaimed';
  income?: number;
  heat?: number;
  members?: number;
}

interface BlockOverlayProps {
  map: mapboxgl.Map | null;
  blocks: BlockData[];
  onBlockClick?: (block: BlockData) => void;
}

// Generate a small polygon around a point (simulates a city block)
function blockPolygon(lat: number, lng: number): number[][] {
  const size = 0.0004; // ~44m at equator
  return [
    [lng - size, lat - size],
    [lng + size, lat - size],
    [lng + size, lat + size],
    [lng - size, lat + size],
    [lng - size, lat - size],
  ];
}

const BLOCK_COLORS: Record<string, string> = {
  player: '#4ade80',
  npc: '#ef4444',
  unclaimed: '#6b7280',
};

const BlockOverlay: React.FC<BlockOverlayProps> = ({ map, blocks, onBlockClick }) => {
  useEffect(() => {
    if (!map || blocks.length === 0) return;

    const sourceId = 'blocks-source';
    const fillLayerId = 'blocks-fill';
    const outlineLayerId = 'blocks-outline';

    // Build GeoJSON
    const geojson: any = {
      type: 'FeatureCollection',
      features: blocks.map((block) => ({
        type: 'Feature',
        properties: {
          id: block.id,
          owner: block.owner,
          address: block.address,
          income: block.income || 0,
          heat: block.heat || 0,
          members: block.members || 0,
          color: BLOCK_COLORS[block.owner] || BLOCK_COLORS.unclaimed,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [blockPolygon(block.lat, block.lng)],
        },
      })),
    };

    // Add or update source
    const existingSource = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined;
    if (existingSource) {
      existingSource.setData(geojson);
      return;
    }

    map.addSource(sourceId, {
      type: 'geojson',
      data: geojson,
    });

    // Fill layer
    map.addLayer({
      id: fillLayerId,
      type: 'fill',
      source: sourceId,
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': [
          'match',
          ['get', 'owner'],
          'player', 0.5,
          'npc', 0.4,
          0.2,
        ],
      },
    });

    // Outline layer
    map.addLayer({
      id: outlineLayerId,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 2,
        'line-opacity': 0.8,
      },
    });

    // Click handler
    if (onBlockClick) {
      map.on('click', fillLayerId, (e) => {
        if (e.features && e.features.length > 0) {
          const props = (e.features[0] as any).properties;
          if (props) {
            const block = blocks.find((b) => b.id === props.id);
            if (block) onBlockClick(block);
          }
        }
      });

      // Cursor change on hover
      map.on('mouseenter', fillLayerId, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', fillLayerId, () => {
        map.getCanvas().style.cursor = '';
      });
    }

    // Cleanup
    return () => {
      if (map.getLayer(fillLayerId)) map.removeLayer(fillLayerId);
      if (map.getLayer(outlineLayerId)) map.removeLayer(outlineLayerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    };
  }, [map, blocks, onBlockClick]);

  return null; // This component only manipulates the map imperatively
};

export default BlockOverlay;
export type { BlockData };
