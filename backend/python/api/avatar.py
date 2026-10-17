"""
avatar.py — Photo-to-member generation API
POST /api/avatar/generate
GET  /api/avatar/status/<job_id>
GET  /api/avatar/asset/<job_id>/<kind>
GET  /api/avatar/provider
POST /api/avatar/approve

Without OPENAI_API_KEY the server returns a real photo crop and locks
the body. With the key, GPT Image is the only likeness provider. Failures
fall back to the photo crop + bodyLocked — never DALL·E, never a
vector / stick-figure body.
"""

import base64
import os
import uuid
from utils.utc import utc_now_iso
from flask import Blueprint, request, jsonify, send_file

from config.slide_art_style import gpt_image_edit_params, gpt_image_models
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


class PhotoCropProvider(AvatarGenerationProvider):
    """Honest photo crop. Body stays locked until GPT Image is configured."""

    name = "photo_crop"

    def generate_member_assets(self, source_image_path, role, style, outputs):
        requested = outputs or ["portrait"]
        if "portrait" not in requested:
            requested = ["portrait", *requested]
        composed = compose_member_assets(source_image_path, role, style, requested)
        traits = composed["likenessTraits"]
        prompt = build_identity_prompt(traits, role, style, "portrait")
        return {
            "files": composed["files"],
            "likenessTraits": traits,
            "promptUsed": prompt,
            "provider": self.name,
            "bodyLocked": True,
        }


class OpenAIAvatarProvider(AvatarGenerationProvider):
    """
    GPT Image only. Requires OPENAI_API_KEY. Uses the uploaded photo as
    the identity reference. Never calls DALL·E.
    """

    name = "gpt_image"

    def generate_member_assets(self, source_image_path, role, style, outputs):
        try:
            import openai  # type: ignore
        except ImportError as exc:
            raise RuntimeError(
                "openai package is not installed. pip install 'openai>=1.40.0'"
            ) from exc

        crop = PhotoCropProvider().generate_member_assets(
            source_image_path, role, style, ["portrait"]
        )
        client = openai.OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
        traits = crop["likenessTraits"]
        requested = outputs or ["portrait", "fullbody"]
        files: dict[str, bytes] = {}
        last_error: Exception | None = None
        used_model: str | None = None
        last_prompt = crop["promptUsed"]

        for output in requested:
            prompt = build_identity_prompt(traits, role, style, output)
            last_prompt = prompt
            generated = None
            for model in gpt_image_models():
                if "dall-e" in model.lower():
                    continue
                try:
                    generated = self._edit_with_model(
                        client, model, source_image_path, prompt
                    )
                    used_model = model
                    break
                except Exception as exc:
                    last_error = exc
                    continue
            if generated is None:
                raise RuntimeError(
                    f"GPT Image failed for {output}: {last_error}"
                )
            files[output] = generated

        return {
            "files": files,
            "likenessTraits": traits,
            "promptUsed": last_prompt,
            "provider": self.name,
            "bodyLocked": "fullbody" not in files,
            "model": used_model,
        }

    def _edit_with_model(self, client, model: str, image_path: str, prompt: str) -> bytes:
        if "dall-e" in model.lower():
            raise RuntimeError(f"Refusing forbidden model {model}")
        params = gpt_image_edit_params(prompt)
        with open(image_path, "rb") as img_file:
            try:
                response = client.images.edit(
                    model=model,
                    image=img_file,
                    **params,
                )
            except TypeError:
                img_file.seek(0)
                slim = {key: value for key, value in params.items() if key != "quality"}
                try:
                    response = client.images.edit(
                        model=model,
                        image=img_file,
                        **slim,
                    )
                except TypeError:
                    img_file.seek(0)
                    response = client.images.edit(
                        model=model,
                        image=img_file,
                        prompt=prompt,
                    )
        payload = response.data[0]
        if getattr(payload, "b64_json", None):
            return base64.b64decode(payload.b64_json)
        if getattr(payload, "url", None):
            import requests
            downloaded = requests.get(payload.url, timeout=45)
            downloaded.raise_for_status()
            return downloaded.content
        raise RuntimeError("GPT Image response had no bytes")


def get_provider() -> AvatarGenerationProvider:
    status = provider_status()
    if status["aiConfigured"]:
        return OpenAIAvatarProvider()
    return PhotoCropProvider()


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
    """Report whether GPT Image is configured."""
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
    selected = get_provider()
    ai_error = None

    try:
        try:
            generated = selected.generate_member_assets(tmp_path, role, style, outputs)
        except Exception as exc:
            if selected.name != "photo_crop":
                ai_error = str(exc)
                generated = PhotoCropProvider().generate_member_assets(
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
        "portraitUrl": urls.get("portrait"),
        "fullbodyUrl": urls.get("fullbody"),
        "topdownUrl": urls.get("topdown"),
        "portraitDataUrl": _data_url(files["portrait"]) if "portrait" in files else None,
        "fullbodyDataUrl": _data_url(files["fullbody"]) if "fullbody" in files else None,
        "topdownDataUrl": _data_url(files["topdown"]) if "topdown" in files else None,
        "bodyLocked": bool(generated.get("bodyLocked", "fullbody" not in files)),
    }
    if ai_error:
        asset["aiProviderError"] = ai_error
        asset["provider"] = "photo_crop"
        asset["bodyLocked"] = True
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
