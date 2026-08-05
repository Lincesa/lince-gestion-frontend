const HH_MM_RE = /^(\d{1,2}):([0-5]\d)$/;

export type ParseHhMmResult =
  | { ok: true; hours: number | null }
  | { ok: false; error: string };

export function formatHoursToHhMm(hours: number): string {
  const totalMinutes = Math.round(Math.max(0, hours) * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

export function formatMsToHhMm(ms: number): string {
  return formatHoursToHhMm(ms / 3600000);
}

export function parseHhMmToHours(raw: string): ParseHhMmResult {
  const text = raw.trim();
  if (text === '') return { ok: true, hours: null };

  const match = HH_MM_RE.exec(text);
  if (!match) {
    return { ok: false, error: 'Usá el formato H:MM (ej: 7:53). Vacío = día completo.' };
  }

  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 24 || (h === 24 && m > 0)) {
    return { ok: false, error: 'Las horas justificadas no pueden superar 24:00' };
  }

  const hours = Math.round((h + m / 60) * 100) / 100;
  return { ok: true, hours };
}
