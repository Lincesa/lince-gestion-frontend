// Dashboard pieces of balance-de-masas.html (tablero.js), as React components with the same markup and classes
// (styles in balance-masas.css, scoped under `.bm`).
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import type { ProductoSinDatos } from '@/types/balanceMasas.types';
import {
  accionesPendientes,
  agruparConceptos,
  clase,
  corto,
  decision,
  f2,
  fS,
  nombreMes,
  obsCard,
  plural,
  requiereConfirmacion,
  respTxt,
  resumenEstado,
  totalesTodos,
  type AjustePreparado,
  type FilaPendiente,
  type ProductoPreparado,
} from './tablero';

const varN = (n: number) => ({ '--n': n }) as CSSProperties;

// ---------------- Status ----------------

export function EstadoResumen({ lista, todos }: { lista: ProductoPreparado[]; todos: boolean }) {
  const e = resumenEstado(lista, todos);
  return (
    <div className="est-top">
      <div className={`est-big ${e.cls}`}>
        <div className="ic" aria-hidden="true">{e.ic}</div>
        <div>
          <div className="t1">{e.t1}</div>
          <div className="t2">{e.t2}</div>
        </div>
      </div>
      <div className="est-cnt">
        <div className={e.lin ? 'hot' : ''}>
          <div className="lb">Lince para revisar</div>
          <div className="nb">{e.lin}</div>
          <div className="sb">{e.lin ? 'Facturación o logística' : 'Sin casos'}</div>
        </div>
        <div>
          <div className="lb">Proveedor</div>
          <div className="nb" style={{ color: 'var(--prov-tx)' }}>{e.nProv}</div>
          <div className="sb">{f2(e.tProv)} t · no controlable</div>
        </div>
      </div>
    </div>
  );
}

// ---------------- Delivery notes with remarks ----------------

export function ObsCards({ lista, onProducto }: { lista: ProductoPreparado[]; onProducto: (k: string) => void }) {
  const card = (k: 'tipeo' | 'pesada', titulo: string, ico: string) => {
    const c = obsCard(lista, k);
    return (
      <div className="ob">
        <div className="ob-h"><span className="ob-ic" aria-hidden="true">{ico}</span>{titulo}</div>
        <div className="ob-big">
          <b>{c.n}</b>
          <span>{c.n === 1 ? 'remito' : 'remitos'} · {c.pct} % de {c.N} remitos del mes</span>
        </div>
        <div className="ob-sub">{c.n ? `${f2(c.tn)} t de diferencia en total` : 'Sin remitos con esta observación'}</div>
        {lista.length > 1
          ? c.prods.map((p) => (
            <button key={p.k} type="button" className="ob-it" onClick={() => onProducto(p.k)}>
              <span>{p.nombre}</span>
              <span>{p.obs[k].length} {p.obs[k].length === 1 ? 'remito' : 'remitos'} · {p.obs[k].map((x) => x.remito).join(', ')}</span>
            </button>
          ))
          : c.prods.flatMap((p) => p.obs[k]).map((x, i) => (
            <div key={i} className="ob-it">
              <span>Remito {x.remito} · {x.fecha.slice(0, 5)}</span>
              <span>{fS(x.dif)} t · {x.obs.replace(/\s+/g, ' ').toLowerCase()}</span>
            </div>
          ))}
      </div>
    );
  };
  return (
    <div className="obs">
      {card('tipeo', 'Remitos con error de tipeo', '✎')}
      {card('pesada', 'Remitos con diferencia de pesada', '⚖')}
    </div>
  );
}

// ---------------- Pending invoicing at close ----------------

export function PendientesFacturar({ lince, prov, onProducto }: { lince: FilaPendiente[]; prov: FilaPendiente[]; onProducto: (k: string) => void }) {
  const tarjeta = (cls: string, titulo: string, nota: string, filas: FilaPendiente[]) => {
    const tot = filas.reduce((s, x) => s + x.tn, 0);
    return (
      <div className={`dg ${cls}`}>
        <div className="dg-h"><span>{titulo}</span><span>{f2(tot)} t</span></div>
        <div className="dg-sub">{nota}</div>
        {filas.length ? filas.map((x) => (
          <button key={x.k} type="button" className="dg-it" onClick={() => onProducto(x.k)}>
            <span className="dg-n">{x.nombre}</span>
            <span className="dg-t">{f2(x.tn)} t</span>
            <span className="dg-c">
              {plural(x.n, 'viaje', 'viajes')}
              {x.ant ? ` · ${x.ant === x.n ? (x.n === 1 ? 'de un mes anterior' : 'todos de meses anteriores') : `${x.ant} de meses anteriores`}` : ''}
            </span>
          </button>
        )) : <div className="dg-sub">Sin pendientes.</div>}
      </div>
    );
  };
  return (
    <div className="dgs">
      {tarjeta('l', 'Pendientes de facturar por Lince', 'Viajes del mes que Lince no facturó en el mes (se facturan después del cierre o todavía no tienen factura de venta).', lince)}
      {tarjeta('p', 'Pendientes de facturar por el proveedor', 'Viajes que el proveedor todavía no facturó al cierre del mes, incluidos los que vienen de meses anteriores.', prov)}
    </div>
  );
}

// ---------------- Pending actions ----------------

export function AccionesPendientes({
  lista, editable, abrir, onIr,
}: {
  lista: ProductoPreparado[];
  editable: boolean;
  /** Button to open the closed month (only when it can be opened). */
  abrir: { label: string; onClick: () => void } | null;
  onIr: (k: string, id: string) => void;
}) {
  const { pend, conf, rech } = accionesPendientes(lista);
  const nota = pend.length
    ? (editable ? 'Tocá cada una para confirmarla o rechazarla en su ficha.' : 'Para confirmarlas o rechazarlas, abrí el mes.')
    : 'Sin acciones pendientes.';
  return (
    <div className={`dg a${pend.length ? ' hay' : ''}`} id="acciones">
      <div className="dg-h"><span>Acciones pendientes</span><span className="dg-nb">{pend.length}</span></div>
      <div className="dg-sub">{nota}</div>
      {conf || rech ? (
        <div className="dg-sub">
          {conf ? plural(conf, 'confirmado', 'confirmados') : ''}{conf && rech ? ' · ' : ''}{rech ? plural(rech, 'rechazado', 'rechazados') : ''}
        </div>
      ) : null}
      {pend.length && !editable && abrir ? (
        <div className="btns" style={{ margin: '4px 0 6px' }}>
          <button type="button" className="btn pri" onClick={abrir.onClick}>{abrir.label}</button>
        </div>
      ) : null}
      {pend.map(({ p, a }) => (
        <button key={a.id} type="button" className="dg-it" onClick={() => onIr(p.k, a.id)}>
          <span className="dg-n">{p.nombre}</span>
          <span className="dg-t">{fS(a.tn)} t</span>
          <span className="dg-c">{a.cat}{a.remito ? ` · remito ${a.remito.split(',')[0]}` : a.cbte ? ` · ${a.cbte}` : ''}</span>
        </button>
      ))}
    </div>
  );
}

// ---------------- All products ----------------

function CoinTd({ p }: { p: ProductoPreparado }) {
  if (p.estado === 'no') return <span className="coin no">✗ Diferencia {f2(p.dif)} t</span>;
  if (p.estado === 'pend') return <span className="coin pend">! Requiere confirmación</span>;
  if (p.estado === 'adj') return <span className="coin si">✓ Coincide, con ajustes</span>;
  return <span className="coin si">✓ Coinciden</span>;
}

export function VistaTodos({
  productos, pendientes, extra, onProducto,
}: { productos: ProductoPreparado[]; pendientes: ProductoSinDatos[]; extra?: ReactNode; onProducto: (k: string) => void }) {
  const tot = totalesTodos(productos);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="hint">Toneladas después de los ajustes explicados. En verde, las columnas coinciden; en rojo, queda una diferencia sin explicar. Elegí un producto para ver el detalle.</div>
      <div className="tablewrap">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead><TableHead>TN registradas</TableHead><TableHead>TN facturadas</TableHead><TableHead>TN compradas</TableHead><TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {productos.map((p) => {
              const est = p.ajustes.some((a) => a.resp === 'Sin explicar') ? 'var(--bad-bd)' : p.porConfirmar.length ? 'var(--warn-bd)' : 'var(--ok-bd)';
              const v = p.estado === 'no' ? 'vno' : p.estado === 'pend' ? 'vpend' : 'vsi';
              return (
                <tr
                  key={p.k}
                  className="go"
                  tabIndex={0}
                  onClick={() => onProducto(p.k)}
                  onKeyDown={(e) => { if (e.key === 'Enter') onProducto(p.k); }}
                >
                  <td><span className="dot" style={{ background: est }} />{p.nombre}{p.rs === 'LERCARA' ? <span className="tag">Lercara</span> : null}</td>
                  <td className={v}>{f2(p.ok.reg)}</td>
                  <td className={v}>{p.venta ? f2(p.ok.ven) : <span className="muted">No aplica</span>}</td>
                  <td className={v}>{f2(p.ok.com)}</td>
                  <td style={{ textAlign: 'center' }}><CoinTd p={p} /></td>
                </tr>
              );
            })}
            {pendientes.map((p) => (
              <tr key={`pend-${p.nombre}`} className="pend">
                <td><span className="dot" style={{ background: 'var(--line)' }} />{p.nombre}<span className="tag">faltan TN registradas</span></td>
                <td>—</td>
                <td>{p.ven ? f2(p.ven) : '—'}</td>
                <td>{f2(p.com)}</td>
                <td />
              </tr>
            ))}
          </TableBody>
          <tfoot>
            <tr><td>Total con datos completos</td><td>{f2(tot.reg)}</td><td>{f2(tot.ven)}</td><td>{f2(tot.com)}</td><td /></tr>
          </tfoot>
        </Table>
      </div>
      <ObsCards lista={productos} onProducto={onProducto} />
      {extra}
    </div>
  );
}

// ---------------- One product ----------------

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export interface EdicionRevision {
  faltaMotivo: string | null;
  onRevisar: (idHist: string, estado: 'confirmado' | 'rechazado') => void;
  onComentario: (idHist: string, texto: string) => void;
  onComentarioListo: () => void;
}

function Ficha({ a, edicion, resaltada }: { a: AjustePreparado; edicion: EdicionRevision | null; resaltada: boolean }) {
  const [est, dec] = decision(a);
  const req = requiereConfirmacion(a);
  const cls = req && !a.revision ? ' req' : '';
  let revision: ReactNode = null;
  if (req && edicion) {
    const on = (e: string) => (a.revision === e ? ' on' : '');
    revision = (
      <>
        <dt>Revisión</dt>
        <dd>
          <div className="rev">
            <button type="button" className={`rev-b si${on('confirmado')}`} onClick={() => edicion.onRevisar(a.idHist, 'confirmado')}>✓ Confirmar</button>
            <button type="button" className={`rev-b no${on('rechazado')}`} onClick={() => edicion.onRevisar(a.idHist, 'rechazado')}>✕ Rechazar</button>
            {a.revision
              ? <span className="hint">{a.revision === 'confirmado' ? 'Confirmado' : 'Rechazado'}{a.revisionFecha ? ` el ${a.revisionFecha}` : ''} · tocá de nuevo para dejarlo pendiente</span>
              : <span className="hint">Pendiente</span>}
          </div>
          <textarea
            placeholder="Comentario (obligatorio si rechazás)"
            value={a.justificacion || ''}
            autoFocus={edicion.faltaMotivo === a.idHist}
            onChange={(e) => edicion.onComentario(a.idHist, e.target.value)}
            onBlur={edicion.onComentarioListo}
          />
          {edicion.faltaMotivo === a.idHist ? <div className="rev-falta">Escribí el motivo del rechazo y volvé a tocar &quot;Rechazar&quot;.</div> : null}
        </dd>
      </>
    );
  } else if (req) {
    revision = (
      <>
        <dt>Revisión</dt>
        <dd>
          {a.revision === 'confirmado' ? <span className="pill okp">Confirmado</span> : a.revision === 'rechazado' ? <span className="pill nop">Rechazado</span> : <span className="pill req">Pendiente</span>}
          {a.revisionFecha ? a.revisionFecha : a.revision ? '' : 'Para confirmar o rechazar, abrí el mes.'}
        </dd>
        {a.justificacion ? <><dt>Comentario</dt><dd>{a.justificacion}</dd></> : null}
      </>
    );
  } else if (a.justificacion) {
    revision = <><dt>Justificación</dt><dd>{a.justificacion}</dd></>;
  }
  return (
    <article className={`ficha ${clase(a.resp)}${cls}${resaltada ? ' hl' : ''}`} id={`f-${a.id}`}>
      <div className="fh">
        <span>{a.cat}</span>
        <span>{a.neutro ? '0,00 t (se compensan)' : `${fS(a.tn)} t en ${a.col === 'ven' ? 'facturadas' : 'compradas'}`}</span>
      </div>
      <dl>
        <dt>Responsable</dt><dd>{respTxt(a.resp)}</dd>
        <dt>Qué pasó</dt><dd>{a.det}</dd>
        <dt>De dónde sale</dt><dd>{a.fuente}</dd>
        <dt>Decisión</dt><dd><span className={`pill ${est === 'Requiere confirmación' ? 'req' : ''}`}>{est}</span>{dec}</dd>
        {a.resuelto ? (
          <>
            <dt>Cómo terminó</dt>
            <dd>
              Facturado en {a.resuelto.factura}{a.resuelto.fecha ? ` el ${a.resuelto.fecha}` : ''} (se vio al cerrar {MESES[+a.resuelto.mes.slice(5) - 1]} {a.resuelto.mes.slice(0, 4)}).
            </dd>
          </>
        ) : null}
        {revision}
      </dl>
    </article>
  );
}

export function VistaProducto({
  p, tab, onTab, edicion, abiertos, onGrupo, onFicha, resaltar, extra, onProducto,
}: {
  p: ProductoPreparado;
  tab: 1 | 2;
  onTab: (t: 1 | 2) => void;
  edicion: EdicionRevision | null;
  /** Expanded concept groups ("product|column|concept"). */
  abiertos: Set<string>;
  onGrupo: (id: string, open: boolean) => void;
  onFicha: (id: string) => void;
  resaltar: string | null;
  extra?: ReactNode;
  onProducto: (k: string) => void;
}) {
  const vis = p.ajustes.filter((a) => !a.neutro);
  const ref = (a: AjustePreparado) => (a.remito ? ` · ${a.remito.split(',')[0]}` : a.cbte ? ` · ${a.cbte.split('-').pop()!.replace(/^0+/, '')}` : '');
  const tecla = (id: string) => (e: KeyboardEvent) => { if (e.key === 'Enter') onFicha(id); };
  const linea = (a: AjustePreparado) => (
    <div key={a.id} className={`aj ${clase(a.resp)}`} tabIndex={0} onClick={() => onFicha(a.id)} onKeyDown={tecla(a.id)}>
      <span>● {corto(a.cat)}{ref(a)}</span>
      <span>{fS(a.tn)}</span>
      <div className="tip"><b>De dónde sale:</b> {a.fuente}</div>
    </div>
  );
  const lineaDetalle = (a: AjustePreparado) => (
    <div key={a.id} className={`aj sub ${clase(a.resp)}`} tabIndex={0} onClick={() => onFicha(a.id)} onKeyDown={tecla(a.id)}>
      <span>{a.remito ? `Remito ${a.remito.split(',')[0]}` : a.cbte ? a.cbte : corto(a.cat)}</span>
      <span>{fS(a.tn)}</span>
      <div className="tip"><b>{a.cat}.</b> {a.det}</div>
    </div>
  );
  const conceptos = (l: AjustePreparado[]) => agruparConceptos(l).map(({ cat, items, tot }) => {
    if (items.length === 1) return linea(items[0]);
    const id = `${p.k}|${items[0].col}|${cat}`;
    return (
      <details key={id} className="grp" open={abiertos.has(id)} onToggle={(e) => onGrupo(id, (e.currentTarget as HTMLDetailsElement).open)}>
        <summary className={`aj ${clase(items[0].resp)}`}>
          <span><span className="flecha">▸</span> {corto(cat)} <span className="cant">({items.length})</span></span>
          <span>{fS(tot)}</span>
        </summary>
        <div className="grp-it">{items.map(lineaDetalle)}</div>
      </details>
    );
  });
  const col = (t: string, sis: number | undefined, c: 'ven' | 'com') => {
    const l = vis.filter((a) => a.col === c);
    return (
      <div className="col" key={c}>
        <h3>{t}</h3>
        <div className="body">
          <div className="row"><span className="l">Sistema</span><span>{f2(sis)}</span></div>
          {l.length ? conceptos(l) : <div className="none">Sin ajustes</div>}
        </div>
      </div>
    );
  };
  const cols: ReactNode[] = [
    <div className="col" key="reg">
      <h3>TN registradas</h3>
      <div className="body"><div className="row"><span className="l">Sistema</span><span>{f2(p.tot.reg)}</span></div><div className="none">Sin ajustes</div></div>
    </div>,
  ];
  const tots = [p.ok.reg];
  if (p.venta) { cols.push(col('TN facturadas', p.tot.ven, 'ven')); tots.push(p.ok.ven ?? 0); }
  cols.push(col('TN compradas', p.tot.com, 'com'));
  tots.push(p.ok.com);
  const n = cols.length;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="tabs" role="tablist">
        <button type="button" className={`tab ${tab === 1 ? 'on' : ''}`} role="tab" onClick={() => onTab(1)}>Balance del mes</button>
        <button type="button" className={`tab ${tab === 2 ? 'on' : ''}`} role="tab" onClick={() => onTab(2)}>Ajustes explicados ({p.ajustes.length})</button>
      </div>
      {tab === 1 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="hint">Pasá el mouse por un ajuste para ver de dónde sale; hacé clic para ver la explicación completa.</div>
          <div className="cols" style={varN(n)}>{cols}</div>
          <div className={`tot ${p.estado === 'pend' ? 'pend' : p.coinciden ? 'si' : 'no'}`} style={varN(n)}>
            {tots.map((t, i) => <div key={i}><span>Total</span><b>{f2(t)}</b></div>)}
          </div>
          {p.venta ? null : <div className="hint">Sin TN facturadas: este producto va a planta como insumo, así que se concilian registradas contra compradas.</div>}
          <ObsCards lista={[p]} onProducto={onProducto} />
          {extra}
        </div>
      ) : (
        <div className="fichas">
          {p.ajustes.length
            ? p.ajustes.map((a) => <Ficha key={a.id} a={a} edicion={edicion} resaltada={resaltar === a.id} />)
            : <div className="hint">Sin ajustes en el mes.</div>}
        </div>
      )}
    </div>
  );
}

export const etiquetaAbrir = (M: string) => `Abrir ${nombreMes(M)} para confirmar`;
