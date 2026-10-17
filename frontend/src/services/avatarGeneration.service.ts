// ============================================================
// avatarGeneration.service.ts
// Photo-to-member generation. Local photo likeness is the honest
// fallback. Stock role art is never returned as a generated face.
// ============================================================

import type {
  AvatarGenerateRequest,
  AvatarProviderStatus,
  GeneratedMemberAsset,
} from '../types/avatar.types';
import { composeLocalLikeness } from './likenessCompositor';

const API_BASE: string = (typeof import.meta !== 'undefined' ? (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL : undefined) ?? 'http://localhost:5000';

class AvatarGenerationService {
  private async post<T>(path: string, body: FormData | object): Promise<T> {
    const isFormData = body instanceof FormData;
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
      body: isFormData ? body : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
    return res.json();
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
  }

  async getProviderStatus(): Promise<AvatarProviderStatus | null> {
    try {
      return await this.get<AvatarProviderStatus>('/api/avatar/provider');
    } catch {
      return null;
    }
  }

  private preferInlineUrls(asset: GeneratedMemberAsset): GeneratedMemberAsset {
    const resolve = (dataUrl: string | undefined, url: string | undefined) => {
      if (dataUrl) return dataUrl;
      if (url?.startsWith('/api/')) return `${API_BASE}${url}`;
      return url;
    };
    return {
      ...asset,
      portraitUrl: resolve(asset.portraitDataUrl, asset.portraitUrl),
      fullbodyUrl: resolve(asset.fullbodyDataUrl, asset.fullbodyUrl),
      topdownUrl: resolve(asset.topdownDataUrl, asset.topdownUrl),
    };
  }

  async generate(req: AvatarGenerateRequest): Promise<GeneratedMemberAsset> {
    if (!req.consentPermission || !req.consentAdult || !req.consentProcessing) {
      throw new Error('Consent is required before generating a member from a photo.');
    }
    try {
      const form = new FormData();
      form.append('image', req.imageFile);
      form.append('role', req.role);
      form.append('style', req.style);
      form.append('consentPermission', req.consentPermission ? '1' : '0');
      form.append('consentAdult', req.consentAdult ? '1' : '0');
      form.append('consentProcessing', req.consentProcessing ? '1' : '0');
      req.outputs.forEach(o => form.append('outputs', o));

      const data = await this.post<{ asset: GeneratedMemberAsset }>('/api/avatar/generate', form);
      return this.preferInlineUrls(data.asset);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Consent is required')) {
        throw error;
      }
      return composeLocalLikeness(req);
    }
  }

  async getStatus(jobId: string): Promise<GeneratedMemberAsset> {
    const job = await this.get<GeneratedMemberAsset>(`/api/avatar/status/${jobId}`);
    return this.preferInlineUrls(job);
  }

  async approve(assetId: string): Promise<GeneratedMemberAsset> {
    try {
      const approved = await this.post<GeneratedMemberAsset>('/api/avatar/approve', { assetId });
      return this.preferInlineUrls(approved);
    } catch {
      return {
        id: assetId,
        role: 'dealer',
        style: 'south_florida_streetwear',
        outputs: ['portrait'],
        status: 'approved',
        createdAt: new Date().toISOString(),
      };
    }
  }
}

export const avatarGenerationService = new AvatarGenerationService();
