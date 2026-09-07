import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchUsers } from '@/store/admin/usersSlice';
import {
  clearIncidenteSelected,
  fetchIncidente,
  updateIncidenteEstado,
} from '@/store/soporte-it/incidentesSlice';
import {
  clearRelevamiento,
  fetchRelevamientoByIncidente,
  createRelevamiento,
  updateRelevamiento,
} from '@/store/soporte-it/relevamientosSlice';
import type {
  EstadoIncidente,
  UrgenciaIncidente,
  RelevamientoItemPayload,
  UpdateRelevamientoPayload,
} from '@/types/soporte-it.types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';

const URGENCIA_COLORS: Record<UrgenciaIncidente, string> = {
  alta: 'bg-red-100 text-red-700',
  media: 'bg-yellow-100 text-yellow-700',
  baja: 'bg-blue-100 text-blue-700',
};

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-muted-foreground w-44 shrink-0">{label}</span>
      <span className="break-all">{value ?? '—'}</span>
    </div>
  );
}

function Textarea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <textarea
        className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

const emptyItem = (): RelevamientoItemPayload => ({
  orden: 0,
  titulo: '',
  procedimiento: '',
  observacion: '',
  conclusion: '',
});

const emptyRelevamientoForm = (): UpdateRelevamientoPayload => ({
  fecha: new Date().toISOString().slice(0, 10),
  modalidad: '',
  conclusionGeneral: '',
  pasosASeguir: '',
  recomendaciones: '',
  items: [],
});

export function IncidenteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const incidente = useAppSelector((s) => s.incidentes.selected);
  const relevamiento = useAppSelector((s) => s.relevamientos.current);
  const users = useAppSelector((s) => s.users.list);

  const [estado, setEstado] = useState<EstadoIncidente>('pending');
  const [reportadoPorId, setReportadoPorId] = useState<string>('');
  const [relForm, setRelForm] = useState<UpdateRelevamientoPayload>(emptyRelevamientoForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    dispatch(clearIncidenteSelected());
    dispatch(clearRelevamiento());
    void dispatch(fetchIncidente(id));
    void dispatch(fetchRelevamientoByIncidente(id));
    void dispatch(fetchUsers());
    return () => {
      dispatch(clearIncidenteSelected());
      dispatch(clearRelevamiento());
    };
  }, [dispatch, id]);

  // Sync form with loaded relevamiento
  useEffect(() => {
    if (relevamiento) {
      setRelForm({
        fecha: relevamiento.fecha,
        modalidad: relevamiento.modalidad ?? '',
        conclusionGeneral: relevamiento.conclusionGeneral ?? '',
        pasosASeguir: relevamiento.pasosASeguir ?? '',
        recomendaciones: relevamiento.recomendaciones ?? '',
        items: relevamiento.items.map((it) => ({
          id: it.id,
          orden: it.orden,
          titulo: it.titulo,
          procedimiento: it.procedimiento ?? '',
          observacion: it.observacion ?? '',
          conclusion: it.conclusion ?? '',
        })),
      });
      return;
    }
    setRelForm(emptyRelevamientoForm());
  }, [relevamiento]);

  useEffect(() => {
    if (incidente) setEstado(incidente.estado);
  }, [incidente]);

  useEffect(() => {
    setReportadoPorId(incidente?.reportadoPorId ?? '');
  }, [incidente?.reportadoPorId]);

  async function handleEstado(v: EstadoIncidente) {
    setEstado(v);
    try {
      await dispatch(updateIncidenteEstado({ id: id!, payload: { estado: v } })).unwrap();
      toast.success('Estado actualizado');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleReportadoPor(v: string) {
    setReportadoPorId(v);
    if (!id) return;
    try {
      await dispatch(
        updateIncidenteEstado({
          id,
          payload: { reportadoPorId: v || undefined },
        }),
      ).unwrap();
      toast.success('Reportado por actualizado');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function addItem() {
    setRelForm((f) => ({
      ...f,
      items: [
        ...(f.items ?? []),
        { ...emptyItem(), orden: (f.items?.length ?? 0) },
      ],
    }));
  }

  function removeItem(idx: number) {
    setRelForm((f) => ({
      ...f,
      items: (f.items ?? []).filter((_, i) => i !== idx).map((it, i) => ({ ...it, orden: i })),
    }));
  }

  function updateItem(
    idx: number,
    field: keyof RelevamientoItemPayload,
    value: string | number,
  ) {
    setRelForm((f) => {
      const items = [...(f.items ?? [])];
      items[idx] = { ...items[idx], [field]: value };
      return { ...f, items };
    });
  }

  async function handleSaveRelevamiento() {
    if (!id) return;
    setSaving(true);
    try {
      if (relevamiento) {
        await dispatch(
          updateRelevamiento({ id: relevamiento.id, payload: relForm }),
        ).unwrap();
        toast.success('Relevamiento actualizado');
      } else {
        await dispatch(
          createRelevamiento({ incidenteId: id, ...relForm }),
        ).unwrap();
        toast.success('Relevamiento creado');
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!incidente || incidente.id !== id) {
    return <div className="p-6 text-muted-foreground text-sm">Cargando incidente...</div>;
  }

  const eq = incidente.equipo;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-semibold">
          Incidente #{incidente.numeroReporte}
        </h1>
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium ${URGENCIA_COLORS[incidente.urgencia]}`}
        >
          Urgencia: {incidente.urgencia}
        </span>
      </div>

      {/* Datos del incidente */}
      <div className="rounded-lg border border-border p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wide">
            Reporte del usuario
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Estado:</span>
            <Select
              value={estado}
              onChange={(e) => void handleEstado(e.target.value as EstadoIncidente)}
              className="text-xs h-7 py-0 w-36"
            >
              <option value="pending">Pendiente</option>
              <option value="in_progress">En curso</option>
              <option value="resolved">Resuelto</option>
            </Select>
          </div>
        </div>
        <Row label="Descripción" value={incidente.descripcion} />
        <Row
          label="Fecha reporte"
          value={new Date(incidente.fechaReporte).toLocaleString('es-AR')}
        />
        <Row
          label="Aplicaciones afectadas"
          value={incidente.aplicacionesAfectadas}
        />
        <Row label="Acciones previas" value={incidente.accionesPrevias} />
        <Row
          label="Reportado por"
          value={
            incidente.reportadoPor
              ? `${incidente.reportadoPor.name} (${incidente.reportadoPor.email})`
              : undefined
          }
        />
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground w-44 shrink-0">Editar reportado por</span>
          <Select
            value={reportadoPorId}
            onChange={(e) => void handleReportadoPor(e.target.value)}
            className="max-w-md"
          >
            <option value="">Sin asignar</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.email})
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Datos del equipo */}
      <div className="rounded-lg border border-border p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wide">
            Equipo afectado
          </h2>
          <Link
            to={`/soporte-it/equipos/${eq?.id}`}
            className="text-xs text-primary hover:underline"
          >
            Ver detalle
          </Link>
        </div>
        <Row label="Hostname" value={eq?.hostname} />
        <Row label="Fabricante / Modelo" value={[eq?.fabricante, eq?.modelo].filter(Boolean).join(' ')} />
        <Row label="Sector" value={eq?.sector} />
        <Row label="Equipo" value={eq ? ([eq.tipo === 'celular' ? 'Celular' : 'Notebook', eq.hostname || eq.imei || eq.modelo].filter(Boolean).join(' · ') || eq.id) : undefined} />
        <Row label="Estado" value={eq?.estado} />
      </div>

      {/* Relevamiento técnico */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wide">
            Relevamiento técnico
          </h2>
          <Button
            size="sm"
            onClick={() => void handleSaveRelevamiento()}
            disabled={saving}
          >
            <Save className="h-4 w-4 mr-1" />
            {relevamiento ? 'Guardar cambios' : 'Crear relevamiento'}
          </Button>
        </div>

        <div className="p-5 space-y-5">
          {/* Metadatos */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Fecha</Label>
              <Input
                type="date"
                value={relForm.fecha ?? ''}
                onChange={(e) => setRelForm((f) => ({ ...f, fecha: e.target.value }))}
              />
            </div>
            <div>
              <Label>Modalidad</Label>
              <Input
                value={relForm.modalidad ?? ''}
                onChange={(e) => setRelForm((f) => ({ ...f, modalidad: e.target.value }))}
                placeholder="Ej: Acceso remoto via AnyDesk"
              />
            </div>
          </div>

          {/* Ítems del diagnóstico */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Diagnóstico — Ítems relevados</h3>
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" /> Agregar ítem
              </Button>
            </div>

            {(relForm.items ?? []).map((item, idx) => (
              <div
                key={idx}
                className="rounded-md border border-border p-4 space-y-3 bg-muted/20"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Ítem {idx + 1}
                  </span>
                  <button
                    onClick={() => removeItem(idx)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div>
                  <Label>Título (sección)</Label>
                  <Input
                    value={item.titulo}
                    onChange={(e) => updateItem(idx, 'titulo', e.target.value)}
                    placeholder="Ej: Visor de eventos (Event Viewer)"
                  />
                </div>
                <div>
                  <Label>Procedimiento / comando ejecutado</Label>
                  <textarea
                    className="w-full min-h-[70px] rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                    value={item.procedimiento ?? ''}
                    onChange={(e) => updateItem(idx, 'procedimiento', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Observación</Label>
                  <textarea
                    className="w-full min-h-[70px] rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                    value={item.observacion ?? ''}
                    onChange={(e) => updateItem(idx, 'observacion', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Conclusión parcial</Label>
                  <textarea
                    className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                    value={item.conclusion ?? ''}
                    onChange={(e) => updateItem(idx, 'conclusion', e.target.value)}
                  />
                </div>
              </div>
            ))}

            {(relForm.items ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Sin ítems — usá "Agregar ítem" para comenzar el diagnóstico
              </p>
            )}
          </div>

          {/* Cierre */}
          <div className="border-t border-border pt-5 space-y-4">
            <h3 className="text-sm font-medium">Cierre del relevamiento</h3>
            <Textarea
              label="Conclusión general"
              value={relForm.conclusionGeneral ?? ''}
              onChange={(v) => setRelForm((f) => ({ ...f, conclusionGeneral: v }))}
            />
            <Textarea
              label="Pasos a seguir / Seguimiento recomendado"
              value={relForm.pasosASeguir ?? ''}
              onChange={(v) => setRelForm((f) => ({ ...f, pasosASeguir: v }))}
            />
            <Textarea
              label="Recomendaciones"
              value={relForm.recomendaciones ?? ''}
              onChange={(v) => setRelForm((f) => ({ ...f, recomendaciones: v }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
