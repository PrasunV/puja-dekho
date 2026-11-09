import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/plus-jakarta-sans';
// Plus Jakarta Sans has no Bengali letters; the browser loads this file only when Bengali text appears.
import '@fontsource-variable/noto-sans-bengali';
import 'maplibre-gl/dist/maplibre-gl.css';
import '../styles.css';
import './jg.css';
import App from './App.jsx';

createRoot(/** @type {HTMLElement} */ (document.getElementById('root'))).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Jagadhatri's own offline worker. Its scope is more specific than the Durga worker's, so it controls these pages.
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker
    .register('/jagadhatripuja-sw.js', { scope: '/jagadhatripuja' })
    .then(() => navigator.serviceWorker.ready)
    .then((reg) => {
      // Files loaded before the worker started (fonts, the map script) are handed to it so they work offline.
      const send = () =>
        reg.active?.postMessage({
          cache: performance
            .getEntriesByType('resource')
            .map((r) => r.name)
            .filter((u) => u.includes('/assets/')),
        });
      setTimeout(send, 4000);
    })
    .catch(() => {
      /* offline support is optional */
    });
}
