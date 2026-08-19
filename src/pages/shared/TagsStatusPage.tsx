/**
 * TagsStatusPage — panel de control de tags (auto-suspensión + kill switch manual)
 *
 * Componente compartido entre OCR y Logística: misma UI, mismo TagsService de fondo
 * en el backend, controller distinto por módulo (ver OCR-TAGS-PANEL-SPEC.md).
 */

import { Fragment, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchTags, fetchTagEvents, suspendTag, reactivateTag } from '@/store/tags/tagsSlice';
import type { TagsModule, TagStatusEventType, UploadClient } from '@/types/tags.types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';

const EVENT_LABELS: Record<TagStatusEventType, string> = {
  AUTO_SUSPEND: 'Suspensión automática',
  MANUAL_SUSPEND: 'Suspensión manual',
  MANUAL_REACTIVATE: 'Reactivación manual',
};

/**
 * El panel lista todas las cuentas del área TAG, y ahí conviven watchers
 * automatizados con choferes que suben desde el celular. Sin distinguirlos, la
 * pantalla presenta a un chofer como si fuera una tag.
 */
const UPLOAD_CLIENT_LABELS: Record<UploadClient, { label: string; className: string }> = {
  WATCHER: {
    label: 'Watcher',
    className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  },
  MOBILE: {
    label: 'Celular',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  },
  WEB: {
    label: 'Web',
    className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
};

function UploadClientBadge({ client }: { client: UploadClient }) {
  const config = UPLOAD_CLIENT_LABELS[client] ?? UPLOAD_CLIENT_LABELS.WEB;
  return (
    <Badge variant="secondary" className={config.className}>
      {config.label}
    </Badge>
  );
}

interface TagsStatusPageProps {
  module: TagsModule;
}

export function TagsStatusPage({ module }: TagsStatusPageProps) {
  const dispatch = useAppDispatch();
  const { items, loading, events, eventsUserId, eventsLoading, submitting } = useAppSelector(
    (s) => s.tags,
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchTags(module));
  }, [dispatch, module]);

  const toggleExpand = (userId: string) => {
    if (expandedId === userId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(userId);
    dispatch(fetchTagEvents({ module, userId }));
  };

  const handleSuspend = async (userId: string, email: string) => {
    const reason = window.prompt(`¿Suspender la tag de ${email}? Motivo (opcional):`);
    if (reason === null) return; // cancelado
    try {
      await dispatch(suspendTag({ module, userId, reason: reason || undefined })).unwrap();
      toast.success('Tag suspendida');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleReactivate = async (userId: string, email: string) => {
    if (!window.confirm(`¿Reactivar la tag de ${email}?`)) return;
    const note = window.prompt('Nota (opcional):');
    try {
      await dispatch(reactivateTag({ module, userId, note: note || undefined })).unwrap();
      toast.success('Tag reactivada');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Tags</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Estado de las cuentas de carga. Solo las <strong>watcher</strong> se suspenden
          automáticamente ante un posible bucle de subidas: una persona que sube rápido —un chofer
          descargando su cola al recuperar señal, o una carga desde la web— no es un bucle. Todas,
          en cambio, tienen tope de volumen diario.
        </p>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Email</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                  No hay tags registradas.
                </TableCell>
              </TableRow>
            )}
            {items.map((tag) => {
              const isExpanded = expandedId === tag.id;
              const showingEvents = isExpanded && eventsUserId === tag.id;
              return (
                <Fragment key={tag.id}>
                  <TableRow>
                    <TableCell>
                      <button
                        onClick={() => toggleExpand(tag.id)}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Ver historial"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{tag.email}</TableCell>
                    <TableCell>
                      <UploadClientBadge client={tag.uploadClient} />
                    </TableCell>
                    <TableCell>
                      {tag.tagSuspended ? (
                        <Badge variant="destructive" className="gap-1">
                          <ShieldAlert className="h-3 w-3" /> Suspendida
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        >
                          <ShieldCheck className="h-3 w-3" /> Activa
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {tag.tagSuspendedReason ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {tag.tagSuspendedAt ? new Date(tag.tagSuspendedAt).toLocaleString('es-AR') : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {tag.tagSuspended ? (
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={submitting}
                          onClick={() => handleReactivate(tag.id, tag.email)}
                        >
                          Reactivar
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={submitting}
                          onClick={() => handleSuspend(tag.id, tag.email)}
                        >
                          Suspender
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={7} className="bg-muted/30">
                        {!showingEvents || eventsLoading ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Cargando historial…
                          </div>
                        ) : events.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-2">Sin eventos registrados.</p>
                        ) : (
                          <ul className="space-y-2 py-2">
                            {events.map((ev) => (
                              <li key={ev.id} className="text-sm">
                                <span className="font-medium text-foreground">
                                  {EVENT_LABELS[ev.eventType]}
                                </span>
                                {' — '}
                                <span className="text-muted-foreground">
                                  {new Date(ev.createdAt).toLocaleString('es-AR')}
                                </span>
                                {Object.keys(ev.detail).length > 0 && (
                                  <pre className="mt-1 text-xs text-muted-foreground bg-background/50 rounded p-2 overflow-x-auto">
                                    {JSON.stringify(ev.detail, null, 2)}
                                  </pre>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
