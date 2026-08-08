// ============================================================
// SplashScreen — cinematic loading state (Sprint 16, P0)
// Full-bleed loading_screen art behind the SLIDE mark.
// Used for the auth-check splash; AgeGate shares the same plate.
// ============================================================

import React from 'react';

export const LOADING_SCREEN_URL = '/assets/runtime/generated/ui/loading_screen_v001.png';

interface SplashScreenProps {
  /** Small status line under the wordmark. */
  label?: string;
}

export default function SplashScreen({ label = 'LOADING' }: SplashScreenProps) {
  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingBottom: '14vh',
        backgroundColor: '#070910',
        backgroundImage: `linear-gradient(rgba(4, 5, 10, 0.35), rgba(4, 5, 10, 0.78)), url(${LOADING_SCREEN_URL})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div
        style={{
          color: '#f3eee5',
          fontFamily: "'Rajdhani', 'SF Pro Display', -apple-system, sans-serif",
          fontSize: 44,
          fontWeight: 800,
          letterSpacing: '0.42em',
          textShadow: '0 0 18px rgba(255, 45, 85, 0.45), 0 4px 24px rgba(0,0,0,0.8)',
          textIndent: '0.42em', // optically recenters tracked-out caps
        }}
      >
        SLIDE
      </div>
      <div
        style={{
          marginTop: 14,
          color: '#9aa0ad',
          fontFamily: 'monospace',
          fontSize: 12,
          letterSpacing: '0.3em',
          textIndent: '0.3em',
          animation: 'splash-pulse 1.4s ease-in-out infinite',
        }}
      >
        {label}
      </div>
      <style>{`@keyframes splash-pulse { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }`}</style>
    </div>
  );
}
