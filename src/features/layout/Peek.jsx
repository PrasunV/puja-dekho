import { useApp } from '../../context/AppContext.js';
import { TypicalCrowd } from '../../components/ui/Crowd.jsx';
import { tripFor, tripText } from '../../lib/route.js';
import { useBrowseHeadline } from '../explore/Explore.jsx';
import { linesPeek } from '../metro/Metro.jsx';

/** One line for the sheet at its peek height, depending on the state (PRD section 3, "Sheet states"). */
export default function Peek() {
  const { view, nav, data, filters, station, near, route } = useApp();
  const browse = useBrowseHeadline();
  if (view === 'puja' && nav.pujaId) {
    const puja = data.byId.get(nav.pujaId);
    const trip = puja ? tripFor(filters.distances?.get(puja.id), route) : null;
    return puja ? (
      <span className="peek-puja">
        <b className="peek-name">{puja.n}</b>
        {trip && <span className="num sub">{tripText(trip, '')}</span>}
        <TypicalCrowd puja={puja} />
      </span>
    ) : null;
  }
  if (view === 'near' && near.puja) return <b>{`You're near ${near.puja.n}`}</b>;
  if (view === 'station' && station) {
    const count = filters.results.length;
    const wide = filters.stationRadius > 1000 ? ` within ${filters.stationRadius / 1000} km of` : ' near';
    if (count === 0 && filters.outlook?.nearest)
      return <b>{`No pujas near ${station.name}. Try ${filters.outlook.nearest.station.name}`}</b>;
    return <b>{`${count} ${count === 1 ? 'puja' : 'pujas'}${wide} ${station.name}`}</b>;
  }
  if (view === 'lines') return <b>{linesPeek(nav.lines)}</b>;
  if (view === 'metro') return <b>Metro nearby</b>;
  return <b>{browse}</b>;
}
