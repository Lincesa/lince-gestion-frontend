import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
vi.mock('./client', () => ({
  api: { get: (...args: unknown[]) => get(...args) },
  API_BASE_URL: 'http://api.test',
  apiFetch: vi.fn(),
  getAccessToken: () => null,
}));

const { getDocumentAttachments } = await import('./ocr');
const { logisticaApi } = await import('./logistica');

describe('supporting photo attachments API', () => {
  beforeEach(() => get.mockReset());

  it('lists a document attachments through the OCR endpoint', async () => {
    await getDocumentAttachments('doc-1');
    expect(get).toHaveBeenCalledWith('/ocr/documents/doc-1/attachments');
  });

  it('lists a remito attachments through the logistica endpoint', async () => {
    await logisticaApi.getRemitoAttachments('rem-1');
    expect(get).toHaveBeenCalledWith('/logistica/remitos/rem-1/attachments');
  });
});
