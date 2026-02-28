"""
Combat API Blueprint
Handles SLIDE combat initiation and turn resolution
"""

from flask import Blueprint, request, jsonify, g
import logging
import random
from typing import Optional, Dict, Any
from datetime import datetime

from services.block_state_engine import get_block_state_engine, BlockSnapshot
from middleware.auth import require_auth

logger = logging.getLogger(__name__)

combat_bp = Blueprint('combat', __name__, url_prefix='/api/combat')


# In-memory combat sessions (in production, use database)
combat_sessions = {}


@combat_bp.route('/start', methods=['POST'])
@require_auth
def start_combat():
    """
    Start a new SLIDE combat session
    
    Body:
        attacker_gang_id: UUID
        target_block_id: UUID
        attacker_members: List of member IDs to bring to combat
    
    Returns:
        combat_session with snapshot IDs
    """
    try:
        data = request.json
        attacker_gang_id = data.get('attacker_gang_id')
        target_block_id = data.get('target_block_id')
        attacker_member_ids = data.get('attacker_members', [])
        
        if not target_block_id:
            return jsonify({'error': 'target_block_id required'}), 400
        
        # Get BlockStateEngine
        engine = get_block_state_engine()
        
        # Create immutable snapshot of target block
        target_snapshot_id = engine.create_snapshot(target_block_id)
        if not target_snapshot_id:
            return jsonify({'error': 'Failed to create target snapshot'}), 500
        
        # Get the snapshot
        target_snapshot = engine.get_block_snapshot(target_block_id, target_snapshot_id)
        if not target_snapshot:
            return jsonify({'error': 'Failed to load target snapshot'}), 500
        
        # Create combat session
        session_id = f"combat-{datetime.utcnow().timestamp()}"
        
        combat_sessions[session_id] = {
            'id': session_id,
            'attacker_gang_id': attacker_gang_id,
            'target_block_id': target_block_id,
            'target_snapshot_id': target_snapshot_id,
            'attacker_member_ids': attacker_member_ids,
            'current_turn': 0,
            'max_turns': 20,
            'attacker_hp': {},  # member_id -> hp
            'defender_hp': {},  # member_id -> hp
            'combat_log': [],
            'status': 'active',
            'seed': target_snapshot.seed,
            'created_at': datetime.utcnow().isoformat()
        }
        
        # Initialize HP tracking
        for member_id in attacker_member_ids:
            combat_sessions[session_id]['attacker_hp'][member_id] = 100  # Default HP
        
        for member in target_snapshot.members:
            combat_sessions[session_id]['defender_hp'][member.id] = member.stats.get('health', 100)
        
        # Log session start
        combat_sessions[session_id]['combat_log'].append({
            'turn': 0,
            'action': 'combat_started',
            'message': f"Combat initiated at {target_snapshot.address}"
        })
        
        logger.info(f"Started combat session {session_id} targeting block {target_block_id}")
        
        return jsonify({
            'session_id': session_id,
            'target_snapshot': target_snapshot.to_dict(),
            'status': 'active',
            'current_turn': 0,
            'max_turns': 20
        }), 201
        
    except Exception as e:
        logger.error(f"Failed to start combat: {e}", exc_info=True)
        return jsonify({'error': 'Failed to start combat'}), 500


@combat_bp.route('/turn', methods=['POST'])
@require_auth
def submit_combat_turn():
    """
    Submit a combat turn action
    
    Body:
        session_id: Combat session ID
        action: {
            type: 'attack' | 'move' | 'retreat'
            attacker_id: member ID performing action
            target_x: tile x coordinate
            target_y: tile y coordinate
        }
    
    Returns:
        Turn result with updated combat state
    """
    try:
        data = request.json
        session_id = data.get('session_id')
        action = data.get('action', {})
        
        if session_id not in combat_sessions:
            return jsonify({'error': 'Combat session not found'}), 404
        
        session = combat_sessions[session_id]
        
        if session['status'] != 'active':
            return jsonify({'error': 'Combat session not active'}), 400
        
        # Get target snapshot for combat resolution
        engine = get_block_state_engine()
        target_snapshot = engine.get_block_snapshot(
            session['target_block_id'],
            session['target_snapshot_id']
        )
        
        if not target_snapshot:
            return jsonify({'error': 'Failed to load snapshot'}), 500
        
        # Increment turn
        session['current_turn'] += 1
        current_turn = session['current_turn']
        
        # Initialize deterministic RNG with seed + turn
        rng = random.Random(f"{session['seed']}-turn-{current_turn}")
        
        # Resolve action
        result = _resolve_combat_action(session, target_snapshot, action, rng)
        
        # Add to combat log
        session['combat_log'].append({
            'turn': current_turn,
            'action': action,
            'result': result
        })
        
        # Check win conditions
        attacker_alive = sum(1 for hp in session['attacker_hp'].values() if hp > 0)
        defender_alive = sum(1 for hp in session['defender_hp'].values() if hp > 0)
        
        if defender_alive == 0:
            session['status'] = 'attacker_victory'
            session['winner'] = session['attacker_gang_id']
        elif attacker_alive == 0 or action.get('type') == 'retreat':
            session['status'] = 'defender_victory'
            session['winner'] = 'defender'
        elif current_turn >= session['max_turns']:
            session['status'] = 'draw'
            session['winner'] = None
        
        return jsonify({
            'session_id': session_id,
            'turn': current_turn,
            'result': result,
            'status': session['status'],
            'attacker_hp': session['attacker_hp'],
            'defender_hp': session['defender_hp'],
            'combat_log': session['combat_log'][-5:]  # Last 5 entries
        })
        
    except Exception as e:
        logger.error(f"Failed to process combat turn: {e}", exc_info=True)
        return jsonify({'error': 'Failed to process turn'}), 500


@combat_bp.route('/<session_id>', methods=['GET'])
@require_auth
def get_combat_session(session_id: str):
    """Get combat session state"""
    if session_id not in combat_sessions:
        return jsonify({'error': 'Combat session not found'}), 404
    
    session = combat_sessions[session_id]
    
    return jsonify({
        'session_id': session_id,
        'status': session['status'],
        'current_turn': session['current_turn'],
        'max_turns': session['max_turns'],
        'attacker_hp': session['attacker_hp'],
        'defender_hp': session['defender_hp'],
        'combat_log': session['combat_log']
    })


def _resolve_combat_action(
    session: Dict,
    target_snapshot: BlockSnapshot,
    action: Dict,
    rng: random.Random
) -> Dict[str, Any]:
    """
    Resolve a combat action using deterministic RNG.
    MVP implementation - can be expanded with more complex rules.
    """
    action_type = action.get('type')
    attacker_id = action.get('attacker_id')
    target_x = action.get('target_x', 0)
    target_y = action.get('target_y', 0)
    
    if action_type == 'retreat':
        return {
            'action': 'retreat',
            'success': True,
            'message': 'Attacker retreated from combat'
        }
    
    if action_type == 'attack':
        # Find defender on target tile
        target_tile = None
        if target_x < len(target_snapshot.tiles[0]) and target_y < len(target_snapshot.tiles):
            target_tile = target_snapshot.tiles[target_y][target_x]
        
        if not target_tile or not target_tile.member_id:
            return {
                'action': 'attack',
                'success': False,
                'message': 'No target on that tile'
            }
        
        defender_id = target_tile.member_id
        defender = next((m for m in target_snapshot.members if m.id == defender_id), None)
        
        if not defender:
            return {
                'action': 'attack',
                'success': False,
                'message': 'Target not found'
            }
        
        # Calculate hit chance (base 70% + modifiers)
        hit_chance = 0.70
        
        # Terrain cover reduces hit chance
        cover_bonus = target_tile.terrain_bonus.get('cover', 0.0)
        hit_chance -= cover_bonus * 0.3
        
        # Roll to hit
        hit_roll = rng.random()
        hit = hit_roll < hit_chance
        
        if hit:
            # Calculate damage (10-20 base damage)
            damage = rng.randint(10, 20)
            
            # Apply defender defense
            defense = defender.stats.get('defense', 0)
            damage = max(1, damage - defense)
            
            # Apply damage
            current_hp = session['defender_hp'].get(defender_id, 100)
            new_hp = max(0, current_hp - damage)
            session['defender_hp'][defender_id] = new_hp
            
            # Defender counterattack if still alive
            counter_damage = 0
            if new_hp > 0:
                counter_chance = 0.3  # 30% counter chance
                if rng.random() < counter_chance:
                    counter_damage = rng.randint(5, 15)
                    attacker_hp = session['attacker_hp'].get(attacker_id, 100)
                    session['attacker_hp'][attacker_id] = max(0, attacker_hp - counter_damage)
            
            return {
                'action': 'attack',
                'success': True,
                'hit': True,
                'damage': damage,
                'defender_hp': new_hp,
                'counter_damage': counter_damage,
                'message': f'Hit for {damage} damage! {"Defender countered for " + str(counter_damage) + " damage!" if counter_damage > 0 else ""}'
            }
        else:
            return {
                'action': 'attack',
                'success': True,
                'hit': False,
                'damage': 0,
                'message': 'Attack missed!'
            }
    
    return {
        'action': 'unknown',
        'success': False,
        'message': 'Unknown action type'
    }
