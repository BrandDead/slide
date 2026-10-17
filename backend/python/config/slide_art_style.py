"""Locked SLIDE GTA-cover art direction.

Owner-approved (round 3). Every GPT Image call — crew portrait, full-body,
future combat states (idle / aim / fire / hit / downed), and props — is
assembled as:

    STYLE + SHOT + IDENTITY + SAFETY

Do not invent a second style string in likeness, avatar, or art routes.
The human-readable source is `docs/STYLE_PROMPT.md`.
"""

from __future__ import annotations

import os

# Pinned production model. Fallback is the same prompt on gpt-image-2.
GPT_IMAGE_PRIMARY = "gpt-image-2.5-flare"
GPT_IMAGE_FALLBACK = "gpt-image-2"
GPT_IMAGE_MODELS = (GPT_IMAGE_PRIMARY, GPT_IMAGE_FALLBACK)

GPT_IMAGE_SIZE = "1024x1536"
GPT_IMAGE_QUALITY = "medium"
GPT_IMAGE_N = 1

# Shared look. Portrait, body, states, and props all start here.
STYLE = (
    "Official Grand Theft Auto V loading-screen / box-cover illustration style. "
    "Hand-painted semi-realistic digital art with a strong graphic-novel finish: "
    "bold confident black ink contour lines around the silhouette, clothing folds "
    "and facial features; cel-shaded skin and fabric with 2-3 crisp hard-edged tone "
    "steps plus subtle painterly brush texture; posterized deep shadows; punchy "
    "saturated Los Santos sunset palette (burnt orange, hot magenta, deep teal-purple "
    "shadows); strong warm rim light from behind; faint print grain. Realistic adult "
    "anatomy and true-to-life facial structure, heroic but believable — a painted "
    "Rockstar cover character, clearly an illustration and NOT a photo filter, NOT a "
    "cartoon, NOT anime, NOT a 3D render, NOT flat vector, NOT South Park. "
    "Re-pose and re-frame the person as a professional cover shot: not a selfie, no "
    "outstretched arm, shoulders squared to camera, camera at eye level, slightly "
    "low heroic angle, cool self-assured expression. "
    "Background: stylized Los Santos-like palm trees and hazy downtown skyline at "
    "sunset, softer and less detailed than the character so the character pops."
)

SHOTS: dict[str, str] = {
    "portrait": (
        "Character portrait card: head and shoulders to mid-chest, three-quarter "
        "view, confident neutral expression, dramatic warm sunset rim light, "
        "plain gradient sky backdrop."
    ),
    "fullbody": (
        "Full-body character art: the person standing in a relaxed confident pose, "
        "whole body visible head to shoes, wearing believable modern streetwear "
        "(fitted jacket or hoodie, joggers or jeans, clean sneakers, unbranded), "
        "realistic adult proportions, isolated on a simple urban dusk backdrop."
    ),
    "topdown": (
        "Slight high-oblique in-game token of the same person and outfit: full "
        "silhouette readable at small size, feet visible, same Los Santos sunset "
        "grade and inked contour as the cover art."
    ),
    "idle": (
        "Full-body in-game idle state: standing ready, same person and wardrobe "
        "as the approved cover, feet visible, isolated dusk backdrop."
    ),
    "aim": (
        "Full-body in-game aim state: weapon or hands raised to aim, same person "
        "and wardrobe as the approved cover, feet planted, isolated dusk backdrop."
    ),
    "fire": (
        "Full-body in-game fire state: the aim pose at the moment of discharge, "
        "same person and wardrobe as the approved cover, isolated dusk backdrop."
    ),
    "hit": (
        "Full-body in-game hit state: reacting to impact, same person and wardrobe "
        "as the approved cover, readable silhouette, isolated dusk backdrop."
    ),
    "downed": (
        "Full-body in-game downed state: on the ground, same person and wardrobe "
        "as the approved cover, isolated dusk backdrop."
    ),
    "prop": (
        "Isolated game prop in the same GTA V loading-screen illustration style "
        "as the crew: bold ink contours, cel-shaded materials, Los Santos sunset "
        "grade, unbranded, no text."
    ),
    "vehicle": (
        "Fictional vehicle in the same GTA V loading-screen illustration style as "
        "the crew: believable proportions, unbranded, sunset grade, isolated."
    ),
    "product": (
        "Fictional packaged product in the same GTA V loading-screen illustration "
        "style as the crew: unbranded, no readable labels, sunset grade, isolated."
    ),
}

IDENTITY = (
    "IDENTITY LOCK: the character must be unmistakably the same person as in the "
    "reference photo — keep the exact face shape, jawline, skin tone, eye shape, "
    "nose, lips, eyebrows, hairstyle and hair color, facial hair, piercings, scars "
    "and approximate age. Do not beautify, slim, whiten or change ethnicity. "
    "Stylize the rendering, not the person."
)

SAFETY = (
    "No text, no logos, no brand marks, no gang signs or gang colors, no weapons."
)

# Alias used by older likeness tests and docs.
GTA_ART_DIRECTION = STYLE


def compose_art_prompt(shot: str, extra: str = "") -> str:
    """STYLE + SHOT + optional extra + IDENTITY + SAFETY."""
    shot_text = SHOTS.get(shot, SHOTS["portrait"])
    parts = [STYLE, shot_text]
    if extra.strip():
        parts.append(extra.strip())
    parts.extend([IDENTITY, SAFETY])
    return "\n\n".join(parts)


def gpt_image_models() -> list[str]:
    """Flare first, then gpt-image-2. DALL·E values in env are ignored."""
    requested = (os.environ.get("SLIDE_AVATAR_MODEL") or "").strip()
    models: list[str] = []
    if requested and "dall-e" not in requested.lower() and not requested.lower().startswith("dall"):
        models.append(requested)
    for name in GPT_IMAGE_MODELS:
        if name not in models:
            models.append(name)
    return [name for name in models if "dall-e" not in name.lower()]


def gpt_image_edit_params(prompt: str) -> dict:
    """images.edit kwargs. The uploaded photo is passed separately as `image`."""
    return {
        "prompt": prompt,
        "n": GPT_IMAGE_N,
        "size": GPT_IMAGE_SIZE,
        "quality": GPT_IMAGE_QUALITY,
    }
