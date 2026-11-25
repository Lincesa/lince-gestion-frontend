// History of changes and backup: export historial_balance.xlsx (same layout as the original tool), import it once
// into an empty history (ADMIN), and the list of saves (who and when).
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { balanceMasasApi } from '@/api/balanceMasas';
import { Button } from '@/components/ui/Button';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { nombreMesTitulo } from '@/components/balance-masas/tablero';
import { useConfirmar } from '@/components/balance-masas/useConfirmar';
import type { EventoBalance } from '@/types/balanceMasas.types';
import { useBalanceMasas } from './BalanceMasasLayout';

const TIPO_EVENTO: Record<string, string> = {
  cierre: 'Cierre del mes',
  revisiones: 'Confirmaciones de ajustes',
  importacion: 'Importación de historial_balance.xlsx',
  arranque: 'Arranque',
};

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function HistorialPage() {
  const { estado, recargarEstado, canAdmin } = useBalanceMasas();
  const { confirmar, dialogo } = useConfirmar();
  const inputRef = useRef<HTMLInputElement>(null);
  const [eventos, setEventos] = useState<EventoBalance[] | null>(null);
  const [ocupado, setOcupado] = useState<'exportar' | 'importar' | null>(null);

  useEffect(() => {
    balanceMasasApi.eventos().then(setEventos).catch((e) => { setEventos([]); toast.error(e instanceof Error ? e.message : String(e)); });
  }, [estado.revision]);

  const vacio = !estado.mesesCerrados.length && !estado.ultimoMes;

  const exportar = async () => {
    setOcupado('exportar');
    try {
      const blob = await balanceMasasApi.exportarHistorial();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'historial_balance.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(null);
    }
  };

  const importar = async (archivo: File) => {
    if (!(await confirmar(`¿Importar ${archivo.name} como historial del balance?\n\nSolo se puede hacer una vez, con el historial vacío.`))) return;
    setOcupado('importar');
    try {
      const r = await balanceMasasApi.importarHistorial(archivo);
      toast.success(`Historial importado (${r.meses} ${r.meses === 1 ? 'mes' : 'meses'}).`);
      await recargarEstado();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(null);
    }
  };

  return (
    <>
      {dialogo}
      <header className="head">
        <div>
          <div className="k">Historial</div>
          <div className="mes">Cambios y respaldo</div>
          <div className="prod">
            {estado.mesesCerrados.length
              ? `${estado.mesesCerrados.length} ${estado.mesesCerrados.length === 1 ? 'mes cerrado' : 'meses cerrados'} · último: ${nombreMesTitulo(estado.ultimoMes)}`
              : 'Todavía no hay meses cerrados'}
          </div>
        </div>
      </header>

      <section className="paso">
        <h2>Respaldo</h2>
        <p className="hint">Descargá el historial completo en <b>historial_balance.xlsx</b>, con las mismas hojas que el archivo de la carpeta compartida.</p>
        <div className="btns">
          <Button variant="outline" onClick={() => void exportar()} loading={ocupado === 'exportar'}>Descargar historial_balance.xlsx</Button>
        </div>
        {canAdmin && vacio ? (
          <>
            <p className="hint">
              <b>Primera vez:</b> si ya venías usando la herramienta, importá el <b>historial_balance.xlsx</b> de la carpeta del balance para no empezar de cero.
            </p>
            <div className="btns">
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void importar(f);
                }}
              />
              <Button onClick={() => inputRef.current?.click()} loading={ocupado === 'importar'}>Importar historial_balance.xlsx</Button>
            </div>
          </>
        ) : null}
      </section>

      <section className="paso">
        <h2>Cambios guardados</h2>
        {!eventos ? <p className="hint">Cargando…</p> : !eventos.length ? <p className="hint">Todavía no hay cambios guardados.</p> : (
          <div className="tablewrap">
            <Table className="eventos">
              <TableHeader>
                <TableRow><TableHead>Fecha</TableHead><TableHead>Qué se guardó</TableHead><TableHead>Mes</TableHead><TableHead>Usuario</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {eventos.map((ev) => (
                  <tr key={ev.id}>
                    <td>{fechaHora(ev.creado_en)}</td>
                    <td style={{ textAlign: 'left' }}>{TIPO_EVENTO[ev.tipo] ?? ev.tipo}</td>
                    <td style={{ textAlign: 'left' }}>{ev.mes ? nombreMesTitulo(ev.mes) : '—'}</td>
                    <td style={{ textAlign: 'left' }}>{ev.usuario ?? '—'}</td>
                  </tr>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </>
  );
}
