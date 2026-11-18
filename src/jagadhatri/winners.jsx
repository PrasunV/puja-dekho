import { Icon } from '../components/ui/Icon.jsx';
import { AWARDS, placeLabel } from './winners.js';

/**
 * The winners sheet: all six awards, each with its places. A winner linked to a puja opens that puja; the rest are plain text.
 * @param {{ ev: import('./config.js').JgEvent, byId: Map<string, import('./lib.js').JgPuja>, onBack: () => void, onClose: () => void, onOpenPuja: (id: string) => void }} props
 */
export function WinnersDetail({ ev, byId, onBack, onClose, onOpenPuja }) {
  return (
    <div className="jg-detail jg-win">
      <div className="jg-detail-head" data-sheet-head>
        <button type="button" className="jg-icon-btn" aria-label="Back to What's new" onClick={onBack}>
          <Icon name="back" />
        </button>
        <div className="jg-detail-titles">
          <h2 className="jg-title">{ev.title}</h2>
          <p className="jg-meta">{ev.when}</p>
        </div>
        <button type="button" className="jg-icon-btn" aria-label="Close" onClick={onClose}>
          <Icon name="x" />
        </button>
      </div>
      <p className="jg-body jg-win-intro">{ev.body}</p>
      {AWARDS.map((a) => (
        <section key={a.id} className="jg-win-award" aria-labelledby={`jg-win-${a.id}`}>
          <h3 id={`jg-win-${a.id}`} className="jg-win-title">
            {a.en}
            <span className="jg-bn" lang="bn">
              {a.bn}
            </span>
          </h3>
          <ul className="jg-win-rows">
            {a.placings.map((pl) => {
              const label = placeLabel(pl);
              const linked = pl.who.id && byId.has(pl.who.id) ? pl.who.id : null;
              const inner = (
                <>
                  <span className="jg-win-rank">{label}</span>
                  <span className="jg-win-name">
                    {pl.who.en}
                    <span className="jg-bn" lang="bn">
                      {pl.who.bn}
                    </span>
                  </span>
                  {linked && <Icon name="next" size={20} />}
                </>
              );
              return (
                <li key={pl.who.en}>
                  {linked ? (
                    <button
                      type="button"
                      className="jg-win-row"
                      aria-label={`${label}, ${pl.who.en}. See the puja`}
                      onClick={() => onOpenPuja(linked)}
                    >
                      {inner}
                    </button>
                  ) : (
                    <div className="jg-win-row">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <p className="jg-win-fine">Names are shown as the committee wrote them. Winners without an arrow are not linked to a puja yet.</p>
    </div>
  );
}
