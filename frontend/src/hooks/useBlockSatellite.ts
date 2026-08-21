// ============================================================
// useBlockSatellite — Fetch real Mapbox satellite imagery
//
// Returns the Mapbox Static Image API URL for a given lat/lng,
// suitable for use as the background behind the 8×8 tactical
// grid in TopDownBlock.
//
// Features:
//   - In-memory cache keyed by block hash (no re-fetching)
//   - Graceful fallback to a dark placeholder when no token
//   - Configurable zoom (default 18 = one city block)
//
// Sprint: address-block-pipeline
// ============================================================
import { useState, useEffect, useRef } from 'react';
import { buildStaticImageUrl, generateBlockHash } from '../config/mapbox.config';
import { getMapboxToken } from '../config/mapboxToken';

const MAPBOX_TOKEN = getMapboxToken();

// ─── Types ───────────────────────────────────────────────────
export interface UseBlockSatelliteResult {
  /** The satellite image URL (Mapbox static or placeholder data URI) */
  url: string | null;
  loading: boolean;
  error: string | null;
}

// ─── Module-level cache (persists across re-renders) ─────────
const satelliteCache = new Map<string, string>();

// ─── Placeholder data URI ─────────────────────────────────────
// A 1×1 dark grey pixel — used when no Mapbox token is configured.
// The TopDownBlock grid renders over this so the game is always playable.
const PLACEHOLDER_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// ─── Hook ────────────────────────────────────────────────────
/**
 * Fetch the Mapbox satellite image for a block location.
 *
 * @param lat   Latitude of the block centre
 * @param lng   Longitude of the block centre
 * @param zoom  Zoom level (default 18 = ~one city block)
 */
export function useBlockSatellite(
  lat: number,
  lng: number,
  zoom: number = 18,
): UseBlockSatelliteResult {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the current request to avoid stale updates
  const requestIdRef = useRef(0);

  useEffect(() => {
    // No coordinates — nothing to fetch
    if (!lat || !lng) return;

    const cacheKey = `${generateBlockHash(lat, lng)}_z${zoom}`;

    // Serve from cache immediately
    if (satelliteCache.has(cacheKey)) {
      setUrl(satelliteCache.get(cacheKey)!);
      setLoading(false);
      setError(null);
      return;
    }

    // No Mapbox token — return placeholder
    if (!MAPBOX_TOKEN) {
      setUrl(PLACEHOLDER_URI);
      setLoading(false);
      setError(null);
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    // Build the Mapbox Static Image URL
    const imageUrl = buildStaticImageUrl({
      coordinates: { lat, lng },
      zoom,
      width: 512,
      height: 512,
      style: 'satellite-streets-v12',
      highRes: true,
    });

    // Pre-load the image to confirm it resolves before setting it as the URL.
    // This prevents a broken image flash if the token is invalid.
    const img = new Image();
    img.onload = () => {
      if (requestId !== requestIdRef.current) return; // stale
      satelliteCache.set(cacheKey, imageUrl);
      setUrl(imageUrl);
      setLoading(false);
    };
    img.onerror = () => {
      if (requestId !== requestIdRef.current) return; // stale
      // Fall back to placeholder on error
      setUrl(PLACEHOLDER_URI);
      setError('Satellite image unavailable');
      setLoading(false);
    };
    img.src = imageUrl;

    return () => {
      // Cancel stale request
      requestIdRef.current++;
    };
  }, [lat, lng, zoom]);

  return { url, loading, error };
}

// ─── Cache utilities (exported for testing) ──────────────────

/** Clear the satellite image cache (useful in tests). */
export function clearSatelliteCache(): void {
  satelliteCache.clear();
}

/** Check if a URL is cached for the given coordinates. */
export function isSatelliteCached(lat: number, lng: number, zoom: number = 18): boolean {
  const cacheKey = `${generateBlockHash(lat, lng)}_z${zoom}`;
  return satelliteCache.has(cacheKey);
}

/** Manually prime the cache (useful in tests and SSR). */
export function primeSatelliteCache(lat: number, lng: number, zoom: number, url: string): void {
  const cacheKey = `${generateBlockHash(lat, lng)}_z${zoom}`;
  satelliteCache.set(cacheKey, url);
}

export { PLACEHOLDER_URI };
