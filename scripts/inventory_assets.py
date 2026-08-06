#!/usr/bin/env python3
"""Inventory the runtime asset manifest so sprite gaps are visible at a glance.

Groups every entry by its dotted key prefix and prints the leaf names, which is
how `worldActorResolver` and `assetResolver` look assets up at runtime.
"""

import json
from collections import defaultdict
from pathlib import Path

MANIFEST = Path("frontend/src/assets/runtimeManifest.json")


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    data = json.loads((root / MANIFEST).read_text(encoding="utf-8"))
    entries = data["entries"]

    print(f"total entries: {len(entries)}")
    print(f"budget MB:     {data.get('budgetMB')}")
    print(f"total bytes:   {data.get('totalBytes')}")
    print()

    groups: dict[str, list[str]] = defaultdict(list)

    # entries may be a dict keyed by asset id, or a list of objects.
    if isinstance(entries, dict):
        items = list(entries.keys())
    else:
        items = [e.get("id") or e.get("key") or str(e) for e in entries]

    for key in items:
        parts = key.split(".")
        group = ".".join(parts[:-1]) if len(parts) > 1 else "(root)"
        groups[group].append(parts[-1])

    for group in sorted(groups):
        leaves = sorted(groups[group])
        print(f"[{group}]  ({len(leaves)})")
        for leaf in leaves:
            print(f"    {leaf}")
        print()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
