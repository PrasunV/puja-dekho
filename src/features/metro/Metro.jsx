import { useMemo } from 'react';
import { useApp } from '../../context/AppContext.js';
import { BentoCard, useBento } from '../../components/ui/Bento.jsx';
import { Dot } from '../../components/ui/Dot.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import PujaCard from '../explore/PujaCard.jsx';
import { CLOSED_STATIONS, HOLIDAY_NOTE, REGULAR_SCHEDULE, SCHEDULE_SOURCE } from '../../data/schedule.js';
import { formatDistance, haversine, todayIst, walkMinutes } from '../../lib/geo.js';
import { LINE_NAME, LINE_ORDER, LINE_SUMMARY, lineTimings, phaseFor, stationLines } from '../../lib/metro.js';
import { friendlyHours, isClosed, lineToday, pujaRows } from '../../lib/schedule.js';
import { outlookText, stationOutlook } from '../../lib/stations.js';

const NEAREST_COUNT = 5;
const LINE_ORDER_KEYS = /** @type {const} */ (['blue', 'green']);

/** Table of operating hours per line and phase. */
function TimingsTable({ metro }) {
  return (
    <div className="scroll-x">
      <table className="t">
        <thead>
          <tr>
            {['Line', 'Panchami, Shashthi', 'Saptami to Navami', 'Dashami'].map((title) => (
              <th key={title}>{title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {LINE_SUMMARY.map(([key, name, span]) => {
            const timings = lineTimings(metro, key);
            const plain = !timings || typeof timings === 'string';
            const cells = plain
              ? []
              : [
                  timings.Panchami_Shashthi,
                  timings.Saptami_to_Navami || timings.Saptami_to_Dashami,
                  timings.Dashami || (timings.Saptami_to_Dashami ? 'Same as Saptami to Navami' : ''),
                ];
            return (
              <tr key={key}>
                <td>
                  <div className="row tightgap">
                    {key !== 'purple' && <Dot tone={key} />}
                    <b>{name}</b>
                  </div>
                  <div className="sub">{span}</div>
                </td>
                {plain ? (
                  <td colSpan={3}>{timings || 'See notice'}</td>
                ) : (
                  cells.map((cell, i) => (
                    <td key={i} className="num">
                      {cell || ''}
                    </td>
                  ))
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** What every station offers (1 km, else 5 km, else the nearest station with pujas), computed once. */
function useStationOutlooks() {
  const { data } = useApp();
  return useMemo(() => new Map(data.stations.map((station) => [station.id, stationOutlook(station, data.stations, data.pujas)])), [data]);
}

/**
 * The line timings as bento tiles: one per metro line, two across while shut (a Dot, today's hours and how often
 * trains run). Tapping a tile opens it full width with Puja days, Mon to Fri, Saturday and Sunday, and where the
 * times come from.
 * @param {{ lines: ('blue' | 'green')[] }} props
 */
function TimingsBar({ lines }) {
  const { data } = useApp();
  const now = useMemo(() => new Date(), []);
  const { open, toggle, stacked } = useBento({});
  return (
    <div className="bento" data-stacked={stacked || undefined} role="region" aria-label="Metro timings">
      {lines.map((line) => {
        const today = lineToday(data.metro, line, now);
        const rows = pujaRows(data.metro, line, now);
        const festivalOver = rows.every((row) => !row.hours);
        return (
          <BentoCard
            key={line}
            id={`timings-${line}`}
            icon="train"
            title={today.name}
            open={!!open[line]}
            onToggle={() => toggle(line)}
            preview={
              <>
                <span className="bp-dots">
                  <Dot tone={line} />
                </span>
                <b className="bp-big num">{friendlyHours(today.pujaHours ?? today.regularHours) ?? 'No service'}</b>
                <span className="bp-sub">{today.pujaHours ? `${today.pujaLabel} · ${today.freq}` : today.freq}</span>
              </>
            }
          >
            <div className="timings-body">
              {!festivalOver && (
                <section aria-label="Puja days">
                  <h4>Puja days</h4>
                  {rows.map((row) => (
                    <div key={row.id} className={row.today ? 'trow today' : 'trow'}>
                      <span>{row.label}</span>
                      <span className="num">{row.hours}</span>
                      {row.today && <em>Today</em>}
                    </div>
                  ))}
                </section>
              )}
              <section aria-label="Regular days">
                <h4>Regular days</h4>
                {['weekday', 'saturday', 'sunday'].map((kind) => (
                  <div key={kind} className={!today.pujaHours && today.kind === kind ? 'trow today' : 'trow'}>
                    <span>{kind === 'weekday' ? 'Mon to Fri' : kind === 'saturday' ? 'Saturday' : 'Sunday'}</span>
                    <span className="num">{REGULAR_SCHEDULE[line][kind]}</span>
                    {!today.pujaHours && today.kind === kind && <em>Today</em>}
                  </div>
                ))}
                <div className="trow">
                  <span>Trains run</span>
                  <span className="num">{today.freq}</span>
                </div>
              </section>
              <p className="sub">{`${REGULAR_SCHEDULE[line].route}. ${HOLIDAY_NOTE}`}</p>
              <p className="sub">
                {'Regular times: '}
                <a href={SCHEDULE_SOURCE.url} target="_blank" rel="noopener noreferrer">
                  {SCHEDULE_SOURCE.name}
                </a>
                {`, checked ${SCHEDULE_SOURCE.checkedOn}. Puja hours come from a third-party list. Confirm with Metro Railway before you travel.`}
              </p>
            </div>
          </BentoCard>
        );
      })}
    </div>
  );
}

/** One station row: name, lines, how many pujas are near it. Tapping opens the station's results. */
function StationRow({ station, outlook, trailing = /** @type {React.ReactNode} */ (null) }) {
  const { openStation } = useApp();
  const closed = isClosed(station.id);
  const names = (
    <div className="row tightgap">
      {stationLines(station).map((line) => (
        <Dot key={line} tone={line} />
      ))}
      <b>{station.name}</b>
    </div>
  );
  if (closed)
    return (
      <div className="lb closed">
        <div className="grow">
          {names}
          <div className="sub">{CLOSED_STATIONS[/** @type {keyof typeof CLOSED_STATIONS} */ (station.id)]}</div>
        </div>
      </div>
    );
  return (
    <div className="lb">
      <button type="button" className="grow plain" onClick={() => openStation(station.id)}>
        {names}
        <div className="sub">{outlook ? outlookText(outlook) : ''}</div>
      </button>
      {trailing}
    </div>
  );
}

/** Pinned header: the Back control and the timings stay in view while the list scrolls under them. */
function StickyHead({ children }) {
  return <div className="sticky-head">{children}</div>;
}

/**
 * Metro state for the line chips (PRD flow E): the stations of the lines that are switched on. With both
 * on, the list is grouped by line.
 */
export function MetroLines() {
  const { data, nav, back } = useApp();
  const outlooks = useStationOutlooks();
  const lines = LINE_ORDER_KEYS.filter((line) => nav.lines.includes(line));
  return (
    <div className="stack">
      <StickyHead>
        <button type="button" className="back" onClick={back}>
          <Icon name="back" />
          Back
        </button>
      </StickyHead>
      <TimingsBar lines={lines} />
      {lines.map((line) => (
        <div key={line}>
          <div className="row line-head">
            <Dot tone={line} />
            <h3>{`${LINE_NAME[line]}, ${LINE_ORDER[line].length} stations`}</h3>
          </div>
          {LINE_ORDER[line].map((stationId) => {
            const station = data.stById.get(stationId);
            return station ? <StationRow key={`${line}-${stationId}`} station={station} outlook={outlooks.get(stationId)} /> : null;
          })}
        </div>
      ))}
    </div>
  );
}

/** Peek text for the lines state: "Blue line, 25 stations". */
export function linesPeek(lines) {
  const picked = LINE_ORDER_KEYS.filter((line) => lines.includes(line));
  const stations = new Set(picked.flatMap((line) => LINE_ORDER[line]));
  const names = picked.map((line) => LINE_NAME[line].replace(' Line', '')).join(' and ');
  return `${names} line${picked.length > 1 ? 's' : ''}, ${stations.size} stations`;
}

/**
 * Results for one station (PRD flow E.2): the pujas near it, nearest first. Never a dead end:
 * 1 km, else 5 km, else a button to the nearest open station that has pujas.
 */
export function StationResults() {
  const { station, filters, back, openStation } = useApp();
  if (!station) return null;
  const outlook = filters.outlook;
  const count = filters.results.length;
  const km = filters.stationRadius / 1000;
  const wide = filters.stationRadius > 1000;
  const lines = /** @type {('blue' | 'green')[]} */ (stationLines(station).filter((line) => line === 'blue' || line === 'green'));
  return (
    <div className="stack">
      <StickyHead>
        <button type="button" className="back" onClick={back}>
          <Icon name="back" />
          Back to stations
        </button>
      </StickyHead>
      {lines.length > 0 && <TimingsBar lines={lines} />}
      <div className="head">
        <div>
          {count > 0 ? (
            <>
              <h2>
                {wide
                  ? `${count} ${count === 1 ? 'puja' : 'pujas'} within ${km} km of ${station.name}`
                  : `${count} ${count === 1 ? 'puja' : 'pujas'} near ${station.name}`}
              </h2>
              <div className="sub">
                {wide ? `None within 1 km, so this shows everything up to ${km} km. ` : 'Within 1 km. '}
                Straight-line, nearest first.
              </div>
            </>
          ) : (
            <h2>{`No pujas within 5 km of ${station.name}`}</h2>
          )}
        </div>
      </div>
      {count === 0 &&
        (outlook?.nearest ? (
          <div className="card stack tight">
            <div>
              <b>{`${outlook.nearest.station.name} is the nearest station with pujas`}</b>
              <div className="sub">{`${formatDistance(outlook.nearest.distance)} from ${station.name}, with ${outlook.nearest.count} ${outlook.nearest.count === 1 ? 'puja' : 'pujas'} within 1 km.`}</div>
            </div>
            <button
              type="button"
              className="btn small dark"
              onClick={() => openStation(/** @type {NonNullable<typeof outlook.nearest>} */ (outlook.nearest).station.id)}
            >
              {`Show pujas near ${outlook.nearest.station.name}`}
            </button>
          </div>
        ) : (
          <div className="empty">
            <div className="sub">No open station has pujas nearby. Pick another station from the list.</div>
            <button type="button" className="btn small dark mt12" onClick={back}>
              Back to the station list
            </button>
          </div>
        ))}
      <div>
        {filters.results.map((puja, i) => (
          <PujaCard
            key={puja.id}
            puja={puja}
            index={i}
            note={`~${formatDistance(filters.stationDistances?.get(puja.id) ?? 0)} from ${station.name}`}
          />
        ))}
      </div>
    </div>
  );
}

/** Metro button on the map: the stations nearest to you with walking distance, plus today's timings. */
export default function Metro() {
  const { data, position, locate, locationStatus, back } = useApp();
  const phase = phaseFor(data.metro, todayIst());
  const outlooks = useStationOutlooks();
  const { open, toggle } = useBento({ nearest: true, all: false });

  const nearest = useMemo(() => {
    if (!position) return [];
    return data.stations

      .filter((station) => station.lines.length && !isClosed(station.id))
      .map((station) => ({ station, distance: haversine(position.lat, position.lng, station.lat, station.lng) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, NEAREST_COUNT);
  }, [data, position]);

  return (
    <div className="stack">
      <StickyHead>
        <button type="button" className="back" onClick={back}>
          <Icon name="back" />
          Back
        </button>
      </StickyHead>
      <div className="head">
        <div>
          <h2>Metro nearby</h2>
          <div className="sub">{phase ? `Today: ${phase.label}` : 'Puja-special timings start on Panchami, 15 Oct'}</div>
        </div>
      </div>
      <TimingsBar lines={LINE_ORDER_KEYS.slice()} />
      {position ? (
        <div className="bento">
          <BentoCard
            id="nearest"
            icon="pin"
            title="Closest to you"
            full
            open={!!open.nearest}
            onToggle={() => toggle('nearest')}
            preview={
              nearest[0] ? (
                <>
                  <b className="bp-big">{nearest[0].station.name}</b>
                  <span className="bp-sub">{`~${formatDistance(nearest[0].distance)} · ~${walkMinutes(nearest[0].distance)} min walk`}</span>
                </>
              ) : null
            }
          >
            <div className="bento-rows">
              {nearest.map(({ station, distance }) => (
                <StationRow
                  key={station.id}
                  station={station}
                  outlook={outlooks.get(station.id)}
                  trailing={
                    <div className="num near-d">
                      <b>{`~${formatDistance(distance)}`}</b>
                      <div className="sub">{`~${walkMinutes(distance)} min walk`}</div>
                    </div>
                  }
                />
              ))}
              <div className="sub">Straight-line distance. Stations are highlighted on the map.</div>
            </div>
          </BentoCard>
        </div>
      ) : (
        <div className="card stack tight">
          <h3>Find the closest station</h3>
          <div className="sub">
            {locationStatus === 'far'
              ? "You're outside Kolkata, so there is no nearest station to show. Use the Blue line and Green line chips to see every station."
              : 'Turn on your location to see the nearest metro stations with walking distance.'}
          </div>
          {locationStatus !== 'far' && (
            <button type="button" className="btn primary" disabled={locationStatus === 'asking'} onClick={() => locate()}>
              <Icon name="myloc" />
              {locationStatus === 'asking' ? 'Finding you…' : 'Turn on location'}
            </button>
          )}
        </div>
      )}
      <div className="bento">
        <BentoCard
          id="all"
          icon="train"
          title="All timings"
          full
          open={!!open.all}
          onToggle={() => toggle('all')}
          preview={<span className="bp-sub">Puja days and regular days, for both lines</span>}
        >
          <TimingsTable metro={data.metro} />
        </BentoCard>
      </div>
      <div className="note">
        {data.metro.note} Purple Line stations are not on this map yet, so Behala pujas show the nearest Blue Line station. Saptami falls on
        17 or 18 Oct; the sources disagree. Times come from a third-party site and a news report, not the Metro Railway. Last trains run
        late on busy nights, so be at the station with time to spare.
      </div>
    </div>
  );
}
