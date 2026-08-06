#!/usr/bin/env python3
"""Give the original top-down sprites an explicit `idle` state token.

`process.mjs::parseName` derives `state` from filename tokens. The first
generation of top-down art was named `character_{role}_{sex}_topdown_v001.png`
with no state token, so every entry landed in the manifest with `state: null`.

`worldActorResolver` only indexes assets that have BOTH a role and a state:

    if (a.state) index.set(`${view}|${a.role}|${a.state}`, a);

A null state therefore leaves those sprites reachable only through the
last-resort `byRole` pass, which is why a downed member rendered standing. New
`downed` and `arrested` art would not have fixed that on its own — the resolver
would still have had no `idle` entry to fall back FROM, and the state-first
Pass 2 could still have matched a stateless sprite.

Renaming to `..._topdown_idle_v001.png` makes the existing art declare what it
already is. No pixels change.

Also drops `*_original.png` duplicates, which the processor quarantines anyway
(`QUARANTINE` in process.mjs) but which are pointlessly tracked in git.
"""

import re
import subprocess
from pathlib import Path

TOPDOWN = Path("frontend/public/assets/generated/characters/topdown")

# Matches the stateless first-generation naming only. Anything that already
# carries a state token is left alone.
STATELESS = re.compile(
    r"^character_(?P<role>[a-z0-9]+)_(?P<sex>male|female)"
    r"(?P<extra>(?:_[a-z0-9]+)*?)_topdown_(?P<ver>v\d+)\.png$"
)

STATES = {
    "idle", "walk", "aim", "fire", "reload", "hit", "downed",
    "dead", "arrested", "seated", "driving", "alert", "front", "side",
}


def git(*args: str) -> None:
    subprocess.run(["git", *args], check=True)


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    d = root / TOPDOWN

    renamed: list[tuple[str, str]] = []
    removed: list[str] = []

    for p in sorted(d.iterdir()):
        if p.suffix != ".png":
            continue

        if p.name.endswith("_original.png"):
            removed.append(p.name)
            continue

        m = STATELESS.match(p.name)
        if not m:
            continue

        # Guard: never touch a file that already declares a state.
        tokens = set(p.stem.split("_"))
        if tokens & STATES:
            continue

        extra = m.group("extra") or ""
        new = (f"character_{m.group('role')}_{m.group('sex')}{extra}"
               f"_topdown_idle_{m.group('ver')}.png")
        renamed.append((p.name, new))

    for old, new in renamed:
        git("mv", str(TOPDOWN / old), str(TOPDOWN / new))
        print(f"renamed  {old}\n      -> {new}")

    for name in removed:
        git("rm", "-q", "--", str(TOPDOWN / name))
        print(f"dropped  {name}  (source-resolution duplicate)")

    print(f"\n{len(renamed)} renamed, {len(removed)} dropped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
