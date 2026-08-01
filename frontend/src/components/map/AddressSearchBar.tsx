// ============================================================
// AddressSearchBar — Standalone address autocomplete
// Used in both the Block view and Hood view to let players
// search for real addresses and claim them as blocks.
//
// Falls back to a mock Las Olas result when no Mapbox token
// is configured, so the game is always playable in dev.
// Sprint: address-block-pipeline
// ============================================================
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { buildGeocodeUrl } from '../../config/mapbox.config';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

// ─── Types ───────────────────────────────────────────────────
export interface AddressResult {
  address: string;
  lat: number;
  lng: number;
  placeId: string;
  city?: string;
  state?: string;
}

interface AddressSearchBarProps {
  onResult: (result: AddressResult) => void;
  placeholder?: string;
  /** If true, show the search bar inline (no absolute positioning) */
  inline?: boolean;
}

// ─── Mock fallback for dev (no Mapbox token) ─────────────────
const MOCK_RESULTS: AddressResult[] = [
  {
    address: '1208 W Las Olas Blvd, Fort Lauderdale, FL 33312',
    lat: 26.1224,
    lng: -80.1373,
    placeId: 'mock-las-olas-1208',
    city: 'Fort Lauderdale',
    state: 'FL',
  },
  {
    address: '1400 NW 3rd Ave, Miami, FL 33136',
    lat: 25.7895,
    lng: -80.2101,
    placeId: 'mock-overtown-1400',
    city: 'Miami',
    state: 'FL',
  },
  {
    address: '4201 MLK Blvd, Miami, FL 33142',
    lat: 25.8220,
    lng: -80.2310,
    placeId: 'mock-liberty-4201',
    city: 'Miami',
    state: 'FL',
  },
];

// ─── Styles ──────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
    width: '100%',
    fontFamily: 'monospace',
    zIndex: 100,
  },
  inputWrapper: {
    display: 'flex',
    alignItems: 'center',
    background: '#111',
    border: '1px solid #333',
    borderRadius: 8,
    padding: '0 12px',
    gap: 8,
  },
  inputWrapperFocused: {
    border: '1px solid #ef4444',
    boxShadow: '0 0 0 2px rgba(239,68,68,0.15)',
  },
  icon: {
    fontSize: 14,
    color: '#666',
    flexShrink: 0,
  },
  input: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#fff',
    fontSize: 13,
    padding: '10px 0',
    fontFamily: 'monospace',
  },
  spinner: {
    width: 14,
    height: 14,
    border: '2px solid #333',
    borderTop: '2px solid #ef4444',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
    flexShrink: 0,
  },
  clearBtn: {
    background: 'none',
    border: 'none',
    color: '#555',
    cursor: 'pointer',
    fontSize: 16,
    padding: '0 2px',
    lineHeight: 1,
    flexShrink: 0,
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    background: '#111',
    border: '1px solid #333',
    borderRadius: 8,
    overflow: 'hidden',
    boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
    zIndex: 200,
  },
  dropdownItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '10px 14px',
    cursor: 'pointer',
    borderBottom: '1px solid #1a1a1a',
    transition: 'background 0.1s',
  },
  dropdownItemHover: {
    background: '#1a1a1a',
  },
  itemIcon: {
    fontSize: 14,
    marginTop: 1,
    flexShrink: 0,
    color: '#ef4444',
  },
  itemText: {
    flex: 1,
    minWidth: 0,
  },
  itemAddress: {
    color: '#fff',
    fontSize: 13,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  itemMeta: {
    color: '#666',
    fontSize: 11,
    marginTop: 2,
  },
  noResults: {
    padding: '12px 14px',
    color: '#555',
    fontSize: 13,
    textAlign: 'center',
  },
  mockBadge: {
    display: 'inline-block',
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: 4,
    padding: '1px 5px',
    fontSize: 10,
    color: '#666',
    marginLeft: 6,
    verticalAlign: 'middle',
  },
};

// ─── Component ───────────────────────────────────────────────
const AddressSearchBar: React.FC<AddressSearchBarProps> = ({
  onResult,
  placeholder = 'Enter address to claim a block…',
  inline = false,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AddressResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number>(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMock = !MAPBOX_TOKEN;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }

    setLoading(true);
    setError(null);

    if (isMock) {
      // Dev mode: filter mock results by query
      await new Promise(r => setTimeout(r, 200));
      const filtered = MOCK_RESULTS.filter(r =>
        r.address.toLowerCase().includes(q.toLowerCase())
      );
      setResults(filtered.length > 0 ? filtered : MOCK_RESULTS);
      setOpen(true);
      setLoading(false);
      return;
    }

    try {
      const url = buildGeocodeUrl(q, { limit: 5, types: ['address', 'poi'] });
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
      const data = await res.json();

      const mapped: AddressResult[] = (data.features ?? []).map((f: Record<string, unknown>) => {
        const ctx = (f.context as Array<{ id?: string; text?: string }>) ?? [];
        const placeCtx = ctx.find((c) => c.id?.startsWith('place'));
        const regionCtx = ctx.find((c) => c.id?.startsWith('region'));
        return {
          address: (f.place_name as string) ?? '',
          lat: ((f.center as number[])?.[1]) ?? 0,
          lng: ((f.center as number[])?.[0]) ?? 0,
          placeId: (f.id as string) ?? '',
          city: placeCtx?.text,
          state: regionCtx?.text,
        };
      });

      setResults(mapped);
      setOpen(mapped.length > 0);
    } catch (err) {
      setError('Search unavailable. Try again.');
      // Fall back to mock on error
      setResults(MOCK_RESULTS);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }, [isMock]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 400);
  }, [search]);

  const handleSelect = useCallback((result: AddressResult) => {
    setQuery(result.address);
    setOpen(false);
    setResults([]);
    onResult(result);
  }, [onResult]);

  const handleClear = useCallback(() => {
    setQuery('');
    setResults([]);
    setOpen(false);
    setError(null);
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHoveredIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHoveredIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && hoveredIdx >= 0) {
      e.preventDefault();
      handleSelect(results[hoveredIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }, [open, results, hoveredIdx, handleSelect]);

  return (
    <div
      ref={containerRef}
      style={{
        ...styles.container,
        position: inline ? 'relative' : 'absolute',
        top: inline ? undefined : 12,
        left: inline ? undefined : 12,
        right: inline ? undefined : 12,
        width: inline ? '100%' : undefined,
      }}
    >
      {/* Spinner keyframes injected once */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Input row */}
      <div style={{ ...styles.inputWrapper, ...(focused ? styles.inputWrapperFocused : {}) }}>
        <span style={styles.icon}>📍</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => { setFocused(true); if (results.length > 0) setOpen(true); }}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          style={styles.input}
          autoComplete="off"
          spellCheck={false}
        />
        {loading && <div style={styles.spinner} />}
        {!loading && query && (
          <button style={styles.clearBtn} onClick={handleClear} tabIndex={-1}>×</button>
        )}
        {isMock && <span style={styles.mockBadge}>DEV</span>}
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ padding: '6px 14px', background: '#1a0a0a', color: '#ef4444', fontSize: 12, borderRadius: '0 0 8px 8px' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div style={styles.dropdown}>
          {results.map((r, i) => (
            <div
              key={r.placeId || i}
              style={{
                ...styles.dropdownItem,
                ...(hoveredIdx === i ? styles.dropdownItemHover : {}),
                borderBottom: i < results.length - 1 ? '1px solid #1a1a1a' : 'none',
              }}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(-1)}
              onMouseDown={() => handleSelect(r)}
            >
              <span style={styles.itemIcon}>📌</span>
              <div style={styles.itemText}>
                <div style={styles.itemAddress}>{r.address}</div>
                {(r.city || r.state) && (
                  <div style={styles.itemMeta}>
                    {[r.city, r.state].filter(Boolean).join(', ')}
                    {isMock && ' • mock'}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No results */}
      {open && !loading && results.length === 0 && query.length >= 3 && (
        <div style={styles.dropdown}>
          <div style={styles.noResults}>No addresses found for "{query}"</div>
        </div>
      )}
    </div>
  );
};

export default AddressSearchBar;
