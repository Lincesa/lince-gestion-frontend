import { useEffect, useState } from 'react';
import { RefreshCw, Truck, UserRound, Users } from 'lucide-react';
import { toast } from 'sonner';
import { logisticaApi } from '@/api/logistica';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import type { MyTransportView } from '@/types/logistica.types';

export function MiTransportePage() {
  const [transport, setTransport] = useState<MyTransportView | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void logisticaApi.getMyTransport()
      .then(setTransport)
      .catch((err: Error) => toast.error(err.message || 'No se pudo cargar el transporte'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-[300px] flex items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!transport) {
    return <div className="p-6 text-sm text-muted-foreground">No tenés un transporte asignado.</div>;
  }

  const owners = transport.members.filter((member) => member.role === 'DUENO');
  const drivers = transport.members.filter((member) => member.role === 'CHOFER');

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Mi transporte</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Integrantes y configuración operativa de {transport.name}.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Truck className="h-8 w-8 text-primary" />
            <div><p className="text-xs text-muted-foreground">Estado</p><p className="font-semibold">{transport.active ? 'Activo' : 'Inactivo'}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            <div><p className="text-xs text-muted-foreground">Dueños</p><p className="font-semibold">{owners.length}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <UserRound className="h-8 w-8 text-primary" />
            <div><p className="text-xs text-muted-foreground">Choferes</p><p className="font-semibold">{drivers.length}</p></div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Integrantes</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {transport.members.map((member) => (
            <div key={member.id} className="rounded-lg border border-border p-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium truncate">{member.name}</p>
                <p className="text-sm text-muted-foreground truncate">{member.email}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge variant="secondary">{member.role === 'DUENO' ? 'Dueño' : 'Chofer'}</Badge>
                {!member.active && <span className="text-xs text-destructive">Inactivo</span>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
