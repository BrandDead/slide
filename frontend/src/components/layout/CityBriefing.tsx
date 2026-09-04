import React from 'react';
import { useGhostStore, selectGhostFeed } from '../../stores/ghostCrewStore';
import {
  formatCityBriefTime,
  toCityBriefItems,
  type CityBriefTone,
} from './cityBriefing';
import './CityBriefing.css';

interface CityBriefingProps {
  onNavigate: (
    destination: 'map' | 'gang_hq' | 'dealt_v2',
    targetBlockId?: string,
  ) => void;
}

const TONE_LABEL: Record<CityBriefTone, string> = {
  danger: 'HIGH PRIORITY',
  warning: 'WATCH',
  info: 'UPDATE',
  success: 'CLEAR',
};

/**
 * Player-facing return-state briefing. It deliberately reads the existing
 * Ghost Crew store instead of fetching data or owning a second event cache.
 */
const CityBriefing: React.FC<CityBriefingProps> = ({ onNavigate }) => {
  const feed = useGhostStore(selectGhostFeed);
  const items = React.useMemo(() => toCityBriefItems(feed), [feed]);

  return (
    <section className="city-briefing" aria-labelledby="city-briefing-title">
      <div className="city-briefing__header">
        <div>
          <p className="city-briefing__eyebrow">RETURNING EMPIRE</p>
          <h2 id="city-briefing-title">City Briefing</h2>
        </div>
        <span className="city-briefing__count" aria-label={`${items.length} city updates`}>
          {items.length.toString().padStart(2, '0')}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="city-briefing__empty" role="status">
          <span className="city-briefing__empty-signal" aria-hidden="true" />
          <div>
            <strong>City is quiet.</strong>
            <p>No confirmed changes since your last check. Review your block and keep your crew positioned.</p>
          </div>
          <button type="button" onClick={() => onNavigate('map')}>
            Review map
          </button>
        </div>
      ) : (
        <ul className="city-briefing__list">
          {items.map((item) => (
            <li key={item.id} className={`city-briefing__item city-briefing__item--${item.tone}`}>
              <div className="city-briefing__item-topline">
                <span className="city-briefing__category">{item.category}</span>
                <time dateTime={new Date(item.timestamp).toISOString()}>
                  {formatCityBriefTime(item.timestamp)}
                </time>
              </div>
              <div className="city-briefing__item-body">
                <span className={`city-briefing__signal city-briefing__signal--${item.tone}`} aria-hidden="true" />
                <div className="city-briefing__copy">
                  <h3>{item.crewName}</h3>
                  <p>{item.description}</p>
                </div>
              </div>
              <button
                type="button"
                className="city-briefing__action"
                onClick={() => onNavigate(item.cta.destination, item.targetBlockId)}
              >
                {item.cta.label}
              </button>
              <span className="city-briefing__severity">{TONE_LABEL[item.tone]}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default CityBriefing;
