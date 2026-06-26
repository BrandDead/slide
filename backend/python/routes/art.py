"""
Art Generation API Routes
Proxies requests to AI image generation services (OpenAI DALL-E, Banana Nano, etc.)
Handles caching, rate limiting, and asset storage.
"""

from flask import Blueprint, request, jsonify
import os
import hashlib
import json
import time
from datetime import datetime

art_bp = Blueprint('art', __name__, url_prefix='/api/art')

# In-memory cache for generated assets (in production, use Redis/S3)
_art_cache: dict = {}
_rate_limits: dict = {}

# Rate limit: max 10 requests per minute per session
RATE_LIMIT_WINDOW = 60
RATE_LIMIT_MAX = 10


def _check_rate_limit(session_id: str) -> bool:
    """Check if the session has exceeded rate limits."""
    now = time.time()
    if session_id not in _rate_limits:
        _rate_limits[session_id] = []
    
    # Clean old entries
    _rate_limits[session_id] = [t for t in _rate_limits[session_id] if now - t < RATE_LIMIT_WINDOW]
    
    if len(_rate_limits[session_id]) >= RATE_LIMIT_MAX:
        return False
    
    _rate_limits[session_id].append(now)
    return True


def _hash_prompt(prompt: str, style: str, width: int, height: int) -> str:
    """Generate a cache key from prompt parameters."""
    key = f"{prompt}:{style}:{width}:{height}"
    return hashlib.md5(key.encode()).hexdigest()


@art_bp.route('/generate', methods=['POST'])
def generate_art():
    """
    Generate AI art from a prompt.
    
    Body:
        prompt (str): The image generation prompt
        negative_prompt (str, optional): What to avoid
        width (int): Image width (default 512)
        height (int): Image height (default 512)
        style (str): Art style key
        type (str): Asset type (headshot, fullbody, topdown_sprite, etc.)
        reference_image (str, optional): URL of reference image
    
    Returns:
        image_url (str): URL of generated image
        thumbnail_url (str): URL of thumbnail
        cached (bool): Whether result was from cache
    """
    data = request.get_json()
    if not data or 'prompt' not in data:
        return jsonify({'error': 'prompt is required'}), 400
    
    prompt = data['prompt']
    style = data.get('style', 'gta_realistic')
    width = data.get('width', 512)
    height = data.get('height', 512)
    asset_type = data.get('type', 'headshot')
    negative_prompt = data.get('negative_prompt', '')
    
    # Check cache
    cache_key = _hash_prompt(prompt, style, width, height)
    if cache_key in _art_cache:
        cached = _art_cache[cache_key]
        return jsonify({
            'image_url': cached['image_url'],
            'thumbnail_url': cached.get('thumbnail_url', cached['image_url']),
            'cached': True,
            'asset_id': cached['asset_id'],
        })
    
    # Rate limit check
    session_id = request.headers.get('X-Session-Id', 'anonymous')
    if not _check_rate_limit(session_id):
        return jsonify({'error': 'Rate limit exceeded. Try again in a minute.'}), 429
    
    # Try to generate with available providers
    image_url = None
    provider_used = None
    
    # Provider 1: OpenAI DALL-E (for icons only per user preference)
    openai_key = os.environ.get('OPENAI_API_KEY')
    if openai_key and asset_type in ('weapon_icon', 'drug_icon', 'icon'):
        try:
            from openai import OpenAI
            client = OpenAI()
            response = client.images.generate(
                model="dall-e-3",
                prompt=prompt,
                n=1,
                size=f"{min(width, 1024)}x{min(height, 1024)}",
                quality="standard",
            )
            image_url = response.data[0].url
            provider_used = 'dalle'
        except Exception as e:
            print(f"DALL-E generation failed: {e}")
    
    # Provider 2: Banana Nano / Other model (for characters, scenes)
    banana_key = os.environ.get('BANANA_API_KEY')
    if not image_url and banana_key:
        try:
            import requests as req
            resp = req.post(
                'https://api.banana.dev/v1/generate',
                json={
                    'apiKey': banana_key,
                    'prompt': prompt,
                    'negative_prompt': negative_prompt,
                    'width': width,
                    'height': height,
                },
                timeout=60,
            )
            if resp.ok:
                result = resp.json()
                image_url = result.get('image_url')
                provider_used = 'banana'
        except Exception as e:
            print(f"Banana generation failed: {e}")
    
    # Fallback: Return a placeholder indicator
    if not image_url:
        # Generate a placeholder SVG data URL
        import base64
        color_hash = hash(prompt) % 360
        svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}">
            <rect width="{width}" height="{height}" fill="hsl({color_hash}, 50%, 30%)"/>
            <text x="50%" y="45%" dominant-baseline="central" text-anchor="middle" 
                  fill="white" font-size="14" font-family="monospace">AI Art</text>
            <text x="50%" y="55%" dominant-baseline="central" text-anchor="middle" 
                  fill="rgba(255,255,255,0.5)" font-size="10" font-family="monospace">{asset_type}</text>
        </svg>'''
        image_url = f"data:image/svg+xml;base64,{base64.b64encode(svg.encode()).decode()}"
        provider_used = 'placeholder'
    
    # Cache the result
    asset_id = f"art-{cache_key[:8]}-{int(time.time())}"
    _art_cache[cache_key] = {
        'image_url': image_url,
        'thumbnail_url': image_url,
        'asset_id': asset_id,
        'provider': provider_used,
        'created_at': datetime.utcnow().isoformat(),
    }
    
    return jsonify({
        'image_url': image_url,
        'thumbnail_url': image_url,
        'cached': False,
        'asset_id': asset_id,
        'provider': provider_used,
    })


@art_bp.route('/cache', methods=['GET'])
def list_cached():
    """List all cached art assets."""
    assets = []
    for key, val in _art_cache.items():
        assets.append({
            'cache_key': key,
            'asset_id': val['asset_id'],
            'provider': val.get('provider', 'unknown'),
            'created_at': val.get('created_at', ''),
        })
    return jsonify({'assets': assets, 'count': len(assets)})


@art_bp.route('/cache/<cache_key>', methods=['DELETE'])
def delete_cached(cache_key: str):
    """Delete a cached art asset."""
    if cache_key in _art_cache:
        del _art_cache[cache_key]
        return jsonify({'deleted': True})
    return jsonify({'error': 'Not found'}), 404
