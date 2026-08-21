import { useEffect } from 'react';
import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent } from 'maplibre-gl';
import type { BlockData, BlockZone } from '../../types/block.types';

interface TacticalPlacementOverlayProps {
  map: MapLibreMap | null;
  block: BlockData | null;
  active: boolean;
  onChooseCell: (zone: BlockZone) => void;
}

const SOURCE_ID = 'slide-placement-grid';
const FILL_ID = 'slide-placement-grid-fill';
const LINE_ID = 'slide-placement-grid-line';
const MEMBER_ID = 'slide-placement-members';
const MEMBER_LABEL_ID = 'slide-placement-member-labels';

const ZONE_COLORS: Record<BlockZone['zoneType'], string> = {
  street: '#ef4444',
  curb: '#f97316',
  sidewalk: '#facc15',
  storefront: '#22c55e',
  alley: '#38bdf8',
  parking: '#94a3b8',
  rooftop: '#a78bfa',
  building: '#334155',
};

function lngPerMeter(latitude: number): number {
  const cos = Math.max(0.2, Math.cos((latitude * Math.PI) / 180));
  return 1 / (111_320 * cos);
}

function latPerMeter(): number {
  return 1 / 110_540;
}

export function buildPlacementGeoJson(block: BlockData) {
  const rows = block.grid.length || 8;
  const columns = Math.max(1, ...block.grid.map((row) => row.length));
  const cellMeters = 8;
  const east = lngPerMeter(block.lat);
  const north = latPerMeter();
  const xOrigin = -((columns * cellMeters) / 2);
  const yOrigin = -((rows * cellMeters) / 2);

  const cellFeatures = block.grid.flatMap((row, y) => row.map((zone, x) => {
    const westMeters = xOrigin + x * cellMeters;
    const eastMeters = westMeters + cellMeters;
    const southMeters = yOrigin + y * cellMeters;
    const northMeters = southMeters + cellMeters;
    return {
      type: 'Feature' as const,
      properties: {
        kind: 'cell',
        x: zone.x,
        y: zone.y,
        zoneType: zone.zoneType,
        passable: zone.passable ? 1 : 0,
        occupied: zone.occupantId ? 1 : 0,
        income: zone.incomeModifier,
        exposure: zone.exposureRisk,
        color: ZONE_COLORS[zone.zoneType],
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [block.lng + westMeters * east, block.lat + southMeters * north],
          [block.lng + eastMeters * east, block.lat + southMeters * north],
          [block.lng + eastMeters * east, block.lat + northMeters * north],
          [block.lng + westMeters * east, block.lat + northMeters * north],
          [block.lng + westMeters * east, block.lat + southMeters * north],
        ]],
      },
    };
  }));

  const memberFeatures = block.placements.map((placement) => {
    const eastMeters = xOrigin + (placement.x + 0.5) * cellMeters;
    const northMeters = yOrigin + (placement.y + 0.5) * cellMeters;
    return {
      type: 'Feature' as const,
      properties: {
        kind: 'member',
        id: placement.memberId,
        name: placement.memberName,
        role: placement.role,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [block.lng + eastMeters * east, block.lat + northMeters * north],
      },
    };
  });

  return {
    type: 'FeatureCollection' as const,
    features: [...cellFeatures, ...memberFeatures],
  };
}

const TacticalPlacementOverlay: React.FC<TacticalPlacementOverlayProps> = ({ map, block, active, onChooseCell }) => {
  useEffect(() => {
    if (!map || !block || !active || !map.isStyleLoaded()) return;

    const data = buildPlacementGeoJson(block);
    map.addSource(SOURCE_ID, { type: 'geojson', data });

    map.addLayer({
      id: FILL_ID,
      type: 'fill',
      source: SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'cell'],
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': [
          'case',
          ['==', ['get', 'passable'], 0], 0.12,
          ['==', ['get', 'occupied'], 1], 0.32,
          0.5,
        ],
      },
    });

    map.addLayer({
      id: LINE_ID,
      type: 'line',
      source: SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'cell'],
      paint: {
        'line-color': [
          'case',
          ['==', ['get', 'passable'], 0], 'rgba(15,23,42,0.34)',
          ['==', ['get', 'occupied'], 1], '#ffffff',
          'rgba(255,255,255,0.82)',
        ],
        'line-width': ['case', ['==', ['get', 'occupied'], 1], 3, 2],
      },
    });

    map.addLayer({
      id: MEMBER_ID,
      type: 'circle',
      source: SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'member'],
      paint: {
        'circle-radius': 8,
        'circle-color': '#111827',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2.5,
      },
    });

    map.addLayer({
      id: MEMBER_LABEL_ID,
      type: 'symbol',
      source: SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'member'],
      layout: {
        'text-field': ['get', 'name'],
        'text-size': 10,
        'text-offset': [0, 1.1],
        'text-anchor': 'top',
        'text-optional': true,
      },
      paint: {
        'text-color': '#0f172a',
        'text-halo-color': 'rgba(255,255,255,0.96)',
        'text-halo-width': 2,
      },
    });

    const click = (event: MapLayerMouseEvent) => {
      const properties = event.features?.[0]?.properties;
      if (!properties || properties.passable !== 1 || properties.occupied === 1) return;
      const zone = block.grid[Number(properties.y)]?.[Number(properties.x)];
      if (zone) onChooseCell(zone);
    };
    const enter = (event: MapLayerMouseEvent) => {
      const properties = event.features?.[0]?.properties;
      map.getCanvas().style.cursor = properties?.passable === 1 && properties?.occupied !== 1 ? 'crosshair' : 'not-allowed';
    };
    const leave = () => { map.getCanvas().style.cursor = ''; };

    map.on('click', FILL_ID, click);
    map.on('mousemove', FILL_ID, enter);
    map.on('mouseleave', FILL_ID, leave);

    return () => {
      map.off('click', FILL_ID, click);
      map.off('mousemove', FILL_ID, enter);
      map.off('mouseleave', FILL_ID, leave);
      [MEMBER_LABEL_ID, MEMBER_ID, LINE_ID, FILL_ID].forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    };
  }, [active, block, map, onChooseCell]);

  useEffect(() => {
    if (!map || !block || !active) return;
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData(buildPlacementGeoJson(block));
  }, [active, block, map]);

  return null;
};

export default TacticalPlacementOverlay;
