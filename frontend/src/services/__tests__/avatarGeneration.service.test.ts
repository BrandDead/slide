import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { avatarGenerationService } from '../avatarGeneration.service';

afterEach(() => vi.unstubAllGlobals());

describe('offline photo preview', () => {
  it('returns loadable registered stock art for every recruit role', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    for (const role of ['dealer', 'shooter', 'driver', 'enforcer', 'lookout', 'runner', 'chemist'] as const) {
      const asset = await avatarGenerationService.generate({
        imageFile: new File(['source'], 'fictional.webp', { type: 'image/webp' }),
        role,
        style: 'south_florida_streetwear',
        outputs: ['portrait', 'fullbody', 'topdown'],
      });
      expect(asset.id).toMatch(/^mock-/);
      for (const url of [asset.portraitUrl, asset.fullbodyUrl, asset.topdownUrl]) {
        expect(url).toMatch(/^\/assets\/runtime\//);
        expect(existsSync(resolve('public', `.${url}`))).toBe(true);
      }
    }
  });

  it('keeps unrequested outputs absent in the offline preview', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    const asset = await avatarGenerationService.generate({
      imageFile: new File(['source'], 'fictional.webp', { type: 'image/webp' }),
      role: 'dealer', style: 'luxury_noir', outputs: ['portrait'],
    });
    expect(asset.portraitUrl).toBeTruthy();
    expect(asset.fullbodyUrl).toBeUndefined();
    expect(asset.topdownUrl).toBeUndefined();
  });
});
