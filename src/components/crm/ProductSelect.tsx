import { useState, useRef, useEffect, KeyboardEvent } from 'react';

const PRODUCTOS = [
  'Bloque de Melaza Pipo',
  'Bloque de Melaza Pipo Bovino 18%',
  'Bloque de Melaza Pipo Ovino 18%',
  'Bloque de Melaza Pipo Caprino',
  'Levadura',
  'Mela Dry',
  'Concentrado de Proteina de Soja - Feed Grade',
  'Fosforo de Origen Vegetal',
  'Levadura de Cerveza',
  'Melaza de Cana',
  'Gluten Feed Pellet',
  'Burlanda de Maiz',
  'Burlanda de Maiz (Seco)',
  'Malta Humeda',
  'Cascara de Citrus',
  'Germen de Maiz',
  'Solubles de Destileria Concentrados',
];

interface ProductSelectProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ProductSelect({ value, onChange, placeholder = 'Buscar producto...', disabled = false }: ProductSelectProps) {
  const [query, setQuery] = useState(value ?? '');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = PRODUCTOS.filter((p) =>
    p.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    setQuery(value ?? '');
  }, [value]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlighted]) {
        onChange(filtered[highlighted]);
        setQuery(filtered[highlighted]);
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
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          setOpen(true);
          setHighlighted(0);
        }}
        onFocus={() => { if (!disabled) setOpen(true); }}
        onKeyDown={handleKeyDown}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-md border border-border bg-card shadow-md max-h-56 overflow-auto">
          {filtered.map((p, i) => (
            <li
              key={p}
              className={[
                'px-3 py-2 text-sm cursor-pointer',
                i === highlighted
                  ? 'bg-accent text-accent-foreground'
                  : 'text-foreground hover:bg-accent hover:text-accent-foreground',
              ].join(' ')}
              onMouseDown={() => {
                onChange(p);
                setQuery(p);
                setOpen(false);
              }}
              onMouseEnter={() => setHighlighted(i)}
            >
              {p}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
