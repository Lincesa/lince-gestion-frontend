import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const post = vi.fn();
const del = vi.fn();
vi.mock('./client', () => ({
  api: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
    delete: (...args: unknown[]) => del(...args),
  },
  API_BASE_URL: 'http://api.test',
  apiFetch: vi.fn(),
  getAccessToken: () => null,
}));

const ocr = await import('./ocr');
const { logisticaApi } = await import('./logistica');

describe('remito void and comments API', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    del.mockReset();
  });

  it('voids and unvoids an OCR document', async () => {
    await ocr.annulDocument('doc-1', 'Duplicado');
    expect(post).toHaveBeenCalledWith('/ocr/documents/doc-1/annul', { reason: 'Duplicado' });

    await ocr.unannulDocument('doc-1');
    expect(del).toHaveBeenCalledWith('/ocr/documents/doc-1/annul');
  });

  it('lists and adds OCR document comments', async () => {
    await ocr.getDocumentComments('doc-1');
    expect(get).toHaveBeenCalledWith('/ocr/documents/doc-1/comments');

    await ocr.addDocumentComment('doc-1', 'Hola');
    expect(post).toHaveBeenCalledWith('/ocr/documents/doc-1/comments', { body: 'Hola' });
  });

  it('voids and unvoids a logistica remito', async () => {
    await logisticaApi.annulRemito('rem-1', 'Mal cargado');
    expect(post).toHaveBeenCalledWith('/logistica/remitos/rem-1/annul', { reason: 'Mal cargado' });

    await logisticaApi.unannulRemito('rem-1');
    expect(del).toHaveBeenCalledWith('/logistica/remitos/rem-1/annul');
  });

  it('lists and adds logistica remito comments', async () => {
    await logisticaApi.getRemitoComments('rem-1');
    expect(get).toHaveBeenCalledWith('/logistica/remitos/rem-1/comments');

    await logisticaApi.addRemitoComment('rem-1', 'Chau');
    expect(post).toHaveBeenCalledWith('/logistica/remitos/rem-1/comments', { body: 'Chau' });
  });

  it('sends the annulled filter in the OCR and logistica list queries', async () => {
    await ocr.getDocuments({ annulled: 'only' });
    expect(get).toHaveBeenCalledWith('/ocr/documents?annulled=only');

    await logisticaApi.listRemitos({ page: 1, annulled: 'exclude' });
    expect(get).toHaveBeenCalledWith('/logistica/remitos?page=1&annulled=exclude');
  });

  it('keeps the logistica list query unchanged without the annulled filter', async () => {
    await logisticaApi.listRemitos({ page: 2, limit: 20 });
    expect(get).toHaveBeenCalledWith('/logistica/remitos?page=2&limit=20');
  });

  it('sends the annulled filter in the logistica export', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob()),
      headers: new Headers(),
    });
    vi.stubGlobal('fetch', fetchMock);
    await logisticaApi.exportRemitos({ annulled: 'only' });
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/logistica/remitos/export?annulled=only');
    vi.unstubAllGlobals();
  });
});
