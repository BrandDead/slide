"""Photo-crop analysis and the locked GTA-style likeness prompt.

No-key path: crop the uploaded face for the roster. Never invent a
vector / stick-figure / clip-art body. Full-body and in-game states
come only from GPT Image once OPENAI_API_KEY is set.

Source photos are read from a temp path and must be deleted by the
caller after generation. Generated PNGs are either returned as data
URLs or written under a job directory — never the original upload.
"""

from __future__ import annotations

import io
import os
from typing import Iterable

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps

ALLOWED_MIME = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
}
MAX_UPLOAD_BYTES = 8 * 1024 * 1024

# Latest-first GPT Image family. Never fall back to DALL·E.
GPT_IMAGE_MODELS = ("gpt-image-2", "gpt-image-1.5", "gpt-image-1")

GTA_ART_DIRECTION = (
    "GTA V loading-screen / cover-art illustrated realism. Semi-realistic "
    "painted character art with believable adult anatomy, real clothing "
    "materials, and cinematic wet-night tropical-noir grade. Same look "
    "across portrait, full-body, and in-game states. NOT South Park, NOT "
    "clip-art, NOT vector, NOT a stick figure, NOT cel-shaded cartoon, "
    "NOT a chibi or mascot."
)

SKIN_BANDS = (
    ("ivory", (248, 228, 212)),
    ("sand", (232, 196, 162)),
    ("honey", (212, 165, 116)),
    ("caramel", (181, 131, 90)),
    ("toffee", (139, 101, 68)),
    ("bronze", (110, 72, 48)),
    ("chocolate", (93, 64, 55)),
    ("espresso", (62, 39, 35)),
)

HAIR_BANDS = (
    ("black", (18, 16, 14)),
    ("dark_brown", (48, 32, 22)),
    ("brown", (92, 58, 32)),
    ("auburn", (120, 52, 28)),
    ("blonde", (210, 176, 96)),
    ("platinum", (220, 214, 200)),
    ("gray", (140, 140, 138)),
    ("red", (160, 48, 28)),
)

STYLE_CLOTHING = {
    "south_florida_streetwear": {
        "label": "South Florida streetwear",
        "notes": "oversized tee, baggy jeans, sneakers, thin chain — real fabric, no logos",
    },
    "luxury_noir": {
        "label": "luxury noir",
        "notes": "dark tailored layers, gold hardware, no real logos",
    },
    "masked_tactical": {
        "label": "tactical streetwear",
        "notes": "utility vest, muted olive, pulled collar — face stays fully visible",
    },
    "baggy_2000s": {
        "label": "baggy 2000s streetwear",
        "notes": "oversized jersey, baggy jeans, work boots — real cloth folds",
    },
    "clean_designer": {
        "label": "clean designer streetwear",
        "notes": "fitted knit, clean sneakers, quiet jewelry — no brand marks",
    },
}

ROLE_COLORS = {
    "dealer": (74, 222, 128),
    "shooter": (248, 113, 113),
    "driver": (96, 165, 250),
    "enforcer": (251, 146, 60),
    "lookout": (167, 139, 250),
    "runner": (250, 204, 21),
    "chemist": (45, 212, 191),
}


def _nearest_name(rgb: tuple[int, int, int], bands: Iterable[tuple[str, tuple[int, int, int]]]) -> str:
    best_name = "unknown"
    best_dist = 1e12
    for name, target in bands:
        dist = sum((a - b) ** 2 for a, b in zip(rgb, target))
        if dist < best_dist:
            best_dist = dist
            best_name = name
    return best_name


def _mean_rgb(image: Image.Image, box: tuple[int, int, int, int] | None = None) -> tuple[int, int, int]:
    crop = image.crop(box) if box else image
    if crop.mode != "RGB":
        crop = crop.convert("RGB")
    hist = crop.resize((1, 1), Image.Resampling.BOX).getpixel((0, 0))
    return (int(hist[0]), int(hist[1]), int(hist[2]))


def _is_skin_ycbcr(r: int, g: int, b: int) -> bool:
    y = 0.299 * r + 0.587 * g + 0.114 * b
    cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
    cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
    return 40 < y < 250 and 77 <= cb <= 132 and 128 <= cr <= 178


def _face_box(image: Image.Image) -> tuple[int, int, int, int]:
    """Find a face-ish bounding box via coarse YCbCr skin detection."""
    sample = image.convert("RGB")
    w, h = sample.size
    step_x = max(1, w // 80)
    step_y = max(1, h // 80)
    xs: list[int] = []
    ys: list[int] = []
    for y in range(0, h, step_y):
        for x in range(0, w, step_x):
            r, g, b = sample.getpixel((x, y))[:3]
            if _is_skin_ycbcr(r, g, b):
                xs.append(x)
                ys.append(y)
    if len(xs) < 12:
        return (int(w * 0.18), int(h * 0.08), int(w * 0.82), int(h * 0.72))
    pad_x = int(w * 0.08)
    pad_y = int(h * 0.10)
    left = max(0, min(xs) - pad_x)
    right = min(w, max(xs) + pad_x)
    top = max(0, min(ys) - int(pad_y * 1.4))
    bottom = min(h, max(ys) + pad_y)
    if right - left < w * 0.22:
        cx = (left + right) // 2
        half = int(w * 0.18)
        left, right = max(0, cx - half), min(w, cx + half)
    if bottom - top < h * 0.22:
        cy = (top + bottom) // 2
        half = int(h * 0.18)
        top, bottom = max(0, cy - half), min(h, cy + half)
    return (left, top, right, bottom)


def analyze_photo(image: Image.Image) -> dict:
    """Extract likeness traits used for GPT Image prompts and the photo crop."""
    rgb = image.convert("RGB")
    face = _face_box(rgb)
    fw = face[2] - face[0]
    fh = face[3] - face[1]
    mid_face = (
        face[0] + int(fw * 0.25),
        face[1] + int(fh * 0.28),
        face[2] - int(fw * 0.25),
        face[1] + int(fh * 0.62),
    )
    lower_face = (
        face[0] + int(fw * 0.28),
        face[1] + int(fh * 0.62),
        face[2] - int(fw * 0.28),
        min(rgb.size[1], face[3] + int(fh * 0.04)),
    )
    hair_box = (
        face[0],
        max(0, face[1] - int(fh * 0.28)),
        face[2],
        face[1] + int(fh * 0.18),
    )
    clothes_box = (
        int(rgb.size[0] * 0.18),
        min(rgb.size[1] - 4, face[3] + int(fh * 0.08)),
        int(rgb.size[0] * 0.82),
        rgb.size[1],
    )

    skin = _mean_rgb(rgb, mid_face)
    hair = _mean_rgb(rgb, hair_box)
    clothes = _mean_rgb(rgb, clothes_box)
    cheek = _mean_rgb(rgb, mid_face)
    chin = _mean_rgb(rgb, lower_face)
    cheek_luma = 0.299 * cheek[0] + 0.587 * cheek[1] + 0.114 * cheek[2]
    chin_luma = 0.299 * chin[0] + 0.587 * chin[1] + 0.114 * chin[2]
    facial_hair = "visible" if (cheek_luma - chin_luma) > 18 else "none_or_light"

    notes = [
        f"face shape from photo crop {face[2] - face[0]}x{face[3] - face[1]}",
        f"skin maps to { _nearest_name(skin, SKIN_BANDS) }",
        f"hair maps to { _nearest_name(hair, HAIR_BANDS) }",
    ]
    if facial_hair == "visible":
        notes.append("lower-face is darker than mid-face — keep facial hair")

    return {
        "skinTone": _nearest_name(skin, SKIN_BANDS),
        "skinRgb": list(skin),
        "hairColor": _nearest_name(hair, HAIR_BANDS),
        "hairRgb": list(hair),
        "facialHair": facial_hair,
        "clothingRgb": list(clothes),
        "faceBox": list(face),
        "notes": notes,
    }


def _grade_portrait(crop: Image.Image) -> Image.Image:
    graded = ImageEnhance.Contrast(crop).enhance(1.12)
    graded = ImageEnhance.Color(graded).enhance(1.06)
    graded = ImageEnhance.Sharpness(graded).enhance(1.15)
    overlay = Image.new("RGB", graded.size, (18, 24, 36))
    graded = Image.blend(graded, overlay, 0.10)
    return graded


def _vignette(image: Image.Image, strength: float = 0.42) -> Image.Image:
    w, h = image.size
    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)
    inset = int(min(w, h) * 0.06)
    draw.ellipse((-inset, -inset, w + inset, h + inset), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(radius=min(w, h) * 0.16))
    darkened = ImageEnhance.Brightness(image).enhance(1.0 - strength)
    return Image.composite(image, darkened, mask)


def compose_portrait(source: Image.Image, traits: dict, role: str) -> Image.Image:
    """Honest photo crop. Frame chrome only — no invented body."""
    rgb = source.convert("RGB")
    face = tuple(traits["faceBox"])
    w, h = rgb.size
    fw = face[2] - face[0]
    fh = face[3] - face[1]
    box = (
        max(0, face[0] - int(fw * 0.18)),
        max(0, face[1] - int(fh * 0.28)),
        min(w, face[2] + int(fw * 0.18)),
        min(h, face[3] + int(fh * 0.38)),
    )
    crop = rgb.crop(box)
    canvas = ImageOps.fit(crop, (512, 640), Image.Resampling.LANCZOS, centering=(0.5, 0.38))
    canvas = _grade_portrait(canvas)
    canvas = _vignette(canvas, 0.34)

    frame = Image.new("RGB", (512, 640), (10, 10, 15))
    frame.paste(canvas, (0, 0))
    draw = ImageDraw.Draw(frame, "RGBA")
    accent = ROLE_COLORS.get(role, (74, 222, 128))
    draw.rectangle((8, 8, 503, 631), outline=accent + (220,), width=4)
    draw.rectangle((14, 14, 497, 625), outline=(245, 245, 247, 70), width=1)
    return frame.convert("RGB")


def encode_png(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def compose_member_assets(
    source_path: str,
    role: str,
    style: str,
    outputs: list[str],
) -> dict:
    """Photo-crop only. Requested full-body / token outputs stay locked."""
    _ = style
    with Image.open(source_path) as raw:
        source = raw.convert("RGB")
        max_edge = 1600
        if max(source.size) > max_edge:
            source.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
        traits = analyze_photo(source)
        files: dict[str, bytes] = {}
        if "portrait" in outputs or not outputs:
            files["portrait"] = encode_png(compose_portrait(source, traits, role))
        return {
            "likenessTraits": {
                "skinTone": traits["skinTone"],
                "hairColor": traits["hairColor"],
                "facialHair": traits["facialHair"],
                "clothingColors": [traits["skinTone"], _nearest_name(tuple(traits["clothingRgb"]), HAIR_BANDS)],
                "notes": traits["notes"],
            },
            "files": files,
            "bodyLocked": True,
        }


def build_identity_prompt(traits: dict, role: str, style: str, camera: str) -> str:
    clothing = STYLE_CLOTHING.get(style, STYLE_CLOTHING["south_florida_streetwear"])
    hair = traits.get("hairColor", "dark")
    skin = traits.get("skinTone", "medium")
    facial = "Keep the same facial hair." if traits.get("facialHair") == "visible" else "Do not invent heavy facial hair."
    notes = "; ".join(traits.get("notes") or [])
    return (
        "SCENE\n"
        f"SLIDE custom crew card. {GTA_ART_DIRECTION} Clean silhouette, "
        "transparent-friendly dark ground, no scenery, no HUD text.\n\n"
        "SUBJECT\n"
        f"A fictional playable {role} whose face is the same person as the "
        "uploaded identity-reference photo. Cosmetic game avatar only — not "
        "a real-world accusation.\n\n"
        "IMPORTANT DETAILS\n"
        f"Preserve face shape, eye spacing, nose, jaw, skin tone ({skin}), "
        f"hair color and hairline ({hair}). {facial} Clothing: {clothing['notes']}. "
        f"Role readable as {role}. Camera: {camera}. {notes}\n\n"
        "USE CASE\n"
        "Crew roster portrait / full-body card / in-game token. Same identity "
        "and wardrobe across every generated state.\n\n"
        "CONSTRAINTS\n"
        "The uploaded photo is the identity reference — keep this person. "
        "No South Park, clip-art, vector, stick-figure, emoji, or mascot look. "
        "No real brand logos, watermarks, baked UI text, real criminal "
        "organizations, minors, or photoreal nude content."
    )


def gpt_image_models() -> list[str]:
    """Latest-first GPT Image list. DALL·E values in env are ignored."""
    requested = (os.environ.get("SLIDE_AVATAR_MODEL") or "").strip()
    models: list[str] = []
    if requested and "dall-e" not in requested.lower() and requested.lower().startswith("gpt-image"):
        models.append(requested)
    elif requested and "dall-e" not in requested.lower() and requested:
        # Allow a future gpt-image name the owner pins, but never DALL·E.
        if not requested.lower().startswith("dall"):
            models.append(requested)
    for name in GPT_IMAGE_MODELS:
        if name not in models:
            models.append(name)
    return [name for name in models if "dall-e" not in name.lower()]


def provider_status() -> dict:
    has_key = bool((os.environ.get("OPENAI_API_KEY") or "").strip())
    models = gpt_image_models()
    return {
        "provider": "gpt_image" if has_key else "photo_crop",
        "aiConfigured": has_key,
        "requestedProvider": "gpt_image" if has_key else "photo_crop",
        "model": models[0] if has_key else None,
        "candidateModels": list(models) if has_key else [],
        "bodyLockedUntilConfigured": not has_key,
        "requiredForAi": {
            "env": ["OPENAI_API_KEY"],
            "optionalEnv": [
                "SLIDE_AVATAR_MODEL (optional pin; default tries gpt-image-2, then gpt-image-1.5, then gpt-image-1)"
            ],
            "pythonPackage": "openai>=1.40.0",
            "notes": (
                "OPENAI_API_KEY alone enables GPT Image. Without it the roster "
                "shows the real photo crop and the body stays locked. Generation "
                "never falls back to DALL·E or a stick-figure body."
            ),
        },
    }
