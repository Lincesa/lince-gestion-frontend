import { apiFetch, API_BASE_URL, getAccessToken } from './client';
import type {
  EstadoBalance,
  EventoBalance,
  FilaReporte,
  GuardadoMes,
  MesCerrado,
  RevisionGuardada,
  Revisiones,
  TipoReporte,
  VistaBorrador,
} from '@/types/balanceMasas.types';

const BASE = '/balance-masas';

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export const balanceMasasApi = {
  /** Closed months, history revision, last change and the product master. */
  estado: () => apiFetch<EstadoBalance>(`${BASE}/estado`),

  /** Dashboard of a closed month ("aaaa-mm"). */
  mes: (mes: string) => apiFetch<MesCerrado>(`${BASE}/meses/${mes}`),

  /** Confirm / reject adjustments of a closed month. */
  revisarMes: (mes: string, revision: number, revisiones: Revisiones) =>
    apiFetch<RevisionGuardada>(`${BASE}/meses/${mes}/revisiones`, json('PATCH', { revision, revisiones })),

  /** Report history (side menu), optionally filtered by month and product. */
  reporte: (tipo: TipoReporte, filtro: { mes?: string; producto?: string }) => {
    const q = new URLSearchParams();
    if (filtro.mes) q.set('mes', filtro.mes);
    if (filtro.producto) q.set('producto', filtro.producto);
    const qs = q.toString();
    return apiFetch<FilaReporte[]>(`${BASE}/reportes/${tipo}${qs ? `?${qs}` : ''}`);
  },

  eventos: () => apiFetch<EventoBalance[]>(`${BASE}/eventos`),

  // ---------------- Month being built ----------------

  borrador: () => apiFetch<VistaBorrador>(`${BASE}/borrador`),

  agregarArchivos: (archivos: File[]) => {
    const form = new FormData();
    for (const f of archivos) form.append('archivos', f);
    return apiFetch<VistaBorrador>(`${BASE}/borrador/archivos`, { method: 'POST', body: form });
  },

  quitarArchivo: (id: string) => apiFetch<VistaBorrador>(`${BASE}/borrador/archivos/${id}`, { method: 'DELETE' }),

  actualizarBorrador: (cambios: { mesElegido?: string | null; revisiones?: Revisiones }) =>
    apiFetch<VistaBorrador>(`${BASE}/borrador`, json('PATCH', cambios)),

  descartarBorrador: () => apiFetch<VistaBorrador>(`${BASE}/borrador`, { method: 'DELETE' }),

  /** Closes the month being built; `revision` is the history revision the screen was showing (409 if stale). */
  guardarMes: (revision: number) => apiFetch<GuardadoMes>(`${BASE}/borrador/guardar`, json('POST', { revision })),

  // ---------------- historial_balance.xlsx ----------------

  importarHistorial: (archivo: File) => {
    const form = new FormData();
    form.append('archivo', archivo);
    return apiFetch<{ revision: number; meses: number }>(`${BASE}/historial/importar`, { method: 'POST', body: form });
  },

  exportarHistorial: async (): Promise<Blob> => {
    const res = await fetch(`${API_BASE_URL}${BASE}/historial/exportar`, {
      headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: 'Error al exportar' }));
      const raw = (error as { message?: string | string[] }).message;
      throw new Error(Array.isArray(raw) ? raw.join(' · ') : (raw ?? `Error ${res.status}`));
    }
    return res.blob();
  },
};
