import type { ComplianceStatus } from '@/types/logistica.types';

export const STATUS_LABEL: Record<ComplianceStatus, string> = {
  missing: 'Faltante',
  ok: 'Al día',
  expiring: 'Por vencer',
  expired: 'Vencido',
};

const STATUS_CLASS: Record<ComplianceStatus, string> = {
  missing: 'bg-muted text-muted-foreground',
  ok: 'bg-emerald-600 text-white',
  expiring: 'bg-amber-500 text-white',
  expired: 'bg-destructive text-destructive-foreground',
};

export function StatusBadge({ status }: { status: ComplianceStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}
