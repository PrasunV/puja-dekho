import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useApp } from '../../context/AppContext.js';
import { Dot } from '../../components/ui/Dot.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { formatDistance, todayIst, walkMinutes } from '../../lib/geo.js';
import { heritage } from '../../lib/heritage.js';
import { metroNotes, phaseFor, stationLines } from '../../lib/metro.js';
import { nearStations } from '../../lib/pujas.js';
import { friendlyHours, lineToday } from '../../lib/schedule.js';

/** Beyond 10 km a station is no help (Howrah and the northern suburbs), so none is offered. */
const MAX_STATION_M = 10_000;
const LINE_NAME = { blue: 'Blue Line', green: 'Green Line', yellow: 'Yellow Line', purple: 'Purple Line', orange: 'Orange Line' };
const GROW = { duration: 0.26, ease: /** @type {const} */ ([0.25, 1, 0.5, 1]) };

/**
 * One bento card: a header button (icon, title, chevron), a one-line preview while shut, the content while open.
 * It grows in place, like a place page on Google Maps.
 * @param {{ id: string, icon: import('../../components/ui/Icon.jsx').IconName, title: string, preview: string, open: boolean, onToggle: () => void, full?: boolean, children: import('react').ReactNode }} props
 */
function BentoCard({ id, icon, title, preview, open, onToggle, full = false, children }) {
  return (
    <motion.div id={`card-${id}`} layout transition={{ layout: GROW }} className="bento-card" data-open={open} data-full={full || undefined} style={{ borderRadius: 20 }}>
      <motion.div layout="position" transition={{ layout: GROW }}>
        <button type="button" className="bento-head" aria-expanded={open} aria-controls={`bento-${id}`} onClick={onToggle}>
          <Icon name={icon} size={22} />
          <span className="bento-title">{title}</span>
          <span className="bento-chev" data-open={open}>
            <Icon name="chevron" size={20} />
          </span>
        </button>
        {!open && <div className="bento-preview">{preview}</div>}
        <AnimatePresence initial={false}>
          {open && (
            <motion.div id={`bento-${id}`} className="bento-body" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, delay: 0.1 }}>
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

/** The facts strip and the three bento cards (Getting there, Heritage, Address) of a puja's details. */
export default function PujaBento({ puja }) {
  const { data, setSheet, toast } = useApp();
  const [open, setOpen] = useState({ metro: false, heritage: false, address: false });

  const stations = nearStations(data, puja, 2).filter((entry) => entry.distance <= MAX_STATION_M);
  const age = heritage(puja.e);
  const toggle = (/** @type {'metro' | 'heritage' | 'address'} */ key) => setOpen((o) => ({ ...o, [key]: !o[key] }));
  /** A facts-strip tap opens its card, lifts the sheet to full and brings the card into view. */
  const jump = (/** @type {'metro' | 'heritage'} */ key) => {
    setOpen((o) => ({ ...o, [key]: true }));
    setSheet('full');
    setTimeout(() => document.getElementById(`card-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 320);
  };

  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(puja.ad);
      toast('Address copied');
    } catch {
      toast("Couldn't copy the address. Press and hold it to copy.");
    }
  };
  // Either of the two small cards open: both go full width and stack.
  const stacked = open.metro || open.heritage;

  return (
    <>
      <div className="facts-strip">
        <div className="fact">
          <span className="fact-label">Open</span>
          <b>All day</b>
        </div>
        {age && (
          <button type="button" className="fact" onClick={() => jump('heritage')}>
            <span className="fact-label">
              Since <Icon name="chevron" size={14} />
            </span>
            <b>{puja.e}</b>
          </button>
        )}
        {stations.length > 0 && (
          <button type="button" className="fact" onClick={() => jump('metro')}>
            <span className="fact-label">
              Nearest metro <Icon name="chevron" size={14} />
            </span>
            <b>{`${walkMinutes(stations[0].distance)} min walk`}</b>
          </button>
        )}
      </div>

      <motion.div layout className="bento" data-stacked={stacked || undefined} transition={{ layout: GROW }}>
        {stations.length > 0 && (
          <BentoCard
            id="metro"
            icon="train"
            title="Getting there"
            preview={`${stations[0].station.name}${stations.length > 1 ? ` and ${stations.length - 1} more` : ''}`}
            open={open.metro}
            onToggle={() => toggle('metro')}
          >
            <div className="bento-rows">
              {stations.map(({ station, distance }) => {
                const lines = stationLines(station);
                return (
                  <div key={station.id} className="bento-row">
                    <div className="row">
                      {station.lines.map((line) => (
                        <Dot key={line} tone={line} />
                      ))}
                      <b className="grow">{station.name}</b>
                      <b className="num">{`${walkMinutes(distance)} min walk`}</b>
                    </div>
                    <div className="sub num right">{formatDistance(distance)}</div>
                    {lines.map((line) => {
                      const t = lineToday(data.metro, line);
                      return (
                        <div key={line} className="bento-timing">
                          <Icon name="moon" size={16} />
                          <span>
                            {`${LINE_NAME[line]}: ${friendlyHours(t.pujaHours ?? t.regularHours) ?? 'No service'}`}
                            <small>{t.pujaHours ? `Today, ${today} · ${t.pujaLabel}` : `Today, ${today} · ${t.regularLabel}`}</small>
                          </span>
                        </div>
                      );
                    })}
                    {metroNotes(data.metro, station, phaseFor(data.metro, todayIst())).map((note) => (
                      <div key={note} className="sub caution">
                        {note}
                      </div>
                    ))}
                  </div>
                );
              })}
              {stations[0].distance > 1500 && <div className="sub">No Blue or Green Line station within 1.5 km. Plan on a cab or bike for the last stretch.</div>}
              <div className="sub">Distances are straight-line; walking time assumes a 1.3× detour at 75 m a minute.</div>
            </div>
          </BentoCard>
        )}

        {age && (
          <BentoCard
            id="heritage"
            icon="ribbon"
            title="Heritage"
            preview={age.jubilee ? `${age.jubilee} this year. ${age.years} years of puja.` : `${age.years} years of puja. Next: ${age.next.name} in ${age.next.year}`}
            open={open.heritage}
            onToggle={() => toggle('heritage')}
          >
            <dl className="bento-facts">
              <dt>Years of puja</dt>
              <dd>{age.years}</dd>
              <dt>Since</dt>
              <dd>{puja.e}</dd>
              {age.jubilee && (
                <>
                  <dt>This year</dt>
                  <dd>{age.jubilee}</dd>
                </>
              )}
              <dt>Next milestone</dt>
              <dd>{`${age.next.name}, ${age.next.year}`}</dd>
            </dl>
          </BentoCard>
        )}

        <BentoCard
          id="address"
          icon="pin"
          title="Address"
          preview={puja.ad}
          open={open.address}
          onToggle={() => toggle('address')}
          full
        >
          <p className="bento-address">{puja.ad}</p>
          {puja.a.length > 0 && <p className="sub">{`Also known as ${puja.a.join(', ')}`}</p>}
          <div className="row wrap bento-actions">
            <button type="button" className="btn small" onClick={copyAddress}>
              <Icon name="copy" size={18} />
              Copy
            </button>
            <a className="btn small" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${puja.la},${puja.lo}`}>
              <Icon name="nav" size={18} />
              Open in Maps
            </a>
          </div>
        </BentoCard>
      </motion.div>
    </>
  );
}
