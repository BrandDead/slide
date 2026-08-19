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
import { useCombatIntentStore } from '../../../stores/combatIntentStore';

describe('CarCrewSelector → street handoff (#108)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCombatIntentStore.getState().reset();
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
    // Assert against the canonical block-hash contract, not a substring.
    expect(street.seed).toBe(
      `block_${crew.targetBlock.lat.toFixed(6)}_${crew.targetBlock.lng.toFixed(6)}`
    );
  });

  it('pre-fills a target locked from the Maps recon pin', async () => {
    useCombatIntentStore.getState().setPendingTarget({
      address: 'Sistrunk Blvd & NW 7th Ave',
      lat: 26.13,
      lng: -80.14,
      seedMode: 'geocoded',
    });
    const onConfirm = vi.fn();
    render(<CarCrewSelector onConfirm={onConfirm} onCancel={() => {}} />);
    expect(screen.getByText(/target locked from maps/i)).toBeInTheDocument();
    expect(screen.getByText(/Sistrunk Blvd/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Driver', { selector: '.seat-label' }).closest('.car-seat')!);
    fireEvent.click(screen.getByText('Wheel Man'));
    fireEvent.click(screen.getByText('Passenger (Shooter)', { selector: '.seat-label' }).closest('.car-seat')!);
    fireEvent.click(screen.getByText('Trigger'));
    fireEvent.click(screen.getByText(/slide on they block/i));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    expect(onConfirm.mock.calls[0][0].targetBlock.address).toBe('Sistrunk Blvd & NW 7th Ave');
    expect(useCombatIntentStore.getState().pendingTarget).toBeNull();
  });

  it('labels the offline text fallback and hands a text-seed target when no geocoder result is chosen', async () => {
    const onConfirm = vi.fn();
    render(<CarCrewSelector onConfirm={onConfirm} onCancel={() => {}} />);

    // The offline fallback is clearly labelled in the UI.
    expect(screen.getByText(/offline fallback/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Driver', { selector: '.seat-label' }).closest('.car-seat')!);
    fireEvent.click(screen.getByText('Wheel Man'));
    fireEvent.click(screen.getByText('Passenger (Shooter)', { selector: '.seat-label' }).closest('.car-seat')!);
    fireEvent.click(screen.getByText('Trigger'));

    // Type a free-text target into the labelled offline field.
    fireEvent.change(screen.getByPlaceholderText(/63rd & king drive/i), {
      target: { value: '63rd & King Drive' },
    });

    fireEvent.click(screen.getByText(/slide on they block/i));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    const crew = onConfirm.mock.calls[0][0];
    expect(crew.targetBlock.seedMode).toBe('text-seed');
    expect(crew.targetBlock.lat).toBeUndefined();
    expect(crew.targetBlock.address).toBe('63rd & king drive');

    const street = resolveStreetForTarget(crew.targetBlock);
    expect(street.seedMode).toBe('text-seed');
  });

  it('two coordinate-distinct autocomplete picks produce distinct scenes', async () => {
    const picks: any[] = [];
    const onConfirm = vi.fn((c) => picks.push(c));
    const { unmount } = render(<CarCrewSelector onConfirm={onConfirm} onCancel={() => {}} />);

    const pick = async (query: string, match: RegExp) => {
      fireEvent.click(screen.getByText('Driver', { selector: '.seat-label' }).closest('.car-seat')!);
      fireEvent.click(screen.getByText('Wheel Man'));
      fireEvent.click(screen.getByText('Passenger (Shooter)', { selector: '.seat-label' }).closest('.car-seat')!);
      fireEvent.click(screen.getByText('Trigger'));
      fireEvent.change(screen.getByPlaceholderText(/search a target address/i), { target: { value: query } });
      fireEvent.mouseDown(await screen.findByText(match));
      fireEvent.click(screen.getByText(/slide on they block/i));
      await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    };

    await pick('las olas', /1208 W Las Olas Blvd/i);
    unmount();

    const onConfirm2 = vi.fn((c) => picks.push(c));
    render(<CarCrewSelector onConfirm={onConfirm2} onCancel={() => {}} />);
    fireEvent.click(screen.getByText('Driver', { selector: '.seat-label' }).closest('.car-seat')!);
    fireEvent.click(screen.getByText('Wheel Man'));
    fireEvent.click(screen.getByText('Passenger (Shooter)', { selector: '.seat-label' }).closest('.car-seat')!);
    fireEvent.click(screen.getByText('Trigger'));
    fireEvent.change(screen.getByPlaceholderText(/search a target address/i), { target: { value: 'overtown' } });
    fireEvent.mouseDown(await screen.findByText(/1400 NW 3rd Ave/i));
    fireEvent.click(screen.getByText(/slide on they block/i));
    await waitFor(() => expect(onConfirm2).toHaveBeenCalled());

    const a = resolveStreetForTarget(picks[0].targetBlock);
    const b = resolveStreetForTarget(picks[1].targetBlock);
    expect(a.seed).not.toBe(b.seed);
  });
});
