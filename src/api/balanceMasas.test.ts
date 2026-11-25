import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetch = vi.fn();
vi.mock('./client', () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
  API_BASE_URL: 'http://api.test/api',
  getAccessToken: () => 'tok',
}));

const { balanceMasasApi } = await import('./balanceMasas');

const lastCall = () => apiFetch.mock.calls[apiFetch.mock.calls.length - 1] as [string, RequestInit | undefined];

describe('balanceMasasApi', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockResolvedValue({});
  });

  it('sends the confirmed month and revision when deleting a close', async () => {
    await balanceMasasApi.eliminarMes('2026-10', 7);
    expect(lastCall()).toEqual(['/balance-masas/meses/2026-10', { method: 'DELETE', body: '{"revision":7}' }]);
  });

  it('reads the overview, a closed month, the draft and the audit list', async () => {
    await balanceMasasApi.estado();
    expect(lastCall()[0]).toBe('/balance-masas/estado');
    await balanceMasasApi.mes('2026-10');
    expect(lastCall()[0]).toBe('/balance-masas/meses/2026-10');
    await balanceMasasApi.borrador();
    expect(lastCall()[0]).toBe('/balance-masas/borrador');
    await balanceMasasApi.eventos();
    expect(lastCall()[0]).toBe('/balance-masas/eventos');
  });

  it('reads a report history with optional month and product filters', async () => {
    await balanceMasasApi.reporte('remitos', {});
    expect(lastCall()[0]).toBe('/balance-masas/reportes/remitos');
    await balanceMasasApi.reporte('registradas', { mes: '2026-10', producto: 'PIEDRA 6-20' });
    expect(lastCall()[0]).toBe('/balance-masas/reportes/registradas?mes=2026-10&producto=PIEDRA+6-20');
  });

  it('uploads reports as multipart field "archivos"', async () => {
    const a = new File(['x'], 'compras.xls');
    const b = new File(['y'], 'ventas.xlsx');
    await balanceMasasApi.agregarArchivos([a, b]);
    const [path, opts] = lastCall();
    expect(path).toBe('/balance-masas/borrador/archivos');
    expect(opts?.method).toBe('POST');
    const form = opts?.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect(form.getAll('archivos').map((f) => (f as File).name)).toEqual(['compras.xls', 'ventas.xlsx']);
  });

  it('removes a file, updates and discards the draft', async () => {
    await balanceMasasApi.quitarArchivo('id-1');
    expect(lastCall()).toEqual(['/balance-masas/borrador/archivos/id-1', { method: 'DELETE' }]);

    await balanceMasasApi.actualizarBorrador({ mesElegido: '2026-11' });
    expect(lastCall()[0]).toBe('/balance-masas/borrador');
    expect(lastCall()[1]?.method).toBe('PATCH');
    expect(JSON.parse(String(lastCall()[1]?.body))).toEqual({ mesElegido: '2026-11' });

    await balanceMasasApi.descartarBorrador();
    expect(lastCall()).toEqual(['/balance-masas/borrador', { method: 'DELETE' }]);
  });

  it('saves the month with the revision the screen was showing', async () => {
    await balanceMasasApi.guardarMes(7);
    expect(lastCall()[0]).toBe('/balance-masas/borrador/guardar');
    expect(lastCall()[1]?.method).toBe('POST');
    expect(JSON.parse(String(lastCall()[1]?.body))).toEqual({ revision: 7 });
  });

  it('saves the reviews of a closed month', async () => {
    const revisiones = { 'a-1': { estado: 'rechazado', comentario: 'No corresponde', fecha: '25/11/2026' } };
    await balanceMasasApi.revisarMes('2026-10', 3, revisiones);
    expect(lastCall()[0]).toBe('/balance-masas/meses/2026-10/revisiones');
    expect(lastCall()[1]?.method).toBe('PATCH');
    expect(JSON.parse(String(lastCall()[1]?.body))).toEqual({ revision: 3, revisiones });
  });

  it('imports the history xlsx as multipart field "archivo"', async () => {
    await balanceMasasApi.importarHistorial(new File(['z'], 'historial_balance.xlsx'));
    const [path, opts] = lastCall();
    expect(path).toBe('/balance-masas/historial/importar');
    expect(opts?.method).toBe('POST');
    expect(((opts?.body as FormData).get('archivo') as File).name).toBe('historial_balance.xlsx');
  });

  it('downloads the history export with the access token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob(['x'])) });
    vi.stubGlobal('fetch', fetchMock);
    const blob = await balanceMasasApi.exportarHistorial();
    expect(blob).toBeInstanceOf(Blob);
    expect(fetchMock).toHaveBeenCalledWith('http://api.test/api/balance-masas/historial/exportar', {
      headers: { Authorization: 'Bearer tok' },
    });
    vi.unstubAllGlobals();
  });
});
