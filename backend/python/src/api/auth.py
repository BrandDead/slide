"""
DEALT/SLIDE - Authentication API Routes
Handles user registration, login, and JWT token management
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
    get_jwt
)
from functools import wraps
import logging

logger = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__)


# ============================================================================
# ROUTES
# ============================================================================

@auth_bp.route('/register', methods=['POST'])
def register():
    """
    Register a new user
    
    Body:
        username: Username (required)
        email: Email address (required)
        password: Password (required)
        gangName: Gang name (optional)
    
    Returns:
        User data and access token
    """
    data = request.get_json()
    
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    gang_name = data.get('gangName', 'Lone Wolf')
    
    if not username or not email or not password:
        return jsonify({'error': 'Username, email, and password required'}), 400
    
    try:
        # TODO: Implement actual user creation with database
        # For now, create placeholder user
        user_id = 'user_' + username
        
        # Create tokens
        access_token = create_access_token(identity=user_id)
        refresh_token = create_refresh_token(identity=user_id)
        
        return jsonify({
            'user': {
                'id': user_id,
                'username': username,
                'email': email,
                'gangName': gang_name,
            },
            'accessToken': access_token,
            'refreshToken': refresh_token,
        }), 201
    
    except Exception as e:
        logger.error(f"Registration failed: {e}")
        return jsonify({'error': 'Registration failed'}), 500


@auth_bp.route('/login', methods=['POST'])
def login():
    """
    Login user
    
    Body:
        email: Email or username (required)
        password: Password (required)
    
    Returns:
        User data and access token
    """
    data = request.get_json()
    
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({'error': 'Email and password required'}), 400
    
    try:
        # TODO: Implement actual authentication
        # For now, accept any login
        user_id = 'user_' + email
        
        # Create tokens
        access_token = create_access_token(identity=user_id)
        refresh_token = create_refresh_token(identity=user_id)
        
        return jsonify({
            'user': {
                'id': user_id,
                'email': email,
                'gangName': 'Test Gang',
            },
            'accessToken': access_token,
            'refreshToken': refresh_token,
        })
    
    except Exception as e:
        logger.error(f"Login failed: {e}")
        return jsonify({'error': 'Login failed'}), 500


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """
    Refresh access token
    
    Returns:
        New access token
    """
    try:
        user_id = get_jwt_identity()
        access_token = create_access_token(identity=user_id)
        
        return jsonify({
            'accessToken': access_token,
        })
    
    except Exception as e:
        logger.error(f"Token refresh failed: {e}")
        return jsonify({'error': 'Refresh failed'}), 500


@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """
    Logout user (invalidate token)
    
    Returns:
        Success message
    """
    try:
        # TODO: Implement token blacklisting
        jti = get_jwt()['jti']
        
        return jsonify({
            'message': 'Successfully logged out',
        })
    
    except Exception as e:
        logger.error(f"Logout failed: {e}")
        return jsonify({'error': 'Logout failed'}), 500


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """
    Get current user profile
    
    Returns:
        User data
    """
    try:
        user_id = get_jwt_identity()
        
        # TODO: Fetch actual user from database
        return jsonify({
            'user': {
                'id': user_id,
                'username': user_id.replace('user_', ''),
                'gangName': 'Test Gang',
                'level': 1,
                'experience': 0,
            }
        })
    
    except Exception as e:
        logger.error(f"User fetch failed: {e}")
        return jsonify({'error': 'Fetch failed'}), 500


@auth_bp.route('/verify', methods=['POST'])
def verify_token():
    """
    Verify a JWT token
    
    Body:
        token: JWT token to verify
    
    Returns:
        Verification status
    """
    data = request.get_json()
    token = data.get('token')
    
    if not token:
        return jsonify({'error': 'Token required'}), 400
    
    try:
        # TODO: Implement token verification
        return jsonify({
            'valid': True,
            'message': 'Token is valid',
        })
    
    except Exception as e:
        logger.error(f"Token verification failed: {e}")
        return jsonify({'error': 'Verification failed', 'valid': False}), 401
