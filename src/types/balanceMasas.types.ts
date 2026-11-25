// Shapes returned by /api/balance-masas (backend package @lince/balance-masas).
// Field names keep the original tool's names (balance-de-masas.html) so screens can be compared line by line.

export type Col = 'reg' | 'ven' | 'com';
export type TipoReporte = 'registradas' | 'vendidas' | 'compradas' | 'remitos';

export interface Producto {
  clave: string;
  nombre: string;
  rs: string;
  art: string;
  proveedor: string;
  ptoVenta: string | null;
  zona: string | null;
  grupo: string;
  venta: boolean | 'a veces';
  mixto: boolean;
  conRegistradas: boolean;
  artCompartido: boolean;
}

export interface Totales {
  reg: number;
  ven?: number;
  com: number;
}

export interface Observado {
  remito: string;
  fecha: string;
  dif: number;
  obs: string;
  fc: string;
}

export interface AjusteTablero {
  col: Col;
  resp: string;
  cat: string;
  tn: number;
  det: string;
  fuente: string;
  alerta: boolean;
  remito: string;
  cbte: string;
  neutro?: boolean;
  id?: string;
  decision?: string;
  justificacion?: string;
  revision?: string;
  revisionFecha?: string;
  resuelto?: { factura: string; fecha: string; mes: string };
}

export interface ProductoTablero {
  nrem: number;
  obs: { tipeo: Observado[]; pesada: Observado[] };
  k: string;
  nombre: string;
  art: string;
  rs: string;
  venta: boolean;
  tot: Totales;
  fin: Totales;
  ajustes: AjusteTablero[];
}

export interface ProductoSinDatos {
  nombre: string;
  art: string;
  com: number;
  ven: number;
}

export interface DatosTablero {
  mes: string;
  productos: ProductoTablero[];
  pendientes: ProductoSinDatos[];
}

/** Review of an adjustment: '' (pending) | 'confirmado' | 'rechazado'. */
export interface Revision {
  estado: string;
  comentario: string;
  fecha: string;
}

export type Revisiones = Record<string, Revision>;

export type ResultadoPendiente =
  | { estado: 'facturado'; mes: string; factura: string; fecha: string }
  | { estado: 'sin_pendiente'; mes: string };

export interface PendienteRow {
  mes_cierre: string;
  producto: string;
  grupo: string;
  zona: string;
  remito: string;
  fecha: string;
  toneladas: string | number;
  resultado?: ResultadoPendiente;
}

export interface EstadoBalance {
  revision: number;
  ultimoMes: string;
  arranque: string;
  mesesCerrados: string[];
  actualizadoPor: string | null;
  actualizadoEn: string | null;
  productos: Producto[];
}

export interface MesCerrado {
  revision: number;
  datos: DatosTablero;
  pendientesCierre: PendienteRow[];
  revisiones: Revisiones;
}

export interface OpcionMes {
  mes: string;
  etiqueta: string;
  porDefecto?: boolean;
}

export interface ItemChecklist {
  nombre: string;
  estado: 'ok' | 'corto' | 'falta' | 'opcional';
  detalle: string;
  requerido: boolean;
}

export interface GrupoChecklist {
  titulo: string;
  nota?: string;
  items: ItemChecklist[];
}

export interface Checklist {
  mes: string | null;
  grupos: GrupoChecklist[];
  faltan?: number;
  completo: boolean;
  errores: string[];
}

export interface ArchivoBorrador {
  id: string;
  nombre: string;
  tipo: TipoReporte | null;
  rs: 'LINCE' | 'LERCARA' | null;
  desde: string | null;
  hasta: string | null;
  avisos: string[];
  errores: string[];
  repetido?: string;
  filas?: number;
  grupo?: string | null;
  productos?: string[];
}

export type FilaReporte = Record<string, string | number>;

export interface DetalleMes {
  detalle_registradas: FilaReporte[];
  detalle_vendidas: FilaReporte[];
  detalle_compradas: FilaReporte[];
  detalle_remitos: FilaReporte[];
}

export type CargaVista =
  | { ok: false; error: string; avisos: string[]; detalles?: string[] }
  | {
    ok: true;
    mes: string;
    recierre: boolean;
    avisos: string[];
    conMesAnterior: boolean;
    datos: DatosTablero;
    detalle: DetalleMes;
    pendCierre: PendienteRow[];
    confirmaciones: string[];
  };

export interface VistaBorrador {
  revision: number;
  archivos: ArchivoBorrador[];
  opcionesMes: OpcionMes[];
  mesElegido: string | null;
  checklist: Checklist | null;
  carga: CargaVista | null;
  revisiones: Revisiones;
}

export interface GuardadoMes {
  revision: number;
  mes: string;
}

export interface RevisionGuardada {
  revision: number;
  cambios: number;
}

export interface EventoBalance {
  id: string;
  tipo: 'cierre' | 'revisiones' | 'importacion' | string;
  mes: string | null;
  revision: number;
  detalle: unknown;
  creado_en: string;
  usuario: string | null;
}
