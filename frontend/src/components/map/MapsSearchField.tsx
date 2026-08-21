import React from 'react';
import { Search } from 'lucide-react';
import './MapsChrome.css';

interface MapsSearchFieldProps {
  onFocus: () => void;
  placeholder?: string;
}

/** Floating iOS Maps-style search affordance. Opens the recon sheet. */
const MapsSearchField: React.FC<MapsSearchFieldProps> = ({
  onFocus,
  placeholder = 'Search Maps',
}) => {
  return (
    <button type="button" className="maps-search" onClick={onFocus} data-testid="maps-search-field">
      <Search size={16} />
      <span>{placeholder}</span>
    </button>
  );
};

export default MapsSearchField;
