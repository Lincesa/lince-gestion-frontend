import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { OcrAttachment } from '@/types/ocr.types';
import { SupportingPhotos } from './SupportingPhotos';

function attachment(id: string): OcrAttachment {
  return {
    id,
    documentId: 'doc-1',
    contentType: 'image/jpeg',
    uploadedBy: 'user-1',
    createdAt: '2026-10-29T10:00:00.000Z',
    confirmedAt: '2026-10-29T10:00:05.000Z',
    viewUrl: `https://s3.test/${id}.jpg`,
  };
}

describe('SupportingPhotos', () => {
  it('renders one thumbnail per attachment under the section title', () => {
    const html = renderToStaticMarkup(
      <SupportingPhotos
        attachments={[attachment('a1'), attachment('a2')]}
        loading={false}
        error={null}
      />,
    );

    expect(html).toContain('Documentación de respaldo');
    expect(html).toContain('src="https://s3.test/a1.jpg"');
    expect(html).toContain('src="https://s3.test/a2.jpg"');
    expect(html).not.toContain('Sin documentación de respaldo');
  });

  it('renders the empty state when there are no attachments', () => {
    const html = renderToStaticMarkup(
      <SupportingPhotos attachments={[]} loading={false} error={null} />,
    );

    expect(html).toContain('Documentación de respaldo');
    expect(html).toContain('Sin documentación de respaldo');
    expect(html).not.toContain('<img');
  });

  it('renders an inline error instead of the list when the request failed', () => {
    const html = renderToStaticMarkup(
      <SupportingPhotos attachments={[]} loading={false} error="boom" />,
    );

    expect(html).toContain('No se pudo cargar la documentación de respaldo');
    expect(html).not.toContain('Sin documentación de respaldo');
  });

  it('shows neither the empty state nor thumbnails while loading', () => {
    const html = renderToStaticMarkup(
      <SupportingPhotos attachments={[]} loading error={null} />,
    );

    expect(html).toContain('Cargando documentación de respaldo');
    expect(html).not.toContain('Sin documentación de respaldo');
  });
});
