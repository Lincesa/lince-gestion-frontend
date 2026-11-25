// "Resumen" of balance-de-masas.html (app.js resumen()): open-month card, header with product / month filters,
// status cards and the all-products table or the product view. Data comes from /api/balance-masas.
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { balanceMasasApi } from '@/api/balanceMasas';
import { Button } from '@/components/ui/Button';
import {
  ArchivosTabla, Banner, ChecklistMes, ChipPendientes, PanelMes, SelectMeses, TarjetaMes, ZonaArchivos, textoIncompleto, type Mensaje,
} from '@/components/balance-masas/MesAbierto';
import {
  AccionesPendientes, EstadoResumen, PendientesFacturar, VistaProducto, VistaTodos, etiquetaAbrir, type EdicionRevision,
} from '@/components/balance-masas/Tablero';
import {
  alternarRevision, conRevisiones, contarCambios, hoy, mesAnterior, mesesVisibles, nombreMes, nombreMesTitulo, pendientesFacturar,
  prepararDatos, tituloProducto, totalPorConfirmar,
} from '@/components/balance-masas/tablero';
import { useConfirmar } from '@/components/balance-masas/useConfirmar';
import type { MesCerrado, Revisiones, VistaBorrador } from '@/types/balanceMasas.types';
import { useBalanceMasas } from './BalanceMasasLayout';

const msj = (e: unknown) => (e instanceof Error ? e.message : String(e));
const EXCEL = /\.xlsx?$/i;
const hayRechazoSinMotivo = (r: Revisiones) => Object.values(r).some((x) => x.estado === 'rechazado' && !(x.comentario || '').trim());

export function ResumenPage() {
  const { estado, recargarEstado, canEdit, canAdmin } = useBalanceMasas();
  const [params, setParams] = useSearchParams();
  const { confirmar, dialogo } = useConfirmar();
  const inputRef = useRef<HTMLInputElement>(null);
  const modoAgregar = useRef<'mes' | 'sumar'>('mes');

  const [borrador, setBorrador] = useState<VistaBorrador | null>(null);
  const [revBorrador, setRevBorrador] = useState<Revisiones>({});
  const [cerrado, setCerrado] = useState<{ mes: string; data: MesCerrado } | null>(null);
  // Closed month opened to confirm / reject adjustments (saved when it is closed again).
  const [revisando, setRevisando] = useState<{ mes: string; data: MesCerrado } | null>(null);
  const [revLocal, setRevLocal] = useState<Revisiones>({});
  const [faltaMotivo, setFaltaMotivo] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<Mensaje | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [eligiendoMes, setEligiendoMes] = useState(false);
  const [mesPendiente, setMesPendiente] = useState<string | null>(null);
  const [verArchivos, setVerArchivos] = useState(false);
  const [tabDe, setTabDe] = useState<{ k: string; tab: 1 | 2 }>({ k: '', tab: 1 });
  const [resaltar, setResaltar] = useState<string | null>(null);
  const [irA, setIrA] = useState<string | null>(null);
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());

  const revBorradorRef = useRef(revBorrador);
  revBorradorRef.current = revBorrador;

  const aplicarBorrador = useCallback((b: VistaBorrador) => {
    setBorrador(b);
    setRevBorrador(b.revisiones);
  }, []);
  const cargarBorrador = useCallback(async () => {
    const b = await balanceMasasApi.borrador();
    aplicarBorrador(b);
    return b;
  }, [aplicarBorrador]);

  useEffect(() => {
    cargarBorrador().catch((e) => setMensaje({ tipo: 'bad', t1: 'No se pudo leer el mes abierto.', t2: msj(e) }));
  }, [cargarBorrador]);

  const setParam = useCallback((cambios: Record<string, string | null>) => {
    setParams((prev) => {
      const n = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(cambios)) if (v) n.set(k, v); else n.delete(k);
      return n;
    });
  }, [setParams]);

  const carga = borrador?.carga?.ok ? borrador.carga : null;
  const errorCarga = borrador?.carga && !borrador.carga.ok ? borrador.carga.error : null;
  const archivos = borrador?.archivos ?? [];
  const ch = borrador?.checklist ?? null;
  const meses = mesesVisibles(estado.mesesCerrados, carga?.mes ?? null);
  const mesParam = params.get('mes');
  const M = mesParam && meses.includes(mesParam) ? mesParam : (meses[meses.length - 1] ?? null);
  const k = params.get('producto') ?? '';
  const enCarga = !!carga && carga.mes === M;
  const enRevision = !!revisando && revisando.mes === M;
  const esCerrado = !!M && estado.mesesCerrados.includes(M);

  // Dashboard of the selected closed month (reloaded after every save: the revision changes).
  useEffect(() => {
    if (!M || enCarga || enRevision) return;
    let vivo = true;
    balanceMasasApi.mes(M)
      .then((data) => { if (vivo) setCerrado({ mes: M, data }); })
      .catch((e) => { if (vivo) setMensaje({ tipo: 'bad', t1: `No se pudo leer ${M}.`, t2: msj(e) }); });
    return () => { vivo = false; };
  }, [M, enCarga, enRevision, estado.revision]);

  const base = enCarga ? carga!.datos : enRevision ? revisando!.data.datos : cerrado?.mes === M ? cerrado.data.datos : null;
  const revs = enCarga ? revBorrador : enRevision ? revLocal : null;
  const D = useMemo(() => (base ? prepararDatos(revs ? conRevisiones(base, revs) : base) : null), [base, revs]);
  const p = D?.productos.find((x) => x.k === k) ?? null;
  const tab = tabDe.k === k ? tabDe.tab : 1;
  const editable = canEdit && (enCarga || enRevision);

  useEffect(() => {
    if (!resaltar) return;
    document.getElementById(`f-${resaltar}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [resaltar, tab, k]);
  useEffect(() => {
    if (!irA) return;
    document.getElementById(irA)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    setIrA(null);
  }, [irA, k]);

  const opcionPorDefecto = borrador?.opcionesMes.find((o) => o.porDefecto)?.mes ?? borrador?.opcionesMes[0]?.mes ?? null;
  const irAProducto = (kk: string) => { setParam({ producto: kk || null }); window.scrollTo({ top: 0 }); };
  const irAFicha = (kk: string, id: string) => { setParam({ producto: kk }); setTabDe({ k: kk, tab: 2 }); setResaltar(id); };

  // ---------------- Files ----------------

  const elegirArchivos = (modo: 'mes' | 'sumar') => {
    modoAgregar.current = modo;
    inputRef.current?.click();
  };

  const agregarArchivos = async (lista: File[], nuevoMes: boolean) => {
    const xs = lista.filter((f) => EXCEL.test(f.name));
    if (!xs.length) { setMensaje({ tipo: 'warn', t1: 'No hay archivos .xls para leer.' }); return; }
    if (nuevoMes && archivos.length) {
      const cual = ch?.mes ? nombreMes(ch.mes) : 'un mes';
      if (!(await confirmar(`Hay ${cual} abierto sin cerrar. ¿Descartarlo y empezar otro mes con estos archivos?\n\n(Para sumar archivos a ${cual}, usá "+ Agregar archivos al mes actual".)`))) return;
    }
    setOcupado(true);
    try {
      if (nuevoMes) {
        if (archivos.length) await balanceMasasApi.descartarBorrador();
        await balanceMasasApi.actualizarBorrador({ mesElegido: mesPendiente || opcionPorDefecto, revisiones: {} });
        setEligiendoMes(false);
        setMesPendiente(null);
        setRevisando(null);
      }
      const b = await balanceMasasApi.agregarArchivos(xs);
      aplicarBorrador(b);
      setMensaje(null);
      // When the month is complete, its dashboard is shown.
      if (b.carga?.ok && b.carga.mes !== carga?.mes) { setParam({ mes: b.carga.mes, producto: null }); setTabDe({ k: '', tab: 1 }); }
    } catch (e) {
      setMensaje({ tipo: 'bad', t1: 'No se pudieron leer los archivos.', t2: msj(e) });
      await cargarBorrador().catch(() => undefined);
    } finally {
      setOcupado(false);
    }
  };

  const conBorrador = async (fn: () => Promise<VistaBorrador>) => {
    try {
      aplicarBorrador(await fn());
    } catch (e) {
      setMensaje({ tipo: 'bad', t1: 'No se pudo completar la operación.', t2: msj(e) });
    }
  };

  const soltarEnPagina = (e: DragEvent) => {
    e.preventDefault();
    if (!canEdit || revisando || ocupado || !e.dataTransfer.files.length) return;
    // With an open month, what is dropped is added to it; otherwise it starts a new month.
    void agregarArchivos([...e.dataTransfer.files], !archivos.length);
  };

  // ---------------- Reviews ----------------

  const guardarRevBorrador = async (r: Revisiones) => {
    if (hayRechazoSinMotivo(r)) return;
    await conBorrador(() => balanceMasasApi.actualizarBorrador({ revisiones: r }));
  };

  const edicion: EdicionRevision | null = editable ? {
    faltaMotivo,
    onRevisar: (id, est) => {
      const actuales = enCarga ? revBorrador : revLocal;
      const r = alternarRevision(actuales, id, est, actuales[id]?.comentario ?? '', hoy());
      setFaltaMotivo(r.faltaMotivo);
      if (enCarga) {
        setRevBorrador(r.revisiones);
        if (!r.faltaMotivo) void guardarRevBorrador(r.revisiones);
      } else setRevLocal(r.revisiones);
    },
    onComentario: (id, texto) => {
      const upd = (prev: Revisiones) => ({ ...prev, [id]: { ...(prev[id] ?? { estado: '', comentario: '', fecha: '' }), comentario: texto } });
      if (enCarga) setRevBorrador(upd); else setRevLocal(upd);
    },
    onComentarioListo: () => {
      if (enCarga && borrador && contarCambios(borrador.revisiones, revBorradorRef.current)) void guardarRevBorrador(revBorradorRef.current);
    },
  } : null;

  // ---------------- Open / close / discard ----------------

  const abrirMes = () => {
    if (!M || cerrado?.mes !== M) return;
    setRevisando({ mes: M, data: cerrado.data });
    setRevLocal({ ...cerrado.data.revisiones });
    setFaltaMotivo(null);
    setMensaje(null);
  };

  const recargarTodo = () => Promise.all([recargarEstado(), cargarBorrador().catch(() => undefined)]);

  const cerrarRevision = async () => {
    if (!revisando) return;
    const R = revisando.mes;
    if (!contarCambios(revisando.data.revisiones, revLocal)) {
      setRevisando(null); setRevLocal({}); setFaltaMotivo(null);
      setMensaje({ tipo: 'ok', t1: `${nombreMesTitulo(R)} cerrado.`, t2: 'No había cambios para guardar.' });
      return;
    }
    const n = totalPorConfirmar(prepararDatos(conRevisiones(revisando.data.datos, revLocal)).productos);
    if (n && !(await confirmar(`${n === 1 ? 'Queda 1 acción pendiente' : `Quedan ${n} acciones pendientes`} (ajustes sin confirmar ni rechazar). ¿Cerrar igual?`))) return;
    setOcupado(true);
    try {
      await balanceMasasApi.revisarMes(R, revisando.data.revision, revLocal);
      setRevisando(null); setRevLocal({}); setFaltaMotivo(null);
      setMensaje({ tipo: 'ok', t1: `${nombreMesTitulo(R)} cerrado.`, t2: 'Quedó guardado en el historial.' });
      setParam({ mes: R });
      await recargarEstado();
    } catch (e) {
      // Someone else saved meanwhile (or the reviews are invalid): keep the reviews, reload the month and retry.
      setMensaje({ tipo: 'warn', t1: `No se pudo cerrar ${nombreMes(R)}.`, t2: `${msj(e)} Se volvió a leer el historial: revisalo y cerrá de nuevo.` });
      try {
        const data = await balanceMasasApi.mes(R);
        setRevisando({ mes: R, data });
      } catch { /* the message above already explains it */ }
      await recargarEstado();
    } finally {
      setOcupado(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const cerrar = async () => {
    if (revisando) { await cerrarRevision(); return; }
    if (!carga) return;
    setOcupado(true);
    try {
      // The reviews typed so far are saved first: the questions before saving depend on them.
      const fresca = await balanceMasasApi.actualizarBorrador({ revisiones: revBorradorRef.current });
      aplicarBorrador(fresca);
      const c = fresca.carga;
      if (!c?.ok) { setMensaje({ tipo: 'bad', t1: 'No se pudo cerrar el mes.', t2: c?.error ?? 'Faltan reportes para armar el mes.' }); return; }
      for (const pregunta of c.confirmaciones) if (!(await confirmar(pregunta))) return;
      const r = await balanceMasasApi.guardarMes(fresca.revision);
      setVerArchivos(false);
      setMensaje({ tipo: 'ok', t1: `${nombreMesTitulo(r.mes)} cerrado.`, t2: 'Quedó guardado en el historial.' });
      setParam({ mes: r.mes });
      await recargarTodo();
    } catch (e) {
      setMensaje({ tipo: 'warn', t1: 'No se cerró el mes.', t2: `${msj(e)} Se volvió a leer el historial y se rearmó el mes con tus archivos: revisalo y cerrá de nuevo.` });
      await recargarTodo();
    } finally {
      setOcupado(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const descartar = async () => {
    if (revisando) {
      if (contarCambios(revisando.data.revisiones, revLocal) && !(await confirmar(`¿Descartar las confirmaciones de ${nombreMes(revisando.mes)} que no se guardaron?`))) return;
      setRevisando(null); setRevLocal({}); setFaltaMotivo(null);
      return;
    }
    const cual = ch?.mes ? nombreMes(ch.mes) : 'el mes abierto';
    if (!(await confirmar(`¿Descartar ${cual} sin cerrarlo? Se quitan todos sus archivos.`))) return;
    await conBorrador(() => balanceMasasApi.descartarBorrador());
    setVerArchivos(false);
    setParam({ mes: null });
  };

  const verPendientes = () => { setParam({ producto: null }); setIrA('acciones'); };

  if (!borrador) {
    return <><Banner mensaje={mensaje} onCerrar={() => setMensaje(null)} /><p className="hint">Cargando…</p></>;
  }

  // ---------------- Render ----------------

  const botonCerrar = (mes: string) => (
    <Button onClick={() => void cerrar()} loading={ocupado} disabled={ocupado}>{ocupado ? 'Guardando…' : `Cerrar ${nombreMes(mes)}`}</Button>
  );
  const botonDescartar = (t: string) => <Button variant="outline" onClick={() => void descartar()} disabled={ocupado}>{t}</Button>;

  let barra: ReactNode = null;
  if (canEdit && !revisando) {
    barra = archivos.length ? (
      <>
        <Button size="lg" onClick={() => elegirArchivos('sumar')} disabled={ocupado}>+ Agregar archivos al mes actual</Button>
        <Button size="lg" variant="outline" onClick={() => { setEligiendoMes(true); setMesPendiente(opcionPorDefecto); }} disabled={ocupado}>+ Agregar mes</Button>
      </>
    ) : (
      <>
        {esCerrado && cerrado?.mes === M ? <Button size="lg" variant="outline" onClick={abrirMes}>Abrir {nombreMes(M!)}</Button> : null}
        <Button size="lg" onClick={() => { setEligiendoMes(true); setMesPendiente(opcionPorDefecto); }} disabled={ocupado}>+ Agregar mes</Button>
      </>
    );
  }

  const panelMes = eligiendoMes && borrador.opcionesMes.length ? (
    <PanelMes
      opciones={borrador.opcionesMes}
      mes={mesPendiente || opcionPorDefecto || borrador.opcionesMes[0].mes}
      hayAbierto={archivos.length > 0}
      onMes={setMesPendiente}
      onElegir={() => elegirArchivos('mes')}
      onCancelar={() => { setEligiendoMes(false); setMesPendiente(null); }}
    />
  ) : null;

  const selectMesAbierto = (
    <label className="mesab-sel">
      Mes que estás agregando{' '}
      {canEdit
        ? <SelectMeses opciones={borrador.opcionesMes} valor={borrador.mesElegido} onChange={(m) => void conBorrador(() => balanceMasasApi.actualizarBorrador({ mesElegido: m }))} />
        : <b>{borrador.mesElegido ? nombreMesTitulo(borrador.mesElegido) : '—'}</b>}
    </label>
  );
  const quitar = canEdit ? (id: string) => void conBorrador(() => balanceMasasApi.quitarArchivo(id)) : null;

  // New month still missing files (no dashboard yet).
  const incompleta = archivos.length && !carga && ch ? (
    <TarjetaMes
      kicker="Mes abierto · faltan archivos"
      titulo={nombreMesTitulo(ch.mes || borrador.mesElegido || '')}
      chips={<>
        {ch.faltan ? <span className="chip bad">✗ {ch.faltan === 1 ? 'Falta 1 archivo' : `Faltan ${ch.faltan} archivos`}</span> : null}
        <span className="chip">{archivos.length === 1 ? '1 archivo agregado' : `${archivos.length} archivos agregados`}</span>
      </>}
      botones={canEdit ? <>{botonDescartar('Descartar')}<Button onClick={() => elegirArchivos('sumar')} disabled={ocupado}>+ Agregar archivos</Button></> : null}
      cuerpo={
        <div className="mesab-body">
          <p className="hint">{textoIncompleto(ch, errorCarga)}</p>
          {selectMesAbierto}
          {ch.errores.length ? <ul className="avisos">{ch.errores.map((x, i) => <li key={i} className="error">{x}</li>)}</ul> : null}
          <ChecklistMes ch={ch} />
          <details className="todos"><summary>Archivos agregados ({archivos.length})</summary><ArchivosTabla archivos={archivos} onQuitar={quitar} /></details>
        </div>
      }
    />
  ) : null;

  let franja: ReactNode = null;
  if (revisando && D) {
    franja = !enRevision ? (
      <TarjetaMes tono="compacta" kicker="Mes abierto para revisar" titulo={nombreMesTitulo(revisando.mes)}
        botones={<Button variant="outline" onClick={() => setParam({ mes: revisando.mes })}>Ver {nombreMes(revisando.mes)}</Button>} />
    ) : (
      <TarjetaMes kicker="Mes abierto para revisar · los cambios se guardan al cerrar" titulo={nombreMesTitulo(revisando.mes)}
        chips={<ChipPendientes n={totalPorConfirmar(D.productos)} onClick={verPendientes} />}
        botones={<>{botonDescartar('Descartar cambios')}{botonCerrar(revisando.mes)}</>} />
    );
  } else if (carga && D) {
    if (!enCarga) {
      franja = (
        <TarjetaMes tono="compacta" kicker="Mes abierto · todavía no se cerró" titulo={nombreMesTitulo(carga.mes)}
          botones={<Button variant="outline" onClick={() => setParam({ mes: carga.mes })}>Ver {nombreMes(carga.mes)}</Button>} />
      );
    } else {
      const noCo = D.productos.filter((x) => x.estado === 'no').length;
      franja = (
        <TarjetaMes
          kicker={carga.recierre ? 'Volver a cerrar · al cerrar, reemplaza el cierre anterior' : 'Mes abierto · todavía no se cerró'}
          titulo={nombreMesTitulo(carga.mes)}
          chips={<>
            <button type="button" className="chip ok" onClick={() => setVerArchivos(!verArchivos)}>✓ {archivos.length} archivos completos {verArchivos ? '▴' : '▾'}</button>
            {carga.avisos.length ? <button type="button" className="chip" onClick={() => setVerArchivos(!verArchivos)}>{carga.avisos.length === 1 ? '1 aviso' : `${carga.avisos.length} avisos`}</button> : null}
            {noCo ? <span className="chip bad">✗ {noCo === 1 ? '1 producto no coincide' : `${noCo} productos no coinciden`}</span> : null}
            <ChipPendientes n={totalPorConfirmar(D.productos)} onClick={verPendientes} />
          </>}
          botones={canEdit ? <>{botonDescartar('Descartar')}{botonCerrar(carga.mes)}</> : null}
          cuerpo={verArchivos ? (
            <div className="mesab-body">
              {selectMesAbierto}
              {carga.conMesAnterior ? <p className="hint">Se usaron los archivos de {nombreMes(mesAnterior(carga.mes))} para reconocer los viajes de fin de ese mes.</p> : null}
              {carga.avisos.length ? <ul className="avisos">{carga.avisos.map((x, i) => <li key={i}>{x}</li>)}</ul> : null}
              {ch ? <ChecklistMes ch={ch} /> : null}
              <ArchivosTabla archivos={archivos} onQuitar={quitar} />
            </div>
          ) : null}
        />
      );
    }
  }

  const cabecera = (
    <>
      {barra ? <div className="barra"><div className="btns">{barra}</div></div> : null}
      {panelMes}
      <Banner mensaje={mensaje} onCerrar={() => setMensaje(null)} />
      {incompleta}
    </>
  );

  const contenedor = (hijos: ReactNode) => (
    <div className="contenido" onDragOver={(e) => e.preventDefault()} onDrop={soltarEnPagina}>
      {dialogo}
      <input
        ref={inputRef}
        type="file"
        accept=".xls,.xlsx"
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          if (files.length) void agregarArchivos(files, modoAgregar.current === 'mes');
        }}
      />
      {cabecera}
      {hijos}
    </div>
  );

  // No closed months yet.
  if (!meses.length || !M) {
    const abierto = archivos.length > 0;
    return contenedor(
      <>
        <header className="head"><div><div className="k">Balance de masas</div><div className="mes">Todavía no hay meses cerrados</div>
          <div className="prod">Lince y Lercara · todos los productos</div></div></header>
        <section className="paso">
          {canEdit ? (
            <ZonaArchivos
              titulo={abierto ? '+ Agregar archivos al mes actual' : '+ Agregar mes'}
              onClick={() => (abierto ? elegirArchivos('sumar') : (setEligiendoMes(true), setMesPendiente(opcionPorDefecto)))}
              onArchivos={(f) => void agregarArchivos(f, !abierto)}
            />
          ) : <p className="hint">Todavía no hay meses cerrados.</p>}
          <p className="hint"><b>Primera vez:</b> sumá también, del mes anterior, las TN registradas y el informe de remitos. Sirven para reconocer los viajes de fin de ese mes que el proveedor facturó después.</p>
          {canAdmin ? <p className="hint">¿Ya tenés <b>historial_balance.xlsx</b>? Importalo desde <Link className="link" to="/balance-masas/historial">Cambios y respaldo</Link> para no empezar de cero.</p> : null}
        </section>
      </>,
    );
  }

  if (!D) return contenedor(<p className="hint">Cargando {nombreMes(M)}…</p>);

  const etiquetaMes = (m: string) => nombreMesTitulo(m) + (carga && m === carga.mes ? ' (sin cerrar)' : revisando?.mes === m ? ' (abierto)' : '');
  const lista = p ? [p] : D.productos;
  const abrir = esCerrado && !enCarga && !archivos.length && !revisando && canEdit ? { label: etiquetaAbrir(M), onClick: abrirMes } : null;
  const filasPend = enCarga ? carga!.pendCierre : enRevision ? revisando!.data.pendientesCierre : (cerrado?.data.pendientesCierre ?? []);
  const pf = pendientesFacturar(D, M, p ? p.k : null, filasPend, estado.productos);
  const extra = (
    <>
      {lista.some((x) => x.porConfirmar.length) ? <AccionesPendientes lista={lista} editable={editable} abrir={abrir} onIr={irAFicha} /> : null}
      <PendientesFacturar lince={pf.lince} prov={pf.prov} onProducto={irAProducto} />
    </>
  );

  return contenedor(
    <>
      {franja}
      <header className="head">
        <div className="brandwrap"><div>
          <div className="k">Balance de masas · Resumen</div>
          <div className="mes">{nombreMesTitulo(M)}</div>
          <div className="prod">{p ? tituloProducto(p) : 'Todos los productos'}</div>
        </div></div>
        <div className="filtros">
          <label>Producto
            <select value={p ? p.k : ''} onChange={(e) => irAProducto(e.target.value)}>
              <option value="">Todos los productos</option>
              {D.productos.map((x) => <option key={x.k} value={x.k}>{x.nombre}</option>)}
              <optgroup label="Faltan TN registradas">
                {D.pendientes.map((x) => <option key={x.nombre} disabled>{x.nombre}</option>)}
              </optgroup>
            </select>
          </label>
          <label>Mes
            <select value={M} onChange={(e) => { setParam({ mes: e.target.value }); setMensaje(null); }}>
              {[...meses].reverse().map((m) => <option key={m} value={m}>{etiquetaMes(m)}</option>)}
            </select>
          </label>
        </div>
      </header>
      <section id="estado"><EstadoResumen lista={lista} todos={!p} /></section>
      <section id="vista">
        {p ? (
          <VistaProducto
            p={p}
            tab={tab}
            onTab={(t) => setTabDe({ k, tab: t })}
            edicion={edicion}
            abiertos={abiertos}
            onGrupo={(id, open) => setAbiertos((prev) => {
              const n = new Set(prev);
              if (open) n.add(id); else n.delete(id);
              return n;
            })}
            onFicha={(id) => irAFicha(p.k, id)}
            resaltar={resaltar}
            extra={extra}
            onProducto={irAProducto}
          />
        ) : <VistaTodos productos={D.productos} pendientes={D.pendientes} extra={extra} onProducto={irAProducto} />}
      </section>
    </>,
  );
}
