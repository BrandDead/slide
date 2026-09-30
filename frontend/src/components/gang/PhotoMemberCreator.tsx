// ============================================================
// PhotoMemberCreator — Upload a photo → AI-generated gang member
// Follows the GLM-5.2 prompt spec from SLIDE_GLM52_PHOTO_UPLOAD_PROMPT.md
// Sprint: morale-heat-photo-batch2
// ============================================================

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGangStore, usePlayerStore } from '../../stores/gameStore';
import type { AvatarGenerationStatus, GeneratedMemberAsset } from '../../types/avatar.types';
import type { GangMember } from '../../types/game.types';
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

const MIN_NAME_LENGTH = 2;
const POLL_INTERVAL_MS = 2000;

const isValidMemberName = (name: string) => name.trim().length >= MIN_NAME_LENGTH;

/**
 * Merge a status/approve response over the asset we already hold. The
 * service fallbacks return records without image URLs, so only defined
 * fields may overwrite what generation produced.
 */
function mergeAsset(
  base: GeneratedMemberAsset,
  update: Partial<GeneratedMemberAsset> | null | undefined,
): GeneratedMemberAsset {
  const merged: GeneratedMemberAsset = { ...base };
  if (!update) return merged;
  for (const [key, value] of Object.entries(update)) {
    if (value !== undefined && value !== null) {
      (merged as unknown as Record<string, unknown>)[key] = value;
    }
  }
  return merged;
}

/**
 * A complete GangMember for a photo-created recruit, with the same neutral
 * starting line as the other Contacts recruit paths. The uploaded source
 * photo is never stored; only generated asset URLs are.
 */
function buildPhotoMember(input: {
  asset: GeneratedMemberAsset;
  name: string;
  role: RoleId;
  gangId: string;
  now?: string;
}): GangMember {
  const { asset, name, role, gangId } = input;
  const now = input.now ?? new Date().toISOString();
  const portrait = asset.portraitUrl ?? asset.fullbodyUrl;
  return {
    id: asset.id,
    gangId,
    name,
    nickname: '',
    avatarUrl: portrait ?? '',
    backstory: 'Joined the crew from your Contacts.',
    age: 21,
    region: 'miami',
    stats: {
      strength: 50,
      agility: 50,
      intelligence: 50,
      charisma: 50,
      luck: 50,
      intimidation: 50,
    },
    level: 1,
    experience: 0,
    xp: 0,
    skillPoints: 0,
    skills: [],
    loyalty: 80,
    morale: 75,
    respect: 10,
    kills: 0,
    arrests: 0,
    dealsCompleted: 0,
    moneyEarned: 0,
    status: 'active',
    currentAssignment: null,
    joinedAt: now,
    hiredAt: now,
    role,
    health: 100,
    maxHealth: 100,
    inventory: [],
    customAvatarUrl: portrait,
    portraitUrl: asset.portraitUrl,
    fullbodyUrl: asset.fullbodyUrl,
    topdownUrl: asset.topdownUrl,
  };
}

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
  const [memberName, setMemberName] = useState('');
  const [selectedRole, setSelectedRole] = useState<RoleId>('dealer');
  const [selectedStyle, setSelectedStyle] = useState<StyleId>('south_florida_streetwear');
  const [selectedOutputs, setSelectedOutputs] = useState<OutputId[]>(['portrait', 'fullbody']);

  // Generation state
  const [status, setStatus] = useState<AvatarGenerationStatus>('idle');
  const [generatedAsset, setGeneratedAsset] = useState<GeneratedMemberAsset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Synchronous guard: two taps in one frame must not recruit twice.
  const approvingRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  // ── File drop / select ──
  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file.');
      return;
    }
    setUploadedFile(file);
    // The previous preview URL is revoked by the preview effect below.
    setPreviewUrl(URL.createObjectURL(file));
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

  // Revoke a preview URL when it is replaced or the creator unmounts.
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  // Generation polling is only cancelled on unmount (or when the job
  // finishes / a new job starts), never by replacing the preview photo.
  useEffect(() => stopPolling, [stopPolling]);

  // ── Generate ──
  const handleGenerate = useCallback(async () => {
    if (!uploadedFile || !consent || !isValidMemberName(memberName) || selectedOutputs.length === 0) return;
    stopPolling();
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
          setGeneratedAsset(prev => mergeAsset(prev ?? result, updated));
          if (updated.status === 'ready' || updated.status === 'failed') {
            stopPolling();
            setStatus(updated.status);
          }
        }, POLL_INTERVAL_MS);
      } else {
        setStatus(result.status);
      }
    } catch (err: any) {
      setError(err.message ?? 'Generation failed. Try again.');
      setStatus('failed');
    }
  }, [uploadedFile, consent, memberName, selectedRole, selectedStyle, selectedOutputs, stopPolling]);

  // ── Approve ──
  const handleApprove = useCallback(async () => {
    if (!generatedAsset || approvingRef.current) return;
    const name = memberName.trim();
    if (!isValidMemberName(name)) {
      setError(`Give your member a name (at least ${MIN_NAME_LENGTH} characters).`);
      return;
    }
    approvingRef.current = true;
    setApproving(true);
    setError(null);
    try {
      const approved = await avatarGenerationService.approve(generatedAsset.id);
      const finalAsset = mergeAsset(generatedAsset, approved);
      const gang = useGangStore.getState();
      if (!gang.members.some(member => member.id === finalAsset.id)) {
        const gangId = gang.members[0]?.gangId ?? usePlayerStore.getState().player.id;
        addMember(buildPhotoMember({ asset: finalAsset, name, role: selectedRole, gangId }));
      }
      onApproved?.(finalAsset.id);
      onClose();
    } catch (err: any) {
      approvingRef.current = false;
      setApproving(false);
      setError(err.message ?? 'Approval failed.');
    }
  }, [generatedAsset, memberName, selectedRole, addMember, onApproved, onClose]);

  // ── Regenerate ──
  const handleRegenerate = useCallback(() => {
    stopPolling();
    setGeneratedAsset(null);
    setStatus('idle');
    setError(null);
  }, [stopPolling]);

  const nameIsValid = isValidMemberName(memberName);
  const canGenerate = uploadedFile && consent && nameIsValid && selectedOutputs.length > 0 && status === 'idle';
  const canApprove = nameIsValid && !approving;
  const stockPreview = generatedAsset?.id.startsWith('mock-') ?? false;

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

        <section className="pmc-section">
          <h3 className="pmc-section-title">2. Name Your Member</h3>
          <input
            className="pmc-name-input"
            value={memberName}
            maxLength={24}
            placeholder="Name or nickname"
            onChange={e => setMemberName(e.target.value)}
            aria-label="Member name"
          />
        </section>

        {/* ── Step 3: Role ── */}
        <section className="pmc-section">
          <h3 className="pmc-section-title">3. Choose Role</h3>
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
          <h3 className="pmc-section-title">4. Choose Style</h3>
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
          <h3 className="pmc-section-title">5. Asset Outputs</h3>
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
              <h3 className="pmc-result-title">{stockPreview ? 'Stock Character Preview' : 'Generated Assets'}</h3>
              {stockPreview && (
                <p role="status">Generation is offline. This preview uses stock character art.</p>
              )}
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
                  disabled={!canApprove}
                  whileTap={canApprove ? { scale: 0.95 } : {}}
                >
                  {approving ? 'Adding…' : '✅ Add to Roster'}
                </motion.button>
                <motion.button
                  className="pmc-btn regen"
                  onClick={handleRegenerate}
                  disabled={approving}
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
