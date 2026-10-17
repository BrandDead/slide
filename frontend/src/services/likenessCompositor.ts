// Offline photo-crop compositor used when the backend is unreachable.
// It never substitutes stock role art and never invents a vector body.

import type {
  AvatarGenerateRequest,
  AvatarOutput,
  GeneratedMemberAsset,
} from '../types/avatar.types';

const ROLE_COLOR: Record<string, string> = {
  dealer: '#4ade80',
  shooter: '#f87171',
  driver: '#60a5fa',
  enforcer: '#fb923c',
  lookout: '#a78bfa',
  runner: '#facc15',
  chemist: '#2dd4bf',
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the photo.'));
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Could not read the photo.'));
    };
    reader.readAsDataURL(file);
  });
}

function svgDataUrl(markup: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(markup)}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function portraitCard(photo: string, role: string): string {
  const accent = ROLE_COLOR[role] ?? '#4ade80';
  return svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="640" viewBox="0 0 512 640">
  <rect width="512" height="640" fill="#0a0a0f"/>
  <image href="${escapeXml(photo)}" x="16" y="16" width="480" height="608" preserveAspectRatio="xMidYMin slice"/>
  <rect x="10" y="10" width="492" height="620" fill="none" stroke="${accent}" stroke-width="6"/>
  <rect x="0" y="560" width="512" height="80" fill="url(#fade)"/>
  <defs>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0a0a0f" stop-opacity="0"/>
      <stop offset="1" stop-color="#0a0a0f" stop-opacity="0.72"/>
    </linearGradient>
  </defs>
</svg>`);
}

export async function composeLocalLikeness(
  req: AvatarGenerateRequest,
): Promise<GeneratedMemberAsset> {
  const photo = await readFileAsDataUrl(req.imageFile);
  const outputs: AvatarOutput[] = req.outputs.includes('portrait')
    ? req.outputs
    : ['portrait', ...req.outputs];
  return {
    id: `likeness-local-${Date.now()}`,
    role: req.role,
    style: req.style,
    outputs,
    status: 'ready',
    createdAt: new Date().toISOString(),
    provider: 'photo_crop_offline',
    stockPreview: false,
    sourcePhotoRetained: false,
    bodyLocked: true,
    portraitUrl: portraitCard(photo, req.role),
    likenessTraits: {
      skinTone: 'from_photo',
      hairColor: 'from_photo',
      facialHair: 'from_photo',
      clothingColors: [],
      notes: ['Offline photo crop used the uploaded photo. Body stays locked until GPT Image is configured.'],
    },
    promptUsed: 'Offline photo crop. GPT Image unavailable; no vector body and no stock role art.',
  };
}

export function isStockPreview(asset: GeneratedMemberAsset | null | undefined): boolean {
  if (!asset) return false;
  if (asset.stockPreview) return true;
  if (asset.id.startsWith('mock-')) return true;
  const urls = [asset.portraitUrl, asset.fullbodyUrl, asset.topdownUrl].filter(Boolean) as string[];
  return urls.some(url => url.startsWith('/assets/runtime/') || url.includes('/assets/generated/characters/'));
}
