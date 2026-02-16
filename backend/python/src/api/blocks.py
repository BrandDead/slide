"""
DEALT/SLIDE - Block API Routes
Handles block claiming, lookup, and management
"""

from flask import Blueprint, request, jsonify, current_app
from functools import wraps
from typing import Optional
import logging

import sys
import os
# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

from services.geocoding_service import get_geocoding_service, GeocodingService
from src.engines.block_generator import generate_block_grid, GridConfig
from models.block import Block, SUPPORTED_CITIES

logger = logging.getLogger(__name__)

blocks_bp = Blueprint('blocks', __name__, url_prefix='/api/blocks')


# ============================================================================
# AUTHENTICATION DECORATOR (Placeholder)
# ============================================================================

def require_auth(f):
    """Require authentication for route"""
    @wraps(f)
    def decorated(*args, **kwargs):
        # TODO: Implement JWT validation
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Authentication required'}), 401
        
        # For now, extract user_id from request
        # In production, decode JWT and get user
        token = auth_header.replace('Bearer ', '')
        request.user_id = token  # Placeholder
        
        return f(*args, **kwargs)
    return decorated


# ============================================================================
# ROUTES
# ============================================================================

@blocks_bp.route('/search', methods=['GET'])
def search_address():
    """
    Search for addresses
    
    Query params:
        q: Search query (required)
        limit: Max results (default 5)
    
    Returns:
        List of address suggestions
    """
    query = request.args.get('q', '')
    limit = min(int(request.args.get('limit', 5)), 10)
    
    if len(query) < 3:
        return jsonify({
            'suggestions': [],
            'query': query,
        })
    
    try:
        geocoding = get_geocoding_service()
        results = geocoding.search_address(query, limit=limit)
        
        return jsonify({
            'suggestions': [
                {
                    'address': r.address,
                    'formattedAddress': r.formatted_address,
                    'coordinates': {'lat': r.lat, 'lng': r.lng},
                    'city': r.city,
                    'inServiceArea': r.in_service_area,
                    'mapboxId': r.mapbox_id,
                }
                for r in results
            ],
            'query': query,
        })
    
    except Exception as e:
        logger.error(f"Address search failed: {e}")
        return jsonify({'error': 'Search failed'}), 500


@blocks_bp.route('/preview', methods=['POST'])
def get_block_preview():
    """
    Get preview of a block before claiming
    
    Body:
        address: Optional address string
        lat: Optional latitude
        lng: Optional longitude
    
    Returns:
        Block preview with satellite image and estimates
    """
    data = request.get_json()
    
    address = data.get('address')
    lat = data.get('lat')
    lng = data.get('lng')
    
    if not address and (lat is None or lng is None):
        return jsonify({'error': 'Address or coordinates required'}), 400
    
    try:
        geocoding = get_geocoding_service()
        location = geocoding.get_block_location(
            address=address,
            lat=lat,
            lng=lng
        )
        
        if not location:
            return jsonify({
                'error': 'Location not found or outside service area',
                'reason': 'outside_service_area'
            }), 404
        
        # Check if block already exists
        existing = Block.find_by_hash(location.block_hash)
        
        return jsonify({
            'address': location.address,
            'formattedAddress': location.formatted_address,
            'coordinates': {'lat': location.lat, 'lng': location.lng},
            'city': location.city,
            'neighborhood': location.neighborhood,
            'satelliteImageUrl': location.satellite_url,
            'estimatedTraffic': location.traffic_score,
            'estimatedIncome': location.traffic_score * 10,
            'isAvailable': existing is None or not existing.is_claimed,
            'currentOwner': {
                'gangName': existing.owner_gang_name,
                'claimedAt': existing.claimed_at.isoformat(),
            } if existing and existing.is_claimed else None,
        })
    
    except Exception as e:
        logger.error(f"Block preview failed: {e}")
        return jsonify({'error': 'Preview failed'}), 500


@blocks_bp.route('/claim', methods=['POST'])
@require_auth
def claim_block():
    """
    Claim a block for the user
    
    Body:
        address: Full address string
        coordinates: {lat, lng}
        city: City code
    
    Returns:
        Complete block data with grid
    """
    data = request.get_json()
    user_id = request.user_id
    
    address = data.get('address')
    coords = data.get('coordinates', {})
    city = data.get('city')
    
    lat = coords.get('lat')
    lng = coords.get('lng')
    
    if not address or lat is None or lng is None:
        return jsonify({'error': 'Address and coordinates required'}), 400
    
    if city not in SUPPORTED_CITIES:
        return jsonify({
            'error': f'City not supported. Valid cities: {", ".join(SUPPORTED_CITIES)}',
            'reason': 'outside_service_area'
        }), 400
    
    try:
        geocoding = get_geocoding_service()
        location = geocoding.get_block_location(lat=lat, lng=lng)
        
        if not location:
            return jsonify({
                'error': 'Could not verify location',
                'reason': 'invalid_address'
            }), 400
        
        # Check if block exists
        existing = Block.find_by_hash(location.block_hash)
        
        if existing and existing.is_claimed:
            return jsonify({
                'error': 'Block already claimed',
                'reason': 'already_claimed',
                'currentOwner': {
                    'gangName': existing.owner_gang_name,
                    'claimedAt': existing.claimed_at.isoformat(),
                }
            }), 409
        
        # Generate grid
        grid_result = generate_block_grid(
            city=city,
            traffic_score=location.traffic_score,
            seed=location.block_hash,  # Deterministic grid
        )
        
        # Create or update block
        if existing:
            block = existing
        else:
            block = Block(
                address=address,
                formatted_address=location.formatted_address,
                city=city,
                lat=lat,
                lng=lng,
                block_hash=location.block_hash,
            )
        
        # Set block properties
        block.neighborhood = location.neighborhood
        block.satellite_image_url = location.satellite_url
        block.grid_data = grid_result.to_dict()
        block.traffic_score = location.traffic_score
        block.income_per_hour = location.traffic_score * 10
        block.cover_density = grid_result.stats.get('averageCover', 0.3)
        
        # Set bounds
        block.bounds_north = location.bounds['north']
        block.bounds_south = location.bounds['south']
        block.bounds_east = location.bounds['east']
        block.bounds_west = location.bounds['west']
        
        # Claim for user
        # TODO: Get gang name from user profile
        gang_name = data.get('gangName', 'Unknown Gang')
        block.claim(user_id, gang_name)
        
        # Save to database
        from extensions import db
        db.session.add(block)
        db.session.commit()
        
        return jsonify(block.to_dict(include_grid=True)), 201
    
    except Exception as e:
        logger.error(f"Block claim failed: {e}")
        return jsonify({'error': 'Claim failed'}), 500


@blocks_bp.route('/availability/<block_hash>', methods=['GET'])
def check_availability(block_hash: str):
    """
    Check if a block is available for claiming
    
    Returns:
        Availability status and current owner if claimed
    """
    try:
        block = Block.find_by_hash(block_hash)
        
        if not block:
            return jsonify({
                'isAvailable': True,
                'exists': False,
            })
        
        return jsonify({
            'isAvailable': not block.is_claimed,
            'exists': True,
            'currentOwner': {
                'gangName': block.owner_gang_name,
                'claimedAt': block.claimed_at.isoformat(),
            } if block.is_claimed else None,
        })
    
    except Exception as e:
        logger.error(f"Availability check failed: {e}")
        return jsonify({'error': 'Check failed'}), 500


@blocks_bp.route('/<block_id>', methods=['GET'])
def get_block(block_id: str):
    """
    Get block by ID
    
    Query params:
        includeGrid: Include full grid data (default false)
    
    Returns:
        Block data
    """
    include_grid = request.args.get('includeGrid', 'false').lower() == 'true'
    
    try:
        block = Block.query.get(block_id)
        
        if not block:
            return jsonify({'error': 'Block not found'}), 404
        
        return jsonify(block.to_dict(include_grid=include_grid))
    
    except Exception as e:
        logger.error(f"Block fetch failed: {e}")
        return jsonify({'error': 'Fetch failed'}), 500


@blocks_bp.route('/my-blocks', methods=['GET'])
@require_auth
def get_my_blocks():
    """
    Get all blocks owned by current user
    
    Returns:
        List of owned blocks
    """
    user_id = request.user_id
    
    try:
        blocks = Block.query.filter_by(owner_id=user_id).all()
        
        return jsonify({
            'blocks': [b.to_dict() for b in blocks],
            'count': len(blocks),
            'totalIncome': sum(b.income_per_hour for b in blocks),
        })
    
    except Exception as e:
        logger.error(f"My blocks fetch failed: {e}")
        return jsonify({'error': 'Fetch failed'}), 500


@blocks_bp.route('/nearby', methods=['GET'])
def get_nearby_blocks():
    """
    Get blocks near a location
    
    Query params:
        lat: Latitude (required)
        lng: Longitude (required)
        radius: Radius in km (default 1)
    
    Returns:
        List of nearby blocks
    """
    lat = request.args.get('lat', type=float)
    lng = request.args.get('lng', type=float)
    radius = request.args.get('radius', 1.0, type=float)
    
    if lat is None or lng is None:
        return jsonify({'error': 'Coordinates required'}), 400
    
    try:
        blocks = Block.find_nearby(lat, lng, radius_km=radius)
        
        return jsonify({
            'blocks': [b.to_dict() for b in blocks],
            'count': len(blocks),
            'searchCenter': {'lat': lat, 'lng': lng},
            'radiusKm': radius,
        })
    
    except Exception as e:
        logger.error(f"Nearby blocks fetch failed: {e}")
        return jsonify({'error': 'Fetch failed'}), 500


@blocks_bp.route('/city/<city>', methods=['GET'])
def get_city_blocks(city: str):
    """
    Get blocks in a specific city
    
    Path params:
        city: City code (nyc, la, etc.)
    
    Query params:
        limit: Max results (default 100)
        unclaimed: Only show unclaimed (default false)
    
    Returns:
        List of blocks in city
    """
    if city not in SUPPORTED_CITIES:
        return jsonify({'error': f'Invalid city. Valid: {SUPPORTED_CITIES}'}), 400
    
    limit = min(int(request.args.get('limit', 100)), 500)
    unclaimed_only = request.args.get('unclaimed', 'false').lower() == 'true'
    
    try:
        if unclaimed_only:
            blocks = Block.find_unclaimed(city=city, limit=limit)
        else:
            blocks = Block.find_by_city(city, limit=limit)
        
        return jsonify({
            'blocks': [b.to_dict() for b in blocks],
            'count': len(blocks),
            'city': city,
        })
    
    except Exception as e:
        logger.error(f"City blocks fetch failed: {e}")
        return jsonify({'error': 'Fetch failed'}), 500


@blocks_bp.route('/cities', methods=['GET'])
def get_supported_cities():
    """
    Get list of supported cities
    
    Returns:
        List of city codes and names
    """
    geocoding = get_geocoding_service()
    return jsonify({
        'cities': geocoding.get_supported_cities()
    })


@blocks_bp.route('/<block_id>/regenerate-grid', methods=['POST'])
@require_auth
def regenerate_block_grid(block_id: str):
    """
    Regenerate grid for a block (owner only)
    
    Returns:
        Updated block with new grid
    """
    user_id = request.user_id
    
    try:
        block = Block.query.get(block_id)
        
        if not block:
            return jsonify({'error': 'Block not found'}), 404
        
        if str(block.owner_id) != user_id:
            return jsonify({'error': 'Not authorized'}), 403
        
        # Generate new grid with new seed
        grid_result = generate_block_grid(
            city=block.city,
            traffic_score=block.traffic_score,
        )
        
        block.grid_data = grid_result.to_dict()
        block.cover_density = grid_result.stats.get('averageCover', 0.3)
        block.generation_version = '1.0.1'  # Increment version
        
        from extensions import db
        db.session.commit()
        
        return jsonify(block.to_dict(include_grid=True))
    
    except Exception as e:
        logger.error(f"Grid regeneration failed: {e}")
        return jsonify({'error': 'Regeneration failed'}), 500
