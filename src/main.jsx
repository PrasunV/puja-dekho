import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
// Inter has no Bengali letters; the browser loads this file only when Bengali text appears.
import '@fontsource-variable/noto-sans-bengali';
import 'maplibre-gl/dist/maplibre-gl.css';
import './styles.css';
import App from './App.jsx';

createRoot(/** @type {HTMLElement} */ (document.getElementById('root'))).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('/sw.js').catch(() => {
    /* offline support is optional */
  });
}
