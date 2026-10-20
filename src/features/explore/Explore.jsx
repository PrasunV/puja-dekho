import { useApp } from '../../context/AppContext.js';
import { Icon } from '../../components/ui/Icon.jsx';
import { AREA_RADIUS_M, PAGE_SIZE, RADIUS_STEPS } from '../../config.js';
import { formatBand } from '../../lib/geo.js';
import { zoneName } from '../../hooks/usePujaFilters.js';
import { headline } from '../../lib/headline.js';
import PopularStrip from './PopularStrip.jsx';
import PujaCard from './PujaCard.jsx';

/** Header text for the Browse state, used by the screen and by the peek line. */
export function useBrowseHeadline() {
  const { filters, position, station } = useApp();
  return headline({
    located: position != null,
    count: filters.nearCount,
    radius: filters.radius,
    filterCount: filters.filterCount,
    stationName: station?.name ?? null,
    zoneText: filters.zones.length ? zoneName(filters.zones) : null,
    defaultRadius: RADIUS_STEPS[0],
  });
}

/** Banner when the location is off, blocked or the person is far away (PRD section 8). */
function LocationBanner() {
  const { locationStatus, locate } = useApp();
  if (locationStatus === 'on') return null;
  // Far away: the chip under the filter row says so (see VisitorChip), so no card here.
  if (locationStatus === 'far') return null;
  const denied = locationStatus === 'denied';
  return (
    <div className="banner" role="status">
      <Icon name={denied ? 'myloc-off' : 'myloc'} size={22} />
      <div className="grow">
        <b>{denied ? 'Location is blocked' : 'See pujas near you'}</b>
        <div className="sub">
          {denied
            ? 'Allow location for this site in your browser settings, then tap the button on the map. Your location never leaves your phone.'
            : 'Turn on location to see the pujas around you. It never leaves your phone.'}
        </div>
      </div>
      {!denied && (
        <button type="button" className="btn small dark" aria-busy={locationStatus === 'asking'} onClick={() => locate()}>
          {locationStatus === 'asking' ? 'Finding you…' : 'Turn on location'}
        </button>
      )}
    </div>
  );
}

/** The Browse state: header, banner, Popular strip and the puja list. */
export default function Explore() {
  const { filters, position, setStation, locationStatus } = useApp();
  const { results, nearCount, radius, radiusActive, nextRadius, filterCount, appliedText, visibleCount, showMore } = filters;
  const title = useBrowseHeadline();
  const clearFilters = () => {
    filters.clearOthers();
    setStation(null);
  };
  const { areaCentre, areaPujas, clearArea } = filters;
  // With an area searched, its pujas lead under their own heading and the rest follow without repeating them.
  const inArea = new Set(areaPujas.map((puja) => puja.id));
  const rest = areaCentre ? results.filter((puja) => !inArea.has(puja.id)) : results;
  const shown = rest.slice(0, visibleCount);
  const dividerAt = !areaCentre && radiusActive && nearCount < results.length ? nearCount : -1;
  return (
    <div className="stack">
      <div className="head">
        <div>
          <h2>{title}</h2>
          {appliedText && <div className="sub">{appliedText}</div>}
        </div>
        {filterCount > 0 && (
          <button type="button" className="btn text" onClick={clearFilters}>
            Clear all
          </button>
        )}
      </div>
      <LocationBanner />
      {radiusActive && nearCount === 0 && results.length > 0 && (
        <div className="notice">
          <b>No pujas within {formatBand(radius)}</b>
          {nextRadius && (
            <button type="button" className="btn small dark mt8" onClick={() => filters.chooseRadius(nextRadius)}>
              Show pujas within {formatBand(nextRadius)}
            </button>
          )}
        </div>
      )}
      {!areaCentre && <PopularStrip />}
      {areaCentre && (
        <section aria-label="Pujas in this area" data-testid="area-section">
          <div className="area-head">
            <h3>
              Pujas in this area <span className="num">{areaPujas.length}</span>
            </h3>
            <button type="button" className="btn text" onClick={clearArea}>
              Clear area
            </button>
          </div>
          <div className="sub">{`Within about ${AREA_RADIUS_M / 1000} km of the middle of the map.`}</div>
          {areaPujas.length === 0 ? (
            <div className="notice">
              <b>No pujas within {AREA_RADIUS_M / 1000} km of here</b>
              <div className="sub">Pan the map and search again, or see every puja below.</div>
            </div>
          ) : (
            areaPujas.map((puja, i) => <PujaCard key={puja.id} puja={puja} index={i} />)
          )}
          {rest.length > 0 && <div className="divider-row">Everywhere else</div>}
        </section>
      )}
      {results.length === 0 ? (
        <div className="empty">
          <h3>No pujas match</h3>
          <div>These filters together leave nothing. Clear them to see the pujas again.</div>
          <button type="button" className="btn small dark mt12" onClick={clearFilters}>
            Clear all
          </button>
        </div>
      ) : (
        <div>
          {shown.map((puja, i) => (
            <div key={puja.id}>
              {i === dividerAt && <div className="divider-row">{`Farther than ${formatBand(radius)}`}</div>}
              <PujaCard puja={puja} index={i} />
            </div>
          ))}
          {rest.length > shown.length && (
            <button type="button" className="btn block mt12" onClick={showMore}>
              {`Show ${Math.min(PAGE_SIZE, rest.length - shown.length)} more`}
            </button>
          )}
        </div>
      )}
      {!position && locationStatus !== 'asking' && results.length > 0 && (
        <div className="sub">{filters.curated ? 'Our picks first, then the rest.' : 'Listed A to Z. Turn on location to sort by distance.'}</div>
      )}
    </div>
  );
}
