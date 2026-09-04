import { useEffect, useRef, useState } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';

// A type-to-filter dropdown over an already-loaded `options` array — no new
// API calls, just client-side filtering of data the page already fetched.
// options: [{ value, label, sublabel? }]
export default function SearchableSelect({ options, value, onChange, placeholder = 'Search...', disabled }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);

  const selected = options.find((o) => o.value === value) || null;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = query
    ? options.filter((o) => `${o.label} ${o.sublabel || ''}`.toLowerCase().includes(query.toLowerCase()))
    : options;

  return (
    <div className="searchable-select" ref={rootRef}>
      <div className={`searchable-select-control${disabled ? ' is-disabled' : ''}`} onClick={() => !disabled && setOpen(true)}>
        <Search size={14} className="searchable-select-icon" />
        {open ? (
          <input
            autoFocus
            className="searchable-select-input"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={disabled}
          />
        ) : (
          <span className={`searchable-select-value${selected ? '' : ' is-placeholder'}`}>
            {selected ? selected.label : placeholder}
          </span>
        )}
        {selected && !open && (
          <button
            type="button"
            className="searchable-select-clear"
            aria-label="Clear selection"
            onClick={(e) => { e.stopPropagation(); onChange(''); }}
          >
            <X size={12} />
          </button>
        )}
        <ChevronDown size={14} className="searchable-select-chevron" />
      </div>
      {open && (
        <div className="searchable-select-menu">
          {filtered.length === 0 ? (
            <div className="searchable-select-empty">No matches</div>
          ) : (
            filtered.map((o) => (
              <button
                type="button"
                key={o.value}
                className={`searchable-select-option${o.value === value ? ' is-selected' : ''}`}
                onClick={() => { onChange(o.value); setQuery(''); setOpen(false); }}
              >
                <span>{o.label}</span>
                {o.sublabel && <span className="searchable-select-sublabel">{o.sublabel}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
