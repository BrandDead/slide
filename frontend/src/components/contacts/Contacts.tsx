// ============================================================
// Contacts - Gang Member Management
// Sprint 2: Morale badges, deploy warnings, bail/hospital,
//           XP bars, equip product, member progression
// ============================================================

import React, { useState, useRef, useCallback, lazy, Suspense } from 'react';
// Lazy-load PhotoMemberCreator so it doesn't bloat the main bundle
const PhotoMemberCreator = lazy(() => import('../gang/PhotoMemberCreator'));
import { motion, AnimatePresence } from 'framer-motion';
import {
  useNavigationStore,
  useGangStore,
  useMoraleStore,
  useSelfieStore,
  usePlayerStore,
  useEconomyStore,
  useNotificationStore,
} from '../../stores/gameStore';
import { getMoraleDescription, getMoraleConsequences, rollMoraleConsequences, calculateBailImpact, calculateHospitalImpact } from '../../utils/moraleSystem';
import { getMemberHeatContribution } from '../../utils/memberProgression';
import type { GangMember, Contact, MemberStatus, GetBackRequest } from '../../types/game.types';
import BailHospitalPanel from './BailHospitalPanel';
import { needsRecovery } from '../../utils/bailHospitalSystem';
import { soundManager } from '../../utils/SoundManager';
import './Contacts.css';

type TabType = 'active' | 'jailed' | 'recovery' | 'dead' | 'requests';

// ============ MAIN COMPONENT ============

const Contacts: React.FC = () => {
  const { goBack } = useNavigationStore();
  const { members, contacts, addMember, backdoorMember, killMember, updateMember, releaseMember } = useGangStore();
  const { getBackRequests, resolveGetBackRequest } = useMoraleStore();
  const { uploads, addUpload } = useSelfieStore();
  const { player, updateMoney } = usePlayerStore();
  const { inventory, transferItemToMember } = useEconomyStore();
  const { addNotification } = useNotificationStore();

  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showSelfieUpload, setShowSelfieUpload] = useState(false);
  const [showPhotoCreator, setShowPhotoCreator] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [showDeployWarning, setShowDeployWarning] = useState<string | null>(null);
  const [deployConsequences, setDeployConsequences] = useState<any[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter contacts by status
  const activeMembers = contacts.filter(c => c.status === 'active');
  const jailedMembers = contacts.filter(c => c.status === 'jailed');
  const deadMembers = contacts.filter(c => c.status === 'dead' || c.status === 'backdoored');
  // Counted off gang members, not contacts: injured statuses live on the
  // member record and never make it onto a contact card.
  const recoverableCount = members.filter(needsRecovery).length;
  const pendingRequests = getBackRequests.filter(r => r.status === 'pending');

  // Drug inventory for equipping
  const drugInventory = inventory.filter(i => i.type === 'drug' && i.quantity > 0);

  const handleSelfieUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const imageUrl = event.target?.result as string;
      setUploadedImage(imageUrl);
      addUpload({
        id: Date.now().toString(),
        imageUrl,
        status: 'pending',
        uploadedAt: new Date().toISOString(),
      });
    };
    reader.readAsDataURL(file);
  };

  const generateMemberFromSelfie = () => {
    if (!uploadedImage) return;
    const newMember: any = {
      id: `member-${Date.now()}`,
      name: 'New Recruit',
      nickname: '',
      role: 'shooter',
      status: 'active',
      level: 1,
      xp: 0,
      shooting: 50 + Math.floor(Math.random() * 30),
      driving: 40 + Math.floor(Math.random() * 30),
      dealing: 30 + Math.floor(Math.random() * 40),
      loyalty: 60 + Math.floor(Math.random() * 20),
      morale: 70 + Math.floor(Math.random() * 20),
      heatResistance: 40 + Math.floor(Math.random() * 30),
      stealth: 35 + Math.floor(Math.random() * 35),
      health: 100,
      maxHealth: 100,
      armor: 0,
      weaponMods: [],
      gear: [],
      inventory: [],
      appearance: {
        gender: Math.random() > 0.5 ? 'male' : 'female',
        skinTone: '#8B4513',
        hairStyle: 'short',
        hairColor: 'black',
        jewelry: [],
        tattoos: [],
        top: 'hoodie',
        bottom: 'jeans',
        shoes: 'jordans',
        gangColorAccent: true,
      },
      customAvatarUrl: uploadedImage,
      backstory: generateBackstory(),
      connections: generateConnections(),
      hiredAt: new Date().toISOString(),
    };
    addMember(newMember);
    setShowSelfieUpload(false);
    setUploadedImage(null);
  };

  const generateBackstory = () => {
    const origins = [
      'Grew up on the block, never knew anything else.',
      'Got kicked out at 16, had to survive somehow.',
      'Lost family to the streets, looking for revenge.',
      'Used to have a 9-5, but bills don\'t pay themselves.',
      'Ran with crews since middle school.',
    ];
    const reasons = [
      'Needs money to support their mama.',
      'Trying to build something real.',
      'Got beef that needs settling.',
      'Looking for family, found us.',
      'No other options left.',
    ];
    const struggles = ['Anger issues', 'Trust problems', 'Lost someone close', 'Police on their back', 'Old debts to pay'];
    return {
      origin: origins[Math.floor(Math.random() * origins.length)],
      reason: reasons[Math.floor(Math.random() * reasons.length)],
      struggles: [struggles[Math.floor(Math.random() * struggles.length)]],
      personality: ['Loyal', 'Quick-tempered'],
      skills: ['Street smart'],
      quirks: ['Always watching the door'],
      dreams: ['Get out someday'],
      fears: ['Losing more people'],
    };
  };

  const generateConnections = () => {
    const connectionTypes = [
      { relationship: 'family' as const, type: 'mother' as const, name: 'Mama' },
      { relationship: 'family' as const, type: 'sibling' as const, name: 'Little Sis' },
      { relationship: 'friend' as const, type: 'bestfriend' as const, name: 'Day One' },
      { relationship: 'romantic' as const, type: 'spouse' as const, name: 'Wifey' },
    ];
    const numConnections = 1 + Math.floor(Math.random() * 3);
    const connections = [];
    for (let i = 0; i < numConnections; i++) {
      const conn = connectionTypes[Math.floor(Math.random() * connectionTypes.length)];
      connections.push({
        id: `conn-${Date.now()}-${i}`,
        name: conn.name,
        relationship: conn.relationship,
        type: conn.type,
        status: 'alive' as const,
        canBeTargeted: true,
        locationKnown: Math.random() > 0.5,
      });
    }
    return connections;
  };

  const handleBackdoor = (memberId: string) => {
    if (window.confirm('Are you sure you want to backdoor this member? This cannot be undone.')) {
      backdoorMember(memberId, 'Backdoored by player');
    }
  };

  // Deploy with morale check
  const handleDeploy = useCallback((memberId: string) => {
    const member = members.find(m => m.id === memberId);
    if (!member) return;
    const morale = (member as any).morale ?? 50;
    if (morale < 50) {
      const consequences = getMoraleConsequences(morale, memberId);
      setDeployConsequences(consequences);
      setShowDeployWarning(memberId);
    } else {
      addNotification({ type: 'info', title: 'Deployed', message: `${(member as any).name || 'Member'} sent to the block.`, priority: 'normal' });
    }
  }, [members, addNotification]);

  const confirmDeploy = useCallback(() => {
    if (!showDeployWarning) return;
    const rolled = rollMoraleConsequences(deployConsequences);
    if (rolled.length > 0) {
      rolled.forEach(c => {
        addNotification({ type: 'warning', title: `Morale Issue: ${c.type}`, message: c.description, priority: 'high' });
      });
    }
    setShowDeployWarning(null);
    setDeployConsequences([]);
  }, [showDeployWarning, deployConsequences, addNotification]);

  // Bail out jailed member
  const handleBail = useCallback((memberId: string) => {
    const bailCost = 500 + Math.floor(Math.random() * 2000);
    if (player.money < bailCost) {
      addNotification({ type: 'warning', title: 'Not Enough Cash', message: `Bail costs $${bailCost.toLocaleString()}. You only have $${player.money.toLocaleString()}.`, priority: 'normal' });
      return;
    }
    updateMoney(-bailCost);
    releaseMember(memberId);
    soundManager.play('bail_paid');
    const impact = calculateBailImpact(members.length, 'member');
    addNotification({ type: 'info', title: 'Member Bailed Out', message: `Paid $${bailCost.toLocaleString()} bail. ${impact.message}`, priority: 'normal' });
  }, [player.money, updateMoney, releaseMember, members.length, addNotification]);

  // Leave jailed member (morale penalty)
  const handleLeaveMember = useCallback((memberId: string) => {
    const impact = calculateBailImpact(members.length, 'member');
    // Apply morale penalty to all active members
    members.forEach(m => {
      if (m.status === 'active' && (m as any).morale !== undefined) {
        updateMember(m.id, { morale: Math.max(0, ((m as any).morale || 50) + impact.moraleChange) } as any);
      }
    });
    addNotification({ type: 'warning', title: 'Member Abandoned', message: impact.message, priority: 'high' });
  }, [members, updateMember, addNotification]);

  return (
    <div className="contacts-screen">
      {/* Header */}
      <div className="contacts-header">
        <motion.button className="back-button" onClick={goBack} whileTap={{ scale: 0.9 }}>
          ← Back
        </motion.button>
        <div className="contacts-title">
          <span className="title-icon">👥</span>
          <span className="title-text">CREW</span>
        </div>
        <motion.button
          className="add-button"
          onClick={() => setShowAddMember(true)}
          whileTap={{ scale: 0.9 }}
        >
          + Add
        </motion.button>
      </div>

      {/* Tabs */}
      <div className="contacts-tabs">
        <button className={`tab ${activeTab === 'active' ? 'active' : ''}`} onClick={() => setActiveTab('active')}>
          Active ({activeMembers.length})
        </button>
        <button className={`tab ${activeTab === 'jailed' ? 'active' : ''}`} onClick={() => setActiveTab('jailed')}>
          ⛓️ Jailed ({jailedMembers.length})
        </button>
        <button className={`tab ${activeTab === 'recovery' ? 'active' : ''}`} onClick={() => setActiveTab('recovery')}>
          🏥 Recover ({recoverableCount})
        </button>
        <button className={`tab ${activeTab === 'dead' ? 'active' : ''}`} onClick={() => setActiveTab('dead')}>
          💀 Dead ({deadMembers.length})
        </button>
        <button className={`tab ${activeTab === 'requests' ? 'active' : ''}`} onClick={() => setActiveTab('requests')}>
          ⚠️ Requests ({pendingRequests.length})
        </button>
      </div>

      {/* Contact List */}
      <div className="contacts-list">
        {activeTab === 'active' && activeMembers.map(contact => {
          const member = members.find(m => m.id === contact.memberId);
          const morale = (member as any)?.morale ?? 50;
          const moraleInfo = getMoraleDescription(morale);
          return (
            <ContactCard
              key={contact.id}
              contact={contact}
              moraleBadge={moraleInfo}
              memberLevel={(member as any)?.level}
              onClick={() => setSelectedContact(contact)}
              onBackdoor={() => handleBackdoor(contact.memberId ?? contact.id)}
            />
          );
        })}

        {activeTab === 'jailed' && jailedMembers.map(contact => (
          <JailedCard
            key={contact.id}
            contact={contact}
            onBail={() => handleBail(contact.memberId ?? contact.id)}
            onLeave={() => handleLeaveMember(contact.memberId ?? contact.id)}
            onClick={() => setSelectedContact(contact)}
          />
        ))}

        {activeTab === 'recovery' && <BailHospitalPanel />}

        {activeTab === 'dead' && deadMembers.map(contact => (
          <ContactCard key={contact.id} contact={contact} onClick={() => setSelectedContact(contact)} showDeathInfo />
        ))}

        {activeTab === 'requests' && pendingRequests.map(request => (
          <GetBackRequestCard
            key={request.id}
            request={request}
            onAccept={() => resolveGetBackRequest(request.id, 'completed')}
            onIgnore={() => resolveGetBackRequest(request.id, 'ignored')}
          />
        ))}

        {/* Empty states */}
        {activeTab === 'active' && activeMembers.length === 0 && (
          <div className="empty-state">
            <span className="empty-icon">👥</span>
            <p>No active members yet</p>
            <button onClick={() => setShowAddMember(true)}>Recruit Someone</button>
          </div>
        )}
        {activeTab === 'jailed' && jailedMembers.length === 0 && (
          <div className="empty-state"><span className="empty-icon">⛓️</span><p>No one locked up. Good.</p></div>
        )}
        {activeTab === 'dead' && deadMembers.length === 0 && (
          <div className="empty-state"><span className="empty-icon">🙏</span><p>No fallen soldiers yet</p></div>
        )}
        {activeTab === 'requests' && pendingRequests.length === 0 && (
          <div className="empty-state"><span className="empty-icon">✅</span><p>No pending get-back requests</p></div>
        )}
      </div>

      {/* Add Member Modal */}
      <AnimatePresence>
        {showAddMember && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddMember(false)}>
            <motion.div className="modal-content" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
              <h2>Add New Member</h2>
              <div className="add-options">
                <motion.button className="add-option" onClick={() => { setShowAddMember(false); setShowPhotoCreator(true); }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <span className="option-icon">📸</span>
                  <span className="option-title">Create from Photo</span>
                  <span className="option-desc">Upload a photo and AI-generate a custom gang member</span>
                </motion.button>
                <motion.button className="add-option" onClick={() => {
                  const newMember: any = {
                    id: `member-${Date.now()}`, name: 'New Recruit', role: 'shooter', status: 'active',
                    level: 1, xp: 0, shooting: 50, driving: 50, dealing: 50, loyalty: 70, morale: 75,
                    heatResistance: 50, stealth: 50, health: 100, maxHealth: 100, armor: 0,
                    weaponMods: [], gear: [], inventory: [],
                    appearance: { gender: 'male', skinTone: '#8B4513', hairStyle: 'short', hairColor: 'black', jewelry: [], tattoos: [], top: 'hoodie', bottom: 'jeans', shoes: 'jordans', gangColorAccent: true },
                    backstory: generateBackstory(), connections: generateConnections(), hiredAt: new Date().toISOString(),
                  };
                  addMember(newMember);
                  setShowAddMember(false);
                }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <span className="option-icon">🎲</span>
                  <span className="option-title">Random Recruit</span>
                  <span className="option-desc">Generate a random gang member</span>
                </motion.button>
                <motion.button className="add-option" onClick={() => setShowAddMember(false)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <span className="option-icon">🏪</span>
                  <span className="option-title">Recruit from Market</span>
                  <span className="option-desc">Hire experienced members (costs $$$)</span>
                </motion.button>
              </div>
              <button className="close-modal" onClick={() => setShowAddMember(false)}>Cancel</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selfie Upload Modal */}
      <AnimatePresence>
        {showSelfieUpload && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSelfieUpload(false)}>
            <motion.div className="modal-content selfie-modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
              <h2>📸 Upload Friend's Photo</h2>
              <p className="modal-subtitle">Upload a selfie or headshot and we'll generate a gang member that resembles them!</p>
              <div className="selfie-upload-area">
                {uploadedImage ? (
                  <div className="uploaded-preview">
                    <img src={uploadedImage} alt="Uploaded selfie" />
                    <button className="change-photo" onClick={() => fileInputRef.current?.click()}>Change Photo</button>
                  </div>
                ) : (
                  <div className="upload-placeholder" onClick={() => fileInputRef.current?.click()}>
                    <span className="upload-icon">📷</span>
                    <span className="upload-text">Tap to upload photo</span>
                    <span className="upload-hint">Best results with front-facing headshots</span>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleSelfieUpload} style={{ display: 'none' }} />
              </div>
              <div className="modal-actions">
                <button className="cancel-btn" onClick={() => { setShowSelfieUpload(false); setUploadedImage(null); }}>Cancel</button>
                <button className="generate-btn" onClick={generateMemberFromSelfie} disabled={!uploadedImage}>Generate Member</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PhotoMemberCreator — AI-powered member creation from photo */}
      <AnimatePresence>
        {showPhotoCreator && (
          <motion.div
            className="modal-overlay pmc-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Suspense fallback={<div className="pmc-loading-fallback">Loading...</div>}>
              <PhotoMemberCreator
                onClose={() => setShowPhotoCreator(false)}
                onApproved={(memberId) => {
                  addNotification({
                    type: 'success',
                    title: 'Member Created',
                    message: 'Your custom member has been added to the crew.',
                    priority: 'normal',
                  });
                  setShowPhotoCreator(false);
                }}
              />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Deploy Warning Modal */}
      <AnimatePresence>
        {showDeployWarning && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDeployWarning(null)}>
            <motion.div className="modal-content deploy-warning-modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
              <h2>⚠️ Low Morale Warning</h2>
              <p className="modal-subtitle">This member has low morale. Deploying them may cause issues:</p>
              <div className="consequence-list">
                {deployConsequences.map((c, i) => (
                  <div key={i} className="consequence-item">
                    <span className="consequence-type">{c.type.replace('_', ' ').toUpperCase()}</span>
                    <span className="consequence-prob">{Math.round(c.probability * 100)}% chance</span>
                    <p className="consequence-desc">{c.description}</p>
                  </div>
                ))}
              </div>
              <div className="modal-actions">
                <button className="cancel-btn" onClick={() => setShowDeployWarning(null)}>Cancel</button>
                <button className="deploy-anyway-btn" onClick={confirmDeploy}>Send Anyway</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contact Detail Modal */}
      <AnimatePresence>
        {selectedContact && (
          <ContactDetailModal
            contact={selectedContact}
            member={members.find(m => m.id === selectedContact.memberId)}
            drugInventory={drugInventory}
            onClose={() => setSelectedContact(null)}
            onBackdoor={() => { handleBackdoor(selectedContact.memberId ?? selectedContact.id); setSelectedContact(null); }}
            onDeploy={() => handleDeploy(selectedContact.memberId ?? selectedContact.id)}
            onEquipDrug={(drugId) => {
              const memberId = selectedContact.memberId ?? selectedContact.id;
              const role = selectedContact.role ?? 'dealer';
              // Only dealers can hold drugs
              if (role !== 'dealer' && role !== 'boss') {
                const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
                addNotification({
                  type: 'warning',
                  title: 'Cannot Equip',
                  message: `${roleLabel}s cannot hold drugs. Only Dealers carry product.`,
                  priority: 'high',
                });
                return;
              }
              transferItemToMember(drugId, memberId, 1);
              addNotification({ type: 'info', title: 'Product Equipped', message: `Equipped ${drugId} to ${selectedContact.name}.`, priority: 'normal' });
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ============ SUBCOMPONENTS ============

// Contact Card with morale badge
interface ContactCardProps {
  contact: Contact;
  onClick: () => void;
  onBackdoor?: () => void;
  showDeathInfo?: boolean;
  moraleBadge?: { label: string; color: string; warning: string | null };
  memberLevel?: number;
}

const ContactCard: React.FC<ContactCardProps> = ({ contact, onClick, showDeathInfo, moraleBadge, memberLevel }) => {
  return (
    <motion.div className="contact-card" onClick={onClick} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
      <div className="contact-avatar">
        {contact.avatar ? (
          <img src={contact.avatar} alt={contact.name} />
        ) : (
          <span className="avatar-placeholder">{contact.name.charAt(0)}</span>
        )}
        <span className="status-indicator">{contact.statusEmoji}</span>
      </div>

      <div className="contact-info">
        <div className="contact-name">
          {contact.name}
          {contact.nickname && <span className="nickname">"{contact.nickname}"</span>}
        </div>
        <div className="contact-meta">
          <span className="contact-role">{contact.role.toUpperCase()}</span>
          {memberLevel && <span className="contact-level">LV{memberLevel}</span>}
        </div>
        {showDeathInfo && contact.deathCause && (
          <div className="death-info">{contact.deathCause}{contact.killedBy && <span> by {contact.killedBy}</span>}</div>
        )}
      </div>

      {moraleBadge && (
        <div className="morale-badge" style={{ backgroundColor: moraleBadge.color + '22', color: moraleBadge.color, borderColor: moraleBadge.color + '44' }}>
          {moraleBadge.label}
        </div>
      )}

      <div className="contact-arrow">›</div>
    </motion.div>
  );
};

// Jailed member card with bail/leave options
interface JailedCardProps {
  contact: Contact;
  onBail: () => void;
  onLeave: () => void;
  onClick: () => void;
}

const JailedCard: React.FC<JailedCardProps> = ({ contact, onBail, onLeave, onClick }) => {
  const bailCost = 500 + Math.floor(Math.random() * 2000);
  return (
    <motion.div className="contact-card jailed-card" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
      <div className="contact-avatar" onClick={onClick}>
        {contact.avatar ? (
          <img src={contact.avatar} alt={contact.name} />
        ) : (
          <span className="avatar-placeholder">{contact.name.charAt(0)}</span>
        )}
        <span className="status-indicator">⛓️</span>
      </div>
      <div className="contact-info" onClick={onClick}>
        <div className="contact-name">{contact.name}</div>
        <div className="contact-role">{contact.role.toUpperCase()} — LOCKED UP</div>
      </div>
      <div className="jail-actions">
        <motion.button className="bail-btn" onClick={(e) => { e.stopPropagation(); onBail(); }} whileTap={{ scale: 0.95 }}>
          💰 Bail
        </motion.button>
        <motion.button className="leave-btn" onClick={(e) => { e.stopPropagation(); onLeave(); }} whileTap={{ scale: 0.95 }}>
          Leave
        </motion.button>
      </div>
    </motion.div>
  );
};

// Get-back request card
interface GetBackRequestCardProps {
  request: GetBackRequest;
  onAccept: () => void;
  onIgnore: () => void;
}

const GetBackRequestCard: React.FC<GetBackRequestCardProps> = ({ request, onAccept, onIgnore }) => {
  const urgencyColors: Record<string, string> = { low: '#ffd700', medium: '#ff9500', high: '#ff4444', critical: '#ff0066' };
  return (
    <motion.div className="request-card" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
      <div className="request-urgency" style={{ backgroundColor: urgencyColors[request.urgency ?? 'low'] }}>{(request.urgency ?? 'low').toUpperCase()}</div>
      <div className="request-content">
        <div className="request-member">{request.memberName}</div>
        <div className="request-reason">{request.reason}</div>
        <div className="request-target">Target: {request.targetName}</div>
        <div className="request-penalty">⚠️ Ignoring will cost: -{request.loyaltyPenaltyIfIgnored} Loyalty, -{request.moralePenaltyIfIgnored} Morale</div>
      </div>
      <div className="request-actions">
        <motion.button className="accept-request" onClick={onAccept} whileTap={{ scale: 0.95 }}>Get Back</motion.button>
        <motion.button className="ignore-request" onClick={onIgnore} whileTap={{ scale: 0.95 }}>Ignore</motion.button>
      </div>
    </motion.div>
  );
};

// ============ DETAIL MODAL ============

interface ContactDetailModalProps {
  contact: Contact;
  member?: GangMember;
  drugInventory: any[];
  onClose: () => void;
  onBackdoor: () => void;
  onDeploy: () => void;
  onEquipDrug: (drugId: string) => void;
}

const RANK_TITLES: Record<number, string> = { 1: 'Youngin', 11: 'Soldier', 21: 'Lieutenant', 31: 'Captain', 41: 'OG' };
function getRankTitle(level: number): string {
  if (level >= 41) return 'OG';
  if (level >= 31) return 'Captain';
  if (level >= 21) return 'Lieutenant';
  if (level >= 11) return 'Soldier';
  return 'Youngin';
}

const DRUG_NAMES: Record<string, { name: string; emoji: string }> = {
  weed: { name: 'Weed', emoji: '🌿' },
  coke: { name: 'Cocaine', emoji: '❄️' },
  crack: { name: 'Crack', emoji: '🪨' },
  meth: { name: 'Meth', emoji: '🧊' },
  heroin: { name: 'Heroin', emoji: '💉' },
  pills: { name: 'Pills', emoji: '💊' },
  lean: { name: 'Lean', emoji: '🟣' },
  shrooms: { name: 'Shrooms', emoji: '🍄' },
  lsd: { name: 'LSD', emoji: '🌈' },
  molly: { name: 'Molly', emoji: '💎' },
  crystal_meth: { name: 'Crystal', emoji: '💠' },
  black_tar: { name: 'Black Tar', emoji: '⬛' },
  blue_sky: { name: 'Blue Sky', emoji: '🔵' },
  china_white: { name: 'China White', emoji: '⚪' },
  pure_mdma: { name: 'Pure MDMA', emoji: '💜' },
  hash: { name: 'Hash', emoji: '🟫' },
  edibles: { name: 'Edibles', emoji: '🍪' },
  double_cup: { name: 'Dbl Cup', emoji: '🥤' },
};

const ContactDetailModal: React.FC<ContactDetailModalProps> = ({ contact, member, drugInventory, onClose, onBackdoor, onDeploy, onEquipDrug }) => {
  const [showEquip, setShowEquip] = useState(false);
  const m = member as any;
  const morale = m?.morale ?? 50;
  const moraleInfo = getMoraleDescription(morale);
  const level = m?.level ?? 1;
  const xp = m?.xp ?? 0;
  const xpToNext = level * 100 * 1.5;
  const xpPercent = Math.min(100, (xp / xpToNext) * 100);
  const rank = getRankTitle(level);
  const heatContrib = level >= 10 ? getMemberHeatContribution(level) : 0;

  return (
    <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="modal-content detail-modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="detail-header">
          <div className="detail-avatar">
            {contact.avatar ? (
              <img src={contact.avatar} alt={contact.name} />
            ) : (
              <span className="avatar-placeholder large">{contact.name.charAt(0)}</span>
            )}
            <span className="status-badge">{contact.statusEmoji}</span>
          </div>
          <h2>{contact.name}</h2>
          {contact.nickname && <p className="detail-nickname">"{contact.nickname}"</p>}
          <p className="detail-role">{contact.role.toUpperCase()}</p>
        </div>

        {/* Level & XP */}
        {m && (
          <div className="detail-section">
            <div className="level-display">
              <span className="level-badge">LV{level}</span>
              <span className="rank-label">{rank}</span>
              <span className="morale-tag" style={{ backgroundColor: moraleInfo.color + '22', color: moraleInfo.color }}>
                {moraleInfo.label}
              </span>
            </div>
            <div className="xp-bar-container">
              <div className="xp-bar-track">
                <motion.div
                  className="xp-bar-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${xpPercent}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>
              <span className="xp-text">{xp} / {Math.round(xpToNext)} XP</span>
            </div>
            {heatContrib > 0 && (
              <div className="heat-warning-badge">
                ⚠️ High-profile: +{heatContrib.toFixed(1)} heat/hour on block
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        {m && (
          <div className="detail-section">
            <h3>Stats</h3>
            <div className="stats-grid">
              <StatBar label="Shooting" value={m.shooting ?? 50} color="#ff4444" />
              <StatBar label="Driving" value={m.driving ?? 50} color="#00f0ff" />
              <StatBar label="Dealing" value={m.dealing ?? 50} color="#00ff88" />
              <StatBar label="Loyalty" value={m.loyalty ?? 50} color="#ffd700" />
              <StatBar label="Morale" value={morale} color={moraleInfo.color} />
              <StatBar label="Stealth" value={m.stealth ?? 50} color="#af52de" />
            </div>
          </div>
        )}

        {/* Equipped Product */}
        {m && contact.status === 'active' && (m.role === 'dealer' || contact.role === 'dealer') && (
          <div className="detail-section">
            <h3>Equipped Product</h3>
            {m.inventory && m.inventory.filter((i: any) => i.type === 'drug').length > 0 ? (
              <div className="equipped-drugs">
                {m.inventory.filter((i: any) => i.type === 'drug').map((item: any, idx: number) => {
                  const drugInfo = DRUG_NAMES[item.itemId] || { name: item.itemId, emoji: '💊' };
                  return (
                    <div key={idx} className="equipped-drug-item">
                      <span className="drug-emoji">{drugInfo.emoji}</span>
                      <span className="drug-name">{drugInfo.name}</span>
                      <span className="drug-qty">x{item.quantity}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="no-product">No product equipped</p>
            )}
            <motion.button className="equip-btn" onClick={() => setShowEquip(!showEquip)} whileTap={{ scale: 0.95 }}>
              {showEquip ? 'Hide Stash' : '📦 Equip from Stash'}
            </motion.button>
            <AnimatePresence>
              {showEquip && (
                <motion.div className="equip-list" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                  {drugInventory.length === 0 ? (
                    <p className="no-product">Stash is empty. Cook some product first.</p>
                  ) : (
                    drugInventory.map((item, idx) => {
                      const drugInfo = DRUG_NAMES[item.itemId] || { name: item.itemId, emoji: '💊' };
                      return (
                        <motion.div key={idx} className="stash-item" onClick={() => onEquipDrug(item.itemId)} whileTap={{ scale: 0.95 }}>
                          <span className="drug-emoji">{drugInfo.emoji}</span>
                          <span className="drug-name">{drugInfo.name}</span>
                          <span className="drug-qty">x{item.quantity}</span>
                          <span className="equip-arrow">→</span>
                        </motion.div>
                      );
                    })
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Backstory */}
        {m?.backstory && (
          <div className="detail-section">
            <h3>Backstory</h3>
            <p className="backstory-text">{m.backstory.origin}</p>
            <p className="backstory-reason"><strong>Why they're here:</strong> {m.backstory.reason}</p>
          </div>
        )}

        {/* Connections */}
        {m?.connections && m.connections.length > 0 && (
          <div className="detail-section">
            <h3>Connections</h3>
            <div className="connections-list">
              {m.connections.map((conn: any) => (
                <div key={conn.id} className="connection-item">
                  <span className="conn-type">{conn.type}</span>
                  <span className="conn-name">{conn.name}</span>
                  {conn.canBeTargeted && <span className="conn-warning">⚠️ Can be targeted</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Death record */}
        {(contact.status === 'dead' || contact.status === 'backdoored') && (
          <div className="detail-section death-section">
            <h3>💀 Death Record</h3>
            <p><strong>Date:</strong> {new Date(contact.deathDate || '').toLocaleDateString()}</p>
            <p><strong>Cause:</strong> {contact.deathCause}</p>
            {contact.killedBy && <p><strong>By:</strong> {contact.killedBy}</p>}
            {contact.finalStats && (
              <div className="final-stats">
                <p>Level: {contact.finalStats.level}</p>
                <p>Kills: {contact.finalStats.kills}</p>
                <p>Deals: {contact.finalStats.deals}</p>
                <p>Earnings: ${contact.finalStats.earnings.toLocaleString()}</p>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="detail-actions">
          {contact.status === 'active' && (
            <>
              <motion.button className="deploy-btn" onClick={onDeploy} whileTap={{ scale: 0.95 }}>
                📍 Deploy to Block
              </motion.button>
              <motion.button className="backdoor-btn" onClick={onBackdoor} whileTap={{ scale: 0.95 }}>
                🔙 Backdoor
              </motion.button>
            </>
          )}
          <motion.button className="close-btn" onClick={onClose} whileTap={{ scale: 0.95 }}>
            Close
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ============ STAT BAR ============

interface StatBarProps {
  label: string;
  value: number;
  color: string;
}

const StatBar: React.FC<StatBarProps> = ({ label, value, color }) => (
  <div className="stat-bar-item">
    <div className="stat-bar-label">{label}</div>
    <div className="stat-bar-track">
      <motion.div
        className="stat-bar-fill"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
    </div>
    <div className="stat-bar-value">{value}</div>
  </div>
);

export default Contacts;
