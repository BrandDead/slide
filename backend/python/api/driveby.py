"""
Drive-By API Blueprint
Handles drive-by shooting mechanics
"""

from flask import Blueprint, request, jsonify
from functools import wraps
import logging
import random
from datetime import datetime
from typing import Dict, Any, List

from services.block_state_engine import get_block_state_engine

logger = logging.getLogger(__name__)

driveby_bp = Blueprint('driveby', __name__, url_prefix='/api/driveby')


def require_auth(f):
    """Require authentication for route"""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Authentication required'}), 401
        
        token = auth_header.replace('Bearer ', '')
        request.user_id = token
        
        return f(*args, **kwargs)
    return decorated


# Active drive-by sessions
driveby_sessions = {}


@driveby_bp.route('/start', methods=['POST'])
@require_auth
def start_driveby():
    """
    Start a drive-by shooting
    
    Body:
        target_block_id: Block to target
        vehicle: Vehicle stats (speed, armor, shooters)
        shooters: List of member IDs in the car
    
    Returns:
        Drive-by session with initial state
    """
    try:
        data = request.json
        target_block_id = data.get('target_block_id')
        vehicle = data.get('vehicle', {})
        shooter_ids = data.get('shooters', [])
        
        if not target_block_id:
            return jsonify({'error': 'target_block_id required'}), 400
        
        # Get block snapshot
        engine = get_block_state_engine()
        target_snapshot = engine.get_block_snapshot(target_block_id)
        
        if not target_snapshot:
            return jsonify({'error': 'Block not found'}), 404
        
        # Identify street edge tiles
        street_tiles = _identify_street_tiles(target_snapshot)
        
        # Calculate member proximity to streets
        member_exposure = _calculate_member_exposure(target_snapshot, street_tiles)
        
        # Create session
        session_id = f"driveby-{datetime.utcnow().timestamp()}"
        
        driveby_sessions[session_id] = {
            'id': session_id,
            'target_block_id': target_block_id,
            'target_snapshot_id': target_snapshot.snapshot_id,
            'vehicle': vehicle,
            'shooter_ids': shooter_ids,
            'street_tiles': street_tiles,
            'member_exposure': member_exposure,
            'current_phase': 'approach',
            'shots_fired': 0,
            'max_shots': len(shooter_ids) * 3,  # 3 shots per shooter
            'hits': [],
            'casualties': [],
            'heat_gained': 0,
            'seed': target_snapshot.seed,
            'created_at': datetime.utcnow().isoformat()
        }
        
        logger.info(f"Started drive-by {session_id} on block {target_block_id}")
        
        return jsonify({
            'session_id': session_id,
            'target': {
                'block_id': target_block_id,
                'address': target_snapshot.address,
                'defenders': len(target_snapshot.members)
            },
            'street_tiles': len(street_tiles),
            'max_shots': driveby_sessions[session_id]['max_shots'],
            'phase': 'approach'
        }), 201
        
    except Exception as e:
        logger.error(f"Failed to start drive-by: {e}", exc_info=True)
        return jsonify({'error': 'Failed to start drive-by'}), 500


@driveby_bp.route('/shoot', methods=['POST'])
@require_auth
def execute_driveby():
    """
    Execute drive-by shots
    
    Body:
        session_id: Drive-by session ID
        target_tile: {x, y} coordinates to shoot at
    
    Returns:
        Shot results
    """
    try:
        data = request.json
        session_id = data.get('session_id')
        target_tile = data.get('target_tile', {})
        
        if session_id not in driveby_sessions:
            return jsonify({'error': 'Session not found'}), 404
        
        session = driveby_sessions[session_id]
        
        if session['shots_fired'] >= session['max_shots']:
            return jsonify({'error': 'No shots remaining'}), 400
        
        # Get target snapshot
        engine = get_block_state_engine()
        target_snapshot = engine.get_block_snapshot(
            session['target_block_id'],
            session['target_snapshot_id']
        )
        
        # Initialize RNG with seed
        rng = random.Random(f"{session['seed']}-shot-{session['shots_fired']}")
        
        # Resolve shot
        result = _resolve_driveby_shot(session, target_snapshot, target_tile, rng)
        
        session['shots_fired'] += 1
        session['hits'].append(result)
        
        if result.get('hit'):
            session['casualties'].append(result['target_id'])
        
        # Counterfire chance (defenders near street shoot back)
        counterfire = _resolve_counterfire(session, target_snapshot, rng)
        
        # Update phase
        if session['shots_fired'] >= session['max_shots']:
            session['current_phase'] = 'escape'
        
        # Calculate heat gain
        session['heat_gained'] = min(100, session['shots_fired'] * 2 + len(session['casualties']) * 5)
        
        return jsonify({
            'session_id': session_id,
            'shot_result': result,
            'counterfire': counterfire,
            'shots_remaining': session['max_shots'] - session['shots_fired'],
            'total_hits': len([h for h in session['hits'] if h.get('hit')]),
            'total_casualties': len(session['casualties']),
            'phase': session['current_phase'],
            'heat_gained': session['heat_gained']
        })
        
    except Exception as e:
        logger.error(f"Drive-by shot failed: {e}", exc_info=True)
        return jsonify({'error': 'Shot failed'}), 500


@driveby_bp.route('/<session_id>/complete', methods=['POST'])
@require_auth
def complete_driveby(session_id: str):
    """
    Complete drive-by and get final results
    
    Returns:
        Final stats and rewards
    """
    try:
        if session_id not in driveby_sessions:
            return jsonify({'error': 'Session not found'}), 404
        
        session = driveby_sessions[session_id]
        
        # Calculate escape success (based on vehicle speed and heat)
        escape_chance = 0.7 + (session['vehicle'].get('speed', 50) / 200.0)
        rng = random.Random(f"{session['seed']}-escape")
        escaped = rng.random() < escape_chance
        
        # Calculate rewards/penalties
        hits = len([h for h in session['hits'] if h.get('hit')])
        casualties = len(session['casualties'])
        
        # Base reward for successful hits
        money_gained = hits * 50 + casualties * 100
        
        # Penalty if caught
        if not escaped:
            money_gained = max(0, money_gained - 500)
        
        results = {
            'session_id': session_id,
            'completed': True,
            'shots_fired': session['shots_fired'],
            'hits': hits,
            'casualties': casualties,
            'escaped': escaped,
            'heat_gained': session['heat_gained'],
            'money_gained': money_gained,
            'message': 'Clean escape!' if escaped else 'Got spotted! Lost some cash.'
        }
        
        # Clean up session
        del driveby_sessions[session_id]
        
        logger.info(f"Drive-by {session_id} completed: {hits} hits, {casualties} casualties")
        
        return jsonify(results)
        
    except Exception as e:
        logger.error(f"Failed to complete drive-by: {e}", exc_info=True)
        return jsonify({'error': 'Failed to complete drive-by'}), 500


def _identify_street_tiles(snapshot) -> List[Dict[str, int]]:
    """Identify tiles that are on the street edge"""
    street_tiles = []
    
    for y, row in enumerate(snapshot.tiles):
        for x, tile in enumerate(row):
            # Street tiles are typically on edges or marked as 'street' type
            if tile.tile_type == 'street':
                street_tiles.append({'x': x, 'y': y})
            elif x == 0 or x == len(row) - 1 or y == 0 or y == len(snapshot.tiles) - 1:
                street_tiles.append({'x': x, 'y': y})
    
    return street_tiles


def _calculate_member_exposure(snapshot, street_tiles: List[Dict[str, int]]) -> Dict[str, float]:
    """Calculate how exposed each member is to drive-by"""
    exposure = {}
    
    for member in snapshot.members:
        pos = member.position
        min_distance = float('inf')
        
        # Find distance to nearest street tile
        for street in street_tiles:
            dist = abs(pos['x'] - street['x']) + abs(pos['y'] - street['y'])
            min_distance = min(min_distance, dist)
        
        # Closer to street = higher exposure (0.0 = on street, 1.0 = far away)
        exposure[member.id] = max(0.0, 1.0 - (min_distance / 10.0))
    
    return exposure


def _resolve_driveby_shot(
    session: Dict,
    snapshot,
    target_tile: Dict[str, int],
    rng: random.Random
) -> Dict[str, Any]:
    """Resolve a single drive-by shot"""
    tx = target_tile.get('x', 0)
    ty = target_tile.get('y', 0)
    
    # Check bounds first
    if ty < 0 or ty >= len(snapshot.tiles) or tx < 0 or (ty < len(snapshot.tiles) and tx >= len(snapshot.tiles[ty])):
        return {
            'hit': False,
            'reason': 'Invalid tile',
            'damage': 0
        }
    
    tile = snapshot.tiles[ty][tx]
    
    if not tile.member_id:
        return {
            'hit': False,
            'reason': 'No target on tile',
            'damage': 0
        }
    
    target_id = tile.member_id
    target = next((m for m in snapshot.members if m.id == target_id), None)
    
    if not target:
        return {
            'hit': False,
            'reason': 'Target not found',
            'damage': 0
        }
    
    # Calculate hit chance based on exposure
    exposure = session['member_exposure'].get(target_id, 0.5)
    base_hit_chance = 0.6
    
    # Higher exposure = easier to hit
    hit_chance = base_hit_chance * (0.5 + exposure)
    
    # Vehicle speed affects accuracy
    vehicle_speed = session['vehicle'].get('speed', 50)
    speed_penalty = (vehicle_speed - 30) / 200.0  # Fast = harder to aim
    hit_chance = max(0.1, hit_chance - speed_penalty)
    
    # Roll to hit
    hit = rng.random() < hit_chance
    
    if hit:
        damage = rng.randint(20, 40)
        
        return {
            'hit': True,
            'target_id': target_id,
            'target_role': target.role,
            'damage': damage,
            'exposure': exposure,
            'message': f'Hit {target.role} for {damage} damage!'
        }
    else:
        return {
            'hit': False,
            'reason': 'Missed',
            'damage': 0
        }


def _resolve_counterfire(session: Dict, snapshot, rng: random.Random) -> Dict[str, Any]:
    """Resolve defender counterfire"""
    # Find shooters/enforcers near street
    defenders_near_street = []
    
    for member in snapshot.members:
        if member.role in ['shooter', 'enforcer']:
            exposure = session['member_exposure'].get(member.id, 0.0)
            if exposure > 0.3:  # Close to street
                defenders_near_street.append(member)
    
    if not defenders_near_street:
        return {
            'counterfire': False,
            'damage': 0
        }
    
    # Chance of counterfire (30% per defender)
    for defender in defenders_near_street:
        if rng.random() < 0.3:
            damage = rng.randint(10, 25)
            return {
                'counterfire': True,
                'defender_id': defender.id,
                'damage': damage,
                'message': f'{defender.role.title()} returned fire! {damage} damage to vehicle.'
            }
    
    return {
        'counterfire': False,
        'damage': 0
    }
