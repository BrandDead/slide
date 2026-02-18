"""
World Tick API Blueprint
Handles passive income, heat decay, and world simulation
"""

from flask import Blueprint, request, jsonify
from functools import wraps
import logging
from datetime import datetime, timedelta
from typing import Dict, Any

from services.block_state_engine import get_block_state_engine

logger = logging.getLogger(__name__)

world_bp = Blueprint('world', __name__, url_prefix='/api/world')


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


@world_bp.route('/tick', methods=['POST'])
@require_auth
def advance_world():
    """
    Advance world simulation by specified minutes.
    Processes:
    - Passive income from dealers
    - Heat decay
    - Loyalty decay if unpaid
    - NPC event chances (raids, etc.)
    
    Body:
        minutes: Number of minutes to advance (default 10)
        user_id: User to process (optional, processes all if admin)
    
    Returns:
        Events that occurred during tick
    """
    try:
        data = request.json or {}
        minutes = min(int(data.get('minutes', 10)), 60)  # Max 1 hour per tick
        target_user_id = data.get('user_id', request.user_id)
        
        logger.info(f"Processing world tick: {minutes} minutes for user {target_user_id}")
        
        events = []
        
        # Get user's blocks (mock for now)
        # In production: query blocks owned by user
        user_blocks = _get_user_blocks(target_user_id)
        
        engine = get_block_state_engine()
        
        for block_id in user_blocks:
            # Get current block state
            snapshot = engine.get_block_snapshot(block_id)
            if not snapshot:
                continue
            
            # Process passive income
            income_events = _process_passive_income(snapshot, minutes)
            events.extend(income_events)
            
            # Process heat decay
            heat_events = _process_heat_decay(snapshot, minutes)
            events.extend(heat_events)
            
            # Process loyalty
            loyalty_events = _process_loyalty(snapshot, minutes)
            events.extend(loyalty_events)
            
            # Random NPC events (low chance)
            npc_events = _process_npc_events(snapshot, minutes)
            events.extend(npc_events)
        
        return jsonify({
            'success': True,
            'minutes_advanced': minutes,
            'events': events,
            'timestamp': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        logger.error(f"World tick failed: {e}", exc_info=True)
        return jsonify({'error': 'World tick failed'}), 500


def _get_user_blocks(user_id: str) -> list:
    """Get blocks owned by user (mock)"""
    # In production: query database
    # For now, return mock block IDs
    return ['mock-block-1']


def _process_passive_income(snapshot, minutes: int) -> list:
    """
    Calculate and award passive income from dealers.
    Income rate is per hour, so scale by minutes.
    """
    events = []
    
    hourly_rate = snapshot.income_rate
    income = (hourly_rate / 60.0) * minutes
    
    if income > 0:
        # Count dealers
        dealer_count = sum(1 for m in snapshot.members if m.role == 'dealer')
        
        events.append({
            'type': 'passive_income',
            'block_id': snapshot.block_id,
            'address': snapshot.address,
            'amount': round(income, 2),
            'dealer_count': dealer_count,
            'message': f'Earned ${income:.2f} from {dealer_count} dealers at {snapshot.address}'
        })
        
        # In production: update user's cash in database
        logger.info(f"Block {snapshot.block_id} earned ${income:.2f}")
    
    return events


def _process_heat_decay(snapshot, minutes: int) -> list:
    """
    Reduce heat level over time.
    Heat decays at ~5 points per hour when inactive.
    """
    events = []
    
    if snapshot.heat_level > 0:
        decay_rate = 5.0 / 60.0  # 5 per hour
        decay = decay_rate * minutes
        new_heat = max(0, snapshot.heat_level - decay)
        
        if new_heat != snapshot.heat_level:
            events.append({
                'type': 'heat_decay',
                'block_id': snapshot.block_id,
                'address': snapshot.address,
                'old_heat': snapshot.heat_level,
                'new_heat': new_heat,
                'decay': decay,
                'message': f'Heat cooled by {decay:.1f} at {snapshot.address}'
            })
            
            # In production: update block heat in database
            logger.info(f"Block {snapshot.block_id} heat decayed: {snapshot.heat_level:.1f} -> {new_heat:.1f}")
    
    return events


def _process_loyalty(snapshot, minutes: int) -> list:
    """
    Process loyalty decay if members aren't paid.
    MVP: Simple check - if no income, loyalty drops.
    """
    events = []
    
    # In full version: check if payroll was paid
    # For MVP: just track that loyalty needs management
    if len(snapshot.members) > 0:
        # Simplified: loyalty drops 1 point per hour unpaid
        # This is a placeholder - needs proper payroll system
        pass
    
    return events


def _process_npc_events(snapshot, minutes: int) -> list:
    """
    Random NPC events like raids, deals, etc.
    Very low chance per tick.
    """
    events = []
    
    import random
    
    # 1% chance per 10 minutes of an NPC event
    event_chance = (minutes / 10.0) * 0.01
    
    if random.random() < event_chance:
        event_types = ['npc_raid_attempt', 'suspicious_activity', 'police_patrol']
        event_type = random.choice(event_types)
        
        events.append({
            'type': event_type,
            'block_id': snapshot.block_id,
            'address': snapshot.address,
            'message': f'NPC event at {snapshot.address}: {event_type.replace("_", " ").title()}'
        })
        
        logger.info(f"NPC event on block {snapshot.block_id}: {event_type}")
    
    return events


@world_bp.route('/status', methods=['GET'])
@require_auth
def get_world_status():
    """Get current world status for user"""
    try:
        user_id = request.user_id
        
        # Get user's blocks
        user_blocks = _get_user_blocks(user_id)
        
        engine = get_block_state_engine()
        
        blocks_status = []
        for block_id in user_blocks:
            snapshot = engine.get_block_snapshot(block_id)
            if snapshot:
                blocks_status.append({
                    'block_id': block_id,
                    'address': snapshot.address,
                    'heat_level': snapshot.heat_level,
                    'income_rate': snapshot.income_rate,
                    'defense_rating': snapshot.defense_rating,
                    'member_count': len(snapshot.members)
                })
        
        return jsonify({
            'user_id': user_id,
            'blocks': blocks_status,
            'timestamp': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Failed to get world status: {e}", exc_info=True)
        return jsonify({'error': 'Failed to get world status'}), 500
