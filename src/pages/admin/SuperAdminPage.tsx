import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, ShieldCheck, UserCheck, UserX, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  fetchUsers, createUser, updateUser, updateUserModules, resetUserPassword, deleteUser,
} from '@/store/admin/usersSlice';
import {
  fetchAreas, createArea, updateArea, deleteArea,
} from '@/store/admin/areasSlice';
import { GlobalRole, ModuleKey } from '@/types';
import type { UserModules } from '@/types';
import type { UserDto, CreateUserPayload, UpdateUserPayload, AreaDto, CreateAreaPayload } from '@/types/user.types';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';

const GLOBAL_ROLE_LABELS: Record<GlobalRole, string> = {
  [GlobalRole.SUPERADMIN]: 'Super Admin',
  [GlobalRole.ADMIN]: 'Admin',
  [GlobalRole.USER]: 'Usuario',
};

const MODULE_LABELS: Record<ModuleKey, string> = {
  [ModuleKey.CRM]: 'CRM',
  [ModuleKey.CONCILIACIONES]: 'Conciliaciones',
  [ModuleKey.OCR]: 'OCR',
  [ModuleKey.MARKETING]: 'Mensajes y seguimiento',
  [ModuleKey.SOPORTE_IT]: 'Soporte IT',
  [ModuleKey.ASISTENCIA]: 'RRHH',
  [ModuleKey.LOGISTICA]:  'Logística',
};

const MODULE_ROLES: Partial<Record<ModuleKey, string[]>> = {
  [ModuleKey.OCR]: ['OPERADOR_CAMPO', 'ADMINISTRATIVO', 'ADMIN'],
};
const DEFAULT_MODULE_ROLES = ['VIEWER', 'EDITOR', 'ADMIN'];
const getModuleRoles = (key: ModuleKey) => MODULE_ROLES[key] ?? DEFAULT_MODULE_ROLES;

// ── Módulos editor (reutilizable) ────────────────────────────────────────────

function ModulesEditor({ value, onChange }: { value: UserModules; onChange: (m: UserModules) => void }) {
  const toggleModule = (key: ModuleKey) => {
    const current = value[key];
    if (current?.enabled) {
      const next = { ...value };
      delete next[key];
      onChange(next);
    } else {
      onChange({ ...value, [key]: { enabled: true, role: getModuleRoles(key)[0] } });
    }
  };
  const setRole = (key: ModuleKey, role: string) =>
    onChange({ ...value, [key]: { enabled: true, role } });

  return (
    <div className="space-y-2">
      {Object.values(ModuleKey).map((key) => {
        const perm = value[key];
        const enabled = perm?.enabled === true;
        return (
          <div key={key} className="flex items-center gap-3 rounded-md border p-3">
            <input
              type="checkbox"
              id={`mod-${key}`}
              checked={enabled}
              onChange={() => toggleModule(key)}
              className="h-4 w-4 shrink-0"
            />
            <Label htmlFor={`mod-${key}`} className="w-32 font-medium">{MODULE_LABELS[key]}</Label>
            {enabled ? (
              <Select
                value={perm?.role ?? getModuleRoles(key)[0]}
                onChange={(e) => setRole(key, e.target.value)}
                className="flex-1 h-8 text-sm"
              >
                {getModuleRoles(key).map((r) => <option key={r} value={r}>{r}</option>)}
              </Select>
            ) : (
              <span className="text-sm text-muted-foreground">Deshabilitado</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Edit User Modal ──────────────────────────────────────────────────────────

function EditUserModal({
  user,
  areas,
  onClose,
  onSaved,
}: {
  user: UserDto;
  areas: AreaDto[];
  onClose: () => void;
  onSaved?: () => void | Promise<void>;
}) {
  const dispatch = useAppDispatch();
  const [name, setName] = useState(user.name);
  const [globalRole, setGlobalRole] = useState<GlobalRole>(user.globalRole);
  const [area, setArea] = useState(user.area ?? '');
  const [active, setActive] = useState(user.active);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: UpdateUserPayload = { name, globalRole, active, area: area || null };
      await dispatch(updateUser({ id: user.id, payload })).unwrap();
      toast.success('Usuario actualizado');
      await onSaved?.();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={onClose} title={`Editar: ${user.name}`}>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="edit-name">Nombre</Label>
          <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="edit-area">Área</Label>
          <Select id="edit-area" value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">Sin área</option>
            {areas.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="edit-role">Rol global</Label>
          <Select id="edit-role" value={globalRole} onChange={(e) => setGlobalRole(e.target.value as GlobalRole)}>
            {Object.values(GlobalRole).map((r) => (
              <option key={r} value={r}>{GLOBAL_ROLE_LABELS[r]}</option>
            ))}
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="edit-active" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4" />
          <Label htmlFor="edit-active" className="font-normal">Usuario activo</Label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
        </div>
      </form>
    </Dialog>
  );
}

// ── Modules Modal ────────────────────────────────────────────────────────────

function ModulesModal({
  user,
  onClose,
  onSaved,
}: {
  user: UserDto;
  onClose: () => void;
  onSaved?: () => void | Promise<void>;
}) {
  const dispatch = useAppDispatch();
  const [modules, setModules] = useState<UserModules>({ ...user.modules });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await dispatch(updateUserModules({ id: user.id, modules })).unwrap();
      toast.success('Permisos actualizados');
      await onSaved?.();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar permisos');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={onClose} title={`Módulos: ${user.name}`}>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <ModulesEditor value={modules} onChange={setModules} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar permisos'}</Button>
        </div>
      </form>
    </Dialog>
  );
}

// ── Create User Modal ────────────────────────────────────────────────────────

function CreateUserModal({
  areas,
  onClose,
  onSaved,
}: {
  areas: AreaDto[];
  onClose: () => void;
  onSaved?: () => void | Promise<void>;
}) {
  const dispatch = useAppDispatch();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [globalRole, setGlobalRole] = useState<GlobalRole>(GlobalRole.USER);
  const [selectedArea, setSelectedArea] = useState('');
  const [modules, setModules] = useState<UserModules>({});
  const [saving, setSaving] = useState(false);

  const handleAreaChange = (areaName: string) => {
    setSelectedArea(areaName);
    if (areaName) {
      const found = areas.find((a) => a.name === areaName);
      if (found && Object.keys(found.modules).length > 0) {
        setModules({ ...found.modules });
      }
    } else {
      setModules({});
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: CreateUserPayload = { email, name, password, globalRole, modules };
      if (selectedArea) payload.area = selectedArea;
      await dispatch(createUser(payload)).unwrap();
      toast.success('Usuario creado');
      await onSaved?.();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al crear usuario');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={onClose} title="Crear usuario">
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="new-name">Nombre</Label>
            <Input id="new-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-email">Email</Label>
            <Input id="new-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="new-password">Contraseña</Label>
          <Input id="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="new-area">Área</Label>
            <Select id="new-area" value={selectedArea} onChange={(e) => handleAreaChange(e.target.value)}>
              <option value="">Sin área</option>
              {areas.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-role">Rol global</Label>
            <Select id="new-role" value={globalRole} onChange={(e) => setGlobalRole(e.target.value as GlobalRole)}>
              {Object.values(GlobalRole).map((r) => (
                <option key={r} value={r}>{GLOBAL_ROLE_LABELS[r]}</option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Label className="mb-2 block">Módulos habilitados</Label>
          <p className="text-xs text-muted-foreground mb-2">
            {selectedArea ? `Pre-cargado desde el área "${selectedArea}". Podés ajustar.` : 'Seleccioná un área para pre-cargar los módulos, o configurá manualmente.'}
          </p>
          <ModulesEditor value={modules} onChange={setModules} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Creando...' : 'Crear usuario'}</Button>
        </div>
      </form>
    </Dialog>
  );
}

// ── Area Modal (create/edit) ─────────────────────────────────────────────────

function AreaModal({ area, onClose }: { area: AreaDto | null; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const [name, setName] = useState(area?.name ?? '');
  const [modules, setModules] = useState<UserModules>(area?.modules ?? {});
  const [saving, setSaving] = useState(false);

  const isEdit = !!area;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        await dispatch(updateArea({ id: area.id, payload: { name, modules } })).unwrap();
        toast.success('Área actualizada');
      } else {
        await dispatch(createArea({ name, modules })).unwrap();
        toast.success('Área creada');
      }
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar área');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={onClose} title={isEdit ? `Editar área: ${area.name}` : 'Nueva área'}>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="area-name">Nombre del área</Label>
          <Input id="area-name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ej: Tesorería" />
        </div>
        <div>
          <Label className="mb-2 block">Módulos por defecto</Label>
          <p className="text-xs text-muted-foreground mb-2">Los usuarios nuevos de esta área heredarán estos permisos.</p>
          <ModulesEditor value={modules} onChange={setModules} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : isEdit ? 'Guardar' : 'Crear área'}</Button>
        </div>
      </form>
    </Dialog>
  );
}

// ── Reset Password Modal ─────────────────────────────────────────────────────

function ResetPasswordModal({ user, onClose }: { user: UserDto; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const mismatch = confirm.length > 0 && newPassword !== confirm;
  const tooShort = newPassword.length > 0 && newPassword.length < 8;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirm) { toast.error('Las contraseñas no coinciden'); return; }
    setSaving(true);
    try {
      await dispatch(resetUserPassword({ id: user.id, newPassword })).unwrap();
      toast.success(`Contraseña reseteada. ${user.name} deberá cambiarla al ingresar.`);
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al resetear contraseña');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={onClose} title={`Resetear contraseña: ${user.name}`} description="El usuario deberá cambiar su contraseña al iniciar sesión.">
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="rp-new">Nueva contraseña temporal</Label>
          <Input id="rp-new" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 8 caracteres" required />
          {tooShort && <p className="text-xs text-destructive">Mínimo 8 caracteres</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="rp-confirm">Confirmar contraseña</Label>
          <Input id="rp-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repetí la contraseña" required />
          {mismatch && <p className="text-xs text-destructive">Las contraseñas no coinciden</p>}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving || mismatch || newPassword.length < 8 || confirm.length === 0}>
            {saving ? 'Reseteando...' : 'Resetear contraseña'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// ── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab({ areas }: { areas: AreaDto[] }) {
  const dispatch = useAppDispatch();
  const { list: users, loading, error, total, totalPages } = useAppSelector((s) => s.users);
  const [editUser, setEditUser] = useState<UserDto | null>(null);
  const [modulesUser, setModulesUser] = useState<UserDto | null>(null);
  const [resetUser, setResetUser] = useState<UserDto | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setDebouncedSearch(searchInput.trim());
    }, 350);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    void dispatch(fetchUsers({ page, limit, search: debouncedSearch }));
  }, [dispatch, page, limit, debouncedSearch]);

  const refetchUsers = async (nextPage = page) => {
    await dispatch(fetchUsers({ page: nextPage, limit, search: debouncedSearch })).unwrap();
  };

  const handleDelete = async (user: UserDto) => {
    if (!confirm(`¿Eliminar a ${user.name}? Esta acción no se puede deshacer.`)) return;
    try {
      await dispatch(deleteUser(user.id)).unwrap();
      const nextPage = users.length === 1 && page > 1 ? page - 1 : page;
      if (nextPage !== page) setPage(nextPage);
      await refetchUsers(nextPage);
      toast.success('Usuario eliminado');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error');
    }
  };

  const firstItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const lastItem = Math.min(page * limit, total);
  const effectiveTotalPages = Math.max(totalPages, 1);

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="w-full md:max-w-sm">
          <Label htmlFor="users-search">Buscar usuarios</Label>
          <Input
            id="users-search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Nombre, email, área o rol"
          />
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />Nuevo usuario
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive mb-4">
          Error al cargar usuarios: {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Usuario</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Área</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Rol</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Estado</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Módulos</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{user.area ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge className={
                      user.globalRole === GlobalRole.SUPERADMIN
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                        : user.globalRole === GlobalRole.ADMIN
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        : 'bg-muted text-muted-foreground'
                    }>
                      {GLOBAL_ROLE_LABELS[user.globalRole]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      {user.active ? (
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                          <UserCheck className="h-3.5 w-3.5" /> Activo
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-destructive text-xs font-medium">
                          <UserX className="h-3.5 w-3.5" /> Inactivo
                        </span>
                      )}
                      {user.mustChangePassword && (
                        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs">
                          <KeyRound className="h-3 w-3" /> Debe cambiar contraseña
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {Object.values(ModuleKey).map((key) => {
                        const perm = user.modules[key];
                        if (!perm?.enabled) return null;
                        return (
                          <span key={key} className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            {MODULE_LABELS[key]} · {perm.role}
                          </span>
                        );
                      })}
                      {!Object.values(user.modules).some((m) => m?.enabled) && (
                        <span className="text-xs text-muted-foreground">Sin módulos</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Gestionar módulos" onClick={() => setModulesUser(user)}>
                        <ShieldCheck className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Editar" onClick={() => setEditUser(user)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Resetear contraseña" onClick={() => setResetUser(user)}>
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Eliminar" onClick={() => void handleDelete(user)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    {debouncedSearch ? 'No se encontraron usuarios' : 'No hay usuarios registrados'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
          <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
            <span>
              Mostrando {firstItem}-{lastItem} de {total}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="users-limit" className="text-sm font-normal">Por página</Label>
              <Select
                id="users-limit"
                value={String(limit)}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="h-8 w-20"
              >
                {[20, 50, 100].map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </Select>
              <span>Página {page} de {effectiveTotalPages}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= effectiveTotalPages}
                onClick={() => setPage((current) => Math.min(effectiveTotalPages, current + 1))}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateUserModal
          areas={areas}
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setPage(1);
            return refetchUsers(1);
          }}
        />
      )}
      {editUser && <EditUserModal user={editUser} areas={areas} onClose={() => setEditUser(null)} onSaved={() => refetchUsers()} />}
      {modulesUser && <ModulesModal user={modulesUser} onClose={() => setModulesUser(null)} onSaved={() => refetchUsers()} />}
      {resetUser && <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} />}
    </>
  );
}

// ── Areas Tab ────────────────────────────────────────────────────────────────

function AreasTab() {
  const dispatch = useAppDispatch();
  const { list: areas, loading } = useAppSelector((s) => s.areas);
  const [editArea, setEditArea] = useState<AreaDto | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const handleDelete = async (area: AreaDto) => {
    if (!confirm(`¿Eliminar el área "${area.name}"?`)) return;
    try {
      await dispatch(deleteArea(area.id)).unwrap();
      toast.success('Área eliminada');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error');
    }
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />Nueva área
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[400px]">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Área</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Módulos por defecto</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {areas.map((area) => (
                <tr key={area.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{area.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {Object.values(ModuleKey).map((key) => {
                        const perm = area.modules[key];
                        if (!perm?.enabled) return null;
                        return (
                          <span key={key} className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            {MODULE_LABELS[key]} · {perm.role}
                          </span>
                        );
                      })}
                      {!Object.values(area.modules).some((m) => m?.enabled) && (
                        <span className="text-xs text-muted-foreground">Sin módulos definidos</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Editar" onClick={() => setEditArea(area)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Eliminar" onClick={() => void handleDelete(area)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {areas.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                    No hay áreas configuradas. Creá las áreas de tu empresa para organizar los usuarios.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {showCreate && <AreaModal area={null} onClose={() => setShowCreate(false)} />}
      {editArea && <AreaModal area={editArea} onClose={() => setEditArea(null)} />}
    </>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'usuarios' | 'areas';

export function SuperAdminPage() {
  const dispatch = useAppDispatch();
  const areas = useAppSelector((s) => s.areas.list);
  const [tab, setTab] = useState<Tab>('usuarios');

  useEffect(() => { void dispatch(fetchAreas()); }, [dispatch]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Panel Super Admin</h1>
        <p className="text-sm text-muted-foreground mt-1">Gestión de usuarios, áreas y permisos de módulos</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(['usuarios', 'areas'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={[
              'px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors',
              tab === t
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {t === 'usuarios' ? 'Usuarios' : 'Áreas'}
          </button>
        ))}
      </div>

      {tab === 'usuarios' && <UsersTab areas={areas} />}
      {tab === 'areas' && <AreasTab />}
    </div>
  );
}
