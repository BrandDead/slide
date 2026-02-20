// ============================================================
// DEALT/SLIDE — Onboarding: Gang Setup Flow
// Step 1: Gang Name & Tag
// Step 2: Gang Style & Colors
// Step 3: Logo (upload or generate)
// Step 4: Graffiti Options Preview
// Step 5: Confirm & Start
// ============================================================

import React, { useState, useMemo, useCallback } from 'react';
import { usePlayerStore } from '../../stores/gameStore';
import { generateAllGraffitiOptions, GRAFFITI_STYLES } from '../../utils/graffitiEngine';
import type { GangStyle, GangProfile, GraffitiOption } from '../../types/game.types';
import './Onboarding.css';

const GANG_STYLES: { id: GangStyle; name: string; icon: string; desc: string }[] = [
  { id: 'street', name: 'Street', icon: '🏚️', desc: 'Hood-grown crew. Respect earned on the block.' },
  { id: 'cartel', name: 'Cartel', icon: '💀', desc: 'Organized empire. Product moves like water.' },
  { id: 'mafia', name: 'Mafia', icon: '🎩', desc: 'Old-school family. Loyalty above all.' },
  { id: 'biker', name: 'Biker', icon: '🏍️', desc: 'Road warriors. Territory is the highway.' },
  { id: 'yakuza', name: 'Yakuza', icon: '🐉', desc: 'Honor-bound syndicate. Discipline is power.' },
  { id: 'triad', name: 'Triad', icon: '🀄', desc: 'Ancient order. Shadows are your weapon.' },
];

const COLOR_PRESETS = [
  { id: 'blood', primary: '#8B0000', secondary: '#FF4444', name: 'Blood Red' },
  { id: 'crip', primary: '#0047AB', secondary: '#60A5FA', name: 'Royal Blue' },
  { id: 'grape', primary: '#6B3FA0', secondary: '#A78BFA', name: 'Grape Purple' },
  { id: 'money', primary: '#228B22', secondary: '#4ADE80', name: 'Money Green' },
  { id: 'gold', primary: '#B8860B', secondary: '#FFD700', name: 'Gold' },
  { id: 'smoke', primary: '#1a1a1a', secondary: '#666666', name: 'Smoke Black' },
  { id: 'fire', primary: '#CC5500', secondary: '#FF8C00', name: 'Fire Orange' },
  { id: 'ice', primary: '#008B8B', secondary: '#00CED1', name: 'Ice Teal' },
];

interface OnboardingProps {
  onComplete: (profile: GangProfile) => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const { player } = usePlayerStore();
  
  const [step, setStep] = useState(1);
  const [gangName, setGangName] = useState('');
  const [gangTag, setGangTag] = useState('');
  const [gangStyle, setGangStyle] = useState<GangStyle>('street');
  const [primaryColor, setPrimaryColor] = useState('#8B0000');
  const [secondaryColor, setSecondaryColor] = useState('#FF4444');
  const [customPrimary, setCustomPrimary] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | undefined>();
  const [logoMode, setLogoMode] = useState<'upload' | 'generate'>('generate');
  const [motto, setMotto] = useState('');
  const [selectedGraffitiIds, setSelectedGraffitiIds] = useState<Set<string>>(new Set());
  
  // Generate graffiti options whenever name/colors change
  const graffitiOptions = useMemo(() => {
    if (gangName.length < 2) return [];
    return generateAllGraffitiOptions(gangName, primaryColor, secondaryColor);
  }, [gangName, primaryColor, secondaryColor]);
  
  const canProceed = useCallback((): boolean => {
    switch (step) {
      case 1: return gangName.length >= 2 && gangTag.length >= 2;
      case 2: return !!gangStyle;
      case 3: return true; // Logo is optional
      case 4: return selectedGraffitiIds.size > 0;
      case 5: return true;
      default: return false;
    }
  }, [step, gangName, gangTag, gangStyle, selectedGraffitiIds]);
  
  const handleColorPreset = (preset: typeof COLOR_PRESETS[0]) => {
    setPrimaryColor(preset.primary);
    setSecondaryColor(preset.secondary);
    setCustomPrimary(false);
  };
  
  const toggleGraffiti = (id: string) => {
    setSelectedGraffitiIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogoUrl(reader.result as string);
    reader.readAsDataURL(file);
  };
  
  const handleComplete = () => {
    const selectedOptions: GraffitiOption[] = graffitiOptions.filter(
      opt => selectedGraffitiIds.has(opt.id)
    );
    
    const profile: GangProfile = {
      name: gangName,
      tag: gangTag.toUpperCase(),
      primaryColor,
      secondaryColor,
      style: gangStyle,
      logoUrl,
      graffitiOptions: selectedOptions,
      motto: motto || `${gangName} runs these streets`,
      foundedAt: new Date().toISOString(),
    };
    
    onComplete(profile);
  };
  
  return (
    <div className="onboarding-container">
      <div className="onboarding-bg" />
      
      {/* Progress bar */}
      <div className="onboarding-progress">
        {[1, 2, 3, 4, 5].map(s => (
          <div key={s} className={`progress-dot ${s <= step ? 'active' : ''} ${s === step ? 'current' : ''}`}>
            {s < step ? '✓' : s}
          </div>
        ))}
        <div className="progress-line">
          <div className="progress-fill" style={{ width: `${((step - 1) / 4) * 100}%` }} />
        </div>
      </div>
      
      {/* Step content */}
      <div className="onboarding-content">
        
        {/* STEP 1: Name & Tag */}
        {step === 1 && (
          <div className="step-panel">
            <h1 className="step-title">Name Your Gang</h1>
            <p className="step-subtitle">Choose a name that strikes fear. Choose a tag that marks territory.</p>
            
            <div className="input-group">
              <label>Gang Name</label>
              <input
                type="text"
                value={gangName}
                onChange={e => setGangName(e.target.value.slice(0, 20))}
                placeholder="e.g. Southside Kings"
                className="gang-input"
                autoFocus
              />
              <span className="char-count">{gangName.length}/20</span>
            </div>
            
            <div className="input-group">
              <label>Gang Tag (abbreviation)</label>
              <input
                type="text"
                value={gangTag}
                onChange={e => setGangTag(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))}
                placeholder="e.g. SSK"
                className="gang-input tag-input"
              />
              <span className="char-count">{gangTag.length}/5</span>
            </div>
            
            <div className="input-group">
              <label>Motto (optional)</label>
              <input
                type="text"
                value={motto}
                onChange={e => setMotto(e.target.value.slice(0, 50))}
                placeholder="e.g. We own these streets"
                className="gang-input"
              />
            </div>
            
            {gangName.length >= 2 && (
              <div className="name-preview">
                <span className="preview-tag" style={{ color: primaryColor }}>[{gangTag || '???'}]</span>
                <span className="preview-name">{gangName}</span>
              </div>
            )}
          </div>
        )}
        
        {/* STEP 2: Style & Colors */}
        {step === 2 && (
          <div className="step-panel">
            <h1 className="step-title">Set Your Style</h1>
            <p className="step-subtitle">Your style defines your crew. Your colors mark your territory.</p>
            
            <div className="style-grid">
              {GANG_STYLES.map(s => (
                <button
                  key={s.id}
                  className={`style-card ${gangStyle === s.id ? 'selected' : ''}`}
                  onClick={() => setGangStyle(s.id)}
                >
                  <span className="style-icon">{s.icon}</span>
                  <span className="style-name">{s.name}</span>
                  <span className="style-desc">{s.desc}</span>
                </button>
              ))}
            </div>
            
            <h2 className="section-label">Gang Colors</h2>
            <div className="color-presets">
              {COLOR_PRESETS.map(c => (
                <button
                  key={c.id}
                  className={`color-preset ${primaryColor === c.primary ? 'selected' : ''}`}
                  onClick={() => handleColorPreset(c)}
                  title={c.name}
                >
                  <div className="color-swatch" style={{ background: `linear-gradient(135deg, ${c.primary}, ${c.secondary})` }} />
                  <span className="color-name">{c.name}</span>
                </button>
              ))}
            </div>
            
            <button className="custom-color-toggle" onClick={() => setCustomPrimary(!customPrimary)}>
              {customPrimary ? 'Hide' : 'Custom Colors'}
            </button>
            
            {customPrimary && (
              <div className="custom-colors">
                <div className="color-picker-row">
                  <label>Primary</label>
                  <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} />
                  <span>{primaryColor}</span>
                </div>
                <div className="color-picker-row">
                  <label>Secondary</label>
                  <input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} />
                  <span>{secondaryColor}</span>
                </div>
              </div>
            )}
            
            <div className="color-preview-bar" style={{ background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})` }}>
              <span>{gangName || 'Your Gang'}</span>
            </div>
          </div>
        )}
        
        {/* STEP 3: Logo */}
        {step === 3 && (
          <div className="step-panel">
            <h1 className="step-title">Gang Logo</h1>
            <p className="step-subtitle">Upload your own or let the system generate one. This appears on your block.</p>
            
            <div className="logo-mode-toggle">
              <button
                className={`mode-btn ${logoMode === 'generate' ? 'active' : ''}`}
                onClick={() => setLogoMode('generate')}
              >
                AI Generate
              </button>
              <button
                className={`mode-btn ${logoMode === 'upload' ? 'active' : ''}`}
                onClick={() => setLogoMode('upload')}
              >
                Upload
              </button>
            </div>
            
            {logoMode === 'upload' ? (
              <div className="upload-zone">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  id="logo-upload"
                  className="file-input"
                />
                <label htmlFor="logo-upload" className="upload-label">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Gang Logo" className="logo-preview-img" />
                  ) : (
                    <>
                      <span className="upload-icon">📁</span>
                      <span>Tap to upload logo</span>
                      <span className="upload-hint">PNG, JPG, or SVG</span>
                    </>
                  )}
                </label>
              </div>
            ) : (
              <div className="generate-zone">
                <div className="generated-logo" style={{
                  background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                  borderColor: secondaryColor,
                }}>
                  <span className="logo-tag">{gangTag || gangName.slice(0, 3).toUpperCase()}</span>
                  <span className="logo-name">{gangName}</span>
                  <span className="logo-style">{GANG_STYLES.find(s => s.id === gangStyle)?.icon}</span>
                </div>
                <p className="generate-note">Logo will be generated based on your gang style and colors. You can customize it later in Settings.</p>
              </div>
            )}
          </div>
        )}
        
        {/* STEP 4: Graffiti Options */}
        {step === 4 && (
          <div className="step-panel">
            <h1 className="step-title">Choose Your Tags</h1>
            <p className="step-subtitle">Select the graffiti styles you want to use when vandalizing opp blocks. You can use these to tag territory and disrespect rivals.</p>
            
            {graffitiOptions.length > 0 ? (
              <div className="graffiti-options">
                {graffitiOptions.map(opt => {
                  const config = GRAFFITI_STYLES.find(s => s.type === opt.style);
                  const isSelected = selectedGraffitiIds.has(opt.id);
                  
                  return (
                    <button
                      key={opt.id}
                      className={`graffiti-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleGraffiti(opt.id)}
                    >
                      <div className="graffiti-preview" dangerouslySetInnerHTML={{ __html: opt.svgData }} />
                      <div className="graffiti-info">
                        <span className="graffiti-style-name">{config?.name}</span>
                        <span className="graffiti-complexity">{config?.complexity} complexity</span>
                        <span className="graffiti-time">⏱ {config?.timeSeconds}s base time</span>
                        <span className="graffiti-xp">+{config?.xpReward} XP</span>
                      </div>
                      {isSelected && <div className="selected-badge">✓</div>}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="no-options">Enter a gang name (Step 1) to generate graffiti options.</p>
            )}
            
            <div className="graffiti-legend">
              <h3>Graffiti Styles</h3>
              <table className="style-table">
                <thead>
                  <tr>
                    <th>Style</th>
                    <th>Complexity</th>
                    <th>Time</th>
                    <th>Legibility</th>
                    <th>XP</th>
                  </tr>
                </thead>
                <tbody>
                  {GRAFFITI_STYLES.map(s => (
                    <tr key={s.type}>
                      <td>{s.name}</td>
                      <td>{s.complexity}</td>
                      <td>{s.timeSeconds}s</td>
                      <td>{s.legibility}</td>
                      <td>+{s.xpReward}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* STEP 5: Confirm */}
        {step === 5 && (
          <div className="step-panel">
            <h1 className="step-title">Confirm Your Gang</h1>
            <p className="step-subtitle">Review your setup. Once confirmed, you hit the streets.</p>
            
            <div className="confirm-card">
              <div className="confirm-header" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}>
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="confirm-logo" />
                ) : (
                  <div className="confirm-logo-placeholder">
                    <span>{gangTag || gangName.slice(0, 3).toUpperCase()}</span>
                  </div>
                )}
                <div className="confirm-name-block">
                  <h2>{gangName}</h2>
                  <span className="confirm-tag">[{gangTag}]</span>
                </div>
              </div>
              
              <div className="confirm-details">
                <div className="confirm-row">
                  <span className="confirm-label">Style</span>
                  <span>{GANG_STYLES.find(s => s.id === gangStyle)?.icon} {GANG_STYLES.find(s => s.id === gangStyle)?.name}</span>
                </div>
                <div className="confirm-row">
                  <span className="confirm-label">Motto</span>
                  <span>{motto || `${gangName} runs these streets`}</span>
                </div>
                <div className="confirm-row">
                  <span className="confirm-label">Colors</span>
                  <div className="confirm-colors">
                    <div className="color-dot" style={{ background: primaryColor }} />
                    <div className="color-dot" style={{ background: secondaryColor }} />
                  </div>
                </div>
                <div className="confirm-row">
                  <span className="confirm-label">Tags Selected</span>
                  <span>{selectedGraffitiIds.size} / {graffitiOptions.length}</span>
                </div>
              </div>
              
              {/* Show selected graffiti previews */}
              <div className="confirm-graffiti">
                {graffitiOptions
                  .filter(opt => selectedGraffitiIds.has(opt.id))
                  .map(opt => (
                    <div key={opt.id} className="confirm-graffiti-thumb" dangerouslySetInnerHTML={{ __html: opt.svgData }} />
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Navigation */}
      <div className="onboarding-nav">
        {step > 1 && (
          <button className="nav-btn back-btn" onClick={() => setStep(s => s - 1)}>
            ← Back
          </button>
        )}
        <div className="nav-spacer" />
        {step < 5 ? (
          <button
            className="nav-btn next-btn"
            onClick={() => setStep(s => s + 1)}
            disabled={!canProceed()}
          >
            Next →
          </button>
        ) : (
          <button
            className="nav-btn start-btn"
            onClick={handleComplete}
            style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
          >
            Start the Game
          </button>
        )}
      </div>
    </div>
  );
}
