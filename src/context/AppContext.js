import { createContext, useContext } from 'react';

/**
 * Everything feature screens share. The provider (in App.jsx) memoises the value, so a screen
 * only re-renders when something it could read has actually changed.
 *
 * @typedef {object} AppValue
 * @property {import('../lib/types.js').PujaData} data
 * @property {boolean} desktop
 * @property {import('../lib/types.js').Position | null} position  The person's location, or null when it is off or they are outside Kolkata
 * @property {'idle' | 'asking' | 'on' | 'denied' | 'far'} locationStatus
 * @property {number | null} farKm  Distance to Kolkata in km when the person is outside it, else null
 * @property {() => void} showKolkata  Frame the whole city on the map (no personal dot)
 * @property {(then?: (p: import('../lib/types.js').Position) => void) => void} locate
 * @property {ReturnType<typeof import('../hooks/usePujaFilters.js').usePujaFilters>} filters
 * @property {'browse' | 'puja' | 'near' | 'lines' | 'station' | 'metro'} view  Which state the sheet is in
 * @property {import('../hooks/useNav.js').Nav} nav
 * @property {string | null} pujaId
 * @property {import('../lib/types.js').Station | null} station  The metro station whose pujas are shown
 * @property {(id: string | null) => void} setStation
 * @property {(lines: string[]) => void} setLines
 * @property {(zoneId: string) => void} toggleZone  Area chip: filters the list and brings the list to the sheet
 * @property {(id: string) => void} openPuja
 * @property {(id: string) => void} openStation
 * @property {import('../lib/route.js').Route | null} route  The walking route drawn for the open puja, if any
 * @property {() => void} back  Same as the browser Back button
 * @property {() => void} openDirections  Called when Get directions is tapped
 * @property {ReturnType<typeof import('../hooks/useNearPuja.js').useNearPuja>} near
 * @property {(message: string, kind?: '' | 'ok' | 'err') => void} toast
 * @property {(sheet: 'peek' | 'initial' | 'half' | 'full') => void} setSheet
 * @property {React.RefObject<import('../features/map/MapView.jsx').MapHandle | null>} mapRef
 */

export const AppContext = createContext(/** @type {AppValue | null} */ (null));

/** @returns {AppValue} */
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside <AppContext.Provider>');
  return value;
}
