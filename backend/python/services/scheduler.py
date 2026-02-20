"""
DEALT/SLIDE - World Tick Scheduler
Background worker that drives passive simulation: income, heat decay,
loyalty checks, NPC actions, and random events.
Uses APScheduler for recurring jobs.
"""

import os
import logging
import random
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# EVENT TYPES
# ─────────────────────────────────────────────────────────────────────────────

class WorldEvent:
    """Represents an event generated during a world tick."""

    def __init__(
        self,
        event_type: str,
        description: str,
        effects: Optional[Dict[str, Any]] = None,
        target_user_id: Optional[str] = None,
        target_block_id: Optional[str] = None,
        target_member_id: Optional[str] = None,
    ):
        self.id = str(uuid.uuid4())
        self.event_type = event_type
        self.description = description
        self.effects = effects or {}
        self.target_user_id = target_user_id
        self.target_block_id = target_block_id
        self.target_member_id = target_member_id
        self.timestamp = datetime.utcnow().isoformat()

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'type': self.event_type,
            'description': self.description,
            'effects': self.effects,
            'target_user_id': self.target_user_id,
            'target_block_id': self.target_block_id,
            'target_member_id': self.target_member_id,
            'timestamp': self.timestamp,
        }


# ─────────────────────────────────────────────────────────────────────────────
# EVENT GENERATOR
# ─────────────────────────────────────────────────────────────────────────────

class EventGenerator:
    """Generates random world events based on game state."""

    RANDOM_EVENTS = [
        {
            'type': 'informant',
            'description': 'A snitch tipped off the police about activity on {block}.',
            'effects': {'heat': 15},
            'weight': 0.15,
        },
        {
            'type': 'deal_opportunity',
            'description': 'A big buyer showed up on {block}. Extra income this tick.',
            'effects': {'money_multiplier': 2.0},
            'weight': 0.20,
        },
        {
            'type': 'turf_war_rumor',
            'description': 'Word on the street: rivals are eyeing {block}.',
            'effects': {'heat': 5, 'morale': -5},
            'weight': 0.15,
        },
        {
            'type': 'community_support',
            'description': 'The neighborhood on {block} appreciates the protection.',
            'effects': {'morale': 10, 'heat': -5},
            'weight': 0.10,
        },
        {
            'type': 'supply_shortage',
            'description': 'Supply chain disrupted. Dealers on {block} have less product.',
            'effects': {'money_multiplier': 0.5},
            'weight': 0.10,
        },
        {
            'type': 'police_patrol',
            'description': 'Increased police patrols near {block}. Laying low.',
            'effects': {'heat': 10, 'money_multiplier': 0.7},
            'weight': 0.15,
        },
        {
            'type': 'recruit_opportunity',
            'description': 'A skilled youngster on {block} wants to join up.',
            'effects': {'recruit_available': True},
            'weight': 0.10,
        },
        {
            'type': 'nothing',
            'description': 'Quiet day on {block}. Business as usual.',
            'effects': {},
            'weight': 0.05,
        },
    ]

    @classmethod
    def generate_raid_event(cls, block_address: str, heat_level: int) -> Optional[WorldEvent]:
        """
        Generate a police raid event based on heat level.
        Probability: heat_level / 100 (capped at 0.85).
        """
        raid_chance = min(heat_level / 100.0, 0.85)
        if random.random() < raid_chance:
            severity = 'major' if heat_level > 75 else 'minor'
            if severity == 'major':
                return WorldEvent(
                    event_type='raid_major',
                    description=f'SWAT raid on {block_address}! All product seized, members arrested.',
                    effects={
                        'product_seized': True,
                        'members_arrested': random.randint(1, 3),
                        'money_lost': random.randint(5000, 20000),
                        'heat': -30,  # Heat drops after raid
                    },
                )
            else:
                return WorldEvent(
                    event_type='raid_minor',
                    description=f'Police sweep on {block_address}. Some product confiscated.',
                    effects={
                        'product_seized': True,
                        'members_arrested': random.randint(0, 1),
                        'money_lost': random.randint(1000, 5000),
                        'heat': -15,
                    },
                )
        return None

    @classmethod
    def generate_npc_attack(cls, block_address: str, npc_gang_name: str) -> WorldEvent:
        """Generate an NPC gang attack event."""
        attack_type = random.choice(['driveby', 'slide', 'robbery'])
        descriptions = {
            'driveby': f'{npc_gang_name} did a drive-by on {block_address}!',
            'slide': f'{npc_gang_name} is sliding on {block_address}!',
            'robbery': f'{npc_gang_name} robbed a dealer on {block_address}!',
        }
        effects = {
            'driveby': {'member_damage': random.randint(10, 40), 'heat': 20},
            'slide': {'member_damage': random.randint(20, 60), 'heat': 25, 'territory_threat': True},
            'robbery': {'money_lost': random.randint(500, 3000), 'heat': 10},
        }
        return WorldEvent(
            event_type=f'npc_{attack_type}',
            description=descriptions[attack_type],
            effects=effects[attack_type],
        )

    @classmethod
    def generate_random_event(cls, block_address: str) -> WorldEvent:
        """Generate a weighted random event for a block."""
        weights = [e['weight'] for e in cls.RANDOM_EVENTS]
        event_template = random.choices(cls.RANDOM_EVENTS, weights=weights, k=1)[0]
        return WorldEvent(
            event_type=event_template['type'],
            description=event_template['description'].format(block=block_address),
            effects=dict(event_template['effects']),
        )


# ─────────────────────────────────────────────────────────────────────────────
# WORLD TICK PROCESSOR
# ─────────────────────────────────────────────────────────────────────────────

class WorldTickProcessor:
    """
    Processes a single world tick for a user.
    Can be called by the scheduler or manually via API.
    """

    # Base income per dealer per tick (10 minutes)
    BASE_DEALER_INCOME = 50
    # Heat decay per tick
    HEAT_DECAY_RATE = 2
    # Loyalty decay per tick if salary not paid (24h threshold)
    LOYALTY_DECAY_RATE = 3
    # Morale decay per tick if members are jailed/wounded
    MORALE_DECAY_RATE = 2

    def __init__(self, supabase_client=None):
        self.sb = supabase_client

    def process_tick(self, user_id: str, minutes: int = 10) -> Dict[str, Any]:
        """
        Process a world tick for a specific user.
        Returns a summary of all events and changes.
        """
        events: List[WorldEvent] = []
        total_income = 0
        total_heat_change = 0
        total_loyalty_changes: Dict[str, int] = {}

        # If no Supabase, use mock data for dev mode
        if not self.sb:
            return self._process_mock_tick(user_id, minutes)

        try:
            # Fetch user's blocks
            blocks_resp = self.sb.table('blocks').select('*').eq('owner_id', user_id).execute()
            blocks = blocks_resp.data or []

            # Fetch user's members
            members_resp = self.sb.table('gang_members').select('*').eq('owner_id', user_id).execute()
            members = members_resp.data or []

            for block in blocks:
                block_events = self._process_block_tick(block, members, minutes)
                events.extend(block_events)

                for event in block_events:
                    if 'money' in event.effects:
                        total_income += event.effects['money']
                    if 'heat' in event.effects:
                        total_heat_change += event.effects['heat']

            # Process loyalty checks
            loyalty_events = self._process_loyalty(members)
            events.extend(loyalty_events)

            # Write events to database
            if events:
                event_records = [
                    {
                        'user_id': user_id,
                        'event_type': e.event_type,
                        'description': e.description,
                        'effects': e.effects,
                        'block_id': e.target_block_id,
                        'member_id': e.target_member_id,
                        'created_at': e.timestamp,
                    }
                    for e in events
                ]
                try:
                    self.sb.table('game_events').insert(event_records).execute()
                except Exception as e:
                    logger.warning(f"Failed to write events to DB: {e}")

        except Exception as e:
            logger.error(f"Tick processing error for user {user_id}: {e}")
            events.append(WorldEvent(
                event_type='error',
                description=f'Tick processing error: {str(e)}',
                target_user_id=user_id,
            ))

        return {
            'success': True,
            'user_id': user_id,
            'tick_minutes': minutes,
            'events': [e.to_dict() for e in events],
            'income': total_income,
            'heat_change': total_heat_change,
            'timestamp': datetime.utcnow().isoformat(),
        }

    def _process_block_tick(
        self, block: dict, members: list, minutes: int
    ) -> List[WorldEvent]:
        """Process a single block's tick: income, heat, events."""
        events: List[WorldEvent] = []
        block_id = block.get('id', '')
        address = block.get('address', 'Unknown Block')
        heat = block.get('heat_level', 0)

        # Find dealers on this block
        dealers = [
            m for m in members
            if m.get('current_block_id') == block_id
            and m.get('role') == 'dealer'
            and m.get('status') == 'active'
        ]

        # Calculate income
        if dealers:
            ticks = max(1, minutes // 10)
            income_per_tick = sum(
                self.BASE_DEALER_INCOME * (1 + m.get('stats', {}).get('dealing', 0) / 100)
                for m in dealers
            )
            total_income = int(income_per_tick * ticks)

            events.append(WorldEvent(
                event_type='income',
                description=f'Dealers on {address} earned ${total_income}.',
                effects={'money': total_income},
                target_block_id=block_id,
            ))

        # Heat decay
        if heat > 0:
            decay = min(heat, self.HEAT_DECAY_RATE * max(1, minutes // 10))
            events.append(WorldEvent(
                event_type='heat_decay',
                description=f'Heat on {address} cooled by {decay}.',
                effects={'heat': -decay},
                target_block_id=block_id,
            ))

            # Update heat in DB
            try:
                new_heat = max(0, heat - decay)
                self.sb.table('blocks').update(
                    {'heat_level': new_heat}
                ).eq('id', block_id).execute()
            except Exception as e:
                logger.warning(f"Failed to update heat for block {block_id}: {e}")

        # Random event roll (20% chance per tick)
        if random.random() < 0.20:
            random_event = EventGenerator.generate_random_event(address)
            random_event.target_block_id = block_id
            events.append(random_event)

        # Raid check (only if heat > 30)
        if heat > 30:
            raid_event = EventGenerator.generate_raid_event(address, heat)
            if raid_event:
                raid_event.target_block_id = block_id
                events.append(raid_event)

        return events

    def _process_loyalty(self, members: list) -> List[WorldEvent]:
        """Check loyalty for all members, generate events for low loyalty."""
        events: List[WorldEvent] = []

        for member in members:
            loyalty = member.get('loyalty', 100)
            status = member.get('status', 'active')

            if status != 'active':
                continue

            # Loyalty decay if below threshold
            if loyalty < 50:
                member_name = member.get('name', 'Unknown')
                member_id = member.get('id', '')

                # Roll for consequences
                roll = random.random()
                if loyalty < 20 and roll < 0.15:
                    events.append(WorldEvent(
                        event_type='desertion',
                        description=f'{member_name} deserted the gang!',
                        effects={'member_lost': True},
                        target_member_id=member_id,
                    ))
                elif loyalty < 35 and roll < 0.10:
                    events.append(WorldEvent(
                        event_type='betrayal',
                        description=f'{member_name} snitched to the cops!',
                        effects={'heat': 25, 'member_jailed': True},
                        target_member_id=member_id,
                    ))
                elif loyalty < 50 and roll < 0.08:
                    events.append(WorldEvent(
                        event_type='sabotage',
                        description=f'{member_name} sabotaged a deal.',
                        effects={'money_lost': random.randint(500, 2000)},
                        target_member_id=member_id,
                    ))

        return events

    def _process_mock_tick(self, user_id: str, minutes: int) -> Dict[str, Any]:
        """Mock tick for dev mode (no Supabase)."""
        events = []
        income = random.randint(100, 500) * max(1, minutes // 10)

        events.append(WorldEvent(
            event_type='income',
            description=f'Your dealers earned ${income} this tick.',
            effects={'money': income},
        ))

        # 30% chance of a random event
        if random.random() < 0.30:
            events.append(EventGenerator.generate_random_event('Your Block'))

        # 10% chance of heat decay
        events.append(WorldEvent(
            event_type='heat_decay',
            description='Heat cooled down slightly.',
            effects={'heat': -2},
        ))

        return {
            'success': True,
            'user_id': user_id,
            'tick_minutes': minutes,
            'events': [e.to_dict() for e in events],
            'income': income,
            'heat_change': -2,
            'timestamp': datetime.utcnow().isoformat(),
        }


# ─────────────────────────────────────────────────────────────────────────────
# SCHEDULER MANAGER
# ─────────────────────────────────────────────────────────────────────────────

class SchedulerManager:
    """
    Manages the APScheduler background scheduler.
    Runs world ticks, loyalty checks, and NPC actions on intervals.
    """

    def __init__(self, app=None):
        self.scheduler = None
        self.app = app
        self.tick_processor = None
        self._running = False

    def init_app(self, app):
        """Initialize the scheduler with a Flask app."""
        self.app = app
        self.tick_processor = WorldTickProcessor()

        try:
            from apscheduler.schedulers.background import BackgroundScheduler
            from apscheduler.triggers.interval import IntervalTrigger

            self.scheduler = BackgroundScheduler(
                job_defaults={
                    'coalesce': True,
                    'max_instances': 1,
                    'misfire_grace_time': 300,
                }
            )

            # World tick: every 10 minutes
            self.scheduler.add_job(
                self._run_world_tick,
                IntervalTrigger(minutes=10),
                id='world_tick',
                name='World Tick (Income, Heat, Events)',
                replace_existing=True,
            )

            # Loyalty check: every 30 minutes
            self.scheduler.add_job(
                self._run_loyalty_check,
                IntervalTrigger(minutes=30),
                id='loyalty_check',
                name='Loyalty Check (Desertion, Betrayal)',
                replace_existing=True,
            )

            # NPC actions: every 60 minutes
            self.scheduler.add_job(
                self._run_npc_actions,
                IntervalTrigger(minutes=60),
                id='npc_actions',
                name='NPC Actions (Expand, Retaliate, Raid)',
                replace_existing=True,
            )

            self.scheduler.start()
            self._running = True
            logger.info("World tick scheduler started successfully")

        except ImportError:
            logger.warning(
                "APScheduler not installed. Scheduler disabled. "
                "Install with: pip install APScheduler"
            )
        except Exception as e:
            logger.error(f"Failed to start scheduler: {e}")

    def shutdown(self):
        """Gracefully shut down the scheduler."""
        if self.scheduler and self._running:
            self.scheduler.shutdown(wait=False)
            self._running = False
            logger.info("Scheduler shut down")

    def get_status(self) -> dict:
        """Return scheduler status and job info."""
        if not self.scheduler:
            return {'running': False, 'reason': 'APScheduler not installed'}

        jobs = []
        for job in self.scheduler.get_jobs():
            jobs.append({
                'id': job.id,
                'name': job.name,
                'next_run': str(job.next_run_time) if job.next_run_time else None,
                'trigger': str(job.trigger),
            })

        return {
            'running': self._running,
            'jobs': jobs,
            'job_count': len(jobs),
        }

    def trigger_manual_tick(self, minutes: int = 10) -> dict:
        """Manually trigger a world tick (for testing)."""
        if not self.tick_processor:
            self.tick_processor = WorldTickProcessor()
        # In dev mode, process for the dev user
        return self.tick_processor.process_tick('dev-user-001', minutes)

    def _run_world_tick(self):
        """Scheduled job: process world tick for all active users."""
        with self.app.app_context():
            logger.info("Running scheduled world tick...")
            try:
                sb = self._get_supabase()
                if not sb:
                    logger.info("No Supabase — running mock tick")
                    return

                # Get all users with active blocks
                blocks_resp = sb.table('blocks').select('owner_id').execute()
                user_ids = list(set(b['owner_id'] for b in (blocks_resp.data or [])))

                processor = WorldTickProcessor(sb)
                for user_id in user_ids:
                    try:
                        result = processor.process_tick(user_id, 10)
                        logger.info(
                            f"Tick for {user_id}: income={result['income']}, "
                            f"events={len(result['events'])}"
                        )
                    except Exception as e:
                        logger.error(f"Tick failed for user {user_id}: {e}")

            except Exception as e:
                logger.error(f"World tick job failed: {e}")

    def _run_loyalty_check(self):
        """Scheduled job: check loyalty for all members."""
        with self.app.app_context():
            logger.info("Running scheduled loyalty check...")
            try:
                sb = self._get_supabase()
                if not sb:
                    return

                members_resp = sb.table('gang_members').select('*').lt('loyalty', 50).execute()
                low_loyalty = members_resp.data or []

                if low_loyalty:
                    processor = WorldTickProcessor(sb)
                    events = processor._process_loyalty(low_loyalty)
                    logger.info(f"Loyalty check: {len(low_loyalty)} low-loyalty members, {len(events)} events")

            except Exception as e:
                logger.error(f"Loyalty check failed: {e}")

    def _run_npc_actions(self):
        """Scheduled job: process NPC gang actions."""
        with self.app.app_context():
            logger.info("Running scheduled NPC actions...")
            try:
                sb = self._get_supabase()
                if not sb:
                    return

                # Get active NPC gangs
                npc_resp = sb.table('npc_gangs').select('*').eq('active', True).execute()
                npc_gangs = npc_resp.data or []

                for npc in npc_gangs:
                    try:
                        self._process_npc_turn(sb, npc)
                    except Exception as e:
                        logger.error(f"NPC action failed for {npc.get('name')}: {e}")

            except Exception as e:
                logger.error(f"NPC actions job failed: {e}")

    def _process_npc_turn(self, sb, npc: dict):
        """Process a single NPC gang's turn."""
        aggression = npc.get('aggression', 50)
        action_roll = random.random() * 100

        if action_roll < aggression * 0.3:
            # Attack a player block
            logger.info(f"NPC {npc['name']} is attacking!")
        elif action_roll < aggression * 0.5:
            # Expand territory
            logger.info(f"NPC {npc['name']} is expanding territory")
        else:
            # Patrol / defend
            logger.info(f"NPC {npc['name']} is patrolling")

    def _get_supabase(self):
        """Get Supabase client from app config."""
        url = self.app.config.get('SUPABASE_URL')
        key = self.app.config.get('SUPABASE_SERVICE_ROLE_KEY')
        if not url or not key:
            return None
        try:
            from supabase import create_client
            return create_client(url, key)
        except Exception:
            return None


# Singleton instance
scheduler_manager = SchedulerManager()
