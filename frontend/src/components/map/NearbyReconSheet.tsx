import React, { useMemo, useState } from 'react';
import { Crosshair, MapPin, Search, Shield, Swords } from 'lucide-react';
import AddressSearchBar, { type AddressResult } from './AddressSearchBar';
import { formatDistance, formatWalkingMins } from '../../utils/geo';
import { describeRecon, searchRecon, type ReconBlock } from '../../utils/nearbyBlocks';
import './NearbyReconSheet.css';

interface NearbyReconSheetProps {
  open: boolean;
  blocks: ReconBlock[];
  onClose: () => void;
  onSelect: (block: ReconBlock) => void;
  onAttack: (block: ReconBlock) => void;
  onClaim: (block: ReconBlock) => void;
  onHold: (block: ReconBlock) => void;
  onGeocode?: (result: AddressResult) => void;
}

const NearbyReconSheet: React.FC<NearbyReconSheetProps> = ({
  open,
  blocks,
  onClose,
  onSelect,
  onAttack,
  onClaim,
  onHold,
  onGeocode,
}) => {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => searchRecon(blocks, query), [blocks, query]);

  if (!open) return null;

  return (
    <div className="recon-sheet" data-testid="nearby-recon-sheet">
      <div className="recon-handle" />
      <div className="recon-head">
        <div>
          <h2>Search Maps</h2>
          <p>Blocks around you — attack, claim, or hold</p>
        </div>
        <button type="button" className="recon-close" onClick={onClose} aria-label="Close search">
          Done
        </button>
      </div>

      <label className="recon-search">
        <Search size={16} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter nearby strips…"
          autoFocus
        />
      </label>

      {onGeocode && (
        <div className="recon-geocode">
          <AddressSearchBar
            inline
            placeholder="Search any address like Apple Maps…"
            onResult={onGeocode}
          />
        </div>
      )}

      <div className="recon-chips">
        <span>{blocks.filter((b) => b.owner === 'npc').length} attackable</span>
        <span>{blocks.filter((b) => b.owner === 'unclaimed').length} open</span>
        <span>{blocks.filter((b) => b.owner === 'player').length} yours</span>
      </div>

      <ul className="recon-list">
        {filtered.map((block) => (
          <li key={block.id} className={`recon-item owner-${block.owner}`}>
            <button type="button" className="recon-main" onClick={() => onSelect(block)}>
              <span className="recon-icon">
                {block.owner === 'npc' ? <Swords size={16} /> : block.owner === 'player' ? <Shield size={16} /> : <MapPin size={16} />}
              </span>
              <span className="recon-copy">
                <span className="recon-addr">{block.address}</span>
                <span className="recon-meta">{describeRecon(block)} · {formatWalkingMins(block.distanceMeters)} walk</span>
              </span>
              <span className="recon-dist">{formatDistance(block.distanceMeters)}</span>
            </button>
            <div className="recon-actions">
              {block.owner === 'npc' && (
                <button type="button" className="hit" onClick={() => onAttack(block)}>
                  <Crosshair size={14} /> Slide
                </button>
              )}
              {block.owner === 'unclaimed' && (
                <button type="button" className="claim" onClick={() => onClaim(block)}>
                  Claim
                </button>
              )}
              {block.owner === 'player' && (
                <button type="button" className="hold" onClick={() => onHold(block)}>
                  Drop crew
                </button>
              )}
            </div>
          </li>
        ))}
        {filtered.length === 0 && <li className="recon-empty">No strips match that search.</li>}
      </ul>
    </div>
  );
};

export default NearbyReconSheet;
