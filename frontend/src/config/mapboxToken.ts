/**
 * Canonical Mapbox token reader.
 *
 * The repo historically mixed VITE_MAPBOX_ACCESS_TOKEN (documented) with
 * VITE_MAPBOX_TOKEN (used by several map components). Either name is valid.
 */
export function getMapboxToken(): string {
  const env = import.meta.env as Record<string, string | undefined>;
  return (
    env.VITE_MAPBOX_ACCESS_TOKEN?.trim() ||
    env.VITE_MAPBOX_TOKEN?.trim() ||
    ''
  );
}

export const LAS_OLAS_CENTER: [number, number] = [-80.1373, 26.1224];
export const LAS_OLAS_LAT = 26.1224;
export const LAS_OLAS_LNG = -80.1373;
