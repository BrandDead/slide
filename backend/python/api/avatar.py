"""
avatar.py — Photo-to-member generation API
POST /api/avatar/generate
GET  /api/avatar/status/<job_id>
GET  /api/avatar/asset/<job_id>/<kind>
GET  /api/avatar/provider
POST /api/avatar/approve

The default path is a local photo-likeness compositor. Stock role art is
never returned as if it came from the uploaded photo. Optional OpenAI
restyle is used only when explicitly configured and the call succeeds.
"""

import base64
import os
import uuid
from utils.utc import utc_now_iso
from flask import Blueprint, request, jsonify, send_file

from services.likeness import (
    ALLOWED_MIME,
    MAX_UPLOAD_BYTES,
    build_identity_prompt,
    compose_member_assets,
    provider_status,
)

avatar_bp = Blueprint("avatar", __name__, url_prefix="/api/avatar")

# In-memory job store (replace with private object storage in production)
_jobs: dict = {}
_ASSET_ROOT = "/tmp/slide_generated"


def _data_url(png_bytes: bytes) -> str:
    return "data:image/png;base64," + base64.b64encode(png_bytes).decode("ascii")


def _write_assets(job_id: str, files: dict[str, bytes]) -> dict[str, str]:
    job_dir = os.path.join(_ASSET_ROOT, job_id)
    os.makedirs(job_dir, exist_ok=True)
    urls = {}
    for kind, payload in files.items():
        path = os.path.join(job_dir, f"{kind}.png")
        with open(path, "wb") as handle:
            handle.write(payload)
        urls[kind] = f"/api/avatar/asset/{job_id}/{kind}"
    return urls


class AvatarGenerationProvider:
    """Base provider. Override generate_member_assets for real AI."""

    name = "base"

    def generate_member_assets(
        self,
        source_image_path: str,
        role: str,
        style: str,
        outputs: list[str],
    ) -> dict:
        raise NotImplementedError


class LocalLikenessProvider(AvatarGenerationProvider):
    """Compose roster cards that keep the uploaded face."""

    name = "local_photo_likeness"

    def generate_member_assets(self, source_image_path, role, style, outputs):
        composed = compose_member_assets(source_image_path, role, style, outputs)
        traits = composed["likenessTraits"]
        camera = "chest-up portrait, dramatic noir lighting"
        prompt = build_identity_prompt(traits, role, style, camera)
        return {
            "files": composed["files"],
            "likenessTraits": traits,
            "promptUsed": prompt,
            "provider": self.name,
        }


class OpenAIAvatarProvider(AvatarGenerationProvider):
    """
    Optional OpenAI image edit. Requires OPENAI_API_KEY and
    SLIDE_AVATAR_PROVIDER=openai. Failures must fall back to local likeness
    rather than stock art.
    """

    name = "openai"

    def generate_member_assets(self, source_image_path, role, style, outputs):
        try:
            import openai  # type: ignore
        except ImportError as exc:
            raise RuntimeError(
                "openai package is not installed. pip install 'openai>=1.40.0'"
            ) from exc

        local = LocalLikenessProvider().generate_member_assets(
            source_image_path, role, style, outputs
        )
        client = openai.OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
        model = os.environ.get("SLIDE_AVATAR_MODEL") or "gpt-image-1"
        files = dict(local["files"])
        traits = local["likenessTraits"]

        cameras = {
            "portrait": "chest-up portrait, dramatic noir lighting",
            "fullbody": "full body, front-facing neutral pose, feet visible",
            "topdown": "overhead 85-degree tactical token, full figure",
        }

        for output in outputs:
            prompt = build_identity_prompt(traits, role, style, cameras.get(output, output))
            with open(source_image_path, "rb") as img_file:
                try:
                    response = client.images.edit(
                        model=model,
                        image=img_file,
                        prompt=prompt,
                        n=1,
                        size="1024x1024",
                    )
                except Exception:
                    # Older SDKs / dall-e-2 still accept this shape.
                    img_file.seek(0)
                    response = client.images.edit(
                        model="dall-e-2",
                        image=img_file,
                        prompt=prompt,
                        n=1,
                        size="1024x1024",
                    )
            payload = response.data[0]
            if getattr(payload, "b64_json", None):
                files[output] = base64.b64decode(payload.b64_json)
            elif getattr(payload, "url", None):
                import requests
                downloaded = requests.get(payload.url, timeout=30)
                downloaded.raise_for_status()
                files[output] = downloaded.content
            else:
                raise RuntimeError("OpenAI image response had no bytes")

        return {
            "files": files,
            "likenessTraits": traits,
            "promptUsed": prompt,
            "provider": self.name,
        }


def get_provider() -> AvatarGenerationProvider:
    status = provider_status()
    if status["aiConfigured"]:
        return OpenAIAvatarProvider()
    return LocalLikenessProvider()


def _require_consent(form) -> str | None:
    permission = form.get("consentPermission") or form.get("consent_permission")
    adult = form.get("consentAdult") or form.get("consent_adult")
    processing = form.get("consentProcessing") or form.get("consent_processing")
    if permission not in ("1", "true", "yes", "on"):
        return "Permission from the person in the photo is required."
    if adult not in ("1", "true", "yes", "on"):
        return "This feature is only for photos of adults (18+)."
    if processing not in ("1", "true", "yes", "on"):
        return "AI/image processing consent is required."
    return None


@avatar_bp.route("/provider", methods=["GET"])
def provider():
    """Report whether optional AI restyle is configured."""
    return jsonify(provider_status()), 200


@avatar_bp.route("/generate", methods=["POST"])
def generate():
    """
    POST /api/avatar/generate
    multipart/form-data:
      image, role, style, outputs[], consentPermission, consentAdult, consentProcessing
    """
    consent_error = _require_consent(request.form)
    if consent_error:
        return jsonify({"error": consent_error, "code": "consent_required"}), 400

    if "image" not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    image_file = request.files["image"]
    mime = (image_file.mimetype or "").lower()
    if mime not in ALLOWED_MIME:
        return jsonify({"error": "Upload a JPG, PNG, WEBP, or GIF photo."}), 400

    image_file.seek(0, os.SEEK_END)
    size = image_file.tell()
    image_file.seek(0)
    if size > MAX_UPLOAD_BYTES:
        return jsonify({"error": "Photo must be 8 MB or smaller."}), 400

    role = request.form.get("role", "dealer")
    style = request.form.get("style", "south_florida_streetwear")
    outputs = request.form.getlist("outputs") or ["portrait", "fullbody"]

    upload_dir = "/tmp/slide_uploads"
    os.makedirs(upload_dir, exist_ok=True)
    ext = os.path.splitext(image_file.filename or "img.jpg")[1] or ".jpg"
    tmp_path = os.path.join(upload_dir, f"{uuid.uuid4()}{ext}")
    image_file.save(tmp_path)

    job_id = str(uuid.uuid4())
    provider = get_provider()
    ai_error = None

    try:
        try:
            generated = provider.generate_member_assets(tmp_path, role, style, outputs)
        except Exception as exc:
            if provider.name != "local_photo_likeness":
                ai_error = str(exc)
                generated = LocalLikenessProvider().generate_member_assets(
                    tmp_path, role, style, outputs
                )
            else:
                return jsonify({"error": str(exc)}), 500
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

    files = generated.pop("files")
    urls = _write_assets(job_id, files)
    asset = {
        "id": job_id,
        "role": role,
        "style": style,
        "outputs": outputs,
        "status": "ready",
        "createdAt": utc_now_iso(),
        "sourcePhotoRetained": False,
        "stockPreview": False,
        **generated,
        "portraitUrl": urls.get("portrait") or _data_url(files["portrait"]) if "portrait" in files else None,
        "fullbodyUrl": urls.get("fullbody") or _data_url(files["fullbody"]) if "fullbody" in files else None,
        "topdownUrl": urls.get("topdown") or _data_url(files["topdown"]) if "topdown" in files else None,
        "portraitDataUrl": _data_url(files["portrait"]) if "portrait" in files else None,
        "fullbodyDataUrl": _data_url(files["fullbody"]) if "fullbody" in files else None,
        "topdownDataUrl": _data_url(files["topdown"]) if "topdown" in files else None,
    }
    if ai_error:
        asset["aiProviderError"] = ai_error
        asset["provider"] = "local_photo_likeness"
    _jobs[job_id] = asset
    return jsonify({"asset": asset}), 200


@avatar_bp.route("/asset/<job_id>/<kind>", methods=["GET"])
def asset_file(job_id: str, kind: str):
    if kind not in {"portrait", "fullbody", "topdown"}:
        return jsonify({"error": "Unknown asset"}), 404
    path = os.path.join(_ASSET_ROOT, job_id, f"{kind}.png")
    if not os.path.exists(path):
        return jsonify({"error": "Asset not found"}), 404
    return send_file(path, mimetype="image/png")


@avatar_bp.route("/status/<job_id>", methods=["GET"])
def status(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    return jsonify(job), 200


@avatar_bp.route("/approve", methods=["POST"])
def approve():
    data = request.get_json(silent=True) or {}
    asset_id = data.get("assetId")
    if not asset_id or asset_id not in _jobs:
        return jsonify({"error": "Asset not found"}), 404

    _jobs[asset_id]["status"] = "approved"
    return jsonify(_jobs[asset_id]), 200
