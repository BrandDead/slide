import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import TutorialOverlay from './TutorialOverlay';
import { useTutorialProgressStore } from '../../stores/tutorialProgressStore';

describe('TutorialOverlay', () => {
  beforeEach(() => {
    useTutorialProgressStore.setState({
      showTutorialOverlay: false,
      overlayMessage: null,
      currentStepId: 'welcome',
      steps: [
        {
          id: 'welcome',
          title: 'Welcome to SLIDE',
          description: 'Set up your gang and claim your first block.',
          targetApp: 'map',
          completed: false,
          xpReward: 50,
          cashReward: 500,
        },
      ],
    });
  });

  it('hides the redundant fixed hint while the Strip owns the next action', () => {
    render(<TutorialOverlay hidden />);

    expect(screen.queryByText('Welcome to SLIDE')).not.toBeInTheDocument();
  });

  it('shows the next-step hint on screens that do not own that action', () => {
    render(<TutorialOverlay />);

    expect(screen.getByText('Welcome to SLIDE')).toBeInTheDocument();
  });
});
