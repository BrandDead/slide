"""
Player economy / state API — Gate 0B authority for cash and heat.
"""

from __future__ import annotations

from flask import Blueprint, jsonify, g
import logging

from middleware.auth import require_auth
from services.db import get_db

logger = logging.getLogger(__name__)

player_bp = Blueprint('player', __name__, url_prefix='/api/player')


@player_bp.route('/state', methods=['GET'])
@require_auth
def get_player_state():
    """Return authoritative cash/heat for the authenticated user."""
    try:
        db = get_db()
        state = db.get_player_state(g.user['id'])
        return jsonify({'player': state})
    except Exception as e:
        logger.error(f"get_player_state failed: {e}")
        return jsonify({'error': 'Failed to load player state'}), 500
