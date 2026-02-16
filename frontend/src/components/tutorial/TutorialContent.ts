// ============================================
// DEALT/SLIDE Tutorial Steps Content
// Source: minimax-m2:cloud
// ============================================

import { TutorialStep } from '../../stores/tutorialStore';

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to the Crew',
    content: 'Confirm your gang name and customize your look.',
    rewards: [{ id: 'starter-cash', label: 'Cash', amount: 100 }],
  },
  {
    id: 'first-deal',
    title: 'Make Your First Deal',
    content: 'Open DEALT, review the client, and swipe to deal.',
    target: { selector: '[data-app="dealt"]', action: 'click' },
    autoAdvance: true,
    rewards: [{ id: 'profit-first', label: 'Profit', amount: 50 }],
  },
  {
    id: 'claim-territory',
    title: 'Claim Your First Block',
    content: 'Open MAP, learn the block system, and claim a block.',
    target: { selector: '[data-app="map"]', action: 'click' },
    rewards: [{ id: 'income-boost', label: 'Income/5min', amount: 10 }],
  },
  {
    id: 'recruit-member',
    title: 'Recruit Your First Member',
    content: 'Open CONTACTS to recruit and assign members.',
    target: { selector: '[data-app="contacts"]', action: 'click' },
    rewards: [{ id: 'recruit-bonus', label: 'Reputation', amount: 25 }],
  },
  {
    id: 'crafting-intro',
    title: 'Crafting Basics',
    content: 'Open ALCHEMY to craft your first item.',
    target: { selector: '[data-app="alchemy"]', action: 'click' },
    rewards: [{ id: 'craft-kit', label: 'Starter Kit', amount: 1 }],
  },
  {
    id: 'complete',
    title: "You're Ready",
    content: 'Collect your starter rewards and set loose on the city!',
    target: { selector: '[data-action="collect-rewards"]', action: 'click' },
    rewards: [{ id: 'welcome-pack', label: 'Welcome Pack', amount: 1 }],
  },
];
