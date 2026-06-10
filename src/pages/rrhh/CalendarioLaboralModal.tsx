import { useState } from 'react';
import { X, CalendarDays, UsersRound } from 'lucide-react';
import { FeriadosTab } from './calendar/FeriadosTab';
import { AusenciasTab } from './calendar/AusenciasTab';

type Tab = 'feriados' | 'ausencias';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CalendarioLaboralModal({ open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('feriados');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-50 w-full max-w-4xl bg-card rounded-lg border shadow-xl my-4">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Calendario laboral
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Gestioná feriados, días no laborables y ausencias por empleado.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-accent"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 pt-4">
          <div className="inline-flex rounded-md border border-border p-0.5 bg-muted/40">
            <button
              type="button"
              onClick={() => setTab('feriados')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded transition ${
                tab === 'feriados'
                  ? 'bg-card shadow-sm font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Feriados y días marcados
            </button>
            <button
              type="button"
              onClick={() => setTab('ausencias')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded transition ${
                tab === 'ausencias'
                  ? 'bg-card shadow-sm font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <UsersRound className="h-3.5 w-3.5" />
              Ausencias por empleado
            </button>
          </div>
        </div>

        <div className="p-4">
          {tab === 'feriados' ? <FeriadosTab /> : <AusenciasTab />}
        </div>
      </div>
    </div>
  );
}
