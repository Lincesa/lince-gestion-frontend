// Pure computations of the "Balance de masas" dashboard, ported from balance-de-masas.html
// (tablero.js · decision.js · reportes.js · app.js). Same rules, rounding and Spanish texts; the
// markup lives in the React components, these functions only compute what they show.
import type {
  AjusteTablero,
  DatosTablero,
  FilaReporte,
  PendienteRow,
  Producto,
  ProductoTablero,
  Revision,
  Revisiones,
  TipoReporte,
} from '@/types/balanceMasas.types';

// ---------------- Formatting ----------------

export const f2 = (n: number | string | null | undefined) =>
  Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fS = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + f2(Math.abs(n));
export const r2 = (n: number) => Math.round(n * 100) / 100;
export const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const nombreMes = (M: string) => `${MESES[+M.slice(5) - 1]} ${M.slice(0, 4)}`;
export const nombreMesTitulo = (M: string) => {
  const n = nombreMes(M);
  return n[0].toUpperCase() + n.slice(1);
};

/** Previous month of "aaaa-mm". */
export const mesAnterior = (M: string) => {
  const [a, m] = M.split('-').map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
};

const dos = (n: number) => String(n).padStart(2, '0');
export const hoy = (d = new Date()) => `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()}`;

// ---------------- Adjustments ----------------

const CORTO: Record<string, string> = {
  'Viaje del mes anterior facturado este mes': 'Mes anterior',
  'Remito no facturado por el proveedor': 'No facturado',
  'Viaje del mes siguiente facturado por adelantado': 'Adelantado',
  'Viajes de meses anteriores facturados este mes': 'Meses anteriores',
  'Proveedor facturó en un mes anterior': 'Facturado antes',
  'Proveedor completa el viaje el mes siguiente': 'Completa mes sig.',
  'Diferencia sin explicar': 'Sin explicar',
  'Facturado este mes, viaje de un mes anterior': 'Facturó un viaje del mes anterior',
  'Proveedor factura el mes siguiente': 'Factura tarde',
  'Diferencia de pesada': 'Pesada',
  'Error de tipeo en remito': 'Tipeo',
  'Factura distinta a la suma de sus remitos': 'Factura ≠ remitos',
  'Viaje VIA 2': 'VIA 2',
};

/** Short label of a category ("Viaje de agosto 2026 facturado este mes" → "De agosto 2026"). */
export const corto = (cat: string) => {
  if (CORTO[cat]) return CORTO[cat];
  const m = /^Viaje de (.+) facturado este mes$/.exec(cat);
  return m ? `De ${m[1]}` : cat;
};

/** CSS class of a responsible: lince · prov · via · sin. */
export const clase = (r: string) => (r === 'Lince' ? 'lince' : r === 'Proveedor' ? 'prov' : r === 'VIA 2' ? 'via' : 'sin');
export const respTxt = (r: string) =>
  r === 'Lince' ? 'Lince · Facturación y logística' : r === 'Sin explicar' ? 'Sin responsable identificado' : r;

type AjusteDecision = Pick<AjusteTablero, 'neutro' | 'resp' | 'cat' | 'tn'>;

/** [status, what to do] of an adjustment (decision.js). */
export function decision(a: AjusteDecision): [string, string] {
  if (a.neutro) return ['Informativo', 'Se compensa dentro del mes.'];
  if (a.resp === 'VIA 2') return ['Informativo', 'Queda como ajuste del mes.'];
  if (a.cat === 'Viaje del mes anterior facturado este mes') return ['Sin acción', 'Revierte el pendiente del cierre anterior.'];
  const viejo = /^Viaje de (.+) facturado este mes$/.exec(a.cat);
  if (viejo) return ['Sin acción', `Revierte el pendiente del cierre de ${viejo[1]}.`];
  if (a.cat === 'Remito no facturado por el proveedor') return ['Requiere confirmación', 'Confirmar con el proveedor si lo va a facturar.'];
  if (a.cat === 'Viaje del mes siguiente facturado por adelantado') return ['Sin acción', 'Se compensa en el cierre del mes siguiente.'];
  if (a.cat === 'Proveedor facturó en un mes anterior') return ['Sin acción', 'Ya se compensó en el cierre del mes anterior.'];
  if (a.cat === 'Proveedor completa el viaje el mes siguiente') return ['Sin acción', 'Se revierte en el cierre del mes siguiente.'];
  if (a.cat === 'Facturado este mes, viaje de un mes anterior') return ['Sin acción', 'Regulariza una demora de facturación del mes anterior.'];
  if (a.cat === 'Nota de crédito del proveedor') return ['Sin acción', 'La nota de crédito ya está en el saldo de TN compradas.'];
  if (a.cat === 'Baja parcial pendiente') return ['Sin acción', 'Se compensa cuando el proveedor complete la facturación del viaje.'];
  if (a.cat === 'Viaje facturado en partes') return ['Sin acción', 'Completa la baja parcial de un cierre anterior.'];
  if (a.cat === 'Va a planta (sin venta)') return ['Sin acción', 'Va a planta como insumo: no se factura.'];
  if (a.cat === 'Error de tipeo en remito') return ['Sin acción', 'Error de tipeo de Lince (chofer o facturación): se igualan las toneladas a las del proveedor.'];
  if (a.resp === 'Lince') return ['Requiere confirmación', 'Revisar con facturación o logística y regularizar.'];
  if (a.resp === 'Sin explicar') return ['Requiere confirmación', 'Revisar el caso antes de cerrar el mes.'];
  if (a.cat === 'Proveedor factura el mes siguiente') return ['Sin acción', 'Se revierte sola en el cierre del mes siguiente.'];
  if (a.cat === 'Viajes de meses anteriores facturados este mes') return ['Sin acción', 'Es la regularización de meses anteriores.'];
  if (a.cat === 'Factura distinta a la suma de sus remitos') return ['Requiere confirmación', 'Consultar al proveedor por la diferencia entre la factura y sus remitos.'];
  if (Math.abs(a.tn) <= 1) return ['Sin acción', 'Dentro de la tolerancia de 1 t.'];
  return ['Requiere confirmación', 'Supera la tolerancia de 1 t: reclamar al proveedor o aceptar la diferencia.'];
}

export const requiereConfirmacion = (a: AjusteDecision) => decision(a)[0] === 'Requiere confirmación';

// ---------------- prepararDatos ----------------

export interface AjustePreparado extends AjusteTablero {
  /** Position id inside the dashboard ("<product>-<index>"). */
  id: string;
  /** Id of the adjustment in the history (used to confirm / reject it). */
  idHist: string;
  requiere: boolean;
}

export type EstadoProducto = 'no' | 'pend' | 'adj' | 'si';

export interface ProductoPreparado extends Omit<ProductoTablero, 'ajustes'> {
  ajustes: AjustePreparado[];
  lince: AjustePreparado[];
  alertas: AjustePreparado[];
  tLince: number;
  tProv: number;
  tVia: number;
  tSin: number;
  ok: { reg: number; ven: number | null; com: number };
  dif: number;
  coinciden: boolean;
  porConfirmar: AjustePreparado[];
  rechazados: AjustePreparado[];
  confirmados: AjustePreparado[];
  estado: EstadoProducto;
}

export interface DatosPreparados extends Omit<DatosTablero, 'productos'> {
  productos: ProductoPreparado[];
}

const sumaAbs = (xs: AjusteTablero[]) => xs.reduce((s, a) => s + Math.abs(a.tn), 0);

/** Adds what the dashboard computes per product: adjusted totals, difference, per-responsible sums, review state. */
export function prepararDatos(D: DatosTablero): DatosPreparados {
  const productos = D.productos.map((p0): ProductoPreparado => {
    const ajustes: AjustePreparado[] = p0.ajustes.map((a, i) => ({
      ...a, idHist: a.id ?? '', id: `${p0.k}-${i}`, requiere: requiereConfirmacion(a),
    }));
    const de = (r: string) => ajustes.filter((a) => a.resp === r);
    const sx = (c: string) => ajustes.filter((a) => a.resp === 'Sin explicar' && a.col === c).reduce((s, a) => s + a.tn, 0);
    const ok = {
      reg: p0.fin.reg,
      ven: p0.venta ? r2((p0.fin.ven ?? 0) - sx('ven')) : null,
      com: r2(p0.fin.com - sx('com')),
    };
    const vals = [ok.reg, ok.com].concat(p0.venta ? [ok.ven as number] : []);
    const dif = r2(Math.max(...vals) - Math.min(...vals));
    const coinciden = dif === 0;
    const porConfirmar = ajustes.filter((a) => a.requiere && !a.revision);
    const rechazados = ajustes.filter((a) => a.requiere && a.revision === 'rechazado');
    const confirmados = ajustes.filter((a) => a.requiere && a.revision === 'confirmado');
    return {
      ...p0,
      ajustes,
      lince: de('Lince'),
      alertas: ajustes.filter((a) => a.alerta),
      tLince: sumaAbs(de('Lince')),
      tProv: sumaAbs(de('Proveedor')),
      tVia: sumaAbs(de('VIA 2')),
      tSin: sumaAbs(de('Sin explicar')),
      ok,
      dif,
      coinciden,
      porConfirmar,
      rechazados,
      confirmados,
      estado: !coinciden ? 'no' : porConfirmar.length ? 'pend' : rechazados.length ? 'adj' : 'si',
    };
  });
  return { ...D, productos };
}

// ---------------- Status card ----------------

export interface ResumenEstado {
  cls: 'si' | 'no' | 'pend';
  ic: string;
  t1: string;
  t2: string;
  /** Lince adjustments with an alert ("Lince para revisar"). */
  lin: number;
  nProv: number;
  tProv: number;
}

/** Big status card + counters (estadoHTML). todos: the "all products" view. */
export function resumenEstado(lista: ProductoPreparado[], todos: boolean): ResumenEstado {
  const no = lista.filter((p) => !p.coinciden);
  const lin = lista.flatMap((p) => p.ajustes.filter((a) => a.resp === 'Lince' && a.alerta)).length;
  const nProv = lista.reduce((s, p) => s + p.ajustes.filter((a) => a.resp === 'Proveedor' && !a.neutro).length, 0);
  const tProv = lista.reduce((s, p) => s + p.tProv, 0);
  const base = { lin, nProv, tProv };
  const pend = lista.filter((p) => p.estado === 'pend');
  const nPend = lista.reduce((s, p) => s + p.porConfirmar.length, 0);
  const adj = lista.filter((p) => p.estado === 'adj');
  const caja = (cls: ResumenEstado['cls'], ic: string, t1: string, t2: string): ResumenEstado => ({ cls, ic, t1, t2, ...base });
  if (todos) {
    if (no.length) return caja('no', '✗', `${no.length} de ${lista.length} productos no coinciden`, no.map((p) => p.nombre).join(', '));
    if (pend.length) {
      return caja('pend', '!', `Requiere confirmación: ${plural(nPend, 'acción pendiente', 'acciones pendientes')}`,
        `Hay que confirmar o rechazar ajustes de ${pend.map((p) => p.nombre).join(', ')}. Hasta entonces, el balance no se da por bueno.`);
    }
    return caja('si', '✓', `Las toneladas coinciden en los ${lista.length} productos`, adj.length
      ? `${plural(adj.length, 'producto coincide', 'productos coinciden')} con ajustes rechazados: ${adj.map((p) => p.nombre).join(', ')}`
      : 'Registradas, facturadas y compradas cuadran con los ajustes del mes');
  }
  const p = lista[0];
  if (p.estado === 'no') return caja('no', '✗', 'Las toneladas no coinciden', `Queda una diferencia de ${f2(p.dif)} t sin explicar`);
  if (p.estado === 'pend') {
    return caja('pend', '!', 'Requiere confirmación',
      `${plural(p.porConfirmar.length, 'ajuste para confirmar o rechazar', 'ajustes para confirmar o rechazar')} antes de dar el balance por bueno.`);
  }
  if (p.estado === 'adj') {
    return caja('si', '✓', 'Coincide, con ajustes', `${plural(p.rechazados.length, 'ajuste rechazado', 'ajustes rechazados')}: ver el comentario en "Ajustes explicados".`);
  }
  return caja('si', '✓', 'Las toneladas coinciden', `${p.venta ? 'Registradas, facturadas y compradas' : 'Registradas y compradas'} llegan a ${f2(p.ok.reg)} t`);
}

/** Adjustments still to confirm or reject, and how many were already reviewed ("Acciones pendientes"). */
export function accionesPendientes(lista: ProductoPreparado[]) {
  return {
    pend: lista.flatMap((p) => p.porConfirmar.map((a) => ({ p, a }))),
    conf: lista.reduce((s, p) => s + p.confirmados.length, 0),
    rech: lista.reduce((s, p) => s + p.rechazados.length, 0),
  };
}

export const totalPorConfirmar = (lista: ProductoPreparado[]) => lista.reduce((s, p) => s + p.porConfirmar.length, 0);

/** Footer of the all-products table. */
export function totalesTodos(P: ProductoPreparado[]) {
  const tot = { reg: 0, ven: 0, com: 0 };
  for (const p of P) {
    tot.reg += p.ok.reg;
    tot.com += p.ok.com;
    if (p.venta) tot.ven += p.ok.ven ?? 0;
  }
  return tot;
}

/** Card of delivery notes with typing errors ('tipeo') or weighing differences ('pesada'). */
export function obsCard(lista: ProductoPreparado[], k: 'tipeo' | 'pesada') {
  const N = lista.reduce((s, p) => s + p.nrem, 0);
  const prods = lista.filter((p) => p.obs[k].length);
  const n = prods.reduce((s, p) => s + p.obs[k].length, 0);
  const tn = prods.reduce((s, p) => s + p.obs[k].reduce((a, x) => a + Math.abs(x.dif), 0), 0);
  const pct = N ? (n / N * 100).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '0';
  return { N, n, tn, pct, prods };
}

export interface GrupoConcepto {
  cat: string;
  items: AjustePreparado[];
  tot: number;
}

/** Adjustments with the same category, totalled in one expandable line (in order of appearance). */
export function agruparConceptos<T extends AjusteTablero>(l: T[]): { cat: string; items: T[]; tot: number }[] {
  const grupos = new Map<string, T[]>();
  for (const a of l) {
    if (!grupos.has(a.cat)) grupos.set(a.cat, []);
    grupos.get(a.cat)!.push(a);
  }
  return [...grupos.entries()].map(([cat, items]) => ({ cat, items, tot: r2(items.reduce((s, a) => s + a.tn, 0)) }));
}

// ---------------- Pending invoicing at close ----------------

export interface FilaPendiente {
  k: string;
  nombre: string;
  n: number;
  tn: number;
  ant?: number;
}

const PEND_LINCE = new Set(['Facturado el mes siguiente', 'Viaje registrado sin facturar']);

/**
 * Pending invoicing at the close of month M, in tonnes per product.
 * Lince: trips of the month without a sales invoice in the month. Supplier: pending items at close
 * (including those of older months, counted in `ant`), in master order.
 */
export function pendientesFacturar(
  D: DatosPreparados, M: string, soloK: string | null, filas: PendienteRow[], maestro: Pick<Producto, 'clave' | 'nombre'>[],
): { lince: FilaPendiente[]; prov: FilaPendiente[] } {
  const nombres = Object.fromEntries(maestro.map((p) => [p.clave, p.nombre]));
  const lince = D.productos.filter((p) => !soloK || p.k === soloK).map((p) => {
    const xs = p.ajustes.filter((a) => a.col === 'ven' && PEND_LINCE.has(a.cat));
    return { k: p.k, nombre: p.nombre, n: xs.length, tn: r2(sumaAbs(xs)) };
  }).filter((x) => x.n);
  const porProd = new Map<string, Required<FilaPendiente>>();
  for (const x of filas) {
    if (soloK && x.producto !== soloK) continue;
    if (!porProd.has(x.producto)) porProd.set(x.producto, { k: x.producto, nombre: nombres[x.producto] || x.producto, n: 0, tn: 0, ant: 0 });
    const y = porProd.get(x.producto)!;
    y.n++;
    y.tn += Number(x.toneladas) || 0;
    const f = String(x.fecha || '');
    if (/^\d\d\/\d\d\/\d{4}$/.test(f) && `${f.slice(6)}-${f.slice(3, 5)}` < M) y.ant++;
  }
  const orden = maestro.map((p) => p.clave);
  const prov = [...porProd.values()].map((y) => ({ ...y, tn: r2(y.tn) }));
  prov.sort((a, b) => orden.indexOf(a.k) - orden.indexOf(b.k));
  return { lince, prov };
}

// ---------------- Reviews (confirm / reject) ----------------

/** Month data with the reviews typed on screen (open month or a closed month opened for review). */
export function conRevisiones(D: DatosTablero, revisiones: Revisiones): DatosTablero {
  return {
    ...D,
    productos: D.productos.map((p) => ({
      ...p,
      ajustes: p.ajustes.map((a) => {
        const r = a.id ? revisiones[a.id] : undefined;
        if (!r) return a;
        return { ...a, revision: r.estado || undefined, revisionFecha: r.fecha || '', justificacion: r.comentario || '' };
      }),
    })),
  };
}

/**
 * Confirm or reject an adjustment (revisar() of the HTML): pressing the same button again leaves it pending;
 * rejecting without a comment is refused and returns the id in `faltaMotivo`.
 */
export function alternarRevision(
  revisiones: Revisiones, id: string, estado: 'confirmado' | 'rechazado', comentario: string, fecha: string,
): { revisiones: Revisiones; faltaMotivo: string | null } {
  const r: Revision = { ...(revisiones[id] ?? { estado: '', comentario: '', fecha: '' }), comentario };
  let faltaMotivo: string | null = null;
  if (r.estado === estado) {
    r.estado = '';
    r.fecha = '';
  } else if (estado === 'rechazado' && !comentario.trim()) {
    faltaMotivo = id;
  } else {
    r.estado = estado;
    r.fecha = fecha;
  }
  return { revisiones: { ...revisiones, [id]: r }, faltaMotivo };
}

/** How many adjustments would change when saving (same comparison as aplicarRevisiones). */
export function contarCambios(guardadas: Revisiones, locales: Revisiones): number {
  let cambios = 0;
  for (const [id, r] of Object.entries(locales)) {
    const g = guardadas[id] ?? { estado: '', comentario: '', fecha: '' };
    const revision = r.estado || '';
    const justificacion = (r.comentario || '').trim();
    const fecha = revision ? (r.fecha || '') : '';
    if (revision !== (g.estado || '') || justificacion !== (g.comentario || '') || fecha !== (g.fecha || '')) cambios++;
  }
  return cambios;
}

// ---------------- Months and reports ----------------

/** Months that can be viewed: the closed ones and the open month. */
export const mesesVisibles = (cerrados: string[], mesAbierto: string | null) =>
  [...new Set([...cerrados, ...(mesAbierto ? [mesAbierto] : [])])].sort();

export const TITULOS_REPORTE: Record<TipoReporte, string> = {
  registradas: 'TN registradas',
  vendidas: 'TN vendidas',
  compradas: 'TN compradas',
  remitos: 'Informe de remitos',
};

export const HOJA_REPORTE = {
  registradas: 'detalle_registradas',
  vendidas: 'detalle_vendidas',
  compradas: 'detalle_compradas',
  remitos: 'detalle_remitos',
} as const satisfies Record<TipoReporte, string>;

/** Columns of each report view: [title, field, 't' = tonnes with total]. */
export const COLS_REPORTE: Record<TipoReporte, [string, string, 't'?][]> = {
  registradas: [['Fecha', 'fecha'], ['Producto', 'producto'], ['Zona', 'zona'], ['Cliente', 'cliente'], ['Remito proveedor', 'remito'], ['TN', 'toneladas', 't'], ['Factura de compra', 'factura_compra'], ['Factura de venta', 'factura_venta']],
  vendidas: [['Fecha', 'fecha'], ['Producto', 'producto'], ['Comprobante', 'comprobante'], ['Cliente', 'cliente'], ['TN', 'toneladas', 't']],
  compradas: [['Fecha', 'fecha'], ['Producto', 'producto'], ['Comprobante', 'comprobante'], ['Proveedor', 'proveedor'], ['TN', 'toneladas', 't']],
  remitos: [['Factura', 'factura'], ['Fecha factura', 'fecha_factura'], ['Proveedor', 'proveedor'], ['Producto', 'producto'], ['Remito', 'remito'], ['Fecha remito', 'fecha_remito'], ['Facturado', 'facturado', 't'], ['Remitado', 'remitado', 't'], ['Diferencia', 'diferencia', 't'], ['Observación', 'observacion']],
};

export const MAX_FILAS_REPORTE = 3000;

const ord = (f: unknown) => {
  const s = String(f || '');
  return s.length >= 10 ? s.slice(6, 10) + s.slice(3, 5) + s.slice(0, 2) : s;
};

/** Rows of a report filtered by month / product, sorted by date (invoice date for remitos), with totals. */
export function filtrarReporte(tipo: TipoReporte, filas: FilaReporte[], filtros: { mes: string; prod: string }) {
  const fecha = tipo === 'remitos' ? 'fecha_factura' : 'fecha';
  const xs = filas
    .filter((r) => (!filtros.mes || r.mes === filtros.mes) && (!filtros.prod || r.producto === filtros.prod))
    .sort((a, b) => (ord(a[fecha]) < ord(b[fecha]) ? -1 : ord(a[fecha]) > ord(b[fecha]) ? 1 : 0));
  const totales: Record<string, number> = {};
  for (const [, c, t] of COLS_REPORTE[tipo]) if (t) totales[c] = xs.reduce((s, r) => s + Number(r[c] || 0), 0);
  return { filas: xs, totales };
}

/** History rows with the open month's rows replaced by the draft's detail. */
export function unirDetalleAbierto<T extends { mes?: unknown }>(filas: T[], mesAbierto: string | null, delBorrador: T[]): T[] {
  if (!mesAbierto) return filas;
  return filas.filter((r) => r.mes !== mesAbierto).concat(delBorrador);
}

export const tituloProducto = (p: Pick<ProductoTablero, 'nombre' | 'art' | 'rs'>) =>
  `${p.nombre} · art. ${p.art}${p.rs === 'LERCARA' ? ' · Lercara' : ''}`;
