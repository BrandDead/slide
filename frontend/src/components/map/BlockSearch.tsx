// ============================================================
// BlockSearch - Debounced address search using Mapbox Geocoding
// Allows players to search for real addresses to claim as blocks
// ============================================================

import React, { useState, useCallback, useRef, useEffect } from 'react';
import './BlockSearch.css';

interface SearchResult {
  address: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  bbox?: [number, number, number, number];
  mapboxId?: string;
}

interface BlockSearchProps {
  onResultSelect: (result: SearchResult) => void;
}

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const BlockSearch: React.FC<BlockSearchProps> = ({ onResultSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchAddress = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 3) {
      setResults([]);
      return;
    }

    setIsSearching(true);

    try {
      // Try backend first (which uses our geocoding service)
      const backendRes = await fetch(
        `${API_URL}/api/blocks/search?q=${encodeURIComponent(searchQuery)}&limit=5`
      );

      if (backendRes.ok) {
        const data = await backendRes.json();
        setResults(data.results || []);
        setIsOpen(true);
        setIsSearching(false);
        return;
      }
    } catch {
      // Backend unavailable, fall back to Mapbox directly
    }

    // Fallback: Direct Mapbox geocoding
    if (MAPBOX_TOKEN) {
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?access_token=${MAPBOX_TOKEN}&types=address,poi&limit=5&country=us`
        );
        const data = await res.json();

        const mapped: SearchResult[] = (data.features || []).map((f: any) => {
          const context = f.context || [];
          const city = context.find((c: any) => c.id?.startsWith('place'))?.text || '';
          const state = context.find((c: any) => c.id?.startsWith('region'))?.short_code?.replace('US-', '') || '';

          return {
            address: f.place_name || f.text,
            city,
            state,
            lat: f.center[1],
            lng: f.center[0],
            bbox: f.bbox,
            mapboxId: f.id,
          };
        });

        setResults(mapped);
        setIsOpen(true);
      } catch {
        setResults([]);
      }
    }

    setIsSearching(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => searchAddress(value), 400);
    },
    [searchAddress]
  );

  const handleSelect = useCallback(
    (result: SearchResult) => {
      setQuery(result.address);
      setIsOpen(false);
      onResultSelect(result);
    },
    [onResultSelect]
  );

  return (
    <div className="block-search" ref={containerRef}>
      <div className="search-input-wrapper">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          className="search-input"
          placeholder="Search address to claim..."
          value={query}
          onChange={handleInputChange}
          onFocus={() => results.length > 0 && setIsOpen(true)}
        />
        {isSearching && <span className="search-spinner">⏳</span>}
      </div>

      {isOpen && results.length > 0 && (
        <div className="search-results">
          {results.map((result, i) => (
            <div
              key={i}
              className="search-result-item"
              onClick={() => handleSelect(result)}
            >
              <span className="result-icon">📍</span>
              <div className="result-text">
                <span className="result-address">{result.address}</span>
                <span className="result-city">
                  {result.city}{result.state ? `, ${result.state}` : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BlockSearch;
