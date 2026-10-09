import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import TutorialOverlay from './TutorialOverlay';
import AttackPlanner from '../missions/AttackPlanner';
import { useTutorialProgressStore } from '../../stores/tutorialProgressStore';
import { useNavigationStore } from '../../stores/gameStore';
import { useBlockStore } from '../../stores/blockStore';
import { useCombatIntentStore } from '../../stores/combatIntentStore';
import { applyDemoSeed } from '../../utils/demoSeed';

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

  it('sits the welcome hint above the phone dock', () => {
    render(<TutorialOverlay />);

    const hint = screen.getByText('Welcome to SLIDE').closest('.tutorial-hint');
    expect(hint).toBeInstanceOf(HTMLElement);
    const bottom = (hint as HTMLElement).style.bottom;
    expect(bottom).toContain('92px');
    expect(bottom).toContain('safe-area-inset-bottom');
  });

  it('lets an enabled Launch Response tap pass through the phone hint', () => {
    const css = readFileSync(resolve(__dirname, 'TutorialOverlay.css'), 'utf8');
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    useNavigationStore.setState({
      currentApp: 'planner',
      previousApp: 'home',
      appStack: ['home', 'planner'],
      isTransitioning: false,
    });
    useBlockStore.setState({ blocks: {}, selectedBlockId: null });
    applyDemoSeed();
    useCombatIntentStore.getState().reset();

    render(
      <>
        <AttackPlanner />
        <TutorialOverlay />
      </>,
    );

    const launch = screen.getByRole('button', { name: /launch response/i });
    expect(launch).toBeEnabled();

    const hint = screen.getByText('Welcome to SLIDE').closest('.tutorial-hint');
    expect(hint).toBeInstanceOf(HTMLElement);

    // jsdom has no layout engine. These boxes are the 375×812 measurements
    // for a hint overlapping the launch action: hint y674–720, button center (188, 679).
    const boxes = new Map<HTMLElement, { left: number; top: number; right: number; bottom: number }>([
      [hint as HTMLElement, { left: 0, top: 674, right: 375, bottom: 720 }],
      [launch, { left: 16, top: 654, right: 359, bottom: 704 }],
    ]);

    expect(phoneHitTarget(188, 679, boxes)).toBe(launch);
    expect(phoneHitTarget(188, 679, boxes)?.classList.contains('launch-btn')).toBe(true);
    fireEvent.click(launch);
    expect(useNavigationStore.getState().currentApp).toBe('map');
  });
});

type PhoneBox = { left: number; top: number; right: number; bottom: number };

/**
 * Same rule Chromium uses for elementFromPoint: the highest stacking box
 * that contains the point wins, unless pointer-events is none on that node
 * or an ancestor. jsdom does not implement elementFromPoint.
 */
function phoneHitTarget(
  x: number,
  y: number,
  boxes: Map<HTMLElement, PhoneBox>,
): HTMLElement | null {
  const hits = [...boxes.entries()].filter(([, box]) => (
    x >= box.left && x <= box.right && y >= box.top && y <= box.bottom
  ));
  hits.sort(([a], [b]) => stackingScore(b) - stackingScore(a) || domOrder(b, a));
  for (const [el] of hits) {
    if (!pointerEventsBlocked(el)) return el;
  }
  return null;
}

function stackingScore(el: HTMLElement): number {
  const cs = getComputedStyle(el);
  const positioned = cs.position !== 'static';
  const z = cs.zIndex === 'auto' ? 0 : Number.parseInt(cs.zIndex, 10);
  return (positioned ? 1000 : 0) + (Number.isFinite(z) ? z : 0);
}

function domOrder(a: HTMLElement, b: HTMLElement): number {
  const pos = a.compareDocumentPosition(b);
  if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
  if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
  return 0;
}

function pointerEventsBlocked(el: HTMLElement): boolean {
  let node: HTMLElement | null = el;
  while (node) {
    if (getComputedStyle(node).pointerEvents === 'none') return true;
    node = node.parentElement;
  }
  return false;
}
