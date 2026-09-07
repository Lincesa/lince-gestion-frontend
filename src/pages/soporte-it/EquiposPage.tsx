import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Monitor, UserPlus, UserMinus, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  fetchEquipos,
  createEquipo,
  updateEquipo,
  deleteEquipo,
  assignEquipo,
  unassignEquipo,
} from '@/store/soporte-it/equiposSlice';
import { fetchUsers } from '@/store/admin/usersSlice';
import type {
  Equipo,
  CreateEquipoPayload,
  EstadoEquipo,
  TipoEquipo,
} from '@/types/soporte-it.types';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';

const ESTADO_LABELS: Record<EstadoEquipo, string> = {
  disponible: 'Disponible',
  asignado: 'Asignado',
  en_reparacion: 'En reparación',
  baja: 'Baja',
};

const ESTADO_COLORS: Record<EstadoEquipo, string> = {
  disponible: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  asignado: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  en_reparacion: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  baja: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const TIPO_LABELS: Record<TipoEquipo, string> = {
  notebook: 'Notebook',
  celular: 'Celular',
};

const emptyForm = (): CreateEquipoPayload => ({
  tipo: 'notebook',
  hostname: '',
  fabricante: '',
  modelo: '',
  sector: '',
  estado: 'disponible',
});

type AssignTarget = { id: string; label: string } | null;

export function EquiposPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { items: equipos, loading, error } = useAppSelector((s) => s.equipos);
  const users = useAppSelector((s) => s.users.list);

  const [showDialog, setShowDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateEquipoPayload>(emptyForm());
  const [filter, setFilter] = useState('');
  const [filterTipo, setFilterTipo] = useState<'' | TipoEquipo>('');
  const [filterEstado, setFilterEstado] = useState<'' | EstadoEquipo>('');

  const [assignTarget, setAssignTarget] = useState<AssignTarget>(null);
  const [assignUserId, setAssignUserId] = useState('');
  const [assignMotivo, setAssignMotivo] = useState('');
  const [devolverTarget, setDevolverTarget] = useState<AssignTarget>(null);
  const [devolverMotivo, setDevolverMotivo] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    void dispatch(fetchEquipos());
    void dispatch(fetchUsers({ limit: 200 }));
  }, [dispatch]);

  const filtered = equipos.filter((e) => {
    if (filterTipo && e.tipo !== filterTipo) return false;
    if (filterEstado && e.estado !== filterEstado) return false;
    const q = filter.toLowerCase().trim();
    if (!q) return true;
    return (
      (e.hostname ?? '').toLowerCase().includes(q) ||
      (e.sector ?? '').toLowerCase().includes(q) ||
      (e.fabricante ?? '').toLowerCase().includes(q) ||
      (e.modelo ?? '').toLowerCase().includes(q) ||
      (e.imei ?? '').toLowerCase().includes(q) ||
      (e.linea ?? '').toLowerCase().includes(q) ||
      (e.usuarioPlat?.name ?? '').toLowerCase().includes(q) ||
      TIPO_LABELS[e.tipo].toLowerCase().includes(q)
    );
  });

  function equipoLabel(e: Equipo) {
    if (e.tipo === 'celular') return e.imei || e.linea || e.modelo || e.id.slice(0, 8);
    return e.hostname || e.modelo || e.id.slice(0, 8);
  }

  function openCreate() {
    setEditId(null);
    setForm(emptyForm());
    setShowDialog(true);
  }

  function openEdit(e: Equipo) {
    setEditId(e.id);
    setForm({
      tipo: e.tipo,
      numeroActivo: e.numeroActivo ?? undefined,
      sector: e.sector ?? '',
      hostname: e.hostname ?? '',
      windowsUserId: e.windowsUserId ?? '',
      fabricante: e.fabricante ?? '',
      modelo: e.modelo ?? '',
      ramGb: e.ramGb ?? '',
      sistemaOperativo: e.sistemaOperativo ?? '',
      procesador: e.procesador ?? '',
      firmwareUefi: e.firmwareUefi ?? '',
      graficos: e.graficos ?? '',
      almacenamiento: e.almacenamiento ?? '',
      adaptadorRed: e.adaptadorRed ?? '',
      controladorUsbHost: e.controladorUsbHost ?? '',
      imei: e.imei ?? '',
      linea: e.linea ?? '',
      chip: e.chip ?? '',
      estado: e.estado,
      notas: e.notas ?? '',
    });
    setShowDialog(true);
  }

  function openAsignar(e: Equipo) {
    setAssignTarget({ id: e.id, label: equipoLabel(e) });
    setAssignUserId('');
    setAssignMotivo('');
  }

  function openDevolver(e: Equipo) {
    setDevolverTarget({ id: e.id, label: equipoLabel(e) });
    setDevolverMotivo('');
  }

  async function handleSubmit() {
    try {
      if (editId) {
        await dispatch(updateEquipo({ id: editId, payload: form })).unwrap();
        toast.success('Equipo actualizado');
      } else {
        await dispatch(createEquipo(form)).unwrap();
        toast.success('Equipo creado en stock');
      }
      await dispatch(fetchEquipos()).unwrap();
      setShowDialog(false);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleAsignar() {
    if (!assignTarget || !assignUserId) {
      toast.error('Seleccioná un usuario');
      return;
    }
    setActionLoading(true);
    try {
      await dispatch(
        assignEquipo({
          id: assignTarget.id,
          usuarioPlatId: assignUserId,
          motivo: assignMotivo.trim() || undefined,
        }),
      ).unwrap();
      toast.success('Equipo asignado');
      setAssignTarget(null);
      await dispatch(fetchEquipos()).unwrap();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDevolver() {
    if (!devolverTarget) return;
    setActionLoading(true);
    try {
      await dispatch(
        unassignEquipo({
          id: devolverTarget.id,
          motivo: devolverMotivo.trim() || undefined,
        }),
      ).unwrap();
      toast.success('Equipo devuelto a stock');
      setDevolverTarget(null);
      await dispatch(fetchEquipos()).unwrap();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este equipo?')) return;
    try {
      await dispatch(deleteEquipo(id)).unwrap();
      toast.success('Equipo eliminado');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function field(key: keyof CreateEquipoPayload, label: string, type = 'text') {
    return (
      <div>
        <Label>{label}</Label>
        <Input
          type={type}
          value={String(form[key] ?? '')}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        />
      </div>
    );
  }

  const isCelular = form.tipo === 'celular';
  const canAsignar = (e: Equipo) => e.estado !== 'baja' && !e.usuarioPlatId;
  const canDevolver = (e: Equipo) => Boolean(e.usuarioPlatId);

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Monitor className="h-5 w-5" /> Inventario
        </h1>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Agregar equipo
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label>Tipo</Label>
          <Select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value as '' | TipoEquipo)}
            className="w-40"
          >
            <option value="">Todos</option>
            <option value="notebook">Notebook</option>
            <option value="celular">Celular</option>
          </Select>
        </div>
        <div>
          <Label>Estado</Label>
          <Select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value as '' | EstadoEquipo)}
            className="w-44"
          >
            <option value="">Todos</option>
            <option value="disponible">Disponible</option>
            <option value="asignado">Asignado</option>
            <option value="en_reparacion">En reparación</option>
            <option value="baja">Baja</option>
          </Select>
        </div>
        <div className="flex-1 min-w-[12rem]">
          <Label>Buscar</Label>
          <Input
            placeholder="Hostname, IMEI, usuario..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </div>

      {loading && <p className="text-muted-foreground text-sm">Cargando...</p>}
      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">Tipo</th>
              <th className="px-4 py-3 text-left">Identificación</th>
              <th className="px-4 py-3 text-left">Sector</th>
              <th className="px-4 py-3 text-left">Fabricante / Modelo</th>
              <th className="px-4 py-3 text-left">Usuario asignado</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((e) => (
              <tr
                key={e.id}
                className="hover:bg-muted/30 cursor-pointer"
                onClick={() => navigate(`/soporte-it/equipos/${e.id}`)}
              >
                <td className="px-4 py-3 text-muted-foreground">{e.numeroActivo ?? '—'}</td>
                <td className="px-4 py-3">{TIPO_LABELS[e.tipo]}</td>
                <td className="px-4 py-3 font-medium">{equipoLabel(e)}</td>
                <td className="px-4 py-3">{e.sector ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {[e.fabricante, e.modelo].filter(Boolean).join(' ') || '—'}
                </td>
                <td className="px-4 py-3">
                  {e.usuarioPlat ? (
                    <span className="text-primary">{e.usuarioPlat.name}</span>
                  ) : (
                    <span className="text-muted-foreground">Stock</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${ESTADO_COLORS[e.estado]}`}>
                    {ESTADO_LABELS[e.estado]}
                  </span>
                </td>
                <td
                  className="px-4 py-3"
                  onClick={(ev) => ev.stopPropagation()}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {canAsignar(e) && (
                      <Button size="sm" variant="outline" onClick={() => openAsignar(e)}>
                        <UserPlus className="h-3.5 w-3.5 mr-1" /> Asignar
                      </Button>
                    )}
                    {canDevolver(e) && (
                      <Button size="sm" variant="outline" onClick={() => openDevolver(e)}>
                        <UserMinus className="h-3.5 w-3.5 mr-1" /> Devolver
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/soporte-it/reportar?equipoId=${e.id}`)}
                      title="Registrar incidente"
                    >
                      <AlertCircle className="h-3.5 w-3.5" />
                    </Button>
                    <button
                      onClick={() => openEdit(e)}
                      className="text-muted-foreground hover:text-foreground"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(e.id)}
                      className="text-muted-foreground hover:text-destructive"
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  No hay equipos con esos filtros
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        title={editId ? 'Editar equipo' : 'Nuevo equipo (stock)'}
      >
        <div className="space-y-4">
          {!editId && (
            <p className="text-sm text-muted-foreground">
              Se crea sin persona asignada. Después usá <strong>Asignar</strong> desde el listado o el detalle.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select
                value={form.tipo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tipo: e.target.value as TipoEquipo }))
                }
              >
                <option value="notebook">Notebook</option>
                <option value="celular">Celular</option>
              </Select>
            </div>
            <div>
              <Label>N° Activo</Label>
              <Input
                type="number"
                value={form.numeroActivo ?? ''}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    numeroActivo: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
              />
            </div>
            {field('sector', 'Sector')}
            {field('fabricante', 'Fabricante')}
            {field('modelo', 'Modelo')}
            {field('ramGb', 'RAM (GB)')}
            {!isCelular && (
              <>
                {field('hostname', 'Hostname')}
                {field('sistemaOperativo', 'Sistema operativo')}
                {field('windowsUserId', 'Windows User ID')}
                {field('procesador', 'Procesador')}
                {field('firmwareUefi', 'Firmware UEFI')}
                {field('graficos', 'Gráficos')}
                {field('almacenamiento', 'Almacenamiento')}
                {field('adaptadorRed', 'Adaptador de red')}
                {field('fechaInstalacionSO', 'Fecha instalación SO')}
                {field('controladorUsbHost', 'Controlador USB Host')}
              </>
            )}
            {isCelular && (
              <>
                {field('imei', 'IMEI')}
                {field('linea', 'Línea')}
                {field('chip', 'Chip')}
              </>
            )}
            <div>
              <Label>Estado</Label>
              <Select
                value={form.estado ?? 'disponible'}
                onChange={(e) =>
                  setForm((f) => ({ ...f, estado: e.target.value as EstadoEquipo }))
                }
              >
                <option value="disponible">Disponible</option>
                <option value="asignado">Asignado</option>
                <option value="en_reparacion">En reparación</option>
                <option value="baja">Baja</option>
              </Select>
            </div>
          </div>
          <div>
            <Label>Notas</Label>
            <textarea
              className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.notas ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSubmit()}>
              {editId ? 'Guardar cambios' : 'Crear equipo'}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(assignTarget)}
        onClose={() => setAssignTarget(null)}
        title={`Asignar: ${assignTarget?.label ?? ''}`}
      >
        <div className="space-y-4">
          <div>
            <Label>Usuario plataforma</Label>
            <Select
              value={assignUserId}
              onChange={(e) => setAssignUserId(e.target.value)}
            >
              <option value="">Seleccionar...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Motivo (opcional)</Label>
            <Input
              value={assignMotivo}
              onChange={(e) => setAssignMotivo(e.target.value)}
              placeholder="Ej: entrega a nuevo ingreso"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAssignTarget(null)}>
              Cancelar
            </Button>
            <Button disabled={actionLoading} onClick={() => void handleAsignar()}>
              Confirmar asignación
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(devolverTarget)}
        onClose={() => setDevolverTarget(null)}
        title={`Devolver a stock: ${devolverTarget?.label ?? ''}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            El equipo queda sin persona y pasa a estado Disponible.
          </p>
          <div>
            <Label>Motivo (opcional)</Label>
            <Input
              value={devolverMotivo}
              onChange={(e) => setDevolverMotivo(e.target.value)}
              placeholder="Ej: devolución / rotura / baja de usuario"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDevolverTarget(null)}>
              Cancelar
            </Button>
            <Button disabled={actionLoading} onClick={() => void handleDevolver()}>
              Confirmar devolución
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
