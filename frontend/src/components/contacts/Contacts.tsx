// ============================================================
// Contacts - Gang Member Management with Friend Selfie Upload
// ============================================================

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigationStore, useGangStore, useMoraleStore, useSelfieStore } from '../../stores/gameStore';
import type { GangMember, Contact, MemberStatus, GetBackRequest } from '../../types/game.types';
import './Contacts.css';

type TabType = 'active' | 'jailed' | 'dead' | 'requests';

const Contacts: React.FC = () => {
  const { goBack } = useNavigationStore();
  const { members, contacts, addMember, backdoorMember, killMember } = useGangStore();
  const { getBackRequests, resolveGetBackRequest } = useMoraleStore();
  const { uploads, addUpload } = useSelfieStore();
  
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showSelfieUpload, setShowSelfieUpload] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter contacts by status
  const activeMembers = contacts.filter(c => c.status === 'active');
  const jailedMembers = contacts.filter(c => c.status === 'jailed');
  const deadMembers = contacts.filter(c => c.status === 'dead' || c.status === 'backdoored');
  const pendingRequests = getBackRequests.filter(r => r.status === 'pending');

  const getStatusEmoji = (status: MemberStatus): string => {
    switch (status) {
      case 'active': return '✅';
      case 'jailed': return '⛓️';
      case 'dead': return '💀';
      case 'backdoored': return '🔙';
      case 'injured': return '🩹';
      case 'hospitalized': return '🏥';
      case 'defected': return '🚪';
      default: return '❓';
    }
  };

  const handleSelfieUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const imageUrl = event.target?.result as string;
      setUploadedImage(imageUrl);
      
      // Add to upload store for processing
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

    // Generate a new member based on the selfie
    const newMember: GangMember = {
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

    const struggles = [
      'Anger issues',
      'Trust problems',
      'Lost someone close',
      'Police on their back',
      'Old debts to pay',
    ];

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
        <button 
          className={`tab ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => setActiveTab('active')}
        >
          Active ({activeMembers.length})
        </button>
        <button 
          className={`tab ${activeTab === 'jailed' ? 'active' : ''}`}
          onClick={() => setActiveTab('jailed')}
        >
          ⛓️ Jailed ({jailedMembers.length})
        </button>
        <button 
          className={`tab ${activeTab === 'dead' ? 'active' : ''}`}
          onClick={() => setActiveTab('dead')}
        >
          💀 Dead ({deadMembers.length})
        </button>
        <button 
          className={`tab ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          ⚠️ Requests ({pendingRequests.length})
        </button>
      </div>

      {/* Contact List */}
      <div className="contacts-list">
        {activeTab === 'active' && activeMembers.map(contact => (
          <ContactCard 
            key={contact.id} 
            contact={contact}
            onClick={() => setSelectedContact(contact)}
            onBackdoor={() => handleBackdoor(contact.memberId)}
          />
        ))}

        {activeTab === 'jailed' && jailedMembers.map(contact => (
          <ContactCard 
            key={contact.id} 
            contact={contact}
            onClick={() => setSelectedContact(contact)}
          />
        ))}

        {activeTab === 'dead' && deadMembers.map(contact => (
          <ContactCard 
            key={contact.id} 
            contact={contact}
            onClick={() => setSelectedContact(contact)}
            showDeathInfo
          />
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
          <div className="empty-state">
            <span className="empty-icon">⛓️</span>
            <p>No one locked up. Good.</p>
          </div>
        )}

        {activeTab === 'dead' && deadMembers.length === 0 && (
          <div className="empty-state">
            <span className="empty-icon">🙏</span>
            <p>No fallen soldiers yet</p>
          </div>
        )}

        {activeTab === 'requests' && pendingRequests.length === 0 && (
          <div className="empty-state">
            <span className="empty-icon">✅</span>
            <p>No pending get-back requests</p>
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      <AnimatePresence>
        {showAddMember && (
          <motion.div 
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAddMember(false)}
          >
            <motion.div 
              className="modal-content"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2>Add New Member</h2>
              
              <div className="add-options">
                <motion.button
                  className="add-option"
                  onClick={() => {
                    setShowAddMember(false);
                    setShowSelfieUpload(true);
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="option-icon">📸</span>
                  <span className="option-title">Upload Friend's Selfie</span>
                  <span className="option-desc">Generate a member that looks like your friend</span>
                </motion.button>

                <motion.button
                  className="add-option"
                  onClick={() => {
                    const newMember: GangMember = {
                      id: `member-${Date.now()}`,
                      name: 'New Recruit',
                      role: 'shooter',
                      status: 'active',
                      level: 1,
                      xp: 0,
                      shooting: 50,
                      driving: 50,
                      dealing: 50,
                      loyalty: 70,
                      morale: 75,
                      heatResistance: 50,
                      stealth: 50,
                      health: 100,
                      maxHealth: 100,
                      armor: 0,
                      weaponMods: [],
                      gear: [],
                      inventory: [],
                      appearance: {
                        gender: 'male',
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
                      backstory: generateBackstory(),
                      connections: generateConnections(),
                      hiredAt: new Date().toISOString(),
                    };
                    addMember(newMember);
                    setShowAddMember(false);
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="option-icon">🎲</span>
                  <span className="option-title">Random Recruit</span>
                  <span className="option-desc">Generate a random gang member</span>
                </motion.button>

                <motion.button
                  className="add-option"
                  onClick={() => setShowAddMember(false)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="option-icon">🏪</span>
                  <span className="option-title">Recruit from Market</span>
                  <span className="option-desc">Hire experienced members (costs $$$)</span>
                </motion.button>
              </div>

              <button className="close-modal" onClick={() => setShowAddMember(false)}>
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selfie Upload Modal */}
      <AnimatePresence>
        {showSelfieUpload && (
          <motion.div 
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSelfieUpload(false)}
          >
            <motion.div 
              className="modal-content selfie-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2>📸 Upload Friend's Photo</h2>
              <p className="modal-subtitle">
                Upload a selfie or headshot and we'll generate a gang member that resembles them!
              </p>

              <div className="selfie-upload-area">
                {uploadedImage ? (
                  <div className="uploaded-preview">
                    <img src={uploadedImage} alt="Uploaded selfie" />
                    <button 
                      className="change-photo"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Change Photo
                    </button>
                  </div>
                ) : (
                  <div 
                    className="upload-placeholder"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <span className="upload-icon">📷</span>
                    <span className="upload-text">Tap to upload photo</span>
                    <span className="upload-hint">Best results with front-facing headshots</span>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleSelfieUpload}
                  style={{ display: 'none' }}
                />
              </div>

              <div className="modal-actions">
                <button 
                  className="cancel-btn"
                  onClick={() => {
                    setShowSelfieUpload(false);
                    setUploadedImage(null);
                  }}
                >
                  Cancel
                </button>
                <button 
                  className="generate-btn"
                  onClick={generateMemberFromSelfie}
                  disabled={!uploadedImage}
                >
                  Generate Member
                </button>
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
            onClose={() => setSelectedContact(null)}
            onBackdoor={() => {
              handleBackdoor(selectedContact.memberId);
              setSelectedContact(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ============ SUBCOMPONENTS ============

interface ContactCardProps {
  contact: Contact;
  onClick: () => void;
  onBackdoor?: () => void;
  showDeathInfo?: boolean;
}

const ContactCard: React.FC<ContactCardProps> = ({ contact, onClick, showDeathInfo }) => {
  return (
    <motion.div 
      className="contact-card"
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
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
        <div className="contact-role">{contact.role.toUpperCase()}</div>
        {showDeathInfo && contact.deathCause && (
          <div className="death-info">
            {contact.deathCause}
            {contact.killedBy && <span> by {contact.killedBy}</span>}
          </div>
        )}
      </div>

      <div className="contact-arrow">›</div>
    </motion.div>
  );
};

interface GetBackRequestCardProps {
  request: GetBackRequest;
  onAccept: () => void;
  onIgnore: () => void;
}

const GetBackRequestCard: React.FC<GetBackRequestCardProps> = ({ request, onAccept, onIgnore }) => {
  const urgencyColors = {
    low: '#ffd700',
    medium: '#ff9500',
    high: '#ff4444',
    critical: '#ff0066',
  };

  return (
    <motion.div 
      className="request-card"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
    >
      <div className="request-urgency" style={{ backgroundColor: urgencyColors[request.urgency] }}>
        {request.urgency.toUpperCase()}
      </div>

      <div className="request-content">
        <div className="request-member">{request.memberName}</div>
        <div className="request-reason">{request.reason}</div>
        <div className="request-target">Target: {request.targetName}</div>
        <div className="request-penalty">
          ⚠️ Ignoring will cost: -{request.loyaltyPenaltyIfIgnored} Loyalty, -{request.moralePenaltyIfIgnored} Morale
        </div>
      </div>

      <div className="request-actions">
        <motion.button 
          className="accept-request"
          onClick={onAccept}
          whileTap={{ scale: 0.95 }}
        >
          Get Back
        </motion.button>
        <motion.button 
          className="ignore-request"
          onClick={onIgnore}
          whileTap={{ scale: 0.95 }}
        >
          Ignore
        </motion.button>
      </div>
    </motion.div>
  );
};

interface ContactDetailModalProps {
  contact: Contact;
  member?: GangMember;
  onClose: () => void;
  onBackdoor: () => void;
}

const ContactDetailModal: React.FC<ContactDetailModalProps> = ({ contact, member, onClose, onBackdoor }) => {
  return (
    <motion.div 
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div 
        className="modal-content detail-modal"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
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

        {member && (
          <>
            <div className="detail-section">
              <h3>Stats</h3>
              <div className="stats-grid">
                <StatBar label="Shooting" value={member.shooting} color="#ff4444" />
                <StatBar label="Driving" value={member.driving} color="#00f0ff" />
                <StatBar label="Dealing" value={member.dealing} color="#00ff88" />
                <StatBar label="Loyalty" value={member.loyalty} color="#ffd700" />
                <StatBar label="Morale" value={member.morale} color="#ff006e" />
              </div>
            </div>

            {member.backstory && (
              <div className="detail-section">
                <h3>Backstory</h3>
                <p className="backstory-text">{member.backstory.origin}</p>
                <p className="backstory-reason"><strong>Why they're here:</strong> {member.backstory.reason}</p>
              </div>
            )}

            {member.connections && member.connections.length > 0 && (
              <div className="detail-section">
                <h3>Connections</h3>
                <div className="connections-list">
                  {member.connections.map(conn => (
                    <div key={conn.id} className="connection-item">
                      <span className="conn-type">{conn.type}</span>
                      <span className="conn-name">{conn.name}</span>
                      {conn.canBeTargeted && <span className="conn-warning">⚠️ Can be targeted</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {contact.status === 'dead' || contact.status === 'backdoored' ? (
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
        ) : null}

        <div className="detail-actions">
          {contact.status === 'active' && (
            <motion.button 
              className="backdoor-btn"
              onClick={onBackdoor}
              whileTap={{ scale: 0.95 }}
            >
              🔙 Backdoor
            </motion.button>
          )}
          <motion.button 
            className="close-btn"
            onClick={onClose}
            whileTap={{ scale: 0.95 }}
          >
            Close
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

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
