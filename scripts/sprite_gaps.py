#!/usr/bin/env python3
"""Report which (view, role, state) sprites exist and which fall back.

`worldActorResolver` never returns nothing — it degrades to a sibling pose. That
is good for robustness but it hides gaps, because a downed shooter silently
borrows a dealer's downed art. This script makes the gaps explicit so art can be
generated against real holes rather than guesses.
"""

import json
from pathlib import Path

MANIFEST = Path("frontend/src/assets/runtimeManifest.json")

VIEW_CLASS = {
    "street": "actor-street",
    "topdown": "actor-topdown",
    "fullbody": "actor-fullbody",
}

# Roles the game actually deploys, including the ones added in Sprint 15-B.
ROLES = ["shooter", "dealer", "enforcer", "lookout", "driver", "recruit", "k9"]

# States renderers request. Sourced from ActorState in worldActorResolver.ts.
STATES_BY_VIEW = {
    "street": ["idle", "walk", "aim", "fire", "hit", "downed", "arrested", "alert"],
    "topdown": ["idle", "walk", "aim", "downed", "arrested"],
    "fullbody": ["front"],
}


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    data = json.loads((root / MANIFEST).read_text(encoding="utf-8"))
    assets = data["entries"]

    have: set[tuple[str, str, str]] = set()
    for a in assets:
        cls, role, state = a.get("class"), a.get("role"), a.get("state")
        if not role or not state:
            continue
        for view, vc in VIEW_CLASS.items():
            if cls == vc:
                have.add((view, role, state))

    print("=" * 62)
    print("SPRITE COVERAGE  (X = present, . = falls back to another sprite)")
    print("=" * 62)

    missing: list[tuple[str, str, str]] = []
    for view, states in STATES_BY_VIEW.items():
        print(f"\n--- {view.upper()} ---")
        header = "role".ljust(10) + "".join(s[:5].ljust(6) for s in states)
        print(header)
        for role in ROLES:
            row = role.ljust(10)
            for state in states:
                if (view, role, state) in have:
                    row += "X".ljust(6)
                else:
                    row += ".".ljust(6)
                    missing.append((view, role, state))
            print(row)

    print("\n" + "=" * 62)
    print(f"MISSING: {len(missing)} of "
          f"{sum(len(s) for s in STATES_BY_VIEW.values()) * len(ROLES)} slots")
    print("=" * 62)

    # Roles with zero art in a view are the highest-value targets: every state
    # for that role is currently borrowing somebody else's silhouette.
    print("\nROLES WITH NO ART AT ALL IN A VIEW:")
    for view in STATES_BY_VIEW:
        for role in ROLES:
            if not any((view, role, s) in have for s in STATES_BY_VIEW[view]):
                print(f"  {view:9s} {role}")

    # Non-actor classes, for awareness of what else the manifest carries.
    print("\nNON-ACTOR CLASSES PRESENT:")
    other: dict[str, int] = {}
    for a in assets:
        cls = a.get("class", "?")
        if cls not in VIEW_CLASS.values():
            other[cls] = other.get(cls, 0) + 1
    for cls, n in sorted(other.items(), key=lambda kv: -kv[1]):
        print(f"  {cls:22s} {n}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
