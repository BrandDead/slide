// UI handoff test for #108 — a geocoded target picked in
// CarCrewSelector flows through the CarCrew contract into street
// resolution with its real coordinates (never the fixed fallback).
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

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

type FixtureMember = ReturnType<typeof mkMember> & {
  customAvatarUrl?: string;
  portraitUrl?: string;
  health?: number;
  maxHealth?: number;
  inventory?: Array<{ itemId: string; type: string; name: string; quantity: number }>;
};
let mockMembers: FixtureMember[] = [
  mkMember('d1', 'Wheel Man', 'dealer'),
  mkMember('s1', 'Trigger', 'shooter'),
];

vi.mock('../../../stores/gameStore', () => ({
  useGangStore: Object.assign(
    (selector?: (state: { members: typeof mockMembers }) => unknown) =>
      selector ? selector({ members: mockMembers }) : { members: mockMembers },
    { getState: () => ({ members: mockMembers }) },
  ),
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
    mockMembers = [mkMember('d1', 'Wheel Man', 'dealer'), mkMember('s1', 'Trigger', 'shooter')];
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

  it('offers dealer, recruit, shooter and driver as drivers, but only shooters as passengers', () => {
    mockMembers = [
      ...mockMembers,
      mkMember('r1', 'New Recruit', 'recruit'),
      mkMember('x1', 'Heavy', 'enforcer'),
      mkMember('l1', 'Watch', 'lookout'),
      mkMember('v1', 'Wheel Specialist', 'driver'),
    ];
    render(<CarCrewSelector onConfirm={() => {}} onCancel={() => {}} />);
    fireEvent.click(screen.getByText('Driver', { selector: '.seat-label' }).closest('.car-seat')!);
    for (const name of ['Wheel Man', 'Trigger', 'New Recruit', 'Wheel Specialist']) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    expect(screen.queryByText('Heavy')).not.toBeInTheDocument();
    expect(screen.queryByText('Watch')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Passenger (Shooter)', { selector: '.seat-label' }).closest('.car-seat')!);
    expect(screen.getByText('Trigger')).toBeInTheDocument();
    for (const name of ['Wheel Man', 'New Recruit', 'Heavy', 'Watch', 'Wheel Specialist']) {
      expect(screen.queryByText(name)).not.toBeInTheDocument();
    }
  });

  it('lets a shooter drive without counting them as the passenger shooter', () => {
    mockMembers = [...mockMembers, mkMember('s2', 'Second Shooter', 'shooter')];
    const onConfirm = vi.fn();
    render(<CarCrewSelector onConfirm={onConfirm} onCancel={() => {}} />);
    fireEvent.click(screen.getByText('Driver', { selector: '.seat-label' }).closest('.car-seat')!);
    fireEvent.click(screen.getByText('Trigger'));
    expect(screen.getByRole('button', { name: /need driver.*shooter/i })).toBeDisabled();
    fireEvent.click(screen.getByText('Passenger (Shooter)', { selector: '.seat-label' }).closest('.car-seat')!);
    expect(screen.queryByText('Trigger', { selector: '.picker-name' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Second Shooter'));
    fireEvent.click(screen.getByRole('button', { name: /slide on they block/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0].seats.map((seat: { memberId: string | null }) => seat.memberId)).toEqual(['s1', 's2', null, null]);
  });

  it('refuses a now-injured or changed-role passenger before launch', () => {
    const onConfirm = vi.fn();
    const { rerender } = render(<CarCrewSelector onConfirm={onConfirm} onCancel={() => {}} />);
    fireEvent.click(screen.getByText('Driver', { selector: '.seat-label' }).closest('.car-seat')!);
    fireEvent.click(screen.getByText('Wheel Man'));
    fireEvent.click(screen.getByText('Passenger (Shooter)', { selector: '.seat-label' }).closest('.car-seat')!);
    fireEvent.click(screen.getByText('Trigger'));
    mockMembers = mockMembers.map(m => m.id === 's1' ? { ...m, role: 'dealer', status: 'injured' } : m);
    rerender(<CarCrewSelector onConfirm={onConfirm} onCancel={() => {}} />);
    expect(screen.getByRole('button', { name: /need driver.*shooter/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /need driver.*shooter/i }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('shows the member portrait first, and labels role art when identity is missing', () => {
    mockMembers = [
      { ...mkMember('d1', 'Wheel Man', 'dealer'), customAvatarUrl: '/private/member-portrait.webp' },
      mkMember('s1', 'Trigger', 'shooter'),
    ];
    render(<CarCrewSelector onConfirm={() => {}} onCancel={() => {}} />);
    fireEvent.click(screen.getByText('Driver', { selector: '.seat-label' }).closest('.car-seat')!);
    expect(screen.getAllByRole('img', { name: /wheel man.*portrait/i })[0]).toHaveAttribute('src', '/private/member-portrait.webp');
    fireEvent.click(screen.getByText('Wheel Man'));
    expect(within(screen.getByRole('button', { name: /remove wheel man from driver/i })).getByRole('img', { name: /wheel man.*portrait/i })).toHaveAttribute('src', '/private/member-portrait.webp');
    fireEvent.click(screen.getByText('Passenger (Shooter)', { selector: '.seat-label' }).closest('.car-seat')!);
    expect(screen.getAllByText(/role portrait.*not member likeness/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('img', { name: /shooter.*role portrait/i })).toHaveAttribute('src', expect.stringMatching(/\.webp$/));
  });

  it('visibly labels role art when a stored personal portrait fails to load', () => {
    mockMembers = [
      { ...mkMember('d1', 'Wheel Man', 'dealer'), customAvatarUrl: '/private/broken-member.webp' },
      mkMember('s1', 'Trigger', 'shooter'),
    ];
    render(<CarCrewSelector onConfirm={() => {}} onCancel={() => {}} />);
    fireEvent.click(screen.getByText('Driver', { selector: '.seat-label' }).closest('.car-seat')!);
    fireEvent.error(screen.getByRole('img', { name: 'Wheel Man portrait' }));
    expect(within(screen.getByRole('button', { name: /wheel man/i })).getByText('Role portrait — not member likeness')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Wheel Man'));
    expect(within(screen.getByRole('region', { name: /member status and carried items/i })).getByText('Role portrait — not member likeness')).toBeInTheDocument();
  });

  it('shows actual carried inventory and core member stats without inventing a weapon or cash', () => {
    mockMembers = [{
      ...mkMember('d1', 'Wheel Man', 'dealer'), level: 4, health: 73, morale: 65, loyalty: 91,
      inventory: [{ itemId: 'kit-1', type: 'tool', name: 'Field kit', quantity: 2 }],
    }, mkMember('s1', 'Trigger', 'shooter')];
    render(<CarCrewSelector onConfirm={() => {}} onCancel={() => {}} />);
    fireEvent.click(screen.getByText('Driver', { selector: '.seat-label' }).closest('.car-seat')!);
    fireEvent.click(screen.getByText('Wheel Man'));
    expect(screen.getByText('Field kit').closest('li')).toHaveTextContent('Field kit×2');
    expect(screen.getByText('73 · max not recorded')).toBeInTheDocument();
    expect(screen.getByText(/65\/100/)).toBeInTheDocument();
    expect(screen.getByText(/91\/100/)).toBeInTheDocument();
    expect(screen.queryByText(/Glock|\$200/)).not.toBeInTheDocument();
  });

  it('loads registered desktop and phone car plates through the scene picture', () => {
    const { container } = render(<CarCrewSelector onConfirm={() => {}} onCancel={() => {}} />);
    expect(container.querySelector('.ccs-scene img')).toHaveAttribute('src',
      '/assets/runtime/generated/environments/street/block_slide_car_loadout_desktop_v001.webp');
    expect(container.querySelector('.ccs-scene source')).toHaveAttribute('srcset',
      '/assets/runtime/generated/environments/street/block_slide_car_loadout_mobile_v001.webp');
  });

  it('does not invent full health or gear when the roster has no health record', () => {
    render(<CarCrewSelector onConfirm={() => {}} onCancel={() => {}} />);
    fireEvent.click(screen.getByText('Driver', { selector: '.seat-label' }).closest('.car-seat')!);
    fireEvent.click(screen.getByText('Wheel Man'));
    expect(screen.getByText('Not recorded')).toBeInTheDocument();
    expect(screen.getByText('Carried items not recorded')).toBeInTheDocument();
    expect(screen.queryByText(/100\s*\/\s*100/)).not.toBeInTheDocument();
  });
});
