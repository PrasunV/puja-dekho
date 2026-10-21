import { useState } from 'react';
import { useApp } from '../../context/AppContext.js';
import { BentoCard } from '../../components/ui/Bento.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { ghatDirectionsUrl } from '../../data/bhasan.js';
import { GhatChip, useGhatDistance } from './BhasanSection.jsx';
import { useBhasan } from './useBhasan.js';

/** The ghat's details: the same head, chips and Address tile as a puja, plus a short note. */
export default function GhatPage() {
  const { back, toast, setSheet } = useApp();
  const { config, status } = useBhasan();
  const { ghat } = config;
  const distance = useGhatDistance(ghat);
  const [open, setOpen] = useState(false);
  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(ghat.address);
      toast('Address copied');
    } catch {
      toast("Couldn't copy the address. Press and hold it to copy.");
    }
  };
  return (
    <div className="stack" data-testid="ghat-page">
      <div className="detail-head" data-sheet-head>
        <div className="detail-id">
          <h2>{ghat.name}</h2>
          {distance && <div className="sub num">{distance} away</div>}
          <div className="row wrap mt8">
            <GhatChip status={status} />
            <span className="tag">{ghat.area}</span>
          </div>
        </div>
        <button type="button" className="back back-btn" aria-label="Close details" onClick={back}>
          <Icon name="x" size={22} />
        </button>
      </div>
      <div className="bento">
        <BentoCard
          id="address"
          icon="pin"
          title="Address"
          preview={<b className="bp-big">{ghat.area}</b>}
          open={open}
          onToggle={() => {
            if (!open) setSheet('full');
            setOpen((v) => !v);
          }}
          full
        >
          <p className="bento-address">{ghat.address}</p>
          <div className="row wrap bento-actions">
            <button type="button" className="btn small" onClick={copyAddress}>
              <Icon name="copy" size={18} />
              Copy
            </button>
            <a className="btn small" target="_blank" rel="noopener noreferrer" href={ghatDirectionsUrl(ghat).replace('/dir/', '/search/').replace('destination=', 'query=')}>
              <Icon name="nav" size={18} />
              Open in Maps
            </a>
          </div>
        </BentoCard>
      </div>
      <p className="ghat-note">{ghat.note}</p>
      {!ghat.window && <div className="note">The exact time of immersion here is not confirmed. Check the news before you set out.</div>}
    </div>
  );
}

/** Pinned buttons: Get directions (Google Maps picks the mode) and Show on map. */
export function GhatActions() {
  const { config } = useBhasan();
  const { mapRef, setSheet, desktop } = useApp();
  const { ghat } = config;
  return (
    <div className="actions">
      <div className="row actions-row">
        <a className="btn primary grow" target="_blank" rel="noopener noreferrer" href={ghatDirectionsUrl(ghat)}>
          <Icon name="nav" />
          Get directions
        </a>
        <button
          type="button"
          className="btn save"
          onClick={() => {
            if (!desktop) setSheet((s) => (s === 'full' ? 'half' : s));
            mapRef.current?.flyToPoint(ghat);
          }}
        >
          <Icon name="pin" size={18} />
          Show on map
        </button>
      </div>
    </div>
  );
}
