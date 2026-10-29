import { describe, expect, it } from 'vitest';
import reducer, { annulmentChanged } from './documentsSlice';
import type { OcrDocument } from '@/types/ocr.types';

// Trello #84: voiding a remito patches only its void fields, so the detail form
// (keyed on extractedData) keeps unsaved edits and the list row turns red at once.

const extracted = { nroRemito: '00000001', cliente: 'La Anónima' };
const doc = {
  id: 'doc-1',
  extractedData: extracted,
  annulledAt: null,
  annulledBy: null,
  annulledByName: null,
  annulReason: null,
} as unknown as OcrDocument;

function stateWith() {
  const base = reducer(undefined, { type: 'init' });
  return { ...base, current: doc, all: { items: [doc, { ...doc, id: 'doc-2' }], total: 2, page: 1, pages: 1, limit: 20 } } as typeof base;
}

describe('annulmentChanged', () => {
  const voided = {
    id: 'doc-1',
    annulledAt: '2026-10-29T21:00:00.000Z',
    annulledBy: 'u-ops',
    annulledByName: 'Ana Operaciones',
    annulReason: 'Duplicado',
  };

  it('marca el detalle anulado sin tocar los datos leídos (el formulario no se reinicia)', () => {
    const next = reducer(stateWith(), annulmentChanged(voided));
    expect(next.current).toEqual(expect.objectContaining(voided));
    expect(next.current?.extractedData).toBe(extracted);
  });

  it('pinta la fila de la lista sin recargarla y deja las demás igual', () => {
    const next = reducer(stateWith(), annulmentChanged(voided));
    expect(next.all?.items[0]).toEqual(expect.objectContaining({ annulReason: 'Duplicado' }));
    expect(next.all?.items[1]).toEqual(expect.objectContaining({ id: 'doc-2', annulReason: null }));
  });

  it('desanular limpia los campos', () => {
    const voidedState = reducer(stateWith(), annulmentChanged(voided));
    const next = reducer(voidedState, annulmentChanged({
      id: 'doc-1', annulledAt: null, annulledBy: null, annulledByName: null, annulReason: null,
    }));
    expect(next.current).toEqual(expect.objectContaining({ annulledAt: null, annulReason: null }));
  });

  it('ignora un documento que no está abierto ni en la lista', () => {
    const before = stateWith();
    const next = reducer(before, annulmentChanged({ ...voided, id: 'otro' }));
    expect(next.current).toBe(before.current);
  });
});
