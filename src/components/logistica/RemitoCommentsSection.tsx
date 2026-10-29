import { RemitoComments } from './RemitoComments';
import { useRemitoComments, type CommentPoster, type CommentsFetcher } from '@/hooks/useRemitoComments';

interface Props {
  /** Remito / OCR document id. The thread is refetched whenever it changes. */
  id:            string;
  /** Stable API functions: OCR or logistica endpoints depending on the host view. */
  fetchComments: CommentsFetcher;
  addComment:    CommentPoster;
  canComment:    boolean;
}

/** Container: loads the comment thread and hands it to the presentational list + composer. */
export function RemitoCommentsSection({ id, fetchComments, addComment, canComment }: Props) {
  const { comments, loading, error, sending, sendError, send } = useRemitoComments(id, fetchComments, addComment);
  return (
    <RemitoComments
      // A fresh composer per remito, so a draft never leaks into another remito.
      key={id}
      comments={comments}
      loading={loading}
      error={error}
      canComment={canComment}
      sending={sending}
      sendError={sendError}
      onSend={send}
    />
  );
}
