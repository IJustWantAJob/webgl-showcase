/**
 * SearchBar Component
 *
 * Search input for filtering demos.
 */

import { usePlayground } from '../../context/PlaygroundContext';

export function SearchBar() {
  const { state, setSearchQuery } = usePlayground();

  return (
    <div className="searchbar">
      <SearchIcon />
      <input
        type="text"
        className="searchbar-input"
        placeholder="Search demos..."
        value={state.searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      {state.searchQuery && (
        <button
          className="searchbar-clear"
          onClick={() => setSearchQuery('')}
          title="Clear search"
        >
          <ClearIcon />
        </button>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      className="searchbar-icon"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="6" cy="6" r="4.5" />
      <line x1="9.5" y1="9.5" x2="13" y2="13" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="currentColor"
    >
      <path d="M9.5 3.2L8.8 2.5 6 5.3 3.2 2.5l-.7.7L5.3 6 2.5 8.8l.7.7L6 6.7l2.8 2.8.7-.7L6.7 6l2.8-2.8z" />
    </svg>
  );
}
