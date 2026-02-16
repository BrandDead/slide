"""
Drip Check API Routes
Handles brand verification, submission, and status tracking
"""

from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
import os
from datetime import datetime
from typing import Optional

from ..services.brand_verification_service import BrandVerificationService
from ..services.ocr_service import OCRService
from ..services.image_recognition_service import ImageRecognitionService
from ..models.user import User
from ..models.brand import Brand
from ..models.drip_submission import DripSubmission
from ..extensions import db
from ..utils.decorators import require_auth
from ..utils.validators import validate_image

bp = Blueprint('drip', __name__, url_prefix='/api/drip')

# Initialize services
brand_verifier = BrandVerificationService()
ocr_service = OCRService()
image_recognition = ImageRecognitionService()

UPLOAD_FOLDER = 'uploads/drip'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'heic'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@bp.route('/brands/search', methods=['GET'])
def search_brands():
    """Search existing brands in catalog"""
    query = request.args.get('q', '').strip()
    
    if len(query) < 2:
        return jsonify({'brands': []})
    
    # Search database for brands
    brands = Brand.query.filter(
        Brand.name.ilike(f'%{query}%')
    ).order_by(
        Brand.verified.desc(),
        Brand.popularity_score.desc()
    ).limit(10).all()
    
    return jsonify({
        'brands': [brand.to_dict() for brand in brands]
    })


@bp.route('/brands/verify', methods=['POST'])
@require_auth
def verify_brand():
    """
    Real-time brand verification
    - Web search to confirm brand exists
    - Check if it's a legitimate fashion/streetwear brand
    - Auto-add to catalog if verified
    """
    data = request.get_json()
    brand_name = data.get('brand_name', '').strip()
    
    if not brand_name:
        return jsonify({'error': 'Brand name required'}), 400
    
    # Check if already in database
    existing = Brand.query.filter_by(name=brand_name).first()
    if existing:
        return jsonify({
            'verified': True,
            'exists': True,
            'brand': existing.to_dict()
        })
    
    # Perform real-time verification
    verification_result = brand_verifier.verify_brand(brand_name)
    
    if verification_result['is_valid_brand']:
        # Auto-add to catalog
        new_brand = Brand(
            name=brand_name,
            slug=brand_name.lower().replace(' ', '-'),
            category=verification_result.get('category', 'unknown'),
            price_range=verification_result.get('price_range', 'unknown'),
            verified=verification_result.get('confidence', 0) > 0.8,
            auto_verified=True,
            verification_source='web_search',
            submitted_by=request.user_id
        )
        
        db.session.add(new_brand)
        db.session.commit()
        
        return jsonify({
            'verified': True,
            'exists': False,
            'brand': new_brand.to_dict(),
            'confidence': verification_result.get('confidence', 0)
        })
    
    else:
        # Brand not verified, but allow submission with manual review
        return jsonify({
            'verified': False,
            'requires_review': True,
            'message': 'Brand will be manually verified during submission review'
        })


@bp.route('/submit', methods=['POST'])
@require_auth
def submit_drip_check():
    """
    Submit new drip check with photos
    - Upload receipt and item photos
    - Run OCR on receipt
    - Run image recognition on item
    - Create submission for review/auto-verification
    """
    user_id = request.user_id
    
    # Validate files
    if 'receipt_image' not in request.files or 'item_image' not in request.files:
        return jsonify({'error': 'Both receipt and item images required'}), 400
    
    receipt_file = request.files['receipt_image']
    item_file = request.files['item_image']
    
    if not allowed_file(receipt_file.filename) or not allowed_file(item_file.filename):
        return jsonify({'error': 'Invalid file format'}), 400
    
    # Get submission data
    brand_name = request.form.get('brand_name', '').strip()
    item_name = request.form.get('item_name', '').strip()
    category = request.form.get('category', '').strip()
    purchase_price = request.form.get('purchase_price', '')
    
    if not brand_name or not item_name or not category:
        return jsonify({'error': 'Missing required fields'}), 400
    
    try:
        purchase_price = float(purchase_price) if purchase_price else None
    except ValueError:
        return jsonify({'error': 'Invalid price format'}), 400
    
    # Save uploaded files
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    receipt_filename = secure_filename(f"{user_id}_{timestamp}_receipt_{receipt_file.filename}")
    item_filename = secure_filename(f"{user_id}_{timestamp}_item_{item_file.filename}")
    
    receipt_path = os.path.join(UPLOAD_FOLDER, receipt_filename)
    item_path = os.path.join(UPLOAD_FOLDER, item_filename)
    
    receipt_file.save(receipt_path)
    item_file.save(item_path)
    
    # Run OCR on receipt
    ocr_result = ocr_service.extract_receipt_data(receipt_path)
    
    # Run image recognition on item
    recognition_result = image_recognition.detect_brand_and_item(item_path, brand_name)
    
    # Determine verification status
    brand_confidence = recognition_result.get('brand_confidence', 0)
    price_match = ocr_result.get('price_match', False)
    
    # Auto-verify if confidence is high and price matches
    if brand_confidence > 0.85 and price_match:
        status = 'verified'
    elif brand_confidence > 0.70:
        status = 'processing'  # Will be auto-verified shortly
    else:
        status = 'needs_review'
    
    # Create submission
    submission = DripSubmission(
        user_id=user_id,
        brand_name=brand_name,
        item_name=item_name,
        category=category,
        purchase_price=purchase_price,
        receipt_image_url=receipt_path,
        item_image_url=item_path,
        ocr_data=ocr_result,
        brand_confidence=brand_confidence,
        detected_brand=recognition_result.get('detected_brand'),
        detected_items=recognition_result.get('detected_items'),
        status=status
    )
    
    db.session.add(submission)
    db.session.commit()
    
    # If auto-verified, grant reward immediately
    if status == 'verified':
        grant_reward(user_id, submission)
    
    return jsonify({
        'submission_id': submission.id,
        'status': submission.status,
        'brand_name': submission.brand_name,
        'item_name': submission.item_name,
        'brand_confidence': brand_confidence,
        'detected_brand': recognition_result.get('detected_brand'),
        'message': get_status_message(status)
    })


@bp.route('/submission/<int:submission_id>', methods=['GET'])
@require_auth
def get_submission_status(submission_id):
    """Get current status of a submission"""
    submission = DripSubmission.query.get_or_404(submission_id)
    
    # Verify user owns this submission
    if submission.user_id != request.user_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    return jsonify(submission.to_dict())


@bp.route('/my-submissions', methods=['GET'])
@require_auth
def get_my_submissions():
    """Get all submissions for current user"""
    user_id = request.user_id
    
    submissions = DripSubmission.query.filter_by(
        user_id=user_id
    ).order_by(
        DripSubmission.created_at.desc()
    ).limit(50).all()
    
    return jsonify({
        'submissions': [sub.to_dict() for sub in submissions]
    })


@bp.route('/admin/pending', methods=['GET'])
@require_auth
def get_pending_submissions():
    """Get submissions needing manual review (admin only)"""
    # TODO: Add admin check
    
    pending = DripSubmission.query.filter(
        DripSubmission.status.in_(['needs_review', 'processing'])
    ).order_by(
        DripSubmission.created_at.asc()
    ).all()
    
    return jsonify({
        'submissions': [sub.to_dict() for sub in pending]
    })


@bp.route('/admin/review/<int:submission_id>', methods=['POST'])
@require_auth
def review_submission(submission_id):
    """Manual review of submission (admin only)"""
    # TODO: Add admin check
    
    data = request.get_json()
    action = data.get('action')  # 'approve' or 'reject'
    reason = data.get('reason', '')
    
    submission = DripSubmission.query.get_or_404(submission_id)
    
    if action == 'approve':
        submission.status = 'verified'
        submission.verified_by = request.user_id
        submission.verified_at = datetime.utcnow()
        grant_reward(submission.user_id, submission)
        
    elif action == 'reject':
        submission.status = 'rejected'
        submission.rejection_reason = reason
        submission.verified_by = request.user_id
        submission.verified_at = datetime.utcnow()
    
    else:
        return jsonify({'error': 'Invalid action'}), 400
    
    db.session.commit()
    
    # TODO: Send notification to user
    
    return jsonify({
        'success': True,
        'submission': submission.to_dict()
    })


def grant_reward(user_id: int, submission: DripSubmission):
    """Grant in-game rewards for verified submission"""
    from ..models.user import User
    from ..models.drip_item import DripItem
    
    user = User.query.get(user_id)
    if not user:
        return
    
    # Check if item already exists in catalog
    item = DripItem.query.filter_by(
        brand_name=submission.brand_name,
        name=submission.item_name
    ).first()
    
    if not item:
        # Create new item in catalog
        item = DripItem(
            brand_name=submission.brand_name,
            name=submission.item_name,
            category=submission.category,
            estimated_price=submission.purchase_price,
            game_stats=calculate_game_stats(submission),
            verified=True
        )
        db.session.add(item)
    
    # Add item to user's inventory
    # TODO: Implement inventory system
    
    # Grant bonus based on price tier
    if submission.purchase_price:
        if submission.purchase_price >= 500:
            bonus_type = 'luxury'
            user.style_points += 10
            user.respect += 5
        elif submission.purchase_price >= 200:
            bonus_type = 'premium'
            user.style_points += 5
            user.respect += 3
        else:
            bonus_type = 'standard'
            user.style_points += 2
            user.respect += 1
    
    submission.reward_granted = True
    submission.reward_type = bonus_type if submission.purchase_price else 'standard'
    
    db.session.commit()


def calculate_game_stats(submission: DripSubmission) -> dict:
    """Calculate in-game stat bonuses based on item"""
    stats = {
        'style': 0,
        'respect': 0,
        'heat_reduction': 0
    }
    
    # Base stats by category
    category_bonuses = {
        'jeans': {'style': 3, 'respect': 1},
        'jacket': {'style': 4, 'respect': 2},
        'shoes': {'style': 5, 'respect': 2},
        'shirt': {'style': 2, 'respect': 1},
        'accessories': {'style': 3, 'respect': 3}
    }
    
    base_stats = category_bonuses.get(submission.category, {'style': 2, 'respect': 1})
    stats.update(base_stats)
    
    # Price multiplier
    if submission.purchase_price:
        if submission.purchase_price >= 1000:
            multiplier = 2.0
        elif submission.purchase_price >= 500:
            multiplier = 1.5
        elif submission.purchase_price >= 200:
            multiplier = 1.2
        else:
            multiplier = 1.0
        
        stats['style'] = int(stats['style'] * multiplier)
        stats['respect'] = int(stats['respect'] * multiplier)
    
    return stats


def get_status_message(status: str) -> str:
    """Get user-friendly status message"""
    messages = {
        'verified': 'Your drip has been verified! Reward unlocked.',
        'processing': 'Verification in progress. This usually takes 30-60 seconds.',
        'needs_review': 'Manual review required. Our team will verify within 24-48 hours.',
        'rejected': 'Could not verify item authenticity.'
    }
    return messages.get(status, 'Status unknown')
