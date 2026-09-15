import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ChangePasswordForm } from '@/components/ChangePasswordForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { logisticaApi } from '@/api/logistica';
import { useAppSelector } from '@/store';
import type { MyTransportView } from '@/types/logistica.types';

export function ProfilePage() {
  const user = useAppSelector((state) => state.auth.user);
  const [transport, setTransport] = useState<MyTransportView | null>(null);

  useEffect(() => {
    if (user?.area?.toUpperCase() !== 'TRANSPORTE') return;
    void logisticaApi.getMyTransport()
      .then(setTransport)
      .catch((err: Error) => toast.error(err.message || 'No se pudo cargar el transporte'));
  }, [user?.area]);

  if (!user) return null;

  const logisticsRole =
    transport?.currentMember?.role ??
    transport?.memberRole ??
    user.modules.logistica?.role ??
    null;

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Mi perfil</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Datos de acceso y seguridad de tu cuenta.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Datos personales</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Nombre</dt>
              <dd className="font-medium mt-1">{user.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Email</dt>
              <dd className="font-medium mt-1 break-all">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Transporte</dt>
              <dd className="font-medium mt-1">{transport?.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Rol</dt>
              <dd className="mt-1">
                <Badge variant="secondary">
                  {logisticsRole === 'DUENO'
                    ? 'Dueño'
                    : logisticsRole === 'CHOFER'
                      ? 'Chofer'
                      : user.globalRole}
                </Badge>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Cambiar contraseña</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
