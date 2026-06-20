// ============================================================
// TutorialOverlay — Step completion banner + next-step hint
// Rendered at the App level, above all other content.
// Sprint: mobile-leaderboard-onboarding-batch4
// ============================================================

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTutorialProgressStore } from '../../stores/tutorialProgressStore';
import './TutorialOverlay.css';

const TutorialOverlay: React.FC = () => {
  const {
    showTutorialOverlay,
    overlayMessage,
    currentStepId,
    steps,
    dismissOverlay,
  } = useTutorialProgressStore();

  // Auto-dismiss after 3.5 s
  useEffect(() => {
    if (!showTutorialOverlay) return;
    const t = setTimeout(dismissOverlay, 3500);
    return () => clearTimeout(t);
  }, [showTutorialOverlay, dismissOverlay]);

  const nextStep = steps.find(s => s.id === currentStepId && !s.completed);

  return (
    <>
      {/* Step completion toast */}
      <AnimatePresence>
        {showTutorialOverlay && overlayMessage && (
          <motion.div
            className="tutorial-toast"
            initial={{ opacity: 0, y: -30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            onClick={dismissOverlay}
          >
            <span className="tt-message">{overlayMessage}</span>
            <span className="tt-dismiss">tap to dismiss</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Next step hint bar (persistent, bottom of screen) */}
      <AnimatePresence>
        {!showTutorialOverlay && nextStep && (
          <motion.div
            className="tutorial-hint"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <span className="th-icon">💡</span>
            <div className="th-content">
              <span className="th-title">{nextStep.title}</span>
              <span className="th-desc">{nextStep.description}</span>
            </div>
            {nextStep.targetApp && (
              <span className="th-target">→ {nextStep.targetApp.toUpperCase()}</span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default TutorialOverlay;
