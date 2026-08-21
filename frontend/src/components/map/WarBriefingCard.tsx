import React from 'react';
import { Crosshair, Landmark, Swords } from 'lucide-react';
import { formatCash, formatSignedCash, type EmpirePnl } from '../../utils/shoeboxAnalytics';
import { formatDistance } from '../../utils/geo';
import type { ReconBlock } from '../../utils/nearbyBlocks';
import './WarBriefingCard.css';

interface WarBriefingCardProps {
  pnl: EmpirePnl;
  recommended: ReconBlock | null;
  threats: ReconBlock[];
  onHit: (block: ReconBlock) => void;
  onScout: () => void;
}

const WarBriefingCard: React.FC<WarBriefingCardProps> = ({
  pnl,
  recommended,
  threats,
  onHit,
  onScout,
}) => {
  return (
    <section className="war-brief" data-testid="war-briefing-card">
      <header>
        <div>
          <p>War room</p>
          <h3>This week’s front</h3>
        </div>
        <div className={`war-net ${pnl.weeklyNet >= 0 ? 'up' : 'down'}`}>
          {formatSignedCash(pnl.weeklyNet)}
        </div>
      </header>

      <div className="war-books">
        <span>Take {formatCash(pnl.weeklyIncome)}</span>
        <span>Payroll {formatCash(pnl.weeklyWages)}</span>
        <span>Vault {formatCash(pnl.vault)}</span>
      </div>

      {recommended ? (
        <button type="button" className="war-rec" onClick={() => onHit(recommended)}>
          <Swords size={16} />
          <div>
            <strong>Hit {recommended.address}</strong>
            <em>
              {recommended.gangName ?? 'Rival'} · {formatCash(recommended.income)}/hr ·{' '}
              {formatDistance(recommended.distanceMeters)} · heat {recommended.heat}
            </em>
          </div>
          <span>Slide</span>
        </button>
      ) : (
        <button type="button" className="war-rec scout" onClick={onScout}>
          <Crosshair size={16} />
          <div>
            <strong>No rival in range</strong>
            <em>Search Maps for an open strip or a new target</em>
          </div>
        </button>
      )}

      <ul className="war-threats">
        {threats.map((t) => (
          <li key={t.id}>
            <Landmark size={12} />
            <span>{t.gangName ?? t.address}</span>
            <button type="button" onClick={() => onHit(t)}>
              {formatCash(t.income)}/hr
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default WarBriefingCard;
