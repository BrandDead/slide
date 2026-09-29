import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigationStore, usePlayerStore, useGangStore } from '../../stores/gameStore';
import PhotoMemberCreator from '../gang/PhotoMemberCreator';
import './PhoneApp.css';

export const PhoneApp: React.FC = () => {
  const { goBack } = useNavigationStore();
  const { player, updateMoney, updateHeat } = usePlayerStore();
  const { members } = useGangStore();
  const [callStatus, setCallStatus] = useState<string | null>(null);
  const [showPhotoCreator, setShowPhotoCreator] = useState(false);

  const activeMembers = useMemo(
    () => members.filter(member => member.status === 'active'),
    [members],
  );
  const unavailableMembers = useMemo(
    () => members.filter(member => member.status !== 'active'),
    [members],
  );

  const serviceContacts = [
    { id: 'cleaner', name: 'The Cleaner', role: 'Heat Reduction', cost: 5000, effect: () => { updateHeat(-20); return 'Heat reduced by 20.'; } },
    { id: 'lawyer', name: 'Lawyer', role: 'Bail / Legal', cost: 10000, effect: () => 'Bail support secured for the next raid.' },
    { id: 'supplier', name: 'Wholesale Supplier', role: 'Bulk Product', cost: 25000, effect: () => 'Bulk shipment arriving soon.' },
  ];

  const handleCall = (contact: typeof serviceContacts[0]) => {
    if (player.money >= contact.cost) {
      updateMoney(-contact.cost);
      setCallStatus(`Calling ${contact.name}... ${contact.effect()}`);
    } else {
      setCallStatus(`Not enough cash to call ${contact.name}. Need $${contact.cost.toLocaleString()}`);
    }
    window.setTimeout(() => setCallStatus(null), 3000);
  };

  return (
    <div className="phone-app">
      <div className="phone-header">
        <motion.button className="back-btn" onClick={goBack} whileTap={{ scale: 0.9 }}>← Back</motion.button>
        <h1>📱 CONTACTS</h1>
        <div className="cash-display">${player.money.toLocaleString()}</div>
      </div>

      {callStatus && <div className="call-status-toast">{callStatus}</div>}

      <div className="contact-list">
        <section className="contact-section" aria-label="Your crew">
          <div className="contact-section-header">
            <div>
              <span className="contact-eyebrow">YOUR BLOCK</span>
              <h2>Your Crew</h2>
            </div>
            <motion.button
              className="add-custom-btn"
              onClick={() => setShowPhotoCreator(true)}
              whileTap={{ scale: 0.96 }}
            >
              + Add Custom Member
            </motion.button>
          </div>
          <p className="contact-section-copy">
            Make the block personal. Add a friend or someone you have permission to use, then choose their role and style.
          </p>

          {activeMembers.length === 0 ? (
            <div className="crew-empty">No active members yet. Add a custom member or recruit from Gang HQ.</div>
          ) : (
            <div className="crew-contact-grid">
              {activeMembers.map(member => {
                const image = member.portraitUrl ?? member.customAvatarUrl ?? member.avatarUrl;
                return (
                  <div key={member.id} className="crew-contact-card">
                    <div className="crew-avatar">
                      {image ? <img src={image} alt="" /> : <span>{member.name.slice(0, 1).toUpperCase()}</span>}
                    </div>
                    <div className="crew-contact-info">
                      <strong>{member.name}</strong>
                      <span>{member.role ?? 'member'} · Lv {member.level}</span>
                    </div>
                    <span className="crew-status active">Active</span>
                  </div>
                );
              })}
            </div>
          )}

          {unavailableMembers.length > 0 && (
            <details className="unavailable-crew">
              <summary>Unavailable ({unavailableMembers.length})</summary>
              {unavailableMembers.map(member => (
                <div key={member.id} className="unavailable-row">
                  <span>{member.name}</span>
                  <span>{member.status}</span>
                </div>
              ))}
            </details>
          )}
        </section>

        <section className="contact-section" aria-label="Service contacts">
          <div className="contact-section-header">
            <div>
              <span className="contact-eyebrow">SERVICES</span>
              <h2>Street Contacts</h2>
            </div>
          </div>
          {serviceContacts.map(contact => (
            <motion.div key={contact.id} className="phone-contact-card" whileHover={{ scale: 1.01 }}>
              <div className="contact-info">
                <h3>{contact.name}</h3>
                <span className="contact-role">{contact.role}</span>
              </div>
              <button className="call-btn" onClick={() => handleCall(contact)}>
                Call ($${contact.cost.toLocaleString()})
              </button>
            </motion.div>
          ))}
        </section>
      </div>

      <AnimatePresence>
        {showPhotoCreator && (
          <motion.div
            className="photo-creator-shell"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <PhotoMemberCreator onClose={() => setShowPhotoCreator(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PhoneApp;
