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
import { getCharacterForRole } from './assetResolver';

const API_BASE: string = (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_API_URL : undefined) ?? 'http://localhost:5000';

// Offline previews use the existing registered character kits.
function buildMockAsset(req: AvatarGenerateRequest): GeneratedMemberAsset {
  const role = req.role;
  const stock = getCharacterForRole(role);
  return {
    id: `mock-${Date.now()}`,
    role,
    style: req.style,
    outputs: req.outputs,
    portraitUrl:  req.outputs.includes('portrait') ? stock.portrait : undefined,
    fullbodyUrl:  req.outputs.includes('fullbody')  ? stock.fullbody  : undefined,
    topdownUrl:   req.outputs.includes('topdown')   ? stock.topdown   : undefined,
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
