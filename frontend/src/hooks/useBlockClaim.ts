/**
 * DEALT/SLIDE - useBlockClaim Hook
 * React hook for block claiming workflow
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { locationService } from '../services/location.service';
import { generateBlockGrid } from '../utils/gridGenerator';
import type {
  AddressSuggestion,
  BlockPreview,
  Block,
  BlockClaimResponse,
  SupportedCity,
} from '../types/location.types';

// ============================================================================
// TYPES
// ============================================================================

interface UseBlockClaimState {
  searchQuery: string;
  suggestions: AddressSuggestion[];
  isSearching: boolean;
  searchError: string | null;
  preview: BlockPreview | null;
  isLoadingPreview: boolean;
  previewError: string | null;
  isClaiming: boolean;
  claimError: string | null;
  claimedBlock: Block | null;
  selectedLocation: AddressSuggestion | null;
}

interface UseBlockClaimActions {
  setSearchQuery: (query: string) => void;
  selectSuggestion: (suggestion: AddressSuggestion) => void;
  claimBlock: (gangName: string) => Promise<BlockClaimResponse>;
  reset: () => void;
  clearErrors: () => void;
}

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useBlockClaim(userId: string): [UseBlockClaimState, UseBlockClaimActions] {
  const [searchQuery, setSearchQueryInternal] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  
  const [preview, setPreview] = useState<BlockPreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimedBlock, setClaimedBlock] = useState<Block | null>(null);
  
  const [selectedLocation, setSelectedLocation] = useState<AddressSuggestion | null>(null);
  
  const searchDebounceRef = useRef<NodeJS.Timeout>();
  
  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryInternal(query);
    setSearchError(null);
    
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }
    
    searchDebounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      
      try {
        const result = await locationService.searchAddress(query);
        setSuggestions(result.suggestions);
      } catch (error) {
        setSearchError('Search failed. Please try again.');
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);
  
  const selectSuggestion = useCallback(async (suggestion: AddressSuggestion) => {
    setSelectedLocation(suggestion);
    setSuggestions([]);
    setSearchQueryInternal(suggestion.formattedAddress);
    setPreviewError(null);
    
    if (!suggestion.inServiceArea) {
      setPreviewError(
        'This location is outside our service area. We support: NYC, LA, Miami, Chicago, Detroit, and New Orleans.'
      );
      return;
    }
    
    setIsLoadingPreview(true);
    
    try {
      const blockPreview = await locationService.getBlockPreview(suggestion.coordinates);
      
      if (!blockPreview) {
        setPreviewError('Could not load block preview.');
        return;
      }
      
      setPreview(blockPreview);
    } catch (error) {
      setPreviewError('Failed to load block preview.');
    } finally {
      setIsLoadingPreview(false);
    }
  }, []);
  
  const claimBlock = useCallback(async (gangName: string): Promise<BlockClaimResponse> => {
    if (!selectedLocation) {
      return { success: false, error: 'No location selected', reason: 'invalid_address' };
    }
    
    setIsClaiming(true);
    setClaimError(null);
    
    try {
      const response = await locationService.claimBlock({
        address: selectedLocation.formattedAddress,
        userId,
      });
      
      if (response.success && response.block) {
        setClaimedBlock(response.block);
      } else {
        setClaimError(response.error || 'Claim failed');
      }
      
      return response;
    } catch (error) {
      const errorMessage = 'Failed to claim block. Please try again.';
      setClaimError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsClaiming(false);
    }
  }, [selectedLocation, userId]);
  
  const reset = useCallback(() => {
    setSearchQueryInternal('');
    setSuggestions([]);
    setIsSearching(false);
    setSearchError(null);
    setPreview(null);
    setIsLoadingPreview(false);
    setPreviewError(null);
    setIsClaiming(false);
    setClaimError(null);
    setClaimedBlock(null);
    setSelectedLocation(null);
  }, []);
  
  const clearErrors = useCallback(() => {
    setSearchError(null);
    setPreviewError(null);
    setClaimError(null);
  }, []);
  
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);
  
  return [
    {
      searchQuery,
      suggestions,
      isSearching,
      searchError,
      preview,
      isLoadingPreview,
      previewError,
      isClaiming,
      claimError,
      claimedBlock,
      selectedLocation,
    },
    {
      setSearchQuery,
      selectSuggestion,
      claimBlock,
      reset,
      clearErrors,
    },
  ];
}

// ============================================================================
// MY BLOCKS HOOK
// ============================================================================

export function useMyBlocks(userId: string) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchBlocks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/blocks/my-blocks`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch blocks');
      
      const data = await response.json();
      setBlocks(data.blocks);
    } catch (err) {
      setError('Failed to load your blocks');
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);
  
  return {
    blocks,
    isLoading,
    error,
    refetch: fetchBlocks,
    totalIncome: blocks.reduce((sum, b) => sum + b.incomePerHour, 0),
  };
}

// ============================================================================
// NEARBY BLOCKS HOOK
// ============================================================================

export function useNearbyBlocks(lat: number | null, lng: number | null, radiusKm: number = 1) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (lat === null || lng === null) {
      setBlocks([]);
      return;
    }
    
    const fetchNearby = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch(
          `/api/blocks/nearby?lat=${lat}&lng=${lng}&radius=${radiusKm}`
        );
        
        if (!response.ok) throw new Error('Failed to fetch nearby blocks');
        
        const data = await response.json();
        setBlocks(data.blocks);
      } catch (err) {
        setError('Failed to load nearby blocks');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchNearby();
  }, [lat, lng, radiusKm]);
  
  return { blocks, isLoading, error };
}

// ============================================================================
// GRID PREVIEW HOOK
// ============================================================================

export function useGridPreview(city: SupportedCity | null, trafficScore: number) {
  const [grid, setGrid] = useState<ReturnType<typeof generateBlockGrid> | null>(null);
  
  useEffect(() => {
    if (!city) {
      setGrid(null);
      return;
    }
    
    const result = generateBlockGrid(city, trafficScore);
    setGrid(result);
  }, [city, trafficScore]);
  
  return grid;
}

// ============================================================================
// CURRENT LOCATION HOOK
// ============================================================================

export function useCurrentLocation() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setIsLoading(false);
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError('Location permission denied');
            break;
          case err.POSITION_UNAVAILABLE:
            setError('Location unavailable');
            break;
          case err.TIMEOUT:
            setError('Location request timed out');
            break;
          default:
            setError('Failed to get location');
        }
        setIsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  }, []);
  
  return {
    location,
    error,
    isLoading,
    requestLocation,
    hasLocation: location !== null,
  };
}
