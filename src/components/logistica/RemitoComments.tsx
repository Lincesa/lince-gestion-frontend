/**
 * RemitoComments — hilo de comentarios de un remito (autor + fecha), del más viejo al más nuevo.
 * Presentational: the container (RemitoCommentsSection) loads and sends.
 */
import { useMemo, useState, type KeyboardEvent } from 'react';
import { AlertCircle, Loader2, MessageSquare, Send } from 'lucide-react';
import type { RemitoComment } from '@/types/ocr.types';
import { COMMENT_BODY_MAX, formatEsArDateTime } from '@/utils/remitoAnnul';

interface Props {
  comments:   RemitoComment[];
  loading:    boolean;
  error:      string | null;
  /** Read-only viewers get the thread without the composer. */
  canComment: boolean;
  sending:    boolean;
  sendError:  string | null;
  /** Resolves true when saved; the composer then clears its draft. */
  onSend:     (body: string) => Promise<boolean> | boolean | void;
}

export function RemitoComments({
  comments,
  loading,
  error,
  canComment,
  sending,
  sendError,
  onSend,
}: Props) {
  const [draft, setDraft] = useState('');
  const ordered = useMemo(
    () => [...comments].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [comments],
  );
  const canSend = draft.trim().length > 0 && !sending;

  const submit = async () => {
    if (!canSend) return;
    const ok = await onSend(draft);
    if (ok) setDraft('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <section className="space-y-2 border-t border-border pt-3">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-xs font-medium text-muted-foreground">Comentarios</h3>
        {!loading && !error && ordered.length > 0 && (
          <span className="text-xs text-muted-foreground">({ordered.length})</span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Cargando comentarios…
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          No se pudieron cargar los comentarios.
        </div>
      ) : ordered.length === 0 ? (
        <p className="py-1 text-xs text-muted-foreground">Todavía no hay comentarios</p>
      ) : (
        <ul className="space-y-2">
          {ordered.map((c) => (
            <li key={c.id} className="rounded-md border border-border bg-muted/30 px-3 py-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                <span className="text-xs font-medium text-foreground">{c.authorName}</span>
                <time dateTime={c.createdAt} className="text-[11px] text-muted-foreground">
                  {formatEsArDateTime(c.createdAt)}
                </time>
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      {canComment && !error && (
        <div className="space-y-1.5">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribí un comentario…"
            aria-label="Nuevo comentario"
            maxLength={COMMENT_BODY_MAX}
            rows={2}
            disabled={sending}
            className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
          />
          {sendError && (
            <p role="alert" className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {sendError}
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="hidden text-[11px] text-muted-foreground sm:inline">Ctrl + Enter para enviar</span>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!canSend}
              className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Comentar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
