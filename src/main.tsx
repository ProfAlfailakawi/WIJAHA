import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { installDuoMarkers } from './lib/duo-markers';
import { installDockMotion } from './lib/dockMotion';

/* iPhone Duo markers before the first paint (read only by src/styles/duo.css). */
installDuoMarkers();

/* Duo navigation capsule motion (presentation only): one sliding indicator and an instant press. */
installDockMotion({ dock: '.wj-duo-bar', link: '.wj-duo-tab', active: '.wj-duo-tab[aria-current="page"]' });

createRoot(document.getElementById('root')!).render(<App />);

// Offline support for the tools (production only, so development hot reload is unaffected).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
