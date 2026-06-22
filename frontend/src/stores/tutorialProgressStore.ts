// ============================================================
// tutorialProgressStore — Zustand store
// Tracks which tutorial steps have been completed and which
// app features are unlocked. Persisted to localStorage.
// Sprint: mobile-leaderboard-onboarding-batch4
// ============================================================

import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';

// ─── Tutorial Steps ──────────────────────────────────────────

export type TutorialStepId =
  | 'welcome'
  | 'gang_created'
  | 'first_block_claimed'
  | 'first_member_deployed'
  | 'first_income_collected'
  | 'first_deal_made'
  | 'first_driveby_survived'
  | 'first_drug_cooked'
  | 'first_bail_paid'
  | 'leaderboard_viewed';

export interface TutorialStep {
  id: TutorialStepId;
  title: string;
  description: string;
  /** App icon to highlight when this step is active */
  targetApp?: string;
  /** Whether this step has been completed */
  completed: boolean;
  /** XP reward on completion */
  xpReward: number;
  /** Cash reward on completion */
  cashReward: number;
}

// ─── Feature Unlock Gates ────────────────────────────────────

export type FeatureId =
  | 'map'
  | 'dealt'
  | 'slide'
  | 'driveby'
  | 'alchemy'
  | 'contacts'
  | 'shoebox'
  | 'market'
  | 'missions'
  | 'casino'
  | 'leaderboard'
  | 'graffiti';

const FEATURE_UNLOCK_REQUIREMENTS: Record<FeatureId, TutorialStepId | null> = {
  map:         null,                    // Always available
  dealt:       null,                    // Always available
  contacts:    null,                    // Always available
  slide:       'first_block_claimed',
  driveby:     'first_member_deployed',
  alchemy:     'first_deal_made',
  shoebox:     'first_income_collected',
  market:      'first_income_collected',
  missions:    'first_driveby_survived',
  casino:      'first_drug_cooked',
  leaderboard: 'leaderboard_viewed',
  graffiti:    'first_driveby_survived',
};

// ─── Step definitions ────────────────────────────────────────

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to SLIDE',
    description: 'You\'re in the game. Set up your gang and claim your first block.',
    targetApp: 'map',
    completed: false,
    xpReward: 50,
    cashReward: 500,
  },
  {
    id: 'gang_created',
    title: 'Gang Founded',
    description: 'Your crew has a name. Now claim some territory.',
    targetApp: 'map',
    completed: false,
    xpReward: 100,
    cashReward: 1000,
  },
  {
    id: 'first_block_claimed',
    title: 'First Block Claimed',
    description: 'You own the block. Now put your people on it.',
    targetApp: 'contacts',
    completed: false,
    xpReward: 200,
    cashReward: 2000,
  },
  {
    id: 'first_member_deployed',
    title: 'Crew on the Block',
    description: 'Your dealer is posted up. Let them work — collect that income.',
    targetApp: 'map',
    completed: false,
    xpReward: 150,
    cashReward: 500,
  },
  {
    id: 'first_income_collected',
    title: 'First Bag Collected',
    description: 'Money in hand. Keep the block running and check the market.',
    targetApp: 'dealt',
    completed: false,
    xpReward: 100,
    cashReward: 0,
  },
  {
    id: 'first_deal_made',
    title: 'First Deal',
    description: 'You served your first customer. Now cook something stronger.',
    targetApp: 'alchemy',
    completed: false,
    xpReward: 150,
    cashReward: 300,
  },
  {
    id: 'first_driveby_survived',
    title: 'Survived a Slide',
    description: 'They came for you and left empty. Now take it to them.',
    targetApp: 'slide',
    completed: false,
    xpReward: 300,
    cashReward: 1000,
  },
  {
    id: 'first_drug_cooked',
    title: 'First Cook',
    description: 'You made something new. Equip your dealers and watch the money flow.',
    targetApp: 'market',
    completed: false,
    xpReward: 200,
    cashReward: 500,
  },
  {
    id: 'first_bail_paid',
    title: 'Loyalty Proven',
    description: 'You bailed out your crew. They\'ll ride harder for you now.',
    targetApp: 'contacts',
    completed: false,
    xpReward: 250,
    cashReward: 0,
  },
  {
    id: 'leaderboard_viewed',
    title: 'Know Your Competition',
    description: 'You checked the rankings. Now climb them.',
    targetApp: 'leaderboard',
    completed: false,
    xpReward: 50,
    cashReward: 0,
  },
];

// ─── Store ───────────────────────────────────────────────────

interface TutorialProgressState {
  steps: TutorialStep[];
  unlockedFeatures: Set<FeatureId>;
  currentStepId: TutorialStepId | null;
  showTutorialOverlay: boolean;
  overlayMessage: string | null;
}

interface TutorialProgressActions {
  completeStep: (stepId: TutorialStepId) => { xpReward: number; cashReward: number };
  isFeatureUnlocked: (featureId: FeatureId) => boolean;
  getNextIncompleteStep: () => TutorialStep | null;
  dismissOverlay: () => void;
  showOverlay: (message: string) => void;
  resetTutorial: () => void;
}

type TutorialProgressStore = TutorialProgressState & TutorialProgressActions;

function computeUnlockedFeatures(steps: TutorialStep[]): Set<FeatureId> {
  const completedIds = new Set(steps.filter(s => s.completed).map(s => s.id));
  const unlocked = new Set<FeatureId>();

  (Object.entries(FEATURE_UNLOCK_REQUIREMENTS) as [FeatureId, TutorialStepId | null][]).forEach(
    ([feature, requirement]) => {
      if (requirement === null || completedIds.has(requirement)) {
        unlocked.add(feature);
      }
    }
  );

  return unlocked;
}

export const useTutorialProgressStore = create<TutorialProgressStore>()(
  persist(
    devtools(
      (set, get) => ({
        steps: TUTORIAL_STEPS,
        unlockedFeatures: computeUnlockedFeatures(TUTORIAL_STEPS),
        currentStepId: 'welcome',
        showTutorialOverlay: false,
        overlayMessage: null,

        completeStep: (stepId) => {
          const { steps } = get();
          const step = steps.find(s => s.id === stepId);
          if (!step || step.completed) return { xpReward: 0, cashReward: 0 };

          const newSteps = steps.map(s =>
            s.id === stepId ? { ...s, completed: true } : s
          );

          // Find next incomplete step
          const nextStep = newSteps.find(s => !s.completed) ?? null;

          set({
            steps: newSteps,
            unlockedFeatures: computeUnlockedFeatures(newSteps),
            currentStepId: nextStep?.id ?? null,
            showTutorialOverlay: true,
            overlayMessage: `✅ ${step.title} — +${step.xpReward} XP${step.cashReward > 0 ? ` +$${step.cashReward}` : ''}`,
          });

          return { xpReward: step.xpReward, cashReward: step.cashReward };
        },

        isFeatureUnlocked: (featureId) => {
          return get().unlockedFeatures.has(featureId);
        },

        getNextIncompleteStep: () => {
          return get().steps.find(s => !s.completed) ?? null;
        },

        dismissOverlay: () => set({ showTutorialOverlay: false, overlayMessage: null }),

        showOverlay: (message) => set({ showTutorialOverlay: true, overlayMessage: message }),

        resetTutorial: () =>
          set({
            steps: TUTORIAL_STEPS,
            unlockedFeatures: computeUnlockedFeatures(TUTORIAL_STEPS),
            currentStepId: 'welcome',
            showTutorialOverlay: false,
            overlayMessage: null,
          }),
      }),
      { name: 'tutorial-progress-store' }
    ),
    {
      name: 'dealt-slide-tutorial',
      // Don't persist the Set directly — convert to array
      partialize: (state) => ({
        steps: state.steps,
        currentStepId: state.currentStepId,
      }),
      // Rehydrate unlockedFeatures from steps on load
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.unlockedFeatures = computeUnlockedFeatures(state.steps);
        }
      },
    }
  )
);
