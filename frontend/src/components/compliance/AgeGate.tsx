import React, { useState } from 'react';

interface AgeGateProps {
  onConfirm: () => void;
  /** Demo/local evaluation builds still require the 18+ acknowledgement. */
  evaluationBuild?: boolean;
}

export const AGE_GATE_STORAGE_KEY = 'slide.age-affirmation.v1';

export const DEMO_EVALUATION_COPY = {
  kicker: 'Non-production evaluation build',
  body: 'Playable without a real account. Progress stays on this device only and is not signed-in persistence.',
};

export function hasAgeAffirmation(storage: Pick<Storage, 'getItem'> = window.localStorage): boolean {
  try {
    return storage.getItem(AGE_GATE_STORAGE_KEY) === 'confirmed';
  } catch {
    return false;
  }
}

/** Local 18+ acknowledgement is required in every client, including demo builds. */
export function initialAgeAffirmed(storage: Pick<Storage, 'getItem'> = window.localStorage): boolean {
  return hasAgeAffirmation(storage);
}

export function saveAgeAffirmation(storage: Pick<Storage, 'setItem'> = window.localStorage): void {
  storage.setItem(AGE_GATE_STORAGE_KEY, 'confirmed');
}

export function DemoEvaluationBanner({ compact = false }: { compact?: boolean }) {
  return (
    <p
      className={`demo-eval-banner${compact ? ' is-compact' : ''}`}
      role="status"
      data-testid="demo-evaluation-banner"
    >
      <strong>{DEMO_EVALUATION_COPY.kicker}.</strong>{' '}
      {DEMO_EVALUATION_COPY.body}
    </p>
  );
}

const panelStyle: React.CSSProperties = {
  width: 'min(520px, calc(100vw - 32px))',
  padding: '32px',
  border: '1px solid rgba(202, 148, 92, 0.55)',
  borderRadius: 18,
  background: 'linear-gradient(160deg, rgba(20, 24, 35, 0.98), rgba(8, 10, 16, 0.98))',
  boxShadow: '0 28px 80px rgba(0, 0, 0, 0.55)',
  color: '#f3eee5',
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const buttonStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 48,
  minWidth: 44,
  borderRadius: 10,
  border: '1px solid transparent',
  cursor: 'pointer',
  fontWeight: 800,
  letterSpacing: '0.04em',
};

export default function AgeGate({ onConfirm, evaluationBuild = false }: AgeGateProps) {
  const [storageError, setStorageError] = useState(false);

  const confirm = () => {
    try {
      saveAgeAffirmation();
    } catch {
      // Private browsing or restricted storage should not create a dead end.
      setStorageError(true);
    }
    onConfirm();
  };

  return (
    <main
      className="age-gate"
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 'max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))',
        backgroundColor: '#070910',
        backgroundImage:
          'radial-gradient(circle at 50% 18%, rgba(103, 55, 42, 0.34), transparent 38%), ' +
          'linear-gradient(rgba(5, 6, 12, 0.62), rgba(5, 6, 12, 0.86)), ' +
          'url(/assets/runtime/generated/ui/loading_screen_v001.webp)',
        backgroundSize: 'auto, auto, cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <section style={panelStyle} aria-labelledby="age-gate-title">
        {evaluationBuild && <DemoEvaluationBanner />}
        <div
          style={{
            color: '#d9a56c',
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
          }}
        >
          Mature fictional crime strategy game
        </div>
        <h1 id="age-gate-title" style={{ margin: '12px 0 10px', fontSize: 30, lineHeight: 1.05 }}>
          Enter the world of SLIDE
        </h1>
        <p style={{ margin: 0, color: '#c7c1b8', lineHeight: 1.62 }}>
          SLIDE contains fictional depictions and references involving crime, drugs, weapons,
          gambling, and violence. It does not provide real-world instructions or endorse illegal activity.
        </p>
        <div
          style={{
            margin: '22px 0',
            padding: '14px 16px',
            borderLeft: '3px solid #b86f4d',
            background: 'rgba(255, 255, 255, 0.035)',
            color: '#f0e4d5',
            lineHeight: 1.5,
          }}
        >
          By continuing, you affirm that you are <strong>18 years of age or older</strong> and
          permitted to view mature content where you live.
          {evaluationBuild && (
            <> This acknowledgement is stored only on this device. It is not account verification.</>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="age-gate-btn"
            onClick={() => window.location.replace('about:blank')}
            style={{
              ...buttonStyle,
              color: '#b9b6b0',
              background: 'transparent',
              borderColor: '#454954',
            }}
          >
            LEAVE
          </button>
          <button
            type="button"
            className="age-gate-btn"
            onClick={confirm}
            style={{
              ...buttonStyle,
              color: '#fff6e7',
              background: 'linear-gradient(135deg, #7b3039, #a7513e)',
              borderColor: '#ca8b65',
              boxShadow: '0 10px 28px rgba(123, 48, 57, 0.28)',
            }}
          >
            I AM 18+ — CONTINUE
          </button>
        </div>
        {storageError && (
          <p role="status" style={{ margin: '14px 0 0', color: '#d9a56c', fontSize: 12 }}>
            Your browser could not remember this choice, so you may be asked again next time.
          </p>
        )}
        <p style={{ margin: '18px 0 0', color: '#c7c1b8', fontSize: 12, lineHeight: 1.5 }}>
          This confirmation is an audience notice, not a substitute for parental controls or local law.
        </p>
      </section>
    </main>
  );
}
