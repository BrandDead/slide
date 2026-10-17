import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { avatarGenerationService } from '../avatarGeneration.service';
import { isStockPreview } from '../likenessCompositor';

afterEach(() => vi.unstubAllGlobals());

const consents = {
  consentPermission: true,
  consentAdult: true,
  consentProcessing: true,
};

describe('offline photo likeness', () => {
  it('uses the uploaded photo crop and never invents a vector body when the backend is down', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    for (const role of ['dealer', 'shooter', 'driver', 'enforcer', 'lookout', 'runner', 'chemist'] as const) {
      const asset = await avatarGenerationService.generate({
        imageFile: new File(['source'], 'friend.webp', { type: 'image/webp' }),
        role,
        style: 'south_florida_streetwear',
        outputs: ['portrait', 'fullbody', 'topdown'],
        ...consents,
      });
      expect(asset.id).toMatch(/^likeness-local-/);
      expect(asset.provider).toBe('photo_crop_offline');
      expect(asset.stockPreview).toBe(false);
      expect(asset.bodyLocked).toBe(true);
      expect(isStockPreview(asset)).toBe(false);
      expect(asset.portraitUrl).toMatch(/^data:image\/svg\+xml/);
      expect(asset.portraitUrl).not.toMatch(/^\/assets\/runtime\//);
      expect(asset.fullbodyUrl).toBeUndefined();
      expect(asset.topdownUrl).toBeUndefined();
      expect(existsSync(resolve('public', `.${asset.portraitUrl ?? ''}`))).toBe(false);
    }
  });

  it('keeps unrequested outputs absent in the offline likeness', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    const asset = await avatarGenerationService.generate({
      imageFile: new File(['source'], 'friend.webp', { type: 'image/webp' }),
      role: 'dealer', style: 'luxury_noir', outputs: ['portrait'],
      ...consents,
    });
    expect(asset.portraitUrl).toBeTruthy();
    expect(asset.fullbodyUrl).toBeUndefined();
    expect(asset.topdownUrl).toBeUndefined();
    expect(asset.bodyLocked).toBe(true);
  });

  it('keeps inline portrait bytes after approve so roster cards do not 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'job-1',
        role: 'dealer',
        style: 'south_florida_streetwear',
        outputs: ['portrait'],
        status: 'approved',
        createdAt: new Date(0).toISOString(),
        portraitUrl: '/api/avatar/asset/job-1/portrait',
        portraitDataUrl: 'data:image/png;base64,abc',
        bodyLocked: true,
      }),
      text: async () => '',
    }));
    const approved = await avatarGenerationService.approve('job-1');
    expect(approved.portraitUrl).toBe('data:image/png;base64,abc');
    expect(approved.bodyLocked).toBe(true);
  });

  it('refuses to generate without the three consent flags', async () => {
    await expect(avatarGenerationService.generate({
      imageFile: new File(['source'], 'friend.webp', { type: 'image/webp' }),
      role: 'dealer',
      style: 'south_florida_streetwear',
      outputs: ['portrait'],
      consentPermission: false,
      consentAdult: true,
      consentProcessing: true,
    })).rejects.toThrow(/consent/i);
  });
});
