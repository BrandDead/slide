import React from 'react';
import { Flame, Landmark, Swords, TrendingUp } from 'lucide-react';
import { formatCash, formatSignedCash, type EmpirePnl } from '../../utils/shoeboxAnalytics';
import './EmpireCommandBar.css';

interface EmpireCommandBarProps {
  pnl: EmpirePnl;
  attackableCount: number;
  onOpenNearby: () => void;
  onOpenDrop: () => void;
}

const EmpireCommandBar: React.FC<EmpireCommandBarProps> = ({
  pnl,
  attackableCount,
  onOpenNearby,
  onOpenDrop,
}) => {
  return (
    <div className="empire-bar" data-testid="empire-command-bar">
      <div className="empire-stat">
        <TrendingUp size={14} />
        <div>
          <div className="empire-label">Weekly net</div>
          <div className={`empire-val ${pnl.weeklyNet >= 0 ? 'up' : 'down'}`}>
            {formatSignedCash(pnl.weeklyNet)}
          </div>
        </div>
      </div>
      <div className="empire-stat">
        <Landmark size={14} />
        <div>
          <div className="empire-label">Vault</div>
          <div className="empire-val">{formatCash(pnl.vault)}</div>
        </div>
      </div>
      <div className="empire-stat">
        <Flame size={14} />
        <div>
          <div className="empire-label">Pending</div>
          <div className="empire-val">{formatCash(pnl.pendingCollect)}</div>
        </div>
      </div>
      <button type="button" className="empire-cta" onClick={onOpenNearby}>
        <Swords size={14} />
        {attackableCount} to hit
      </button>
      <button type="button" className="empire-cta ghost" onClick={onOpenDrop}>
        Drop crew
      </button>
    </div>
  );
};

export default EmpireCommandBar;
