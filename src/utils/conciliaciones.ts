import { ACCOUNT_REF_SEPARATOR, ACCOUNT_TYPE_OPTIONS, type AccountTypeOption } from '@/constants/conciliaciones';

export function formatCalendarDate(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const raw = typeof value === 'string' ? value : value.toISOString();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${Number(match[3])}/${Number(match[2])}/${match[1]}`;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return `${date.getUTCDate()}/${date.getUTCMonth() + 1}/${date.getUTCFullYear()}`;
}

export function toDateInputValue(value: string | Date | null | undefined): string {
  if (!value) return '';
  const raw = typeof value === 'string' ? value : value.toISOString();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

export function currentArgentinaBusinessDateKey(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function currentFortnightSelection(date = new Date()): { month: string; fortnight: 'first' | 'second' } {
  const dayKey = currentArgentinaBusinessDateKey(date);
  const day = Number(dayKey.slice(8, 10));
  return {
    month: dayKey.slice(0, 7),
    fortnight: day <= 15 ? 'first' : 'second',
  };
}

export function fortnightLabel(fortnight: 'first' | 'second'): string {
  return fortnight === 'first' ? '1ra quincena' : '2da quincena';
}

export function normConcept(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/\u00A0/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

const ACCOUNT_TYPE_SET = new Set<string>(ACCOUNT_TYPE_OPTIONS);

export type ParsedAccountRef = {
  type: AccountTypeOption | null;
  number: string;
  isCanonical: boolean;
  isLegacy: boolean;
  raw: string;
};

export function formatAccountRef(type: string, number?: string): string | null {
  const normalizedType = type.trim();
  if (!normalizedType || !ACCOUNT_TYPE_SET.has(normalizedType)) return null;
  const ref = (number ?? '').trim();
  return ref ? `${normalizedType}${ACCOUNT_REF_SEPARATOR}${ref}` : normalizedType;
}

export function parseAccountRef(raw: string | null | undefined): ParsedAccountRef {
  const value = (raw ?? '').trim();
  if (!value) {
    return { type: null, number: '', isCanonical: false, isLegacy: false, raw: '' };
  }

  if (ACCOUNT_TYPE_SET.has(value)) {
    return {
      type: value as AccountTypeOption,
      number: '',
      isCanonical: true,
      isLegacy: false,
      raw: value,
    };
  }

  for (const type of ACCOUNT_TYPE_OPTIONS) {
    const prefix = `${type}${ACCOUNT_REF_SEPARATOR}`;
    if (value.startsWith(prefix)) {
      const number = value.slice(prefix.length).trim();
      if (!number) continue;
      return {
        type,
        number,
        isCanonical: true,
        isLegacy: false,
        raw: value,
      };
    }
  }

  return { type: null, number: '', isCanonical: false, isLegacy: true, raw: value };
}

export function groupConceptVariants(
  concepts: string[],
): Array<{ key: string; label: string; variants: string[] }> {
  const byKey = new Map<string, { label: string; variants: string[]; count: Map<string, number> }>();
  for (const raw of concepts) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = normConcept(trimmed);
    const cur = byKey.get(key);
    if (!cur) {
      const count = new Map<string, number>([[trimmed, 1]]);
      byKey.set(key, { label: trimmed, variants: [trimmed], count });
      continue;
    }
    cur.count.set(trimmed, (cur.count.get(trimmed) ?? 0) + 1);
    if (!cur.variants.includes(trimmed)) cur.variants.push(trimmed);
    const labelCount = cur.count.get(cur.label) ?? 0;
    const newCount = cur.count.get(trimmed) ?? 0;
    if (newCount > labelCount) cur.label = trimmed;
  }
  return Array.from(byKey.entries())
    .map(([key, { label, variants }]) => ({ key, label, variants }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
