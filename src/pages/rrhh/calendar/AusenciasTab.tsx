import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { asistenciaApi } from '@/api/asistencia';
import { asistenciaCalendarApi } from '@/api/asistenciaCalendar';
import type { AusenciaEmpleado, EmpleadoAsistencia, TipoAusencia } from '@/types';
import { useCanPerform } from '@/hooks/useCanPerform';
import { ModuleKey } from '@/types/auth.types';
import { MonthGrid, type DayDecoration } from './MonthGrid';
import {
  dateToYmd,
  TIPO_AUSENCIA_COLOR,
  TIPO_AUSENCIA_EMOJI,
  TIPO_AUSENCIA_LABEL,
  ymdInRange,
} from './calendarHelpers';
import { formatHoursToHhMm, parseHhMmToHours } from '@/utils/horasJustificadas';

const TIPO_OPTIONS: TipoAusencia[] = [
  'vacaciones',
  'compensacion',
  'licencia_medica',
  'permiso_direccion',
  'otro',
];

export function AusenciasTab() {
  const { canEdit, canAdmin } = useCanPerform(ModuleKey.ASISTENCIA);
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const [empleados, setEmpleados] = useState<EmpleadoAsistencia[]>([]);
  const [search, setSearch] = useState('');
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);

  const [ausencias, setAusencias] = useState<AusenciaEmpleado[]>([]);
  const [loadingEmps, setLoadingEmps] = useState(false);
  const [loadingAus, setLoadingAus] = useState(false);

  // Editor inline
  const [editor, setEditor] = useState<{
    desde: string;
    hasta: string;
    existing?: AusenciaEmpleado;
  } | null>(null);
  const [formTipo, setFormTipo] = useState<TipoAusencia>('vacaciones');
  const [formMotivo, setFormMotivo] = useState('');
  const [formHorasJustificadas, setFormHorasJustificadas] = useState('');
  const [saving, setSaving] = useState(false);

  // Cargar empleados al montar (ambas plantas)
  useEffect(() => {
    const load = async () => {
      setLoadingEmps(true);
      try {
        const data = await asistenciaApi.getEmpleados();
        setEmpleados(data);
        if (data.length > 0 && !selectedEmpId) setSelectedEmpId(data[0].id);
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setLoadingEmps(false);
      }
    };
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cargar ausencias del empleado seleccionado en un rango amplio (año actual ± 1)
  useEffect(() => {
    if (!selectedEmpId) {
      setAusencias([]);
      return;
    }
    const load = async () => {
      setLoadingAus(true);
      try {
        const desde = `${year - 1}-01-01`;
        const hasta = `${year + 1}-12-31`;
        const rows = await asistenciaCalendarApi.listAusencias({
          empleadoId: selectedEmpId,
          desde,
          hasta,
        });
        setAusencias(rows);
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setLoadingAus(false);
      }
    };
    void load();
  }, [selectedEmpId, year]);

  const filteredEmps = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return empleados;
    return empleados.filter(
      (e) =>
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
        e.pin.includes(q),
    );
  }, [empleados, search]);

  const ausenciasOrdenadas = useMemo(
    () => [...ausencias].sort((a, b) => (a.desde < b.desde ? 1 : -1)),
    [ausencias],
  );

  const openEditorForRange = (desde: string, hasta: string) => {
    setEditor({ desde, hasta });
    setFormTipo('vacaciones');
    setFormMotivo('');
    setFormHorasJustificadas('');
  };

  const openEditorForExisting = (a: AusenciaEmpleado) => {
    setEditor({ desde: a.desde, hasta: a.hasta, existing: a });
    setFormTipo(a.tipo);
    setFormMotivo(a.motivo ?? '');
    setFormHorasJustificadas(a.horasJustificadas != null ? formatHoursToHhMm(a.horasJustificadas) : '');
  };

  const closeEditor = () => setEditor(null);

  const save = async () => {
    if (!editor || !selectedEmpId) return;
    const parsed = parseHhMmToHours(formHorasJustificadas);
    if (!parsed.ok) {
      toast.error(parsed.error);
      return;
    }
    const horasJustificadas = parsed.hours;
    setSaving(true);
    try {
      if (editor.existing) {
        await asistenciaCalendarApi.updateAusencia(editor.existing.id, {
          desde: editor.desde,
          hasta: editor.hasta,
          tipo: formTipo,
          motivo: formMotivo.trim() || null,
          horasJustificadas,
        });
        toast.success('Ausencia actualizada');
      } else {
        await asistenciaCalendarApi.createAusencia({
          empleadoId: selectedEmpId,
          desde: editor.desde,
          hasta: editor.hasta,
          tipo: formTipo,
          motivo: formMotivo.trim() || null,
          horasJustificadas,
        });
        toast.success('Ausencia agregada');
      }
      closeEditor();
      // Recargar
      const desde = `${year - 1}-01-01`;
      const hasta = `${year + 1}-12-31`;
      const rows = await asistenciaCalendarApi.listAusencias({
        empleadoId: selectedEmpId,
        desde,
        hasta,
      });
      setAusencias(rows);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar esta ausencia?')) return;
    try {
      await asistenciaCalendarApi.deleteAusencia(id);
      toast.success('Eliminada');
      setAusencias((cur) => cur.filter((a) => a.id !== id));
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
      {/* Lista empleados */}
      <div className="border rounded-lg overflow-hidden flex flex-col max-h-[560px]">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar empleado…"
              className="w-full pl-7 pr-2 py-1.5 text-sm rounded-md bg-background border border-border"
            />
          </div>
        </div>
        <div className="overflow-y-auto flex-1">
          {loadingEmps ? (
            <div className="p-4 text-center text-muted-foreground text-sm">Cargando…</div>
          ) : filteredEmps.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">Sin resultados</div>
          ) : (
            filteredEmps.map((e) => {
              const active = e.id === selectedEmpId;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setSelectedEmpId(e.id)}
                  className={`w-full text-left px-3 py-2 text-sm border-b last:border-b-0 transition ${
                    active ? 'bg-primary/10 border-l-4 border-l-primary' : 'hover:bg-accent'
                  }`}
                >
                  <div className="font-medium truncate">
                    {e.firstName} {e.lastName}
                  </div>
                  <div className="text-[10px] text-muted-foreground flex gap-2">
                    <span>PIN {e.pin}</span>
                    <span>·</span>
                    <span className="capitalize">{e.planta === 'tucuman' ? 'Tucumán' : 'Villa Nueva'}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Calendario + lista cronológica */}
      <div className="space-y-4">
        {selectedEmpId ? (
          <>
            <div className="relative">
              {loadingAus && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
              <MonthGrid
                year={year}
                month={month}
                onChangeMonth={(y, m) => {
                  setYear(y);
                  setMonth(m);
                }}
                selectableRange
                onRangeSelected={(desde, hasta) => {
                  // Si el rango es 1 día y ya hay ausencia que lo cubre, editar
                  const hit = ausencias.find((a) => ymdInRange(desde, a.desde, a.hasta));
                  if (hit) openEditorForExisting(hit);
                  else openEditorForRange(desde, hasta);
                }}
                decorateDay={(cell): DayDecoration | undefined => {
                  const hit = ausencias.find((a) => ymdInRange(cell.ymd, a.desde, a.hasta));
                  if (!hit) return undefined;
                  return {
                    bgClass: 'bg-opacity-70',
                    badges: (
                      <div className="flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full ${TIPO_AUSENCIA_COLOR[hit.tipo]}`} />
                        <span className="text-[10px] truncate">{TIPO_AUSENCIA_EMOJI[hit.tipo]}</span>
                      </div>
                    ),
                    tooltip: `${TIPO_AUSENCIA_LABEL[hit.tipo]}${hit.horasJustificadas != null ? ` · ${formatHoursToHhMm(hit.horasJustificadas)} justificadas` : ''}${hit.motivo ? ` — ${hit.motivo}` : ''} (${hit.desde} → ${hit.hasta})`,
                  };
                }}
              />
              <div className="text-xs text-muted-foreground mt-2">
                Arrastrá sobre el calendario para crear un rango. Click en un día con ausencia para editarla.
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div className="px-3 py-2 border-b bg-muted/30 text-xs font-semibold">
                Ausencias del empleado
              </div>
              {ausenciasOrdenadas.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Sin ausencias cargadas.
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto">
                  {ausenciasOrdenadas.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between px-3 py-2 text-sm border-b last:border-b-0"
                    >
                      <button
                        type="button"
                        onClick={() => openEditorForExisting(a)}
                        className="flex-1 text-left flex items-center gap-2"
                      >
                        <span className={`w-2.5 h-2.5 rounded-full ${TIPO_AUSENCIA_COLOR[a.tipo]}`} />
                        <span className="font-medium">{TIPO_AUSENCIA_LABEL[a.tipo]}</span>
                        <span className="text-muted-foreground text-xs">
                          {a.desde === a.hasta ? a.desde : `${a.desde} → ${a.hasta}`}
                        </span>
                        {a.horasJustificadas != null && (
                          <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">
                            {formatHoursToHhMm(a.horasJustificadas)} justificadas
                          </span>
                        )}
                        {a.motivo && (
                          <span className="text-xs italic text-muted-foreground truncate ml-2">
                            "{a.motivo}"
                          </span>
                        )}
                      </button>
                      {canAdmin && (
                        <button
                          type="button"
                          onClick={() => remove(a.id)}
                          className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded text-rose-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <UserRound className="h-10 w-10 mb-2 opacity-50" />
            <p className="text-sm">Seleccioná un empleado para gestionar sus ausencias.</p>
          </div>
        )}
      </div>

      {editor && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto overscroll-contain p-4 bg-black/40"
          onClick={closeEditor}
        >
          <div
            className="bg-card rounded-lg border shadow-xl w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">
                {editor.existing ? 'Editar ausencia' : 'Nueva ausencia'}
              </h3>
              <span className="text-xs text-muted-foreground">
                {editor.desde === editor.hasta
                  ? editor.desde
                  : `${editor.desde} → ${editor.hasta}`}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium mb-1 block">Tipo</label>
                <select
                  value={formTipo}
                  onChange={(e) => setFormTipo(e.target.value as TipoAusencia)}
                  className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background"
                >
                  {TIPO_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {TIPO_AUSENCIA_EMOJI[t]} {TIPO_AUSENCIA_LABEL[t]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium mb-1 block">Desde</label>
                  <input
                    type="date"
                    value={editor.desde}
                    onChange={(e) => setEditor({ ...editor, desde: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Hasta</label>
                  <input
                    type="date"
                    value={editor.hasta}
                    onChange={(e) => setEditor({ ...editor, hasta: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block">Motivo (opcional)</label>
                <textarea
                  value={formMotivo}
                  onChange={(e) => setFormMotivo(e.target.value)}
                  rows={3}
                  placeholder="Detalle…"
                  className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background"
                />
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block">Horas justificadas (opcional)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={formHorasJustificadas}
                  onChange={(e) => setFormHorasJustificadas(e.target.value)}
                  placeholder="7:53 (vacío = día completo)"
                  className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Formato H:MM para retiros parciales. Vacío justifica el día completo.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t">
              <button
                type="button"
                onClick={closeEditor}
                disabled={saving}
                className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent"
              >
                {canEdit ? 'Cancelar' : 'Cerrar'}
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="px-4 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? 'Guardando…' : editor.existing ? 'Actualizar' : 'Guardar'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
