"""Production-shape contract tests for DBAdapter block placements."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.db import DBAdapter


class Result:
    def __init__(self, data=None):
        self.data = data or []


class Query:
    def __init__(self, client, table_name):
        self.client = client
        self.table_name = table_name
        self.action = None
        self.payload = None
        self.filters = []

    def select(self, columns):
        self.action = 'select'
        self.payload = columns
        return self

    def delete(self):
        self.action = 'delete'
        return self

    def insert(self, payload):
        self.action = 'insert'
        self.payload = payload
        return self

    def update(self, payload):
        self.action = 'update'
        self.payload = payload
        return self

    def eq(self, column, value):
        self.filters.append(('eq', column, value))
        return self

    def in_(self, column, values):
        self.filters.append(('in', column, values))
        return self

    def execute(self):
        self.client.calls.append({
            'table': self.table_name,
            'action': self.action,
            'payload': self.payload,
            'filters': self.filters,
        })
        if self.action == 'select':
            return Result(self.client.rows.get(self.table_name, []))
        return Result()


class FakeSupabase:
    def __init__(self, rows=None):
        self.rows = rows or {}
        self.calls = []

    def table(self, table_name):
        return Query(self, table_name)


def test_save_placements_uses_only_the_tracked_schema_columns(monkeypatch):
    fake = FakeSupabase()
    adapter = DBAdapter(fake)
    monkeypatch.setattr(adapter, 'get_block', lambda _block_id: {
        'metadata': {'existing': True, 'liveRevision': 4},
    })

    adapter.save_placements('block-1', [{
        'memberId': 'member-1',
        'memberName': 'Dez',
        'role': 'dealer',
        'gridX': 2,
        'gridY': 3,
        'zoneType': 'sidewalk',
        'incomePerTick': 0,
        'exposureRisk': 50,
        'level': 2,
        'health': 0,
        'portraitUrl': '/portrait.webp',
        'topdownUrl': '/topdown.webp',
        'anchorId': 'must-not-be-written',
        'payload': {'must': 'not be written'},
    }])

    insert = next(call for call in fake.calls if call['action'] == 'insert')
    row = insert['payload'][0]
    assert set(row) == {
        'block_id', 'member_id', 'member_name', 'role', 'grid_x', 'grid_y',
        'zone_type', 'income_per_tick', 'exposure_risk', 'level', 'health',
        'portrait_url', 'topdown_url',
    }
    assert row['grid_x'] == 2
    assert row['grid_y'] == 3
    assert row['health'] == 0
    assert row['income_per_tick'] == 0
    update = next(call for call in fake.calls if call['action'] == 'update')
    assert update['payload'] == {
        'metadata': {'existing': True, 'liveRevision': 5, 'incomePerTick': 0},
    }


def test_get_placements_maps_a_schema_row_without_losing_zero_values():
    fake = FakeSupabase(rows={'block_placements': [{
        'block_id': 'block-1',
        'member_id': 'member-1',
        'member_name': 'Dez',
        'role': 'dealer',
        'grid_x': 2,
        'grid_y': 3,
        'zone_type': 'sidewalk',
        'income_per_tick': 0,
        'exposure_risk': 0,
        'level': 2,
        'health': 0,
        'portrait_url': None,
        'topdown_url': None,
    }]})
    adapter = DBAdapter(fake)

    assert adapter.get_placements('block-1') == [{
        'memberId': 'member-1',
        'memberName': 'Dez',
        'role': 'dealer',
        'gridX': 2,
        'gridY': 3,
        'x': 2,
        'y': 3,
        'zoneType': 'sidewalk',
        'health': 0,
        'incomePerTick': 0,
        'exposureRisk': 0,
        'level': 2,
        'portraitUrl': None,
        'topdownUrl': None,
    }]


def test_owned_member_lookup_rejects_local_ids_and_filters_database_ids_by_owner():
    database_id = '00000000-0000-4000-8000-000000000001'
    fake = FakeSupabase(rows={'gang_members': [{
        'id': database_id,
        'owner_id': 'owner-1',
        'role': 'shooter',
    }]})
    adapter = DBAdapter(fake)

    rows = adapter.get_owned_members('owner-1', ['local-member', database_id])

    assert {row['id'] for row in rows} == {database_id}
    lookup = next(call for call in fake.calls if call['table'] == 'gang_members')
    assert ('eq', 'owner_id', 'owner-1') in lookup['filters']
    assert ('in', 'id', [database_id]) in lookup['filters']
    select = next(call for call in fake.calls if call['table'] == 'gang_members')
    assert ('eq', 'owner_id', 'owner-1') in select['filters']
    assert ('in', 'id', [database_id]) in select['filters']
