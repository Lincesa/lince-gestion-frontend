import { describe, expect, it } from 'vitest';
import { annulledRowClass, canManageOcrAnnul, describeAnnulment, isRemitoAnnulled } from './remitoAnnul';

describe('isRemitoAnnulled', () => {
  it('is true only when annulledAt is set', () => {
    expect(isRemitoAnnulled({ annulledAt: '2026-10-29T12:00:00.000Z' })).toBe(true);
    expect(isRemitoAnnulled({ annulledAt: null })).toBe(false);
    expect(isRemitoAnnulled({})).toBe(false);
  });
});

describe('annulledRowClass', () => {
  it('paints voided rows red with a left border', () => {
    const cls = annulledRowClass({ annulledAt: '2026-10-29T12:00:00.000Z' }, false);
    expect(cls).toContain('bg-destructive/');
    expect(cls).toContain('border-l-destructive');
  });

  it('keeps the selected voided row distinguishable from an unselected one', () => {
    const voided = { annulledAt: '2026-10-29T12:00:00.000Z' };
    expect(annulledRowClass(voided, true)).not.toBe(annulledRowClass(voided, false));
    expect(annulledRowClass(voided, true)).toContain('ring-');
  });

  it('keeps a red hover on voided rows instead of the neutral accent', () => {
    const cls = annulledRowClass({ annulledAt: '2026-10-29T12:00:00.000Z' }, false);
    expect(cls).toContain('hover:bg-destructive/');
    expect(cls).not.toContain('hover:bg-accent');
  });

  it('returns the existing selected / plain classes for rows that are not voided', () => {
    expect(annulledRowClass({ annulledAt: null }, true)).toBe('hover:bg-accent/60 bg-primary/[0.08] ring-1 ring-inset ring-primary/20');
    expect(annulledRowClass({ annulledAt: null }, false)).toBe('hover:bg-accent/60');
  });
});

describe('describeAnnulment', () => {
  it('names who voided and when in es-AR format', () => {
    const text = describeAnnulment({
      annulledAt: '2026-10-29T15:30:00.000Z',
      annulledByName: 'Ana Pérez',
    });
    expect(text).toContain('Ana Pérez');
    expect(text).toMatch(/29\/10\/2026/);
  });

  it('omits the author when it is unknown', () => {
    const text = describeAnnulment({ annulledAt: '2026-10-29T15:30:00.000Z', annulledByName: null });
    expect(text).not.toContain('por');
    expect(text).toMatch(/29\/10\/2026/);
  });
});

describe('canManageOcrAnnul', () => {
  it('allows global admins and OCR module admins only', () => {
    expect(canManageOcrAnnul({ globalRole: 'SUPERADMIN', modules: {} })).toBe(true);
    expect(canManageOcrAnnul({ globalRole: 'ADMIN', modules: {} })).toBe(true);
    expect(canManageOcrAnnul({ globalRole: 'USER', modules: { ocr: { enabled: true, role: 'ADMIN' } } })).toBe(true);
    expect(canManageOcrAnnul({ globalRole: 'USER', modules: { ocr: { enabled: true, role: 'EDITOR' } } })).toBe(false);
    expect(canManageOcrAnnul({ globalRole: 'USER', modules: {} })).toBe(false);
    expect(canManageOcrAnnul(null)).toBe(false);
  });
});
