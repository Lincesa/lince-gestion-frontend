import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AjusteTablero, ProductoTablero } from '@/types/balanceMasas.types';
import { AccionesPendientes, EstadoResumen, PendientesFacturar, VistaProducto, VistaTodos } from './Tablero';
import { ArchivosTabla, ChecklistMes, textoIncompleto } from './MesAbierto';
import { prepararDatos } from './tablero';

const aj = (x: Partial<AjusteTablero>): AjusteTablero => ({
  col: 'ven', resp: 'Lince', cat: 'X', tn: -2, det: 'Detalle', fuente: 'Fuente', alerta: true, remito: '123, 456', cbte: '', id: 'h1', ...x,
});
const prod = (x: Partial<ProductoTablero> = {}): ProductoTablero => ({
  nrem: 4, obs: { tipeo: [], pesada: [] }, k: 'A', nombre: 'Arena', art: '100', rs: 'LINCE', venta: true,
  tot: { reg: 100, ven: 100, com: 100 }, fin: { reg: 100, ven: 100, com: 100 }, ajustes: [aj({})], ...x,
});
const P = (x?: Partial<ProductoTablero>) => prepararDatos({ mes: '2026-10', productos: [prod(x)], pendientes: [] }).productos[0];
const noop = () => {};

describe('dashboard components keep the HTML markup', () => {
  it('status card for one product pending confirmation', () => {
    const html = renderToStaticMarkup(<EstadoResumen lista={[P()]} todos={false} />);
    expect(html).toContain('class="est-big pend"');
    expect(html).toContain('Requiere confirmación');
    expect(html).not.toContain('Lince para revisar');
    expect(html).not.toContain('est-cnt');
  });

  it('shows confirmed invoices and absent pending entries as different outcomes', () => {
    const html = renderToStaticMarkup(<PendientesFacturar lince={[]} prov={[{
      k: 'A', nombre: 'Arena', n: 3, tn: 60,
      viajes: [
        { remito: '1', fecha: '01/10/2026', tn: 20, resultado: { estado: 'facturado', mes: '2026-11', factura: 'A0075-00002848', fecha: '02/11/2026' } },
        { remito: '2', fecha: '02/10/2026', tn: 20, resultado: { estado: 'sin_pendiente', mes: '2026-11' } },
        { remito: '3', fecha: '03/10/2026', tn: 20, resultado: null },
      ],
    }]} />);
    expect(html).toContain('<details');
    expect(html).toContain('Facturado en noviembre 2026 · A0075-00002848');
    expect(html).toContain('Ya no figura como pendiente en noviembre 2026');
    expect(html).toContain('Siguen pendientes 20,00 t.');
  });

  it('all-products table with status label and footer', () => {
    const D = prepararDatos({ mes: '2026-10', productos: [prod()], pendientes: [{ nombre: 'Cal', art: '9', com: 5, ven: 0 }] });
    const html = renderToStaticMarkup(<VistaTodos productos={D.productos} pendientes={D.pendientes} onProducto={noop} />);
    expect(html).toContain('! Requiere confirmación');
    expect(html).toContain('faltan TN registradas');
    expect(html).toContain('Total con datos completos');
    expect(html).toContain('Remitos con error de tipeo');
  });

  it('pending actions card tells to open the month when it is not editable', () => {
    const html = renderToStaticMarkup(<AccionesPendientes lista={[P()]} editable={false} abrir={{ label: 'Abrir octubre 2026 para confirmar', onClick: noop }} onIr={noop} />);
    expect(html).toContain('Para confirmarlas o rechazarlas, abrí el mes.');
    expect(html).toContain('Abrir octubre 2026 para confirmar');
    expect(html).toContain('X · remito 123');
  });

  it('product view: balance tab totals, and fichas with confirm / reject when editable', () => {
    const base = { tab: 1 as const, onTab: noop, abiertos: new Set<string>(), onGrupo: noop, onFicha: noop, resaltar: null, onProducto: noop };
    const t1 = renderToStaticMarkup(<VistaProducto p={P()} edicion={null} {...base} />);
    expect(t1).toContain('Balance del mes');
    expect(t1).toContain('Ajustes explicados (1)');
    expect(t1).toContain('class="tot pend"');
    const edicion = { faltaMotivo: 'h1', onRevisar: noop, onComentario: noop, onComentarioListo: noop };
    const t2 = renderToStaticMarkup(<VistaProducto p={P()} edicion={edicion} {...base} tab={2} />);
    expect(t2).toContain('✓ Confirmar');
    expect(t2).toContain('✕ Rechazar');
    expect(t2).toContain('Escribí el motivo del rechazo y volvé a tocar &quot;Rechazar&quot;.');
    const ro = renderToStaticMarkup(<VistaProducto p={P()} edicion={null} {...base} tab={2} />);
    expect(ro).toContain('Para confirmar o rechazar, abrí el mes.');
    expect(ro).not.toContain('✓ Confirmar');
  });

  it('groups adjustments with the same concept', () => {
    const p = P({ ajustes: [aj({ id: 'a', cat: 'Diferencia de pesada', resp: 'Proveedor', tn: 0.5 }), aj({ id: 'b', cat: 'Diferencia de pesada', resp: 'Proveedor', tn: 0.25 })] });
    const html = renderToStaticMarkup(
      <VistaProducto p={p} tab={1} onTab={noop} edicion={null} abiertos={new Set()} onGrupo={noop} onFicha={noop} resaltar={null} onProducto={noop} />,
    );
    expect(html).toContain('class="grp"');
    expect(html).toContain('Pesada <span class="cant">(2)</span>');
    expect(html).toContain('+0,75');
  });
});

describe('open month components', () => {
  it('checklist and files list', () => {
    const ch = { mes: '2026-11', completo: false, faltan: 1, errores: [], grupos: [{ titulo: 'Lince', items: [
      { nombre: 'TN compradas', estado: 'ok' as const, detalle: '', requerido: true },
      { nombre: 'TN vendidas', estado: 'falta' as const, detalle: '', requerido: true },
    ] }] };
    const html = renderToStaticMarkup(<ChecklistMes ch={ch} />);
    expect(html).toContain('class="check-i falta"');
    expect(textoIncompleto(ch, null)).toBe('Agregalos con "+ Agregar archivos al mes actual". Cuando esté todo, aparece el tablero del mes.');
    expect(textoIncompleto(ch, 'Error de carga')).toBe('Error de carga');

    const files = renderToStaticMarkup(<ArchivosTabla archivos={[{ id: '1', nombre: 'c.xls', tipo: 'compradas', rs: 'LINCE', desde: '01/11/2026', hasta: '30/11/2026', avisos: ['aviso'], errores: ['error'] }]} onQuitar={noop} />);
    expect(files).toContain('TN compradas');
    expect(files).toContain('01/11/2026 al 30/11/2026');
    expect(files).toContain('class="mini error"');
    expect(files).toContain('Quitar');
    expect(renderToStaticMarkup(<ArchivosTabla archivos={[]} onQuitar={null} />)).not.toContain('Quitar');
  });
});
