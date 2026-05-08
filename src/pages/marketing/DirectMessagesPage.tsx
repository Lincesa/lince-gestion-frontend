import { useEffect, useState } from 'react';
import { RefreshCw, Send } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchDirectMessages, fetchTemplates } from '@/store/marketing/campaignsSlice';
import { Button } from '@/components/ui/Button';
import { SendSingleModal } from './SendSingleModal';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const ADVISOR_CLASSES: Record<string, string> = {
  EZEQUIEL: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  DENIS: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  MARTIN: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  JULIAN: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

export function DirectMessagesPage() {
  const dispatch = useAppDispatch();
  const { directMessages, loadingDirectMessages, templates, loadingTemplates } =
    useAppSelector((s) => s.marketing);
  const [showSendSingle, setShowSendSingle] = useState(false);

  useEffect(() => {
    void dispatch(fetchDirectMessages());
  }, [dispatch]);

  useEffect(() => {
    if (showSendSingle && templates.length === 0) {
      void dispatch(fetchTemplates());
    }
  }, [dispatch, showSendSingle, templates.length]);

  function handleRefresh() {
    void dispatch(fetchDirectMessages());
  }

  function handleAfterSend() {
    setShowSendSingle(false);
    void dispatch(fetchDirectMessages());
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Mensajes directos</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Historial de envíos puntuales a números individuales
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            title="Actualizar"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <Button size="sm" onClick={() => setShowSendSingle(true)}>
            <Send className="h-4 w-4 mr-1.5" />
            Envío rápido
          </Button>
        </div>
      </div>

      {loadingDirectMessages ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse bg-muted rounded-lg" />
          ))}
        </div>
      ) : directMessages.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-10 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            No hay envíos directos registrados todavía.
          </p>
          <Button size="sm" onClick={() => setShowSendSingle(true)}>
            <Send className="h-4 w-4 mr-1.5" />
            Hacer primer envío
          </Button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Teléfono</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Asesor</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Plantilla</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">ID YCloud</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {directMessages.map((m) => (
                  <tr key={m.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 font-mono text-sm text-foreground">{m.phone}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ADVISOR_CLASSES[m.advisor] ?? 'bg-muted text-muted-foreground'}`}>
                        {m.advisor}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <span>{m.templateName}</span>
                      <span className="ml-1.5 text-xs text-muted-foreground/60">{m.templateLanguage}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs hidden md:table-cell">
                      {m.yCloudMessageId}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {formatDate(m.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showSendSingle && (
        <SendSingleModal
          templates={templates}
          loadingTemplates={loadingTemplates}
          onClose={handleAfterSend}
        />
      )}
    </div>
  );
}
