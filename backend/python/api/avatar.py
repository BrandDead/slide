"""
avatar.py — Photo-to-member generation API
POST /api/avatar/generate
GET  /api/avatar/status/<job_id>
POST /api/avatar/approve

Sprint: morale-heat-photo-batch2
"""

import os
import uuid
import json
from datetime import datetime
from flask import Blueprint, request, jsonify

avatar_bp = Blueprint("avatar", __name__, url_prefix="/api/avatar")

# In-memory job store (replace with DB in production)
_jobs: dict = {}


# ─── Provider abstraction ────────────────────────────────────

class AvatarGenerationProvider:
    """Base provider. Override generate_member_assets for real AI."""

    def generate_member_assets(
        self,
        source_image_path: str,
        role: str,
        style: str,
        outputs: list[str],
    ) -> dict:
        raise NotImplementedError


class MockAvatarProvider(AvatarGenerationProvider):
    """Returns placeholder asset URLs immediately — no external API needed."""

    MOCK_PORTRAITS = {
        "dealer":   "/assets/generated/characters/portraits/character_dealer_male_blacktee_portrait_v001.png",
        "enforcer": "/assets/generated/characters/portraits/character_enforcer_male_portrait_v001.png",
        "lookout":  "/assets/generated/characters/portraits/character_lookout_female_portrait_v001.png",
        "driver":   "/assets/generated/characters/portraits/character_driver_male_portrait_v001.png",
    }
    MOCK_FULLBODY = {
        "dealer":   "/assets/generated/characters/fullbody/character_dealer_male_blacktee_fullbody_front_v001.png",
        "enforcer": "/assets/generated/characters/fullbody/character_enforcer_male_fullbody_front_v001.png",
        "lookout":  "/assets/generated/characters/fullbody/character_lookout_female_fullbody_front_v001.png",
        "driver":   "/assets/generated/characters/fullbody/character_driver_male_fullbody_front_v001.png",
    }
    MOCK_TOPDOWN = {
        "dealer":   "/assets/generated/characters/topdown/character_dealer_male_blacktee_topdown_v001.png",
        "enforcer": "/assets/generated/characters/topdown/character_enforcer_male_topdown_v001.png",
    }

    def generate_member_assets(self, source_image_path, role, style, outputs):
        result = {}
        if "portrait" in outputs:
            result["portraitUrl"] = self.MOCK_PORTRAITS.get(role, self.MOCK_PORTRAITS["dealer"])
        if "fullbody" in outputs:
            result["fullbodyUrl"] = self.MOCK_FULLBODY.get(role, self.MOCK_FULLBODY["dealer"])
        if "topdown" in outputs:
            result["topdownUrl"] = self.MOCK_TOPDOWN.get(role, self.MOCK_TOPDOWN.get("dealer"))
        result["promptUsed"] = (
            f"Create a semi-realistic playable game character inspired by the uploaded reference image. "
            f"Preserve general likeness, face shape, skin tone, and hairstyle when visible, "
            f"but stylize into the SLIDE game universe. Outfit: {style}. Role: {role}. "
            f"Output: {', '.join(outputs)}. Clean silhouette, transparent-background friendly, "
            f"game-asset-ready, no scenery, no real brand logos."
        )
        return result


class OpenAIAvatarProvider(AvatarGenerationProvider):
    """
    Real OpenAI image-to-image provider.
    Requires OPENAI_API_KEY in environment.
    """

    def generate_member_assets(self, source_image_path, role, style, outputs):
        import openai  # type: ignore
        client = openai.OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

        style_map = {
            "south_florida_streetwear": "South Florida streetwear, baggy jeans, sneakers, chain",
            "luxury_noir": "luxury noir, dark designer clothing, gold accents",
            "masked_tactical": "masked tactical streetwear, balaclava, tactical vest",
            "baggy_2000s": "baggy 2000s streetwear, oversized tee, Timberlands",
            "clean_designer": "clean designer streetwear, fitted clothes, luxury accessories",
        }

        style_desc = style_map.get(style, style)
        result = {}

        for output in outputs:
            if output == "portrait":
                camera = "chest-up portrait, dramatic noir lighting"
            elif output == "fullbody":
                camera = "full body, front-facing neutral pose, feet visible"
            else:
                camera = "overhead 85-degree tactical view, full figure"

            prompt = (
                f"Create a semi-realistic playable game character inspired by the uploaded reference image. "
                f"Preserve general likeness, face shape, skin tone, and hairstyle when visible, "
                f"but stylize into a 2.5D urban strategy game universe. "
                f"Outfit: {style_desc}. Role: {role}. Camera: {camera}. "
                f"Clean silhouette, transparent-background friendly, game-asset-ready, "
                f"no scenery, no real brand logos, no watermarks."
            )

            with open(source_image_path, "rb") as img_file:
                response = client.images.edit(
                    model="dall-e-2",
                    image=img_file,
                    prompt=prompt,
                    n=1,
                    size="1024x1024",
                )
            url = response.data[0].url
            if output == "portrait":
                result["portraitUrl"] = url
            elif output == "fullbody":
                result["fullbodyUrl"] = url
            else:
                result["topdownUrl"] = url

        result["promptUsed"] = prompt
        return result


def get_provider() -> AvatarGenerationProvider:
    """Select provider based on available API keys."""
    if os.environ.get("OPENAI_API_KEY"):
        return OpenAIAvatarProvider()
    return MockAvatarProvider()


# ─── Routes ──────────────────────────────────────────────────

@avatar_bp.route("/generate", methods=["POST"])
def generate():
    """
    POST /api/avatar/generate
    Accepts multipart/form-data:
      - image: file
      - role: str
      - style: str
      - outputs: list[str] (repeated field)
    """
    if "image" not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    image_file = request.files["image"]
    role = request.form.get("role", "dealer")
    style = request.form.get("style", "south_florida_streetwear")
    outputs = request.form.getlist("outputs") or ["portrait", "fullbody"]

    # Save uploaded image temporarily
    upload_dir = "/tmp/slide_uploads"
    os.makedirs(upload_dir, exist_ok=True)
    ext = os.path.splitext(image_file.filename or "img.jpg")[1] or ".jpg"
    tmp_path = os.path.join(upload_dir, f"{uuid.uuid4()}{ext}")
    image_file.save(tmp_path)

    job_id = str(uuid.uuid4())
    provider = get_provider()

    try:
        assets = provider.generate_member_assets(tmp_path, role, style, outputs)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

    asset = {
        "id": job_id,
        "role": role,
        "style": style,
        "outputs": outputs,
        "status": "ready",
        "createdAt": datetime.utcnow().isoformat(),
        **assets,
    }
    _jobs[job_id] = asset

    return jsonify({"asset": asset}), 200


@avatar_bp.route("/status/<job_id>", methods=["GET"])
def status(job_id: str):
    """GET /api/avatar/status/<job_id>"""
    job = _jobs.get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    return jsonify(job), 200


@avatar_bp.route("/approve", methods=["POST"])
def approve():
    """POST /api/avatar/approve — marks an asset as approved"""
    data = request.get_json(silent=True) or {}
    asset_id = data.get("assetId")
    if not asset_id or asset_id not in _jobs:
        return jsonify({"error": "Asset not found"}), 404

    _jobs[asset_id]["status"] = "approved"
    return jsonify(_jobs[asset_id]), 200
