import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CombatEvent, CombatSnapshot } from '../../../game/combat/types';
import { createCombatSession, getCombatSnapshot } from '../../../game/combat/combatSession';
import { prepareEncounter } from '../../../game/combat/prepareEncounter';
import { createAuthoritativeLoopBlock } from '../../../game/loop/blockLoopFixture';
import UnifiedEncounter from '../UnifiedEncounter';

const bridge = vi.hoisted(() => ({ snapshots: null as ((value: CombatSnapshot) => void) | null }));
vi.mock('phaser', () => ({ default: { AUTO: 0, Scale: { FIT: 0, CENTER_BOTH: 0 }, Game: class { destroy() {} } } }));
vi.mock('../UnifiedEncounterScene', () => ({
  UnifiedEncounterScene: class {
    events = { on: (name: string, listener: (snapshot: CombatSnapshot) => void) => { if (name === 'snapshot') bridge.snapshots = listener; } };
    configure() {}
    whenReady(ready: () => void) { ready(); }
  },
}));

describe('combat live log identity', () => {
  beforeEach(() => {
    bridge.snapshots = null;
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('retains existing live-region nodes as new actor events arrive, including duplicate engine IDs', () => {
    const block = createAuthoritativeLoopBlock();
    render(<UnifiedEncounter block={block} onClose={vi.fn()} onResolved={vi.fn()} />);
    const snapshot = getCombatSnapshot(createCombatSession(prepareEncounter(block)));
    const events: CombatEvent[] = [
      { id: 'same-tick-fire', tick: 1, type: 'weapon-fired', actorId: 'crew-1', targetId: 'rival-1', message: 'Dre fires from cover.' },
      { id: 'same-tick-fire', tick: 1, type: 'weapon-fired', actorId: 'crew-2', targetId: 'rival-2', message: 'Rome fires from cover.' },
    ];
    act(() => bridge.snapshots?.({ ...snapshot, events }));
    const dreNode = screen.getByText('Dre fires from cover.');
    const romeNode = screen.getByText('Rome fires from cover.');
    const next: CombatEvent = { id: 'next-tick-reload', tick: 2, type: 'reload-start', actorId: 'crew-1', message: 'Dre starts a reload.' };
    act(() => bridge.snapshots?.({ ...snapshot, events: [...events, next] }));
    expect(screen.getByText('Dre fires from cover.')).toBe(dreNode);
    expect(screen.getByText('Rome fires from cover.')).toBe(romeNode);
    act(() => bridge.snapshots?.({ ...snapshot, events: [...events, next] }));
    expect(screen.getByText('Dre fires from cover.')).toBe(dreNode);
  });
  it('shows current crew condition in the readable HUD as snapshots change', () => {
    const block = createAuthoritativeLoopBlock();
    const onResolved = vi.fn();
    render(<UnifiedEncounter block={block} onClose={vi.fn()} onResolved={onResolved} />);
    const snapshot = getCombatSnapshot(createCombatSession(prepareEncounter(block)));
    const condition = screen.getByLabelText('Scout condition');
    expect(condition).toHaveTextContent('80 HP');
    expect(condition).toHaveTextContent('6/6 ammo');
    act(() => bridge.snapshots?.({ ...snapshot, combatants: snapshot.combatants.map(actor =>
      actor.team === 'crew' ? { ...actor, health: 42, ammo: 2, reloadUntilTick: 20 } : actor,
    ) }));
    expect(screen.getByLabelText('Scout condition')).toBe(condition);
    expect(condition).toHaveTextContent('42 HP');
    expect(condition).toHaveTextContent('2/6 ammo');
    expect(condition).toHaveTextContent('reloading');
    act(() => bridge.snapshots?.({ ...snapshot, combatants: snapshot.combatants.map(actor =>
      actor.team === 'crew' ? { ...actor, health: 0, isDown: true, ammo: 0 } : actor,
    ) }));
    expect(condition).toHaveTextContent('DOWN');
    expect(condition).not.toHaveTextContent('reloading');
    expect(onResolved).not.toHaveBeenCalled();
  });

});
