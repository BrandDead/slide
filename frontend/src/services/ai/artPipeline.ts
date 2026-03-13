// ============================================================
// AI Art Pipeline - Avatar & Asset Generation Service
// Manages AI-generated art for characters, items, and scenes
// Supports: Banana Nano, Midjourney (via API), DALL-E (icons only)
// ============================================================

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export type ArtStyle = 'gta_realistic' | 'topdown_pixel' | 'icon_flat' | 'portrait_realistic';
export type AssetType = 'headshot' | 'fullbody' | 'topdown_sprite' | 'weapon_icon' | 'drug_icon' | 'scene_bg' | 'car_topdown';

export interface ArtRequest {
  id: string;
  type: AssetType;
  style: ArtStyle;
  prompt: string;
  referenceImageUrl?: string;
  width: number;
  height: number;
  metadata: Record<string, any>;
}

export interface GeneratedAsset {
  id: string;
  requestId: string;
  type: AssetType;
  url: string;
  thumbnailUrl: string;
  prompt: string;
  createdAt: string;
  metadata: Record<string, any>;
}

export interface AvatarConfig {
  gender: 'male' | 'female';
  skinTone: string;
  hairStyle: string;
  hairColor: string;
  clothing: {
    top: string;
    bottom: string;
    shoes: string;
    outerwear?: string;
  };
  accessories: string[];
  weapons: string[];
  expression: string;
  pose: string;
  gangColor?: string;
}

// ═══════════════════════════════════════════════════════════
// PROMPT BUILDERS
// ═══════════════════════════════════════════════════════════

const STYLE_PREFIXES: Record<ArtStyle, string> = {
  gta_realistic: 'GTA V loading screen art style, hyper-realistic digital painting, cinematic lighting, urban street photography aesthetic',
  topdown_pixel: 'Top-down view, pixel art style, 32x32 sprite, clean outlines, game asset',
  icon_flat: 'Flat design icon, clean vector style, solid colors, game UI asset, transparent background',
  portrait_realistic: 'Realistic portrait photography style, studio lighting, sharp focus, character portrait',
};

const NEGATIVE_PROMPT = 'blurry, low quality, distorted, deformed, ugly, watermark, text overlay, cartoon (unless specified), anime';

export function buildHeadshotPrompt(config: AvatarConfig): string {
  const parts = [
    STYLE_PREFIXES.gta_realistic,
    `${config.gender} character portrait, headshot, front-facing`,
    `${config.skinTone} skin tone`,
    `${config.hairStyle} ${config.hairColor} hair`,
    `wearing ${config.clothing.top}`,
    config.accessories.length > 0 ? `accessories: ${config.accessories.join(', ')}` : '',
    `${config.expression} expression`,
    config.gangColor ? `gang color accent: ${config.gangColor}` : '',
    'urban background, street setting, dramatic lighting',
  ];
  return parts.filter(Boolean).join(', ');
}

export function buildFullBodyPrompt(config: AvatarConfig): string {
  const parts = [
    STYLE_PREFIXES.gta_realistic,
    `full body ${config.gender} character, standing pose`,
    `${config.skinTone} skin tone`,
    `${config.hairStyle} ${config.hairColor} hair`,
    `wearing ${config.clothing.top}, ${config.clothing.bottom}, ${config.clothing.shoes}`,
    config.clothing.outerwear ? `outerwear: ${config.clothing.outerwear}` : '',
    config.accessories.length > 0 ? `accessories: ${config.accessories.join(', ')}` : '',
    config.weapons.length > 0 ? `holding/carrying: ${config.weapons.join(', ')}` : '',
    `${config.pose} pose, ${config.expression} expression`,
    config.gangColor ? `gang color accent: ${config.gangColor}` : '',
    'urban street background, full body visible from head to shoes',
  ];
  return parts.filter(Boolean).join(', ');
}

export function buildTopDownSpritePrompt(config: AvatarConfig): string {
  const parts = [
    STYLE_PREFIXES.topdown_pixel,
    `top-down ${config.gender} character sprite`,
    `${config.skinTone} skin`,
    `wearing ${config.clothing.top}, ${config.clothing.bottom}`,
    config.weapons.length > 0 ? `holding ${config.weapons[0]}` : '',
    'game character sprite, transparent background',
  ];
  return parts.filter(Boolean).join(', ');
}

export function buildDrugIconPrompt(drugName: string, drugType: string): string {
  return `${STYLE_PREFIXES.icon_flat}, ${drugName} drug icon, ${drugType} substance, game item icon, detailed, clean design, dark background`;
}

export function buildWeaponIconPrompt(weaponName: string): string {
  return `${STYLE_PREFIXES.icon_flat}, ${weaponName} weapon icon, realistic gun illustration, game item, side view, clean design, dark background`;
}

export function buildScenePrompt(sceneType: string, details: string): string {
  return `${STYLE_PREFIXES.gta_realistic}, ${sceneType} scene, ${details}, urban environment, cinematic composition`;
}

export function buildClientAvatarPrompt(clientType: string, symptoms: string[]): string {
  const symptomDesc = symptoms.length > 0 ? `showing symptoms: ${symptoms.join(', ')}` : '';
  return `${STYLE_PREFIXES.gta_realistic}, ${clientType} character portrait, headshot, ${symptomDesc}, urban street setting, looking at viewer`;
}

// ═══════════════════════════════════════════════════════════
// ASSET CACHE (Local Storage)
// ═══════════════════════════════════════════════════════════

const CACHE_KEY = 'slide_art_cache';

export function getCachedAsset(promptHash: string): GeneratedAsset | null {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    return cache[promptHash] || null;
  } catch {
    return null;
  }
}

export function cacheAsset(promptHash: string, asset: GeneratedAsset): void {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    cache[promptHash] = asset;
    // Keep cache under 100 items
    const keys = Object.keys(cache);
    if (keys.length > 100) {
      delete cache[keys[0]];
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Silently fail on storage errors
  }
}

export function hashPrompt(prompt: string): string {
  let hash = 0;
  for (let i = 0; i < prompt.length; i++) {
    const char = prompt.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `art_${Math.abs(hash).toString(36)}`;
}

// ═══════════════════════════════════════════════════════════
// API INTEGRATION (Backend Proxy)
// ═══════════════════════════════════════════════════════════

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export async function generateArt(request: ArtRequest): Promise<GeneratedAsset | null> {
  // Check cache first
  const cached = getCachedAsset(hashPrompt(request.prompt));
  if (cached) return cached;
  
  try {
    const response = await fetch(`${API_BASE}/art/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: request.prompt,
        negative_prompt: NEGATIVE_PROMPT,
        width: request.width,
        height: request.height,
        style: request.style,
        type: request.type,
        reference_image: request.referenceImageUrl,
      }),
    });
    
    if (!response.ok) {
      console.warn('Art generation failed:', response.status);
      return null;
    }
    
    const data = await response.json();
    const asset: GeneratedAsset = {
      id: `asset-${Date.now()}`,
      requestId: request.id,
      type: request.type,
      url: data.image_url,
      thumbnailUrl: data.thumbnail_url || data.image_url,
      prompt: request.prompt,
      createdAt: new Date().toISOString(),
      metadata: request.metadata,
    };
    
    cacheAsset(hashPrompt(request.prompt), asset);
    return asset;
  } catch (error) {
    console.warn('Art generation error:', error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// PLACEHOLDER SYSTEM (Fallback when API unavailable)
// ═══════════════════════════════════════════════════════════

// Generate deterministic placeholder colors from a string
export function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = hash % 360;
  return `hsl(${h}, 60%, 40%)`;
}

export function generatePlaceholderAvatar(name: string, size: number = 200): string {
  // Generate a data URL SVG placeholder
  const color = stringToColor(name);
  const initial = name.charAt(0).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${color}"/>
    <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" fill="white" font-size="${size * 0.4}" font-family="Arial, sans-serif" font-weight="bold">${initial}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

// Pre-built avatar URLs for demo/fallback
export const DEMO_AVATARS = {
  male: [
    '/assets/avatars/male_1.png',
    '/assets/avatars/male_2.png',
    '/assets/avatars/male_3.png',
  ],
  female: [
    '/assets/avatars/female_1.png',
    '/assets/avatars/female_2.png',
    '/assets/avatars/female_3.png',
  ],
};

// ═══════════════════════════════════════════════════════════
// DEALT CLIENT AVATAR SYSTEM
// ═══════════════════════════════════════════════════════════

export interface ClientVisualProfile {
  avatarUrl: string;
  symptoms: string[];
  preferredDrug: string;
  appearance: string;
  bodyLanguage: string;
}

const DRUG_SYMPTOMS: Record<string, { visual: string[]; behavioral: string[] }> = {
  weed: {
    visual: ['red/low eyes', 'relaxed posture', 'slight smile', 'casual clothing'],
    behavioral: ['slow movements', 'giggling', 'hungry looking', 'mellow vibe'],
  },
  cocaine: {
    visual: ['wide eyes', 'sniffling', 'restless', 'well-dressed', 'sweating'],
    behavioral: ['talking fast', 'fidgeting', 'confident', 'energetic'],
  },
  meth: {
    visual: ['bugged out eyes', 'thin face', 'paranoid look', 'disheveled'],
    behavioral: ['twitching', 'looking around constantly', 'scratching', 'agitated'],
  },
  heroin: {
    visual: ['droopy eyes', 'pale skin', 'track marks', 'nodding off'],
    behavioral: ['slow speech', 'drowsy', 'desperate', 'shaking hands'],
  },
  pills: {
    visual: ['glazed eyes', 'normal appearance', 'slightly off balance'],
    behavioral: ['calm but unfocused', 'slurred speech', 'wobbly walk'],
  },
  lean: {
    visual: ['droopy eyes', 'styrofoam cup', 'relaxed posture', 'trendy clothes'],
    behavioral: ['slow movements', 'leaning', 'mumbling', 'chill vibe'],
  },
};

export function generateClientVisualProfile(clientType: string, requestedDrug: string): ClientVisualProfile {
  const drugInfo = DRUG_SYMPTOMS[requestedDrug] || DRUG_SYMPTOMS.weed;
  const symptoms = [...drugInfo.visual.slice(0, 2), ...drugInfo.behavioral.slice(0, 1)];
  
  return {
    avatarUrl: generatePlaceholderAvatar(clientType + requestedDrug),
    symptoms,
    preferredDrug: requestedDrug,
    appearance: drugInfo.visual.join(', '),
    bodyLanguage: drugInfo.behavioral.join(', '),
  };
}
