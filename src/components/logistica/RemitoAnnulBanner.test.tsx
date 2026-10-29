import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { RemitoAnnulBanner } from './RemitoAnnulBanner';

const voided = {
  annulledAt: '2026-10-29T15:30:00.000Z',
  annulledBy: 'user-1',
  annulledByName: 'Ana Pérez',
  annulReason: 'Remito duplicado',
};

describe('RemitoAnnulBanner', () => {
  it('shows the reason, who and when for a voided remito, plus Desanular for managers', () => {
    const html = renderToStaticMarkup(
      <RemitoAnnulBanner remito={voided} canManage onAnnul={vi.fn()} onUnannul={vi.fn()} />,
    );
    expect(html).toContain('Remito anulado');
    expect(html).toContain('Remito duplicado');
    expect(html).toContain('Ana Pérez');
    expect(html).toContain('Desanular');
    expect(html).not.toContain('Anular remito');
  });

  it('hides the actions from users who cannot manage the void', () => {
    const voidedHtml = renderToStaticMarkup(
      <RemitoAnnulBanner remito={voided} canManage={false} onAnnul={vi.fn()} onUnannul={vi.fn()} />,
    );
    expect(voidedHtml).toContain('Remito anulado');
    expect(voidedHtml).not.toContain('Desanular');

    const activeHtml = renderToStaticMarkup(
      <RemitoAnnulBanner remito={{ annulledAt: null }} canManage={false} onAnnul={vi.fn()} onUnannul={vi.fn()} />,
    );
    expect(activeHtml).toBe('');
  });

  it('offers Anular remito for an active remito', () => {
    const html = renderToStaticMarkup(
      <RemitoAnnulBanner remito={{ annulledAt: null }} canManage onAnnul={vi.fn()} onUnannul={vi.fn()} />,
    );
    expect(html).toContain('Anular remito');
    expect(html).not.toContain('Remito anulado');
  });
});
