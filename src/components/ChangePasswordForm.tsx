import { useState } from 'react';
import { toast } from 'sonner';
import { authApi } from '@/api/auth';
import { useAppDispatch } from '@/store';
import { clearMustChangePassword } from '@/store/auth/authSlice';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';

interface ChangePasswordFormProps {
  submitLabel?: string;
  onSuccess?: () => void;
}

export function ChangePasswordForm({
  submitLabel = 'Actualizar contraseña',
  onSuccess,
}: ChangePasswordFormProps) {
  const dispatch = useAppDispatch();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const mismatch = confirm.length > 0 && newPassword !== confirm;
  const tooShort = newPassword.length > 0 && newPassword.length < 8;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentPassword) {
      toast.error('Ingresá tu contraseña actual');
      return;
    }
    if (newPassword !== confirm) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    setSaving(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      dispatch(clearMustChangePassword());
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
      toast.success('Contraseña actualizada correctamente');
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cambiar contraseña');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="current-password">Contraseña actual</Label>
        <Input
          id="current-password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="new-password">Nueva contraseña</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          placeholder="Mínimo 8 caracteres"
          required
        />
        {tooShort && <p className="text-xs text-destructive">Mínimo 8 caracteres</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="confirm-password">Confirmar contraseña</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          placeholder="Repetí la contraseña"
          required
        />
        {mismatch && <p className="text-xs text-destructive">Las contraseñas no coinciden</p>}
      </div>
      <Button
        type="submit"
        className="w-full"
        loading={saving}
        disabled={
          saving ||
          !currentPassword ||
          mismatch ||
          newPassword.length < 8 ||
          confirm.length === 0
        }
      >
        {submitLabel}
      </Button>
    </form>
  );
}
