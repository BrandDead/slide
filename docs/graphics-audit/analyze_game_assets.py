from __future__ import annotations

import csv
import json
from collections import Counter
from pathlib import Path
from PIL import Image

ROOT = Path('/home/ubuntu/slide-audit/frontend/public/assets')
OUT_CSV = Path('/home/ubuntu/game_asset_inventory.csv')
OUT_JSON = Path('/home/ubuntu/game_asset_inventory_summary.json')
EXTENSIONS = {'.png', '.webp', '.jpg', '.jpeg', '.gif'}

rows = []
errors = []
for path in sorted(p for p in ROOT.rglob('*') if p.is_file() and p.suffix.lower() in EXTENSIONS):
    rel = path.relative_to(ROOT).as_posix()
    try:
        with Image.open(path) as image:
            image.load()
            mode = image.mode
            width, height = image.size
            has_alpha = 'A' in image.getbands() or 'transparency' in image.info
            transparent_fraction = 0.0
            partial_alpha_fraction = 0.0
            green_fringe_fraction = 0.0
            opaque_black_fraction = 0.0
            if has_alpha:
                rgba = image.convert('RGBA')
                pixels = list(rgba.getdata())
                total = max(1, len(pixels))
                transparent = sum(1 for r, g, b, a in pixels if a == 0)
                partial = sum(1 for r, g, b, a in pixels if 0 < a < 255)
                # Bright-green pixels are suspicious in these generated cutouts because several
                # assets visibly show green matte/chroma residue around intended transparency.
                green_fringe = sum(1 for r, g, b, a in pixels if g >= 180 and g >= r * 1.8 and g >= b * 1.8 and a > 0)
                opaque_black = sum(1 for r, g, b, a in pixels if r < 8 and g < 8 and b < 8 and a == 255)
                transparent_fraction = transparent / total
                partial_alpha_fraction = partial / total
                green_fringe_fraction = green_fringe / total
                opaque_black_fraction = opaque_black / total
            rows.append({
                'path': rel,
                'extension': path.suffix.lower(),
                'bytes': path.stat().st_size,
                'width': width,
                'height': height,
                'aspect_ratio': round(width / height, 4) if height else None,
                'mode': mode,
                'has_alpha': has_alpha,
                'transparent_fraction': round(transparent_fraction, 6),
                'partial_alpha_fraction': round(partial_alpha_fraction, 6),
                'green_fringe_fraction': round(green_fringe_fraction, 6),
                'opaque_black_fraction': round(opaque_black_fraction, 6),
            })
    except Exception as exc:
        errors.append({'path': rel, 'error': str(exc)})

with OUT_CSV.open('w', newline='', encoding='utf-8') as handle:
    fieldnames = list(rows[0].keys()) if rows else ['path']
    writer = csv.DictWriter(handle, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)

summary = {
    'root': str(ROOT),
    'asset_count': len(rows),
    'total_bytes': sum(row['bytes'] for row in rows),
    'extensions': dict(Counter(row['extension'] for row in rows)),
    'dimensions': dict(Counter(f"{row['width']}x{row['height']}" for row in rows)),
    'modes': dict(Counter(row['mode'] for row in rows)),
    'alpha_asset_count': sum(1 for row in rows if row['has_alpha']),
    'fully_opaque_alpha_assets': [row['path'] for row in rows if row['has_alpha'] and row['transparent_fraction'] == 0 and row['partial_alpha_fraction'] == 0],
    'high_green_fringe_assets': [
        {'path': row['path'], 'green_fringe_fraction': row['green_fringe_fraction']}
        for row in sorted(rows, key=lambda item: item['green_fringe_fraction'], reverse=True)
        if row['green_fringe_fraction'] >= 0.001
    ],
    'largest_assets': [
        {'path': row['path'], 'bytes': row['bytes'], 'width': row['width'], 'height': row['height']}
        for row in sorted(rows, key=lambda item: item['bytes'], reverse=True)[:25]
    ],
    'topdown_assets': [row for row in rows if 'topdown' in row['path'].lower()],
    'errors': errors,
}
OUT_JSON.write_text(json.dumps(summary, indent=2), encoding='utf-8')
print(json.dumps({
    'asset_count': summary['asset_count'],
    'total_megabytes': round(summary['total_bytes'] / (1024 * 1024), 2),
    'alpha_asset_count': summary['alpha_asset_count'],
    'fully_opaque_alpha_asset_count': len(summary['fully_opaque_alpha_assets']),
    'high_green_fringe_asset_count': len(summary['high_green_fringe_assets']),
    'error_count': len(errors),
    'csv': str(OUT_CSV),
    'json': str(OUT_JSON),
}, indent=2))
