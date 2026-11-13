import eyeSvg from '../../assets/loader/eye-lineart.svg?raw';
import './loader.css';

/**
 * One empty state for the whole app: the still eye, one line, an optional second line, an optional single action.
 * @param {{
 *   title: string,
 *   text?: string,
 *   action?: { label: string, onClick: () => void },
 *   role?: 'status',
 * }} props
 */
export default function EmptyState({ title, text, action, role }) {
  return (
    <div className="pd-empty" role={role}>
      <span className="pd-empty-eye" aria-hidden="true" dangerouslySetInnerHTML={{ __html: eyeSvg }} />
      <p className="pd-empty-title">{title}</p>
      {text && <p className="pd-empty-text">{text}</p>}
      {action && (
        <button type="button" className="btn dark small" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
