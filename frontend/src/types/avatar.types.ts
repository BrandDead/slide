// ============================================================
// avatar.types.ts — Photo-to-member generation pipeline types
// ============================================================

export type AvatarGenerationStatus =
  | 'idle'
  | 'uploading'
  | 'queued'
  | 'generating'
  | 'ready'
  | 'failed'
  | 'approved';

export type AvatarRole =
  | 'dealer'
  | 'shooter'
  | 'driver'
  | 'enforcer'
  | 'lookout'
  | 'runner'
  | 'chemist';

export type AvatarStyle =
  | 'south_florida_streetwear'
  | 'luxury_noir'
  | 'masked_tactical'
  | 'baggy_2000s'
  | 'clean_designer';

export type AvatarOutput = 'portrait' | 'fullbody' | 'topdown';

export type AvatarProviderId =
  | 'local_photo_likeness'
  | 'local_photo_likeness_offline'
  | 'openai'
  | 'unconfigured';

export interface LikenessTraits {
  skinTone: string;
  hairColor: string;
  facialHair: string;
  clothingColors: string[];
  notes: string[];
}

export interface GeneratedMemberAsset {
  id: string;
  sourceImageUrl?: string;
  role: AvatarRole;
  style: AvatarStyle;
  outputs: AvatarOutput[];
  portraitUrl?: string;
  fullbodyUrl?: string;
  topdownUrl?: string;
  portraitDataUrl?: string;
  fullbodyDataUrl?: string;
  topdownDataUrl?: string;
  promptUsed?: string;
  status: AvatarGenerationStatus;
  createdAt: string;
  provider?: AvatarProviderId;
  likenessTraits?: LikenessTraits;
  sourcePhotoRetained?: boolean;
  stockPreview?: boolean;
  aiProviderError?: string;
}

export interface AvatarGenerateRequest {
  imageFile: File;
  role: AvatarRole;
  style: AvatarStyle;
  outputs: AvatarOutput[];
  consentPermission: boolean;
  consentAdult: boolean;
  consentProcessing: boolean;
}

export interface AvatarGenerateResponse {
  jobId: string;
  asset: GeneratedMemberAsset;
}

export interface AvatarProviderStatus {
  provider: AvatarProviderId;
  aiConfigured: boolean;
  requestedProvider?: string;
  model?: string | null;
  requiredForAi: {
    env: string[];
    optionalEnv?: string[];
    pythonPackage: string;
    notes: string;
  };
}
