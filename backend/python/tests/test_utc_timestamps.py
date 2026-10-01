"""Regression tests for the shared timezone-aware UTC timestamp contract (#170).

The pre-fix base fails these tests in two independent ways:

1. ``utils.utc`` does not exist, so the live backend modules have no shared
   timezone-aware source and still construct naive UTC with the deprecated
   ``datetime.utcnow()`` (Python 3.12 raises a DeprecationWarning for it).
2. Because those call sites are naive, the runtime checks below cannot observe a
   timezone-aware value and cannot prove the serialized wire format is stable.

The contract these tests lock in:

* internal values are timezone-aware UTC (``utc_now()``);
* the *external* ISO-8601 wire format is byte-compatible with what the pre-fix
  code produced, so no API consumer sees a changed timestamp string;
* no live runtime path emits the ``utcnow`` deprecation warning any more.
"""
import os
import re
import sys
import warnings
from datetime import datetime, timedelta, timezone

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Live runtime modules that construct or serialize API/domain timestamps.
LIVE_TIMESTAMP_MODULES = (
    'api/avatar.py',
    'api/combat.py',
    'api/driveby.py',
    'api/inventory.py',
    'api/world.py',
    'routes/art.py',
    'services/block_state_engine.py',
    'services/grid_generator.py',
    'services/scheduler.py',
)

# The established external format: UTC, ISO-8601, no offset designator.
WIRE_FORMAT = re.compile(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$')

UTC_MINUS_FOUR = timezone(timedelta(hours=-4))


def _utc():
    from utils.utc import to_iso_utc, utc_now, utc_now_iso

    return utc_now, to_iso_utc, utc_now_iso


# ---------------------------------------------------------------------------
# Static guard: the naive construction is gone from live runtime code
# ---------------------------------------------------------------------------
def test_live_runtime_modules_do_not_construct_naive_utc():
    offenders = {}
    for relative in LIVE_TIMESTAMP_MODULES:
        path = os.path.join(BACKEND_ROOT, relative)
        with open(path, encoding='utf-8') as handle:
            source = handle.read()
        hits = [
            f'{relative}:{index}'
            for index, line in enumerate(source.splitlines(), start=1)
            if 'utcnow' in line
        ]
        if hits:
            offenders[relative] = hits

    assert offenders == {}, f'deprecated naive UTC construction remains: {offenders}'


# ---------------------------------------------------------------------------
# Shared helper contract
# ---------------------------------------------------------------------------
def test_utc_now_is_timezone_aware_utc():
    utc_now, _, _ = _utc()
    now = utc_now()

    assert now.tzinfo is not None
    assert now.utcoffset() == timedelta(0)
    assert now.tzname() == 'UTC'


def test_utc_now_iso_uses_the_established_wire_format():
    _, _, utc_now_iso = _utc()
    value = utc_now_iso()

    assert WIRE_FORMAT.match(value), value
    assert not value.endswith('Z')
    assert '+' not in value


def test_to_iso_utc_reproduces_the_legacy_naive_utc_shape_exactly():
    _, to_iso_utc, _ = _utc()

    aware = datetime(2026, 7, 17, 1, 2, 3, 456789, tzinfo=timezone.utc)
    # What the pre-fix `datetime.utcnow().isoformat()` produced for that instant.
    legacy = datetime(2026, 7, 17, 1, 2, 3, 456789)

    assert to_iso_utc(aware) == legacy.isoformat() == '2026-07-17T01:02:03.456789'


def test_to_iso_utc_omits_microseconds_when_they_are_zero():
    _, to_iso_utc, _ = _utc()

    assert to_iso_utc(datetime(2026, 7, 17, tzinfo=timezone.utc)) == '2026-07-17T00:00:00'


def test_to_iso_utc_normalizes_non_utc_offsets_to_utc():
    _, to_iso_utc, _ = _utc()

    eastern = datetime(2026, 7, 16, 21, 2, 3, 456789, tzinfo=UTC_MINUS_FOUR)

    assert to_iso_utc(eastern) == '2026-07-17T01:02:03.456789'


def test_to_iso_utc_treats_legacy_naive_values_as_utc():
    _, to_iso_utc, _ = _utc()

    # A naive value from the old code path already meant UTC; it must not shift.
    assert to_iso_utc(datetime(2026, 7, 17, 1, 2, 3)) == '2026-07-17T01:02:03'


def test_wire_timestamp_round_trips_to_the_same_instant():
    _, _, utc_now_iso = _utc()

    value = utc_now_iso()
    parsed = datetime.fromisoformat(value).replace(tzinfo=timezone.utc)
    drift = abs((datetime.now(timezone.utc) - parsed).total_seconds())

    assert drift < 5


# ---------------------------------------------------------------------------
# Live runtime paths: aware internally, wire-compatible externally, no warning
# ---------------------------------------------------------------------------
def _capture(callable_):
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter('always')
        result = callable_()
    deprecations = [str(w.message) for w in caught if issubclass(w.category, DeprecationWarning)]
    return result, deprecations


def test_grid_generator_emits_no_deprecation_warning_and_keeps_wire_format():
    from services.grid_generator import GridGenerator

    def run():
        generator = GridGenerator('Miami', 50)
        return generator, generator.generate()

    (generator, result), deprecations = _capture(run)

    assert [message for message in deprecations if 'utcnow' in message] == []
    assert WIRE_FORMAT.match(result.generated_at), result.generated_at

    # The seed suffix is the true UTC epoch, not a local-time reinterpretation.
    seed_suffix = generator.config.seed.rsplit('_', 1)[1]
    drift = abs(float(seed_suffix) - datetime.now(timezone.utc).timestamp())
    assert drift < 5


def test_block_state_engine_snapshot_identifier_and_mock_snapshot_are_wire_compatible(monkeypatch):
    monkeypatch.delenv('SUPABASE_URL', raising=False)
    monkeypatch.delenv('SUPABASE_SERVICE_ROLE_KEY', raising=False)

    from services.db import _mock_blocks
    from services.block_state_engine import BlockStateEngine

    block_id = 'utc-timestamp-regression-block'
    _mock_blocks[block_id] = {
        'id': block_id,
        'owner_id': 'dev-user-001',
        'lat': 25.7617,
        'lng': -80.1918,
        'city': 'miami',
        'address': '1208 Sample St',
    }
    engine = BlockStateEngine()

    def run():
        return (
            engine._generate_snapshot_id(block_id, 1),
            engine._generate_mock_snapshot(block_id),
        )

    try:
        (snapshot_id, snapshot), deprecations = _capture(run)
    finally:
        _mock_blocks.pop(block_id, None)

    assert [message for message in deprecations if 'utcnow' in message] == []
    assert isinstance(snapshot_id, str) and len(snapshot_id) == 16
    assert snapshot is not None
    assert WIRE_FORMAT.match(snapshot.created_at), snapshot.created_at
    assert snapshot.to_dict()['created_at'] == snapshot.created_at


def test_scheduler_world_event_timestamp_is_wire_compatible_without_deprecation():
    from services.scheduler import WorldEvent

    def run():
        return WorldEvent(event_type='nothing', description='Quiet day on the block.')

    event, deprecations = _capture(run)

    assert [message for message in deprecations if 'utcnow' in message] == []
    assert WIRE_FORMAT.match(event.timestamp), event.timestamp
    assert event.to_dict()['timestamp'] == event.timestamp


def test_combat_and_driveby_session_identifiers_use_the_true_utc_epoch():
    """The identifier suffix must be a real UTC epoch, independent of host timezone."""
    import api.combat as combat_api
    import api.driveby as driveby_api

    before = datetime.now(timezone.utc).timestamp()
    combat_id = f"combat-{combat_api.utc_now().timestamp()}"
    driveby_id = f"driveby-{driveby_api.utc_now().timestamp()}"
    after = datetime.now(timezone.utc).timestamp()

    for session_id, prefix in ((combat_id, 'combat-'), (driveby_id, 'driveby-')):
        assert session_id.startswith(prefix)
        suffix = float(session_id[len(prefix):])
        assert before <= suffix <= after
