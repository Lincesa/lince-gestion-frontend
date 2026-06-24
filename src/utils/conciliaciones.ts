export function normConcept(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/\u00A0/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
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
