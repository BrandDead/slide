import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import PhotoMemberCreator from '../PhotoMemberCreator';
import { useGangStore } from '../../../stores/gameStore';
import { avatarGenerationService } from '../../../services/avatarGeneration.service';
import type { GeneratedMemberAsset } from '../../../types/avatar.types';

vi.mock('../../../services/avatarGeneration.service', () => ({
  avatarGenerationService: {
    generate: vi.fn(),
    getStatus: vi.fn(),
    approve: vi.fn(),
  },
}));

const service = vi.mocked(avatarGenerationService);

function asset(overrides: Partial<GeneratedMemberAsset> = {}): GeneratedMemberAsset {
  return {
    id: 'asset-1',
    role: 'dealer',
    style: 'south_florida_streetwear',
    outputs: ['portrait', 'fullbody', 'topdown'],
    portraitUrl: '/generated/asset-1-portrait.png',
    fullbodyUrl: '/generated/asset-1-fullbody.png',
    topdownUrl: '/generated/asset-1-topdown.png',
    status: 'ready',
    createdAt: new Date(0).toISOString(),
    ...overrides,
  };
}

/** The approve fallback shape from avatarGeneration.service (no URLs). */
function approveFallback(id: string): GeneratedMemberAsset {
  return {
    id,
    role: 'dealer',
    style: 'south_florida_streetwear',
    outputs: ['portrait'],
    status: 'approved',
    createdAt: new Date(0).toISOString(),
  };
}

function photo(name = 'friend.png') {
  return new File(['img'], name, { type: 'image/png' });
}

function fileInput(container: HTMLElement) {
  return container.querySelector('input[type="file"]') as HTMLInputElement;
}

function upload(container: HTMLElement, file = photo()) {
  fireEvent.change(fileInput(container), { target: { files: [file] } });
}

function consent() {
  fireEvent.click(screen.getByRole('checkbox'));
}

function typeName(value: string) {
  fireEvent.change(screen.getByLabelText('Member name'), { target: { value } });
}

function generateButton() {
  return screen.getByRole('button', { name: /generate member/i });
}

describe('PhotoMemberCreator', () => {
  let objectUrlCount = 0;

  beforeEach(() => {
    objectUrlCount = 0;
    vi.clearAllMocks();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => `blob:preview-${++objectUrlCount}`),
    });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    useGangStore.setState(state => ({ ...state, members: [], contacts: [] }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts generation when the name is typed after the photo and consent', async () => {
    service.generate.mockResolvedValue(asset());
    const { container } = render(<PhotoMemberCreator onClose={vi.fn()} />);

    // Follow the on-screen order: 1. photo + consent, 2. name.
    upload(container);
    consent();
    typeName('Jay');

    expect(generateButton()).not.toBeDisabled();
    await act(async () => {
      fireEvent.click(generateButton());
    });

    expect(service.generate).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('button', { name: /add to roster/i })).toBeInTheDocument();
  });

  it('keeps polling a queued job when the photo is replaced mid-generation', async () => {
    vi.useFakeTimers();
    service.generate.mockResolvedValue(asset({
      id: 'job-1',
      status: 'queued',
      portraitUrl: undefined,
      fullbodyUrl: undefined,
      topdownUrl: undefined,
    }));
    service.getStatus.mockResolvedValue(asset({ id: 'job-1', status: 'ready' }));
    const { container } = render(<PhotoMemberCreator onClose={vi.fn()} />);

    typeName('Jay');
    upload(container);
    consent();
    await act(async () => {
      fireEvent.click(generateButton());
    });
    expect(screen.getByText(/generating assets/i)).toBeInTheDocument();

    upload(container, photo('replacement.png'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(service.getStatus).toHaveBeenCalledWith('job-1');
    expect(screen.getByRole('button', { name: /add to roster/i })).toBeInTheDocument();
  });

  it('does not add a member whose name was cleared after generation', async () => {
    service.generate.mockResolvedValue(asset());
    service.approve.mockResolvedValue(approveFallback('asset-1'));
    const { container } = render(<PhotoMemberCreator onClose={vi.fn()} />);

    typeName('Jay');
    upload(container);
    consent();
    await act(async () => {
      fireEvent.click(generateButton());
    });
    const addButton = await screen.findByRole('button', { name: /add to roster/i });

    typeName(' ');
    await act(async () => {
      fireEvent.click(addButton);
    });

    expect(service.approve).not.toHaveBeenCalled();
    expect(useGangStore.getState().members).toHaveLength(0);
  });

  it('adds one complete member and keeps generated art through the approve fallback', async () => {
    service.generate.mockResolvedValue(asset());
    service.approve.mockResolvedValue(approveFallback('asset-1'));
    const onApproved = vi.fn();
    const onClose = vi.fn();
    const { container } = render(<PhotoMemberCreator onClose={onClose} onApproved={onApproved} />);

    typeName('  Jay  ');
    upload(container);
    consent();
    fireEvent.click(screen.getByRole('button', { name: /shooter/i }));
    await act(async () => {
      fireEvent.click(generateButton());
    });
    const addButton = await screen.findByRole('button', { name: /add to roster/i });

    // A double tap must not recruit the same member twice.
    await act(async () => {
      fireEvent.click(addButton);
      fireEvent.click(addButton);
    });

    const { members, contacts } = useGangStore.getState();
    expect(service.approve).toHaveBeenCalledTimes(1);
    expect(members).toHaveLength(1);
    const [member] = members;
    expect(member).toMatchObject({
      name: 'Jay',
      role: 'shooter',
      status: 'active',
      level: 1,
      experience: 0,
      health: 100,
      maxHealth: 100,
      currentAssignment: null,
      avatarUrl: '/generated/asset-1-portrait.png',
      customAvatarUrl: '/generated/asset-1-portrait.png',
      portraitUrl: '/generated/asset-1-portrait.png',
      fullbodyUrl: '/generated/asset-1-fullbody.png',
      topdownUrl: '/generated/asset-1-topdown.png',
    });
    expect(typeof member.morale).toBe('number');
    expect(typeof member.gangId).toBe('string');
    expect(member.stats).toEqual(expect.objectContaining({
      strength: expect.any(Number),
      agility: expect.any(Number),
      intelligence: expect.any(Number),
      charisma: expect.any(Number),
      luck: expect.any(Number),
      intimidation: expect.any(Number),
    }));
    expect(contacts).toHaveLength(1);
    expect(contacts[0].customAvatarUrl).toBe('/generated/asset-1-portrait.png');
    expect(onApproved).toHaveBeenCalledWith(member.id);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
