"""
DEALT/SLIDE - Block Model
SQLAlchemy model for territory blocks with PostGIS support
"""

import math
from datetime import datetime
from typing import Optional, Dict, Any, List
from uuid import uuid4
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, JSON, ForeignKey, Index, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

# Note: In production, import from your extensions.py
# from extensions import db
# For now, using flask_sqlalchemy
from flask_sqlalchemy import SQLAlchemy
db = SQLAlchemy()


# Supported cities enumeration
SUPPORTED_CITIES = ['nyc', 'la', 'miami', 'chicago', 'detroit', 'nola']


class Block(db.Model):
    """
    Represents a claimable city block territory.
    Uses PostGIS for geospatial queries.
    """
    
    __tablename__ = 'blocks'
    
    # Primary Key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    
    # Location Data
    address = Column(String(500), nullable=False)
    formatted_address = Column(String(500), nullable=False)
    city = Column(String(20), nullable=False, index=True)
    neighborhood = Column(String(100), nullable=True)
    
    # Coordinates
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    
    # Bounds (stored as JSON for simplicity, PostGIS in production)
    bounds_north = Column(Float, nullable=True)
    bounds_south = Column(Float, nullable=True)
    bounds_east = Column(Float, nullable=True)
    bounds_west = Column(Float, nullable=True)
    
    # Generated Assets
    satellite_image_url = Column(String(1000), nullable=True)
    stylized_image_url = Column(String(1000), nullable=True)
    grid_data = Column(JSONB, nullable=True)  # Stores full grid structure
    
    # Gameplay Data
    traffic_score = Column(Integer, default=50)  # 1-100
    danger_score = Column(Integer, default=30)   # 1-100
    cover_density = Column(Float, default=0.3)   # Average cover across tiles
    income_per_hour = Column(Integer, default=100)  # Base income
    
    # Ownership
    owner_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=True, index=True)
    owner_gang_name = Column(String(100), nullable=True)
    claimed_at = Column(DateTime, nullable=True)
    
    # Status
    heat = Column(Integer, default=0)  # 0-100
    last_raid_at = Column(DateTime, nullable=True)
    is_contested = Column(Boolean, default=False)
    
    # Stats (lifetime)
    total_earnings = Column(Integer, default=0)
    times_defended = Column(Integer, default=0)
    times_lost = Column(Integer, default=0)
    
    # Metadata
    block_hash = Column(String(100), unique=True, nullable=False, index=True)
    generation_version = Column(String(20), default='1.0.0')
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships (uncomment when models exist)
    # owner = relationship('User', back_populates='blocks')
    # deployed_units = relationship('BlockUnit', back_populates='block', cascade='all, delete-orphan')
    # combat_logs = relationship('CombatLog', back_populates='block')
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_blocks_city_traffic', 'city', 'traffic_score'),
        Index('idx_blocks_owner_heat', 'owner_id', 'heat'),
        Index('idx_blocks_coords', 'lat', 'lng'),
    )
    
    def __init__(
        self,
        address: str,
        formatted_address: str,
        city: str,
        lat: float,
        lng: float,
        block_hash: str,
        **kwargs
    ):
        if city not in SUPPORTED_CITIES:
            raise ValueError(f"City must be one of: {SUPPORTED_CITIES}")
        
        super().__init__(
            address=address,
            formatted_address=formatted_address,
            city=city,
            lat=lat,
            lng=lng,
            block_hash=block_hash,
            **kwargs
        )
    
    @property
    def coordinates(self) -> Dict[str, float]:
        """Return coordinates as dict"""
        return {'lat': self.lat, 'lng': self.lng}
    
    @property
    def bounds(self) -> Optional[Dict[str, float]]:
        """Return bounds as dict"""
        if self.bounds_north is None:
            return None
        return {
            'north': self.bounds_north,
            'south': self.bounds_south,
            'east': self.bounds_east,
            'west': self.bounds_west,
        }
    
    @property
    def is_claimed(self) -> bool:
        """Check if block has an owner"""
        return self.owner_id is not None
    
    @property
    def is_hot(self) -> bool:
        """Check if block has high heat (police attention)"""
        return self.heat >= 70
    
    def calculate_income(self, dealer_count: int = 0, modifiers: Dict[str, float] = None) -> int:
        """
        Calculate hourly income for this block.
        
        Base formula:
        income = base_income * traffic_modifier * dealer_bonus * heat_penalty
        """
        modifiers = modifiers or {}
        
        # Base income from traffic
        base = self.income_per_hour
        
        # Traffic modifier (normalized)
        traffic_mod = self.traffic_score / 50.0  # 50 = baseline
        
        # Dealer bonus (diminishing returns)
        dealer_mod = 1.0 + (dealer_count * 0.15)  # 15% per dealer
        if dealer_count > 5:
            dealer_mod = 1.75 + ((dealer_count - 5) * 0.05)  # Reduced bonus after 5
        
        # Heat penalty (police attention reduces business)
        heat_penalty = 1.0 - (self.heat / 200.0)  # Max 50% reduction at 100 heat
        
        # Apply any additional modifiers
        extra_mod = 1.0
        for mod_name, mod_value in modifiers.items():
            extra_mod *= mod_value
        
        return int(base * traffic_mod * dealer_mod * heat_penalty * extra_mod)
    
    def apply_heat(self, amount: int, source: str = 'unknown') -> int:
        """
        Add heat to the block.
        Returns the new heat level.
        """
        old_heat = self.heat
        self.heat = min(100, max(0, self.heat + amount))
        return self.heat
    
    def decay_heat(self, hours_passed: float = 1.0) -> int:
        """
        Reduce heat over time.
        Heat decays at ~5 points per hour, faster at night.
        """
        decay_rate = 5.0 * hours_passed
        self.heat = max(0, int(self.heat - decay_rate))
        return self.heat
    
    def claim(self, user_id: str, gang_name: str) -> bool:
        """
        Claim this block for a user.
        Returns True if successful.
        """
        if self.is_claimed:
            return False
        
        self.owner_id = user_id
        self.owner_gang_name = gang_name
        self.claimed_at = datetime.utcnow()
        return True
    
    def transfer(self, new_owner_id: str, new_gang_name: str) -> None:
        """Transfer ownership after combat loss"""
        self.owner_id = new_owner_id
        self.owner_gang_name = new_gang_name
        self.claimed_at = datetime.utcnow()
        self.times_lost += 1
    
    def to_dict(self, include_grid: bool = False) -> Dict[str, Any]:
        """Serialize block to dictionary"""
        data = {
            'id': str(self.id),
            'address': self.address,
            'formattedAddress': self.formatted_address,
            'city': self.city,
            'neighborhood': self.neighborhood,
            'coordinates': self.coordinates,
            'bounds': self.bounds,
            'satelliteImageUrl': self.satellite_image_url,
            'stylizedImageUrl': self.stylized_image_url,
            'trafficScore': self.traffic_score,
            'dangerScore': self.danger_score,
            'coverDensity': self.cover_density,
            'incomePerHour': self.income_per_hour,
            'ownerId': str(self.owner_id) if self.owner_id else None,
            'ownerGangName': self.owner_gang_name,
            'claimedAt': self.claimed_at.isoformat() if self.claimed_at else None,
            'heat': self.heat,
            'lastRaidAt': self.last_raid_at.isoformat() if self.last_raid_at else None,
            'isContested': self.is_contested,
            'totalEarnings': self.total_earnings,
            'timesDefended': self.times_defended,
            'timesLost': self.times_lost,
            'createdAt': self.created_at.isoformat(),
            'updatedAt': self.updated_at.isoformat(),
            'generationVersion': self.generation_version,
        }
        
        if include_grid and self.grid_data:
            data['gridData'] = self.grid_data
        
        return data
    
    @classmethod
    def find_by_hash(cls, block_hash: str) -> Optional['Block']:
        """Find block by its location hash"""
        return cls.query.filter_by(block_hash=block_hash).first()
    
    @classmethod
    def find_nearby(cls, lat: float, lng: float, radius_km: float = 1.0) -> List['Block']:
        """
        Find blocks within radius of coordinates.
        Simple box query - use PostGIS ST_DWithin for production.
        """
        # Approximate degree offset for km. Longitude degrees shrink with latitude.
        # Use cos(latitude), not abs(latitude), for the east-west offset.
        lat_offset = radius_km / 111.0
        # cos(latitude), not abs(latitude) — see geocoding_service.
        lng_offset = radius_km / (111.0 * math.cos(math.radians(lat)))
        
        return cls.query.filter(
            cls.lat.between(lat - lat_offset, lat + lat_offset),
            cls.lng.between(lng - lng_offset, lng + lng_offset)
        ).all()
    
    @classmethod
    def find_by_city(cls, city: str, limit: int = 100) -> List['Block']:
        """Find all blocks in a city"""
        return cls.query.filter_by(city=city).limit(limit).all()
    
    @classmethod
    def find_unclaimed(cls, city: str = None, limit: int = 50) -> List['Block']:
        """Find unclaimed blocks, optionally filtered by city"""
        query = cls.query.filter(cls.owner_id.is_(None))
        if city:
            query = query.filter_by(city=city)
        return query.order_by(cls.traffic_score.desc()).limit(limit).all()
    
    def __repr__(self):
        return f'<Block {self.address} ({self.city})>'


class BlockUnit(db.Model):
    """
    Represents a gang member deployed to a block.
    Junction table between Block and GangMember.
    """
    
    __tablename__ = 'block_units'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    block_id = Column(UUID(as_uuid=True), ForeignKey('blocks.id'), nullable=False)
    member_id = Column(UUID(as_uuid=True), ForeignKey('gang_members.id'), nullable=False)
    
    # Position on grid
    tile_x = Column(Integer, nullable=False)
    tile_y = Column(Integer, nullable=False)
    
    # Assignment
    role = Column(String(20), nullable=False)  # 'guard', 'dealer', 'patrol'
    assigned_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships (uncomment when models exist)
    # block = relationship('Block', back_populates='deployed_units')
    # member = relationship('GangMember', back_populates='deployment')
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': str(self.id),
            'blockId': str(self.block_id),
            'memberId': str(self.member_id),
            'position': {'x': self.tile_x, 'y': self.tile_y},
            'role': self.role,
            'assignedAt': self.assigned_at.isoformat(),
        }
