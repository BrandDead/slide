# DEALT/SLIDE - AI Asset Generation Prompts
## For Banana Nano / Stable Diffusion / DALL-E / Midjourney

*Integrated from Qwen3-VL:235B - Production-Ready Prompts*

---

## 🎨 STYLE GUIDE

### Global Parameters
- **Art Style**: Neon Noir Cyberpunk, GTA-inspired
- **Color Palette**: 
  - Primary: `#00F0FF` (Cyan), `#FF006E` (Magenta)
  - Success: `#00FF88` (Lime)
  - Danger: `#FF3333` (Red)
  - Warning: `#FFD700` (Gold)
  - Background: `#0D0D0D`, `#1A1A2E`
- **Lighting**: Neon signs, wet streets reflecting light
- **Mood**: Gritty, tense, nocturnal

### Negative Prompts (Always Include)
```
--no photorealism, cartoon, bright daylight, anime, watermark, signature, blurry, low quality
```

---

## 1. BLOCK BACKGROUNDS (Drive-By Mode)
*Resolution: 2048x1024 | Aspect: 2:1 | Camera: Side-scrolling perspective*

### Miami Style
```
Urban Miami block at night, art deco buildings in pastel pink and mint green, neon palm trees casting cyan glow, flickering pink "HOTEL" neon sign, wet asphalt reflecting neon lights, rain mist in air, high contrast shadows, detailed concrete textures with gang graffiti tags, cyberpunk aesthetic, game background asset, side-scrolling perspective, 8k resolution
```

### NYC Style
```
Gritty New York City block at night, brownstone buildings with rusted fire escapes, vibrant graffiti murals in purple and orange, cracked concrete sidewalk, steam rising from manholes, dim yellow streetlight glow, rain-slicked cobblestones, "DEALT" graffiti tag on wall, neon noir atmosphere, game background asset, side-scrolling perspective, 8k resolution
```

### LA Style
```
Los Angeles block at golden hour, strip mall with amber "LIQUOR" neon sign, lowrider car with hydraulics raised in parking lot, palm trees silhouetted against hazy sunset, dusty air particles, warm orange and pink sky, oil-stained concrete pavement, cinematic lighting, game background asset, side-scrolling perspective, 8k resolution
```

### Detroit Style
```
Abandoned Detroit industrial block at night, collapsed factory with broken windows, rusted industrial pipes, flickering sickly yellow streetlight, overgrown weeds through cracked concrete, "SLIDE" graffiti on exposed brick wall, foggy atmosphere, urban decay aesthetic, game background asset, side-scrolling perspective, 8k resolution
```

---

## 2. CHARACTER SPRITES

### Gang Members (Side-View)
*Resolution: 512x512*

**Lookout**
```
Side view young gang lookout, black hoodie hood up, paranoid expression, hands in pockets, neon red tattoo on neck, pink cyan neon lighting, game character sprite, 8k
```

**Shooter**
```
Side view gang shooter, leather jacket, holding Uzi muzzle flash, aggressive stance, facial scars, cyan neon highlights on weapon, game character sprite, 8k
```

**Leader**
```
Side view gang boss, designer suit unbuttoned, gold chains diamond watch, two bodyguards background, pink neon BOSS sign overhead, game character sprite, 8k
```

### Civilians (Side-View)
*Resolution: 512x512*

**Business Person**
```
Side view business person gray suit, briefcase papers falling, stressed expression, crosswalk, neon reflection on suit, game character sprite, 8k
```

**Mother with Child**
```
Side view mother holding child hand, trench coat worried expression, child yellow raincoat, graffiti wall background, game character sprite, 8k
```

---

## 3. VEHICLES
*Resolution: 1024x512*

### Player Car Interior (Drive-By POV)
```
First person dashboard view inside car, cracked steering wheel, hand holding pistol through open window, speedometer 100mph, neon city streaking past windshield, blood splatter corner, pink cyan reflections, game vehicle asset, 8k
```

### Enemy Sedan
```
Side view black enemy sedan, tinted windows silhouettes visible, bullet holes rear fender, DEALT graffiti on door, chrome rims, wet road reflections, game vehicle asset, 8k
```

### Police Cruiser
```
Side view police cruiser, white blue stripe, siren lights pulsing blue red, POLICE text, bullet impacts hood, rain windshield, game vehicle asset, 8k
```

---

## 4. UI ELEMENTS
*Resolution: 256x256*

### Health Bar
```
Health bar UI, cracked metal texture, 5 segments 3 filled glowing red, oil leak effect, neon HEALTH label cyberpunk font, game UI element, 8k
```

### Heat Meter
```
Heat meter UI, vertical thermometer, rising red mercury steam top, WANTED flickering neon, cyan outline, 75% digital readout, game UI element, 8k
```

### Ammo Counter
```
Ammo counter UI, 12/30 cyan neon numbers, metallic bullet hole background, RELOAD warning, cyberpunk font, game UI element, 8k
```

### Money Display
```
Money counter UI, $100 bills CASH neon pink, $15750 digital display, crumpled paper texture, game UI element, 8k
```

### Crosshair
```
Crosshair UI, thin cyan neon cross, pulsing center dot, circular outline, LOCKED text on target, minimal transparent background, game UI element, 8k
```

---

## 5. MAP TILES (SLIDE Mode Top-Down)
*Resolution: 1024x1024*

### Residential
```
Top-down residential city block, small houses yards, narrow streets parked cars, streetlights corners, sidewalks pedestrians, neon noir cyan magenta highlights, game map asset, 8k
```

### Commercial
```
Top-down commercial block, strip mall parking lot, fast food gas station, traffic, neon signs colored dots from above, urban grid, game map asset, 8k
```

### Industrial
```
Top-down industrial block, warehouse buildings, loading docks trucks, railroad tracks, smoke stacks, chain-link fences, gritty textures, game map asset, 8k
```

---

## 🔧 BANANA NANO API CONFIG

```json
{
  "model": "stable-diffusion-xl",
  "parameters": {
    "width": 1024,
    "height": 1024,
    "num_inference_steps": 30,
    "guidance_scale": 7.5,
    "negative_prompt": "photorealism, cartoon, bright daylight, anime, watermark, blurry, low quality, deformed",
    "scheduler": "DPMSolverMultistep"
  }
}
```

### Resolution Presets
| Asset Type | Width | Height | Cost |
|------------|-------|--------|------|
| Block Background | 2048 | 1024 | $0.02 |
| Character Sprite | 512 | 512 | $0.02 |
| Vehicle | 1024 | 512 | $0.02 |
| UI Element | 256 | 256 | $0.01 |
| Map Tile | 1024 | 1024 | $0.02 |

---

## 💰 COST ESTIMATION

**Total Initial Asset Generation: ~$2.40**
**With iterations/variations: ~$10-15**

---

*Last Updated: December 2025*
