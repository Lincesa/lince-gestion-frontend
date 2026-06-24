import type { Planta, EmpleadoAsistencia } from '../types/asistencia.types';

// Espejo del backend (packages/asistencia/src/config/jornadas.ts).
// Mantener sincronizado: Villa Nueva 9 hs (8-12:30 + 14-18); Tucumán 8 hs.
// Las excepciones por persona se setean en empleado.horasEsperadasDia.
export const DEFAULT_HORAS_POR_PLANTA: Record<Planta, number> = {
  villa_nueva: 9,
  tucuman: 8,
};

export function resolveHorasEsperadasDia(empleado: {
  planta: Planta;
  horasEsperadasDia: number | null;
}): number {
  if (empleado.horasEsperadasDia != null) {
    return Number(empleado.horasEsperadasDia);
  }
  return DEFAULT_HORAS_POR_PLANTA[empleado.planta];
}

export function resolveHorasEsperadasDiaForEmpleado(
  emp: Pick<EmpleadoAsistencia, 'planta' | 'horasEsperadasDia'> | null | undefined,
  fallback = 8,
): number {
  if (!emp) return fallback;
  return resolveHorasEsperadasDia(emp);
}
