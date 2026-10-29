import { SupportingPhotos } from './SupportingPhotos';
import { useAttachments, type AttachmentsFetcher } from '@/hooks/useAttachments';

interface Props {
  /** Remito / OCR document id. The list is refetched whenever it changes. */
  id:                   string;
  /** Stable API function: OCR or logistica endpoint depending on the host view. */
  fetchAttachments:     AttachmentsFetcher;
  onPreviewOpenChange?: (open: boolean) => void;
}

/** Container: loads the supporting photos and hands them to the presentational gallery. */
export function SupportingPhotosSection({ id, fetchAttachments, onPreviewOpenChange }: Props) {
  const { attachments, loading, error } = useAttachments(id, fetchAttachments);
  return (
    <SupportingPhotos
      attachments={attachments}
      loading={loading}
      error={error}
      onPreviewOpenChange={onPreviewOpenChange}
    />
  );
}
