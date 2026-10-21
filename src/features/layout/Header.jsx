// import { Icon } from '../../components/ui/Icon.jsx'; // needed again when the search box is restored
import { APP_NAME, APP_VERSION, MAKER } from '../../config.js';
import FilterBar from '../explore/FilterBar.jsx';

/** The share-out icon beside the maker's name (Basil "share box"), drawn in the link colour. */
function ShareOut() {
  return (
    <svg className="mw-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M20.028 14.094C19.987 14.1297 19.9537 14.1734 19.9302 14.2224C19.9066 14.2714 19.8933 14.3247 19.891 14.379C19.8419 15.3922 19.7585 16.4034 19.641 17.411C19.487 18.729 18.421 19.778 17.091 19.927C13.707 20.3022 10.292 20.3022 6.90801 19.927C6.26195 19.8555 5.65886 19.5683 5.19617 19.1118C4.73347 18.6552 4.43819 18.056 4.35801 17.411C3.95687 13.9827 3.95687 10.5193 4.35801 7.09101C4.43798 6.44578 4.73317 5.84637 5.19588 5.38965C5.6586 4.93292 6.2618 4.64556 6.90801 4.57401C9.14052 4.32592 11.3882 4.2417 13.633 4.32201C13.796 4.32701 13.933 4.20401 13.945 4.04201L13.995 3.33901C13.997 3.29767 14.001 3.25667 14.007 3.21601C14.031 3.02201 13.897 2.83001 13.7 2.82301C11.3774 2.74112 9.05199 2.82801 6.74201 3.08301C4.73001 3.30901 3.10501 4.89301 2.86901 6.91601C2.45512 10.4606 2.45512 14.0414 2.86901 17.586C3.10501 19.608 4.72901 21.193 6.74201 21.418C10.2367 21.8048 13.7633 21.8048 17.258 21.418C19.27 21.193 20.895 19.608 21.131 17.585C21.2996 16.1416 21.3997 14.6909 21.431 13.238C21.435 13.055 21.211 12.965 21.084 13.094C20.744 13.44 20.392 13.7733 20.028 14.094Z"
        fill="currentColor"
      />
      <path
        d="M7.8669 15.55C7.7594 15.5204 7.66489 15.4557 7.5984 15.3661C7.5319 15.2766 7.49723 15.1675 7.4999 15.056L7.5599 12.593C7.60062 10.8966 8.30311 9.28341 9.51728 8.09802C10.7314 6.91262 12.361 6.24903 14.0579 6.249H15.3149C15.3416 5.625 15.3772 5.00166 15.4219 4.379L15.4899 3.449C15.4992 3.31901 15.5421 3.19367 15.6145 3.08527C15.6868 2.97687 15.7861 2.88913 15.9025 2.83065C16.019 2.77216 16.1486 2.74495 16.2788 2.75167C16.4089 2.7584 16.5351 2.79882 16.6449 2.869C18.7156 4.19284 20.5158 5.89808 21.9499 7.894L22.4059 8.529C22.4669 8.61397 22.4997 8.71591 22.4997 8.8205C22.4997 8.92508 22.4669 9.02703 22.4059 9.112L21.9499 9.74699C20.5157 11.7425 18.7155 13.4474 16.6449 14.771C16.5555 14.8282 16.4549 14.8658 16.3499 14.8815C16.2449 14.8971 16.1378 14.8905 16.0356 14.8619C15.9334 14.8333 15.8383 14.7834 15.7567 14.7155C15.6751 14.6476 15.6087 14.5633 15.5619 14.468C15.5217 14.3814 15.4973 14.2882 15.4899 14.193L15.4219 13.262C15.368 12.5195 15.3276 11.776 15.3009 11.032L14.9469 10.978C13.8447 10.8119 12.718 10.9845 11.7162 11.4731C10.7144 11.9617 9.88461 12.7432 9.3369 13.714L8.4349 15.314C8.38006 15.411 8.29439 15.4869 8.19148 15.5297C8.08858 15.5724 7.97434 15.5796 7.8669 15.55Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Brand (logo, name, version), credit line and filter chips (the search box is commented out for now).
 * The brand is one 48 px-high link home; the credit is one 48 px-high link to the maker's profile.
 */
export default function Header() {
  return (
    <header className="top">
      <div className="top-row">
        <a className="brand" href="/" aria-label={`${APP_NAME}, version ${APP_VERSION}. Home`}>
          <picture>
            <source media="(prefers-color-scheme: dark)" srcSet="/brand/logo-mark-dark.png" />
            <img className="brand-logo" src="/brand/logo-mark.png" width="41" height="32" alt="" decoding="async" />
          </picture>
          <span className="brand-text">
            <span className="brand-name">{APP_NAME}</span>
            <span className="brand-ver">{`v${APP_VERSION}`}</span>
          </span>
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
        <a
          className="made-with"
          href={MAKER.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Made with love by ${MAKER.name}, on LinkedIn (opens in a new tab)`}
        >
          <span className="mw-text">
            made with love
            <br />
            by <span className="mw-name">{MAKER.name}</span>
            <ShareOut />
          </span>
        </a>
      </div>
      <FilterBar />
    </header>
  );
}
