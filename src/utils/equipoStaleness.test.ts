import { describe, expect, it } from 'vitest';
import { compareLastSeen, equipoStaleness, STALENESS_COLORS } from './equipoStaleness';

const NOW = new Date('2026-09-29T12:00:00Z');

describe('equipoStaleness', () => {
  it('marca "Sin sincronizar" cuando lastSeenAt es null', () => {
    const result = equipoStaleness(null, NOW);
    expect(result.level).toBe('nunca');
    expect(result.label).toBe('Sin sincronizar');
  });

  it('marca "Hoy" cuando la sincronización fue en las últimas horas', () => {
    const result = equipoStaleness('2026-09-29T08:00:00Z', NOW);
    expect(result.level).toBe('reciente');
    expect(result.label).toBe('Hoy');
  });

  it('marca reciente dentro de los 7 días', () => {
    const result = equipoStaleness('2026-09-24T12:00:00Z', NOW);
    expect(result.level).toBe('reciente');
    expect(result.label).toBe('Hace 5 días');
  });

  it('marca atrasado entre 8 y 30 días', () => {
    const result = equipoStaleness('2026-09-14T12:00:00Z', NOW);
    expect(result.level).toBe('atrasado');
    expect(result.label).toBe('Hace 15 días');
  });

  it('marca crítico (stale) pasados los 30 días, en meses', () => {
    const result = equipoStaleness('2026-06-15T12:00:00Z', NOW);
    expect(result.level).toBe('critico');
    expect(result.label).toMatch(/^Hace \d+ mes(es)?$/);
  });

  it('expone un color distinto para el estado "nunca" (no es un extremo rojo)', () => {
    expect(STALENESS_COLORS.nunca).not.toBe(STALENESS_COLORS.critico);
  });
});

describe('compareLastSeen', () => {
  it('ordena ascendente por fecha cuando ambos valores existen', () => {
    const result = compareLastSeen('2026-09-01T00:00:00Z', '2026-09-10T00:00:00Z', 'asc');
    expect(result).toBeLessThan(0);
  });

  it('ordena descendente por fecha cuando ambos valores existen', () => {
    const result = compareLastSeen('2026-09-01T00:00:00Z', '2026-09-10T00:00:00Z', 'desc');
    expect(result).toBeGreaterThan(0);
  });

  it('siempre envía lastSeenAt=null al final en orden ascendente', () => {
    const result = compareLastSeen(null, '2026-09-10T00:00:00Z', 'asc');
    expect(result).toBeGreaterThan(0);
  });

  it('siempre envía lastSeenAt=null al final en orden descendente', () => {
    const result = compareLastSeen(null, '2026-09-10T00:00:00Z', 'desc');
    expect(result).toBeGreaterThan(0);
  });

  it('mantiene dos nulls como empatados', () => {
    expect(compareLastSeen(null, null, 'asc')).toBe(0);
  });
});
