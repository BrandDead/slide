/**
 * Vite-safe Mapbox GL default export.
 *
 * The UMD build sometimes arrives as `{ default: mapboxgl }` and sometimes
 * as the namespace itself. Normalizing here keeps MapboxMap / BlockOverlay
 * from crashing the whole app on a missing default export.
 */
import mapboxglImport from 'mapbox-gl';

const resolved = (mapboxglImport as unknown as { default?: typeof mapboxglImport }).default
  ?? mapboxglImport;

export default resolved;
