// UI handoff test for #108 — a geocoded target picked in
// CarCrewSelector flows through the CarCrew contract into street
// resolution with its real coordinates (never the fixed fallback).
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ── Mock the gang store with a driver + a shooter ────────────
const baseStats = { strength: 50, agility: 50, intelligence: 50, charisma: 50, luck: 50, intimidation: 50 };
const mkMember = (id: string, name: string, role: string) => ({
  id, gangId: 'g1', name, nickname: name, avatarUrl: '', backstory: '',
  age: 25, region: 'fort_lauderdale', stats: baseStats,
  level: 3, experience: 0, skillPoints: 0, skills: [],
  loyalty: 80, morale: 80, respect: 50,
  kills: 0, arrests: 0, dealsCompleted: 0, moneyEarned: 0,
  status: 'active', currentAssignment: null, joinedAt: '2026-01-01', role,
});

const mockMembers = [
  mkMember('d1', 'Wheel Man', 'dealer'),
  mkMember('s1', 'Trigger', 'shooter'),
];

vi.mock('../../../stores/gameStore', () => ({
  useGangStore: () => ({ members: mockMembers }),
}));

// Mock the placeholder avatar pipeline (avoids image/canvas work)
vi.mock('../../../services/ai/artPipeline', () => ({
  generatePlaceholderAvatar: () => '',
}));

import CarCrewSelector from '../CarCrewSelector';
import { resolveStreetForTarget } from '../../../utils/driveByTarget';

describe('CarCrewSelector → street handoff (#108)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hands a geocoded AddressResult through CarCrew and into a coordinate-seeded scene', async () => {
    const onConfirm = vi.fn();
    render(<CarCrewSelector onConfirm={onConfirm} onCancel={() => {}} />);

    // Assign driver (seat 0) and a shooter — target the seat labels exactly
    fireEvent.click(screen.getByText('Driver', { selector: '.seat-label' }).closest('.car-seat')!);
    fireEvent.click(screen.getByText('Wheel Man'));
    fireEvent.click(screen.getByText('Passenger (Shooter)', { selector: '.seat-label' }).closest('.car-seat')!);
    fireEvent.click(screen.getByText('Trigger'));

    // Pick a target from the (mock) address autocomplete
    const input = screen.getByPlaceholderText(/search a target address/i);
    fireEvent.change(input, { target: { value: 'las olas' } });
    const option = await screen.findByText(/1208 W Las Olas Blvd/i);
    fireEvent.mouseDown(option);

    // Launch
    fireEvent.click(screen.getByText(/slide on they block/i));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    const crew = onConfirm.mock.calls[0][0];
    expect(crew.targetBlock).toBeTruthy();
    expect(crew.targetBlock.seedMode).toBe('geocoded');
    expect(typeof crew.targetBlock.lat).toBe('number');
    expect(typeof crew.targetBlock.lng).toBe('number');

    // The structured target resolves to a coordinate-seeded street.
    const street = resolveStreetForTarget(crew.targetBlock);
    expect(street.seedMode).toBe('geocoded');
    expect(street.seed).toContain(String(crew.targetBlock.lat.toFixed(6)));
  });
});
