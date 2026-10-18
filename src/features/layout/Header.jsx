// import { Icon } from '../../components/ui/Icon.jsx'; // needed again when the search box is restored
import { APP_NAME, MAKER } from '../../config.js';
import FilterBar from '../explore/FilterBar.jsx';

/**
 * Brand, credit line and filter chips (the search box is commented out for now).
 */
export default function Header() {
  return (
    <header className="top">
      <div className="top-row">
        <a className="brand" href="/" aria-label={APP_NAME}>
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">{APP_NAME}</span>
        </a>
        {/* Search is switched off for now. Restore this block to bring it back (it needs `query` and `onQueryChange` props again; App.jsx no longer owns a search query).
        <label className="search">
          <Icon name="search" />
          <input
            type="search"
            value={query}
            placeholder="Search pujas"
            autoComplete="off"
            enterKeyHint="search"
            aria-label="Search pujas"
            onChange={(e) => onQueryChange(e.target.value)}
          />
        </label>
        */}
        <div className="made-with">
          made with love
          <br />
          by{' '}
          <a href={MAKER.url} target="_blank" rel="noopener noreferrer" aria-label={`${MAKER.name}, on LinkedIn (opens in a new tab)`}>
            {MAKER.name}
          </a>
        </div>
      </div>
      <FilterBar />
    </header>
  );
}
