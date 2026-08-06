"""
DEALT/SLIDE - JWT Authentication Middleware
Validates Supabase JWT tokens and extracts user identity.
Falls back to dev mode when SUPABASE_URL is not configured.
"""

from __future__ import annotations

import os
import logging
from functools import wraps
from typing import Optional
from flask import request, jsonify, g, current_app

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# DEV MODE: When Supabase is not configured, use a mock user
# ─────────────────────────────────────────────────────────────────────────────

DEV_USER = {
    'id': 'dev-user-001',
    'email': 'dev@dealt-slide.local',
    'username': 'DevPlayer',
    'role': 'authenticated',
}


def _is_dev_mode() -> bool:
    """Check if running without Supabase (local dev mode)."""
    return not current_app.config.get('SUPABASE_URL')


def _get_supabase_client():
    """Lazy-init Supabase client."""
    if not hasattr(g, '_supabase'):
        try:
            from supabase import create_client
            url = current_app.config['SUPABASE_URL']
            key = current_app.config['SUPABASE_SERVICE_ROLE_KEY']
            g._supabase = create_client(url, key)
        except Exception as e:
            logger.error(f"Failed to create Supabase client: {e}")
            g._supabase = None
    return g._supabase


def _verify_token(token: str) -> Optional[dict]:
    """Verify a JWT token against Supabase and return user data."""
    try:
        sb = _get_supabase_client()
        if not sb:
            return None

        # Use Supabase's auth.get_user to validate the token
        user_response = sb.auth.get_user(token)
        if user_response and user_response.user:
            user = user_response.user
            return {
                'id': user.id,
                'email': user.email or '',
                'username': user.user_metadata.get('username', user.email or 'Unknown'),
                'role': user.role or 'authenticated',
            }
    except Exception as e:
        logger.warning(f"Token verification failed: {e}")
    return None


# ─────────────────────────────────────────────────────────────────────────────
# AUTH DECORATORS
# ─────────────────────────────────────────────────────────────────────────────

def require_auth(f):
    """
    Decorator that requires a valid JWT token in the Authorization header.
    Sets g.user with the authenticated user's data.
    In dev mode (no Supabase), uses a mock user.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        # Dev mode bypass
        if _is_dev_mode():
            g.user = DEV_USER.copy()
            return f(*args, **kwargs)

        # Extract token from Authorization header
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({
                'error': 'Missing or invalid Authorization header',
                'hint': 'Include header: Authorization: Bearer <token>',
            }), 401

        token = auth_header[7:]  # Strip "Bearer "

        # Verify token
        user = _verify_token(token)
        if not user:
            return jsonify({
                'error': 'Invalid or expired token',
                'hint': 'Re-authenticate at POST /api/auth/login',
            }), 401

        g.user = user
        return f(*args, **kwargs)

    return decorated


def optional_auth(f):
    """
    Decorator that optionally extracts user from JWT token.
    Sets g.user if token is valid, otherwise sets g.user = None.
    Never returns 401.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        if _is_dev_mode():
            g.user = DEV_USER.copy()
            return f(*args, **kwargs)

        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]
            g.user = _verify_token(token)
        else:
            g.user = None

        return f(*args, **kwargs)

    return decorated


# ─────────────────────────────────────────────────────────────────────────────
# AUTH BLUEPRINT (login, register, refresh, logout, me)
# ─────────────────────────────────────────────────────────────────────────────

from flask import Blueprint

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


@auth_bp.route('/register', methods=['POST'])
def register():
    """Register a new user via Supabase Auth."""
    data = request.get_json() or {}
    email = data.get('email', '').strip()
    password = data.get('password', '')
    username = data.get('username', '').strip()

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    if _is_dev_mode():
        # Dev mode: return mock tokens
        return jsonify({
            'user': {**DEV_USER, 'email': email, 'username': username or 'DevPlayer'},
            'access_token': 'dev-access-token',
            'refresh_token': 'dev-refresh-token',
        })

    try:
        sb = _get_supabase_client()
        if not sb:
            return jsonify({'error': 'Auth service unavailable'}), 503

        result = sb.auth.sign_up({
            'email': email,
            'password': password,
            'options': {'data': {'username': username}},
        })

        if result.user:
            return jsonify({
                'user': {
                    'id': result.user.id,
                    'email': result.user.email,
                    'username': username,
                },
                'access_token': result.session.access_token if result.session else '',
                'refresh_token': result.session.refresh_token if result.session else '',
            })
        else:
            return jsonify({'error': 'Registration failed'}), 400

    except Exception as e:
        logger.error(f"Registration error: {e}")
        return jsonify({'error': str(e)}), 400


@auth_bp.route('/login', methods=['POST'])
def login():
    """Authenticate user and return JWT tokens."""
    data = request.get_json() or {}
    email = data.get('email', '').strip()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    if _is_dev_mode():
        return jsonify({
            'user': {**DEV_USER, 'email': email},
            'access_token': 'dev-access-token',
            'refresh_token': 'dev-refresh-token',
        })

    try:
        sb = _get_supabase_client()
        if not sb:
            return jsonify({'error': 'Auth service unavailable'}), 503

        result = sb.auth.sign_in_with_password({
            'email': email,
            'password': password,
        })

        if result.user and result.session:
            return jsonify({
                'user': {
                    'id': result.user.id,
                    'email': result.user.email,
                    'username': result.user.user_metadata.get('username', email),
                },
                'access_token': result.session.access_token,
                'refresh_token': result.session.refresh_token,
            })
        else:
            return jsonify({'error': 'Invalid credentials'}), 401

    except Exception as e:
        logger.error(f"Login error: {e}")
        return jsonify({'error': 'Invalid credentials'}), 401


@auth_bp.route('/refresh', methods=['POST'])
def refresh():
    """Refresh an expired access token."""
    data = request.get_json() or {}
    refresh_token = data.get('refresh_token', '')

    if _is_dev_mode():
        return jsonify({'access_token': 'dev-access-token'})

    if not refresh_token:
        return jsonify({'error': 'refresh_token is required'}), 400

    try:
        sb = _get_supabase_client()
        if not sb:
            return jsonify({'error': 'Auth service unavailable'}), 503

        result = sb.auth.refresh_session(refresh_token)
        if result.session:
            return jsonify({
                'access_token': result.session.access_token,
            })
        else:
            return jsonify({'error': 'Refresh failed'}), 401

    except Exception as e:
        logger.error(f"Refresh error: {e}")
        return jsonify({'error': 'Refresh failed'}), 401


@auth_bp.route('/logout', methods=['POST'])
@require_auth
def logout():
    """Invalidate the current session."""
    if _is_dev_mode():
        return jsonify({'success': True})

    try:
        sb = _get_supabase_client()
        if sb:
            sb.auth.sign_out()
    except Exception as e:
        logger.warning(f"Logout error (non-critical): {e}")

    return jsonify({'success': True})


@auth_bp.route('/me', methods=['GET'])
@require_auth
def get_me():
    """Return the currently authenticated user."""
    return jsonify({'user': g.user})
