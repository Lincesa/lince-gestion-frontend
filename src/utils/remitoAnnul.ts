/** Void ("anulado") helpers shared by the OCR dashboard and the Logística remitos list. */

export interface AnnulInfo {
  annulledAt?:     string | null;
  annulledBy?:     string | null;
  annulledByName?: string | null;
  annulReason?:    string | null;
}

export const ANNUL_REASON_MAX = 500;
export const COMMENT_BODY_MAX = 2000;

const SELECTED_ROW = 'bg-primary/[0.08] ring-1 ring-inset ring-primary/20';
const PLAIN_HOVER = 'hover:bg-accent/60';

export function isRemitoAnnulled(remito: AnnulInfo): boolean {
  return Boolean(remito.annulledAt);
}

/**
 * Background, hover and selection classes for a list row. Voided rows get a red tint
 * plus a left red border, and keep a red hover; selection adds a stronger tint and a
 * ring so it stays distinguishable. Rows that are not voided keep the existing look.
 */
export function annulledRowClass(remito: AnnulInfo, selected: boolean): string {
  if (!isRemitoAnnulled(remito)) return selected ? `${PLAIN_HOVER} ${SELECTED_ROW}` : PLAIN_HOVER;
  const base = 'border-l-4 border-l-destructive';
  return selected
    ? `${base} bg-destructive/15 ring-1 ring-inset ring-destructive/40 hover:bg-destructive/20`
    : `${base} bg-destructive/[0.06] hover:bg-destructive/[0.12]`;
}

/** es-AR date and time, e.g. "29/10/2026, 12:30". */
export function formatEsArDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** "Anulado por Ana Pérez el 29/10/2026, 12:30" — the author is omitted when unknown. */
export function describeAnnulment(remito: AnnulInfo): string {
  const when = remito.annulledAt ? formatEsArDateTime(remito.annulledAt) : '';
  const who = remito.annulledByName?.trim();
  return [
    'Anulado',
    who ? `por ${who}` : null,
    when ? `el ${when}` : null,
  ].filter(Boolean).join(' ');
}

interface AnnulUser {
  globalRole: string;
  modules?:   Partial<Record<string, { enabled?: boolean; role?: string }>>;
}

/** OCR side (A1): global ADMIN/SUPERADMIN or an OCR module ADMIN may void and unvoid. */
export function canManageOcrAnnul(user: AnnulUser | null | undefined): boolean {
  if (!user) return false;
  if (user.globalRole === 'ADMIN' || user.globalRole === 'SUPERADMIN') return true;
  return user.modules?.ocr?.role === 'ADMIN';
}
