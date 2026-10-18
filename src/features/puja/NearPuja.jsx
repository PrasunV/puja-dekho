import { Icon } from '../../components/ui/Icon.jsx';
import { PujaFields } from './PujaPage.jsx';

/**
 * The "You're near [puja]" state (PRD flow D). It shows the same fields as Puja details; Get directions
 * and Save are pinned by the sheet. The person can dismiss it, or say it is not the right puja.
 * @param {{ puja: import('../../lib/types.js').Puja, canSkip: boolean, onDismiss: () => void, onNotThisOne: () => void }} props
 */
export default function NearPuja({ puja, canSkip, onDismiss, onNotThisOne }) {
  return (
    <div className="stack">
      <div className="near-head">
        <b className="grow">{`You're near ${puja.n}`}</b>
        {canSkip && (
          <button type="button" className="btn text" onClick={onNotThisOne}>
            Not this one?
          </button>
        )}
        <button type="button" className="icon-btn" aria-label="Dismiss" onClick={onDismiss}>
          <Icon name="x" />
        </button>
      </div>
      <PujaFields puja={puja} />
    </div>
  );
}
