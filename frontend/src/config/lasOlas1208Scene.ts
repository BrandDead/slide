// ============================================================
// SLIDE / DEALT — 1208 Las Olas procedural scene manifest
// Normalized coordinates keep the scene resolution-independent.
// Replace or extend these surfaces when exact street photography,
// LiDAR, or photogrammetry is available.
// ============================================================

export type SceneSurfaceKind =
  | 'glass'
  | 'metal'
  | 'concrete'
  | 'wood'
  | 'asphalt'
  | 'foliage';

export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SceneSurface extends NormalizedRect {
  id: string;
  kind: SceneSurfaceKind;
  destructible: boolean;
  integrity: number;
  label?: string;
}

export interface StorefrontDefinition {
  id: string;
  facade: NormalizedRect;
  facadeTone: string;
  trimTone: string;
  awningTone: string;
  sign: string;
  windows: SceneSurface[];
  door: SceneSurface;
}

export interface PalmDefinition {
  x: number;
  groundY: number;
  scale: number;
  lean: number;
  depth: 'rear' | 'front';
}

export interface LasOlasSceneManifest {
  id: string;
  displayName: string;
  requestedAddress: string;
  verificationStatus: 'stylized-reference' | 'verified-capture';
  artDirection: string;
  palette: {
    skyTop: string;
    skyHorizon: string;
    buildingShadow: string;
    sidewalk: string;
    road: string;
    sodiumLight: string;
    neonMint: string;
  };
  storefronts: StorefrontDefinition[];
  palms: PalmDefinition[];
  fixedSurfaces: SceneSurface[];
}

const storefronts: StorefrontDefinition[] = [
  {
    id: '1208-main',
    facade: { x: 0.055, y: 0.27, width: 0.235, height: 0.35 },
    facadeTone: '#c8b89f',
    trimTone: '#20242a',
    awningTone: '#20201f',
    sign: '1208',
    windows: [
      {
        id: '1208-window-left',
        kind: 'glass',
        destructible: true,
        integrity: 85,
        x: 0.075,
        y: 0.41,
        width: 0.085,
        height: 0.17,
        label: '1208 storefront left glass',
      },
      {
        id: '1208-window-right',
        kind: 'glass',
        destructible: true,
        integrity: 85,
        x: 0.178,
        y: 0.41,
        width: 0.085,
        height: 0.17,
        label: '1208 storefront right glass',
      },
    ],
    door: {
      id: '1208-door',
      kind: 'glass',
      destructible: true,
      integrity: 110,
      x: 0.267,
      y: 0.395,
      width: 0.052,
      height: 0.205,
      label: '1208 entry door',
    },
  },
  {
    id: 'gallery',
    facade: { x: 0.31, y: 0.31, width: 0.22, height: 0.31 },
    facadeTone: '#ded8cd',
    trimTone: '#5f493d',
    awningTone: '#7a2230',
    sign: 'LAS OLAS GALLERY',
    windows: [
      {
        id: 'gallery-window-left',
        kind: 'glass',
        destructible: true,
        integrity: 75,
        x: 0.327,
        y: 0.43,
        width: 0.084,
        height: 0.15,
      },
      {
        id: 'gallery-window-right',
        kind: 'glass',
        destructible: true,
        integrity: 75,
        x: 0.425,
        y: 0.43,
        width: 0.082,
        height: 0.15,
      },
    ],
    door: {
      id: 'gallery-door',
      kind: 'wood',
      destructible: true,
      integrity: 145,
      x: 0.508,
      y: 0.425,
      width: 0.045,
      height: 0.18,
    },
  },
  {
    id: 'corner-market',
    facade: { x: 0.55, y: 0.285, width: 0.29, height: 0.335 },
    facadeTone: '#a99e8d',
    trimTone: '#262c31',
    awningTone: '#163f3c',
    sign: 'OLAS MARKET',
    windows: [
      {
        id: 'market-window-left',
        kind: 'glass',
        destructible: true,
        integrity: 90,
        x: 0.575,
        y: 0.425,
        width: 0.1,
        height: 0.155,
      },
      {
        id: 'market-window-right',
        kind: 'glass',
        destructible: true,
        integrity: 90,
        x: 0.692,
        y: 0.425,
        width: 0.11,
        height: 0.155,
      },
    ],
    door: {
      id: 'market-door',
      kind: 'metal',
      destructible: true,
      integrity: 180,
      x: 0.805,
      y: 0.41,
      width: 0.05,
      height: 0.195,
    },
  },
  {
    id: 'west-bay',
    facade: { x: 0.84, y: 0.335, width: 0.19, height: 0.285 },
    facadeTone: '#b8aa96',
    trimTone: '#1f252a',
    awningTone: '#5d452b',
    sign: 'WEST BAY',
    windows: [
      {
        id: 'west-bay-window',
        kind: 'glass',
        destructible: true,
        integrity: 80,
        x: 0.865,
        y: 0.44,
        width: 0.11,
        height: 0.14,
      },
    ],
    door: {
      id: 'west-bay-door',
      kind: 'wood',
      destructible: true,
      integrity: 140,
      x: 0.977,
      y: 0.425,
      width: 0.045,
      height: 0.18,
    },
  },
];

const fixedSurfaces: SceneSurface[] = [
  {
    id: 'main-stucco-wall',
    kind: 'concrete',
    destructible: true,
    integrity: 500,
    x: 0,
    y: 0.25,
    width: 1,
    height: 0.39,
    label: 'storefront facade band',
  },
  {
    id: 'sidewalk-slab',
    kind: 'concrete',
    destructible: true,
    integrity: 900,
    x: 0,
    y: 0.62,
    width: 1,
    height: 0.13,
  },
  {
    id: 'street-asphalt',
    kind: 'asphalt',
    destructible: true,
    integrity: 1200,
    x: 0,
    y: 0.75,
    width: 1,
    height: 0.25,
  },
  {
    id: 'light-pole-left',
    kind: 'metal',
    destructible: true,
    integrity: 260,
    x: 0.365,
    y: 0.18,
    width: 0.014,
    height: 0.48,
  },
  {
    id: 'light-pole-right',
    kind: 'metal',
    destructible: true,
    integrity: 260,
    x: 0.77,
    y: 0.2,
    width: 0.014,
    height: 0.46,
  },
];

export const LAS_OLAS_1208_SCENE: LasOlasSceneManifest = {
  id: 'las-olas-1208',
  displayName: '1208 / LAS OLAS',
  requestedAddress: '1208 Las Olas Blvd, Fort Lauderdale, FL 33312',
  verificationStatus: 'stylized-reference',
  artDirection:
    'South Florida tropical noir: sun-faded stucco, palms, boutique glass, sodium-vapor highlights, dark asphalt, humid haze, and luxury retail details under combat lighting.',
  palette: {
    skyTop: '#090d18',
    skyHorizon: '#27354a',
    buildingShadow: '#11161d',
    sidewalk: '#55575a',
    road: '#111317',
    sodiumLight: '#f5b45c',
    neonMint: '#7df8d4',
  },
  storefronts,
  palms: [
    { x: 0.035, groundY: 0.64, scale: 0.82, lean: -0.08, depth: 'rear' },
    { x: 0.285, groundY: 0.65, scale: 0.68, lean: 0.05, depth: 'rear' },
    { x: 0.525, groundY: 0.65, scale: 0.72, lean: -0.03, depth: 'rear' },
    { x: 0.88, groundY: 0.66, scale: 0.8, lean: 0.06, depth: 'rear' },
    { x: 0.14, groundY: 0.77, scale: 0.58, lean: 0.04, depth: 'front' },
    { x: 0.68, groundY: 0.77, scale: 0.62, lean: -0.05, depth: 'front' },
  ],
  fixedSurfaces,
};

export const getAllSceneSurfaces = (): SceneSurface[] => [
  ...LAS_OLAS_1208_SCENE.fixedSurfaces,
  ...LAS_OLAS_1208_SCENE.storefronts.flatMap((storefront) => [
    ...storefront.windows,
    storefront.door,
  ]),
];
