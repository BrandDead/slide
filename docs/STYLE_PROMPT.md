# SLIDE gang member art direction — LOCKED (round 3)

**Model:** `gpt-image-2.5-flare` (pinned snapshot `gpt-image-2.5-flare-2026-09-08`). Fallback: `gpt-image-2` with the identical prompt (slightly softer/less inked, but on-style).
**Endpoint:** `images.edit` with the friend's uploaded photo as the single `image` input (identity reference).
**Size:** `1024x1536` (portrait card and full-body). **Quality:** `medium`. n=1. No `input_fidelity` param needed.

Runtime copy of these pieces lives in `backend/python/config/slide_art_style.py`.
Portrait, full-body, future state sheets (idle / aim / fire / hit / downed), and
props all share STYLE + IDENTITY + SAFETY. Only SHOT changes.

## Prompt = STYLE + SHOT + IDENTITY + SAFETY

### STYLE (shared)
Official Grand Theft Auto V loading-screen / box-cover illustration style. Hand-painted semi-realistic digital art with a strong graphic-novel finish: bold confident black ink contour lines around the silhouette, clothing folds and facial features; cel-shaded skin and fabric with 2-3 crisp hard-edged tone steps plus subtle painterly brush texture; posterized deep shadows; punchy saturated Los Santos sunset palette (burnt orange, hot magenta, deep teal-purple shadows); strong warm rim light from behind; faint print grain. Realistic adult anatomy and true-to-life facial structure, heroic but believable — a painted Rockstar cover character, clearly an illustration and NOT a photo filter, NOT a cartoon, NOT anime, NOT a 3D render, NOT flat vector, NOT South Park.
Re-pose and re-frame the person as a professional cover shot: not a selfie, no outstretched arm, shoulders squared to camera, camera at eye level, slightly low heroic angle, cool self-assured expression.
Background: stylized Los Santos-like palm trees and hazy downtown skyline at sunset, softer and less detailed than the character so the character pops.

### SHOT — portrait card
Character portrait card: head and shoulders to mid-chest, three-quarter view, confident neutral expression, dramatic warm sunset rim light, plain gradient sky backdrop.

### SHOT — full body
Full-body character art: the person standing in a relaxed confident pose, whole body visible head to shoes, wearing believable modern streetwear (fitted jacket or hoodie, joggers or jeans, clean sneakers, unbranded), realistic adult proportions, isolated on a simple urban dusk backdrop.

### IDENTITY (always append)
IDENTITY LOCK: the character must be unmistakably the same person as in the reference photo — keep the exact face shape, jawline, skin tone, eye shape, nose, lips, eyebrows, hairstyle and hair color, facial hair, piercings, scars and approximate age. Do not beautify, slim, whiten or change ethnicity. Stylize the rendering, not the person.

### SAFETY (always append)
No text, no logos, no brand marks, no gang signs or gang colors, no weapons.

## Cost (from API usage + platform.openai.com/docs/pricing, Oct 17 2026)
gpt-image-2.5-flare: $8/1M image-in, $5/1M text-in, $30/1M image-out.
Observed per image (1024x1536, medium): ~1,400 input tokens + 343 output tokens ≈ **$0.02/image → ≈ $0.04–0.05 per member** (portrait + full body).
gpt-image-2 fallback: same input, 1,372 output tokens ≈ $0.05/image → ≈ $0.10 per member.
Batch API halves these. Estimates; confirm on the billing dashboard.

## Notes
- Portraits sometimes inherit the selfie head tilt/crop from the upload; acceptable, or crop server-side.
- Sneakers can drift toward recognizable silhouettes (no logos rendered in tests); keep "unbranded".
- Test inputs used to lock this look are synthetic AI-generated fictional people, not real persons.
- Owner approved this direction over the cartoon / South Park / clip-art look.
