import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ExtractLine, SystemLine } from '@/types/conciliaciones.types';
import { ChangeMatchDialog, filterSystemLinesByDescription, sumAmountsByIds } from './ChangeMatchDialog';

function buildRealWorldCaseLines(): SystemLine[] {
  // Simulates the real 293-row Sistema panel: raw file order, chronological from
  // January 2025, with the two candidate deposits buried among filler rows.
  const filler: SystemLine[] = Array.from({ length: 290 }, (_, i) => ({
    id: `filler-${i}`,
    issueDate: '2025-01-01',
    dueDate: '2025-01-01',
    amount: 100 + i,
    description: `Movimiento genérico ${i}`,
  }));

  const milagrosa: SystemLine = {
    id: 'sys-milagrosa',
    issueDate: '2026-09-20',
    dueDate: '2026-09-20',
    amount: 345984.38,
    description: ' LA MILAGROSA DE MONTE S.A',
  };

  const topoagro: SystemLine = {
    id: 'sys-topoagro',
    issueDate: '2026-09-21',
    dueDate: '2026-09-21',
    amount: 343715.62,
    description: 'TOPOAGRO S.R.L.',
  };

  return [...filler, milagrosa, topoagro];
}

describe('filterSystemLinesByDescription', () => {
  const lines = buildRealWorldCaseLines();

  it('locates "LA MILAGROSA DE MONTE S.A" among 292 other rows', () => {
    const result = filterSystemLinesByDescription(lines, 'milagrosa');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('sys-milagrosa');
  });

  it('locates "TOPOAGRO S.R.L." among 292 other rows', () => {
    const result = filterSystemLinesByDescription(lines, 'TOPOAGRO');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('sys-topoagro');
  });

  it('returns every row when the query is empty', () => {
    expect(filterSystemLinesByDescription(lines, '')).toHaveLength(lines.length);
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(filterSystemLinesByDescription(lines, '  topoagro  ')).toHaveLength(1);
  });
});

describe('sumAmountsByIds', () => {
  it('sums selected lines that are present in the full list even if a filter would hide them', () => {
    const lines = buildRealWorldCaseLines();
    const selected = new Set(['sys-milagrosa', 'sys-topoagro']);

    // Regression guard for the sum-drop trap: sums must be computed against the
    // full, unfiltered line set — never against whatever subset happens to be
    // visible under the current search filter.
    const filteredOutOfView = filterSystemLinesByDescription(lines, 'nonexistent-query');
    expect(filteredOutOfView).toHaveLength(0);

    const sum = sumAmountsByIds(lines, selected);
    expect(sum).toBeCloseTo(689700.0, 2);
  });

  it('ignores ids that are not present in the line set', () => {
    const lines = buildRealWorldCaseLines();
    const sum = sumAmountsByIds(lines, new Set(['does-not-exist']));
    expect(sum).toBe(0);
  });
});

describe('ChangeMatchDialog rendering', () => {
  const systemLines = buildRealWorldCaseLines();
  const extractLines: ExtractLine[] = [
    { id: 'ext-1', date: '2026-09-23', concept: 'LA MILAGROSA DE MONTE SA', amount: 689700.0 },
  ];

  const baseProps = {
    open: true,
    onClose: () => {},
    runId: 'run-1',
    systemLines,
    extractLines,
    currentSystemIds: [],
    currentExtractIds: [],
    onSuccess: () => {},
  };

  it('renders a search input for the Sistema panel', () => {
    const html = renderToStaticMarkup(createElement(ChangeMatchDialog, baseProps));
    expect(html).toContain('placeholder="Buscar por descripción');
  });

  it('renders the issue date for each system line (System Line Date Visibility)', () => {
    const html = renderToStaticMarkup(createElement(ChangeMatchDialog, baseProps));
    expect(html).toContain('20/9/2026');
    expect(html).toContain('21/9/2026');
  });

  it('shows both real-world candidate rows in the unfiltered Sistema panel', () => {
    const html = renderToStaticMarkup(createElement(ChangeMatchDialog, baseProps));
    expect(html).toContain('LA MILAGROSA DE MONTE S.A');
    expect(html).toContain('TOPOAGRO S.R.L.');
  });
});
