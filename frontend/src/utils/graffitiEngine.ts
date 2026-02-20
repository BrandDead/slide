// ============================================================
// DEALT/SLIDE — Graffiti Engine
// Generates SVG-based graffiti art in 5 styles from text input
// ============================================================

import type { GraffitiStyleType, GraffitiStyleConfig, GraffitiOption } from '../types/game.types';

// ─────────────────────────────────────────────────────────────
// STYLE CONFIGS (from game design doc)
// ─────────────────────────────────────────────────────────────

export const GRAFFITI_STYLES: GraffitiStyleConfig[] = [
  {
    type: 'tag',
    name: 'Tag',
    complexity: 'low',
    timeSeconds: 8,
    legibility: 'moderate',
    xpReward: 10,
    moraleBoost: 5,
    description: 'Quick signature-style tag. Fast but basic.',
  },
  {
    type: 'throwup',
    name: 'Throw-up',
    complexity: 'low-medium',
    timeSeconds: 25,
    legibility: 'high',
    xpReward: 25,
    moraleBoost: 10,
    description: 'Bubble letters with outline. Quick and readable.',
  },
  {
    type: 'blockbuster',
    name: 'Blockbuster',
    complexity: 'medium',
    timeSeconds: 50,
    legibility: 'very-high',
    xpReward: 50,
    moraleBoost: 20,
    description: 'Large block letters. Maximum visibility and impact.',
  },
  {
    type: 'piece',
    name: 'Piece',
    complexity: 'high',
    timeSeconds: 80,
    legibility: 'moderate',
    xpReward: 100,
    moraleBoost: 35,
    description: 'Full-color masterpiece with 3D effects and details.',
  },
  {
    type: 'wildstyle',
    name: 'Wildstyle',
    complexity: 'very-high',
    timeSeconds: 110,
    legibility: 'very-low',
    xpReward: 200,
    moraleBoost: 50,
    description: 'Interlocking letters with arrows and stars. Maximum respect.',
  },
];

export function getStyleConfig(type: GraffitiStyleType): GraffitiStyleConfig {
  return GRAFFITI_STYLES.find(s => s.type === type) || GRAFFITI_STYLES[0];
}

// ─────────────────────────────────────────────────────────────
// SVG GENERATION
// ─────────────────────────────────────────────────────────────

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Generate a TAG style — quick, handwritten, one-color */
function generateTag(text: string, primary: string, secondary: string): string {
  const rng = seededRandom(hashString(text + 'tag'));
  const w = 400;
  const h = 120;
  
  // Build a handwritten-style path for each letter
  let pathD = '';
  const startX = 20;
  const letterWidth = Math.min((w - 40) / text.length, 50);
  
  for (let i = 0; i < text.length; i++) {
    const x = startX + i * letterWidth;
    const y = 70 + (rng() - 0.5) * 20;
    const slant = 5 + rng() * 10;
    
    // Each letter is a stylized stroke
    pathD += `M${x},${y + 20} Q${x + slant},${y - 30} ${x + letterWidth * 0.7},${y - 25} `;
    pathD += `T${x + letterWidth * 0.9},${y + 15} `;
    
    // Add drip effect on some letters
    if (rng() > 0.6) {
      pathD += `M${x + letterWidth * 0.5},${y + 15} L${x + letterWidth * 0.5},${y + 30 + rng() * 20} `;
    }
  }
  
  // Add underline swoosh
  pathD += `M${startX - 5},${95} Q${w / 2},${100 + rng() * 15} ${w - 20},${85 + rng() * 10} `;
  
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
    <path d="${pathD}" fill="none" stroke="${primary}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="${w/2}" y="75" text-anchor="middle" font-family="'Permanent Marker', 'Brush Script MT', cursive" font-size="48" fill="${primary}" transform="rotate(-5, ${w/2}, 75)" letter-spacing="2">${text}</text>
  </svg>`;
}

/** Generate a THROW-UP style — bubble letters with outline */
function generateThrowup(text: string, primary: string, secondary: string): string {
  const w = Math.max(400, text.length * 70);
  const h = 160;
  
  let letters = '';
  const startX = 30;
  const letterW = (w - 60) / text.length;
  
  for (let i = 0; i < text.length; i++) {
    const x = startX + i * letterW + letterW / 2;
    const y = 90;
    const rx = letterW * 0.42;
    const ry = 38;
    
    // Bubble outline
    letters += `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${primary}" stroke="${secondary}" stroke-width="4"/>`;
    // Inner highlight
    letters += `<ellipse cx="${x - 4}" cy="${y - 8}" rx="${rx * 0.5}" ry="${ry * 0.4}" fill="rgba(255,255,255,0.2)"/>`;
    // Letter
    letters += `<text x="${x}" y="${y + 12}" text-anchor="middle" font-family="'Impact', 'Arial Black', sans-serif" font-size="42" font-weight="bold" fill="${secondary}" stroke="#000" stroke-width="1">${text[i].toUpperCase()}</text>`;
  }
  
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
    ${letters}
  </svg>`;
}

/** Generate a BLOCKBUSTER style — large block letters, maximum coverage */
function generateBlockbuster(text: string, primary: string, secondary: string): string {
  const letterW = 65;
  const w = Math.max(400, text.length * letterW + 40);
  const h = 140;
  
  let letters = '';
  
  for (let i = 0; i < text.length; i++) {
    const x = 20 + i * letterW;
    const y = 15;
    const bw = letterW - 6;
    const bh = 110;
    
    // Shadow
    letters += `<rect x="${x + 4}" y="${y + 4}" width="${bw}" height="${bh}" fill="rgba(0,0,0,0.5)" rx="3"/>`;
    // Block
    letters += `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" fill="${primary}" stroke="${secondary}" stroke-width="3" rx="3"/>`;
    // Inner line detail
    letters += `<rect x="${x + 6}" y="${y + 6}" width="${bw - 12}" height="${bh - 12}" fill="none" stroke="${secondary}" stroke-width="1" stroke-dasharray="4,4" rx="2"/>`;
    // Letter
    letters += `<text x="${x + bw/2}" y="${y + bh/2 + 20}" text-anchor="middle" font-family="'Impact', 'Arial Black', sans-serif" font-size="72" font-weight="bold" fill="${secondary}" stroke="#000" stroke-width="2">${text[i].toUpperCase()}</text>`;
  }
  
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
    ${letters}
  </svg>`;
}

/** Generate a PIECE style — full-color with 3D effects, gradients, details */
function generatePiece(text: string, primary: string, secondary: string): string {
  const rng = seededRandom(hashString(text + 'piece'));
  const letterW = 80;
  const w = Math.max(500, text.length * letterW + 60);
  const h = 200;
  
  // Create gradient defs
  const gradId = `grad-${hashString(text)}`;
  let defs = `<defs>
    <linearGradient id="${gradId}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:${primary};stop-opacity:1"/>
      <stop offset="50%" style="stop-color:${secondary};stop-opacity:1"/>
      <stop offset="100%" style="stop-color:${primary};stop-opacity:0.8"/>
    </linearGradient>
    <filter id="glow-${hashString(text)}">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>`;
  
  let letters = '';
  
  // Background cloud/burst
  letters += `<ellipse cx="${w/2}" cy="${h/2}" rx="${w/2 - 10}" ry="${h/2 - 10}" fill="rgba(0,0,0,0.3)"/>`;
  
  for (let i = 0; i < text.length; i++) {
    const x = 30 + i * letterW;
    const y = 40;
    const offsetY = Math.sin(i * 0.5) * 10;
    
    // 3D shadow layers
    for (let d = 5; d > 0; d--) {
      letters += `<text x="${x + letterW/2 + d}" y="${y + 100 + offsetY + d}" text-anchor="middle" font-family="'Impact', 'Arial Black', sans-serif" font-size="80" font-weight="bold" fill="rgba(0,0,0,${0.1 * d})">${text[i].toUpperCase()}</text>`;
    }
    
    // Main letter with gradient
    letters += `<text x="${x + letterW/2}" y="${y + 100 + offsetY}" text-anchor="middle" font-family="'Impact', 'Arial Black', sans-serif" font-size="80" font-weight="bold" fill="url(#${gradId})" stroke="${secondary}" stroke-width="3" filter="url(#glow-${hashString(text)})">${text[i].toUpperCase()}</text>`;
    
    // Highlight
    letters += `<text x="${x + letterW/2 - 2}" y="${y + 96 + offsetY}" text-anchor="middle" font-family="'Impact', 'Arial Black', sans-serif" font-size="80" font-weight="bold" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1">${text[i].toUpperCase()}</text>`;
  }
  
  // Add decorative stars
  for (let i = 0; i < 3; i++) {
    const sx = rng() * w;
    const sy = rng() * h;
    const size = 8 + rng() * 12;
    letters += `<polygon points="${sx},${sy-size} ${sx+size*0.3},${sy-size*0.3} ${sx+size},${sy} ${sx+size*0.3},${sy+size*0.3} ${sx},${sy+size} ${sx-size*0.3},${sy+size*0.3} ${sx-size},${sy} ${sx-size*0.3},${sy-size*0.3}" fill="${primary}" opacity="0.6"/>`;
  }
  
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
    ${defs}
    ${letters}
  </svg>`;
}

/** Generate a WILDSTYLE style — interlocking letters with arrows, connections, maximum complexity */
function generateWildstyle(text: string, primary: string, secondary: string): string {
  const rng = seededRandom(hashString(text + 'wild'));
  const letterW = 90;
  const w = Math.max(600, text.length * letterW + 80);
  const h = 240;
  
  const gradId = `wgrad-${hashString(text)}`;
  let defs = `<defs>
    <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${primary}"/>
      <stop offset="50%" style="stop-color:${secondary}"/>
      <stop offset="100%" style="stop-color:${primary}"/>
    </linearGradient>
    <filter id="wglow-${hashString(text)}">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>`;
  
  let bg = '';
  let letters = '';
  let arrows = '';
  
  // Background burst
  bg += `<ellipse cx="${w/2}" cy="${h/2}" rx="${w/2 - 5}" ry="${h/2 - 5}" fill="rgba(0,0,0,0.4)"/>`;
  
  // Connecting lines between letters
  for (let i = 0; i < text.length - 1; i++) {
    const x1 = 40 + i * letterW + letterW;
    const x2 = 40 + (i + 1) * letterW;
    const y = h / 2 + (rng() - 0.5) * 40;
    const cy = y + (rng() - 0.5) * 60;
    arrows += `<path d="M${x1},${y} Q${(x1+x2)/2},${cy} ${x2},${y}" fill="none" stroke="${secondary}" stroke-width="3" stroke-linecap="round"/>`;
  }
  
  for (let i = 0; i < text.length; i++) {
    const x = 40 + i * letterW;
    const y = 50 + (rng() - 0.5) * 20;
    const rot = (rng() - 0.5) * 15;
    const scale = 0.9 + rng() * 0.2;
    
    // Multiple shadow layers for depth
    for (let d = 6; d > 0; d--) {
      letters += `<text x="${x + letterW/2 + d*1.2}" y="${y + 110 + d*1.2}" text-anchor="middle" font-family="'Impact', 'Arial Black', sans-serif" font-size="${75 * scale}" font-weight="bold" fill="rgba(0,0,0,${0.08 * d})" transform="rotate(${rot}, ${x + letterW/2}, ${y + 80})">${text[i].toUpperCase()}</text>`;
    }
    
    // Main letter
    letters += `<text x="${x + letterW/2}" y="${y + 110}" text-anchor="middle" font-family="'Impact', 'Arial Black', sans-serif" font-size="${75 * scale}" font-weight="bold" fill="url(#${gradId})" stroke="${secondary}" stroke-width="4" filter="url(#wglow-${hashString(text)})" transform="rotate(${rot}, ${x + letterW/2}, ${y + 80})">${text[i].toUpperCase()}</text>`;
    
    // Inner detail line
    letters += `<text x="${x + letterW/2}" y="${y + 110}" text-anchor="middle" font-family="'Impact', 'Arial Black', sans-serif" font-size="${75 * scale}" font-weight="bold" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1" transform="rotate(${rot}, ${x + letterW/2}, ${y + 80})">${text[i].toUpperCase()}</text>`;
  }
  
  // Decorative arrows
  for (let i = 0; i < 5; i++) {
    const ax = rng() * w;
    const ay = rng() * h;
    const angle = rng() * 360;
    const len = 15 + rng() * 25;
    const rad = angle * Math.PI / 180;
    const ex = ax + Math.cos(rad) * len;
    const ey = ay + Math.sin(rad) * len;
    arrows += `<line x1="${ax}" y1="${ay}" x2="${ex}" y2="${ey}" stroke="${primary}" stroke-width="3" stroke-linecap="round"/>`;
    // Arrowhead
    const aRad1 = (angle + 150) * Math.PI / 180;
    const aRad2 = (angle - 150) * Math.PI / 180;
    arrows += `<polygon points="${ex},${ey} ${ex + Math.cos(aRad1)*10},${ey + Math.sin(aRad1)*10} ${ex + Math.cos(aRad2)*10},${ey + Math.sin(aRad2)*10}" fill="${primary}"/>`;
  }
  
  // Stars
  for (let i = 0; i < 4; i++) {
    const sx = rng() * w;
    const sy = rng() * h;
    const size = 6 + rng() * 10;
    arrows += `<polygon points="${sx},${sy-size} ${sx+size*0.25},${sy-size*0.25} ${sx+size},${sy} ${sx+size*0.25},${sy+size*0.25} ${sx},${sy+size} ${sx-size*0.25},${sy+size*0.25} ${sx-size},${sy} ${sx-size*0.25},${sy-size*0.25}" fill="${secondary}" opacity="0.7"/>`;
  }
  
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
    ${defs}
    ${bg}
    ${arrows}
    ${letters}
  </svg>`;
}

// ─────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────

export function generateGraffiti(
  text: string,
  style: GraffitiStyleType,
  primaryColor: string,
  secondaryColor: string
): string {
  const cleanText = text.trim().substring(0, 20);
  
  switch (style) {
    case 'tag':         return generateTag(cleanText, primaryColor, secondaryColor);
    case 'throwup':     return generateThrowup(cleanText, primaryColor, secondaryColor);
    case 'blockbuster': return generateBlockbuster(cleanText, primaryColor, secondaryColor);
    case 'piece':       return generatePiece(cleanText, primaryColor, secondaryColor);
    case 'wildstyle':   return generateWildstyle(cleanText, primaryColor, secondaryColor);
    default:            return generateTag(cleanText, primaryColor, secondaryColor);
  }
}

/** Generate all 5 graffiti style options for a gang name */
export function generateAllGraffitiOptions(
  gangName: string,
  primaryColor: string,
  secondaryColor: string
): GraffitiOption[] {
  return GRAFFITI_STYLES.map(style => ({
    id: `graffiti-${style.type}-${hashString(gangName + style.type)}`,
    style: style.type,
    text: gangName,
    svgData: generateGraffiti(gangName, style.type, primaryColor, secondaryColor),
    createdAt: new Date().toISOString(),
  }));
}

/** Calculate actual spray time based on number of painters */
export function calculateSprayTime(baseTime: number, numPainters: number): number {
  return Math.max(5, Math.ceil(baseTime / Math.max(1, numPainters)));
}

/** Calculate fade level (100 = fresh, 0 = gone) based on age in hours */
export function calculateFadeLevel(placedAt: string): number {
  const ageHours = (Date.now() - new Date(placedAt).getTime()) / (1000 * 60 * 60);
  const totalHours = 72; // 3 days
  const fade = Math.max(0, 100 - (ageHours / totalHours) * 100);
  return Math.round(fade);
}
