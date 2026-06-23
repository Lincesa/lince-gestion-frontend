import { useEffect, useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '@/store';
import { useCanPerform } from '@/hooks/useCanPerform';
import { ModuleKey } from '@/types/auth.types';
import { fetchFollowUpEvents, completeFollowUpEvent } from '@/store/crm/analyticsSlice';

const ASESORES = ['EZEQUIEL', 'DENIS', 'MARTIN', 'JULIAN', 'SIN_ASIGNAR'];
const FOLLOW_STATUSES = ['READY', 'SCHEDULED', 'COMPLETED', 'CANCELLED'];

function getStatusBadge(status: string) {
  const classes: Record<string, string> = {
    READY: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    SCHEDULED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    COMPLETED: 'bg-muted text-muted-foreground',
    CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  const labels: Record<string, string> = {
    READY: 'Listo',
    SCHEDULED: 'Programado',
    COMPLETED: 'Completado',
    CANCELLED: 'Cancelado',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${classes[status] ?? ''}`}>
      {labels[status] ?? status}
    </span>
  );
}

function formatScheduled(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function FollowUpEventsWidget() {
  const dispatch = useAppDispatch();
  const { followUpEvents, loading } = useAppSelector((s) => s.analytics);
  const { canEdit } = useCanPerform(ModuleKey.CRM);
  const [assignedTo, setAssignedTo] = useState('');
  const [followStatus, setFollowStatus] = useState('READY');
  const [completingId, setCompletingId] = useState<string | null>(null);

  useEffect(() => {
    void dispatch(fetchFollowUpEvents({
      assignedTo: assignedTo || undefined,
      status: followStatus || undefined,
    }));
  }, [dispatch, assignedTo, followStatus]);

  async function handleComplete(id: string) {
    setCompletingId(id);
    try {
      await dispatch(completeFollowUpEvent(id)).unwrap();
      toast.success('Evento completado');
    } catch {
      toast.error('Error al completar evento');
    } finally {
      setCompletingId(null);
    }
  }

  return (
    <div className="bg-card border border-border rounded-lg">
      {/* Header con filtros */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border">
        <h3 className="text-sm font-medium text-foreground">Seguimiento de clientes</h3>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">Todos los asesores</option>
            {ASESORES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select
            value={followStatus}
            onChange={(e) => setFollowStatus(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {FOLLOW_STATUSES.map((s) => (
              <option key={s} value={s}>
                {{ READY: 'Listo', SCHEDULED: 'Programado', COMPLETED: 'Completado', CANCELLED: 'Cancelado' }[s] ?? s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="p-4 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse bg-muted rounded" />
          ))}
        </div>
      ) : followUpEvents.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">No hay eventos para mostrar.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Cliente</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Estado</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground hidden sm:table-cell">Producto</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground hidden md:table-cell">Asesor</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground hidden lg:table-cell">Programado</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground hidden lg:table-cell">Mensaje</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {followUpEvents.map((event) => (
                <tr key={event.id} className="hover:bg-muted/50">
                  <td className="px-4 py-2 text-foreground">
                    {[event.customerName, event.customerLastName].filter(Boolean).join(' ') || event.customerPhone || '—'}
                  </td>
                  <td className="px-4 py-2">{getStatusBadge(event.status)}</td>
                  <td className="px-4 py-2 text-muted-foreground hidden sm:table-cell">{event.product ?? '—'}</td>
                  <td className="px-4 py-2 text-muted-foreground hidden md:table-cell">{event.assignedTo ?? '—'}</td>
                  <td className="px-4 py-2 text-muted-foreground whitespace-nowrap hidden lg:table-cell">
                    {formatScheduled(event.scheduledFor)}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground max-w-[180px] hidden lg:table-cell">
                    <span title={event.message} className="truncate block">
                      {event.message.length > 50 ? `${event.message.slice(0, 50)}...` : event.message}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {(event.status === 'READY' || event.status === 'SCHEDULED') && canEdit && (
                      <button
                        disabled={completingId === event.id}
                        onClick={() => void handleComplete(event.id)}
                        className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50"
                      >
                        <CheckCircle className="h-3 w-3" />
                        <span className="hidden sm:inline">Completar</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
