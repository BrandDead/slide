"""
DEALT/SLIDE - Block API Routes
Handles block claiming, lookup, and management via DBAdapter.
"""

from __future__ import annotations

from flask import Blueprint, request, jsonify, g
from typing import Any, Dict
import logging
import uuid

from services.geocoding_service import get_geocoding_service
from services.grid_generator import generate_block_grid
from services.db import get_db
from middleware.auth import require_auth
from config.game_constants import CLAIM_BLOCK_COST, CLAIM_HEAT_DELTA
from schemas.block_contracts import build_default_manifest, grid_cell_to_anchor_id

SUPPORTED_CITIES = ['nyc', 'la', 'miami', 'chicago', 'detroit', 'nola']

logger = logging.getLogger(__name__)

blocks_bp = Blueprint('blocks', __name__, url_prefix='/api/blocks')


def _serialize_block(block: Dict[str, Any], include_grid: bool = False) -> Dict[str, Any]:
    """Normalize DBAdapter block records for the frontend."""
    out = {
        'id': block.get('id'),
        'ownerId': block.get('owner_id'),
        'address': block.get('address'),
        'city': block.get('city'),
        'coordinates': {'lat': block.get('lat'), 'lng': block.get('lng')},
        'lat': block.get('lat'),
        'lng': block.get('lng'),
        'gangName': block.get('gang_name'),
        'trafficScore': block.get('traffic_score'),
        'incomePerHour': block.get('income_per_hour'),
        'incomePerTick': block.get('income_per_tick', 0),
        'pendingIncome': block.get('pending_income', 0),
        'heatLevel': block.get('heat_level', 0),
        'blockHash': block.get('block_hash'),
        'sceneVersion': block.get('scene_version'),
        'liveRevision': block.get('live_revision', 1),
        'claimedAt': block.get('claimed_at'),
        'bounds': {
            'north': block.get('bounds_north'),
            'south': block.get('bounds_south'),
            'east': block.get('bounds_east'),
            'west': block.get('bounds_west'),
        },
        'placements': block.get('placements') or [],
        'backgrounds': block.get('backgrounds') or {},
    }
    if include_grid:
        out['gridData'] = block.get('grid_data') or {}
        out['sceneManifest'] = block.get('scene_manifest') or {}
    return out


def _extract_coords(data: Dict[str, Any]):
    coords = data.get('coordinates') or {}
    lat = coords.get('lat', data.get('lat'))
    lng = coords.get('lng', data.get('lng'))
    return lat, lng


@blocks_bp.route('/search', methods=['GET'])
def search_address():
    """Search for addresses."""
    query = request.args.get('q', '')
    limit = min(int(request.args.get('limit', 5)), 10)

    if len(query) < 3:
        return jsonify({'results': [], 'query': query})

    try:
        geocoding = get_geocoding_service()
        results = geocoding.search_address(query, limit=limit)
        return jsonify({
            'results': [
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
    """Get preview of a block before claiming."""
    data = request.get_json() or {}
    address = data.get('address')
    lat, lng = _extract_coords(data)

    if not address and (lat is None or lng is None):
        return jsonify({'error': 'Address or coordinates required'}), 400

    try:
        geocoding = get_geocoding_service()
        location = geocoding.get_block_location(address=address, lat=lat, lng=lng)
        if not location:
            return jsonify({
                'error': 'Location not found or outside service area',
                'reason': 'outside_service_area',
            }), 404

        db = get_db()
        existing = db.find_block_by_hash(location.block_hash)
        return jsonify({
            'address': location.address,
            'formattedAddress': location.formatted_address,
            'coordinates': {'lat': location.lat, 'lng': location.lng},
            'city': location.city,
            'neighborhood': location.neighborhood,
            'satelliteImageUrl': location.satellite_url,
            'estimatedTraffic': location.traffic_score,
            'estimatedIncome': location.traffic_score * 10,
            'claimCost': CLAIM_BLOCK_COST,
            'isAvailable': existing is None,
            'currentOwner': {
                'gangName': existing.get('gang_name'),
                'claimedAt': existing.get('claimed_at'),
            } if existing else None,
        })
    except Exception as e:
        logger.error(f"Block preview failed: {e}")
        return jsonify({'error': 'Preview failed'}), 500


@blocks_bp.route('/claim', methods=['POST'])
@require_auth
def claim_block():
    """Claim a block for the user (server-authoritative cost)."""
    data = request.get_json() or {}
    user_id = g.user['id']
    address = data.get('address')
    lat, lng = _extract_coords(data)
    city = data.get('city')
    gang_name = data.get('gangName') or data.get('gang_name') or 'Unknown Gang'

    if not address or lat is None or lng is None:
        return jsonify({'error': 'Address and coordinates required'}), 400

    try:
        geocoding = get_geocoding_service()
        location = geocoding.get_block_location(
            address=address, lat=float(lat), lng=float(lng),
        )
        if not location:
            return jsonify({
                'error': 'Could not verify location',
                'reason': 'invalid_address',
            }), 400

        city = city or location.city
        if city not in SUPPORTED_CITIES:
            return jsonify({
                'error': f'City not supported. Valid cities: {", ".join(SUPPORTED_CITIES)}',
                'reason': 'outside_service_area',
            }), 400

        db = get_db()
        existing = db.find_block_by_hash(location.block_hash)
        if existing:
            return jsonify({
                'error': 'Block already claimed',
                'reason': 'already_claimed',
                'currentOwner': {
                    'gangName': existing.get('gang_name'),
                    'claimedAt': existing.get('claimed_at'),
                },
            }), 409

        player = db.get_player_state(user_id)
        if player['cash'] < CLAIM_BLOCK_COST:
            return jsonify({
                'error': 'Insufficient funds',
                'reason': 'insufficient_funds',
                'required': CLAIM_BLOCK_COST,
                'cash': player['cash'],
            }), 400

        grid_result = generate_block_grid(
            city=city,
            traffic_score=location.traffic_score,
            seed=location.block_hash,
        )

        updated_player = db.apply_economy_delta(
            user_id,
            cash_delta=-CLAIM_BLOCK_COST,
            heat_delta=CLAIM_HEAT_DELTA,
        )

        temp_id = str(uuid.uuid4())
        manifest = build_default_manifest(
            temp_id,
            scene_version=f'scene-{temp_id[:8]}-v1',
            address_display=address,
            lat=location.lat,
            lng=location.lng,
            bounds=location.bounds,
            created_at='',
        )

        block = db.claim_block(
            user_id=user_id,
            address=address,
            coords={'lat': location.lat, 'lng': location.lng},
            city=city,
            bounds=location.bounds,
            gang_name=gang_name,
            grid_data=grid_result.to_dict(),
            traffic_score=location.traffic_score,
            block_hash=location.block_hash,
            scene_manifest=manifest.to_dict(),
            heat_level=CLAIM_HEAT_DELTA,
        )

        manifest.block_id = block['id']
        manifest.scene_version = block.get('scene_version') or manifest.scene_version
        block['scene_manifest'] = manifest.to_dict()
        if getattr(db, '_dev_mode', False):
            from services.db import _mock_blocks
            _mock_blocks[block['id']] = block

        return jsonify({
            'success': True,
            'block': _serialize_block(block, include_grid=True),
            'player': updated_player,
            'claimCost': CLAIM_BLOCK_COST,
        }), 201

    except Exception as e:
        logger.error(f"Block claim failed: {e}")
        return jsonify({'error': 'Claim failed'}), 500


@blocks_bp.route('/availability/<block_hash>', methods=['GET'])
def check_availability(block_hash: str):
    """Check if a block is available for claiming."""
    try:
        db = get_db()
        block = db.find_block_by_hash(block_hash)
        if not block:
            return jsonify({'isAvailable': True, 'exists': False, 'available': True})
        return jsonify({
            'isAvailable': False,
            'available': False,
            'exists': True,
            'currentOwner': {
                'gangName': block.get('gang_name'),
                'claimedAt': block.get('claimed_at'),
            },
        })
    except Exception as e:
        logger.error(f"Availability check failed: {e}")
        return jsonify({'error': 'Check failed'}), 500


@blocks_bp.route('/my-blocks', methods=['GET'])
@require_auth
def get_my_blocks():
    """Get all blocks owned by current user."""
    user_id = g.user['id']
    try:
        db = get_db()
        blocks = db.get_user_blocks(user_id)
        serialized = []
        for b in blocks:
            item = _serialize_block(b, include_grid=True)
            item['placements'] = db.get_placements(b['id'])
            serialized.append(item)
        return jsonify({
            'blocks': serialized,
            'count': len(serialized),
            'totalIncome': sum(float(b.get('incomePerHour') or 0) for b in serialized),
        })
    except Exception as e:
        logger.error(f"My blocks fetch failed: {e}")
        return jsonify({'error': 'Fetch failed'}), 500


@blocks_bp.route('/<block_id>', methods=['GET'])
def get_block(block_id: str):
    """Get block by ID."""
    include_grid = request.args.get('includeGrid', 'false').lower() == 'true'
    try:
        db = get_db()
        block = db.get_block(block_id)
        if not block:
            return jsonify({'error': 'Block not found'}), 404
        payload = _serialize_block(block, include_grid=include_grid)
        payload['placements'] = db.get_placements(block_id)
        return jsonify(payload)
    except Exception as e:
        logger.error(f"Block fetch failed: {e}")
        return jsonify({'error': 'Fetch failed'}), 500


@blocks_bp.route('/nearby', methods=['GET'])
def get_nearby_blocks():
    """Get blocks near a location (city filter for MVP)."""
    lat = request.args.get('lat', type=float)
    lng = request.args.get('lng', type=float)
    if lat is None or lng is None:
        return jsonify({'error': 'Coordinates required'}), 400
    try:
        geocoding = get_geocoding_service()
        city = geocoding._get_city_from_coordinates(lat, lng)
        db = get_db()
        blocks = db.get_blocks_for_city(city, limit=100) if city else []
        return jsonify({
            'blocks': [_serialize_block(b) for b in blocks],
            'count': len(blocks),
            'searchCenter': {'lat': lat, 'lng': lng},
        })
    except Exception as e:
        logger.error(f"Nearby blocks fetch failed: {e}")
        return jsonify({'error': 'Fetch failed'}), 500


@blocks_bp.route('/city/<city>', methods=['GET'])
def get_city_blocks(city: str):
    """Get blocks in a specific city."""
    if city not in SUPPORTED_CITIES:
        return jsonify({'error': f'Invalid city. Valid: {SUPPORTED_CITIES}'}), 400
    limit = min(int(request.args.get('limit', 100)), 500)
    try:
        db = get_db()
        blocks = db.get_blocks_for_city(city, limit=limit)
        return jsonify({
            'blocks': [_serialize_block(b) for b in blocks],
            'count': len(blocks),
            'city': city,
        })
    except Exception as e:
        logger.error(f"City blocks fetch failed: {e}")
        return jsonify({'error': 'Fetch failed'}), 500


@blocks_bp.route('/cities', methods=['GET'])
def get_supported_cities():
    """Get list of supported cities."""
    geocoding = get_geocoding_service()
    return jsonify({'cities': geocoding.get_supported_cities()})


@blocks_bp.route('/<block_id>/members/place', methods=['POST'])
@require_auth
def place_members(block_id: str):
    """Replace crew placements on a block (owner only)."""
    user_id = g.user['id']
    data = request.get_json() or {}
    placements = data.get('placements') or []
    try:
        db = get_db()
        block = db.get_block(block_id)
        if not block:
            return jsonify({'error': 'Block not found'}), 404
        if block.get('owner_id') != user_id:
            return jsonify({'error': 'Not authorized'}), 403

        normalized = []
        for p in placements:
            x = int(p.get('gridX', p.get('x', 0)))
            y = int(p.get('gridY', p.get('y', 0)))
            if not (0 <= x < 8 and 0 <= y < 8):
                return jsonify({'error': f'Invalid grid cell ({x},{y})'}), 400
            if y in (0, 7):
                return jsonify({'error': 'Cannot place on street lane'}), 400
            normalized.append({
                'memberId': p.get('memberId') or p.get('member_id'),
                'memberName': p.get('memberName') or p.get('member_name') or 'Member',
                'role': p.get('role', 'dealer'),
                'anchorId': p.get('anchorId') or p.get('anchor_id') or grid_cell_to_anchor_id(x, y),
                'gridX': x,
                'gridY': y,
                'x': x,
                'y': y,
                'zoneType': p.get('zoneType') or p.get('zone_type') or 'sidewalk',
                'incomePerTick': int(p.get('incomePerTick') or p.get('income_per_tick') or 0),
                'exposureRisk': int(p.get('exposureRisk') or 50),
                'level': int(p.get('level') or 1),
                'health': int(p.get('health') or 100),
                'facingDeg': float(p.get('facingDeg') or 0),
                'loadout': p.get('loadout') or {},
            })

        saved = db.save_placements(block_id, normalized)
        block = db.get_block(block_id)
        return jsonify({
            'success': True,
            'blockId': block_id,
            'placements': saved,
            'liveRevision': block.get('live_revision', 1) if block else 1,
            'incomePerTick': block.get('income_per_tick', 0) if block else 0,
        })
    except Exception as e:
        logger.error(f"Place members failed: {e}")
        return jsonify({'error': 'Place failed'}), 500


@blocks_bp.route('/<block_id>/tick-income', methods=['POST'])
@require_auth
def tick_income(block_id: str):
    """Accumulate one income tick into pending_income (owner only)."""
    user_id = g.user['id']
    try:
        db = get_db()
        block = db.get_block(block_id)
        if not block:
            return jsonify({'error': 'Block not found'}), 404
        if block.get('owner_id') != user_id:
            return jsonify({'error': 'Not authorized'}), 403
        updated = db.tick_block_income(block_id)
        return jsonify({'success': True, 'block': _serialize_block(updated or block)})
    except Exception as e:
        logger.error(f"Tick income failed: {e}")
        return jsonify({'error': 'Tick failed'}), 500


@blocks_bp.route('/<block_id>/collect', methods=['POST'])
@require_auth
def collect_income(block_id: str):
    """Collect pending income into player cash."""
    user_id = g.user['id']
    try:
        db = get_db()
        result = db.collect_block_income(user_id, block_id)
        if result is None:
            return jsonify({'error': 'Block not found or not owned'}), 404
        return jsonify({
            'success': True,
            'collected': result['collected'],
            'player': result['player'],
            'block': _serialize_block(result['block']),
        })
    except Exception as e:
        logger.error(f"Collect income failed: {e}")
        return jsonify({'error': 'Collect failed'}), 500


@blocks_bp.route('/<block_id>/regenerate-grid', methods=['POST'])
@require_auth
def regenerate_block_grid(block_id: str):
    """Regenerate grid for a block (owner only) — deferred."""
    return jsonify({'error': 'Not implemented yet'}), 501
# ============================================================================
# BLOCK SNAPSHOT ROUTES (for BlockStateEngine integration)
# ============================================================================

@blocks_bp.route('/<block_id>/snapshot', methods=['GET'])
@require_auth
def get_block_snapshot_endpoint(block_id: str):
    """
    Get immutable snapshot of block state.
    Used by combat, drive-by, and other systems.
    
    Query params:
        snapshot_id: Optional specific snapshot UUID
    
    Returns:
        BlockSnapshot with complete state
    """
    try:
        from services.block_state_engine import get_block_state_engine
        
        snapshot_id = request.args.get('snapshot_id')
        
        engine = get_block_state_engine()
        snapshot = engine.get_block_snapshot(block_id, snapshot_id)
        
        if not snapshot:
            return jsonify({'error': 'Snapshot not found'}), 404
        
        return jsonify(snapshot.to_dict())
        
    except Exception as e:
        logger.error(f"Failed to get snapshot: {e}")
        return jsonify({'error': 'Failed to get snapshot'}), 500


@blocks_bp.route('/<block_id>/snapshot', methods=['POST'])
@require_auth
def create_block_snapshot_endpoint(block_id: str):
    """
    Create and persist a new immutable snapshot.
    Called at combat start to freeze block state.
    
    Returns:
        snapshot_id
    """
    try:
        from services.block_state_engine import get_block_state_engine
        
        engine = get_block_state_engine()
        snapshot_id = engine.create_snapshot(block_id)
        
        if not snapshot_id:
            return jsonify({'error': 'Failed to create snapshot'}), 500
        
        return jsonify({
            'snapshot_id': snapshot_id,
            'block_id': block_id
        }), 201
        
    except Exception as e:
        logger.error(f"Failed to create snapshot: {e}")
        return jsonify({'error': 'Failed to create snapshot'}), 500


# ============================================================================
# PHASE 7 — BLOCK BACKGROUNDS + RECON VIEWS
# ============================================================================

@blocks_bp.route('/<block_id>/generate_backgrounds', methods=['POST'])
@require_auth
def generate_backgrounds(block_id: str):
    """
    Generate and persist background imagery for a claimed block.

    Generates:
    - Mapbox static satellite image (top-down view)
    - Street View images for N/E/S/W headings (optional, requires GOOGLE_MAPS_API_KEY
      and ENABLE_STREET_VIEW=true)
    - 8x8 lat/lon anchor grid stored in block_grid_anchors table

    Returns:
        Generated background URLs + anchors_json
    """
    import os

    try:
        from services.db import get_db
        db = get_db()

        block = db.get_block(block_id)
        if not block:
            return jsonify({'error': 'Block not found'}), 404

        lat = block.get('lat')
        lng = block.get('lng')
        if lat is None or lng is None:
            return jsonify({'error': 'Block has no coordinates'}), 400

        bounds = {
            'north': block.get('bounds_north', lat + 0.001),
            'south': block.get('bounds_south', lat - 0.001),
            'east': block.get('bounds_east', lng + 0.001),
            'west': block.get('bounds_west', lng - 0.001),
        }

        mapbox_token = os.getenv('MAPBOX_ACCESS_TOKEN', '')
        google_key = os.getenv('GOOGLE_MAPS_API_KEY', '')
        enable_street_view = os.getenv('ENABLE_STREET_VIEW', 'false').lower() == 'true'

        backgrounds = {}

        # ── Top-down Mapbox satellite image ──────────────────────────────
        if mapbox_token:
            # Build Mapbox Static Images API URL
            # https://docs.mapbox.com/api/maps/static-images/
            center_lng = (bounds['east'] + bounds['west']) / 2
            center_lat = (bounds['north'] + bounds['south']) / 2
            topdown_url = (
                f"https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/"
                f"{center_lng},{center_lat},17,0/800x600"
                f"?access_token={mapbox_token}"
            )
            backgrounds['topdownUrl'] = topdown_url
        else:
            backgrounds['topdownUrl'] = None

        # ── Street View images (optional) ─────────────────────────────────
        if google_key and enable_street_view:
            sv_base = "https://maps.googleapis.com/maps/api/streetview"
            sv_params = f"size=800x400&location={lat},{lng}&key={google_key}"
            backgrounds['streetNUrl'] = f"{sv_base}?{sv_params}&heading=0&pitch=0"
            backgrounds['streetEUrl'] = f"{sv_base}?{sv_params}&heading=90&pitch=0"
            backgrounds['streetSUrl'] = f"{sv_base}?{sv_params}&heading=180&pitch=0"
            backgrounds['streetWUrl'] = f"{sv_base}?{sv_params}&heading=270&pitch=0"
        else:
            backgrounds['streetNUrl'] = None
            backgrounds['streetEUrl'] = None
            backgrounds['streetSUrl'] = None
            backgrounds['streetWUrl'] = None

        # ── 8×8 grid lat/lon anchors ──────────────────────────────────────
        grid_size = 8
        lat_step = (bounds['north'] - bounds['south']) / grid_size
        lng_step = (bounds['east'] - bounds['west']) / grid_size

        anchors_json: dict = {}
        for row in range(grid_size):
            for col in range(grid_size):
                tile_lat = bounds['south'] + (row + 0.5) * lat_step
                tile_lng = bounds['west'] + (col + 0.5) * lng_step
                anchors_json[f"{col},{row}"] = {'lat': tile_lat, 'lng': tile_lng}

        # ── Persist to DB ─────────────────────────────────────────────────
        db.update_block_backgrounds(block_id, backgrounds)
        db.save_block_grid_anchors(block_id, anchors_json)

        logger.info(f"Generated backgrounds for block {block_id}")

        return jsonify({
            'block_id': block_id,
            'backgrounds': backgrounds,
            'anchors_json': anchors_json,
        }), 201

    except Exception as e:
        logger.error(f"generate_backgrounds failed: {e}", exc_info=True)
        return jsonify({'error': 'Background generation failed'}), 500
