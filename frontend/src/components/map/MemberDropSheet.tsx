import React from 'react';
import { createPortal } from 'react-dom';
import { useGangStore } from '../../stores/gameStore';
import { useBlockStore } from '../../stores/blockStore';
import type { MemberRole } from '../../types/block.types';
import './MemberDropSheet.css';

interface MemberDropSheetProps {
  open: boolean;
  onClose: () => void;
  onDrop: (memberId: string, memberName: string, role: string, level: number) => void;
}

const MemberDropSheet: React.FC<MemberDropSheetProps> = ({ open, onClose, onDrop }) => {
  const members = useGangStore((s) => s.members);
  const { blocks, selectedBlockId } = useBlockStore();
  const block = selectedBlockId ? blocks[selectedBlockId] : null;
  const deployed = new Set(block?.placements.map((p) => p.memberId) ?? []);
  const available = members.filter((m) => m.status === 'active' && !deployed.has(m.id));

  if (!open) return null;

  return createPortal(
    <div className="drop-sheet" data-testid="member-drop-sheet">
      <div className="drop-handle" />
      <div className="drop-head">
        <div>
          <h2>Drop crew</h2>
          <p>
            {block
              ? `Place on ${block.address}`
              : 'Pick a member, then tap your block on the map'}
          </p>
        </div>
        <button type="button" onClick={onClose}>Done</button>
      </div>
      <ul className="drop-list">
        {available.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => onDrop(m.id, m.name, (m.role as MemberRole) || 'dealer', m.level ?? 1)}
            >
              <span className="drop-role">{(m.role || 'dealer').toUpperCase()}</span>
              <span className="drop-name">{m.nickname || m.name}</span>
              <span className="drop-lvl">Lv{m.level ?? 1}</span>
            </button>
          </li>
        ))}
        {available.length === 0 && (
          <li className="drop-empty">Everyone’s already on this strip. Recruit from CREW.</li>
        )}
      </ul>
    </div>,
    document.body,
  );
};

export default MemberDropSheet;
