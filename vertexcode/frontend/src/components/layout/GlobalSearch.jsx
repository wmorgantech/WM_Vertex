import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import api from '@/api/axios';

const SECTION_LABELS = {
  employees: 'Employees',
  interns: 'Interns',
  trainees: 'Trainees',
  colleges: 'Colleges',
  tasks: 'Tasks',
  workshops: 'Workshops',
  mous: 'MOUs',
  trainingPrograms: 'Training Programs',
};

export default function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(null);
      return;
    }
    const timer = setTimeout(() => {
      api.get('/search', { params: { q: query.trim() } }).then(({ data }) => {
        setResults(data.data);
        setOpen(true);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (link) => {
    setOpen(false);
    setQuery('');
    navigate(link);
  };

  const sections = results ? Object.entries(results).filter(([, items]) => items.length > 0) : [];

  return (
    <div ref={containerRef} className="relative hidden w-72 sm:block">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query.trim().length >= 2 && setOpen(true)}
        placeholder="Search employees, tasks, colleges..."
        className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-8 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      {query && (
        <button className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => { setQuery(''); setResults(null); }}>
          <X className="size-4" />
        </button>
      )}

      {open && results && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-96 w-96 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md">
          {sections.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">No matches for "{query}"</p>
          ) : (
            sections.map(([key, items]) => (
              <div key={key} className="mb-1">
                <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{SECTION_LABELS[key] || key}</p>
                {items.map((item) => (
                  <button
                    key={item.id}
                    className="flex w-full flex-col items-start rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                    onClick={() => handleSelect(item.link)}
                  >
                    <span className="font-medium text-foreground">{item.label}</span>
                    {item.sub && <span className="text-xs text-muted-foreground">{item.sub}</span>}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
