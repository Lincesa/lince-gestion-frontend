// Open month pieces of balance-de-masas.html (app.js): message banner, "¿Qué mes vas a agregar?",
// the open-month card, the checklist of reports and the list of added files.
import { useState, type DragEvent, type ReactNode } from 'react';
import type { ArchivoBorrador, Checklist, OpcionMes } from '@/types/balanceMasas.types';
import { nombreMes, nombreMesTitulo } from './tablero';

// ---------------- Message ----------------

export interface Mensaje {
  tipo: 'ok' | 'warn' | 'bad';
  t1: string;
  t2?: string;
  lista?: string[];
}

export function Banner({ mensaje, onCerrar }: { mensaje: Mensaje | null; onCerrar: () => void }) {
  if (!mensaje) return null;
  const ico = mensaje.tipo === 'ok' ? '✓' : mensaje.tipo === 'bad' ? '✕' : '!';
  return (
    <div className={`banner ${mensaje.tipo}`} role="status">
      <div className="ico">{ico}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="t1">{mensaje.t1}</div>
        {mensaje.t2 ? <div className="t2">{mensaje.t2}</div> : null}
        {mensaje.lista?.length ? <ul className="avisos" style={{ marginTop: 8 }}>{mensaje.lista.map((x, i) => <li key={i}>{x}</li>)}</ul> : null}
      </div>
      <button type="button" className="cerrar-msj" onClick={onCerrar} aria-label="Cerrar aviso">×</button>
    </div>
  );
}

// ---------------- Month selector ----------------

export function SelectMeses({ opciones, valor, onChange }: { opciones: OpcionMes[]; valor: string | null; onChange: (mes: string) => void }) {
  const ops = [...opciones];
  if (valor && !ops.some((o) => o.mes === valor)) ops.unshift({ mes: valor, etiqueta: nombreMesTitulo(valor) });
  return (
    <select className="sel-mes" value={valor ?? ''} onChange={(e) => onChange(e.target.value)}>
      {ops.map((o) => <option key={o.mes} value={o.mes}>{o.etiqueta}</option>)}
    </select>
  );
}

/** "+ Agregar mes": first the month, then the files. */
export function PanelMes({
  opciones, mes, hayAbierto, onMes, onElegir, onCancelar,
}: { opciones: OpcionMes[]; mes: string; hayAbierto: boolean; onMes: (m: string) => void; onElegir: () => void; onCancelar: () => void }) {
  return (
    <section className="paso">
      <h2>¿Qué mes vas a agregar?</h2>
      <div className="btns">
        <SelectMeses opciones={opciones} valor={mes} onChange={onMes} />
        <button type="button" className="btn pri" onClick={onElegir}>Elegir archivos de {nombreMes(mes)}</button>
        <button type="button" className="btn" onClick={onCancelar}>Cancelar</button>
      </div>
      <p className="hint">Podés elegir todos los archivos juntos, o algunos ahora y el resto después con &quot;+ Agregar archivos al mes actual&quot;.</p>
      {hayAbierto ? <p className="hint">Hay un mes abierto sin cerrar: si seguís, se descarta. Para sumarle archivos, usá &quot;+ Agregar archivos al mes actual&quot;.</p> : null}
    </section>
  );
}

// ---------------- Checklist and files ----------------

const ICO = { ok: '✓', falta: '✗', corto: '!', opcional: '○' } as const;

export function ChecklistMes({ ch }: { ch: Checklist }) {
  return (
    <div className="check">
      {ch.grupos.map((g) => (
        <div className="check-g" key={g.titulo}>
          <div className="check-t">{g.titulo}</div>
          {g.nota ? <div className="hint">{g.nota}</div> : null}
          {g.items.map((it) => (
            <div className={`check-i ${it.estado}`} key={it.nombre}>
              <span className="ic">{ICO[it.estado]}</span>
              <span>
                {it.nombre}
                {it.estado === 'corto' || (it.estado === 'opcional' && it.detalle) ? <div className="mini">{it.detalle}</div> : null}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

const NOMBRE_TIPO: Record<string, string> = {
  compradas: 'TN compradas',
  vendidas: 'TN vendidas',
  registradas: 'TN registradas',
  remitos: 'Informe de remitos',
};

export function ArchivosTabla({ archivos, onQuitar }: { archivos: ArchivoBorrador[]; onQuitar: ((id: string) => void) | null }) {
  return (
    <div className="tablewrap">
      <table className="rec">
        <thead><tr><th>Archivo</th><th>Reporte</th><th>Razón social</th><th>Período</th><th>Producto</th><th /></tr></thead>
        <tbody>
          {archivos.map((a) => (
            <tr key={a.id}>
              <td>
                {a.nombre}
                {(a.errores || []).map((x, i) => <div key={`e${i}`} className="mini error">{x}</div>)}
                {(a.avisos || []).map((x, i) => <div key={`a${i}`} className="mini">{x}</div>)}
              </td>
              <td>{(a.tipo && NOMBRE_TIPO[a.tipo]) || 'No reconocido'}</td>
              <td>{a.rs === 'LERCARA' ? 'Lercara' : a.rs === 'LINCE' ? 'Lince' : '—'}</td>
              <td>{a.desde ? `${a.desde} al ${a.hasta || '?'}` : ''}</td>
              <td>{(a.productos || []).join(', ')}</td>
              <td>{onQuitar ? <button type="button" className="link" onClick={() => onQuitar(a.id)}>Quitar</button> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------- Open month card ----------------

export function TarjetaMes({
  kicker, titulo, chips, botones, cuerpo, tono = '',
}: { kicker: string; titulo: string; chips?: ReactNode; botones: ReactNode; cuerpo?: ReactNode; tono?: string }) {
  return (
    <section className={`mesab ${tono}`}>
      <div className="mesab-top">
        <div className="mesab-txt">
          <div className="mesab-k">{kicker}</div>
          <div className="mesab-t">{titulo}</div>
          <div className="chips">{chips}</div>
        </div>
        <div className="btns">{botones}</div>
      </div>
      {cuerpo}
    </section>
  );
}

export function ChipPendientes({ n, onClick }: { n: number; onClick: () => void }) {
  return n
    ? <button type="button" className="chip pend" onClick={onClick}>! {n === 1 ? '1 acción pendiente' : `${n} acciones pendientes`}</button>
    : <span className="chip ok">✓ Sin acciones pendientes</span>;
}

/** Text under the title of an incomplete month (franjaIncompleta). */
export function textoIncompleto(ch: Checklist, errorCarga: string | null) {
  if (ch.errores.length) return 'Hay archivos repetidos con fechas que se pisan: quitá uno de cada par.';
  if (errorCarga) return errorCarga;
  if (ch.faltan) return 'Agregalos con "+ Agregar archivos al mes actual". Cuando esté todo, aparece el tablero del mes.';
  return 'Agregá los reportes del ERP del mes.';
}

// ---------------- Drop zone ----------------

export function ZonaArchivos({ titulo, onClick, onArchivos }: { titulo: string; onClick: () => void; onArchivos: (f: File[]) => void }) {
  const [encima, setEncima] = useState(false);
  const soltar = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEncima(false);
    if (e.dataTransfer.files.length) onArchivos([...e.dataTransfer.files]);
  };
  return (
    <div
      className={`zona${encima ? ' encima' : ''}`}
      tabIndex={0}
      role="button"
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      onDragOver={(e) => { e.preventDefault(); setEncima(true); }}
      onDragLeave={() => setEncima(false)}
      onDrop={soltar}
    >
      <strong>{titulo}</strong>
      Hacé clic o arrastralos acá. Podés agregarlos de a uno o todos juntos: TN compradas, TN vendidas e informe de remitos de Lince y de Lercara, y las TN registradas de cada producto.
    </div>
  );
}
