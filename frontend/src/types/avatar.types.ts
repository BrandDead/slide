// ============================================================
// avatar.types.ts — Photo-to-member generation pipeline types
// Sprint: morale-heat-photo-batch2
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

export interface GeneratedMemberAsset {
  id: string;
  sourceImageUrl?: string;
  role: AvatarRole;
  style: AvatarStyle;
  outputs: AvatarOutput[];
  portraitUrl?: string;
  fullbodyUrl?: string;
  topdownUrl?: string;
  promptUsed?: string;
  status: AvatarGenerationStatus;
  createdAt: string;
}

export interface AvatarGenerateRequest {
  imageFile: File;
  role: AvatarRole;
  style: AvatarStyle;
  outputs: AvatarOutput[];
}

export interface AvatarGenerateResponse {
  jobId: string;
  asset: GeneratedMemberAsset;
}
