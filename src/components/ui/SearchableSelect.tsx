import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown, X } from 'lucide-react';

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  value?: string;
  options: SearchableSelectOption[];
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
}

const inputClass =
  'w-full rounded-md border border-border bg-background pl-3 pr-8 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50';

export function SearchableSelect({
  value,
  options,
  onChange,
  placeholder = 'Buscar…',
  emptyLabel = 'Todos',
  disabled = false,
  className = '',
}: SearchableSelectProps) {
  const selected = options.find((o) => o.value === value);
  const [query, setQuery] = useState(selected?.label ?? '');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(selected?.label ?? '');
  }, [selected?.label]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || (selected && query === selected.label)) {
      return options;
    }
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  }, [options, query, selected]);

  const listItems = useMemo(
    () => [{ value: '', label: emptyLabel }, ...filtered],
    [emptyLabel, filtered],
  );

  function pick(option: SearchableSelectOption) {
    if (!option.value) {
      onChange(undefined);
      setQuery('');
    } else {
      onChange(option.value);
      setQuery(option.label);
    }
    setOpen(false);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      return;
    }
    if (!open) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, listItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (listItems[highlighted]) pick(listItems[highlighted]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={`relative min-w-0 ${className}`}>
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        disabled={disabled}
        className={inputClass}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlighted(0);
          if (!e.target.value.trim()) onChange(undefined);
        }}
        onFocus={() => { if (!disabled) setOpen(true); }}
        onKeyDown={handleKeyDown}
      />
      {value ? (
        <button
          type="button"
          tabIndex={-1}
          onClick={() => pick({ value: '', label: emptyLabel })}
          className="absolute right-7 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
          aria-label="Limpiar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : (
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      )}
      {open && listItems.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-card shadow-lg">
          {listItems.map((option, i) => (
            <li
              key={option.value || '__all__'}
              className={[
                'cursor-pointer px-3 py-2 text-sm',
                i === highlighted
                  ? 'bg-accent text-accent-foreground'
                  : 'text-foreground hover:bg-accent/70',
                !option.value ? 'text-muted-foreground border-b border-border' : '',
              ].join(' ')}
              onMouseDown={() => pick(option)}
              onMouseEnter={() => setHighlighted(i)}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
      {open && listItems.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground shadow-lg">
          Sin coincidencias
        </div>
      )}
    </div>
  );
}
