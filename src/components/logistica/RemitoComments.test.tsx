import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { RemitoComment } from '@/types/ocr.types';
import { RemitoComments } from './RemitoComments';

function comment(id: string, authorName: string, body: string, createdAt: string): RemitoComment {
  return { id, documentId: 'doc-1', body, authorId: `user-${id}`, authorName, createdAt };
}

const noop = vi.fn();

describe('RemitoComments', () => {
  it('renders each comment with its author and body, oldest first', () => {
    const html = renderToStaticMarkup(
      <RemitoComments
        comments={[
          comment('c2', 'Bruno', 'Segundo', '2026-10-29T12:00:00.000Z'),
          comment('c1', 'Ana', 'Primero\nlinea dos', '2026-10-29T10:00:00.000Z'),
        ]}
        loading={false}
        error={null}
        canComment
        sending={false}
        sendError={null}
        onSend={noop}
      />,
    );

    expect(html).toContain('Comentarios');
    expect(html).toContain('Ana');
    expect(html).toContain('Bruno');
    expect(html).toContain('whitespace-pre-wrap');
    expect(html.indexOf('Primero')).toBeLessThan(html.indexOf('Segundo'));
    expect(html).not.toContain('Todavía no hay comentarios');
  });

  it('renders the empty state and the composer', () => {
    const html = renderToStaticMarkup(
      <RemitoComments
        comments={[]}
        loading={false}
        error={null}
        canComment
        sending={false}
        sendError={null}
        onSend={noop}
      />,
    );

    expect(html).toContain('Todavía no hay comentarios');
    expect(html).toContain('placeholder="Escribí un comentario…"');
    expect(html).toContain('maxLength="2000"');
    expect(html).toContain('Comentar');
  });

  it('hides the composer for read-only viewers', () => {
    const html = renderToStaticMarkup(
      <RemitoComments
        comments={[]}
        loading={false}
        error={null}
        canComment={false}
        sending={false}
        sendError={null}
        onSend={noop}
      />,
    );

    expect(html).not.toContain('<textarea');
    expect(html).not.toContain('Comentar<');
  });

  it('shows an inline error when the thread failed to load', () => {
    const html = renderToStaticMarkup(
      <RemitoComments
        comments={[]}
        loading={false}
        error="boom"
        canComment
        sending={false}
        sendError={null}
        onSend={noop}
      />,
    );

    expect(html).toContain('No se pudieron cargar los comentarios');
    expect(html).not.toContain('Todavía no hay comentarios');
  });
});
