import { useState } from 'react';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import * as marketingApi from '@/api/marketing';
import type { YCloudTemplate } from '@/types/marketing.types';

const ADVISORS = ['EZEQUIEL', 'DENIS', 'MARTIN', 'JULIAN'] as const;
type Advisor = typeof ADVISORS[number];

interface Props {
  templates: YCloudTemplate[];
  loadingTemplates: boolean;
  onClose: () => void;
}

export function SendSingleModal({ templates, loadingTemplates, onClose }: Props) {
  const [phone, setPhone] = useState('');
  const [advisor, setAdvisor] = useState<Advisor | ''>('');
  const [selectedTemplate, setSelectedTemplate] = useState<YCloudTemplate | null>(null);
  const [sending, setSending] = useState(false);

  const inputClass =
    'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';

  const canSend = phone.trim().length >= 8 && advisor !== '' && selectedTemplate !== null;

  async function handleSend() {
    if (!canSend || !advisor || !selectedTemplate) return;
    setSending(true);
    try {
      const result = await marketingApi.sendSingle({
        phone: phone.trim(),
        advisor,
        templateName: selectedTemplate.name,
        templateLanguage: selectedTemplate.language,
        templateHeaderImageUrl: selectedTemplate.headerExample,
      });
      toast.success(`Mensaje enviado a ${result.to}`);
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? 'Error al enviar el mensaje');
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title="Envío rápido">
      <div className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Enviá una plantilla de WhatsApp a un número específico sin crear una campaña.
        </p>

        {/* Teléfono */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Número de teléfono
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Ej: 1162345678 o +5491162345678"
            className={inputClass}
            autoFocus
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Podés poner el número local — el sistema lo normaliza a formato internacional.
          </p>
        </div>

        {/* Asesor (teléfono origen) */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Enviar desde (asesor)
          </label>
          <div className="flex gap-2">
            {ADVISORS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAdvisor(a)}
                className={[
                  'flex-1 py-2 rounded-md text-xs font-medium border transition-colors',
                  advisor === a
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:border-primary/50',
                ].join(' ')}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Plantilla */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Plantilla
          </label>
          {loadingTemplates ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse bg-muted rounded-md" />
              ))}
            </div>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay plantillas aprobadas en YCloud.</p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTemplate(t)}
                  className={[
                    'w-full text-left rounded-md border p-3 transition-colors',
                    selectedTemplate?.id === t.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-foreground">{t.name}</span>
                      {(t.channelLabel || t.wabaId) && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                          {t.channelLabel ?? `WABA ${t.wabaId.slice(-6)}`}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {t.language} · {t.category}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>


        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose} disabled={sending}>
            Cancelar
          </Button>
          <Button size="sm" disabled={!canSend} loading={sending} onClick={() => void handleSend()}>
            <Send className="h-3.5 w-3.5 mr-1.5" />
            Enviar
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
