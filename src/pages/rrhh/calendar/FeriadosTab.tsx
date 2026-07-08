import { useEffect, useMemo, useState } from 'react';
import { Calendar, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { asistenciaCalendarApi } from '@/api/asistenciaCalendar';
import type { DiaNoLaborable, Planta, TipoExcepcionDia } from '@/types';
import { MonthGrid, type DayDecoration } from './MonthGrid';
import { dateToYmd, plantaLabel } from './calendarHelpers';

const PLANTA_OPTIONS: { value: Planta; short: string; chipClass: string }[] = [
  { value: 'villa_nueva', short: 'VN', chipClass: 'bg-rose-500 text-white' },
  { value: 'tucuman',     short: 'TUC', chipClass: 'bg-amber-500 text-white' },
];

function bgForRegistro(d: DiaNoLaborable): string {
  if (d.tipoExcepcion === 'laborable') return 'bg-emerald-100 dark:bg-emerald-900/40';
  const vn = d.plantas.includes('villa_nueva');
  const tuc = d.plantas.includes('tucuman');
  if (vn && tuc) return 'bg-violet-200 dark:bg-violet-900/50';
  if (vn) return 'bg-rose-200 dark:bg-rose-900/50';
  return 'bg-amber-200 dark:bg-amber-900/50';
}

export function FeriadosTab() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [items, setItems] = useState<DiaNoLaborable[]>([]);
  const [loading, setLoading] = useState(false);

  // Popover de creación/edición
  const [editor, setEditor] = useState<{
    ymd: string;
    existing?: DiaNoLaborable;
  } | null>(null);
  const [formPlantas, setFormPlantas] = useState<Planta[]>(['villa_nueva', 'tucuman']);
  const [formMotivo, setFormMotivo] = useState('');
  const [formTipo, setFormTipo] = useState<TipoExcepcionDia>('no_laborable');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const desde = dateToYmd(new Date(year, month - 1, 1));
      const hasta = dateToYmd(new Date(year, month + 2, 0));
      const rows = await asistenciaCalendarApi.listDiasNoLaborables(desde, hasta);
      setItems(rows);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const byYmd = useMemo(() => {
    const m = new Map<string, DiaNoLaborable[]>();
    for (const it of items) {
      const arr = m.get(it.fecha) ?? [];
      arr.push(it);
      m.set(it.fecha, arr);
    }
    return m;
  }, [items]);

  const openEditor = (ymd: string, existing?: DiaNoLaborable) => {
    setEditor({ ymd, existing });
    if (existing) {
      setFormPlantas(existing.plantas);
      setFormMotivo(existing.motivo);
      setFormTipo(existing.tipoExcepcion);
    } else {
      setFormPlantas(['villa_nueva', 'tucuman']);
      setFormMotivo('');
      setFormTipo('no_laborable');
    }
  };

  const closeEditor = () => setEditor(null);

  const togglePlanta = (p: Planta) => {
    setFormPlantas((cur) =>
      cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p],
    );
  };

  const save = async () => {
    if (!editor) return;
    if (!formMotivo.trim()) {
      toast.error('Ingresá un motivo');
      return;
    }
    if (formPlantas.length === 0) {
      toast.error('Seleccioná al menos una planta');
      return;
    }
    setSaving(true);
    try {
      if (editor.existing) {
        await asistenciaCalendarApi.updateDiaNoLaborable(editor.existing.id, {
          plantas: formPlantas,
          motivo: formMotivo.trim(),
          tipoExcepcion: formTipo,
        });
        toast.success('Día actualizado');
      } else {
        await asistenciaCalendarApi.createDiaNoLaborable({
          fecha: editor.ymd,
          plantas: formPlantas,
          motivo: formMotivo.trim(),
          tipoExcepcion: formTipo,
        });
        toast.success('Día agregado al calendario');
      }
      closeEditor();
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editor?.existing) return;
    if (!confirm('¿Eliminar este día?')) return;
    setSaving(true);
    try {
      await asistenciaCalendarApi.deleteDiaNoLaborable(editor.existing.id);
      toast.success('Eliminado');
      closeEditor();
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Marcá feriados o días libres. Click en un día para editarlo.
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-rose-200 dark:bg-rose-900/50" /> VN</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-200 dark:bg-amber-900/50" /> TUC</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-violet-200 dark:bg-violet-900/50" /> Ambas</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-100 dark:bg-emerald-900/40 border" /> Excepción</span>
        </div>
      </div>

      <div className="relative">
        {loading && (
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
          decorateDay={(cell): DayDecoration | undefined => {
            const rows = byYmd.get(cell.ymd);
            if (!rows || rows.length === 0) return undefined;
            const main = rows[0];
            const badges = (
              <div className="flex flex-wrap gap-0.5">
                {rows.flatMap((r) =>
                  r.plantas.map((p) => {
                    const opt = PLANTA_OPTIONS.find((o) => o.value === p)!;
                    return (
                      <span
                        key={`${r.id}-${p}`}
                        className={`text-[9px] px-1 py-0 rounded ${opt.chipClass}`}
                      >
                        {opt.short}
                      </span>
                    );
                  }),
                )}
              </div>
            );
            const tooltip = rows.map((r) =>
              `${r.tipoExcepcion === 'laborable' ? '✓ ' : ''}${r.motivo} (${r.plantas.map(plantaLabel).join(', ')})`,
            ).join('\n');
            return {
              bgClass: bgForRegistro(main),
              badges,
              tooltip,
            };
          }}
          onDayClick={(cell) => {
            const rows = byYmd.get(cell.ymd);
            openEditor(cell.ymd, rows?.[0]);
          }}
        />
      </div>

      {editor && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto overscroll-contain p-4 bg-black/40" onClick={closeEditor}>
          <div
            className="bg-card rounded-lg border shadow-xl w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">
                {editor.existing ? 'Editar día' : 'Marcar día'}
              </h3>
              <span className="text-xs text-muted-foreground">{editor.ymd}</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium mb-1 block">Plantas</label>
                <div className="flex gap-2">
                  {PLANTA_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => togglePlanta(opt.value)}
                      className={`flex-1 px-3 py-2 rounded-md text-sm border transition ${
                        formPlantas.includes(opt.value)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background border-border hover:bg-accent'
                      }`}
                    >
                      {plantaLabel(opt.value)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block">Motivo</label>
                <input
                  type="text"
                  value={formMotivo}
                  onChange={(e) => setFormMotivo(e.target.value)}
                  placeholder="Ej: Feriado nacional, Día dado por dirección…"
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
                  maxLength={255}
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block">Tipo</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormTipo('no_laborable')}
                    className={`flex-1 px-3 py-2 rounded-md text-sm border transition ${
                      formTipo === 'no_laborable'
                        ? 'bg-rose-500 text-white border-rose-500'
                        : 'bg-background border-border hover:bg-accent'
                    }`}
                  >
                    No laborable
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormTipo('laborable')}
                    className={`flex-1 px-3 py-2 rounded-md text-sm border transition ${
                      formTipo === 'laborable'
                        ? 'bg-emerald-500 text-white border-emerald-500'
                        : 'bg-background border-border hover:bg-accent'
                    }`}
                  >
                    Excepción: SÍ se trabaja
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-5 pt-4 border-t">
              {editor.existing ? (
                <button
                  type="button"
                  onClick={remove}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-md"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Eliminar
                </button>
              ) : <span />}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeEditor}
                  disabled={saving}
                  className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="px-4 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? 'Guardando…' : editor.existing ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
