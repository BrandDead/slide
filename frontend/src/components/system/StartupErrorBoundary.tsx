import React from 'react';

type StartupErrorBoundaryProps = {
  children: React.ReactNode;
};

type StartupErrorBoundaryState = {
  error: Error | null;
};

function isConfigurationError(error: Error): boolean {
  return /missing supabase environment variables/i.test(error.message);
}

/**
 * Protects the React bootstrap from module-load and render failures.
 *
 * App is intentionally lazy loaded from `main.tsx`. This boundary therefore
 * remains available when App's Supabase dependency rejects during import,
 * which would otherwise leave the player on an empty frame.
 */
export class StartupErrorBoundary extends React.Component<
  StartupErrorBoundaryProps,
  StartupErrorBoundaryState
> {
  state: StartupErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): StartupErrorBoundaryState {
    return { error };
  }

  private retry = () => {
    window.location.reload();
  };

  render() {
    const { error } = this.state;

    if (!error) {
      return this.props.children;
    }

    const configurationError = isConfigurationError(error);

    return (
      <main className="startup-error-screen" role="alert" aria-live="assertive">
        <section className="startup-error-card" aria-labelledby="startup-error-title">
          <span className="startup-error-eyebrow">DEALT / SLIDE</span>
          <h1 id="startup-error-title">
            {configurationError ? 'SYSTEM CONFIGURATION REQUIRED' : 'SYSTEM UNAVAILABLE'}
          </h1>
          <p>
            {configurationError
              ? 'This game environment is missing a required service configuration. Please contact the deployment owner or try again after the environment is configured.'
              : 'SLIDE could not finish starting. Please try again. If the problem continues, contact the deployment owner.'}
          </p>
          <button type="button" className="startup-error-retry" onClick={this.retry}>
            RETRY STARTUP
          </button>
        </section>
      </main>
    );
  }
}

export default StartupErrorBoundary;
