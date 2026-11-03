import type { ComplianceCadence } from '@/types/logistica.types';

const CADENCE_MONTHS: Partial<Record<ComplianceCadence, number>> = {
  monthly: 1,
  semiannual: 6,
  annual: 12,
};

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Suggested expiry (YYYY-MM-DD) for a document of the given cadence, counted from `today`.
 * Cadences without a fixed period (once, custom) return '' so the date stays empty as before.
 * A day that does not exist in the target month is clamped to its last day.
 */
export function defaultExpiryFor(cadence: ComplianceCadence, today: Date = new Date()): string {
  const months = CADENCE_MONTHS[cadence];
  if (!months) return '';
  const target = new Date(today.getFullYear(), today.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(today.getDate(), lastDay));
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
}
