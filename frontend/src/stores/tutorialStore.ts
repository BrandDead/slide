// ============================================
// DEALT/SLIDE Tutorial System
// Source: minimax-m2:cloud
// ============================================

import React, { createContext, useContext, useMemo, useReducer } from 'react';

export interface TutorialStep {
  id: string;
  title: string;
  content: string;
  target?: {
    selector: string;
    action: 'click' | 'swipe' | 'presence' | 'timer' | 'custom';
    timeoutMs?: number;
  };
  autoAdvance?: boolean;
  optional?: boolean;
  rewards?: { id: string; label: string; amount: number }[];
}

interface TutorialState {
  currentStep: number;
  isActive: boolean;
  completed: boolean;
  completedSteps: number[];
}

type TutorialAction =
  | { type: 'START' }
  | { type: 'NEXT' }
  | { type: 'PREV' }
  | { type: 'SKIP' }
  | { type: 'COMPLETE' }
  | { type: 'RESET' };

const initialState: TutorialState = {
  currentStep: 0,
  isActive: false,
  completed: false,
  completedSteps: [],
};

function reducer(state: TutorialState, action: TutorialAction): TutorialState {
  switch (action.type) {
    case 'START':
      return { ...initialState, isActive: true };
    case 'NEXT':
      return {
        ...state,
        currentStep: state.currentStep + 1,
        completedSteps: [...new Set([...state.completedSteps, state.currentStep])],
      };
    case 'PREV':
      return { ...state, currentStep: Math.max(0, state.currentStep - 1) };
    case 'SKIP':
    case 'COMPLETE':
      return { ...state, isActive: false, completed: true };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

const TutorialContext = createContext<{
  state: TutorialState;
  dispatch: React.Dispatch<TutorialAction>;
} | null>(null);

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return React.createElement(
    TutorialContext.Provider,
    { value },
    children
  );
}

export function useTutorial() {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error('useTutorial must be used within TutorialProvider');
  
  const { state, dispatch } = ctx;
  
  return {
    ...state,
    startTutorial: () => dispatch({ type: 'START' }),
    nextStep: () => dispatch({ type: 'NEXT' }),
    previousStep: () => dispatch({ type: 'PREV' }),
    skipTutorial: () => dispatch({ type: 'SKIP' }),
    completeTutorial: () => dispatch({ type: 'COMPLETE' }),
    reset: () => dispatch({ type: 'RESET' }),
  };
}
