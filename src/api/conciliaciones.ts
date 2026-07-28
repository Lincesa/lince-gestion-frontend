import { apiFetch, API_BASE_URL, getAccessToken } from './client';
import type {
  RunSummary,
  ReconciliationRun,
  RunPayload,
  RunDetail,
  ExpenseCategory,
  Message,
  Issue,
  SystemMapping,
} from '@/types/conciliaciones.types';

const BASE = `${API_BASE_URL}/conciliaciones`;

export const conciliacionesApi = {
  listRuns: (company?: string) =>
    apiFetch<ReconciliationRun[]>(`/conciliaciones/reconciliations${company ? `?company=${encodeURIComponent(company)}` : ''}`),

  getRun: (id: string) =>
    apiFetch<RunDetail>(`/conciliaciones/reconciliations/${id}`),

  createRun: (payload: RunPayload) =>
    apiFetch<RunSummary>(`/conciliaciones/reconciliations`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateRun: (id: string, data: { status?: 'OPEN' | 'CLOSED'; bankName?: string | null; company?: string | null; enabledCategoryIds?: string[]; windowDays?: number }) =>
    apiFetch<RunDetail>(`/conciliaciones/reconciliations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteRun: (id: string) =>
    apiFetch<{ deleted: boolean }>(`/conciliaciones/reconciliations/${id}`, { method: 'DELETE' }),

  updateSystemData: (runId: string, data: { rows: Record<string, unknown>[]; mapping: SystemMapping }) =>
    apiFetch<RunDetail>(`/conciliaciones/reconciliations/${runId}/system`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  excludeConcept: (runId: string, concept: string) =>
    apiFetch<RunDetail>(`/conciliaciones/reconciliations/${runId}/exclude-concept`, {
      method: 'PATCH',
      body: JSON.stringify({ concept }),
    }),

  excludeConcepts: (runId: string, concepts: string[]) =>
    apiFetch<RunDetail>(`/conciliaciones/reconciliations/${runId}/exclude-concepts`, {
      method: 'PATCH',
      body: JSON.stringify({ concepts }),
    }),

  excludeByCategory: (runId: string, categoryId: string) =>
    apiFetch<RunDetail>(`/conciliaciones/reconciliations/${runId}/exclude-by-category`, {
      method: 'PATCH',
      body: JSON.stringify({ categoryId }),
    }),

  removeExcludedConcept: (runId: string, concept: string) =>
    apiFetch<RunDetail>(`/conciliaciones/reconciliations/${runId}/remove-excluded-concept`, {
      method: 'PATCH',
      body: JSON.stringify({ concept }),
    }),

  setMatch: (runId: string, systemLineIds: string[], extractLineIds: string[]) =>
    apiFetch<RunDetail>(`/conciliaciones/reconciliations/${runId}/match`, {
      method: 'POST',
      body: JSON.stringify({ systemLineIds, extractLineIds }),
    }),

  exportRun: async (id: string): Promise<Blob> => {
    const res = await fetch(`${BASE}/reconciliations/${id}/export`, {
      headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
    });
    if (!res.ok) throw new Error('No se pudo exportar');
    return res.blob();
  },

  shareRun: (id: string, email: string, role: 'OWNER' | 'EDITOR' | 'VIEWER') =>
    apiFetch(`/conciliaciones/reconciliations/${id}/share`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    }),

  removeMember: (runId: string, userId: string) =>
    apiFetch(`/conciliaciones/reconciliations/${runId}/members/${userId}`, { method: 'DELETE' }),

  addMessage: (id: string, body: string) =>
    apiFetch<Message>(`/conciliaciones/reconciliations/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),

  parseFile: async (
    file: File,
    sheetName?: string,
    headerRow?: number,
  ): Promise<{ sheets: string[]; rows: Record<string, unknown>[] }> => {
    const form = new FormData();
    form.append('file', file);
    if (sheetName) form.append('sheetName', sheetName);
    if (headerRow != null) form.append('headerRow', String(headerRow));
    const res = await fetch(`${BASE}/reconciliations/parse`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
      body: form,
    });
    if (!res.ok) {
      const text = await res.text();
      try {
        const data = JSON.parse(text) as { message?: string | string[] };
        const msg = Array.isArray(data.message) ? data.message.join(' ') : (data.message ?? text);
        throw new Error(msg || 'No se pudo parsear archivo');
      } catch {
        throw new Error(text || 'No se pudo parsear archivo');
      }
    }
    return res.json() as Promise<{ sheets: string[]; rows: Record<string, unknown>[] }>;
  },

  createPending: (runId: string, data: { area: string; systemLineId?: string; note?: string }) =>
    apiFetch(`/conciliaciones/reconciliations/${runId}/pending`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  resolvePending: (runId: string, pendingId: string, note: string) =>
    apiFetch(`/conciliaciones/reconciliations/${runId}/pending/${pendingId}/resolve`, {
      method: 'PATCH',
      body: JSON.stringify({ note }),
    }),

  notifyPending: (runId: string, data: { areas: string[]; customMessage?: string }) =>
    apiFetch<Array<{ area: string; email: string; sent: boolean; error?: string }>>(
      `/conciliaciones/reconciliations/${runId}/notify`,
      { method: 'POST', body: JSON.stringify(data) },
    ),

  createIssue: (runId: string, data: { title: string; body?: string }) =>
    apiFetch<Issue>(`/conciliaciones/reconciliations/${runId}/issues`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateIssue: (runId: string, issueId: string, data: { title?: string; body?: string }) =>
    apiFetch<Issue>(`/conciliaciones/reconciliations/${runId}/issues/${issueId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  addIssueComment: (runId: string, issueId: string, body: string) =>
    apiFetch<Issue['comments'][0]>(
      `/conciliaciones/reconciliations/${runId}/issues/${issueId}/comments`,
      { method: 'POST', body: JSON.stringify({ body }) },
    ),

  listCategories: () =>
    apiFetch<ExpenseCategory[]>(`/conciliaciones/expenses/categories`),

  createCategory: (name: string) =>
    apiFetch<ExpenseCategory>(`/conciliaciones/expenses/categories`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  deleteCategory: (id: string) =>
    apiFetch(`/conciliaciones/expenses/categories/${id}`, { method: 'DELETE' }),

  createRule: (payload: { categoryId: string; pattern: string; isRegex?: boolean; caseSensitive?: boolean }) =>
    apiFetch(`/conciliaciones/expenses/rules`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteRule: (id: string) =>
    apiFetch(`/conciliaciones/expenses/rules/${id}`, { method: 'DELETE' }),
};
