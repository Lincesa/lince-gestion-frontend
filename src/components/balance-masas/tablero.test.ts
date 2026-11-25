import { describe, expect, it } from 'vitest';
import type { AjusteTablero, DatosTablero, ProductoTablero, Producto } from '@/types/balanceMasas.types';
import {
  accionesPendientes,
  agruparConceptos,
  alternarRevision,
  conRevisiones,
  contarCambios,
  corto,
  decision,
  f2,
  fS,
  filtrarReporte,
  mesAnterior,
  mesesVisibles,
  nombreMes,
  nombreMesTitulo,
  obsCard,
  pendientesFacturar,
  prepararDatos,
  resumenEstado,
  totalesTodos,
  unirDetalleAbierto,
} from './tablero';

const aj = (x: Partial<AjusteTablero>): AjusteTablero => ({
  col: 'ven', resp: 'Proveedor', cat: 'Proveedor factura el mes siguiente', tn: 1, det: '', fuente: '', alerta: false, remito: '', cbte: '', ...x,
});

const prod = (x: Partial<ProductoTablero>): ProductoTablero => ({
  nrem: 10, obs: { tipeo: [], pesada: [] }, k: 'A', nombre: 'Arena', art: '100', rs: 'LINCE', venta: true,
  tot: { reg: 100, ven: 100, com: 100 }, fin: { reg: 100, ven: 100, com: 100 }, ajustes: [], ...x,
});

const datos = (productos: ProductoTablero[]): DatosTablero => ({ mes: '2026-10', productos, pendientes: [] });

describe('formatting (same as the HTML)', () => {
  it('formats tonnes es-AR with 2 decimals and a sign', () => {
    expect(f2(1234.5)).toBe('1.234,50');
    expect(fS(2.5)).toBe('+2,50');
    expect(fS(-2.5)).toBe('−2,50');
    expect(fS(0)).toBe('0,00');
  });

  it('names months', () => {
    expect(nombreMes('2026-03')).toBe('marzo 2026');
    expect(nombreMesTitulo('2026-03')).toBe('Marzo 2026');
  });

  it('previous month', () => {
    expect(mesAnterior('2026-01')).toBe('2025-12');
    expect(mesAnterior('2026-11')).toBe('2026-10');
  });

  it('shortens categories', () => {
    expect(corto('Remito no facturado por el proveedor')).toBe('No facturado');
    expect(corto('Viaje de agosto 2026 facturado este mes')).toBe('De agosto 2026');
    expect(corto('Otra cosa')).toBe('Otra cosa');
  });
});

describe('decision', () => {
  it('follows the HTML rules', () => {
    expect(decision(aj({ neutro: true }))[0]).toBe('Informativo');
    expect(decision(aj({ cat: 'Remito no facturado por el proveedor' }))[0]).toBe('Requiere confirmación');
    expect(decision(aj({ resp: 'Lince', cat: 'X' }))).toEqual(['Requiere confirmación', 'Revisar con facturación o logística y regularizar.']);
    expect(decision(aj({ cat: 'Viaje de agosto 2026 facturado este mes' }))).toEqual(['Sin acción', 'Revierte el pendiente del cierre de agosto 2026.']);
    expect(decision(aj({ cat: 'Diferencia de pesada', tn: 0.8 }))[0]).toBe('Sin acción');
    expect(decision(aj({ cat: 'Diferencia de pesada', tn: -1.5 }))[0]).toBe('Requiere confirmación');
  });
});

describe('prepararDatos', () => {
  it('computes adjusted totals, difference and "coinciden" ignoring unexplained adjustments', () => {
    const D = prepararDatos(datos([prod({
      fin: { reg: 100, ven: 103, com: 100 },
      ajustes: [aj({ resp: 'Sin explicar', col: 'ven', tn: 3, cat: 'Diferencia sin explicar' })],
    })]));
    const p = D.productos[0];
    expect(p.ok).toEqual({ reg: 100, ven: 100, com: 100 });
    expect(p.dif).toBe(0);
    expect(p.coinciden).toBe(true);
    // The unexplained adjustment requires confirmation → "pend".
    expect(p.porConfirmar).toHaveLength(1);
    expect(p.estado).toBe('pend');
  });

  it('reports a difference when columns do not match and ignores sales for plant products', () => {
    const D = prepararDatos(datos([
      prod({ k: 'A', fin: { reg: 100, ven: 98.5, com: 100 } }),
      prod({ k: 'B', venta: false, tot: { reg: 50, com: 50 }, fin: { reg: 50, com: 50 } }),
    ]));
    expect(D.productos[0].dif).toBe(1.5);
    expect(D.productos[0].estado).toBe('no');
    expect(D.productos[1].ok.ven).toBeNull();
    expect(D.productos[1].estado).toBe('si');
  });

  it('sums tonnes per responsible (absolute values) and keeps the history id', () => {
    const D = prepararDatos(datos([prod({
      ajustes: [
        aj({ id: 'h1', resp: 'Lince', tn: -2, alerta: true, cat: 'Facturado el mes siguiente' }),
        aj({ id: 'h2', resp: 'Proveedor', tn: 1.5 }),
        aj({ id: 'h3', resp: 'Proveedor', tn: -0.5 }),
        aj({ id: 'h4', resp: 'VIA 2', tn: 4 }),
      ],
    })]));
    const p = D.productos[0];
    expect([p.tLince, p.tProv, p.tVia, p.tSin]).toEqual([2, 2, 4, 0]);
    expect(p.ajustes.map((a) => [a.id, a.idHist])).toEqual([['A-0', 'h1'], ['A-1', 'h2'], ['A-2', 'h3'], ['A-3', 'h4']]);
    expect(p.alertas).toHaveLength(1);
  });

  it('distinguishes confirmed, rejected and pending adjustments', () => {
    const base = { resp: 'Lince', cat: 'X' };
    const D = prepararDatos(datos([prod({ ajustes: [aj({ ...base, revision: 'confirmado' }), aj({ ...base, revision: 'rechazado' })] })]));
    const p = D.productos[0];
    expect(p.confirmados).toHaveLength(1);
    expect(p.rechazados).toHaveLength(1);
    expect(p.porConfirmar).toHaveLength(0);
    expect(p.estado).toBe('adj');
  });
});

describe('status card and counters', () => {
  it('says how many products do not match', () => {
    const D = prepararDatos(datos([prod({ k: 'A', nombre: 'Arena', fin: { reg: 1, ven: 2, com: 1 } }), prod({ k: 'B', nombre: 'Piedra' })]));
    const e = resumenEstado(D.productos, true);
    expect(e.cls).toBe('no');
    expect(e.t1).toBe('1 de 2 productos no coinciden');
    expect(e.t2).toBe('Arena');
  });

  it('counts Lince alerts and supplier adjustments (non-neutral)', () => {
    const D = prepararDatos(datos([prod({
      ajustes: [aj({ resp: 'Lince', alerta: true, cat: 'Facturado el mes siguiente', revision: 'confirmado' }), aj({ resp: 'Proveedor', tn: 2 }), aj({ resp: 'Proveedor', tn: 1, neutro: true })],
    })]));
    const e = resumenEstado(D.productos, true);
    expect(e.lin).toBe(1);
    expect(e.nProv).toBe(1);
    expect(e.tProv).toBe(3);
    expect(e.t1).toBe('Las toneladas coinciden en los 1 productos');
  });

  it('one product: pending confirmation text', () => {
    const D = prepararDatos(datos([prod({ ajustes: [aj({ resp: 'Lince', cat: 'X' })] })]));
    const e = resumenEstado(D.productos, false);
    expect(e.cls).toBe('pend');
    expect(e.t2).toBe('1 ajuste para confirmar o rechazar antes de dar el balance por bueno.');
  });

  it('lists pending actions and totals the table', () => {
    const D = prepararDatos(datos([
      prod({ k: 'A', ajustes: [aj({ resp: 'Lince', cat: 'X' }), aj({ resp: 'Lince', cat: 'X', revision: 'rechazado' })] }),
      prod({ k: 'B', venta: false, fin: { reg: 10, com: 10 } }),
    ]));
    const a = accionesPendientes(D.productos);
    expect(a.pend.map((x) => x.a.id)).toEqual(['A-0']);
    expect([a.conf, a.rech]).toEqual([0, 1]);
    expect(totalesTodos(D.productos)).toEqual({ reg: 110, ven: 100, com: 110 });
  });

  it('summarises observed delivery notes with percentage of the month', () => {
    const D = prepararDatos(datos([prod({ nrem: 8, obs: { tipeo: [{ remito: '1', fecha: '01/10/2026', dif: -0.5, obs: 'x', fc: '' }], pesada: [] } })]));
    expect(obsCard(D.productos, 'tipeo')).toMatchObject({ n: 1, N: 8, tn: 0.5, pct: '12,5' });
  });
});

describe('agruparConceptos', () => {
  it('groups adjustments with the same category and totals them', () => {
    const g = agruparConceptos([aj({ cat: 'A', tn: 1.11 }), aj({ cat: 'B', tn: 1 }), aj({ cat: 'A', tn: 2.22 })]);
    expect(g.map((x) => [x.cat, x.items.length, x.tot])).toEqual([['A', 2, 3.33], ['B', 1, 1]]);
  });
});

describe('pendientesFacturar', () => {
  const maestro = [{ clave: 'B', nombre: 'Piedra' }, { clave: 'A', nombre: 'Arena' }] as Producto[];
  it('Lince: trips not invoiced in the month; supplier: pending at close, ordered as the master, counting older months', () => {
    const D = prepararDatos(datos([
      prod({ k: 'A', nombre: 'Arena', ajustes: [aj({ col: 'ven', cat: 'Facturado el mes siguiente', tn: -2.34 }), aj({ col: 'ven', cat: 'Viaje registrado sin facturar', tn: -1.01 })] }),
    ]));
    const filas = [
      { mes_cierre: '2026-10', producto: 'A', grupo: '', zona: '', remito: '1', fecha: '15/10/2026', toneladas: 3 },
      { mes_cierre: '2026-10', producto: 'B', grupo: '', zona: '', remito: '2', fecha: '20/09/2026', toneladas: '1.5' },
    ];
    const r = pendientesFacturar(D, '2026-10', null, filas, maestro);
    expect(r.lince).toEqual([{ k: 'A', nombre: 'Arena', n: 2, tn: 3.35 }]);
    expect(r.prov).toEqual([{ k: 'B', nombre: 'Piedra', n: 1, tn: 1.5, ant: 1 }, { k: 'A', nombre: 'Arena', n: 1, tn: 3, ant: 0 }]);
    expect(pendientesFacturar(D, '2026-10', 'A', filas, maestro).prov.map((x) => x.k)).toEqual(['A']);
  });
});

describe('revisions', () => {
  it('applies on-screen revisions over the month data', () => {
    const d = datos([prod({ ajustes: [aj({ id: 'h1', resp: 'Lince', cat: 'X' })] })]);
    const r = conRevisiones(d, { h1: { estado: 'confirmado', comentario: 'ok', fecha: '25/11/2026' } });
    expect(r.productos[0].ajustes[0]).toMatchObject({ revision: 'confirmado', justificacion: 'ok', revisionFecha: '25/11/2026' });
    expect(d.productos[0].ajustes[0].revision).toBeUndefined();
  });

  it('toggles confirm / reject; rejecting needs a reason; toggling again leaves it pending', () => {
    const hoy = '25/11/2026';
    let s = alternarRevision({}, 'h1', 'rechazado', '', hoy);
    expect(s.faltaMotivo).toBe('h1');
    expect(s.revisiones.h1.estado).toBe('');
    s = alternarRevision(s.revisiones, 'h1', 'rechazado', 'No corresponde', hoy);
    expect(s.faltaMotivo).toBeNull();
    expect(s.revisiones.h1).toEqual({ estado: 'rechazado', comentario: 'No corresponde', fecha: hoy });
    s = alternarRevision(s.revisiones, 'h1', 'rechazado', 'No corresponde', hoy);
    expect(s.revisiones.h1).toEqual({ estado: '', comentario: 'No corresponde', fecha: '' });
    s = alternarRevision(s.revisiones, 'h1', 'confirmado', '', hoy);
    expect(s.revisiones.h1.estado).toBe('confirmado');
  });

  it('counts changes against the saved reviews like aplicarRevisiones', () => {
    const guardadas = { h1: { estado: 'confirmado', comentario: 'ok', fecha: '01/11/2026' } };
    expect(contarCambios(guardadas, { h1: { estado: 'confirmado', comentario: ' ok ', fecha: '01/11/2026' } })).toBe(0);
    expect(contarCambios(guardadas, { h1: { estado: '', comentario: 'ok', fecha: '' } })).toBe(1);
    expect(contarCambios(guardadas, { h2: { estado: '', comentario: '', fecha: '' } })).toBe(0);
    expect(contarCambios(guardadas, { h2: { estado: 'confirmado', comentario: '', fecha: 'x' } })).toBe(1);
  });
});

describe('months and reports', () => {
  it('visible months are the closed ones plus the open month, sorted and unique', () => {
    expect(mesesVisibles(['2026-09', '2026-08'], '2026-10')).toEqual(['2026-08', '2026-09', '2026-10']);
    expect(mesesVisibles(['2026-09'], '2026-09')).toEqual(['2026-09']);
  });

  it('filters by month/product, sorts by date and totals tonnes', () => {
    const filas = [
      { mes: '2026-10', producto: 'A', fecha: '15/10/2026', toneladas: 2 },
      { mes: '2026-10', producto: 'B', fecha: '01/10/2026', toneladas: 3 },
      { mes: '2026-09', producto: 'A', fecha: '30/09/2026', toneladas: '1.5' },
    ];
    const r = filtrarReporte('registradas', filas, { mes: '', prod: 'A' });
    expect(r.filas.map((x) => x.fecha)).toEqual(['30/09/2026', '15/10/2026']);
    expect(r.totales.toneladas).toBe(3.5);
    expect(filtrarReporte('registradas', filas, { mes: '2026-10', prod: '' }).filas.map((x) => x.producto)).toEqual(['B', 'A']);
  });

  it('remitos sort by invoice date', () => {
    const filas = [{ mes: 'm', producto: 'A', fecha_factura: '02/10/2026', diferencia: 1 }, { mes: 'm', producto: 'A', fecha_factura: '01/10/2026', diferencia: 2 }];
    expect(filtrarReporte('remitos', filas, { mes: '', prod: '' }).filas.map((x) => x.diferencia)).toEqual([2, 1]);
  });

  it('replaces the open month rows with the draft detail', () => {
    const r = unirDetalleAbierto([{ mes: '2026-09', x: 1 }, { mes: '2026-10', x: 2 }], '2026-10', [{ mes: '2026-10', x: 3 }]);
    expect(r.map((x) => x.x)).toEqual([1, 3]);
  });
});
