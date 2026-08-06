#!/usr/bin/env python3
"""Strip the now-unused emoji `icon` field from Market.tsx's ITEM_CATALOG.

The UI no longer renders `item.icon` — it uses CATEGORY_TAGS text labels — so
the field is dead weight that also trips the repo's no-emoji rule. This removes
the field from every catalog entry and from the CatalogItem interface.
"""

import re
import sys
from pathlib import Path

TARGET = Path("frontend/src/components/economy/Market.tsx")


def main() -> int:
    path = Path(__file__).resolve().parents[1] / TARGET
    src = path.read_text(encoding="utf-8")

    # Drop `, icon: '<emoji>'` from each catalog literal.
    cleaned, n_items = re.subn(r",\s*icon:\s*'[^']*'", "", src)

    # Drop the interface field declaration.
    cleaned, n_iface = re.subn(r"\n\s*icon:\s*string;(?=\n\})", "", cleaned, count=1)

    if n_items == 0:
        print("No catalog icon fields found — nothing to do.", file=sys.stderr)
        return 1

    path.write_text(cleaned, encoding="utf-8")
    print(f"Removed {n_items} catalog icon fields and {n_iface} interface field(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
