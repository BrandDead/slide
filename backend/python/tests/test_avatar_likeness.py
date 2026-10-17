"""Photo-likeness API: consent, no stock swap, source deletion, provider honesty."""

import io
import os
import sys

import pytest
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app import create_app
from services.likeness import analyze_photo, compose_member_assets


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


def test_provider_endpoint_reports_local_without_key(client, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("SLIDE_AVATAR_PROVIDER", raising=False)
    response = client.get("/api/avatar/provider")
    assert response.status_code == 200
    data = response.get_json()
    assert data["provider"] == "local_photo_likeness"
    assert data["aiConfigured"] is False
    assert "OPENAI_API_KEY" in data["requiredForAi"]["env"]


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


def test_generate_returns_photo_likeness_not_stock(client, tmp_path):
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
    assert asset["provider"] == "local_photo_likeness"
    assert asset["stockPreview"] is False
    assert asset["sourcePhotoRetained"] is False
    assert asset["likenessTraits"]["skinTone"] in {
        "chocolate", "espresso", "bronze", "toffee", "caramel",
    }
    assert asset["portraitUrl"].startswith("/api/avatar/asset/")
    assert asset["portraitDataUrl"].startswith("data:image/png;base64,")

    portrait = client.get(asset["portraitUrl"])
    assert portrait.status_code == 200
    assert portrait.mimetype == "image/png"
    assert not any(
        stock in (asset["portraitUrl"] + asset.get("promptUsed", ""))
        for stock in (
            "character_dealer_male_blacktee_portrait",
            "/assets/generated/characters/portraits/",
        )
    )


def test_source_upload_is_deleted_after_generate(client, monkeypatch):
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


def test_compose_outputs_only_requested_kinds(tmp_path):
    path = tmp_path / "in.png"
    path.write_bytes(_portrait_png())
    composed = compose_member_assets(str(path), "shooter", "luxury_noir", ["portrait"])
    assert set(composed["files"]) == {"portrait"}
    assert composed["files"]["portrait"][:8] == b"\x89PNG\r\n\x1a\n"
