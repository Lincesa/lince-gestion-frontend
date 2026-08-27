import { Fragment, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Plus, RefreshCw } from 'lucide-react';
import { logisticaApi } from '@/api/logistica';
import type {
  TransportMemberRole,
  TransportView,
} from '@/types/logistica.types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';

const ROLE_LABELS: Record<TransportMemberRole, string> = {
  CHOFER: 'Chofer',
  DUENO: 'Dueño',
};

export function TransportesPage() {
  const [items, setItems] = useState<TransportView[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await logisticaApi.listTransports());
    } catch (err) {
      toast.error((err as Error).message || 'No se pudieron cargar los transportes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleCreateTransport = async () => {
    const name = window.prompt('Nombre del transporte (ej. TTe.Nuevo):');
    if (!name?.trim()) return;
    const prefijosRaw = window.prompt('Prefijos de remito separados por coma (opcional):') ?? '';
    const allowedPrefijos = prefijosRaw.split(',').map((v) => v.trim()).filter(Boolean);
    setSubmitting(true);
    try {
      await logisticaApi.createTransport({ name: name.trim(), allowedPrefijos });
      toast.success('Transporte creado');
      await load();
    } catch (err) {
      toast.error((err as Error).message || 'No se pudo crear el transporte');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditPrefijos = async (transport: TransportView) => {
    const prefijosRaw = window.prompt(
      'Prefijos de remito para este transporte (separados por coma):',
      transport.allowedPrefijos.join(', '),
    );
    if (prefijosRaw === null) return;
    const allowedPrefijos = prefijosRaw.split(',').map((v) => v.trim()).filter(Boolean);
    setSubmitting(true);
    try {
      await logisticaApi.updateTransport(transport.id, { allowedPrefijos });
      toast.success('Prefijos actualizados');
      await load();
    } catch (err) {
      toast.error((err as Error).message || 'No se pudieron guardar los prefijos');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddMember = async (transport: TransportView) => {
    const name = window.prompt(`Nombre del integrante para ${transport.name}:`);
    if (!name?.trim()) return;
    const email = window.prompt('Email (@lincesa.com.ar):');
    if (!email?.trim()) return;
    const password = window.prompt('Contraseña inicial (mín. 8 caracteres):');
    if (!password || password.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    const roleInput = window.prompt('Rol: CHOFER o DUENO', 'CHOFER')?.trim().toUpperCase();
    const role = (roleInput === 'DUENO' ? 'DUENO' : 'CHOFER') as TransportMemberRole;
    setSubmitting(true);
    try {
      await logisticaApi.addTransportMember(transport.id, {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
      });
      toast.success('Usuario creado');
      setExpandedId(transport.id);
      await load();
    } catch (err) {
      toast.error((err as Error).message || 'No se pudo crear el usuario');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Transportes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Alta de transportes y choferes para la app mobile. Los prefijos definen qué remitos
            se asocian a cada transporte (sin planta fija).
          </p>
        </div>
        <Button onClick={() => void handleCreateTransport()} disabled={submitting}>
          <Plus className="h-4 w-4 mr-1.5" />
          Nuevo transporte
        </Button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Transporte</TableHead>
              <TableHead>Prefijos</TableHead>
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
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : transport.id)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </TableCell>
                    <TableCell className="font-medium">{transport.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {transport.allowedPrefijos.length
                        ? transport.allowedPrefijos.join(', ')
                        : '—'}
                    </TableCell>
                    <TableCell>{transport.members.length}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={submitting}
                        onClick={() => void handleEditPrefijos(transport)}
                      >
                        Prefijos
                      </Button>
                      <Button
                        size="sm"
                        disabled={submitting}
                        onClick={() => void handleAddMember(transport)}
                      >
                        + Usuario
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expanded && (
                    <TableRow>
                      <TableCell colSpan={5} className="bg-muted/30 p-0">
                        {transport.members.length === 0 ? (
                          <p className="px-4 py-3 text-sm text-muted-foreground">
                            Sin usuarios todavía. Email sugerido: tte{transport.slug}@lincesa.com.ar
                          </p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Rol</TableHead>
                                <TableHead>Estado</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {transport.members.map((member) => (
                                <TableRow key={member.id}>
                                  <TableCell>{member.name}</TableCell>
                                  <TableCell>{member.email}</TableCell>
                                  <TableCell>
                                    <Badge variant="secondary">{ROLE_LABELS[member.role]}</Badge>
                                  </TableCell>
                                  <TableCell>
                                    {member.active ? 'Activo' : 'Inactivo'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
