import { useState, useEffect, useRef } from 'react';

export default function AuthorSearch({ initialName, onSelect }) {
  const [query, setQuery] = useState(initialName || '');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [noMatch, setNoMatch] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!query.trim() || selected) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/contentful/authors?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to load authors');
        }
        const authorResults = Array.isArray(data) ? data : [];
        setResults(authorResults);
        setShowDropdown(true);
        setNoMatch(authorResults.length === 0);
        setError('');
      } catch {
        setResults([]);
        setShowDropdown(false);
        setNoMatch(false);
        setError('Author lookup unavailable');
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query, selected]);

  function handleSelect(author) {
    setSelected(author);
    setQuery(author.name);
    setShowDropdown(false);
    setNoMatch(false);
    setError('');
    onSelect(author);
  }

  function handleClear() {
    setSelected(null);
    setQuery('');
    setNoMatch(false);
    setError('');
    onSelect(null);
  }

  return (
    <div className="author-search">
      <label>Author</label>
      <div className="author-input-wrapper">
        <input
          type="text"
          placeholder="Search for author..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(null);
            onSelect(null);
          }}
        />
        {selected && (
          <button type="button" className="btn-clear" onClick={handleClear}>
            &times;
          </button>
        )}
      </div>

      {showDropdown && results.length > 0 && (
        <ul className="author-dropdown">
          {results.map((a) => (
            <li key={a.id} onClick={() => handleSelect(a)}>
              {a.name}
            </li>
          ))}
        </ul>
      )}

      {noMatch && !selected && query.trim() && (
        <div className="warning-banner">
          Author not found in Contentful — you'll need to create them manually.
        </div>
      )}

      {error && !selected && (
        <div className="warning-banner">
          {error}
        </div>
      )}
    </div>
  );
}
