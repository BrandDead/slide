"""
DEALT/SLIDE — NPC API Routes
Exposes the NPC AI system to the frontend.

Endpoints:
  GET  /api/npc/gangs          — list all active NPC gangs
  GET  /api/npc/gangs/<id>     — get a single gang with full member list
  POST /api/npc/tick           — advance the NPC AI by one tick
  POST /api/npc/damage         — apply player-inflicted damage to a gang
"""
import logging
import random
import time
from flask import Blueprint, request, jsonify
from middleware.auth import require_auth
from services.npc_ai import NPCBehaviorEngine, NPCSpawner, NPCGang

logger = logging.getLogger(__name__)
npc_bp = Blueprint('npc', __name__, url_prefix='/api/npc')

# ─── In-memory gang registry (dev mode) ──────────────────────
# In production this would be backed by Supabase.
_GANG_REGISTRY: dict[str, NPCGang] = {}
_engine = NPCBehaviorEngine()
_spawner = NPCSpawner()


def _ensure_default_gangs() -> None:
    """Seed the registry with default gangs if empty."""
    if _GANG_REGISTRY:
        return
    for _ in range(5):
        gang = _spawner.spawn_gang(difficulty=random.randint(1, 5))
        _GANG_REGISTRY[gang.id] = gang


# ─── Routes ──────────────────────────────────────────────────

@npc_bp.route('/gangs', methods=['GET'])
def list_gangs():
    """
    GET /api/npc/gangs
    Returns all active NPC gangs.
    """
    _ensure_default_gangs()
    gangs = [g.to_dict() for g in _GANG_REGISTRY.values() if g.active]
    return jsonify({'gangs': gangs, 'count': len(gangs)})


@npc_bp.route('/gangs/<gang_id>', methods=['GET'])
def get_gang(gang_id: str):
    """
    GET /api/npc/gangs/<gang_id>
    Returns a single NPC gang with full member list.
    """
    _ensure_default_gangs()
    gang = _GANG_REGISTRY.get(gang_id)
    if not gang:
        return jsonify({'error': 'Gang not found'}), 404
    return jsonify({'gang': gang.to_dict()})


@npc_bp.route('/tick', methods=['POST'])
def tick_npc():
    """
    POST /api/npc/tick
    Advance the NPC AI by one tick.

    Body (JSON):
        player_block_ids: list[str]   — blocks the player currently controls
        player_heat: int              — current player heat level (0-100)
        unclaimed_blocks: list[str]   — block IDs not owned by anyone

    Returns:
        results: list of { gang_id, action, description, target_block_id, threatening }
    """
    _ensure_default_gangs()
    body = request.get_json(silent=True) or {}
    player_block_ids: list[str] = body.get('player_block_ids', [])
    player_heat: int = int(body.get('player_heat', 0))
    unclaimed_blocks: list[str] = body.get('unclaimed_blocks', [])

    game_state = {
        'player_blocks': player_block_ids,
        'player_heat': player_heat,
        'unclaimed_blocks': unclaimed_blocks,
    }

    results = []
    for gang in list(_GANG_REGISTRY.values()):
        if not gang.active:
            continue
        try:
            action = _engine.decide_action(gang, game_state)
            threatening = action.action_type in ('retaliate', 'raid')
            results.append({
                'gang_id': gang.id,
                'gang_name': gang.name,
                'action': action.action_type,
                'description': action.description,
                'target_block_id': action.target_block_id,
                'threatening': threatening,
                'events': action.events,
            })
            # Persist last action to registry
            gang.last_attacked_by = (
                player_block_ids[0] if threatening and player_block_ids else None
            )
        except Exception as exc:
            logger.error('NPC tick error for gang %s: %s', gang.id, exc)

    return jsonify({
        'results': results,
        'tick_at': int(time.time()),
        'gang_count': len(results),
    })


@npc_bp.route('/damage', methods=['POST'])
def apply_damage():
    """
    POST /api/npc/damage
    Apply player-inflicted damage to an NPC gang after a successful defence.

    Body (JSON):
        gang_id: str
        members_killed: int
        wealth_lost: int
    """
    _ensure_default_gangs()
    body = request.get_json(silent=True) or {}
    gang_id: str = body.get('gang_id', '')
    members_killed: int = int(body.get('members_killed', 0))
    wealth_lost: int = int(body.get('wealth_lost', 0))

    gang = _GANG_REGISTRY.get(gang_id)
    if not gang:
        return jsonify({'error': 'Gang not found'}), 404

    killed_names = []
    killed = members_killed
    for member in gang.members:
        if killed <= 0:
            break
        if member.alive:
            member.alive = False
            member.health = 0
            killed_names.append(member.name)
            killed -= 1

    gang.wealth = max(0, gang.wealth - wealth_lost)

    alive_count = sum(1 for m in gang.members if m.alive)
    if alive_count == 0:
        gang.active = False

    return jsonify({
        'gang_id': gang_id,
        'members_killed': len(killed_names),
        'killed_names': killed_names,
        'wealth_remaining': gang.wealth,
        'gang_active': gang.active,
    })
