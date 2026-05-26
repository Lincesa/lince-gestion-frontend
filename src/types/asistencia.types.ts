export type Planta = 'tucuman' | 'villa_nueva';

export interface EmpleadoAsistencia {
  id: string;
  firstName: string;
  lastName: string;
  dni?: string | null;
  pin: string;
  planta: Planta;
  departamento?: string | null;
  cargo?: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FichajeAsistencia {
  id: string;
  empleadoId: string | null;
  pin: string;
  tiempo: string;
  estado: 0 | 1;
  verify: number | null;
  deviceSn: string | null;
  planta: Planta | null;
  rawPayload: string | null;
  createdAt: string;
  empleado: EmpleadoAsistencia | null;
}

export interface FichajesPage {
  items: FichajeAsistencia[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  fecha?: string;
}

export interface FichajeReporte {
  id: string;
  tiempo: string;
  estado: 0 | 1;
}

export interface TramoReporte {
  entrada: FichajeReporte;
  salida: FichajeReporte;
  ms: number;
}

export interface DiaReporteEmpleado {
  fecha: string;
  diaHabil: boolean;
  esperadoMs: number;
  trabajadoMs: number;
  saldoMs: number;
  fichajes: FichajeReporte[];
  tramos: TramoReporte[];
  entradasSinSalida: FichajeReporte[];
  salidasSinEntrada: FichajeReporte[];
}

export interface PinSummaryRow {
  pin: string;
  planta: Planta;
  totalFichajes: number;
  ultimoFichaje: string | null;
  empleadoId: string | null;
  empleadoNombre: string | null;
  empleadoPlanta: Planta | null;
}

export interface ReporteEmpleadoRango {
  empleado: {
    id: string;
    pin: string;
    firstName: string;
    lastName: string;
    planta: Planta;
  };
  desde: string;
  hasta: string;
  horasEsperadasPorDia: number;
  resumen: {
    diasHabiles: number;
    diasConTramos: number;
    esperadoMs: number;
    trabajadoMs: number;
    saldoMs: number;
  };
  dias: DiaReporteEmpleado[];
}
