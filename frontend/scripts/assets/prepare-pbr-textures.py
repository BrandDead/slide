#!/usr/bin/env python3
"""Prepare compact runtime PBR maps from ambientCG 1K-JPG archives."""

from __future__ import annotations

import hashlib
import json
import sys
import zipfile
from io import BytesIO
from pathlib import Path

from PIL import Image

MAP_SUFFIXES = {
    "color": "_Color.jpg",
    "normal": "_NormalGL.jpg",
    "roughness": "_Roughness.jpg",
}


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def prepare_archive(archive_path: Path, output_dir: Path) -> dict[str, object]:
    asset_id = archive_path.name.split("_1K-JPG.zip", 1)[0]
    output_stem = asset_id.lower()
    written: list[dict[str, object]] = []

    with zipfile.ZipFile(archive_path) as archive:
        names = archive.namelist()
        for map_name, suffix in MAP_SUFFIXES.items():
            matches = [name for name in names if name.endswith(suffix)]
            if len(matches) != 1:
                raise RuntimeError(f"{archive_path}: expected one {suffix} map, found {matches}")
            source_name = matches[0]
            source_bytes = archive.read(source_name)
            with Image.open(BytesIO(source_bytes)) as image:
                image = image.convert("RGB")
                image.thumbnail((512, 512), Image.Resampling.LANCZOS)
                output_path = output_dir / f"{output_stem}-{map_name}.webp"
                output_dir.mkdir(parents=True, exist_ok=True)
                image.save(output_path, "WEBP", quality=86, method=6)
            output_bytes = output_path.read_bytes()
            written.append(
                {
                    "map": map_name,
                    "sourceFile": source_name,
                    "runtimeFile": output_path.name,
                    "width": image.width,
                    "height": image.height,
                    "bytes": len(output_bytes),
                    "sha256": digest(output_bytes),
                }
            )

    return {
        "assetId": asset_id,
        "sourceArchive": archive_path.name,
        "sourceSha256": digest(archive_path.read_bytes()),
        "license": "CC0-1.0",
        "sourceUrl": f"https://ambientcg.com/a/{asset_id}",
        "maps": written,
    }


def main() -> None:
    if len(sys.argv) < 3:
        raise SystemExit("Usage: prepare-pbr-textures.py <output-dir> <ambientcg-archive> [...]")
    output_dir = Path(sys.argv[1]).resolve()
    archives = [Path(value).resolve() for value in sys.argv[2:]]
    manifest = {
        "schemaVersion": 1,
        "generator": "frontend/scripts/assets/prepare-pbr-textures.py",
        "assets": [prepare_archive(archive, output_dir) for archive in archives],
    }
    (output_dir / "pbr-sources.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
