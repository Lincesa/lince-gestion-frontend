import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Monitor } from 'lucide-react';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  fetchEquipos,
  createEquipo,
  updateEquipo,
  deleteEquipo,
} from '@/store/soporte-it/equiposSlice';
import { fetchUsers } from '@/store/admin/usersSlice';
import type { Equipo, CreateEquipoPayload, EstadoEquipo } from '@/types/soporte-it.types';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';

const ESTADO_LABELS: Record<EstadoEquipo, string> = {
  activo: 'Activo',
  en_reparacion: 'En reparación',
  baja: 'Baja',
};

const ESTADO_COLORS: Record<EstadoEquipo, string> = {
  activo: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  en_reparacion: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  baja: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const emptyForm = (): CreateEquipoPayload => ({
  hostname: '',
  fabricante: '',
  modelo: '',
  aCargoDe: '',
  sector: '',
  estado: 'activo',
});

export function EquiposPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { items: equipos, loading, error } = useAppSelector((s) => s.equipos);
  const users = useAppSelector((s) => s.users.list);

  const [showDialog, setShowDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateEquipoPayload>(emptyForm());
  const [filter, setFilter] = useState('');

  useEffect(() => {
    void dispatch(fetchEquipos());
    void dispatch(fetchUsers());
  }, [dispatch]);

  const filtered = equipos.filter((e) => {
    const q = filter.toLowerCase();
    return (
      (e.hostname ?? '').toLowerCase().includes(q) ||
      (e.aCargoDe ?? '').toLowerCase().includes(q) ||
      (e.sector ?? '').toLowerCase().includes(q) ||
      (e.fabricante ?? '').toLowerCase().includes(q) ||
      (e.modelo ?? '').toLowerCase().includes(q)
    );
  });

  function openCreate() {
    setEditId(null);
    setForm(emptyForm());
    setShowDialog(true);
  }

  function openEdit(e: Equipo) {
    setEditId(e.id);
    setForm({
      numeroActivo: e.numeroActivo ?? undefined,
      aCargoDe: e.aCargoDe ?? '',
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
      ipv6: e.ipv6 ?? '',
      controladorUsbHost: e.controladorUsbHost ?? '',
      estado: e.estado,
      notas: e.notas ?? '',
      usuarioPlatId: e.usuarioPlatId ?? null,
    });
    setShowDialog(true);
  }

  async function handleSubmit() {
    try {
      if (editId) {
        await dispatch(updateEquipo({ id: editId, payload: form })).unwrap();
        toast.success('Equipo actualizado');
      } else {
        await dispatch(createEquipo(form)).unwrap();
        toast.success('Equipo creado');
      }
      await dispatch(fetchEquipos()).unwrap();
      setShowDialog(false);
    } catch (err) {
      toast.error((err as Error).message);
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

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Monitor className="h-5 w-5" /> Equipos
        </h1>
        <div className="flex items-center gap-3">
          <Input
            placeholder="Buscar equipo..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-56"
          />
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Agregar equipo
          </Button>
        </div>
      </div>

      {loading && <p className="text-muted-foreground text-sm">Cargando...</p>}
      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">Hostname</th>
              <th className="px-4 py-3 text-left">A cargo de</th>
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
                <td className="px-4 py-3 font-medium">{e.hostname ?? '—'}</td>
                <td className="px-4 py-3">{e.aCargoDe ?? '—'}</td>
                <td className="px-4 py-3">{e.sector ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {[e.fabricante, e.modelo].filter(Boolean).join(' ') || '—'}
                </td>
                <td className="px-4 py-3">
                  {e.usuarioPlat ? (
                    <span className="text-primary">{e.usuarioPlat.name}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
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
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(e)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(e.id)}
                      className="text-muted-foreground hover:text-destructive"
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
                  No hay equipos registrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        title={editId ? 'Editar equipo' : 'Nuevo equipo'}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
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
            {field('hostname', 'Hostname')}
            {field('aCargoDe', 'A cargo de')}
            {field('sector', 'Sector')}
            {field('fabricante', 'Fabricante')}
            {field('modelo', 'Modelo')}
            {field('ramGb', 'RAM (GB)')}
            {field('sistemaOperativo', 'Sistema operativo')}
            {field('windowsUserId', 'Windows User ID')}
            {field('procesador', 'Procesador')}
            {field('firmwareUefi', 'Firmware UEFI')}
            {field('graficos', 'Gráficos')}
            {field('almacenamiento', 'Almacenamiento')}
            {field('adaptadorRed', 'Adaptador de red')}
            {field('ipv6', 'IPv6')}
            {field('controladorUsbHost', 'Controlador USB Host')}
            <div>
              <Label>Usuario asignado (plataforma)</Label>
              <Select
                value={form.usuarioPlatId ?? ''}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    usuarioPlatId: e.target.value ? e.target.value : null,
                  }))
                }
              >
                <option value="">Sin asignar</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Estado</Label>
              <Select
                value={form.estado ?? 'activo'}
                onChange={(e) =>
                  setForm((f) => ({ ...f, estado: e.target.value as EstadoEquipo }))
                }
              >
                <option value="activo">Activo</option>
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
    </div>
  );
}
