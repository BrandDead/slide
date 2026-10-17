"""Photo-likeness API: consent, photo crop, no vector bodies, GPT Image config."""

import io
import os
import sys

import pytest
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app import create_app
from config.slide_art_style import (
    GPT_IMAGE_FALLBACK,
    GPT_IMAGE_PRIMARY,
    IDENTITY,
    SAFETY,
    SHOTS,
    STYLE,
    compose_art_prompt,
    gpt_image_edit_params,
)
from services.likeness import (
    GTA_ART_DIRECTION,
    analyze_photo,
    build_identity_prompt,
    compose_member_assets,
    gpt_image_models,
    provider_status,
)


@pytest.fixture
def client():
    app = create_app()
    app.config['TESTING'] = True
    return app.test_client()


def _portrait_png(skin=(181, 131, 90), hair=(18, 16, 14), clothes=(36, 48, 80)) -> bytes:
    """Synthetic adult-looking portrait with distinct face / hair / clothing."""
    image = Image.new("RGB", (320, 400), (24, 28, 36))
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, 320, 90), fill=hair)
    draw.ellipse((70, 70, 250, 280), fill=skin)
    draw.rectangle((40, 270, 280, 400), fill=clothes)
    draw.ellipse((120, 140, 150, 170), fill=(40, 32, 28))
    draw.ellipse((170, 140, 200, 170), fill=(40, 32, 28))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _consent_form():
    return {
        "role": "dealer",
        "style": "south_florida_streetwear",
        "outputs": ["portrait", "fullbody", "topdown"],
        "consentPermission": "1",
        "consentAdult": "1",
        "consentProcessing": "1",
    }


def test_avatar_allows_documented_frontend_dev_origin(client):
    response = client.get('/api/avatar/provider', headers={'Origin': 'http://127.0.0.1:3000'})
    assert response.status_code == 200
    assert response.headers.get('Access-Control-Allow-Origin') == 'http://127.0.0.1:3000'


def test_provider_endpoint_reports_photo_crop_without_key(client, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("SLIDE_AVATAR_PROVIDER", raising=False)
    monkeypatch.delenv("SLIDE_AVATAR_MODEL", raising=False)
    response = client.get("/api/avatar/provider")
    assert response.status_code == 200
    data = response.get_json()
    assert data["provider"] == "photo_crop"
    assert data["aiConfigured"] is False
    assert data["bodyLockedUntilConfigured"] is True
    assert data["requiredForAi"]["env"] == ["OPENAI_API_KEY"]
    assert "SLIDE_AVATAR_PROVIDER" not in data["requiredForAi"]["env"]


def test_provider_status_enables_gpt_image_from_key_alone(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-not-real")
    monkeypatch.delenv("SLIDE_AVATAR_PROVIDER", raising=False)
    monkeypatch.delenv("SLIDE_AVATAR_MODEL", raising=False)
    status = provider_status()
    assert status["provider"] == "gpt_image"
    assert status["aiConfigured"] is True
    assert status["bodyLockedUntilConfigured"] is False
    assert status["model"] == GPT_IMAGE_PRIMARY
    assert status["size"] == "1024x1536"
    assert status["quality"] == "medium"
    assert status["candidateModels"][:2] == [GPT_IMAGE_PRIMARY, GPT_IMAGE_FALLBACK]


def test_gpt_image_models_flare_then_gpt_image_2(monkeypatch):
    monkeypatch.delenv("SLIDE_AVATAR_MODEL", raising=False)
    models = gpt_image_models()
    assert models[0] == "gpt-image-2.5-flare"
    assert models[1] == "gpt-image-2"
    assert "dall-e-2" not in models
    assert "gpt-image-1" not in models


def test_gpt_image_models_never_include_dalle(monkeypatch):
    monkeypatch.setenv("SLIDE_AVATAR_MODEL", "dall-e-2")
    models = gpt_image_models()
    assert models
    assert all("dall-e" not in name.lower() for name in models)
    assert models[0] == "gpt-image-2.5-flare"


def test_identity_prompt_locks_gta_cover_pieces():
    prompt = build_identity_prompt(
        {"skinTone": "bronze", "hairColor": "black", "facialHair": "visible", "notes": []},
        "shooter",
        "south_florida_streetwear",
        "fullbody",
    )
    assert STYLE in prompt
    assert SHOTS["fullbody"] in prompt
    assert IDENTITY in prompt
    assert SAFETY in prompt
    assert GTA_ART_DIRECTION == STYLE
    lowered = prompt.lower()
    assert "south park" in lowered
    assert "identity lock" in lowered
    assert "head to shoes" in lowered
    assert "dall-e" not in lowered


def test_style_module_shares_style_across_states_and_props():
    portrait = compose_art_prompt("portrait")
    idle = compose_art_prompt("idle")
    prop = compose_art_prompt("prop")
    assert portrait.startswith(STYLE)
    assert idle.startswith(STYLE)
    assert prop.startswith(STYLE)
    assert SHOTS["portrait"] in portrait
    assert SHOTS["idle"] in idle
    assert SHOTS["prop"] in prop
    assert IDENTITY in idle and SAFETY in prop


def test_edit_params_are_flare_card_size():
    params = gpt_image_edit_params("locked prompt")
    assert params == {
        "prompt": "locked prompt",
        "n": 1,
        "size": "1024x1536",
        "quality": "medium",
    }


def test_generate_requires_adult_and_permission_consent(client):
    png = _portrait_png()
    response = client.post(
        "/api/avatar/generate",
        data={
            "role": "dealer",
            "image": (io.BytesIO(png), "friend.png", "image/png"),
        },
        content_type="multipart/form-data",
    )
    assert response.status_code == 400
    assert response.get_json()["code"] == "consent_required"


def test_generate_without_key_returns_photo_crop_and_locks_body(client, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    png = _portrait_png(skin=(93, 64, 55), hair=(18, 16, 14), clothes=(48, 28, 72))
    form = _consent_form()
    form["image"] = (io.BytesIO(png), "friend.png", "image/png")
    response = client.post(
        "/api/avatar/generate",
        data=form,
        content_type="multipart/form-data",
    )
    assert response.status_code == 200
    asset = response.get_json()["asset"]
    assert asset["provider"] == "photo_crop"
    assert asset["stockPreview"] is False
    assert asset["sourcePhotoRetained"] is False
    assert asset["bodyLocked"] is True
    assert asset["fullbodyUrl"] is None
    assert asset["fullbodyDataUrl"] is None
    assert asset["topdownUrl"] is None
    assert asset["topdownDataUrl"] is None
    assert asset["likenessTraits"]["skinTone"] in {
        "chocolate", "espresso", "bronze", "toffee", "caramel",
    }
    assert asset["portraitUrl"].startswith("/api/avatar/asset/")
    assert asset["portraitDataUrl"].startswith("data:image/png;base64,")

    portrait = client.get(asset["portraitUrl"])
    assert portrait.status_code == 200
    assert portrait.mimetype == "image/png"
    assert len(portrait.data) > 20_000
    assert not any(
        stock in (asset["portraitUrl"] + asset.get("promptUsed", ""))
        for stock in (
            "character_dealer_male_blacktee_portrait",
            "/assets/generated/characters/portraits/",
        )
    )

    missing_body = client.get(asset["portraitUrl"].replace("portrait", "fullbody"))
    assert missing_body.status_code == 404


def test_source_upload_is_deleted_after_generate(client, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    png = _portrait_png()
    form = _consent_form()
    form["image"] = (io.BytesIO(png), "friend.png", "image/png")
    before = set(os.listdir("/tmp/slide_uploads")) if os.path.isdir("/tmp/slide_uploads") else set()
    response = client.post(
        "/api/avatar/generate",
        data=form,
        content_type="multipart/form-data",
    )
    assert response.status_code == 200
    after = set(os.listdir("/tmp/slide_uploads")) if os.path.isdir("/tmp/slide_uploads") else set()
    assert after <= before


def test_analyze_photo_reads_skin_and_hair_from_regions():
    image = Image.open(io.BytesIO(_portrait_png(
        skin=(212, 165, 116),
        hair=(210, 176, 96),
        clothes=(36, 36, 40),
    )))
    traits = analyze_photo(image)
    assert traits["skinTone"] in {"honey", "sand", "caramel", "ivory"}
    assert traits["hairColor"] in {"blonde", "platinum", "brown", "auburn"}


def test_compose_never_emits_vector_fullbody_or_topdown(tmp_path):
    path = tmp_path / "in.png"
    path.write_bytes(_portrait_png())
    composed = compose_member_assets(
        str(path), "shooter", "luxury_noir", ["portrait", "fullbody", "topdown"]
    )
    assert set(composed["files"]) == {"portrait"}
    assert composed["files"]["portrait"][:8] == b"\x89PNG\r\n\x1a\n"
    assert composed["bodyLocked"] is True


def test_gpt_image_failure_falls_back_to_photo_crop_not_vectors(client, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-not-real")

    def boom(*_args, **_kwargs):
        raise RuntimeError("gpt-image unavailable in test")

    monkeypatch.setattr(
        "api.avatar.OpenAIAvatarProvider.generate_member_assets",
        boom,
    )
    png = _portrait_png()
    form = _consent_form()
    form["image"] = (io.BytesIO(png), "friend.png", "image/png")
    response = client.post(
        "/api/avatar/generate",
        data=form,
        content_type="multipart/form-data",
    )
    assert response.status_code == 200
    asset = response.get_json()["asset"]
    assert asset["provider"] == "photo_crop"
    assert asset["bodyLocked"] is True
    assert asset["fullbodyUrl"] is None
    assert "gpt-image unavailable" in asset["aiProviderError"]


def test_edit_call_uses_flare_size_and_medium_quality(tmp_path):
    from api.avatar import OpenAIAvatarProvider

    captured: dict = {}

    class Payload:
        b64_json = __import__("base64").b64encode(b"\x89PNG\r\n\x1a\nxxxx").decode("ascii")
        url = None

    class Response:
        data = [Payload()]

    class FakeImages:
        def edit(self, **kwargs):
            captured.update(kwargs)
            return Response()

    class FakeClient:
        images = FakeImages()

    path = tmp_path / "ref.png"
    path.write_bytes(_portrait_png())
    payload = OpenAIAvatarProvider()._edit_with_model(
        FakeClient(), "gpt-image-2.5-flare", str(path), "STYLE prompt"
    )
    assert payload[:8] == b"\x89PNG\r\n\x1a\n"
    assert captured["model"] == "gpt-image-2.5-flare"
    assert captured["size"] == "1024x1536"
    assert captured["quality"] == "medium"
    assert captured["n"] == 1
    assert captured["prompt"] == "STYLE prompt"
    assert captured["image"] is not None
