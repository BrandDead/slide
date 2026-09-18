// ============================================================
// TacticalDiorama — cinematic 2.5D Strip presentation (#77)
// Presentation adapter only. Placement still writes through blockStore.
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BlockData, MemberRole } from '../../types/block.types';
import { useBlockStore } from '../../stores/blockStore';
import { getPortraitUrl } from '../../services/assetResolver';
import {
  composeDioramaScene,
  projectCrewSelection,
  type DioramaCell,
  type DioramaMapContext,
} from '../../render/dioramaAdapter';
import { unproject, isTapOnBlock } from '../../render/projection';
import { snapToCell } from '../../config/gridConfig';
import TopDownBlock from './TopDownBlock';
import './TacticalDiorama.css';

const ZONE_FILL: Record<string, string> = {
  street: 'rgba(18, 16, 22, 0.38)',
  curb: 'rgba(92, 64, 48, 0.42)',
  sidewalk: 'rgba(58, 52, 62, 0.36)',
  storefront: 'rgba(42, 58, 68, 0.46)',
  alley: 'rgba(16, 22, 24, 0.52)',
  parking: 'rgba(48, 44, 40, 0.40)',
  rooftop: 'rgba(36, 28, 48, 0.50)',
  building: 'rgba(8, 8, 10, 0.62)',
};

interface TacticalDioramaProps {
  block: BlockData;
  mapContext?: DioramaMapContext | null;
}

function polygonPoints(cell: DioramaCell): string {
  return cell.corners.map((corner) => `${corner.x},${corner.y}`).join(' ');
}

const TacticalDiorama: React.FC<TacticalDioramaProps> = ({ block, mapContext = null }) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ width: 1280, height: 720 });
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [focusCell, setFocusCell] = useState<{ col: number; row: number } | null>(null);
  const [showLegalBoard, setShowLegalBoard] = useState(false);
  const {
    placeMember,
    moveMember,
    isPlacementMode,
    pendingPlacementMemberId,
    pendingPlacementMember,
    setPlacementMode,
  } = useBlockStore();

  useEffect(() => {
    const node = stageRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return undefined;
    const apply = () => {
      const rect = node.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) return;
      setView({ width: rect.width, height: rect.height });
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const scene = useMemo(
    () => composeDioramaScene({ block, view, seed: `${block.dnaId ?? 'hero'}:${view.width}x${view.height}`, mapContext }),
    [block, mapContext, view],
  );

  const selected = selectedMemberId
    ? projectCrewSelection(block, selectedMemberId, view)
    : null;

  const handleCellActivate = useCallback((cell: DioramaCell) => {
    setFocusCell({ col: cell.col, row: cell.row });
    const occupant = block.placements.find((item) => item.x === cell.col && item.y === cell.row);
    if (isPlacementMode && pendingPlacementMemberId) {
      if (!cell.passable || occupant) return;
      const role = (pendingPlacementMember?.role ?? 'dealer') as MemberRole;
      placeMember(block.id, {
        memberId: pendingPlacementMemberId,
        memberName: pendingPlacementMember?.memberName ?? 'Member',
        role,
        x: cell.col,
        y: cell.row,
        zoneType: cell.zoneType,
        incomePerTick: 0,
        exposureRisk: cell.exposureRisk,
        level: pendingPlacementMember?.level ?? 1,
        health: 100,
        portraitUrl: getPortraitUrl(role),
      });
      setPlacementMode(false);
      return;
    }
    if (occupant) {
      setSelectedMemberId(occupant.memberId);
      return;
    }
    if (selectedMemberId) {
      const held = block.placements.find((item) => item.memberId === selectedMemberId);
      if (held && cell.passable) {
        moveMember(block.id, held.memberId, cell.col, cell.row);
        setSelectedMemberId(null);
      }
    }
  }, [
    block,
    isPlacementMode,
    moveMember,
    pendingPlacementMember,
    pendingPlacementMemberId,
    placeMember,
    selectedMemberId,
    setPlacementMode,
  ]);

  const handleStageKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!focusCell) return;
    const delta = {
      ArrowLeft: { col: -1, row: 0 },
      ArrowRight: { col: 1, row: 0 },
      ArrowUp: { col: 0, row: 1 },
      ArrowDown: { col: 0, row: -1 },
    }[event.key];
    if (delta) {
      event.preventDefault();
      const next = scene.cells.find((cell) => cell.col === focusCell.col + delta.col && cell.row === focusCell.row + delta.row);
      if (next) {
        setFocusCell({ col: next.col, row: next.row });
        document.getElementById(`diorama-cell-${next.col}-${next.row}`)?.focus();
      }
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      const cell = scene.cells.find((item) => item.col === focusCell.col && item.row === focusCell.row);
      if (cell) {
        event.preventDefault();
        handleCellActivate(cell);
      }
    }
    if (event.key === 'Escape') {
      setSelectedMemberId(null);
      setFocusCell(null);
    }
  }, [focusCell, handleCellActivate, scene.cells]);

  const handleStagePointer = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const coord = unproject(event.clientX - rect.left, event.clientY - rect.top, view, scene.profile);
    if (!isTapOnBlock(coord)) return;
    const snapped = snapToCell(coord);
    const cell = scene.cells.find((item) => item.col === snapped.col && item.row === snapped.row);
    if (cell) handleCellActivate(cell);
  }, [handleCellActivate, scene.cells, scene.profile, view]);

  const legalHint = isPlacementMode
    ? `Place ${pendingPlacementMember?.memberName ?? 'crew'} on a passable curb, walk, shop, or cover cell.`
    : 'Tap crew to read cover. The 8×8 board stays underneath this street.';

  return (
    <div className="tactical-diorama">
      <div className="td-toolbar">
        <p className="td-kicker">{scene.dnaName}</p>
        <button
          type="button"
          className={`td-board-toggle${showLegalBoard ? ' is-on' : ''}`}
          onClick={() => setShowLegalBoard((value) => !value)}
        >
          {showLegalBoard ? 'Hide legal board' : 'Legal board'}
        </button>
      </div>

      {(scene.mapNotice || mapContext?.status === 'failed') && (
        <p className="td-map-fallback">
          {scene.mapNotice ?? 'Street map imagery is optional. The Strip board stays playable.'}
        </p>
      )}

      {showLegalBoard ? (
        <TopDownBlock block={block} />
      ) : (
        <div
          ref={stageRef}
          className="td-stage"
          role="application"
          aria-label={`${scene.dnaName} tactical diorama`}
          tabIndex={0}
          onKeyDown={handleStageKeyDown}
          onPointerDown={handleStagePointer}
        >
          <img
            className="td-plate"
            src={scene.backdropUrl}
            alt={scene.dnaName}
            draggable={false}
          />
          <svg className="td-grid" viewBox={`0 0 ${view.width} ${view.height}`} aria-hidden="true">
            {scene.drawOrder.map((cell) => {
              const held = block.placements.find((item) => item.x === cell.col && item.y === cell.row);
              const classes = [
                'td-cell',
                cell.isStreet ? 'is-street' : '',
                cell.isCover ? 'is-cover' : '',
                cell.isFacade ? 'is-facade' : '',
                cell.isSetback ? 'is-setback' : '',
                cell.isObjective ? 'is-objective' : '',
                cell.isExtraction ? 'is-extract' : '',
                !cell.passable ? 'is-blocked' : '',
                isPlacementMode && cell.passable && !held ? 'is-legal' : '',
                focusCell?.col === cell.col && focusCell?.row === cell.row ? 'is-focus' : '',
              ].filter(Boolean).join(' ');
              return (
                <polygon
                  key={`${cell.col}-${cell.row}`}
                  className={classes}
                  points={polygonPoints(cell)}
                  fill={ZONE_FILL[cell.zoneType] ?? 'rgba(0,0,0,0.25)'}
                />
              );
            })}
            {scene.cells.filter((cell) => cell.isObjective || cell.isExtraction).map((cell) => (
              <g key={`mark-${cell.col}-${cell.row}`}>
                <ellipse
                  className={cell.isObjective ? 'td-objective' : 'td-extract'}
                  cx={cell.point.x}
                  cy={cell.point.y}
                  rx={cell.point.cellWidth * 0.42}
                  ry={cell.point.cellWidth * 0.16}
                />
                <text
                  x={cell.point.x}
                  y={cell.point.y - cell.point.cellWidth * 0.22}
                  textAnchor="middle"
                  className="td-mark-label"
                >
                  {cell.isObjective ? 'OBJECTIVE' : 'EXTRACT'}
                </text>
              </g>
            ))}
          </svg>

          <div className="td-hit-layer">
            {scene.cells.map((cell) => {
              const held = block.placements.find((item) => item.x === cell.col && item.y === cell.row);
              return (
                <button
                  key={`hit-${cell.col}-${cell.row}`}
                  id={`diorama-cell-${cell.col}-${cell.row}`}
                  type="button"
                  className={`td-hit${isPlacementMode && cell.passable && !held ? ' is-legal' : ''}`}
                  style={{ left: cell.point.x, top: cell.point.y }}
                  aria-label={`${cell.zoneType} ${cell.col},${cell.row}${held ? ` held by ${held.memberName}` : ''}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleCellActivate(cell);
                  }}
                />
              );
            })}
          </div>
          <div className="td-sr-marks">
            <span aria-label="Objective">Objective</span>
            <span aria-label="Extraction">Extraction</span>
          </div>

          {scene.actors.map((actor) => {
            const height = actor.point.actorHeight;
            const width = height * 0.48;
            return (
              <button
                key={actor.memberId}
                type="button"
                className={`td-actor${selectedMemberId === actor.memberId ? ' is-selected' : ''}`}
                style={{
                  left: actor.point.x,
                  top: actor.point.y,
                  width,
                  height,
                  zIndex: Math.round(actor.point.depth),
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedMemberId(actor.memberId);
                  setFocusCell({ col: actor.col, row: actor.row });
                }}
              >
                {actor.spriteUrl ? (
                  <img src={actor.spriteUrl} alt="" draggable={false} />
                ) : (
                  <span className="td-actor-fallback" aria-hidden="true" />
                )}
                <span className="td-actor-name">{actor.memberName}</span>
              </button>
            );
          })}
        </div>
      )}

      <p className="td-legal-hint">{legalHint}</p>

      {selected && (
        <aside className="td-context" aria-live="polite" aria-label="Selected crew cover">
          <p className="td-context-kicker">{selected.zoneType}</p>
          <h2>{selected.memberName}</h2>
          <p>
            Cover {Math.round(selected.coverScore * 100)}% · exposure {selected.exposureRisk}
            {' '}· cell {selected.col},{selected.row}
          </p>
        </aside>
      )}
    </div>
  );
};

export default TacticalDiorama;
