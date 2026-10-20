import { useState } from 'react';
import { useApp } from '../../context/AppContext.js';
import { Dot } from '../../components/ui/Dot.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { TypicalCrowd } from '../../components/ui/Crowd.jsx';
import { tripFor, tripText } from '../../lib/route.js';
import { formatDistance, todayIst, walkMinutes } from '../../lib/geo.js';
import { metroNotes, phaseFor, stationLines, timingText } from '../../lib/metro.js';
import { nearStations } from '../../lib/pujas.js';
import { storage } from '../../lib/storage.js';

/** Nearest metro stations with today's hours. */
function NearestMetro({ puja }) {
  const { data } = useApp();
  // Beyond 10 km a station is no help (Howrah and the northern suburbs), so say nothing.
  const stations = nearStations(data, puja, 2).filter((entry) => entry.distance <= 10_000);
  const phase = phaseFor(data.metro, todayIst());
  const dayLabel = `Today, ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}`;
  if (stations.length === 0) return null;
  return (
    <div className="card stack">
      <h3>Nearest metro</h3>
      {stations.map(({ station, distance }) => {
        const lines = stationLines(station);
        const hours = [...new Set(lines.map((line) => timingText(data.metro, line, phase)).filter(Boolean))];
        const notes = metroNotes(data.metro, station, phase);
        let detail = station.lines.join(', ');
        if (lines.length)
          detail = hours.length ? `${dayLabel}${phase?.label ? `, ${phase.label}` : ''}: ${hours.join(' / ')}` : 'Check the Metro button on the map for timings.';
        return (
          <div key={station.id}>
            <div className="row">
              {station.lines.map((line) => (
                <Dot key={line} tone={line} />
              ))}
              <b className="grow">{station.name}</b>
              <span className="num">{`~${formatDistance(distance)} · ~${walkMinutes(distance)} min walk`}</span>
            </div>
            <div className="sub">{detail}</div>
            {notes.map((note) => (
              <div key={note} className="sub caution">
                {note}
              </div>
            ))}
          </div>
        );
      })}
      {stations[0] && stations[0].distance > 1500 && (
        <div className="sub">No Blue or Green Line station within 1.5 km. Plan on a cab or bike for the last stretch.</div>
      )}
      <div className="sub">Distances are straight-line; walking time assumes a 1.3× detour at 75 m a minute.</div>
    </div>
  );
}

/**
 * The fields of a puja that exist in the data, and nothing else (PRD open question 11).
 * Today that is area, address, heritage, alternate names and the typical crowd.
 * @param {{ puja: import('../../lib/types.js').Puja, lead?: import('react').ReactNode }} props
 *   `lead` sits to the left of the title (the Back button on the details screen).
 */
export function PujaFields({ puja, lead }) {
  const { filters, route } = useApp();
  const trip = tripFor(filters.distances?.get(puja.id), route);
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
            {puja.h && <span className="tag accent">{puja.e ? `Since ${puja.e}` : 'Heritage'}</span>}
            {puja.f && <span className="tag accent">Featured</span>}
          </div>
        </div>
      </div>
      <dl className="facts">
        <dt>Address</dt>
        <dd>{puja.ad}</dd>
        <dt>Area</dt>
        <dd>{puja.ar}</dd>
        {puja.a.length > 0 && (
          <>
            <dt>Also known as</dt>
            <dd>{puja.a.join(', ')}</dd>
          </>
        )}
      </dl>
      {puja.ec && <div className="note">{`Sources disagree on the founding year (${puja.e} vs ${puja.ec}).`}</div>}
      {puja.fl.length > 0 && (
        <div className="note">
          {puja.ck
            ? 'This pin sits outside the usual area. Check the address before you set out.'
            : 'This puja shares a pin with others, so its exact spot is unknown. Check the address before you set out.'}
        </div>
      )}
      <NearestMetro puja={puja} />
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
