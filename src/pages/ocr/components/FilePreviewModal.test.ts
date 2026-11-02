import { describe, expect, it } from 'vitest';
import { DocumentStatus } from '@/types/ocr.types';
import { rotationSaveBlockedReason } from './FilePreviewModal';

// The API refuses to replace the file of a PENDIENTE or PROCESANDO document:
// the driver's app may still re-upload the original, or OCR is reading it.
describe('rotationSaveBlockedReason', () => {
  it('blocks saving while the upload is not confirmed (PENDIENTE)', () => {
    expect(rotationSaveBlockedReason(DocumentStatus.PENDIENTE)).toMatch(/subiendo/);
  });

  it('blocks saving while OCR is running (PROCESANDO)', () => {
    expect(rotationSaveBlockedReason(DocumentStatus.PROCESANDO)).toMatch(/procesando/);
  });

  it('allows saving once the document settled, as before', () => {
    for (const status of [
      DocumentStatus.REVISION_PENDIENTE,
      DocumentStatus.CON_ERRORES,
      undefined,
    ]) {
      expect(rotationSaveBlockedReason(status)).toBeNull();
    }
  });
});
