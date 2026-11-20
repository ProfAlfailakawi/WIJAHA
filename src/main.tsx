import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { installDuoMarkers } from './lib/duo-markers';

/* iPhone Duo markers before the first paint (read only by src/styles/duo.css). */
installDuoMarkers();

createRoot(document.getElementById('root')!).render(<App />);
