"""
DEALT/SLIDE - Block API Routes
Handles block claiming, lookup, and management via DBAdapter.
"""

from __future__ import annotations

from flask import Blueprint, request, jsonify, g
from typing import Any, Dict
import json
import logging
import math
import uuid

from services.geocoding_service import get_geocoding_service
from services.grid_generator import (
    generate_block_grid,
    parse_finite_decimal,
    parse_python_integer,
    resolve_block_dna_profile,
    resolve_block_grid_tiles,
)
from services.db import get_db
from middleware.auth import require_auth
from config.game_constants import CLAIM_BLOCK_COST, CLAIM_HEAT_DELTA
from schemas.block_contracts import build_default_manifest, grid_cell_to_anchor_id
from services.block_dna import (
    attach_dna_snapshot,
    build_dna_snapshot,
    read_dna_snapshot,
)

SUPPORTED_CITIES = ['nyc', 'la', 'miami', 'chicago', 'detroit', 'nola']

logger = logging.getLogger(__name__)

PLACEMENT_ZONE_INCOME = {
    'street': 100,
    'curb': 80,
    'sidewalk': 60,
    'storefront': 40,
    'alley': 20,
    'parking': 30,
    'rooftop': 0,
    'building': 0,
}
INCOME_ROLES = {'dealer', 'chemist', 'runner'}
NON_DEPLOYABLE_MEMBER_STATUSES = {
    'dead', 'arrested', 'hospitalized', 'injured', 'jailed', 'defected',
    'backdoored', 'on_the_run', 'missing',
}

blocks_bp = Blueprint('blocks', __name__, url_prefix='/api/blocks')


def _serialize_block(block: Dict[str, Any], include_grid: bool = False) -> Dict[str, Any]:
    """Normalize DBAdapter block records for the frontend."""
    metadata = block.get('metadata') or {}
    if isinstance(metadata, str):
        try:
            metadata = json.loads(metadata)
        except (TypeError, ValueError):
            metadata = {}
    if not isinstance(metadata, dict):
        metadata = {}
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
        'incomePerTick': block.get('income_per_tick', metadata.get('incomePerTick', 0)),
        'pendingIncome': block.get('pending_income', metadata.get('pendingIncome', 0)),
        'heatLevel': block.get('heat_level', metadata.get('heatLevel', 0)),
        'morale': block.get('morale', metadata.get('morale')),
        'blockHash': block.get('block_hash'),
        'sceneVersion': block.get('scene_version'),
        'liveRevision': block.get('live_revision', metadata.get('liveRevision', 1)),
        'claimedAt': block.get('claimed_at'),
        'bounds': {
            'north': block.get('bounds_north'),
            'south': block.get('bounds_south'),
            'east': block.get('bounds_east'),
            'west': block.get('bounds_west'),
        },
        'placements': block.get('placements') or [],
        'backgrounds': block.get('backgrounds') or {},
        # Existing JSON metadata carries the durable encounter receipt used by
        # the parallel Supabase hydration path. Returning it makes either
        # hydration order preserve local consequence idempotency.
        'metadata': metadata,
    }
    # Authoritative tactical identity. Always returned (claim, my-blocks, single
    # block, tick, collect) so the client never has to re-resolve a claimed
    # block against a catalog that may have grown since it was claimed.
    # None for records claimed before snapshots shipped — the client falls back
    # to its pinned legacy resolver for those.
    snapshot = read_dna_snapshot(block.get('grid_data'))
    out['dnaSnapshot'] = snapshot
    out['dnaId'] = snapshot.get('dnaId') if snapshot else None
    if include_grid:
        out['gridData'] = block.get('grid_data') or {}
        out['sceneManifest'] = block.get('scene_manifest') or {}
    return out


def _extract_coords(data: Dict[str, Any]):
    coords = data.get('coordinates')
    if coords is None:
        coords = {}
    if not isinstance(coords, dict):
        raise ValueError('coordinates must be an object')
    lat = coords.get('lat', data.get('lat'))
    lng = coords.get('lng', data.get('lng'))
    return lat, lng


def _parse_grid_coordinate(value: Any) -> int:
    """Parse an integer-like grid coordinate without truncating decimals."""
    try:
        numeric = parse_finite_decimal(value)
    except ValueError:
        raise ValueError('Grid coordinates must be integers') from None
    if not numeric.is_integer():
        raise ValueError('Grid coordinates must be integers')
    return int(numeric)


def _placement_income(zone_type: str, role: str, level: int, income_multiplier: float) -> int:
    """Mirror the existing client placement formula with server-owned inputs."""
    if role not in INCOME_ROLES:
        return 0
    base = PLACEMENT_ZONE_INCOME.get(zone_type, 0)
    level_bonus = 1 + (level - 1) * 0.12
    role_multiplier = 1.0 if role == 'dealer' else 0.7
    return math.floor(base * level_bonus * role_multiplier * income_multiplier + 0.5)


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
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Request body must be a JSON object'}), 400
    address = data.get('address')
    try:
        lat, lng = _extract_coords(data)
    except ValueError as error:
        return jsonify({'error': str(error)}), 400

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
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Request body must be a JSON object'}), 400
    user_id = g.user['id']
    address = data.get('address')
    try:
        lat, lng = _extract_coords(data)
    except ValueError as error:
        return jsonify({'error': str(error)}), 400
    if 'gangName' in data:
        gang_name = data['gangName']
    elif 'gang_name' in data:
        gang_name = data['gang_name']
    else:
        gang_name = 'Unknown Gang'

    if not isinstance(address, str) or not address.strip() or lat is None or lng is None:
        return jsonify({'error': 'Address and coordinates required'}), 400
    if not isinstance(gang_name, str):
        return jsonify({'error': 'gangName must be a string'}), 400
    gang_name = gang_name.strip() or 'Unknown Gang'
    if isinstance(lat, bool) or isinstance(lng, bool):
        return jsonify({'error': 'Coordinates must be finite numbers'}), 400
    try:
        lat = float(lat)
        lng = float(lng)
    except (TypeError, ValueError):
        return jsonify({'error': 'Coordinates must be finite numbers'}), 400
    if (
        not math.isfinite(lat)
        or not math.isfinite(lng)
        or not -90 <= lat <= 90
        or not -180 <= lng <= 180
    ):
        return jsonify({'error': 'Coordinates are outside valid latitude/longitude bounds'}), 400

    try:
        geocoding = get_geocoding_service()
        location = geocoding.get_block_location(
            address=address.strip(), lat=lat, lng=lng,
        )
        if not location:
            return jsonify({
                'error': 'Could not verify location',
                'reason': 'invalid_address',
            }), 400

        # The geocoder-verified coordinates own the service-area city. Never
        # let an optional client label misclassify a real address.
        city = location.city
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

        # Server-authoritative DNA. Resolved here from verified geocoder output,
        # never from a client-supplied dnaId, and snapshotted by value so the
        # block keeps this tactical identity through catalog growth and later
        # balance edits. Stored additively inside the existing grid_data JSON,
        # which is why this needs no schema migration.
        dna_snapshot = build_dna_snapshot(
            lat=location.lat,
            lng=location.lng,
            address=address,
        )
        claimed_dna_id = data.get('dnaId') or data.get('dna_id')
        if claimed_dna_id and claimed_dna_id != dna_snapshot['dnaId']:
            logger.info(
                'Ignoring client-proposed dnaId %s; server resolved %s for %s',
                claimed_dna_id, dna_snapshot['dnaId'], location.block_hash,
            )
        grid_result = generate_block_grid(
            city=city,
            traffic_score=location.traffic_score,
            seed=location.block_hash,
            zone_layout=dna_snapshot['zoneLayout'],
            global_cover_bonus=dna_snapshot.get('globalCoverBonus', 0.0),
        )
        grid_payload = attach_dna_snapshot(grid_result.to_dict(), dna_snapshot)

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
            grid_data=grid_payload,
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
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Request body must be a JSON object'}), 400
    if 'placements' not in data:
        return jsonify({'error': 'placements is required'}), 400
    placements = data['placements']
    if not isinstance(placements, list):
        return jsonify({'error': 'placements must be an array'}), 400
    try:
        db = get_db()
        block = db.get_block(block_id)
        if not block:
            return jsonify({'error': 'Block not found'}), 404
        if block.get('owner_id') != user_id:
            return jsonify({'error': 'Not authorized'}), 403

        gameplay_tiles, grid_source = resolve_block_grid_tiles(block)
        if grid_source == 'missing':
            return jsonify({'error': 'Block has no usable placement grid'}), 400

        dna_profile = resolve_block_dna_profile(block)
        max_members = dna_profile.get('maxMembers') if dna_profile else None
        if (
            isinstance(max_members, (int, float))
            and not isinstance(max_members, bool)
            and math.isfinite(max_members)
        ):
            member_cap = int(max_members)
            if len(placements) > member_cap:
                return jsonify({'error': f'Block supports at most {member_cap} members'}), 400

        validated = []
        occupied_cells = set()
        member_ids = set()
        for p in placements:
            if not isinstance(p, dict):
                return jsonify({'error': 'Each placement must be an object'}), 400
            try:
                x = _parse_grid_coordinate(p.get('gridX', p.get('x')))
                y = _parse_grid_coordinate(p.get('gridY', p.get('y')))
            except ValueError as error:
                return jsonify({'error': str(error)}), 400

            height = len(gameplay_tiles)
            width = len(gameplay_tiles[0])
            if not (0 <= x < width and 0 <= y < height):
                return jsonify({'error': f'Invalid grid cell ({x},{y})'}), 400

            tile = gameplay_tiles[y][x]
            if not tile.get('deployable', False):
                return jsonify({'error': f'Grid cell ({x},{y}) is not deployable'}), 400

            member_id = p.get('memberId') or p.get('member_id')
            if not isinstance(member_id, str) or not member_id.strip():
                return jsonify({'error': 'memberId is required'}), 400
            member_id = member_id.strip()
            if member_id in member_ids:
                return jsonify({'error': f'Duplicate memberId: {member_id}'}), 400
            if (x, y) in occupied_cells:
                return jsonify({'error': f'Grid cell ({x},{y}) is already occupied'}), 400
            member_ids.add(member_id)
            occupied_cells.add((x, y))

            validated.append((p, member_id, x, y, tile))

        roster_rows = db.get_owned_members(user_id, list(member_ids))
        roster_by_id = {
            str(row.get('id')): row
            for row in roster_rows
            if isinstance(row, dict) and row.get('id')
        }
        missing_members = sorted(member_ids - set(roster_by_id))
        if missing_members:
            return jsonify({'error': 'One or more members do not belong to this player'}), 400

        for member_id, roster in roster_by_id.items():
            status = str(roster.get('status') or '').lower()
            if status in NON_DEPLOYABLE_MEMBER_STATUSES:
                return jsonify({'error': f'Member {member_id} cannot be deployed while {status}'}), 400

        existing_by_member = {
            str(p.get('memberId') or p.get('member_id')): p
            for p in db.get_placements(block_id)
            if isinstance(p, dict) and (p.get('memberId') or p.get('member_id'))
        }
        try:
            income_multiplier = float(
                dna_profile.get('incomeMultiplier', 1.0) if dna_profile else 1.0
            )
        except (TypeError, ValueError, OverflowError):
            income_multiplier = 1.0
        if not math.isfinite(income_multiplier) or income_multiplier < 0:
            income_multiplier = 1.0

        normalized = []
        for p, member_id, x, y, tile in validated:
            roster = roster_by_id[member_id]
            local_dev_member = set(roster) <= {'id'}
            zone_type = tile.get('type')
            level_value = p.get('level', 1) if local_dev_member else roster.get('level', 1)
            previous = existing_by_member.get(member_id)
            if previous is not None:
                previous_health_value = previous.get('health', 100)
                requested_health_value = p.get('health', previous_health_value)
                roster_health_value = roster.get('health', previous_health_value)
                health_values = (
                    previous_health_value,
                    requested_health_value,
                    roster_health_value,
                )
            elif local_dev_member:
                health_values = (p.get('health', 100),)
            else:
                # A confirmed defender can be removed by an earlier queued
                # replacement and then re-added by a later encounter result.
                # The requested injury may lower roster health but can never
                # heal it, preserving monotonic consequences in either order.
                roster_health_value = roster.get('health', 100)
                health_values = (
                    p.get('health', roster_health_value),
                    roster_health_value,
                )
            facing_value = p.get('facingDeg', 0)
            if (
                isinstance(level_value, bool)
                or isinstance(facing_value, bool)
                or any(isinstance(value, bool) for value in health_values)
            ):
                return jsonify({'error': 'Placement numeric fields are malformed'}), 400
            try:
                exposure_risk = (
                    int(math.floor(float(tile.get('visibility', 1.0)) * 100 + 0.5))
                )
                level = parse_python_integer(level_value)
                # Placement replacement is also the existing persistence seam
                # for encounter injuries. Health may only move downward here;
                # relocating a member can never heal or resurrect them.
                health = min(parse_python_integer(value) for value in health_values)
                facing_deg = parse_finite_decimal(facing_value)
            except (TypeError, ValueError, OverflowError):
                return jsonify({'error': 'Placement numeric fields are malformed'}), 400
            if not 0 <= health <= 100:
                return jsonify({'error': 'health must be between 0 and 100'}), 400
            if not 1 <= level <= 10:
                return jsonify({'error': 'level must be between 1 and 10'}), 400
            if not 0 <= exposure_risk <= 100 or not math.isfinite(facing_deg):
                return jsonify({'error': 'Placement tactical fields are malformed'}), 400
            role = str(p.get('role', 'dealer') if local_dev_member else roster.get('role', 'dealer'))
            income_per_tick = _placement_income(zone_type, role, level, income_multiplier)
            normalized.append({
                'memberId': member_id,
                'memberName': (
                    p.get('memberName') or p.get('member_name') or 'Member'
                    if local_dev_member else roster.get('name') or 'Member'
                ),
                'role': role,
                'anchorId': p.get('anchorId') or p.get('anchor_id') or grid_cell_to_anchor_id(x, y),
                'gridX': x,
                'gridY': y,
                'x': x,
                'y': y,
                'zoneType': zone_type,
                'incomePerTick': income_per_tick,
                'exposureRisk': exposure_risk,
                'level': level,
                'health': health,
                'facingDeg': facing_deg,
                'loadout': {},
            })

        saved = db.save_placements(block_id, normalized)
        block = db.get_block(block_id)
        serialized = _serialize_block(block) if block else {}
        return jsonify({
            'success': True,
            'blockId': block_id,
            'placements': saved,
            'liveRevision': serialized.get('liveRevision', 1),
            'incomePerTick': serialized.get('incomePerTick', 0),
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
