// Local photo-likeness compositor used when the backend is unreachable.
// It never substitutes stock role art. The uploaded photo is the identity.

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

function fullbodyCard(photo: string, role: string, style: string): string {
  const accent = ROLE_COLOR[role] ?? '#4ade80';
  return svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="768" viewBox="0 0 512 768">
  <rect width="512" height="768" fill="#0a0a0f"/>
  <rect x="0" y="520" width="512" height="248" fill="#101218"/>
  <rect x="178" y="268" width="156" height="210" rx="16" fill="#242428"/>
  <rect x="188" y="470" width="52" height="170" rx="10" fill="#1a1c24"/>
  <rect x="272" y="470" width="52" height="170" rx="10" fill="#1a1c24"/>
  <circle cx="256" cy="196" r="92" fill="#111"/>
  <clipPath id="head"><circle cx="256" cy="196" r="88"/></clipPath>
  <image href="${escapeXml(photo)}" x="164" y="104" width="184" height="184" preserveAspectRatio="xMidYMin slice" clip-path="url(#head)"/>
  <rect x="14" y="14" width="484" height="740" fill="none" stroke="${accent}" stroke-width="4"/>
  <text x="256" y="724" text-anchor="middle" fill="${accent}" font-family="sans-serif" font-size="18">${escapeXml(role)} · ${escapeXml(style.split('_').join(' '))}</text>
</svg>`);
}

function topdownToken(photo: string, role: string): string {
  const accent = ROLE_COLOR[role] ?? '#4ade80';
  return svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <circle cx="128" cy="128" r="120" fill="#0a0a0f" stroke="${accent}" stroke-width="12"/>
  <clipPath id="face"><circle cx="128" cy="128" r="104"/></clipPath>
  <image href="${escapeXml(photo)}" x="24" y="24" width="208" height="208" preserveAspectRatio="xMidYMin slice" clip-path="url(#face)"/>
</svg>`);
}

export async function composeLocalLikeness(
  req: AvatarGenerateRequest,
): Promise<GeneratedMemberAsset> {
  const photo = await readFileAsDataUrl(req.imageFile);
  const outputs = req.outputs;
  const asset: GeneratedMemberAsset = {
    id: `likeness-local-${Date.now()}`,
    role: req.role,
    style: req.style,
    outputs,
    status: 'ready',
    createdAt: new Date().toISOString(),
    provider: 'local_photo_likeness_offline',
    stockPreview: false,
    sourcePhotoRetained: false,
    likenessTraits: {
      skinTone: 'from_photo',
      hairColor: 'from_photo',
      facialHair: 'from_photo',
      clothingColors: [],
      notes: ['Offline compositor used the uploaded photo as identity.'],
    },
    promptUsed: 'Local photo-based likeness. Backend unavailable; no stock role art.',
  };

  const assign = (output: AvatarOutput, url: string) => {
    if (output === 'portrait') asset.portraitUrl = url;
    if (output === 'fullbody') asset.fullbodyUrl = url;
    if (output === 'topdown') asset.topdownUrl = url;
  };

  if (outputs.includes('portrait')) assign('portrait', portraitCard(photo, req.role));
  if (outputs.includes('fullbody')) assign('fullbody', fullbodyCard(photo, req.role, req.style));
  if (outputs.includes('topdown')) assign('topdown', topdownToken(photo, req.role));
  return asset;
}

export function isStockPreview(asset: GeneratedMemberAsset | null | undefined): boolean {
  if (!asset) return false;
  if (asset.stockPreview) return true;
  if (asset.id.startsWith('mock-')) return true;
  const urls = [asset.portraitUrl, asset.fullbodyUrl, asset.topdownUrl].filter(Boolean) as string[];
  return urls.some(url => url.startsWith('/assets/runtime/') || url.includes('/assets/generated/characters/'));
}
