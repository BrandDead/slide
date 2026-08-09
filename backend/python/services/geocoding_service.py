"""
DEALT/SLIDE - Geocoding Service
Handles Mapbox API integration for address lookup and satellite imagery
"""

import os
import hashlib
import requests
from typing import Optional, Dict, Any, List, Tuple
from dataclasses import dataclass
from functools import lru_cache
import logging

logger = logging.getLogger(__name__)


# ============================================================================
# CONFIGURATION
# ============================================================================

MAPBOX_ACCESS_TOKEN = os.getenv('MAPBOX_ACCESS_TOKEN', '')
MAPBOX_BASE_URL = 'https://api.mapbox.com'

# City boundaries
CITY_BOUNDS: Dict[str, Dict[str, float]] = {
    'nyc': {'north': 40.917577, 'south': 40.477399, 'east': -73.700272, 'west': -74.259090},
    'la': {'north': 34.337306, 'south': 33.703652, 'east': -118.155289, 'west': -118.668176},
    'miami': {'north': 25.979434, 'south': 25.598074, 'east': -80.087280, 'west': -80.533424},
    'chicago': {'north': 42.023131, 'south': 41.644335, 'east': -87.524044, 'west': -87.940101},
    'detroit': {'north': 42.450440, 'south': 42.255192, 'east': -82.910451, 'west': -83.287959},
    'nola': {'north': 30.199430, 'south': 29.865203, 'east': -89.848477, 'west': -90.140533},
}

# Traffic score base values by city
CITY_BASE_TRAFFIC: Dict[str, int] = {
    'nyc': 70,
    'la': 55,
    'miami': 60,
    'chicago': 50,
    'detroit': 35,
    'nola': 45,
}


# ============================================================================
# DATA CLASSES
# ============================================================================

@dataclass
class GeocodingResult:
    """Result from address geocoding"""
    address: str
    formatted_address: str
    lat: float
    lng: float
    city: Optional[str]
    neighborhood: Optional[str]
    mapbox_id: str
    relevance: float
    in_service_area: bool


@dataclass
class BlockLocation:
    """Complete location data for a block"""
    address: str
    formatted_address: str
    lat: float
    lng: float
    city: str
    neighborhood: Optional[str]
    bounds: Dict[str, float]
    satellite_url: str
    traffic_score: int
    block_hash: str


# ============================================================================
# GEOCODING SERVICE
# ============================================================================

class GeocodingService:
    """
    Service for geocoding addresses and generating block location data
    """
    
    def __init__(self, access_token: str = None):
        self.access_token = access_token or MAPBOX_ACCESS_TOKEN
        if not self.access_token:
            logger.warning("Mapbox access token not configured")
    
    def search_address(
        self,
        query: str,
        limit: int = 5,
        types: List[str] = None
    ) -> List[GeocodingResult]:
        """
        Search for addresses matching query
        
        Args:
            query: Address search string
            limit: Maximum results to return
            types: Feature types to search (address, poi, etc.)
        
        Returns:
            List of GeocodingResult objects
        """
        if not self.access_token:
            raise ValueError("Mapbox access token required")
        
        if len(query) < 3:
            return []
        
        # Build request URL
        types_str = ','.join(types) if types else 'address,poi'
        url = (
            f"{MAPBOX_BASE_URL}/geocoding/v5/mapbox.places/"
            f"{requests.utils.quote(query)}.json"
        )
        
        params = {
            'access_token': self.access_token,
            'limit': limit,
            'country': 'US',
            'types': types_str,
        }
        
        try:
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            results = []
            for feature in data.get('features', []):
                lng, lat = feature['center']
                city = self._get_city_from_coordinates(lat, lng)
                neighborhood = self._extract_neighborhood(feature)
                
                results.append(GeocodingResult(
                    address=feature['text'],
                    formatted_address=feature['place_name'],
                    lat=lat,
                    lng=lng,
                    city=city,
                    neighborhood=neighborhood,
                    mapbox_id=feature['properties'].get('mapbox_id', feature['id']),
                    relevance=feature.get('relevance', 0),
                    in_service_area=city is not None,
                ))
            
            return results
            
        except requests.RequestException as e:
            logger.error(f"Geocoding request failed: {e}")
            return []
    
    def reverse_geocode(self, lat: float, lng: float) -> Optional[GeocodingResult]:
        """
        Get address for coordinates
        
        Args:
            lat: Latitude
            lng: Longitude
        
        Returns:
            GeocodingResult or None
        """
        if not self.access_token:
            raise ValueError("Mapbox access token required")
        
        url = (
            f"{MAPBOX_BASE_URL}/geocoding/v5/mapbox.places/"
            f"{lng},{lat}.json"
        )
        
        params = {
            'access_token': self.access_token,
            'limit': 1,
            'types': 'address',
        }
        
        try:
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            features = data.get('features', [])
            if not features:
                return None
            
            feature = features[0]
            city = self._get_city_from_coordinates(lat, lng)
            neighborhood = self._extract_neighborhood(feature)
            
            return GeocodingResult(
                address=feature['text'],
                formatted_address=feature['place_name'],
                lat=lat,
                lng=lng,
                city=city,
                neighborhood=neighborhood,
                mapbox_id=feature['properties'].get('mapbox_id', feature['id']),
                relevance=feature.get('relevance', 0),
                in_service_area=city is not None,
            )
            
        except requests.RequestException as e:
            logger.error(f"Reverse geocoding failed: {e}")
            return None
    
    def get_block_location(
        self,
        address: str = None,
        lat: float = None,
        lng: float = None
    ) -> Optional[BlockLocation]:
        """
        Get complete block location data from address or coordinates
        
        Args:
            address: Street address (used if lat/lng not provided)
            lat: Latitude (optional if address provided)
            lng: Longitude (optional if address provided)
        
        Returns:
            BlockLocation with all data needed for block creation
        """
        # Geocode address if coordinates not provided
        if lat is None or lng is None:
            if not address:
                raise ValueError("Either address or coordinates required")
            
            results = self.search_address(address, limit=1)
            if not results:
                return None
            
            result = results[0]
            lat = result.lat
            lng = result.lng
            formatted_address = result.formatted_address
            neighborhood = result.neighborhood
        else:
            # Reverse geocode to get address
            result = self.reverse_geocode(lat, lng)
            formatted_address = result.formatted_address if result else f"{lat:.6f}, {lng:.6f}"
            neighborhood = result.neighborhood if result else None
        
        # Check service area
        city = self._get_city_from_coordinates(lat, lng)
        if not city:
            return None
        
        # Generate block data
        block_hash = self.generate_block_hash(lat, lng)
        bounds = self._calculate_block_bounds(lat, lng)
        satellite_url = self.get_satellite_image_url(lat, lng)
        traffic_score = self._estimate_traffic_score(lat, lng, city)
        
        return BlockLocation(
            address=address or formatted_address,
            formatted_address=formatted_address,
            lat=lat,
            lng=lng,
            city=city,
            neighborhood=neighborhood,
            bounds=bounds,
            satellite_url=satellite_url,
            traffic_score=traffic_score,
            block_hash=block_hash,
        )
    
    def get_satellite_image_url(
        self,
        lat: float,
        lng: float,
        zoom: int = 18,
        width: int = 512,
        height: int = 512,
        style: str = 'satellite-streets-v12',
        retina: bool = True
    ) -> str:
        """
        Generate URL for satellite image of location
        
        Args:
            lat: Latitude
            lng: Longitude
            zoom: Map zoom level (18 = street level)
            width: Image width in pixels
            height: Image height in pixels
            style: Mapbox style ID
            retina: Use @2x retina images
        
        Returns:
            URL string for static image
        """
        retina_suffix = '@2x' if retina else ''
        
        return (
            f"{MAPBOX_BASE_URL}/styles/v1/mapbox/{style}/static/"
            f"{lng},{lat},{zoom}/{width}x{height}{retina_suffix}"
            f"?access_token={self.access_token}"
        )
    
    @staticmethod
    def generate_block_hash(lat: float, lng: float, precision: int = 6) -> str:
        """
        Generate deterministic hash for block location
        
        Args:
            lat: Latitude
            lng: Longitude
            precision: Decimal places for coordinate rounding
        
        Returns:
            Hash string for block identification
        """
        rounded_lat = round(lat, precision)
        rounded_lng = round(lng, precision)
        
        raw = f"{rounded_lat}_{rounded_lng}"
        return f"block_{hashlib.md5(raw.encode()).hexdigest()[:12]}"
    
    def _get_city_from_coordinates(self, lat: float, lng: float) -> Optional[str]:
        """Determine which supported city contains the coordinates"""
        for city, bounds in CITY_BOUNDS.items():
            if (bounds['south'] <= lat <= bounds['north'] and
                bounds['west'] <= lng <= bounds['east']):
                return city
        return None
    
    def _extract_neighborhood(self, feature: Dict) -> Optional[str]:
        """Extract neighborhood name from Mapbox feature context"""
        context = feature.get('context', [])
        for ctx in context:
            ctx_id = ctx.get('id', '')
            if ctx_id.startswith('neighborhood.') or ctx_id.startswith('locality.'):
                return ctx.get('text')
        return None
    
    def _calculate_block_bounds(
        self,
        lat: float,
        lng: float,
        size_meters: float = 100
    ) -> Dict[str, float]:
        """
        Calculate bounding box for a block
        
        Args:
            lat: Center latitude
            lng: Center longitude
            size_meters: Block size in meters
        
        Returns:
            Dict with north, south, east, west bounds
        """
        # Approximate meters to degrees conversion
        # Longitude degrees shrink by cos(latitude), NOT by abs(latitude).
        # The previous abs(lat) form squashed blocks ~29x east-west at
        # South Florida latitudes (cos(26.1°)=0.898 vs abs=26.1).
        lat_offset = size_meters / 111320
        lng_offset = size_meters / (111320 * math.cos(math.radians(lat)))
        
        return {
            'north': lat + lat_offset / 2,
            'south': lat - lat_offset / 2,
            'east': lng + lng_offset / 2,
            'west': lng - lng_offset / 2,
        }
    
    def _estimate_traffic_score(
        self,
        lat: float,
        lng: float,
        city: str
    ) -> int:
        """
        Estimate foot traffic score for location
        
        Uses city base score + deterministic variance based on coordinates.
        In production, this would integrate real traffic data.
        
        Args:
            lat: Latitude
            lng: Longitude
            city: City code
        
        Returns:
            Traffic score 1-100
        """
        base = CITY_BASE_TRAFFIC.get(city, 50)
        
        # Deterministic variance based on location
        import math
        variance_raw = abs(
            math.sin(lat * 12345) * 10000 +
            math.cos(lng * 67890) * 10000
        )
        variance = (int(variance_raw) % 30) - 15  # -15 to +15
        
        return max(10, min(100, base + variance))
    
    def check_service_area(self, lat: float, lng: float) -> Tuple[bool, Optional[str]]:
        """
        Check if coordinates are in service area
        
        Returns:
            Tuple of (is_in_service_area, city_code)
        """
        city = self._get_city_from_coordinates(lat, lng)
        return (city is not None, city)
    
    def get_supported_cities(self) -> List[Dict[str, Any]]:
        """Get list of supported cities with metadata"""
        city_names = {
            'nyc': 'New York City',
            'la': 'Los Angeles',
            'miami': 'Miami',
            'chicago': 'Chicago',
            'detroit': 'Detroit',
            'nola': 'New Orleans',
        }
        
        return [
            {
                'code': code,
                'name': city_names.get(code, code),
                'bounds': bounds,
                'baseTraffic': CITY_BASE_TRAFFIC.get(code, 50),
            }
            for code, bounds in CITY_BOUNDS.items()
        ]


# Singleton instance
_geocoding_service: Optional[GeocodingService] = None


def get_geocoding_service() -> GeocodingService:
    """Get singleton geocoding service instance"""
    global _geocoding_service
    if _geocoding_service is None:
        _geocoding_service = GeocodingService()
    return _geocoding_service
