import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { GlobalRole } from '@/types/auth.types';
import { HistorialPage } from './HistorialPage';

const auth = vi.hoisted(() => ({ role: '' }));

vi.mock('@/store', () => ({
  useAppSelector: (select: (state: unknown) => unknown) => select({ auth: { user: { globalRole: auth.role } } }),
}));
vi.mock('./BalanceMasasLayout', () => ({
  useBalanceMasas: () => ({
    estado: { mesesCerrados: ['2026-09', '2026-10'], ultimoMes: '2026-10', revision: 10 },
    recargarEstado: vi.fn(),
    canAdmin: true,
  }),
}));

describe('month deletion panel', () => {
  it('shows the separate latest-month action only to SUPERADMIN, not a module administrator', () => {
    auth.role = GlobalRole.USER;
    expect(renderToStaticMarkup(<HistorialPage />)).not.toContain('Eliminar último mes');
    auth.role = GlobalRole.SUPERADMIN;
    const page = renderToStaticMarkup(<HistorialPage />);
    expect(page).toContain('Administración de cierres');
    expect(page).toContain('Eliminar último mes');
    expect(page).not.toContain('Esta acción no se puede deshacer');
  });
});
