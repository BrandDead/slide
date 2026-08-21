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

/** True only for a real Mapbox public/secret token — dummy env values black the GL canvas. */
export function isUsableMapboxToken(token: string = getMapboxToken()): boolean {
  const t = token.trim();
  if (t.length < 24) return false;
  const lower = t.toLowerCase();
  if (
    lower.includes('dummy') ||
    lower.includes('placeholder') ||
    lower.includes('your_') ||
    lower.includes('xxx') ||
    lower === 'pk.ey'
  ) {
    return false;
  }
  return lower.startsWith('pk.') || lower.startsWith('sk.');
}

export const LAS_OLAS_CENTER: [number, number] = [-80.1373, 26.1224];
export const LAS_OLAS_LAT = 26.1224;
export const LAS_OLAS_LNG = -80.1373;
