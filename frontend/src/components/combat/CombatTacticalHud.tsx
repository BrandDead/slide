import React from 'react';
import './CombatTacticalHud.css';

export interface CombatFeedItem {
  id: string;
  text: string;
  kind: 'kill' | 'civ' | 'hit' | 'info';
}

export interface CombatHitMarker {
  x: number;
  y: number;
  headshot: boolean;
  kill: boolean;
}

interface CombatTacticalHudProps {
  ammo: number;
  maxAmmo: number;
  carHealth: number;
  heat: number;
  score: number;
  kills: number;
  accuracy: number;
  blockIndex: number;
  blockCount: number;
  destruction: number;
  feed: CombatFeedItem[];
  hitMarker: CombatHitMarker | null;
}

const CombatTacticalHud: React.FC<CombatTacticalHudProps> = ({
  ammo,
  maxAmmo,
  carHealth,
  heat,
  score,
  kills,
  accuracy,
  blockIndex,
  blockCount,
  destruction,
  feed,
  hitMarker,
}) => {
  return (
    <div className="cth" data-testid="combat-tactical-hud">
      {hitMarker && (
        <div
          className={`cth-marker ${hitMarker.kill ? 'kill' : ''} ${hitMarker.headshot ? 'head' : ''}`}
          style={{ left: `${(hitMarker.x / 800) * 100}%`, top: `${(hitMarker.y / 600) * 100}%` }}
        >
          {hitMarker.headshot ? 'X' : '+'}
        </div>
      )}

      <div className="cth-top">
        <div className="cth-card">
          <span>TAKE</span>
          <strong>${score.toLocaleString()}</strong>
        </div>
        <div className="cth-card">
          <span>STRIP {blockIndex}/{blockCount}</span>
          <div className="cth-bar"><i style={{ width: `${(blockIndex / Math.max(1, blockCount)) * 100}%` }} /></div>
        </div>
        <div className="cth-card heat">
          <span>HEAT {heat}%</span>
          <div className="cth-bar"><i style={{ width: `${heat}%` }} /></div>
        </div>
      </div>

      <ul className="cth-feed">
        {feed.slice(-5).reverse().map((item) => (
          <li key={item.id} className={item.kind}>{item.text}</li>
        ))}
      </ul>

      <div className="cth-bottom">
        <div className="cth-ammo">
          <em>{ammo}</em>
          <span>/ {maxAmmo}</span>
        </div>
        <div className="cth-vitals">
          <div>
            <span>CAR</span>
            <div className="cth-bar"><i className={carHealth < 30 ? 'warn' : ''} style={{ width: `${carHealth}%` }} /></div>
          </div>
          <div>
            <span>DESTRUCTION {destruction}%</span>
            <div className="cth-bar"><i className="dest" style={{ width: `${destruction}%` }} /></div>
          </div>
        </div>
        <div className="cth-kills">
          <strong>{kills}</strong>
          <span>{accuracy}% acc</span>
        </div>
      </div>
    </div>
  );
};

export default CombatTacticalHud;
