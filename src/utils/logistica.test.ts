import { describe, expect, it } from 'vitest';
import { formatTripDate, toLocalDateTimeInput, TRIP_STATUS_LABELS } from './logistica';

describe('helpers de viajes', () => {
  it('expone etiquetas para todos los estados', () => {
    expect(TRIP_STATUS_LABELS.PLANIFICADO).toBe('Planificado');
    expect(TRIP_STATUS_LABELS.EN_CURSO).toBe('En curso');
    expect(TRIP_STATUS_LABELS.CERRADO).toBe('Cerrado');
    expect(TRIP_STATUS_LABELS.CANCELADO).toBe('Cancelado');
  });

  it('tolera fechas inválidas', () => {
    expect(toLocalDateTimeInput('no-es-fecha')).toBe('');
    expect(formatTripDate('no-es-fecha')).toBe('Sin fecha');
  });
});
