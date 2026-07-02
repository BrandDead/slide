// ============================================================
// avatarGeneration.service.ts
// Frontend service for the photo-to-member generation pipeline.
// Calls backend /api/avatar/* endpoints.
// Falls back to mock data when backend is unavailable.
// Sprint: morale-heat-photo-batch2
// ============================================================

import type {
  AvatarGenerateRequest,
  GeneratedMemberAsset,
} from '../types/avatar.types';

const API_BASE: string = (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_API_URL : undefined) ?? 'http://localhost:5000';

// ─── Mock assets (used when backend is offline) ──────────────
const MOCK_PORTRAITS: Record<string, string> = {
  dealer:   '/assets/generated/characters/portraits/character_dealer_male_blacktee_portrait_v001.png',
  enforcer: '/assets/generated/characters/portraits/character_enforcer_male_portrait_v001.png',
  lookout:  '/assets/generated/characters/portraits/character_lookout_female_portrait_v001.png',
  driver:   '/assets/generated/characters/portraits/character_driver_male_portrait_v001.png',
};

const MOCK_FULLBODY: Record<string, string> = {
  dealer:   '/assets/generated/characters/fullbody/character_dealer_male_blacktee_fullbody_front_v001.png',
  enforcer: '/assets/generated/characters/fullbody/character_enforcer_male_fullbody_front_v001.png',
  lookout:  '/assets/generated/characters/fullbody/character_lookout_female_fullbody_front_v001.png',
  driver:   '/assets/generated/characters/fullbody/character_driver_male_fullbody_front_v001.png',
};

const MOCK_TOPDOWN: Record<string, string> = {
  dealer:   '/assets/generated/characters/topdown/character_dealer_male_blacktee_topdown_v001.png',
  enforcer: '/assets/generated/characters/topdown/character_enforcer_male_topdown_v001.png',
};

function buildMockAsset(req: AvatarGenerateRequest): GeneratedMemberAsset {
  const role = req.role;
  return {
    id: `mock-${Date.now()}`,
    role,
    style: req.style,
    outputs: req.outputs,
    portraitUrl:  req.outputs.includes('portrait') ? (MOCK_PORTRAITS[role] ?? MOCK_PORTRAITS.dealer) : undefined,
    fullbodyUrl:  req.outputs.includes('fullbody')  ? (MOCK_FULLBODY[role]  ?? MOCK_FULLBODY.dealer)  : undefined,
    topdownUrl:   req.outputs.includes('topdown')   ? (MOCK_TOPDOWN[role]   ?? MOCK_TOPDOWN.dealer)   : undefined,
    promptUsed: `Mock prompt for ${role} in ${req.style} style.`,
    status: 'ready',
    createdAt: new Date().toISOString(),
  };
}

// ─── Service ─────────────────────────────────────────────────

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

  /**
   * Submit a generation job.
   * Falls back to mock if the backend is unreachable.
   */
  async generate(req: AvatarGenerateRequest): Promise<GeneratedMemberAsset> {
    try {
      const form = new FormData();
      form.append('image', req.imageFile);
      form.append('role', req.role);
      form.append('style', req.style);
      req.outputs.forEach(o => form.append('outputs', o));

      const data = await this.post<{ asset: GeneratedMemberAsset }>('/api/avatar/generate', form);
      return data.asset;
    } catch {
      // Backend offline — return mock immediately
      console.warn('[AvatarService] Backend unavailable, using mock assets.');
      return buildMockAsset(req);
    }
  }

  /**
   * Poll generation status.
   */
  async getStatus(jobId: string): Promise<GeneratedMemberAsset> {
    try {
      return await this.get<GeneratedMemberAsset>(`/api/avatar/status/${jobId}`);
    } catch {
      // Return a mock ready state
      return {
        id: jobId,
        role: 'dealer',
        style: 'south_florida_streetwear',
        outputs: ['portrait'],
        status: 'ready',
        createdAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Approve a generated asset and save it to the roster.
   */
  async approve(assetId: string): Promise<GeneratedMemberAsset> {
    try {
      return await this.post<GeneratedMemberAsset>('/api/avatar/approve', { assetId });
    } catch {
      // Mock approval — just return the asset as-is
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
