// ============================================================
// PhotoMemberCreator — Upload a photo → AI-generated gang member
// Follows the GLM-5.2 prompt spec from SLIDE_GLM52_PHOTO_UPLOAD_PROMPT.md
// Sprint: morale-heat-photo-batch2
// ============================================================

import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGangStore } from '../../stores/gameStore';
import type { AvatarGenerationStatus, GeneratedMemberAsset } from '../../types/avatar.types';
import { avatarGenerationService } from '../../services/avatarGeneration.service';
import './PhotoMemberCreator.css';

// ─── Constants ───────────────────────────────────────────────

const ROLES = [
  { id: 'dealer',   label: '💊 Dealer',   desc: 'Moves product on the block' },
  { id: 'shooter',  label: '🔫 Shooter',  desc: 'Handles protection' },
  { id: 'driver',   label: '🚗 Driver',   desc: 'Getaway and transport' },
  { id: 'enforcer', label: '💪 Enforcer', desc: 'Muscle and intimidation' },
  { id: 'lookout',  label: '👁️ Lookout',  desc: 'Eyes on the block' },
  { id: 'runner',   label: '🏃 Runner',   desc: 'Quick errands and drops' },
  { id: 'chemist',  label: '⚗️ Chemist',  desc: 'Cooks and formulates' },
] as const;

const STYLES = [
  { id: 'south_florida_streetwear', label: 'South Florida Streetwear' },
  { id: 'luxury_noir',              label: 'Luxury Noir' },
  { id: 'masked_tactical',          label: 'Masked Tactical' },
  { id: 'baggy_2000s',              label: 'Baggy 2000s' },
  { id: 'clean_designer',           label: 'Clean Designer' },
] as const;

const OUTPUTS = [
  { id: 'portrait',  label: '🖼️ Portrait' },
  { id: 'fullbody',  label: '🧍 Full Body' },
  { id: 'topdown',   label: '🔭 Top-Down Token' },
] as const;

type RoleId   = typeof ROLES[number]['id'];
type StyleId  = typeof STYLES[number]['id'];
type OutputId = typeof OUTPUTS[number]['id'];

// ─── Component ───────────────────────────────────────────────

interface PhotoMemberCreatorProps {
  onClose: () => void;
  onApproved?: (memberId: string) => void;
}

const PhotoMemberCreator: React.FC<PhotoMemberCreatorProps> = ({ onClose, onApproved }) => {
  const { addMember } = useGangStore();

  // Form state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleId>('dealer');
  const [selectedStyle, setSelectedStyle] = useState<StyleId>('south_florida_streetwear');
  const [selectedOutputs, setSelectedOutputs] = useState<OutputId[]>(['portrait', 'fullbody']);

  // Generation state
  const [status, setStatus] = useState<AvatarGenerationStatus>('idle');
  const [generatedAsset, setGeneratedAsset] = useState<GeneratedMemberAsset | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── File drop / select ──
  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file.');
      return;
    }
    setUploadedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setError(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  // ── Toggle output ──
  const toggleOutput = useCallback((id: OutputId) => {
    setSelectedOutputs(prev =>
      prev.includes(id) ? prev.filter(o => o !== id) : [...prev, id]
    );
  }, []);

  // ── Generate ──
  const handleGenerate = useCallback(async () => {
    if (!uploadedFile || !consent || selectedOutputs.length === 0) return;
    setStatus('uploading');
    setError(null);

    try {
      const result = await avatarGenerationService.generate({
        imageFile: uploadedFile,
        role: selectedRole,
        style: selectedStyle,
        outputs: selectedOutputs,
      });

      setStatus('generating');
      setGeneratedAsset(result);

      // Poll for completion if async
      if (result.status === 'queued' || result.status === 'generating') {
        pollRef.current = setInterval(async () => {
          const updated = await avatarGenerationService.getStatus(result.id);
          setGeneratedAsset(updated);
          if (updated.status === 'ready' || updated.status === 'failed') {
            clearInterval(pollRef.current!);
            setStatus(updated.status);
          }
        }, 2000);
      } else {
        setStatus(result.status);
      }
    } catch (err: any) {
      setError(err.message ?? 'Generation failed. Try again.');
      setStatus('failed');
    }
  }, [uploadedFile, consent, selectedRole, selectedStyle, selectedOutputs]);

  // ── Approve ──
  const handleApprove = useCallback(async () => {
    if (!generatedAsset) return;
    try {
      const approved = await avatarGenerationService.approve(generatedAsset.id);
      // Add to gang roster
      addMember({
        id: approved.id,
        name: `${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)} (Custom)`,
        role: selectedRole,
        level: 1,
        status: 'active',
        loyalty: 80,
        portraitUrl: approved.portraitUrl,
        fullbodyUrl: approved.fullbodyUrl,
        topdownUrl: approved.topdownUrl,
      } as any);
      onApproved?.(approved.id);
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Approval failed.');
    }
  }, [generatedAsset, selectedRole, addMember, onApproved, onClose]);

  // ── Regenerate ──
  const handleRegenerate = useCallback(() => {
    setGeneratedAsset(null);
    setStatus('idle');
    setError(null);
  }, []);

  const canGenerate = uploadedFile && consent && selectedOutputs.length > 0 && status === 'idle';

  return (
    <div className="pmc-container">
      {/* Header */}
      <div className="pmc-header">
        <h2 className="pmc-title">Create Member</h2>
        <button className="pmc-close" onClick={onClose}>✕</button>
      </div>

      <div className="pmc-body">
        {/* ── Step 1: Upload ── */}
        <section className="pmc-section">
          <h3 className="pmc-section-title">1. Upload Photo</h3>
          <div
            className={`pmc-dropzone ${previewUrl ? 'has-preview' : ''}`}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
          >
            {previewUrl ? (
              <img src={previewUrl} alt="Preview" className="pmc-preview-img" />
            ) : (
              <div className="pmc-drop-hint">
                <span className="pmc-drop-icon">📸</span>
                <span>Drop a photo or tap to upload</span>
                <span className="pmc-drop-sub">JPG, PNG, WEBP</span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleInputChange}
              style={{ display: 'none' }}
            />
          </div>

          <label className="pmc-consent">
            <input
              type="checkbox"
              checked={consent}
              onChange={e => setConsent(e.target.checked)}
            />
            <span>I have permission to use this image and consent to AI processing.</span>
          </label>
        </section>

        {/* ── Step 2: Role ── */}
        <section className="pmc-section">
          <h3 className="pmc-section-title">2. Choose Role</h3>
          <div className="pmc-role-grid">
            {ROLES.map(r => (
              <motion.button
                key={r.id}
                className={`pmc-role-btn ${selectedRole === r.id ? 'active' : ''}`}
                onClick={() => setSelectedRole(r.id)}
                whileTap={{ scale: 0.95 }}
              >
                <span className="pmc-role-label">{r.label}</span>
                <span className="pmc-role-desc">{r.desc}</span>
              </motion.button>
            ))}
          </div>
        </section>

        {/* ── Step 3: Style ── */}
        <section className="pmc-section">
          <h3 className="pmc-section-title">3. Choose Style</h3>
          <div className="pmc-style-list">
            {STYLES.map(s => (
              <motion.button
                key={s.id}
                className={`pmc-style-btn ${selectedStyle === s.id ? 'active' : ''}`}
                onClick={() => setSelectedStyle(s.id)}
                whileTap={{ scale: 0.95 }}
              >
                {s.label}
              </motion.button>
            ))}
          </div>
        </section>

        {/* ── Step 4: Outputs ── */}
        <section className="pmc-section">
          <h3 className="pmc-section-title">4. Asset Outputs</h3>
          <div className="pmc-output-list">
            {OUTPUTS.map(o => (
              <motion.button
                key={o.id}
                className={`pmc-output-btn ${selectedOutputs.includes(o.id) ? 'active' : ''}`}
                onClick={() => toggleOutput(o.id)}
                whileTap={{ scale: 0.95 }}
              >
                {o.label}
              </motion.button>
            ))}
          </div>
        </section>

        {/* ── Error ── */}
        {error && (
          <div className="pmc-error">{error}</div>
        )}

        {/* ── Generate button ── */}
        {status === 'idle' && (
          <motion.button
            className={`pmc-generate-btn ${!canGenerate ? 'disabled' : ''}`}
            onClick={handleGenerate}
            disabled={!canGenerate}
            whileTap={canGenerate ? { scale: 0.97 } : {}}
          >
            🎨 Generate Member
          </motion.button>
        )}

        {/* ── Loading ── */}
        <AnimatePresence>
          {(status === 'uploading' || status === 'queued' || status === 'generating') && (
            <motion.div
              className="pmc-loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="pmc-spinner" />
              <span>
                {status === 'uploading' ? 'Uploading...' :
                 status === 'queued'    ? 'In queue...' :
                 'Generating assets...'}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Result gallery ── */}
        <AnimatePresence>
          {status === 'ready' && generatedAsset && (
            <motion.div
              className="pmc-result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h3 className="pmc-result-title">Generated Assets</h3>
              <div className="pmc-asset-gallery">
                {generatedAsset.portraitUrl && (
                  <div className="pmc-asset-card">
                    <img src={generatedAsset.portraitUrl} alt="Portrait" />
                    <span>Portrait</span>
                  </div>
                )}
                {generatedAsset.fullbodyUrl && (
                  <div className="pmc-asset-card">
                    <img src={generatedAsset.fullbodyUrl} alt="Full Body" />
                    <span>Full Body</span>
                  </div>
                )}
                {generatedAsset.topdownUrl && (
                  <div className="pmc-asset-card">
                    <img src={generatedAsset.topdownUrl} alt="Top-Down" />
                    <span>Token</span>
                  </div>
                )}
              </div>
              <div className="pmc-result-actions">
                <motion.button
                  className="pmc-btn approve"
                  onClick={handleApprove}
                  whileTap={{ scale: 0.95 }}
                >
                  ✅ Add to Roster
                </motion.button>
                <motion.button
                  className="pmc-btn regen"
                  onClick={handleRegenerate}
                  whileTap={{ scale: 0.95 }}
                >
                  🔄 Regenerate
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default PhotoMemberCreator;
