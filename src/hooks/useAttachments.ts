import { useEffect, useState } from 'react';
import type { OcrAttachment } from '@/types/ocr.types';

export type AttachmentsFetcher = (id: string) => Promise<OcrAttachment[]>;

interface AttachmentsState {
  attachments: OcrAttachment[];
  loading:     boolean;
  error:       string | null;
}

/**
 * Loads a remito's supporting photos every time `id` changes.
 * The viewUrls are presigned and expire, so the list is never cached across opens.
 * Pass a stable `fetcher` (a module-level API function) to avoid refetch loops.
 */
export function useAttachments(id: string | null | undefined, fetcher: AttachmentsFetcher): AttachmentsState {
  const [state, setState] = useState<AttachmentsState>({ attachments: [], loading: false, error: null });

  useEffect(() => {
    if (!id) {
      setState({ attachments: [], loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState({ attachments: [], loading: true, error: null });
    fetcher(id)
      .then((attachments) => {
        if (!cancelled) setState({ attachments, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            attachments: [],
            loading:     false,
            error:       (err as Error)?.message || 'Error al cargar la documentación de respaldo',
          });
        }
      });
    return () => { cancelled = true; };
  }, [id, fetcher]);

  return state;
}
