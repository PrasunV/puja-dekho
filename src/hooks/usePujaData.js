import { useEffect, useState } from 'react';

/**
 * Load the static puja and metro files once and index them.
 * @returns {{ data: import('../lib/types.js').PujaData | null, error: string | null }}
 */
export function usePujaData() {
  const [state, setState] = useState(
    /** @type {{ data: import('../lib/types.js').PujaData | null, error: string | null }} */ ({ data: null, error: null }),
  );
  useEffect(() => {
    const controller = new AbortController();
    const load = async (url) => {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`${url}: ${res.status}`);
      return res.json();
    };
    Promise.all([load('/data/pujas.json'), load('/data/metro.json')])
      .then(([pujas, metro]) => {
        setState({
          data: {
            pujas,
            byId: new Map(pujas.map((puja) => [puja.id, puja])),
            stations: metro.stations,
            stById: new Map(metro.stations.map((station) => [station.id, station])),
            metro,
          },
          error: null,
        });
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ data: null, error: 'Could not load puja data. Check your connection and reload.' });
      });
    return () => controller.abort();
  }, []);
  return state;
}
