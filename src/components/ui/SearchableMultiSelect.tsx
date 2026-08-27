import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import type { SearchableSelectOption } from '@/components/ui/SearchableSelect';

interface SearchableMultiSelectProps {
  values?: string[];
  options: SearchableSelectOption[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
}

const inputClass =
  'w-full rounded-md border border-border bg-background pl-3 pr-8 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50';

export function SearchableMultiSelect({
  values = [],
  options,
  onChange,
  placeholder = 'Buscar…',
  emptyLabel = 'Todos',
  disabled = false,
  className = '',
}: SearchableMultiSelectProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedSet = useMemo(() => new Set(values), [values]);

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
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  const displayValue = useMemo(() => {
    if (values.length === 0) return '';
    if (values.length === 1) {
      return options.find((o) => o.value === values[0])?.label ?? values[0];
    }
    return `${values.length} seleccionados`;
  }, [options, values]);

  function toggle(option: SearchableSelectOption) {
    if (selectedSet.has(option.value)) {
      onChange(values.filter((v) => v !== option.value));
      return;
    }
    onChange([...values, option.value]);
  }

  function clearAll() {
    onChange([]);
    setQuery('');
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
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter' && filtered[highlighted]) {
      e.preventDefault();
      toggle(filtered[highlighted]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={`relative min-w-0 ${className}`}>
      <input
        type="text"
        value={open ? query : displayValue}
        placeholder={values.length ? displayValue : placeholder}
        disabled={disabled}
        className={inputClass}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlighted(0);
        }}
        onFocus={() => { if (!disabled) setOpen(true); }}
        onKeyDown={handleKeyDown}
      />
      {values.length > 0 ? (
        <button
          type="button"
          tabIndex={-1}
          onClick={clearAll}
          className="absolute right-7 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
          aria-label="Limpiar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : (
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      )}
      {open && (
        <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-card shadow-lg">
          <li
            className="cursor-pointer border-b border-border px-3 py-2 text-sm text-muted-foreground hover:bg-accent/70"
            onMouseDown={clearAll}
          >
            {emptyLabel}
          </li>
          {filtered.map((option, i) => {
            const checked = selectedSet.has(option.value);
            return (
              <li
                key={option.value}
                className={[
                  'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm',
                  i === highlighted
                    ? 'bg-accent text-accent-foreground'
                    : 'text-foreground hover:bg-accent/70',
                ].join(' ')}
                onMouseDown={() => toggle(option)}
                onMouseEnter={() => setHighlighted(i)}
              >
                <span className={`flex h-4 w-4 items-center justify-center rounded border ${checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>
                  {checked && <Check className="h-3 w-3" />}
                </span>
                <span className="min-w-0 truncate">{option.label}</span>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">Sin coincidencias</li>
          )}
        </ul>
      )}
    </div>
  );
}
