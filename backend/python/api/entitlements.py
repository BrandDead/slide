"""Read-only paid-access status for the authenticated SLIDE player.

Entitlements are granted or revoked only by trusted payment webhooks and
administrative tooling. This blueprint intentionally exposes no client write path.
"""

import logging

from flask import Blueprint, g, jsonify

from middleware.auth import require_auth
from services.db import get_db

logger = logging.getLogger(__name__)

entitlements_bp = Blueprint(
    'entitlements',
    __name__,
    url_prefix='/api/entitlements',
)


@entitlements_bp.route('/me', methods=['GET'])
@require_auth
def get_my_entitlements():
    """Return effective entitlements for the verified session owner."""
    user_id = g.user['id']

    try:
        entitlements = get_db().get_active_entitlements(user_id)
    except Exception:
        logger.exception('Unable to read entitlements for user %s', user_id)
        return jsonify({
            'error': 'Paid access status is temporarily unavailable',
            'retryable': True,
        }), 503

    entitlement_keys = sorted({
        entitlement['entitlement_key']
        for entitlement in entitlements
        if entitlement.get('entitlement_key')
    })

    return jsonify({
        'user_id': user_id,
        'entitlements': entitlements,
        'access': {
            'paid_beta': 'paid_beta' in entitlement_keys,
        },
    })
