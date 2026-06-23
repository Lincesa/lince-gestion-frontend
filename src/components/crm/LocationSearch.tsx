import { useState, useRef, useEffect, useCallback } from 'react';
import { searchGeo } from '@/api/crm';
import type { GeoResult } from '@/types/crm.types';

interface LocationSearchProps {
  value?: GeoResult | null;
  onSelect: (result: GeoResult | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function LocationSearch({ value, onSelect, placeholder = 'Buscar localidad...', disabled = false }: LocationSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayValue = value
    ? [value.localidad, value.provincia].filter(Boolean).join(', ')
    : '';

  useEffect(() => {
    setQuery(displayValue);
  }, [displayValue]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 3) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const data = await searchGeo(q, 6);
      setResults(data);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    if (value) onSelect(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void search(v), 500);
    setHighlighted(0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[highlighted]) {
        onSelect(results[highlighted]);
        setQuery(results[highlighted].label);
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60 disabled:cursor-default"
        onChange={handleChange}
        onFocus={() => { if (!disabled && results.length > 0) setOpen(true); }}
        onKeyDown={handleKeyDown}
      />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-md border border-border bg-card shadow-md max-h-56 overflow-auto">
          {results.map((r, i) => (
            <li
              key={r.id}
              className={[
                'px-3 py-2 text-sm cursor-pointer',
                i === highlighted
                  ? 'bg-accent text-accent-foreground'
                  : 'text-foreground hover:bg-accent hover:text-accent-foreground',
              ].join(' ')}
              onMouseDown={() => {
                onSelect(r);
                setQuery(r.label);
                setOpen(false);
              }}
              onMouseEnter={() => setHighlighted(i)}
            >
              <span className="font-medium">{r.localidad}</span>
              {r.provincia && (
                <span className="ml-1 text-muted-foreground">{r.provincia}</span>
              )}
              {r.pais && r.pais !== 'Argentina' && (
                <span className="ml-1 text-muted-foreground text-xs">· {r.pais}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
