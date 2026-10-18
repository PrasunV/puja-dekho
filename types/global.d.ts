import type { Map as MapLibreMap } from 'maplibre-gl';

declare global {
  interface Window {
    /** Set by the e2e suite before load to expose test hooks. Never set in production. */
    __PD_E2E__?: boolean;
    __PD_E2E_ORS_KEY__?: string;
    __PD_E2E_HINT_MS__?: number;
    __pdMap?: MapLibreMap;
    __pd?: Record<string, unknown>;
  }
}
