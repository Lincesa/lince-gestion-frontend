import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ExtractLine, RunDetail, SystemLine } from '@/types/conciliaciones.types';
import { ResumenPanel } from './ResumenPanel';

function buildDetail(overrides: Partial<RunDetail> = {}): RunDetail {
  return {
    id: 'run-1',
    createdAt: '2026-09-01T00:00:00.000Z',
    extractLines: [],
    systemLines: [],
    matches: [],
    unmatchedExtract: [],
    unmatchedSystem: [],
    messages: [],
    members: [],
    ...overrides,
  };
}

const baseProps = {
  pendingItems: [],
  systemById: new Map<string, SystemLine>(),
  extractById: new Map<string, ExtractLine>(),
  isClosed: false,
  canEdit: true,
  onResolvePending: () => {},
  onOpenAddPending: () => {},
};

describe('ResumenPanel sign-opposite advisory warning', () => {
  it('renders nothing when signOppositeMatches is absent', () => {
    const detail = buildDetail();
    const html = renderToStaticMarkup(createElement(ResumenPanel, { detail, ...baseProps }));
    expect(html).not.toContain('signo opuesto');
  });

  it('renders nothing when signOppositeMatches is empty', () => {
    const detail = buildDetail({ signOppositeMatches: [] });
    const html = renderToStaticMarkup(createElement(ResumenPanel, { detail, ...baseProps }));
    expect(html).not.toContain('signo opuesto');
  });

  it('surfaces an advisory warning listing each flagged match, without blocking anything', () => {
    const systemById = new Map<string, SystemLine>([
      ['sys-1', { id: 'sys-1', issueDate: '2026-09-10', dueDate: null, amount: -10000000, description: 'BARRIONUEVO AGUSTIN' }],
    ]);
    const extractById = new Map<string, ExtractLine>([
      ['ext-1', { id: 'ext-1', date: '2026-09-11', concept: 'CONSALVI, JORGE', amount: 10000000 }],
    ]);
    const detail = buildDetail({
      signOppositeMatches: [
        {
          matchId: 'match-1',
          systemLineId: 'sys-1',
          extractLineId: 'ext-1',
          systemAmount: -10000000,
          extractAmount: 10000000,
        },
      ],
    });

    const html = renderToStaticMarkup(
      createElement(ResumenPanel, { detail, ...baseProps, systemById, extractById }),
    );

    expect(html).toContain('signo opuesto');
    expect(html).toContain('BARRIONUEVO AGUSTIN');
    expect(html).toContain('CONSALVI, JORGE');
    // Advisory only: no destructive action is offered for these rows.
    expect(html).not.toContain('Eliminar');
    expect(html).not.toContain('Borrar');
  });
});
