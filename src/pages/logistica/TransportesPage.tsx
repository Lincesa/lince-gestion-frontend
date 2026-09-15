import { Fragment, useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { logisticaApi } from '@/api/logistica';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import type { TransportMemberRole, TransportMemberView, TransportView } from '@/types/logistica.types';

type TransportForm = {
  name: string;
  slug: string;
  prefixes: string;
  active: boolean;
};

type MemberForm = {
  name: string;
  email: string;
  password: string;
  role: TransportMemberRole;
};

const EMPTY_TRANSPORT: TransportForm = { name: '', slug: '', prefixes: '', active: true };
const EMPTY_MEMBER: MemberForm = { name: '', email: '', password: '', role: 'CHOFER' };

function randomPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

export function TransportesPage() {
  const [items, setItems] = useState<TransportView[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [transportDialog, setTransportDialog] = useState(false);
  const [memberDialog, setMemberDialog] = useState(false);
  const [editingTransport, setEditingTransport] = useState<TransportView | null>(null);
  const [selectedTransport, setSelectedTransport] = useState<TransportView | null>(null);
  const [editingMember, setEditingMember] = useState<TransportMemberView | null>(null);
  const [transportForm, setTransportForm] = useState<TransportForm>(EMPTY_TRANSPORT);
  const [memberForm, setMemberForm] = useState<MemberForm>(EMPTY_MEMBER);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await logisticaApi.listTransports());
    } catch (err) {
      toast.error((err as Error).message || 'No se pudieron cargar los transportes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openTransport = (transport?: TransportView) => {
    setEditingTransport(transport ?? null);
    setTransportForm(transport ? {
      name: transport.name,
      slug: transport.slug,
      prefixes: transport.allowedPrefijos.join(', '),
      active: transport.active,
    } : EMPTY_TRANSPORT);
    setTransportDialog(true);
  };

  const saveTransport = async () => {
    if (!transportForm.name.trim()) {
      toast.error('Ingresá el nombre del transporte');
      return;
    }
    const allowedPrefijos = transportForm.prefixes
      .split(',')
      .map((prefix) => prefix.trim())
      .filter(Boolean);
    setSaving(true);
    try {
      if (editingTransport) {
        await logisticaApi.updateTransport(editingTransport.id, {
          name: transportForm.name.trim(),
          allowedPrefijos,
          active: transportForm.active,
        });
        toast.success('Transporte actualizado');
      } else {
        await logisticaApi.createTransport({
          name: transportForm.name.trim(),
          slug: transportForm.slug.trim() || undefined,
          allowedPrefijos,
        });
        toast.success('Transporte creado');
      }
      setTransportDialog(false);
      await load();
    } catch (err) {
      toast.error((err as Error).message || 'No se pudo guardar el transporte');
    } finally {
      setSaving(false);
    }
  };

  const openMember = (transport: TransportView, member?: TransportMemberView) => {
    setSelectedTransport(transport);
    setEditingMember(member ?? null);
    setMemberForm(member ? {
      name: member.name,
      email: member.email,
      password: '',
      role: member.role,
    } : { ...EMPTY_MEMBER, password: randomPassword() });
    setMemberDialog(true);
  };

  const saveMember = async () => {
    if (!selectedTransport) return;
    setSaving(true);
    try {
      if (editingMember) {
        await logisticaApi.updateTransportMember(
          selectedTransport.id,
          editingMember.id,
          { role: memberForm.role },
        );
        toast.success('Rol actualizado');
      } else {
        if (!memberForm.name.trim() || !memberForm.email.trim() || memberForm.password.length < 8) {
          toast.error('Completá nombre, email y contraseña (mín. 8)');
          return;
        }
        const created = await logisticaApi.createFieldUser({
          kind: 'TRANSPORTE',
          name: memberForm.name.trim(),
          email: memberForm.email.trim().toLowerCase(),
          password: memberForm.password,
          transportId: selectedTransport.id,
          memberRole: memberForm.role,
        });
        toast.success(`Usuario creado. Contraseña temporal: ${created.temporaryPassword}`);
      }
      setMemberDialog(false);
      setExpandedId(selectedTransport.id);
      await load();
    } catch (err) {
      toast.error((err as Error).message || 'No se pudo guardar el integrante');
    } finally {
      setSaving(false);
    }
  };

  const toggleMember = async (transport: TransportView, member: TransportMemberView) => {
    setSaving(true);
    try {
      await logisticaApi.updateTransportMember(transport.id, member.id, { active: !member.active });
      toast.success(member.active ? 'Integrante desactivado' : 'Integrante activado');
      await load();
    } catch (err) {
      toast.error((err as Error).message || 'No se pudo actualizar el integrante');
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async (transport: TransportView, member: TransportMemberView) => {
    if (!window.confirm(`¿Quitar a ${member.name} de ${transport.name}?`)) return;
    setSaving(true);
    try {
      await logisticaApi.deleteTransportMember(transport.id, member.id);
      toast.success('Integrante quitado');
      await load();
    } catch (err) {
      toast.error((err as Error).message || 'No se pudo quitar el integrante');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Transportes</h1>
          <p className="text-sm text-muted-foreground mt-1">Configuración e integrantes de cada transporte.</p>
        </div>
        <Button onClick={() => openTransport()}>
          <Plus className="h-4 w-4 mr-1.5" />
          Nuevo transporte
        </Button>
      </div>

      {loading ? (
        <div className="min-h-[240px] flex items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Transporte</TableHead>
                <TableHead>Prefijos</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Integrantes</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((transport) => {
                const expanded = expandedId === transport.id;
                return (
                  <Fragment key={transport.id}>
                    <TableRow>
                      <TableCell>
                        <button type="button" onClick={() => setExpandedId(expanded ? null : transport.id)}>
                          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      </TableCell>
                      <TableCell className="font-medium">{transport.name}</TableCell>
                      <TableCell>{transport.allowedPrefijos.join(', ') || '—'}</TableCell>
                      <TableCell><Badge variant={transport.active ? 'secondary' : 'destructive'}>{transport.active ? 'Activo' : 'Inactivo'}</Badge></TableCell>
                      <TableCell>{transport.members.length}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button variant="outline" size="sm" onClick={() => openTransport(transport)}>
                          <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                        </Button>
                        <Button size="sm" className="ml-2" onClick={() => openMember(transport)}>
                          <Plus className="h-3.5 w-3.5 mr-1" /> Integrante
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expanded && (
                      <TableRow>
                        <TableCell colSpan={6} className="p-0 bg-muted/20">
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Nombre</TableHead>
                                  <TableHead>Email</TableHead>
                                  <TableHead>Rol</TableHead>
                                  <TableHead>Estado</TableHead>
                                  <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {transport.members.map((member) => (
                                  <TableRow key={member.id}>
                                    <TableCell>{member.name}</TableCell>
                                    <TableCell>{member.email}</TableCell>
                                    <TableCell><Badge variant="secondary">{member.role === 'DUENO' ? 'Dueño' : 'Chofer'}</Badge></TableCell>
                                    <TableCell>{member.active ? 'Activo' : 'Inactivo'}</TableCell>
                                    <TableCell className="text-right whitespace-nowrap">
                                      <Button variant="outline" size="sm" onClick={() => openMember(transport, member)}>Rol</Button>
                                      <Button variant="ghost" size="sm" disabled={saving} onClick={() => void toggleMember(transport, member)}>
                                        {member.active ? 'Desactivar' : 'Activar'}
                                      </Button>
                                      <Button variant="ghost" size="icon" disabled={saving} onClick={() => void removeMember(transport, member)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                                {transport.members.length === 0 && (
                                  <TableRow><TableCell colSpan={5} className="text-muted-foreground">Sin integrantes.</TableCell></TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={transportDialog} onClose={() => setTransportDialog(false)} title={editingTransport ? 'Editar transporte' : 'Nuevo transporte'}>
        <div className="space-y-4">
          <div className="space-y-1"><Label htmlFor="transport-name">Nombre</Label><Input id="transport-name" value={transportForm.name} onChange={(event) => setTransportForm((current) => ({ ...current, name: event.target.value }))} /></div>
          {!editingTransport && <div className="space-y-1"><Label htmlFor="transport-slug">Identificador</Label><Input id="transport-slug" value={transportForm.slug} onChange={(event) => setTransportForm((current) => ({ ...current, slug: event.target.value }))} placeholder="Opcional" /></div>}
          <div className="space-y-1"><Label htmlFor="transport-prefixes">Prefijos de remito</Label><Input id="transport-prefixes" value={transportForm.prefixes} onChange={(event) => setTransportForm((current) => ({ ...current, prefixes: event.target.value }))} placeholder="TTE1, TTE2" /></div>
          {editingTransport && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={transportForm.active} onChange={(event) => setTransportForm((current) => ({ ...current, active: event.target.checked }))} /> Transporte activo</label>}
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setTransportDialog(false)}>Cancelar</Button><Button loading={saving} onClick={() => void saveTransport()}>Guardar</Button></div>
        </div>
      </Dialog>

      <Dialog open={memberDialog} onClose={() => setMemberDialog(false)} title={editingMember ? 'Editar rol' : `Nuevo integrante · ${selectedTransport?.name ?? ''}`}>
        <div className="space-y-4">
          {!editingMember && (
            <>
              <div className="space-y-1"><Label htmlFor="member-name">Nombre</Label><Input id="member-name" value={memberForm.name} onChange={(event) => setMemberForm((current) => ({ ...current, name: event.target.value }))} /></div>
              <div className="space-y-1"><Label htmlFor="member-email">Email</Label><Input id="member-email" type="email" value={memberForm.email} onChange={(event) => setMemberForm((current) => ({ ...current, email: event.target.value }))} /></div>
              <div className="space-y-1"><Label htmlFor="member-password">Contraseña temporal</Label><div className="flex gap-2"><Input id="member-password" value={memberForm.password} onChange={(event) => setMemberForm((current) => ({ ...current, password: event.target.value }))} /><Button variant="outline" onClick={() => setMemberForm((current) => ({ ...current, password: randomPassword() }))}>Generar</Button></div></div>
            </>
          )}
          <div className="space-y-1"><Label htmlFor="member-role">Rol</Label><Select id="member-role" value={memberForm.role} onChange={(event) => setMemberForm((current) => ({ ...current, role: event.target.value as TransportMemberRole }))}><option value="CHOFER">Chofer</option><option value="DUENO">Dueño</option></Select></div>
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setMemberDialog(false)}>Cancelar</Button><Button loading={saving} onClick={() => void saveMember()}>Guardar</Button></div>
        </div>
      </Dialog>
    </div>
  );
}
