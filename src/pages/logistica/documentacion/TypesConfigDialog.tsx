import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { logisticaApi } from '@/api/logistica';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { ComplianceCadence, ComplianceDocTypeView } from '@/types/logistica.types';
import { SUBJECT_LABEL } from './OverviewBoard';

export const CADENCE_LABEL: Record<ComplianceCadence, string> = {
  once: 'Única',
  monthly: 'Mensual',
  semiannual: 'Semestral',
  annual: 'Anual',
  custom: 'Personalizada',
};

interface Draft {
  cadence: ComplianceCadence;
  defaultAlertDays: string;
}

export function TypesConfigDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [types, setTypes] = useState<ComplianceDocTypeView[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    logisticaApi.listComplianceTypes()
      .then((rows) => {
        if (cancelled) return;
        setTypes(rows);
        setDrafts(Object.fromEntries(rows.map((row) => [
          row.key,
          { cadence: row.cadence, defaultAlertDays: String(row.defaultAlertDays) },
        ])));
      })
      .catch((err) => toast.error((err as Error).message || 'No se pudieron cargar los tipos'))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const save = async () => {
    const changed: Array<{ key: string; payload: { cadence?: ComplianceCadence; defaultAlertDays?: number } }> = [];
    for (const type of types) {
      const draft = drafts[type.key];
      if (!draft) continue;
      const days = Number(draft.defaultAlertDays);
      if (!Number.isInteger(days) || days < 0 || days > 365) {
        toast.error(`Días de aviso inválidos para ${type.label} (0 a 365)`);
        return;
      }
      const payload: { cadence?: ComplianceCadence; defaultAlertDays?: number } = {};
      if (draft.cadence !== type.cadence) payload.cadence = draft.cadence;
      if (days !== type.defaultAlertDays) payload.defaultAlertDays = days;
      if (Object.keys(payload).length) changed.push({ key: type.key, payload });
    }
    if (!changed.length) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      for (const item of changed) {
        await logisticaApi.updateComplianceType(item.key, item.payload);
      }
      toast.success('Tipos actualizados');
      onSaved();
      onClose();
    } catch (err) {
      toast.error((err as Error).message || 'No se pudieron guardar los tipos');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Configurar tipos" panelClassName="max-w-3xl">
      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <div className="space-y-3">
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-2 font-medium">Documento</th>
                  <th className="py-2 pr-2 font-medium">Vencimiento</th>
                  <th className="py-2 font-medium">Días de aviso</th>
                </tr>
              </thead>
              <tbody>
                {types.map((type) => {
                  const draft = drafts[type.key];
                  if (!draft) return null;
                  return (
                    <tr key={type.key} className="border-t">
                      <td className="py-2 pr-2">
                        <span className="font-medium">{type.label}</span>
                        <span className="block text-xs text-muted-foreground">{SUBJECT_LABEL[type.subject]}</span>
                      </td>
                      <td className="py-2 pr-2">
                        <Select
                          aria-label={`Vencimiento de ${type.label}`}
                          value={draft.cadence}
                          onChange={(e) => setDrafts((current) => ({
                            ...current,
                            [type.key]: { ...draft, cadence: e.target.value as ComplianceCadence },
                          }))}
                        >
                          {(Object.keys(CADENCE_LABEL) as ComplianceCadence[]).map((key) => (
                            <option key={key} value={key}>{CADENCE_LABEL[key]}</option>
                          ))}
                        </Select>
                      </td>
                      <td className="py-2 w-28">
                        <Input
                          aria-label={`Días de aviso de ${type.label}`}
                          type="number"
                          min={0}
                          max={365}
                          value={draft.defaultAlertDays}
                          onChange={(e) => setDrafts((current) => ({
                            ...current,
                            [type.key]: { ...draft, defaultAlertDays: e.target.value },
                          }))}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button loading={saving} onClick={() => void save()}>Guardar</Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
