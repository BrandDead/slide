"""Shared timezone-aware UTC helpers.

Single source of truth for backend UTC timestamps (#170).

``datetime.utcnow()`` returns a *naive* datetime and is deprecated since Python
3.12 ("scheduled for removal in a future version"). Every backend path that needs
"now in UTC" uses :func:`utc_now`, which returns a timezone-aware value, and
serializes it through :func:`to_iso_utc`.

Wire-format contract
--------------------
:func:`to_iso_utc` deliberately reproduces the exact external representation the
backend produced before this change: a UTC ISO-8601 string with **no** offset
designator, for example ``2026-07-17T01:02:03.456789``. Existing API consumers
already receive that shape, so emitting ``Z`` or ``+00:00`` would be an external
contract change and is intentionally out of scope here. The value is
timezone-aware internally; only the serialization keeps the established shape.

Naive input is treated as already-UTC rather than reinterpreted as host-local
time, which preserves the meaning the previous ``datetime.utcnow()`` call sites
gave those values.
"""
from __future__ import annotations

from datetime import datetime, timezone

__all__ = ['UTC', 'to_iso_utc', 'utc_now', 'utc_now_iso']

UTC = timezone.utc


def utc_now() -> datetime:
    """Return the current time as a timezone-aware UTC ``datetime``."""
    return datetime.now(UTC)


def to_iso_utc(value: datetime) -> str:
    """Serialize ``value`` to the backend's established external UTC ISO-8601 shape.

    Aware values are converted to UTC first, so the serialized instant is always
    correct regardless of the input offset. Naive values are assumed to already be
    UTC and are not shifted.
    """
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    else:
        value = value.astimezone(UTC)
    return value.replace(tzinfo=None).isoformat()


def utc_now_iso() -> str:
    """Return the current UTC time serialized with :func:`to_iso_utc`."""
    return to_iso_utc(utc_now())
