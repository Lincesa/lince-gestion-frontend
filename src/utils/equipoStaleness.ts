export type StalenessLevel = 'nunca' | 'reciente' | 'atrasado' | 'critico';

export interface StalenessResult {
  level: StalenessLevel;
  label: string;
}

const DAY_MS = 1000 * 60 * 60 * 24;

export const STALENESS_COLORS: Record<StalenessLevel, string> = {
  nunca: 'bg-muted text-muted-foreground border border-border',
  reciente: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  atrasado: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  critico: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

/**
 * Classifies an equipment's last-check freshness into a badge-ready label.
 * `lastSeenAt === null` means the machine never completed a sync — a distinct
 * "unknown" state, not an extreme of staleness.
 */
export function equipoStaleness(lastSeenAt: string | null, now: Date = new Date()): StalenessResult {
  if (!lastSeenAt) {
    return { level: 'nunca', label: 'Sin sincronizar' };
  }

  const diffDays = Math.floor((now.getTime() - new Date(lastSeenAt).getTime()) / DAY_MS);

  if (diffDays <= 0) {
    return { level: 'reciente', label: 'Hoy' };
  }
  if (diffDays <= 7) {
    return { level: 'reciente', label: `Hace ${diffDays} día${diffDays === 1 ? '' : 's'}` };
  }
  if (diffDays <= 30) {
    return { level: 'atrasado', label: `Hace ${diffDays} días` };
  }

  const diffMonths = Math.floor(diffDays / 30);
  return { level: 'critico', label: `Hace ${diffMonths} mes${diffMonths === 1 ? '' : 'es'}` };
}

/**
 * Comparator for sorting equipment rows by `lastSeenAt`. Rows with
 * `lastSeenAt === null` (never synced) always sort last, in both directions,
 * because "never synced" is an unknown state, not "infinitely old".
 */
export function compareLastSeen(
  a: string | null,
  b: string | null,
  direction: 'asc' | 'desc',
): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const diff = new Date(a).getTime() - new Date(b).getTime();
  return direction === 'asc' ? diff : -diff;
}
