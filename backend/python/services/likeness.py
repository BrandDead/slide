"""Local photo-likeness analysis and character-card compositor.

This is the no-key path for custom crew members. It never invents a
different face. The uploaded photo is the identity; role/style only
change the fictional card around that face.

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
        "top": (36, 36, 40),
        "accent": (74, 222, 128),
        "bottom": (28, 42, 64),
        "notes": "oversized tee, baggy jeans, sneakers, thin chain",
    },
    "luxury_noir": {
        "label": "luxury noir",
        "top": (18, 16, 20),
        "accent": (212, 175, 55),
        "bottom": (24, 22, 28),
        "notes": "dark tailored layers, gold hardware, no real logos",
    },
    "masked_tactical": {
        "label": "tactical streetwear",
        "top": (32, 38, 34),
        "accent": (120, 140, 90),
        "bottom": (28, 32, 28),
        "notes": "utility vest, muted olive, pulled collar — face stays visible",
    },
    "baggy_2000s": {
        "label": "baggy 2000s streetwear",
        "top": (48, 28, 72),
        "accent": (250, 204, 21),
        "bottom": (22, 22, 28),
        "notes": "oversized jersey, baggy jeans, work boots",
    },
    "clean_designer": {
        "label": "clean designer streetwear",
        "top": (232, 232, 228),
        "accent": (96, 165, 250),
        "bottom": (40, 40, 48),
        "notes": "fitted knit, clean sneakers, quiet jewelry",
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


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


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
        # Typical portrait fallback: upper-center.
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
    """Extract likeness traits used for prompts and the local card."""
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
    # Warm highlight / cool shadow grade without washing identity.
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
    rgb = source.convert("RGB")
    face = tuple(traits["faceBox"])
    # Include hair and a bit of shoulders so the crop still looks like the person.
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


def _draw_body(
    draw: ImageDraw.ImageDraw,
    traits: dict,
    role: str,
    style: str,
    origin: tuple[int, int],
) -> None:
    x, y = origin
    clothing = STYLE_CLOTHING.get(style, STYLE_CLOTHING["south_florida_streetwear"])
    skin = tuple(traits["skinRgb"])
    top = clothing["top"]
    bottom = clothing["bottom"]
    accent = clothing["accent"]
    role_color = ROLE_COLORS.get(role, (74, 222, 128))

    # Neck
    draw.rectangle((x + 86, y + 132, x + 118, y + 168), fill=skin)
    # Torso
    if style == "masked_tactical":
        draw.rounded_rectangle((x + 48, y + 156, x + 156, y + 320), radius=10, fill=top)
        draw.rounded_rectangle((x + 58, y + 170, x + 146, y + 250), radius=6, fill=(40, 46, 40))
        draw.rectangle((x + 70, y + 186, x + 134, y + 196), fill=accent)
    elif style == "luxury_noir":
        draw.rounded_rectangle((x + 52, y + 156, x + 152, y + 330), radius=8, fill=top)
        draw.polygon([(x + 102, y + 156), (x + 70, y + 250), (x + 134, y + 250)], fill=accent)
    else:
        draw.rounded_rectangle((x + 44, y + 156, x + 160, y + 318), radius=16, fill=top)
        draw.rectangle((x + 44, y + 300, x + 160, y + 318), fill=accent)

    # Arms
    draw.rounded_rectangle((x + 16, y + 168, x + 50, y + 300), radius=12, fill=top)
    draw.rounded_rectangle((x + 154, y + 168, x + 188, y + 300), radius=12, fill=top)
    draw.ellipse((x + 14, y + 292, x + 52, y + 330), fill=skin)
    draw.ellipse((x + 152, y + 292, x + 190, y + 330), fill=skin)
    # Legs
    draw.rounded_rectangle((x + 56, y + 314, x + 96, y + 470), radius=10, fill=bottom)
    draw.rounded_rectangle((x + 108, y + 314, x + 148, y + 470), radius=10, fill=bottom)
    # Shoes
    draw.rounded_rectangle((x + 46, y + 462, x + 102, y + 492), radius=8, fill=role_color)
    draw.rounded_rectangle((x + 102, y + 462, x + 158, y + 492), radius=8, fill=role_color)


def compose_fullbody(source: Image.Image, traits: dict, role: str, style: str) -> Image.Image:
    card = Image.new("RGB", (512, 768), (10, 10, 15))
    draw = ImageDraw.Draw(card, "RGBA")
    # Wet-night ground and horizon so the card matches the diorama grade.
    draw.rectangle((0, 520, 512, 768), fill=(16, 18, 24))
    draw.rectangle((0, 0, 512, 520), fill=(14, 16, 22))
    for i in range(8):
        y = 530 + i * 28
        draw.line((0, y, 512, y), fill=(24, 28, 36), width=1)

    origin = (154, 86)
    _draw_body(draw, traits, role, style, origin)

    rgb = source.convert("RGB")
    face = tuple(traits["faceBox"])
    w, h = rgb.size
    fw = face[2] - face[0]
    fh = face[3] - face[1]
    head_box = (
        max(0, face[0] - int(fw * 0.12)),
        max(0, face[1] - int(fh * 0.22)),
        min(w, face[2] + int(fw * 0.12)),
        min(h, face[3] + int(fh * 0.08)),
    )
    head = ImageOps.fit(rgb.crop(head_box), (168, 176), Image.Resampling.LANCZOS, centering=(0.5, 0.35))
    head = _grade_portrait(head)
    mask = Image.new("L", head.size, 0)
    ImageDraw.Draw(mask).ellipse((4, 2, 164, 174), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(1.4))
    card.paste(head, (origin[0] + 18, origin[1] - 8), mask)

    accent = ROLE_COLORS.get(role, (74, 222, 128))
    draw.rectangle((16, 16, 495, 751), outline=accent, width=3)
    draw.rectangle((24, 700, 488, 736), fill=(10, 10, 15))
    draw.rectangle((24, 700, 488, 736), outline=accent, width=1)
    return card.convert("RGB")


def compose_topdown(source: Image.Image, traits: dict, role: str) -> Image.Image:
    token = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    draw = ImageDraw.Draw(token, "RGBA")
    accent = ROLE_COLORS.get(role, (74, 222, 128))
    draw.ellipse((8, 8, 247, 247), fill=(10, 10, 15, 255), outline=accent + (255,), width=10)

    rgb = source.convert("RGB")
    face = tuple(traits["faceBox"])
    head = ImageOps.fit(rgb.crop(face), (196, 196), Image.Resampling.LANCZOS, centering=(0.5, 0.32))
    head = _grade_portrait(head)
    mask = Image.new("L", head.size, 0)
    ImageDraw.Draw(mask).ellipse((2, 2, 193, 193), fill=255)
    token.paste(head, (30, 30), mask)
    return token


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
    with Image.open(source_path) as raw:
        source = raw.convert("RGB")
        # Bound analysis cost on huge camera rolls.
        max_edge = 1600
        if max(source.size) > max_edge:
            source.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
        traits = analyze_photo(source)
        assets: dict = {
            "likenessTraits": {
                "skinTone": traits["skinTone"],
                "hairColor": traits["hairColor"],
                "facialHair": traits["facialHair"],
                "clothingColors": [traits["skinTone"], _nearest_name(tuple(traits["clothingRgb"]), HAIR_BANDS)],
                "notes": traits["notes"],
            },
            "files": {},
        }
        if "portrait" in outputs:
            assets["files"]["portrait"] = encode_png(compose_portrait(source, traits, role))
        if "fullbody" in outputs:
            assets["files"]["fullbody"] = encode_png(compose_fullbody(source, traits, role, style))
        if "topdown" in outputs:
            assets["files"]["topdown"] = encode_png(compose_topdown(source, traits, role))
        return assets


def build_identity_prompt(traits: dict, role: str, style: str, camera: str) -> str:
    clothing = STYLE_CLOTHING.get(style, STYLE_CLOTHING["south_florida_streetwear"])
    hair = traits.get("hairColor", "dark")
    skin = traits.get("skinTone", "medium")
    facial = "Keep the same facial hair." if traits.get("facialHair") == "visible" else "Do not invent heavy facial hair."
    notes = "; ".join(traits.get("notes") or [])
    return (
        "SCENE\n"
        "SLIDE custom crew card. Stylized-realistic 2.5D urban strategy character, "
        "cinematic tropical-noir grade, clean silhouette, transparent-friendly, no scenery.\n\n"
        "SUBJECT\n"
        f"A fictional playable {role} whose face is the same person as the reference photo. "
        "This is a cosmetic game avatar, not a real-world accusation.\n\n"
        "IMPORTANT DETAILS\n"
        f"Preserve face shape, eye spacing, nose, jaw, skin tone ({skin}), hair color and "
        f"hairline ({hair}). {facial} Clothing: {clothing['notes']}. Role readable as {role}. "
        f"Camera: {camera}. {notes}\n\n"
        "USE CASE\n"
        "Crew roster portrait / full-body card / top-down token at phone and desktop sizes.\n\n"
        "CONSTRAINTS\n"
        "Preserve identity from the reference. No real brand logos, no watermarks, no baked UI "
        "text, no real criminal organizations, no minors, no photoreal nude content."
    )


def provider_status() -> dict:
    requested = (os.environ.get("SLIDE_AVATAR_PROVIDER") or "local").strip().lower()
    has_key = bool(os.environ.get("OPENAI_API_KEY"))
    model = os.environ.get("SLIDE_AVATAR_MODEL") or "gpt-image-1"
    ai_ready = requested == "openai" and has_key
    return {
        "provider": "openai" if ai_ready else "local_photo_likeness",
        "aiConfigured": ai_ready,
        "requestedProvider": requested,
        "model": model if ai_ready else None,
        "requiredForAi": {
            "env": ["OPENAI_API_KEY", "SLIDE_AVATAR_PROVIDER=openai"],
            "optionalEnv": ["SLIDE_AVATAR_MODEL (default gpt-image-1)"],
            "pythonPackage": "openai>=1.40.0",
            "notes": (
                "Without those values the server composes a photo-based likeness card "
                "from the upload. It will not silently swap in stock role art. "
                "AI restyle is optional and only used when it succeeds."
            ),
        },
    }
