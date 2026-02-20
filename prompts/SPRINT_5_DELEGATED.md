# Sprint 5 — Delegated Prompts

---

## PROMPT 5C — Canvas Renderer Upgrade
**Assign to: `qwen3-coder:480b-cloud`**

You are building a sprite-based canvas renderer upgrade for a street game called DEALT/SLIDE. The existing DriveByEngine renders a top-down car chase using simple colored rectangles on an HTML5 Canvas. Your job is to upgrade it to use sprite-based rendering with parallax scrolling and particle effects.

### Current DriveByEngine Architecture
The component is at `frontend/src/components/driveby/DriveByEngine.tsx`. It uses:
- React with `useRef<HTMLCanvasElement>`, `useCallback`, `useEffect` for the game loop
- `requestAnimationFrame` for 60fps rendering
- State managed via `useReducer` with actions: INIT, SHOOT, HIT, MISS, ADVANCE, END

### Current render function (simplified):
```typescript
const render = useCallback((ctx: CanvasRenderingContext2D) => {
  // Background - simple dark gradient
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  
  // Street lines
  ctx.strokeStyle = '#333';
  ctx.setLineDash([20, 15]);
  ctx.beginPath();
  ctx.moveTo(CANVAS_W / 2, 0);
  ctx.lineTo(CANVAS_W / 2, CANVAS_H);
  ctx.stroke();
  
  // Player car - simple rectangle
  ctx.fillStyle = '#4ade80';
  ctx.fillRect(state.playerX - 20, CANVAS_H - 80, 40, 70);
  
  // Enemy positions - colored rectangles
  state.enemies.forEach(enemy => {
    ctx.fillStyle = enemy.alive ? '#ef4444' : '#333';
    ctx.fillRect(enemy.x - 15, enemy.y - 15, 30, 30);
  });
  
  // Bullets - small circles
  state.bullets.forEach(bullet => {
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, 3, 0, Math.PI * 2);
    ctx.fill();
  });
}, [state]);
```

### Canvas dimensions:
```typescript
const CANVAS_W = 375;
const CANVAS_H = 667;
```

### What to build:

1. **SpriteLoader utility** (`frontend/src/utils/spriteLoader.ts`):
```typescript
// Must export:
export class SpriteLoader {
  private cache: Map<string, HTMLImageElement>;
  async loadSheet(name: string, url: string, frameWidth: number, frameHeight: number): Promise<SpriteSheet>;
  drawFrame(ctx: CanvasRenderingContext2D, sheet: SpriteSheet, frameIndex: number, x: number, y: number, scale?: number): void;
}

export interface SpriteSheet {
  image: HTMLImageElement;
  frameWidth: number;
  frameHeight: number;
  framesPerRow: number;
  totalFrames: number;
}
```

2. **ParticleSystem** (`frontend/src/utils/particleSystem.ts`):
- Muzzle flash particles (yellow/orange, short-lived, expanding)
- Bullet impact sparks (white, bouncing)
- Explosion particles (red/orange, large, with smoke trail)
- Blood splatter (red, gravity-affected)
- Each particle: `{ x, y, vx, vy, life, maxLife, size, color, alpha }`

3. **ParallaxBackground** (`frontend/src/utils/parallaxBg.ts`):
- 3 layers: far buildings (slow), near buildings (medium), street details (fast)
- Each layer scrolls at different speed based on car movement
- Programmatic rendering (no images needed) — draw building silhouettes, street lamps, etc.

4. **Updated DriveByEngine render function**:
- Replace `ctx.fillRect` car with sprite drawing
- Replace enemy rectangles with sprite frames
- Add parallax background behind everything
- Add particle effects on shoot/hit/kill
- Add screen shake on hit (translate canvas context)
- Until actual sprite images exist, draw detailed programmatic shapes (not just rectangles — draw car shapes with windows, wheels, etc.)

### Output format:
Provide 3 complete TypeScript files:
1. `frontend/src/utils/spriteLoader.ts`
2. `frontend/src/utils/particleSystem.ts`
3. `frontend/src/utils/parallaxBg.ts`

And the updated render section of DriveByEngine (just the render function and the initialization that loads sprites).

---

## PROMPT 5D — Sound Engine
**Assign to: `deepseek-v3.1:671b-cloud`**

You are building a sound engine for a street game called DEALT/SLIDE. The game currently has ZERO audio. Build a complete Web Audio API-based sound system.

### Game screens that need audio:
| Screen | Ambient Loop | SFX Needed |
|--------|-------------|------------|
| Home (OSShell) | Lo-fi hip hop beat | App open click, notification chime |
| SLIDE Combat | Tense synth drone | Gunshot, hit impact, miss whoosh, victory fanfare, defeat sting |
| Drive-By | Engine revving + wind | Gunshot, bullet impact, tire screech, explosion, siren |
| Cook Lab | Lab bubbling ambient | Ingredient drop, mixing sound, cooking sizzle, success chime, fail buzz |
| Territory Map | Street ambience (traffic, voices) | Member place thud, collect cash register, claim territory horn |
| Contacts | Quiet room tone | Card flip, recruit chime, level up fanfare, bail buzzer |
| Shoebox | Vault ambient | Cash counting, deposit confirm, withdraw confirm |
| Market | Shop ambience | Browse click, purchase ka-ching, equip metallic |
| Casino | Casino floor chatter | Dice roll, card flip, slot spin, slot win jingle, lose buzz |
| Missions | Radio static | Accept beep, complete fanfare, fail buzz |
| Settings | None | Toggle click |

### Architecture requirements:

1. **SoundManager singleton** (`frontend/src/utils/soundManager.ts`):
```typescript
export class SoundManager {
  private ctx: AudioContext;
  private masterGain: GainNode;
  private sfxGain: GainNode;
  private musicGain: GainNode;
  private ambientGain: GainNode;
  
  // Synthesize sounds procedurally (no external audio files needed)
  // Use oscillators, noise generators, and envelopes
  
  playSFX(name: SFXName): void;
  playAmbient(name: AmbientName): void;
  stopAmbient(): void;
  playMusic(name: MusicName): void;
  stopMusic(): void;
  
  setMasterVolume(v: number): void;  // 0-1
  setSFXVolume(v: number): void;
  setMusicVolume(v: number): void;
  
  // Must work with the Settings page toggles
  mute(): void;
  unmute(): void;
}
```

2. **Procedural sound synthesis** — Generate ALL sounds programmatically using Web Audio API:
- Gunshot: white noise burst + low frequency thump, fast decay
- Cash register: high-pitched bell + metallic ring
- Explosion: noise burst + low rumble + long decay
- Card flip: short click + whoosh
- Cooking sizzle: filtered noise with modulation
- Siren: oscillating sine wave between two frequencies
- Lo-fi beat: kick (sine thump) + snare (noise burst) + hi-hat (filtered noise) in a loop pattern

3. **React hook** (`frontend/src/hooks/useSound.ts`):
```typescript
export function useSound() {
  return {
    playSFX: (name: SFXName) => void,
    playAmbient: (name: AmbientName) => void,
    stopAmbient: () => void,
    setVolume: (channel: 'master' | 'sfx' | 'music', value: number) => void,
  };
}
```

4. **Integration points** — Show how to add sound to existing components. Example for SlideGame:
```typescript
// In the attackerShoot function:
const { playSFX } = useSound();
playSFX('gunshot');
// On hit:
playSFX('hit_impact');
// On miss:
playSFX('miss_whoosh');
```

### Existing Settings component volume controls:
The Settings page already has these toggles in its state:
```typescript
const [settings, setSettings] = useState({
  soundEnabled: true,
  musicEnabled: true,
  sfxVolume: 80,
  musicVolume: 60,
  // ...
});
```

### Output format:
Provide 2 complete TypeScript files:
1. `frontend/src/utils/soundManager.ts`
2. `frontend/src/hooks/useSound.ts`

And integration examples showing how to wire into SlideGame, DriveByEngine, AlchemyLab, and Casino.

---

## PROMPT 5E — CSS Theme System
**Assign to: `gpt-oss:120b-cloud`**

You are building a CSS theming system for a street game called DEALT/SLIDE. The game uses a dark glassmorphism aesthetic with neon accent colors. Currently, colors are hardcoded across 15+ CSS files. Build a centralized theme system.

### Current color usage across the codebase:
```
Background: #0a0a0a, #0a0a1a, #0f0f23, #1a1a2e (dark gradients)
Text primary: #fff, #f0f0f0
Text secondary: #888, #666, #aaa
Green (money/success): #4ade80, #22c55e, #059669, #10b981
Red (danger/enemy): #ef4444, #dc2626
Blue (info/UI): #60a5fa, #3b82f6, #2563eb
Gold (XP/special): #ffd700
Orange (warning): #f97316
Purple (premium): #7c3aed, #8b5cf6
Glass: rgba(255,255,255,0.03-0.08) backgrounds with backdrop-filter: blur()
Borders: rgba(255,255,255,0.06-0.15)
```

### CSS files that need theming (all in `frontend/src/components/`):
- `layout/OSShell.css` (home screen)
- `slide/SlideGame.css` (combat)
- `alchemy/AlchemyLab.css` (cooking)
- `map/TerritoryMap.css` (territory)
- `contacts/Contacts.css` (crew)
- `economy/Shoebox.css` (banking)
- `economy/Market.css` (shop)
- `missions/Missions.css` (ops)
- `casino/Casino.css` (gambling)
- `settings/Settings.css` (settings)
- `driveby/DriveByGame.css` (drive-by wrapper)
- `layout/GameEventOverlay.css` (events)
- `contacts/LevelUpPopup.css` (level up)
- `map/BlockSearch.css` (search)
- `map/BlockDetailPanel.css` (block detail)

### What to build:

1. **Theme CSS variables file** (`frontend/src/styles/theme.css`):
Define all colors as CSS custom properties on `:root` for the default dark theme, plus `.theme-light` and `.theme-oled` variants.

2. **Theme provider** (`frontend/src/utils/themeManager.ts`):
```typescript
export type ThemeName = 'dark' | 'light' | 'oled';
export type AccentColor = 'green' | 'blue' | 'purple' | 'red' | 'gold';

export function setTheme(theme: ThemeName): void;
export function setAccent(accent: AccentColor): void;
export function getTheme(): ThemeName;
export function getAccent(): AccentColor;
```

3. **Migration guide** showing the find-and-replace patterns to convert hardcoded colors to CSS variables. Example:
```css
/* Before */
background: rgba(0, 0, 0, 0.6);
color: #4ade80;
border: 1px solid rgba(255, 255, 255, 0.08);

/* After */
background: var(--surface-elevated);
color: var(--color-success);
border: 1px solid var(--border-subtle);
```

### Output format:
Provide 2 complete files:
1. `frontend/src/styles/theme.css` (all 3 theme variants)
2. `frontend/src/utils/themeManager.ts`

Plus the complete find-and-replace migration guide for all 15 CSS files.
