// Side menu "TN registradas · TN vendidas · TN compradas · Informe de remitos" of balance-de-masas.html
// (reportes.js): the history of each ERP report, filterable by product and month. The open month's rows come
// from the month being built.
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { balanceMasasApi } from '@/api/balanceMasas';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import {
  COLS_REPORTE, HOJA_REPORTE, MAX_FILAS_REPORTE, TITULOS_REPORTE, f2, filtrarReporte, mesesVisibles, nombreMesTitulo, unirDetalleAbierto,
} from '@/components/balance-masas/tablero';
import type { FilaReporte, TipoReporte, VistaBorrador } from '@/types/balanceMasas.types';
import { useBalanceMasas } from './BalanceMasasLayout';

const TIPOS = Object.keys(TITULOS_REPORTE) as TipoReporte[];

export function ReportePage() {
  const { tipo: tipoParam } = useParams();
  const { estado } = useBalanceMasas();
  const [params, setParams] = useSearchParams();
  const [borrador, setBorrador] = useState<VistaBorrador | null>(null);
  const [filas, setFilas] = useState<FilaReporte[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tipo = TIPOS.includes(tipoParam as TipoReporte) ? (tipoParam as TipoReporte) : null;
  const carga = borrador?.carga?.ok ? borrador.carga : null;
  const meses = mesesVisibles(estado.mesesCerrados, carga?.mes ?? null);
  // Month filter: '' = all months; by default the last month.
  const mesParam = params.get('mes');
  const mes = mesParam === null ? (meses[meses.length - 1] ?? '') : meses.includes(mesParam) ? mesParam : '';
  const prod = params.get('producto') ?? '';

  useEffect(() => {
    balanceMasasApi.borrador().then(setBorrador).catch(() => setBorrador(null));
  }, []);

  useEffect(() => {
    if (!tipo) return;
    let vivo = true;
    setFilas(null);
    // Rows of the open month come from the draft, not from the history.
    const soloAbierto = !!carga && mes === carga.mes && !estado.mesesCerrados.includes(mes);
    (soloAbierto ? Promise.resolve([]) : balanceMasasApi.reporte(tipo, { mes: mes || undefined, producto: prod || undefined }))
      .then((xs) => { if (vivo) { setFilas(xs); setError(null); } })
      .catch((e) => { if (vivo) setError(e instanceof Error ? e.message : String(e)); });
    return () => { vivo = false; };
  }, [tipo, mes, prod, carga, estado.mesesCerrados, estado.revision]);

  const r = useMemo(() => {
    if (!tipo || !filas) return null;
    const todas = carga ? unirDetalleAbierto(filas, carga.mes, carga.detalle[HOJA_REPORTE[tipo]]) : filas;
    return filtrarReporte(tipo, todas, { mes, prod });
  }, [tipo, filas, carga, mes, prod]);

  if (!tipo) return <Navigate to="/balance-masas" replace />;

  const nombres = Object.fromEntries(estado.productos.map((p) => [p.clave, p.nombre]));
  const etiquetaMes = (m: string) => nombreMesTitulo(m) + (carga && m === carga.mes ? ' (sin cerrar)' : '');
  const sub = `${prod ? nombres[prod] ?? prod : 'Todos los productos'} · ${mes ? nombreMesTitulo(mes) : 'todos los meses'}`;
  const cols = COLS_REPORTE[tipo];
  const setFiltro = (k: string, v: string) => setParams((prev) => {
    const n = new URLSearchParams(prev);
    n.set(k, v);
    return n;
  });

  return (
    <>
      <header className="head">
        <div>
          <div className="k">Historial de reportes</div>
          <div className="mes">{TITULOS_REPORTE[tipo]}</div>
          <div className="prod">{sub}</div>
        </div>
        <div className="filtros">
          <label>Producto
            <select value={prod} onChange={(e) => setFiltro('producto', e.target.value)}>
              <option value="">Todos los productos</option>
              {estado.productos.map((p) => <option key={p.clave} value={p.clave}>{p.nombre}</option>)}
            </select>
          </label>
          <label>Mes
            <select value={mes} onChange={(e) => setFiltro('mes', e.target.value)}>
              <option value="">Todos los meses</option>
              {[...meses].reverse().map((m) => <option key={m} value={m}>{etiquetaMes(m)}</option>)}
            </select>
          </label>
        </div>
      </header>
      {error ? (
        <div className="banner bad" role="status"><div className="ico">✕</div><div><div className="t1">No se pudo leer el reporte.</div><div className="t2">{error}</div></div></div>
      ) : null}
      {!meses.length ? (
        <section className="paso"><p className="hint">Todavía no hay meses cerrados.</p></section>
      ) : !r ? (
        !error ? <p className="hint">Cargando…</p> : null
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {r.filas.length > MAX_FILAS_REPORTE
            ? <div className="hint">Se muestran las primeras {MAX_FILAS_REPORTE.toLocaleString('es-AR')} filas: filtrá por mes o producto para ver el resto.</div>
            : null}
          {!r.filas.length ? (
            <div className="paso"><p className="hint">No hay filas de {TITULOS_REPORTE[tipo]} para este filtro.</p></div>
          ) : (
            <div className="tablewrap">
              <Table className="rep">
                <TableHeader>
                  <TableRow>{cols.map(([t, , n]) => <TableHead key={t} className={n ? 'n' : ''}>{t}</TableHead>)}</TableRow>
                </TableHeader>
                <TableBody>
                  {r.filas.slice(0, MAX_FILAS_REPORTE).map((fila, i) => (
                    <tr key={i}>
                      {cols.map(([, c, t]) => {
                        if (t) return <td key={c} className={`n${c === 'diferencia' && Math.abs(Number(fila[c])) >= 0.005 ? ' dif' : ''}`}>{f2(fila[c])}</td>;
                        if (c === 'producto') return <td key={c}>{fila[c] ? nombres[String(fila[c])] || fila[c] : <span className="muted">Sin asignar</span>}</td>;
                        return <td key={c}>{fila[c] ?? ''}</td>;
                      })}
                    </tr>
                  ))}
                </TableBody>
                <tfoot>
                  <tr>
                    <td>Total · {r.filas.length.toLocaleString('es-AR')} {r.filas.length === 1 ? 'fila' : 'filas'}</td>
                    {cols.slice(1).map(([, c, t]) => <td key={c} className={t ? 'n' : ''}>{t ? f2(r.totales[c]) : ''}</td>)}
                  </tr>
                </tfoot>
              </Table>
            </div>
          )}
        </div>
      )}
    </>
  );
}
