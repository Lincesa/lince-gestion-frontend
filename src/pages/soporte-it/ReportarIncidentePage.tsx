import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchEquipos, fetchMisEquipos } from '@/store/soporte-it/equiposSlice';
import { createIncidente } from '@/store/soporte-it/incidentesSlice';
import { isSoporteItAdmin } from '@/permissions/soporteIt';
import type { UrgenciaIncidente, CreateIncidentePayload } from '@/types/soporte-it.types';
import { formatEquipoLabel } from '@/utils/soporteItEquipo';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';

export function ReportarIncidentePage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedId = searchParams.get('equipoId') ?? '';
  const user = useAppSelector((s) => s.auth.user);
  const isAdmin = isSoporteItAdmin(user);

  const equipos = useAppSelector((s) => s.equipos.items);
  const loadingEquipos = useAppSelector((s) => s.equipos.loading);

  const [form, setForm] = useState<CreateIncidentePayload>({
    equipoId: preselectedId,
    descripcion: '',
    urgencia: 'media',
    aplicacionesAfectadas: '',
    accionesPrevias: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void dispatch(isAdmin ? fetchEquipos() : fetchMisEquipos());
  }, [dispatch, isAdmin]);

  useEffect(() => {
    if (!preselectedId) return;
    setForm((f) => (f.equipoId === preselectedId ? f : { ...f, equipoId: preselectedId }));
  }, [preselectedId]);

  useEffect(() => {
    if (loadingEquipos || !preselectedId || equipos.length === 0) return;
    if (!equipos.some((e) => e.id === preselectedId)) {
      toast.error(isAdmin ? 'Equipo no encontrado en el inventario' : 'Ese equipo no está entre los tuyos');
      setForm((f) => ({ ...f, equipoId: '' }));
    }
  }, [loadingEquipos, preselectedId, equipos, isAdmin]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.equipoId) {
      toast.error('Seleccioná un equipo');
      return;
    }
    if (form.descripcion.trim().length < 10) {
      toast.error('La descripción debe tener al menos 10 caracteres');
      return;
    }
    setSubmitting(true);
    try {
      await dispatch(createIncidente(form)).unwrap();
      toast.success(
        isAdmin
          ? 'Incidente registrado sobre el equipo'
          : 'Incidente reportado. El equipo de IT lo revisará pronto.',
      );
      navigate(isAdmin ? '/soporte-it/incidentes' : '/soporte-it/mis-incidentes');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!loadingEquipos && equipos.length === 0) {
    return (
      <div className="p-6 max-w-2xl space-y-4">
        <h1 className="text-xl font-semibold">
          {isAdmin ? 'Registrar incidente' : 'Reportar un incidente'}
        </h1>
        <div className="rounded-lg border border-border p-6 text-sm text-muted-foreground space-y-2">
          {isAdmin ? (
            <p>No hay equipos en el inventario. Creá uno en stock y volvé a intentar.</p>
          ) : (
            <>
              <p>No tenés equipos asignados, así que no podés abrir un ticket todavía.</p>
              <p className="text-xs">Pedile a IT que te asigne una notebook o celular desde Inventario.</p>
            </>
          )}
        </div>
        <Button
          variant="outline"
          onClick={() => navigate(isAdmin ? '/soporte-it/equipos' : '/soporte-it/mis-equipos')}
        >
          {isAdmin ? 'Ir a Inventario' : 'Volver a Mis equipos'}
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold mb-2">
        {isAdmin ? 'Registrar incidente (IT)' : 'Reportar un incidente'}
      </h1>
      {isAdmin && (
        <p className="text-sm text-muted-foreground mb-6">
          Podés abrir tickets sobre equipos en stock o asignados. El historial queda en el equipo.
        </p>
      )}
      {!isAdmin && <div className="mb-6" />}

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
        <div>
          <Label>Equipo afectado *</Label>
          <Select
            value={form.equipoId}
            onChange={(e) => setForm((f) => ({ ...f, equipoId: e.target.value }))}
            required
          >
            <option value="">Seleccioná un equipo</option>
            {equipos.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {formatEquipoLabel(eq)}
                {isAdmin && !eq.usuarioPlatId ? ' · Stock' : ''}
                {isAdmin && eq.usuarioPlat?.name ? ` · ${eq.usuarioPlat.name}` : ''}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            {isAdmin
              ? 'Incluye inventario completo (stock y asignados).'
              : 'Solo aparecen los equipos asignados a tu usuario.'}
          </p>
        </div>

        <div>
          <Label>Descripción del problema *</Label>
          <textarea
            className="w-full min-h-[140px] rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
            required
            placeholder="Describí el problema con el mayor detalle posible..."
            value={form.descripcion}
            onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
          />
        </div>

        <div>
          <Label>Urgencia</Label>
          <Select
            value={form.urgencia}
            onChange={(e) =>
              setForm((f) => ({ ...f, urgencia: e.target.value as UrgenciaIncidente }))
            }
          >
            <option value="baja">Baja</option>
            <option value="media">Media</option>
            <option value="alta">Alta</option>
          </Select>
        </div>

        <div>
          <Label>Aplicaciones afectadas (opcional)</Label>
          <input
            type="text"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
            placeholder="Ej: Chrome, Excel, TeamViewer"
            value={form.aplicacionesAfectadas ?? ''}
            onChange={(e) =>
              setForm((f) => ({ ...f, aplicacionesAfectadas: e.target.value }))
            }
          />
        </div>

        <div>
          <Label>Acciones previas (opcional)</Label>
          <textarea
            className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
            placeholder="Qué se intentó antes de abrir el ticket..."
            value={form.accionesPrevias ?? ''}
            onChange={(e) =>
              setForm((f) => ({ ...f, accionesPrevias: e.target.value }))
            }
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Enviando...' : isAdmin ? 'Registrar incidente' : 'Enviar reporte'}
          </Button>
        </div>
      </form>
    </div>
  );
}
