import { describe, expect, it } from 'vitest';
import { composeLocalLikeness, isStockPreview } from '../likenessCompositor';
import type { GeneratedMemberAsset } from '../../types/avatar.types';

describe('likenessCompositor', () => {
  it('embeds the uploaded photo in every requested card', async () => {
    const file = new File(['face-bytes'], 'friend.png', { type: 'image/png' });
    const asset = await composeLocalLikeness({
      imageFile: file,
      role: 'shooter',
      style: 'masked_tactical',
      outputs: ['portrait', 'fullbody', 'topdown'],
      consentPermission: true,
      consentAdult: true,
      consentProcessing: true,
    });
    const payload = 'ZmFjZS1ieXRlcw'; // base64('face-bytes')
    expect(asset.portraitUrl).toContain(payload);
    expect(asset.fullbodyUrl).toContain(payload);
    expect(asset.topdownUrl).toContain(payload);
    expect(isStockPreview(asset)).toBe(false);
  });

  it('treats runtime stock paths as a stock preview', () => {
    const asset: GeneratedMemberAsset = {
      id: 'x',
      role: 'dealer',
      style: 'south_florida_streetwear',
      outputs: ['portrait'],
      portraitUrl: '/assets/runtime/characters/portraits/character_dealer.png',
      status: 'ready',
      createdAt: new Date(0).toISOString(),
    };
    expect(isStockPreview(asset)).toBe(true);
  });
});
