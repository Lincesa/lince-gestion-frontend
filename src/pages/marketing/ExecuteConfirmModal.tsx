import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import type { Campaign } from '@/types/marketing.types';

const CONFIRM_WORD = 'ENVIAR';

interface Props {
  campaign: Campaign;
  submitting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ExecuteConfirmModal({ campaign, submitting, onConfirm, onClose }: Props) {
  const [typed, setTyped] = useState('');
  const isValid = typed === CONFIRM_WORD;

  return (
    <Dialog open onClose={onClose} title="Confirmar envío masivo">
      <div className="space-y-5">
        <div className="flex gap-3 rounded-md border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900/50 dark:bg-yellow-900/20">
          <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-600 dark:text-yellow-200 mt-0.5" />
          <div className="text-sm text-yellow-800 dark:text-yellow-300 space-y-1">
            <p className="font-semibold">Esta acción enviará mensajes de WhatsApp a todos los destinatarios de la campaña.</p>
            <p>Una vez iniciada, no se puede cancelar.</p>
          </div>
        </div>

        <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Campaña</span>
            <span className="font-medium text-foreground">{campaign.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Plantilla</span>
            <span className="font-medium text-foreground">{campaign.templateName}</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Escribí <span className="font-mono font-bold text-primary">{CONFIRM_WORD}</span> para confirmar
          </label>
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={CONFIRM_WORD}
            autoFocus
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring font-mono"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={!isValid}
            loading={submitting}
            onClick={onConfirm}
          >
            Confirmar envío
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
