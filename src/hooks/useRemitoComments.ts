import { useCallback, useEffect, useRef, useState } from 'react';
import type { RemitoComment } from '@/types/ocr.types';

export type CommentsFetcher = (id: string) => Promise<RemitoComment[]>;
export type CommentPoster = (id: string, body: string) => Promise<RemitoComment>;

interface RemitoCommentsState {
  comments:  RemitoComment[];
  loading:   boolean;
  error:     string | null;
  sending:   boolean;
  sendError: string | null;
  /** Resolves true when the comment was saved, so the composer can clear itself. */
  send:      (body: string) => Promise<boolean>;
}

function byCreatedAt(a: RemitoComment, b: RemitoComment): number {
  return a.createdAt.localeCompare(b.createdAt);
}

/**
 * Loads a remito's comment thread every time `id` changes and appends new comments
 * without refetching. Pass stable `fetcher` / `poster` functions (module-level API
 * functions) to avoid refetch loops.
 */
export function useRemitoComments(
  id: string | null | undefined,
  fetcher: CommentsFetcher,
  poster: CommentPoster,
): RemitoCommentsState {
  const [comments, setComments] = useState<RemitoComment[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [sending, setSending]   = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const currentId = useRef(id);

  useEffect(() => {
    currentId.current = id;
    setComments([]);
    setError(null);
    setSendError(null);
    setSending(false);
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetcher(id)
      .then((list) => {
        if (!cancelled) setComments([...list].sort(byCreatedAt));
      })
      .catch((err: unknown) => {
        if (!cancelled) setError((err as Error)?.message || 'Error al cargar los comentarios');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id, fetcher]);

  const send = useCallback(async (body: string): Promise<boolean> => {
    const text = body.trim();
    if (!id || !text) return false;
    setSending(true);
    setSendError(null);
    try {
      const created = await poster(id, text);
      // The user may have moved to another remito while the request was in flight.
      if (currentId.current !== id) return false;
      setComments((prev) => [...prev, created].sort(byCreatedAt));
      return true;
    } catch (err) {
      if (currentId.current === id) {
        setSendError((err as Error)?.message || 'No se pudo enviar el comentario');
      }
      return false;
    } finally {
      if (currentId.current === id) setSending(false);
    }
  }, [id, poster]);

  return { comments, loading, error, sending, sendError, send };
}
