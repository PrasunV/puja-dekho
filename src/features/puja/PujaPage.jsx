import { useState } from 'react';
import { useApp } from '../../context/AppContext.js';
import { Icon } from '../../components/ui/Icon.jsx';
import { TypicalCrowd } from '../../components/ui/Crowd.jsx';
import { tripFor, tripText } from '../../lib/route.js';
import { storage } from '../../lib/storage.js';
import { pujaUrl } from '../../hooks/useNav.js';
import { heritage } from '../../lib/heritage.js';
import PujaBento from './PujaBento.jsx';

/**
 * The fields of a puja that exist in the data, and nothing else (PRD open question 11).
 * Today that is area, address, heritage, alternate names and the typical crowd.
 * @param {{ puja: import('../../lib/types.js').Puja, lead?: import('react').ReactNode }} props
 *   `lead` sits to the left of the title (the Back button on the details screen).
 */
export function PujaFields({ puja, lead }) {
  const { filters, route } = useApp();
  const trip = tripFor(filters.distances?.get(puja.id), route);
  const jubilee = heritage(puja.e)?.jubilee ?? null;
  return (
    <div className="stack">
      <div className="detail-head">
        {lead}
        <div className="detail-id">
          <h2>{puja.n}</h2>
          {trip && <div className="sub num">{tripText(trip)}</div>}
          <div className="row wrap mt8">
            <TypicalCrowd puja={puja} />
            <span className="tag">{puja.ar}</span>
            {jubilee && <span className="tag accent">{jubilee}</span>}
          </div>
        </div>
      </div>
      <PujaBento puja={puja} />
      {puja.ec && <div className="note">{`Sources disagree on the founding year (${puja.e} vs ${puja.ec}).`}</div>}
      {puja.fl.length > 0 && (
        <div className="note">
          {puja.ck
            ? 'This pin sits outside the usual area. Check the address before you set out.'
            : 'This puja shares a pin with others, so its exact spot is unknown. Check the address before you set out.'}
        </div>
      )}
    </div>
  );
}

/**
 * Get directions and Save, pinned to the bottom of the sheet. Directions hands off to Google Maps in
 * walking mode (a one-time hint says so); Save is labelled "Coming soon", stays tappable so it does not look broken, and says so.
 * @param {{ puja: import('../../lib/types.js').Puja }} props
 */
export function PujaActions({ puja }) {
  const { openDirections, toast } = useApp();
  // "Opens in Google Maps" is shown until someone has used Get directions once; after that it is gone for good.
  // It is read once, so it does not vanish (and shift the buttons) in the middle of the tap.
  const [hint] = useState(() => !storage.get('mapsHint', false));
  // Share hands the puja's own link to the phone's share sheet; where there is none, it copies the link.
  const share = async () => {
    const url = `${location.origin}${pujaUrl(puja.id)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: puja.n, text: `${puja.n}, Durga Puja in Kolkata`, url });
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return; // the person closed the share sheet
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied');
    } catch {
      toast("Couldn't copy the link. Copy it from the address bar.");
    }
  };
  return (
    <div className="actions">
      <div className="row actions-row">
        <a
          className="btn primary grow"
          target="_blank"
          rel="noopener noreferrer"
          href={`https://www.google.com/maps/dir/?api=1&travelmode=walking&destination=${puja.la},${puja.lo}`}
          onClick={() => {
            storage.set('mapsHint', true);
            openDirections();
          }}
        >
          <Icon name="nav" />
          Get directions
        </a>
        <button type="button" className="btn share" aria-label={`Share ${puja.n}`} onClick={share}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
            <path d="m16 6-4-4-4 4" />
            <path d="M12 2v13" />
          </svg>
        </button>
        <button type="button" className="btn save" onClick={() => toast('Saving is coming soon')}>
          <svg className="save-heart" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12.62 20.81C12.28 20.93 11.72 20.93 11.38 20.81C8.48 19.82 2 15.69 2 8.69C2 5.6 4.49 3.1 7.56 3.1C9.38 3.1 10.99 3.98 12 5.34C13.01 3.98 14.63 3.1 16.44 3.1C19.51 3.1 22 5.6 22 8.69C22 15.69 15.52 19.82 12.62 20.81Z"
              fill="#C9CCCF"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Save
          <span className="soon">
            <span>Coming</span>
            <span>soon</span>
          </span>
        </button>
      </div>
      {hint && <div className="actions-hint">Opens in Google Maps</div>}
    </div>
  );
}

/** The Puja details state: back control, then the fields. (The actions are pinned by the sheet.) */
export default function PujaPage() {
  const { data, pujaId, back } = useApp();
  const puja = pujaId ? data.byId.get(pujaId) : undefined;
  if (!puja) return null; // can render once more while the panel animates out
  return (
    <PujaFields
      puja={puja}
      lead={
        <button type="button" className="back back-btn" aria-label="Back to the list" onClick={back}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
        </button>
      }
    />
  );
}
