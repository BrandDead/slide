"""Contract unit tests for BlockSceneManifest / LiveBlockState / AttackSnapshot."""

from schemas.block_contracts import (
    AttackSnapshot,
    LiveBlockState,
    LivePlacement,
    build_default_manifest,
    grid_cell_to_anchor_id,
)


def test_grid_cell_to_anchor_id():
    assert grid_cell_to_anchor_id(3, 5) == 'cell-3-5'


def test_build_default_manifest_has_64_anchors_and_outdoor_rules():
    manifest = build_default_manifest(
        'block-1',
        scene_version='v1',
        address_display='1208 Sample St',
        lat=25.7617,
        lng=-80.1918,
        created_at='2026-07-17T00:00:00Z',
    )
    assert manifest.status == 'fallback'
    assert len(manifest.anchors) == 64
    street = next(a for a in manifest.anchors if a.id == 'cell-0-0')
    assert street.zone_type == 'street'
    assert street.playable is False
    sidewalk = next(a for a in manifest.anchors if a.id == 'cell-0-2')
    assert sidewalk.zone_type == 'sidewalk'
    assert sidewalk.playable is True


def test_attack_snapshot_freezes_placements():
    placement = LivePlacement(
        member_id='m1',
        anchor_id='cell-2-3',
        role='dealer',
        health=100,
        grid_x=2,
        grid_y=3,
    )
    live = LiveBlockState(
        block_id='b1',
        scene_version='v1',
        revision=2,
        owner_id='u1',
        claim_status='owned',
        placements=[placement],
        heat=5,
    )
    snap = AttackSnapshot(
        attack_id='a1',
        block_id=live.block_id,
        scene_version=live.scene_version,
        live_revision=live.revision,
        rules_version='0B.1',
        seed='s1',
        started_at='2026-07-17T01:00:00Z',
        defender_placements=[
            LivePlacement(**{**placement.__dict__}),
        ],
    )
    placement.health = 10
    assert snap.defender_placements[0].health == 100
    assert snap.to_dict()['scene_version'] == 'v1'
