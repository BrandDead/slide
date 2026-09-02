import React from 'react';
import ReactDOM from 'react-dom/client';
import StartupErrorBoundary from './components/system/StartupErrorBoundary';

const App = React.lazy(() => import('./App'));
const ShooterGraphicsLab = React.lazy(() => import('./components/dev/ShooterGraphicsLab'));

const graphicsLabEnabled =
  import.meta.env.VITE_ENABLE_GRAPHICS_LAB === 'true' &&
  new URLSearchParams(window.location.search).get('graphicsLab') === 'shooter';
import './styles/theme.css';
import './App.css';
import './styles/mobile.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StartupErrorBoundary>
      {graphicsLabEnabled ? (
        <React.Suspense fallback={<div style={{ background: '#070a12', minHeight: '100vh' }} />}>
          <ShooterGraphicsLab />
        </React.Suspense>
      ) : (
        <React.Suspense fallback={<div style={{ background: '#070a12', minHeight: '100vh' }} />}>
          <App />
        </React.Suspense>
      )}
    </StartupErrorBoundary>
  </React.StrictMode>
);
