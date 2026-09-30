import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Pencil,
  Trash2,
  Monitor,
  UserPlus,
  UserMinus,
  AlertCircle,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
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
import { compareLastSeen, equipoStaleness, STALENESS_COLORS } from '@/utils/equipoStaleness';
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
  const [deleteTarget, setDeleteTarget] = useState<AssignTarget>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [sortLastSeen, setSortLastSeen] = useState<'asc' | 'desc' | null>(null);

  useEffect(() => {
    void dispatch(fetchEquipos());
    void dispatch(fetchUsers({ limit: 200 }));
  }, [dispatch]);

  const filteredBase = equipos.filter((e) => {
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
      (e.serialNumber ?? '').toLowerCase().includes(q) ||
      (e.usuarioPlat?.name ?? '').toLowerCase().includes(q) ||
      TIPO_LABELS[e.tipo].toLowerCase().includes(q)
    );
  });

  const filtered = sortLastSeen
    ? filteredBase.slice().sort((a, b) => compareLastSeen(a.lastSeenAt, b.lastSeenAt, sortLastSeen))
    : filteredBase;

  function toggleSortLastSeen() {
    setSortLastSeen((prev) => (prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc'));
  }

  function equipoLabel(e: Equipo) {
    if (e.tipo === 'celular') return e.imei || e.linea || e.modelo || e.id.slice(0, 8);
    return e.hostname || e.serialNumber || e.modelo || e.id.slice(0, 8);
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

  function openDelete(e: Equipo) {
    setDeleteTarget({ id: e.id, label: equipoLabel(e) });
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await dispatch(deleteEquipo(deleteTarget.id)).unwrap();
      toast.success('Equipo eliminado');
      setDeleteTarget(null);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setActionLoading(false);
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

  // Shared by the table rows and the mobile cards so both stay in step. Icon-only
  // with a title + aria-label: labelled buttons wrapped and broke row rhythm,
  // and the Editar/Eliminar actions here were already icon-only anyway.
  function iconAction(
    key: string,
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
    danger = false,
  ) {
    return (
      <button
        key={key}
        type="button"
        title={label}
        aria-label={label}
        onClick={onClick}
        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted ${
          danger ? 'hover:text-destructive' : 'hover:text-foreground'
        }`}
      >
        {icon}
      </button>
    );
  }

  function rowActions(e: Equipo, align = '') {
    return (
      <div className={`flex flex-nowrap items-center gap-0.5 ${align}`}>
        {canAsignar(e) &&
          iconAction('asignar', 'Asignar a un usuario', <UserPlus className="h-4 w-4" />, () =>
            openAsignar(e),
          )}
        {canDevolver(e) &&
          iconAction('devolver', 'Devolver a stock', <UserMinus className="h-4 w-4" />, () =>
            openDevolver(e),
          )}
        {iconAction('incidente', 'Registrar incidente', <AlertCircle className="h-4 w-4" />, () =>
          navigate(`/soporte-it/reportar?equipoId=${e.id}`),
        )}
        {iconAction('editar', 'Editar', <Pencil className="h-4 w-4" />, () => openEdit(e))}
        {iconAction('eliminar', 'Eliminar', <Trash2 className="h-4 w-4" />, () => openDelete(e), true)}
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

      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
        <div className="min-w-0">
          <Label>Tipo</Label>
          <Select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value as '' | TipoEquipo)}
            className="w-full sm:w-40"
          >
            <option value="">Todos</option>
            <option value="notebook">Notebook</option>
            <option value="celular">Celular</option>
          </Select>
        </div>
        <div className="min-w-0">
          <Label>Estado</Label>
          <Select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value as '' | EstadoEquipo)}
            className="w-full sm:w-44"
          >
            <option value="">Todos</option>
            <option value="disponible">Disponible</option>
            <option value="asignado">Asignado</option>
            <option value="en_reparacion">En reparación</option>
            <option value="baja">Baja</option>
          </Select>
        </div>
        <div className="col-span-2 sm:flex-1 sm:min-w-[14rem]">
          <Label>Buscar</Label>
          <Input
            placeholder="Hostname, serie, IMEI, usuario..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length === equipos.length
          ? `${equipos.length} equipo${equipos.length === 1 ? '' : 's'}`
          : `${filtered.length} de ${equipos.length} equipos`}
      </p>

      {loading && <p className="text-muted-foreground text-sm">Cargando...</p>}
      {error && <p className="text-destructive text-sm">{error}</p>}

      {/* Row actions are icon-only on purpose. With labels they wrapped onto a
          second line inside the cell, which made every row a different height
          and was the main reason the table read as ragged. */}
      <div className="hidden md:block rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[42rem]">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
              <tr>
                <th className="px-3 py-3 text-left whitespace-nowrap hidden xl:table-cell">#</th>
                <th className="px-3 py-3 text-left whitespace-nowrap hidden lg:table-cell">Tipo</th>
                <th className="px-3 py-3 text-left">Identificación</th>
                <th className="px-3 py-3 text-left whitespace-nowrap hidden lg:table-cell">Sector</th>
                <th className="px-3 py-3 text-left hidden 2xl:table-cell">Fabricante / Modelo</th>
                <th className="px-3 py-3 text-left">Usuario</th>
                <th className="px-3 py-3 text-left whitespace-nowrap">Estado</th>
                <th className="px-3 py-3 text-left whitespace-nowrap">
                  <button
                    type="button"
                    onClick={toggleSortLastSeen}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    Último check
                    {sortLastSeen === 'asc' && <ChevronUp className="h-3.5 w-3.5" />}
                    {sortLastSeen === 'desc' && <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                </th>
                <th className="px-3 py-3 text-right whitespace-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((e) => {
                const staleness = equipoStaleness(e.lastSeenAt);
                const marcaModelo = [e.fabricante, e.modelo].filter(Boolean).join(' ');
                return (
                  <tr
                    key={e.id}
                    className="hover:bg-muted/30 cursor-pointer"
                    onClick={() => navigate(`/soporte-it/equipos/${e.id}`)}
                  >
                    <td className="px-3 py-3 text-muted-foreground whitespace-nowrap hidden xl:table-cell">
                      {e.numeroActivo ?? '—'}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap hidden lg:table-cell">
                      {TIPO_LABELS[e.tipo]}
                    </td>
                    <td className="px-3 py-3">
                      <div className="max-w-[13rem]">
                        <div className="font-medium truncate" title={equipoLabel(e)}>
                          {equipoLabel(e)}
                        </div>
                        {e.serialNumber && (
                          <div
                            className="text-xs text-muted-foreground truncate"
                            title={e.serialNumber}
                          >
                            {e.serialNumber}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap hidden lg:table-cell">
                      {e.sector ?? '—'}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground hidden 2xl:table-cell">
                      <div className="max-w-[12rem] truncate" title={marcaModelo || undefined}>
                        {marcaModelo || '—'}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {e.usuarioPlat ? (
                        <div
                          className="max-w-[10rem] truncate text-primary"
                          title={e.usuarioPlat.name}
                        >
                          {e.usuarioPlat.name}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Stock</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-block whitespace-nowrap px-2 py-0.5 rounded text-xs font-medium ${ESTADO_COLORS[e.estado]}`}
                      >
                        {ESTADO_LABELS[e.estado]}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-block whitespace-nowrap px-2 py-0.5 rounded text-xs font-medium ${STALENESS_COLORS[staleness.level]}`}
                        title={e.lastSeenAt ? new Date(e.lastSeenAt).toLocaleString('es-AR') : undefined}
                      >
                        {staleness.label}
                      </span>
                    </td>
                    <td className="px-3 py-3" onClick={(ev) => ev.stopPropagation()}>
                      {rowActions(e, 'justify-end')}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                    No hay equipos con esos filtros
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Nine columns cannot be made readable on a phone by shrinking them, so
          below md the same rows render as cards instead of a scrolling table. */}
      <div className="md:hidden space-y-2">
        {filtered.map((e) => {
          const staleness = equipoStaleness(e.lastSeenAt);
          const marcaModelo = [e.fabricante, e.modelo].filter(Boolean).join(' ');
          return (
            <div
              key={e.id}
              onClick={() => navigate(`/soporte-it/equipos/${e.id}`)}
              className="rounded-lg border border-border p-3 space-y-2 active:bg-muted/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{equipoLabel(e)}</p>
                  {e.serialNumber && (
                    <p className="text-xs text-muted-foreground truncate">{e.serialNumber}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 whitespace-nowrap px-2 py-0.5 rounded text-xs font-medium ${ESTADO_COLORS[e.estado]}`}
                >
                  {ESTADO_LABELS[e.estado]}
                </span>
              </div>

              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <div className="min-w-0">
                  <dt className="text-muted-foreground">Usuario</dt>
                  <dd className="truncate">
                    {e.usuarioPlat ? (
                      <span className="text-primary">{e.usuarioPlat.name}</span>
                    ) : (
                      <span className="text-muted-foreground">Stock</span>
                    )}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-muted-foreground">Sector</dt>
                  <dd className="truncate">{e.sector ?? '—'}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-muted-foreground">Tipo</dt>
                  <dd className="truncate">{TIPO_LABELS[e.tipo]}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-muted-foreground">Equipo</dt>
                  <dd className="truncate">{marcaModelo || '—'}</dd>
                </div>
              </dl>

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-border">
                <span
                  className={`whitespace-nowrap px-2 py-0.5 rounded text-xs font-medium ${STALENESS_COLORS[staleness.level]}`}
                >
                  {staleness.label}
                </span>
                <div onClick={(ev) => ev.stopPropagation()}>{rowActions(e)}</div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && !loading && (
          <p className="rounded-lg border border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No hay equipos con esos filtros
          </p>
        )}
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

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={`Eliminar: ${deleteTarget?.label ?? ''}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Esta acción elimina el equipo de forma permanente y no se puede deshacer. Si sospechás
            que se trata de un duplicado, revisá primero con la consulta de auditoría antes de
            eliminar.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={actionLoading}
              onClick={() => void handleDelete()}
            >
              Eliminar definitivamente
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
