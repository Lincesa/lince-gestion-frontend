import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as ocrApi from '@/api/ocr';
import type {
  FilterDocumentsParams,
  OcrDocument,
  PaginatedDocuments,
} from '@/types/ocr.types';
import { DocumentType } from '@/types/ocr.types';

interface DocumentsState {
  /** Vista ADMIN: todos los documentos */
  all:            PaginatedDocuments | null;
  /** Vista ADMIN: cola de revisión */
  reviewQueue:    PaginatedDocuments | null;
  /** Vista ADMINISTRATIVO: sus facturas */
  myFacturas:     PaginatedDocuments | null;
  /** Vista ADMINISTRATIVO: sus retenciones */
  myRetenciones:  PaginatedDocuments | null;
  /** Documento abierto en detalle */
  current:        OcrDocument | null;
  loading:        boolean;
  submitting:     boolean;
  error:          string | null;
}

const initialState: DocumentsState = {
  all:           null,
  reviewQueue:   null,
  myFacturas:    null,
  myRetenciones: null,
  current:       null,
  loading:       false,
  submitting:    false,
  error:         null,
};

// ── Thunks ────────────────────────────────────────────────────────────────────

export const fetchDocuments = createAsyncThunk(
  'ocrDocuments/fetchAll',
  (params: FilterDocumentsParams = {}) => ocrApi.getDocuments(params),
);

export const fetchReviewQueue = createAsyncThunk(
  'ocrDocuments/fetchReviewQueue',
  (params: FilterDocumentsParams = {}) => ocrApi.getReviewQueue(params),
);

export const fetchMyFacturas = createAsyncThunk(
  'ocrDocuments/fetchMyFacturas',
  (params: FilterDocumentsParams = {}) => ocrApi.getMyFacturas(params),
);

export const fetchMyRetenciones = createAsyncThunk(
  'ocrDocuments/fetchMyRetenciones',
  (params: FilterDocumentsParams = {}) => ocrApi.getMyRetenciones(params),
);

export const fetchDocument = createAsyncThunk(
  'ocrDocuments/fetchOne',
  (id: string) => ocrApi.getDocument(id),
);

export const approveDocument = createAsyncThunk(
  'ocrDocuments/approve',
  (id: string) => ocrApi.approveDocument(id),
);

export const rejectDocument = createAsyncThunk(
  'ocrDocuments/reject',
  ({ id, reason }: { id: string; reason?: string }) => ocrApi.rejectDocument(id, reason),
);

export const updateDocumentFields = createAsyncThunk(
  'ocrDocuments/updateFields',
  ({ id, fields }: { id: string; fields: Record<string, string> }) =>
    ocrApi.updateDocumentFields(id, fields),
);

export const deleteDocument = createAsyncThunk(
  'ocrDocuments/delete',
  (id: string) => ocrApi.deleteDocument(id).then(() => id),
);

export const bulkDeleteDocuments = createAsyncThunk(
  'ocrDocuments/bulkDelete',
  (ids: string[]) => ocrApi.bulkDeleteDocuments(ids).then((res) => ({ ...res, ids })),
);

// ── Slice ─────────────────────────────────────────────────────────────────────

function updateDocInList(
  list: PaginatedDocuments | null,
  updated: OcrDocument,
): PaginatedDocuments | null {
  if (!list) return list;
  return {
    ...list,
    items: list.items.map((d) => (d.id === updated.id ? updated : d)),
  };
}

const documentsSlice = createSlice({
  name: 'ocrDocuments',
  initialState,
  reducers: {
    clearCurrent: (state) => { state.current = null; },
    clearError:   (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    // fetchDocuments
    builder
      .addCase(fetchDocuments.pending,   (state) => { state.loading = true; state.error = null; })
      .addCase(fetchDocuments.fulfilled, (state, action) => {
        state.loading = false;
        state.all = action.payload;
      })
      .addCase(fetchDocuments.rejected,  (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Error al cargar documentos';
      });

    // fetchReviewQueue
    builder
      .addCase(fetchReviewQueue.pending,   (state) => { state.loading = true; state.error = null; })
      .addCase(fetchReviewQueue.fulfilled, (state, action) => {
        state.loading = false;
        state.reviewQueue = action.payload;
      })
      .addCase(fetchReviewQueue.rejected,  (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Error al cargar cola de revisión';
      });

    // fetchMyFacturas
    builder
      .addCase(fetchMyFacturas.pending,   (state) => { state.loading = true; state.error = null; })
      .addCase(fetchMyFacturas.fulfilled, (state, action) => {
        state.loading = false;
        state.myFacturas = action.payload;
      })
      .addCase(fetchMyFacturas.rejected,  (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Error al cargar facturas';
      });

    // fetchMyRetenciones
    builder
      .addCase(fetchMyRetenciones.pending,   (state) => { state.loading = true; state.error = null; })
      .addCase(fetchMyRetenciones.fulfilled, (state, action) => {
        state.loading = false;
        state.myRetenciones = action.payload;
      })
      .addCase(fetchMyRetenciones.rejected,  (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Error al cargar retenciones';
      });

    // fetchDocument (detalle)
    builder
      .addCase(fetchDocument.pending,   (state) => { state.loading = true; state.error = null; })
      .addCase(fetchDocument.fulfilled, (state, action) => {
        state.loading = false;
        state.current = action.payload;
      })
      .addCase(fetchDocument.rejected,  (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Error al cargar documento';
      });

    // approve / reject
    builder
      .addCase(approveDocument.pending,   (state) => { state.submitting = true; })
      .addCase(approveDocument.fulfilled, (state, action) => {
        state.submitting = false;
        const updated = action.payload;
        state.all         = updateDocInList(state.all, updated);
        state.reviewQueue = updateDocInList(state.reviewQueue, updated);
        if (state.current?.id === updated.id) state.current = updated;
      })
      .addCase(approveDocument.rejected,  (state, action) => {
        state.submitting = false;
        state.error = action.error.message ?? 'Error al aprobar';
      });

    builder
      .addCase(rejectDocument.pending,   (state) => { state.submitting = true; })
      .addCase(rejectDocument.fulfilled, (state, action) => {
        state.submitting = false;
        const updated = action.payload;
        state.all         = updateDocInList(state.all, updated);
        state.reviewQueue = updateDocInList(state.reviewQueue, updated);
        if (state.current?.id === updated.id) state.current = updated;
      })
      .addCase(rejectDocument.rejected,  (state, action) => {
        state.submitting = false;
        state.error = action.error.message ?? 'Error al rechazar';
      });

    // updateFields
    builder
      .addCase(updateDocumentFields.pending,   (state) => { state.submitting = true; })
      .addCase(updateDocumentFields.fulfilled, (state, action) => {
        state.submitting = false;
        const updated = action.payload;
        state.all           = updateDocInList(state.all, updated);
        state.reviewQueue   = updateDocInList(state.reviewQueue, updated);
        state.myFacturas    = updateDocInList(state.myFacturas, updated);
        state.myRetenciones = updateDocInList(state.myRetenciones, updated);
        if (state.current?.id === updated.id) state.current = updated;
      })
      .addCase(updateDocumentFields.rejected,  (state, action) => {
        state.submitting = false;
        state.error = action.error.message ?? 'Error al guardar campos';
      });

    // deleteDocument
    builder
      .addCase(deleteDocument.pending,   (state) => { state.submitting = true; })
      .addCase(deleteDocument.fulfilled, (state, action) => {
        state.submitting = false;
        const id = action.payload;
        const removeFromList = (list: PaginatedDocuments | null) => {
          if (!list) return list;
          return { ...list, items: list.items.filter((d) => d.id !== id), total: list.total - 1 };
        };
        state.all           = removeFromList(state.all);
        state.reviewQueue   = removeFromList(state.reviewQueue);
        state.myFacturas    = removeFromList(state.myFacturas);
        state.myRetenciones = removeFromList(state.myRetenciones);
        if (state.current?.id === id) state.current = null;
      })
      .addCase(deleteDocument.rejected,  (state, action) => {
        state.submitting = false;
        state.error = action.error.message ?? 'Error al eliminar documento';
      });

    // bulkDeleteDocuments
    builder
      .addCase(bulkDeleteDocuments.pending,   (state) => { state.submitting = true; })
      .addCase(bulkDeleteDocuments.fulfilled, (state, action) => {
        state.submitting = false;
        const deletedIds = new Set(action.payload.ids.filter(
          (id) => !action.payload.failed.includes(id),
        ));
        const removeFromList = (list: PaginatedDocuments | null) => {
          if (!list) return list;
          const filtered = list.items.filter((d) => !deletedIds.has(d.id));
          return { ...list, items: filtered, total: list.total - (list.items.length - filtered.length) };
        };
        state.all           = removeFromList(state.all);
        state.reviewQueue   = removeFromList(state.reviewQueue);
        state.myFacturas    = removeFromList(state.myFacturas);
        state.myRetenciones = removeFromList(state.myRetenciones);
        if (state.current && deletedIds.has(state.current.id)) state.current = null;
      })
      .addCase(bulkDeleteDocuments.rejected, (state, action) => {
        state.submitting = false;
        state.error = action.error.message ?? 'Error al eliminar documentos';
      });
  },
});

export const { clearCurrent, clearError } = documentsSlice.actions;
export default documentsSlice.reducer;
