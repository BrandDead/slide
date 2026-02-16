"""
Database Models for Drip Check System
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from ..extensions import db


class Brand(db.Model):
    """Brands catalog (dynamically expanded)"""
    __tablename__ = 'brands'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(255), unique=True, nullable=False, index=True)
    slug = Column(String(255), unique=True, nullable=False)
    logo_url = Column(Text)
    
    verified = Column(Boolean, default=False)  # Manually verified
    category = Column(String(100))  # streetwear, luxury, sports, etc.
    price_range = Column(String(50))  # budget, mid, premium, luxury
    
    # Auto-verification tracking
    auto_verified = Column(Boolean, default=False)
    verification_source = Column(String(100))  # web_search, user_submit, manual
    submitted_by = Column(Integer, ForeignKey('users.id'))
    
    # Popularity tracking
    popularity_score = Column(Integer, default=0)  # Incremented with each submission
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    items = relationship('DripItem', back_populates='brand', lazy='dynamic')
    submissions = relationship('DripSubmission', back_populates='brand_obj', lazy='dynamic')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'slug': self.slug,
            'logo_url': self.logo_url,
            'verified': self.verified,
            'category': self.category,
            'price_range': self.price_range,
            'popularity_score': self.popularity_score
        }
    
    def __repr__(self):
        return f'<Brand {self.name}>'


class DripItem(db.Model):
    """Specific products/items"""
    __tablename__ = 'drip_items'
    
    id = Column(Integer, primary_key=True)
    brand_id = Column(Integer, ForeignKey('brands.id'))
    
    name = Column(String(255), nullable=False)
    category = Column(String(100))  # jeans, jacket, shoes, accessories
    estimated_price = Column(Float)
    
    # In-game stats
    game_stats = Column(JSON)  # {style: 5, respect: 3, heat_reduction: 1}
    
    image_url = Column(Text)
    affiliate_link = Column(Text)
    
    verified = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    brand = relationship('Brand', back_populates='items')
    
    def to_dict(self):
        return {
            'id': self.id,
            'brand_id': self.brand_id,
            'brand_name': self.brand.name if self.brand else None,
            'name': self.name,
            'category': self.category,
            'estimated_price': self.estimated_price,
            'game_stats': self.game_stats,
            'image_url': self.image_url,
            'verified': self.verified
        }
    
    def __repr__(self):
        return f'<DripItem {self.name}>'


class DripSubmission(db.Model):
    """User submissions for verification"""
    __tablename__ = 'drip_submissions'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    
    # Submitted info
    brand_name = Column(String(255), nullable=False)
    item_name = Column(String(255))
    category = Column(String(100))
    purchase_price = Column(Float)
    
    # Proof uploads
    receipt_image_url = Column(Text)
    item_image_url = Column(Text)
    additional_images = Column(JSON)  # array of URLs
    
    # AI Analysis results
    ocr_data = Column(JSON)  # extracted text from receipt
    brand_confidence = Column(Float)  # 0.00 to 1.00
    detected_brand = Column(String(255))
    detected_items = Column(JSON)
    
    # Verification
    status = Column(String(50), default='pending', index=True)
    # Status options: pending, processing, verified, rejected, needs_review
    
    verified_by = Column(Integer, ForeignKey('users.id'))  # admin who verified
    rejection_reason = Column(Text)
    
    # Rewards
    reward_granted = Column(Boolean, default=False)
    reward_type = Column(String(100))
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    verified_at = Column(DateTime)
    
    # Relationships
    user = relationship('User', foreign_keys=[user_id], backref='drip_submissions')
    verifier = relationship('User', foreign_keys=[verified_by])
    brand_obj = relationship('Brand', back_populates='submissions', 
                            primaryjoin='DripSubmission.brand_name == Brand.name',
                            foreign_keys='DripSubmission.brand_name',
                            uselist=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'brand_name': self.brand_name,
            'item_name': self.item_name,
            'category': self.category,
            'purchase_price': self.purchase_price,
            'receipt_image_url': self.receipt_image_url,
            'item_image_url': self.item_image_url,
            'brand_confidence': self.brand_confidence,
            'detected_brand': self.detected_brand,
            'status': self.status,
            'rejection_reason': self.rejection_reason,
            'reward_granted': self.reward_granted,
            'reward_type': self.reward_type,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'verified_at': self.verified_at.isoformat() if self.verified_at else None
        }
    
    def __repr__(self):
        return f'<DripSubmission {self.id}: {self.brand_name} - {self.status}>'


class UserInventory(db.Model):
    """User's unlocked drip items"""
    __tablename__ = 'user_inventory'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey('drip_items.id'), nullable=False)
    
    # How they acquired it
    source = Column(String(50))  # drip_check, purchase, reward
    submission_id = Column(Integer, ForeignKey('drip_submissions.id'))
    
    equipped = Column(Boolean, default=False)  # Currently wearing
    
    unlocked_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship('User', backref='inventory')
    item = relationship('DripItem')
    submission = relationship('DripSubmission')
    
    def to_dict(self):
        return {
            'id': self.id,
            'item': self.item.to_dict() if self.item else None,
            'source': self.source,
            'equipped': self.equipped,
            'unlocked_at': self.unlocked_at.isoformat()
        }
    
    def __repr__(self):
        return f'<UserInventory {self.user_id}: {self.item_id}>'


# Migration script to create tables
def create_drip_check_tables():
    """
    Create all drip check related tables
    Run this as part of your database migration
    """
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    
    # Assuming you have a DATABASE_URL
    engine = create_engine('postgresql://user:pass@localhost/dbname')
    
    # Create tables
    Brand.__table__.create(engine, checkfirst=True)
    DripItem.__table__.create(engine, checkfirst=True)
    DripSubmission.__table__.create(engine, checkfirst=True)
    UserInventory.__table__.create(engine, checkfirst=True)
    
    print("Drip check tables created successfully!")


# Alembic migration version
"""
To create this migration:

```bash
alembic revision -m "Add drip check system"
```

Then add to the upgrade() function:

```python
def upgrade():
    op.create_table(
        'brands',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('slug', sa.String(255), nullable=False),
        # ... rest of columns
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
        sa.UniqueConstraint('slug')
    )
    
    op.create_table(
        'drip_items',
        # ... columns
    )
    
    op.create_table(
        'drip_submissions',
        # ... columns
    )
    
    op.create_table(
        'user_inventory',
        # ... columns
    )
    
    # Create indexes
    op.create_index('idx_brands_name', 'brands', ['name'])
    op.create_index('idx_submissions_user', 'drip_submissions', ['user_id'])
    op.create_index('idx_submissions_status', 'drip_submissions', ['status'])
```
"""
