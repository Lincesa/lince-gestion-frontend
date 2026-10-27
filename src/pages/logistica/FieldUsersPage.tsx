import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Copy, KeyRound, Pencil, Plus, Power, RefreshCw } from 'lucide-react';
import { logisticaApi } from '@/api/logistica';
import type {
  FieldUserKind,
  FieldUserView,
  TransportMemberRole,
  TransportView,
} from '@/types/logistica.types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';

function randomPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success('Contraseña copiada');
  } catch {
    toast.error('No se pudo copiar; seleccioná el texto manualmente');
  }
}

export function FieldUsersPage() {
  const [kind, setKind] = useState<FieldUserKind>('TAG');
  const [items, setItems] = useState<FieldUserView[]>([]);
  const [transports, setTransports] = useState<TransportView[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [transportId, setTransportId] = useState('');
  const [memberRole, setMemberRole] = useState<TransportMemberRole>('CHOFER');
  const [editingUser, setEditingUser] = useState<FieldUserView | null>(null);
  const [resetUser, setResetUser] = useState<FieldUserView | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editTransportId, setEditTransportId] = useState('');
  const [editRole, setEditRole] = useState<TransportMemberRole>('CHOFER');
  const [resetPassword, setResetPassword] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [users, transportList] = await Promise.all([
        logisticaApi.listFieldUsers(kind),
        logisticaApi.listTransports(),
      ]);
      setItems(users);
      setTransports(transportList);
    } catch (err) {
      toast.error((err as Error).message || 'No se pudieron cargar los usuarios');
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    void load();
  }, [load]);

  const transportOptions = useMemo(
    () => transports.filter((t) => t.active).sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [transports],
  );

  const openCreate = () => {
    setName('');
    setEmail('');
    setPassword(randomPassword());
    setTransportId(transportOptions[0]?.id ?? '');
    setMemberRole('CHOFER');
    setRevealedPassword(null);
    setFormOpen(true);
  };

  const handleCreate = async () => {
    if (!name.trim() || !email.trim() || password.length < 8) {
      toast.error('Completá nombre, email y contraseña (mín. 8)');
      return;
    }
    if (kind === 'TRANSPORTE' && !transportId) {
      toast.error('Elegí un transporte');
      return;
    }
    setSubmitting(true);
    try {
      const created = await logisticaApi.createFieldUser({
        kind,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        ...(kind === 'TRANSPORTE'
          ? { transportId, memberRole }
          : {}),
      });
      setRevealedPassword(created.temporaryPassword);
      setFormOpen(false);
      toast.success('Usuario creado — copiá la contraseña ahora');
      await load();
    } catch (err) {
      toast.error((err as Error).message || 'No se pudo crear el usuario');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (user: FieldUserView) => {
    setSubmitting(true);
    try {
      await logisticaApi.updateFieldUser(user.id, { active: !user.active });
      toast.success(user.active ? 'Usuario desactivado' : 'Usuario activado');
      await load();
    } catch (err) {
      toast.error((err as Error).message || 'No se pudo actualizar');
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (user: FieldUserView) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditTransportId(user.transportId ?? '');
    setEditRole(user.memberRole ?? 'CHOFER');
  };

  const handleEdit = async () => {
    if (!editingUser || !editName.trim()) return;
    const normalizedEmail = editEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      toast.error('Completá el email');
      return;
    }
    const convertingLegacy =
      kind === 'TAG' &&
      editingUser.uploadClient === 'MOBILE' &&
      Boolean(editTransportId);
    if (kind === 'TRANSPORTE' && !editTransportId) {
      toast.error('Elegí un transporte');
      return;
    }
    if (convertingLegacy && !editTransportId) {
      toast.error('Elegí un transporte para convertir la cuenta');
      return;
    }
    setSubmitting(true);
    try {
      await logisticaApi.updateFieldUser(editingUser.id, {
        name: editName.trim(),
        ...(normalizedEmail !== editingUser.email ? { email: normalizedEmail } : {}),
        ...(kind === 'TRANSPORTE' || convertingLegacy
          ? { transportId: editTransportId, memberRole: editRole }
          : {}),
      });
      setEditingUser(null);
      toast.success(
        convertingLegacy
          ? 'Cuenta convertida a transporte — ya aparece en la pestaña Transportes'
          : 'Usuario actualizado',
      );
      if (convertingLegacy) setKind('TRANSPORTE');
      else await load();
    } catch (err) {
      toast.error((err as Error).message || 'No se pudo actualizar');
    } finally {
      setSubmitting(false);
    }
  };

  const openResetPassword = (user: FieldUserView) => {
    setResetUser(user);
    setResetPassword(randomPassword());
  };

  const handleResetPassword = async () => {
    if (!resetUser) return;
    const newPassword = resetPassword.trim();
    if (newPassword.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    setSubmitting(true);
    try {
      const result = await logisticaApi.resetFieldUserPassword(resetUser.id, newPassword);
      setRevealedPassword(result.temporaryPassword);
      setResetUser(null);
      toast.success('Contraseña reseteada — copiala ahora');
      await load();
    } catch (err) {
      toast.error((err as Error).message || 'No se pudo resetear');
    } finally {
      setSubmitting(false);
    }
  };

  // Icon-only with title + aria-label: labelled buttons wrapped onto a second
  // line and, on narrower screens, pushed the actions column out of view.
  function iconAction(label: string, icon: React.ReactNode, onClick: () => void, danger = false) {
    return (
      <button
        type="button"
        title={label}
        aria-label={label}
        disabled={submitting}
        onClick={onClick}
        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50 ${
          danger ? 'hover:text-destructive' : 'hover:text-foreground'
        }`}
      >
        {icon}
      </button>
    );
  }

  function rowActions(user: FieldUserView, align = '') {
    return (
      <div className={`flex flex-nowrap items-center gap-0.5 ${align}`}>
        {iconAction('Editar', <Pencil className="h-4 w-4" />, () => openEdit(user))}
        {iconAction('Resetear contraseña', <KeyRound className="h-4 w-4" />, () => openResetPassword(user))}
        {iconAction(
          user.active ? 'Desactivar' : 'Activar',
          <Power className="h-4 w-4" />,
          () => void handleToggleActive(user),
          user.active,
        )}
      </div>
    );
  }

  function statusBadges(user: FieldUserView) {
    return (
      <div className="flex flex-nowrap items-center gap-1.5 whitespace-nowrap">
        {user.active ? (
          <Badge variant="secondary">Activo</Badge>
        ) : (
          <Badge variant="destructive">Inactivo</Badge>
        )}
        {user.mustChangePassword && (
          <span className="text-xs text-amber-700 dark:text-amber-300">debe cambiar pass</span>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Usuarios de campo</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Alta y acceso de TAG y choferes/dueños. La contraseña temporal se muestra una sola vez.
          </p>
        </div>
        <Button onClick={openCreate} disabled={submitting}>
          <Plus className="h-4 w-4 mr-1.5" />
          Nuevo {kind === 'TAG' ? 'TAG' : 'chofer/dueño'}
        </Button>
      </div>

      <div className="flex gap-2">
        {(['TAG', 'TRANSPORTE'] as FieldUserKind[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setKind(tab)}
            className={[
              'px-3 py-1.5 text-sm rounded-md border transition-colors',
              kind === tab
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:text-foreground',
            ].join(' ')}
          >
            {tab === 'TAG' ? 'TAG' : 'Transportes'}
          </button>
        ))}
      </div>

      {revealedPassword && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3 flex flex-wrap items-center gap-3">
          <KeyRound className="h-4 w-4 text-amber-700 dark:text-amber-300 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">Contraseña temporal (una sola vez)</p>
            <code className="text-sm break-all">{revealedPassword}</code>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void copyText(revealedPassword)}
          >
            <Copy className="h-3.5 w-3.5 mr-1" />
            Copiar
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setRevealedPassword(null)}>
            Cerrar
          </Button>
        </div>
      )}

      {formOpen && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3 max-w-xl">
          <h2 className="text-sm font-semibold">Nuevo usuario {kind}</h2>
          <label className="block text-sm space-y-1">
            <span className="text-muted-foreground">Nombre</span>
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="block text-sm space-y-1">
            <span className="text-muted-foreground">Email</span>
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="@lincesa.com.ar"
            />
          </label>
          <label className="block text-sm space-y-1">
            <span className="text-muted-foreground">Contraseña temporal</span>
            <div className="flex gap-2">
              <input
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button type="button" variant="outline" onClick={() => setPassword(randomPassword())}>
                Generar
              </Button>
            </div>
          </label>
          {kind === 'TRANSPORTE' && (
            <>
              <label className="block text-sm space-y-1">
                <span className="text-muted-foreground">Transporte</span>
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={transportId}
                  onChange={(e) => setTransportId(e.target.value)}
                >
                  {transportOptions.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm space-y-1">
                <span className="text-muted-foreground">Rol</span>
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value as TransportMemberRole)}
                >
                  <option value="CHOFER">Chofer</option>
                  <option value="DUENO">Dueño</option>
                </select>
              </label>
            </>
          )}
          <div className="flex gap-2 pt-1">
            <Button disabled={submitting} onClick={() => void handleCreate()}>
              Crear
            </Button>
            <Button variant="ghost" disabled={submitting} onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Below md the rows render as cards: seven columns do not fit a phone. */}
          <div className="space-y-2 md:hidden">
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay usuarios {kind} todavía.</p>
            ) : (
              items.map((user) => (
                <div key={user.id} className="rounded-lg border border-border bg-card p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{user.name}</p>
                      <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                    </div>
                    {rowActions(user)}
                  </div>
                  {kind === 'TRANSPORTE' && (
                    <p className="text-sm">
                      {user.transportName ?? '—'}
                      {user.memberRole && (
                        <Badge variant="secondary" className="ml-2">
                          {user.memberRole === 'DUENO' ? 'Dueño' : 'Chofer'}
                        </Badge>
                      )}
                    </p>
                  )}
                  {statusBadges(user)}
                </div>
              ))
            )}
          </div>

          <div className="hidden md:block bg-card border border-border rounded-lg overflow-hidden">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  {kind === 'TRANSPORTE' && <TableHead>Transporte</TableHead>}
                  {kind === 'TRANSPORTE' && <TableHead>Rol</TableHead>}
                  <TableHead className="hidden xl:table-cell">Cliente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={kind === 'TRANSPORTE' ? 7 : 5} className="text-sm text-muted-foreground">
                      No hay usuarios {kind} todavía.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium max-w-[220px] truncate" title={user.name}>
                        {user.name}
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate" title={user.email}>
                        {user.email}
                      </TableCell>
                      {kind === 'TRANSPORTE' && (
                        <TableCell className="whitespace-nowrap">{user.transportName ?? '—'}</TableCell>
                      )}
                      {kind === 'TRANSPORTE' && (
                        <TableCell>
                          {user.memberRole ? (
                            <Badge variant="secondary">
                              {user.memberRole === 'DUENO' ? 'Dueño' : 'Chofer'}
                            </Badge>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                      )}
                      <TableCell className="hidden xl:table-cell whitespace-nowrap text-sm text-muted-foreground">
                        {user.uploadClient}
                        {kind === 'TAG' && user.uploadClient === 'MOBILE' && (
                          <span className="ml-2 text-xs text-amber-700 dark:text-amber-300">
                            legado app
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{statusBadges(user)}</TableCell>
                      <TableCell className="w-px">{rowActions(user, 'justify-end')}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <Dialog
        open={editingUser !== null}
        onClose={() => setEditingUser(null)}
        title="Editar usuario"
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="edit-field-name">Nombre</Label>
            <Input id="edit-field-name" value={editName} onChange={(event) => setEditName(event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-field-email">Email (usuario de ingreso)</Label>
            <Input
              id="edit-field-email"
              type="email"
              autoComplete="off"
              value={editEmail}
              onChange={(event) => setEditEmail(event.target.value)}
            />
          </div>
          {(kind === 'TRANSPORTE' || editingUser?.uploadClient === 'MOBILE') && (
            <>
              {kind === 'TAG' && editingUser?.uploadClient === 'MOBILE' && (
                <p className="text-sm text-muted-foreground">
                  Cuenta legada de la app. Asignale un transporte para moverla a la pestaña Transportes
                  (dueño/chofer) sin perder el historial de remitos.
                </p>
              )}
              <div className="space-y-1">
                <Label htmlFor="edit-field-transport">Transporte</Label>
                <Select id="edit-field-transport" value={editTransportId} onChange={(event) => setEditTransportId(event.target.value)}>
                  <option value="">Seleccionar</option>
                  {transportOptions.map((transport) => (
                    <option key={transport.id} value={transport.id}>{transport.name}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-field-role">Rol</Label>
                <Select id="edit-field-role" value={editRole} onChange={(event) => setEditRole(event.target.value as TransportMemberRole)}>
                  <option value="CHOFER">Chofer</option>
                  <option value="DUENO">Dueño</option>
                </Select>
              </div>
            </>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditingUser(null)}>Cancelar</Button>
            <Button loading={submitting} onClick={() => void handleEdit()}>Guardar</Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={resetUser !== null}
        onClose={() => setResetUser(null)}
        title="Restablecer contraseña"
        description={resetUser?.email}
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="reset-field-password">Contraseña temporal</Label>
            <div className="flex gap-2">
              <Input id="reset-field-password" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} />
              <Button variant="outline" onClick={() => setResetPassword(randomPassword())}>Generar</Button>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setResetUser(null)}>Cancelar</Button>
            <Button loading={submitting} onClick={() => void handleResetPassword()}>Restablecer</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
