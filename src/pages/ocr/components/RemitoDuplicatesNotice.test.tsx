import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { RemitoDuplicate } from '@/types/ocr.types';
import { DuplicateBadge, RemitoDuplicatesNotice, formatDuplicateNumber } from './RemitoDuplicatesNotice';

const sameNumber: RemitoDuplicate = {
  id: 'b',
  reasons: ['same_number'],
  status: 'REVISADO' as RemitoDuplicate['status'],
  createdAt: '2026-11-17T17:30:00.000Z',
  driverName: 'Pérez',
  uploadedByName: 'Transporte Sur',
  uploadedByEmail: 'sur@x.com',
  ptoVenta: '0008',
  nroRemito: '00012345',
  fecha: '17/11/2026',
};

const sameFile: RemitoDuplicate = {
  ...sameNumber,
  id: 'c',
  reasons: ['same_file', 'same_number'],
  driverName: null,
  uploadedByName: 'Dueño',
};

describe('formatDuplicateNumber', () => {
  it('joins prefix and number, or says the number was not read', () => {
    expect(formatDuplicateNumber(sameNumber)).toBe('0008-00012345');
    expect(formatDuplicateNumber({ ...sameNumber, ptoVenta: null })).toBe('00012345');
    expect(formatDuplicateNumber({ ...sameNumber, ptoVenta: null, nroRemito: null })).toBe('Sin número');
  });
});

describe('RemitoDuplicatesNotice', () => {
  it('lists each possible duplicate with why it matched and who uploaded it', () => {
    const html = renderToStaticMarkup(
      <RemitoDuplicatesNotice duplicates={[sameNumber, sameFile]} duplicateAttempts={0} onOpen={vi.fn()} />,
    );
    expect(html).toContain('Posible duplicado');
    expect(html).toContain('0008-00012345');
    expect(html).toContain('Mismo número (leído por OCR)');
    expect(html).toContain('Misma foto, subida desde otra cuenta');
    expect(html).toContain('Pérez');
    expect(html).toContain('Dueño');
    expect(html).toContain('Abrir');
    expect(html).not.toContain('se intentó subir');
  });

  it('reports how many times the same photo was sent again', () => {
    const html = renderToStaticMarkup(
      <RemitoDuplicatesNotice duplicates={[]} duplicateAttempts={2} onOpen={vi.fn()} />,
    );
    expect(html).toContain('La misma foto se intentó subir 2 veces más');
    expect(html).not.toContain('Posible duplicado');
  });

  it('renders nothing when there is nothing to warn about', () => {
    const html = renderToStaticMarkup(
      <RemitoDuplicatesNotice duplicates={[]} duplicateAttempts={0} onOpen={vi.fn()} />,
    );
    expect(html).toBe('');
  });
});

describe('DuplicateBadge', () => {
  it('flags a row with possible duplicates and stays hidden otherwise', () => {
    expect(renderToStaticMarkup(<DuplicateBadge count={2} />)).toContain('Posible duplicado');
    expect(renderToStaticMarkup(<DuplicateBadge count={0} />)).toBe('');
  });
});
