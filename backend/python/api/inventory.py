"""
Inventory API Blueprint
Handles underground market, equipment, and transactions
"""

from flask import Blueprint, request, jsonify
from functools import wraps
import logging
from datetime import datetime
from typing import Dict, List, Any
import uuid

logger = logging.getLogger(__name__)

inventory_bp = Blueprint('inventory', __name__, url_prefix='/api/inventory')


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


# Mock inventory data (in production: database)
# Item catalog
MARKET_ITEMS = {
    'pistol-9mm': {
        'id': 'pistol-9mm',
        'name': '9mm Pistol',
        'category': 'weapon',
        'damage': 15,
        'price': 500,
        'description': 'Basic handgun'
    },
    'ak47': {
        'id': 'ak47',
        'name': 'AK-47',
        'category': 'weapon',
        'damage': 35,
        'price': 2500,
        'description': 'Assault rifle'
    },
    'bulletproof-vest': {
        'id': 'bulletproof-vest',
        'name': 'Bulletproof Vest',
        'category': 'armor',
        'defense': 10,
        'price': 800,
        'description': 'Basic body armor'
    },
    'medkit': {
        'id': 'medkit',
        'name': 'Medical Kit',
        'category': 'consumable',
        'healing': 50,
        'price': 200,
        'description': 'Restores 50 HP'
    },
    'lockpick': {
        'id': 'lockpick',
        'name': 'Lockpick Set',
        'category': 'tool',
        'price': 150,
        'description': 'Bypass security'
    }
}

# User inventories (mock)
user_inventories = {}

# User cash (mock - shoebox ledger)
user_cash = {}

# Transaction history
transactions = {}


@inventory_bp.route('/', methods=['GET'])
@require_auth
def get_inventory():
    """
    Get user's current inventory
    
    Returns:
        List of owned items with quantities
    """
    try:
        user_id = request.user_id
        
        # Get user inventory
        inventory = user_inventories.get(user_id, {})
        cash = user_cash.get(user_id, 10000)  # Starting cash
        
        # Format inventory with item details
        items = []
        for item_id, quantity in inventory.items():
            if item_id in MARKET_ITEMS:
                item_data = MARKET_ITEMS[item_id].copy()
                item_data['quantity'] = quantity
                items.append(item_data)
        
        return jsonify({
            'user_id': user_id,
            'cash': cash,
            'items': items,
            'total_items': len(items)
        })
        
    except Exception as e:
        logger.error(f"Failed to get inventory: {e}", exc_info=True)
        return jsonify({'error': 'Failed to get inventory'}), 500


@inventory_bp.route('/market', methods=['GET'])
@require_auth
def get_market():
    """
    Get available items in underground market
    
    Query params:
        category: Filter by category (weapon, armor, consumable, tool)
    
    Returns:
        List of items available for purchase
    """
    try:
        category = request.args.get('category')
        
        items = []
        for item_id, item_data in MARKET_ITEMS.items():
            if category and item_data['category'] != category:
                continue
            items.append(item_data)
        
        return jsonify({
            'items': items,
            'total': len(items)
        })
        
    except Exception as e:
        logger.error(f"Failed to get market: {e}", exc_info=True)
        return jsonify({'error': 'Failed to get market'}), 500


@inventory_bp.route('/buy', methods=['POST'])
@require_auth
def buy_item():
    """
    Purchase an item from the underground market
    
    Body:
        item_id: Item to purchase
        quantity: Number to buy (default 1)
    
    Returns:
        Updated inventory and cash
    """
    try:
        user_id = request.user_id
        data = request.json
        
        item_id = data.get('item_id')
        quantity = int(data.get('quantity', 1))
        
        if not item_id or item_id not in MARKET_ITEMS:
            return jsonify({'error': 'Invalid item'}), 400
        
        if quantity < 1:
            return jsonify({'error': 'Invalid quantity'}), 400
        
        item = MARKET_ITEMS[item_id]
        total_cost = item['price'] * quantity
        
        # Check if user has enough cash
        current_cash = user_cash.get(user_id, 10000)
        if current_cash < total_cost:
            return jsonify({'error': 'Insufficient funds'}), 400
        
        # Deduct cash
        user_cash[user_id] = current_cash - total_cost
        
        # Add to inventory
        if user_id not in user_inventories:
            user_inventories[user_id] = {}
        
        current_quantity = user_inventories[user_id].get(item_id, 0)
        user_inventories[user_id][item_id] = current_quantity + quantity
        
        # Record transaction
        transaction_id = str(uuid.uuid4())
        if user_id not in transactions:
            transactions[user_id] = []
        
        transactions[user_id].append({
            'id': transaction_id,
            'type': 'purchase',
            'item_id': item_id,
            'item_name': item['name'],
            'quantity': quantity,
            'amount': -total_cost,
            'balance': user_cash[user_id],
            'timestamp': datetime.utcnow().isoformat()
        })
        
        logger.info(f"User {user_id} purchased {quantity}x {item['name']} for ${total_cost}")
        
        return jsonify({
            'success': True,
            'item': item,
            'quantity': quantity,
            'cost': total_cost,
            'new_balance': user_cash[user_id],
            'transaction_id': transaction_id
        })
        
    except Exception as e:
        logger.error(f"Failed to buy item: {e}", exc_info=True)
        return jsonify({'error': 'Failed to buy item'}), 500


@inventory_bp.route('/equip', methods=['POST'])
@require_auth
def equip_item():
    """
    Equip an item on a gang member
    
    Body:
        member_id: Gang member UUID
        item_id: Item to equip
        slot: Equipment slot (weapon, armor, item1, item2, etc.)
    
    Returns:
        Updated member loadout
    """
    try:
        user_id = request.user_id
        data = request.json
        
        member_id = data.get('member_id')
        item_id = data.get('item_id')
        slot = data.get('slot', 'weapon')
        
        if not member_id or not item_id:
            return jsonify({'error': 'member_id and item_id required'}), 400
        
        # Check if user owns the item
        inventory = user_inventories.get(user_id, {})
        if item_id not in inventory or inventory[item_id] < 1:
            return jsonify({'error': 'Item not in inventory'}), 400
        
        # In production: verify member belongs to user
        # In production: update member_loadouts table
        
        logger.info(f"User {user_id} equipped {item_id} on member {member_id} in slot {slot}")
        
        return jsonify({
            'success': True,
            'member_id': member_id,
            'item_id': item_id,
            'slot': slot,
            'message': f'Equipped {MARKET_ITEMS.get(item_id, {}).get("name", item_id)}'
        })
        
    except Exception as e:
        logger.error(f"Failed to equip item: {e}", exc_info=True)
        return jsonify({'error': 'Failed to equip item'}), 500


@inventory_bp.route('/transactions', methods=['GET'])
@require_auth
def get_transactions():
    """
    Get transaction history (shoebox ledger)
    
    Query params:
        limit: Max transactions to return (default 50)
    
    Returns:
        List of transactions
    """
    try:
        user_id = request.user_id
        limit = min(int(request.args.get('limit', 50)), 100)
        
        user_transactions = transactions.get(user_id, [])
        
        # Return most recent first
        recent = user_transactions[-limit:]
        recent.reverse()
        
        return jsonify({
            'transactions': recent,
            'total': len(user_transactions),
            'current_balance': user_cash.get(user_id, 10000)
        })
        
    except Exception as e:
        logger.error(f"Failed to get transactions: {e}", exc_info=True)
        return jsonify({'error': 'Failed to get transactions'}), 500


@inventory_bp.route('/cash', methods=['GET'])
@require_auth
def get_cash_balance():
    """Get current cash balance"""
    try:
        user_id = request.user_id
        balance = user_cash.get(user_id, 10000)
        
        return jsonify({
            'user_id': user_id,
            'balance': balance
        })
        
    except Exception as e:
        logger.error(f"Failed to get cash balance: {e}", exc_info=True)
        return jsonify({'error': 'Failed to get cash balance'}), 500
