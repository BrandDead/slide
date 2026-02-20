// ============================================================
// Mission Generator - Procedural mission creation
// ============================================================

export interface Mission {
  id: string;
  type: 'attack' | 'defend' | 'delivery' | 'supply_run' | 'hit' | 'recruit';
  title: string;
  description: string;
  objective: string;
  rewards: {
    money: number;
    xp: number;
    reputation: number;
  };
  difficulty: 'easy' | 'medium' | 'hard' | 'suicide';
  timeLimit: number; // seconds, 0 = no limit
  requirements: string[];
  status: 'available' | 'active' | 'completed' | 'failed';
}

interface MissionTemplate {
  type: Mission['type'];
  titles: string[];
  descriptions: string[];
  objectives: string[];
}

const TEMPLATES: MissionTemplate[] = [
  {
    type: 'attack',
    titles: ['Rival Takedown', 'Block Sweep', 'Opp Hunt', 'Territory Push', 'Send a Message'],
    descriptions: [
      'A rival gang is getting too comfortable on their block.',
      'Time to push into enemy territory and show them who runs this.',
      'Intel says the opps are slipping. Hit them while they\'re lacking.',
      'The block next door has been talking reckless. Shut them down.',
      'A rival crew just disrespected your set. Handle it.',
    ],
    objectives: [
      'Eliminate 3 rival gang members',
      'Win a SLIDE battle against the target block',
      'Successfully complete a drive-by on enemy territory',
      'Take out the rival block\'s top shooter',
      'Raid the enemy stash house',
    ],
  },
  {
    type: 'defend',
    titles: ['Hold the Block', 'Block Defense', 'Stand Your Ground', 'Night Watch', 'Protect the Stash'],
    descriptions: [
      'Word on the street is someone\'s planning to slide on your block tonight.',
      'Your block is under threat. Set up defenses and hold it down.',
      'Rival gang spotted scoping your territory. Get ready.',
      'A snitch tipped off the opps about your stash location.',
      'Police activity is high. Keep the block running without getting caught.',
    ],
    objectives: [
      'Survive 3 rounds of enemy attacks',
      'Defend your block for 5 minutes',
      'Repel a drive-by attack without casualties',
      'Keep all dealers alive during a raid',
      'Maintain block control for 24 hours',
    ],
  },
  {
    type: 'delivery',
    titles: ['Drug Run', 'Package Delivery', 'Re-Up Run', 'Cross-Town Drop', 'Special Order'],
    descriptions: [
      'A high-value client needs a delivery across town. Don\'t get caught.',
      'The plug has a package ready. Pick it up and bring it back safe.',
      'Time to re-up. Make the run to the connect and bring back product.',
      'A VIP customer placed a special order. Deliver it personally.',
      'Emergency supply run. The block is running dry.',
    ],
    objectives: [
      'Deliver the package without getting busted',
      'Complete the delivery within the time limit',
      'Pick up the re-up and return to base',
      'Make 5 successful deliveries in a row',
      'Transport product across 3 blocks without detection',
    ],
  },
  {
    type: 'supply_run',
    titles: ['Cook Session', 'Lab Work', 'Chemistry Class', 'Product Development', 'New Recipe'],
    descriptions: [
      'The lab needs ingredients. Source the materials and cook up a batch.',
      'A new recipe just dropped. Get the ingredients and test it out.',
      'The block needs premium product. Time to cook something special.',
      'Your dealers are complaining about product quality. Step it up.',
      'A connect offered rare ingredients. Use them wisely.',
    ],
    objectives: [
      'Craft 3 different drugs in the Cook Lab',
      'Create a Tier 3 or higher drug',
      'Cook product worth at least $5,000',
      'Discover a new recipe combination',
      'Produce enough product to supply all dealers',
    ],
  },
  {
    type: 'hit',
    titles: ['Contract Hit', 'Bounty Hunt', 'Clean Up', 'Silencer Job', 'Ghost Protocol'],
    descriptions: [
      'Someone put a price on a target\'s head. Collect the bounty.',
      'A snitch needs to be dealt with before they talk to the feds.',
      'An ex-member went rogue. Find them and handle it.',
      'A rival boss is getting too powerful. Take them out quietly.',
      'Someone stole from the gang. Track them down.',
    ],
    objectives: [
      'Eliminate the target without raising heat',
      'Complete the hit using only a pistol',
      'Take out the target and escape clean',
      'Find and eliminate the snitch',
      'Handle the traitor before they reach the cops',
    ],
  },
  {
    type: 'recruit',
    titles: ['Fresh Blood', 'Recruitment Drive', 'New Soldiers', 'Talent Scout', 'Build the Crew'],
    descriptions: [
      'The gang needs new members. Find some soldiers on the block.',
      'Word is there are some young guns looking for a crew to run with.',
      'After recent losses, it\'s time to rebuild the roster.',
      'A skilled shooter is looking for work. Bring them in.',
      'The block needs more dealers. Recruit and train them.',
    ],
    objectives: [
      'Recruit 2 new gang members',
      'Find a member with shooting skill above 5',
      'Recruit a dealer and assign them to a block',
      'Build your crew to 10 members',
      'Recruit and equip a new shooter',
    ],
  },
];

const DIFFICULTY_MULTIPLIERS = {
  easy: 1,
  medium: 2,
  hard: 3.5,
  suicide: 6,
};

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export function generateMissions(count: number): Mission[] {
  const missions: Mission[] = [];
  const usedTemplates = new Set<number>();

  for (let i = 0; i < count; i++) {
    let templateIdx: number;
    do {
      templateIdx = Math.floor(Math.random() * TEMPLATES.length);
    } while (usedTemplates.has(templateIdx) && usedTemplates.size < TEMPLATES.length);
    usedTemplates.add(templateIdx);

    const template = TEMPLATES[templateIdx];
    const difficulties: Mission['difficulty'][] = ['easy', 'medium', 'hard', 'suicide'];
    const difficulty = difficulties[Math.min(i, difficulties.length - 1)] || pick(difficulties.slice(0, 3));
    const mult = DIFFICULTY_MULTIPLIERS[difficulty];

    const baseMoney = 500 + Math.floor(Math.random() * 1000);
    const baseXP = 50 + Math.floor(Math.random() * 100);
    const baseRep = 5 + Math.floor(Math.random() * 10);

    missions.push({
      id: `mission-${Date.now()}-${i}`,
      type: template.type,
      title: pick(template.titles),
      description: pick(template.descriptions),
      objective: pick(template.objectives),
      rewards: {
        money: Math.floor(baseMoney * mult),
        xp: Math.floor(baseXP * mult),
        reputation: Math.floor(baseRep * mult),
      },
      difficulty,
      timeLimit: difficulty === 'easy' ? 0 : (300 + Math.floor(Math.random() * 300)),
      requirements: [],
      status: 'available',
    });
  }

  return missions;
}
