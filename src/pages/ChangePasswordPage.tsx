import { useNavigate } from 'react-router-dom';
import { ChangePasswordForm } from '@/components/ChangePasswordForm';

export function ChangePasswordPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Cambiar contraseña</h1>
          <p className="text-sm text-muted-foreground mt-2">
            El administrador requiere que establezcas una nueva contraseña antes de continuar.
          </p>
        </div>

        <ChangePasswordForm
          submitLabel="Establecer contraseña"
          onSuccess={() => navigate('/', { replace: true })}
        />
      </div>
    </div>
  );
}
