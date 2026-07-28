import { CheckCircle, Clock, AlertTriangle, XCircle } from 'lucide-react';
import { DocumentStatus } from '@/types/ocr.types';

const CONFIG: Record<DocumentStatus, { label: string; className: string; icon: React.ReactNode }> = {
  PENDIENTE:          { label: 'Pendiente',    className: 'bg-amber-500/15 text-amber-700 dark:text-amber-200 ring-1 ring-amber-500/25',   icon: <Clock className="h-3 w-3" /> },
  PROCESANDO:         { label: 'Procesando',   className: 'bg-blue-500/15 text-blue-700 dark:text-blue-200 ring-1 ring-blue-500/25',            icon: <Clock className="h-3 w-3 animate-spin" /> },
  VALIDO:             { label: 'Válido',        className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 ring-1 ring-emerald-500/25',       icon: <CheckCircle className="h-3 w-3" /> },
  CON_ERRORES:        { label: 'Con errores',   className: 'bg-red-500/15 text-red-700 dark:text-red-200 ring-1 ring-red-500/25',              icon: <AlertTriangle className="h-3 w-3" /> },
  REVISION_PENDIENTE: { label: 'En revisión',   className: 'bg-orange-500/15 text-orange-700 dark:text-orange-200 ring-1 ring-orange-500/25',  icon: <Clock className="h-3 w-3" /> },
  REVISADO:           { label: 'Revisado',      className: 'bg-violet-500/15 text-violet-700 dark:text-violet-200 ring-1 ring-violet-500/25',  icon: <CheckCircle className="h-3 w-3" /> },
  APROBADO:           { label: 'Aprobado',      className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 ring-1 ring-emerald-500/25',      icon: <CheckCircle className="h-3 w-3" /> },
  RECHAZADO:          { label: 'Rechazado',     className: 'bg-red-500/15 text-red-700 dark:text-red-200 ring-1 ring-red-500/25',              icon: <XCircle className="h-3 w-3" /> },
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  const c = CONFIG[status] ?? CONFIG.PROCESANDO;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.className}`}>
      {c.icon} {c.label}
    </span>
  );
}
