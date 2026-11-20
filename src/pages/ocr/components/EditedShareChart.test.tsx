import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EditedShareChart, editedShare } from './EditedShareChart';

describe('editedShare', () => {
  it('splits the uploaded remitos into edited and not edited, with the edited percentage', () => {
    expect(editedShare(200, 50)).toEqual({ edited: 50, notEdited: 150, percent: 25 });
  });

  it('rounds the percentage to one decimal', () => {
    expect(editedShare(3, 1)?.percent).toBe(33.3);
  });

  it('returns null when there are no remitos to compare', () => {
    expect(editedShare(0, 0)).toBeNull();
  });

  it('never counts more edited remitos than uploaded ones', () => {
    expect(editedShare(10, 12)).toEqual({ edited: 10, notEdited: 0, percent: 100 });
  });
});

describe('EditedShareChart', () => {
  it('shows the edited percentage and both counts', () => {
    const html = renderToStaticMarkup(<EditedShareChart total={200} edited={50} />);
    expect(html).toContain('Editados / subidos');
    expect(html).toContain('25%');
    expect(html).toContain('Editados');
    expect(html).toContain('50');
    expect(html).toContain('Sin editar');
    expect(html).toContain('150');
  });

  it('explains that there is nothing to chart when no remito matches', () => {
    const html = renderToStaticMarkup(<EditedShareChart total={0} edited={0} />);
    expect(html).toContain('No hay remitos para estos filtros');
    expect(html).not.toContain('%');
  });
});
