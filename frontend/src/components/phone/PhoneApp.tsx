import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigationStore, usePlayerStore } from '../../stores/gameStore';
import './PhoneApp.css';

export const PhoneApp: React.FC = () => {
  const { goBack } = useNavigationStore();
  const { player, updateMoney, updateHeat } = usePlayerStore();
  const [callStatus, setCallStatus] = useState<string | null>(null);

  const contacts = [
    { id: 'cleaner', name: 'The Cleaner', role: 'Heat Reduction', cost: 5000, effect: () => { updateHeat(-20); return 'Heat reduced by 20.'; } },
    { id: 'lawyer', name: 'Crooked Lawyer', role: 'Bail/Legal', cost: 10000, effect: () => { return 'Bail bonds secured for next raid.'; } },
    { id: 'supplier', name: 'Wholesale Supplier', role: 'Bulk Drugs', cost: 25000, effect: () => { return 'Bulk shipment arriving soon.'; } }
  ];

  const handleCall = (contact: typeof contacts[0]) => {
    if (player.money >= contact.cost) {
      updateMoney(-contact.cost);
      setCallStatus(`Calling ${contact.name}... ${contact.effect()}`);
      setTimeout(() => setCallStatus(null), 3000);
    } else {
      setCallStatus(`Not enough cash to call ${contact.name}. Need $${contact.cost.toLocaleString()}`);
      setTimeout(() => setCallStatus(null), 3000);
    }
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
        {contacts.map(c => (
          <motion.div key={c.id} className="phone-contact-card" whileHover={{ scale: 1.02 }}>
            <div className="contact-info">
              <h3>{c.name}</h3>
              <span className="contact-role">{c.role}</span>
            </div>
            <button className="call-btn" onClick={() => handleCall(c)}>
              Call (${c.cost.toLocaleString()})
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default PhoneApp;
