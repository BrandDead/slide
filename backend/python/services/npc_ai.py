"""
DEALT/SLIDE - NPC AI System
Defines NPC gang behaviors: patrol, expand, retaliate, raid, defend.
NPCs create dynamic opposition for the player.
"""

import random
import uuid
import logging
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# NPC GANG DATA
# ─────────────────────────────────────────────────────────────────────────────

NPC_GANG_NAMES = [
    "The Scorpions", "Dead End Boys", "Block Burners", "South Side Reapers",
    "The 400 Boyz", "Grim Street Posse", "Nightfall Crew", "The Vipers",
    "Iron Gate Clique", "Blood Alley Kings", "The Undertakers", "Ghost Block",
    "Concrete Jungle", "The Outlawz", "Trap House Mafia", "Corner Boys",
    "The Wolves", "Brick City Soldiers", "No Mercy Gang", "The Savages",
]

NPC_FACTIONS = ['eastside', 'westside', 'northside', 'southside', 'downtown']

NPC_MEMBER_FIRST_NAMES = [
    "Lil", "Big", "Young", "OG", "Baby", "Slim", "Fat", "Tiny",
    "Crazy", "Mad", "Wild", "Dirty", "Slick", "Quick", "Smooth",
]

NPC_MEMBER_LAST_NAMES = [
    "Mike", "D", "Jay", "Tee", "Ace", "King", "Duke", "Ghost",
    "Reaper", "Shadow", "Blade", "Smoke", "Ice", "Rock", "Stone",
]


@dataclass
class NPCMember:
    """An NPC gang member with stats."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ''
    role: str = 'shooter'  # shooter, dealer, enforcer
    level: int = 1
    health: int = 100
    max_health: int = 100
    shooting: int = 30
    dealing: int = 30
    nerve: int = 30
    alive: bool = True

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'name': self.name,
            'role': self.role,
            'level': self.level,
            'health': self.health,
            'max_health': self.max_health,
            'shooting': self.shooting,
            'dealing': self.dealing,
            'nerve': self.nerve,
            'alive': self.alive,
        }


@dataclass
class NPCGang:
    """An NPC gang with members, territory, and behavior weights."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ''
    faction: str = 'eastside'
    difficulty: int = 1  # 1-5
    aggression: int = 50  # 0-100
    wealth: int = 50  # 0-100
    territory_count: int = 1
    controlled_blocks: List[str] = field(default_factory=list)
    members: List[NPCMember] = field(default_factory=list)
    active: bool = True
    last_attacked_by: Optional[str] = None
    last_attacked_at: Optional[str] = None
    behavior_weights: Dict[str, float] = field(default_factory=lambda: {
        'patrol': 0.30,
        'expand': 0.20,
        'retaliate': 0.25,
        'raid': 0.15,
        'defend': 0.10,
    })

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'name': self.name,
            'faction': self.faction,
            'difficulty': self.difficulty,
            'aggression': self.aggression,
            'wealth': self.wealth,
            'territory_count': self.territory_count,
            'controlled_blocks': self.controlled_blocks,
            'members': [m.to_dict() for m in self.members],
            'active': self.active,
            'behavior_weights': self.behavior_weights,
        }


# ─────────────────────────────────────────────────────────────────────────────
# NPC SPAWNER
# ─────────────────────────────────────────────────────────────────────────────

class NPCSpawner:
    """Creates NPC gangs with auto-generated members and initial territory."""

    @classmethod
    def spawn_gang(cls, difficulty: int = 1, city: str = 'miami') -> NPCGang:
        """
        Spawn a new NPC gang with members based on difficulty.
        Difficulty 1: 3 members, low stats
        Difficulty 5: 10 members, high stats
        """
        name = random.choice(NPC_GANG_NAMES)
        faction = random.choice(NPC_FACTIONS)

        # Scale member count and stats with difficulty
        member_count = min(3 + difficulty * 2, 12)
        base_stat = 20 + difficulty * 10
        aggression = min(30 + difficulty * 15, 100)
        wealth = min(20 + difficulty * 15, 100)

        members = []
        for i in range(member_count):
            role = random.choices(
                ['shooter', 'dealer', 'enforcer'],
                weights=[0.4, 0.35, 0.25],
                k=1
            )[0]

            member_name = f"{random.choice(NPC_MEMBER_FIRST_NAMES)} {random.choice(NPC_MEMBER_LAST_NAMES)}"
            level = max(1, difficulty + random.randint(-1, 2))

            # Stat variation based on role
            stat_bonus = {'shooter': (15, 0, 5), 'dealer': (0, 15, 5), 'enforcer': (10, 0, 10)}
            s_bonus, d_bonus, n_bonus = stat_bonus.get(role, (5, 5, 5))

            members.append(NPCMember(
                name=member_name,
                role=role,
                level=level,
                health=80 + difficulty * 5,
                max_health=80 + difficulty * 5,
                shooting=min(base_stat + s_bonus + random.randint(-5, 10), 100),
                dealing=min(base_stat + d_bonus + random.randint(-5, 10), 100),
                nerve=min(base_stat + n_bonus + random.randint(-5, 10), 100),
            ))

        gang = NPCGang(
            name=name,
            faction=faction,
            difficulty=difficulty,
            aggression=aggression,
            wealth=wealth,
            members=members,
        )

        # Adjust behavior weights based on difficulty
        if difficulty >= 4:
            gang.behavior_weights = {
                'patrol': 0.15,
                'expand': 0.25,
                'retaliate': 0.30,
                'raid': 0.20,
                'defend': 0.10,
            }
        elif difficulty >= 2:
            gang.behavior_weights = {
                'patrol': 0.25,
                'expand': 0.25,
                'retaliate': 0.25,
                'raid': 0.15,
                'defend': 0.10,
            }

        logger.info(f"Spawned NPC gang: {name} (difficulty {difficulty}, {member_count} members)")
        return gang

    @classmethod
    def spawn_for_city(cls, city: str, player_block_count: int = 1) -> List[NPCGang]:
        """
        Spawn appropriate NPC gangs for a city based on player progress.
        More blocks = harder NPCs.
        """
        gang_count = min(2 + player_block_count, 8)
        gangs = []

        for i in range(gang_count):
            difficulty = min(1 + (player_block_count // 2) + random.randint(0, 1), 5)
            gang = cls.spawn_gang(difficulty=difficulty, city=city)
            gangs.append(gang)

        return gangs


# ─────────────────────────────────────────────────────────────────────────────
# NPC BEHAVIOR ENGINE
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class NPCAction:
    """Result of an NPC behavior decision."""
    action_type: str  # patrol, expand, retaliate, raid, defend
    target_block_id: Optional[str] = None
    target_user_id: Optional[str] = None
    members_involved: List[str] = field(default_factory=list)
    description: str = ''
    events: List[Dict[str, Any]] = field(default_factory=list)


class NPCBehaviorEngine:
    """
    Decides and executes NPC gang actions each tick.
    Actions are weighted by the gang's behavior_weights, modified by
    aggression, recent attacks, and territory proximity.
    """

    def __init__(self, supabase_client=None):
        self.sb = supabase_client

    def decide_action(self, npc_gang: NPCGang, game_state: dict) -> NPCAction:
        """
        Decide what action an NPC gang takes this tick.
        game_state should include: player_blocks, recent_attacks, unclaimed_blocks
        """
        weights = dict(npc_gang.behavior_weights)

        # Modify weights based on context
        if npc_gang.last_attacked_by:
            # Recently attacked — boost retaliation
            weights['retaliate'] *= 2.5
            weights['patrol'] *= 0.5

        if npc_gang.aggression > 70:
            # Aggressive gang — boost raids
            weights['raid'] *= 1.5
            weights['defend'] *= 0.5

        if len(npc_gang.controlled_blocks) < 2:
            # Small territory — boost expansion
            weights['expand'] *= 2.0
            weights['raid'] *= 0.5

        # Normalize weights
        total = sum(weights.values())
        if total == 0:
            total = 1
        normalized = {k: v / total for k, v in weights.items()}

        # Weighted random choice
        actions = list(normalized.keys())
        probs = list(normalized.values())
        chosen = random.choices(actions, weights=probs, k=1)[0]

        # Execute the chosen action
        action_map = {
            'patrol': self._execute_patrol,
            'expand': self._execute_expand,
            'retaliate': self._execute_retaliate,
            'raid': self._execute_raid,
            'defend': self._execute_defend,
        }

        executor = action_map.get(chosen, self._execute_patrol)
        return executor(npc_gang, game_state)

    def _execute_patrol(self, gang: NPCGang, state: dict) -> NPCAction:
        """Patrol owned blocks, heal members, check for threats."""
        alive_members = [m for m in gang.members if m.alive]

        # Heal injured members
        healed = []
        for member in alive_members:
            if member.health < member.max_health:
                member.health = min(member.max_health, member.health + 10)
                healed.append(member.name)

        desc = f"{gang.name} patrolled their territory."
        if healed:
            desc += f" Healed: {', '.join(healed[:3])}."

        return NPCAction(
            action_type='patrol',
            description=desc,
            events=[{
                'type': 'npc_patrol',
                'description': desc,
                'effects': {},
            }],
        )

    def _execute_expand(self, gang: NPCGang, state: dict) -> NPCAction:
        """Attempt to claim an unclaimed block adjacent to territory."""
        unclaimed = state.get('unclaimed_blocks', [])

        if not unclaimed:
            return self._execute_patrol(gang, state)

        target = random.choice(unclaimed)
        claim_chance = gang.wealth / 100.0

        if random.random() < claim_chance:
            gang.controlled_blocks.append(target)
            gang.territory_count += 1
            desc = f"{gang.name} claimed a new block!"
        else:
            desc = f"{gang.name} tried to expand but failed."

        return NPCAction(
            action_type='expand',
            target_block_id=target,
            description=desc,
            events=[{
                'type': 'npc_expand',
                'description': desc,
                'effects': {'block_claimed': target if random.random() < claim_chance else None},
            }],
        )

    def _execute_retaliate(self, gang: NPCGang, state: dict) -> NPCAction:
        """Retaliate against the player who attacked recently."""
        if not gang.last_attacked_by:
            return self._execute_patrol(gang, state)

        player_blocks = state.get('player_blocks', [])
        if not player_blocks:
            return self._execute_patrol(gang, state)

        target_block = random.choice(player_blocks)
        shooters = [m for m in gang.members if m.alive and m.role == 'shooter']
        involved = shooters[:3] if shooters else gang.members[:2]

        attack_type = random.choice(['driveby', 'slide'])
        desc = f"{gang.name} is retaliating with a {attack_type} on your block!"

        return NPCAction(
            action_type='retaliate',
            target_block_id=target_block,
            target_user_id=gang.last_attacked_by,
            members_involved=[m.id for m in involved],
            description=desc,
            events=[{
                'type': f'npc_{attack_type}',
                'description': desc,
                'effects': {
                    'member_damage': random.randint(15, 50),
                    'heat': 20,
                    'territory_threat': True,
                },
            }],
        )

    def _execute_raid(self, gang: NPCGang, state: dict) -> NPCAction:
        """Launch a raid on a high-heat player block."""
        player_blocks = state.get('player_blocks', [])
        if not player_blocks:
            return self._execute_patrol(gang, state)

        # Prefer high-heat blocks
        target_block = random.choice(player_blocks)
        raid_chance = gang.aggression / 100.0

        if random.random() > raid_chance:
            return self._execute_patrol(gang, state)

        enforcers = [m for m in gang.members if m.alive and m.role in ('shooter', 'enforcer')]
        involved = enforcers[:4] if enforcers else gang.members[:3]

        desc = f"{gang.name} is raiding your block!"

        return NPCAction(
            action_type='raid',
            target_block_id=target_block,
            members_involved=[m.id for m in involved],
            description=desc,
            events=[{
                'type': 'npc_raid',
                'description': desc,
                'effects': {
                    'member_damage': random.randint(20, 60),
                    'money_lost': random.randint(1000, 5000),
                    'heat': 25,
                    'territory_threat': True,
                },
            }],
        )

    def _execute_defend(self, gang: NPCGang, state: dict) -> NPCAction:
        """Reinforce blocks under threat."""
        desc = f"{gang.name} is reinforcing their defenses."

        # Heal and boost members
        for member in gang.members:
            if member.alive:
                member.health = min(member.max_health, member.health + 5)

        return NPCAction(
            action_type='defend',
            description=desc,
            events=[{
                'type': 'npc_defend',
                'description': desc,
                'effects': {},
            }],
        )
