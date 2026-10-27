import type { OcrDocument } from '@/types/ocr.types';

/**
 * Who uploaded a document: the driver declared in the mobile app (all drivers share
 * one company account), otherwise the account that uploaded it from the web.
 */
export function formatUploader(doc: Partial<Pick<OcrDocument, 'driverName' | 'uploadedByName'>>): string {
  return doc.driverName?.trim() || doc.uploadedByName?.trim() || '—';
}
