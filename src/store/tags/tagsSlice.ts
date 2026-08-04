import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as tagsApi from '@/api/tags';
import type { TagsModule, TagStatusDto, TagStatusEventDto } from '@/types/tags.types';

interface TagsState {
  items:          TagStatusDto[];
  events:         TagStatusEventDto[];
  eventsUserId:   string | null;
  loading:        boolean;
  eventsLoading:  boolean;
  submitting:     boolean;
  error:          string | null;
}

const initialState: TagsState = {
  items:         [],
  events:        [],
  eventsUserId:  null,
  loading:       false,
  eventsLoading: false,
  submitting:    false,
  error:         null,
};

// ── Thunks (parametrizados por módulo: 'ocr' | 'logistica') ──────────────────

export const fetchTags = createAsyncThunk(
  'tags/fetchAll',
  (module: TagsModule) => tagsApi.getTags(module),
);

export const fetchTagEvents = createAsyncThunk(
  'tags/fetchEvents',
  ({ module, userId }: { module: TagsModule; userId: string }) =>
    tagsApi.getTagEvents(module, userId).then((events) => ({ userId, events })),
);

export const suspendTag = createAsyncThunk(
  'tags/suspend',
  ({ module, userId, reason }: { module: TagsModule; userId: string; reason?: string }) =>
    tagsApi.suspendTag(module, userId, reason),
);

export const reactivateTag = createAsyncThunk(
  'tags/reactivate',
  ({ module, userId, note }: { module: TagsModule; userId: string; note?: string }) =>
    tagsApi.reactivateTag(module, userId, note),
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const tagsSlice = createSlice({
  name: 'tags',
  initialState,
  reducers: {
    clearEvents: (state) => { state.events = []; state.eventsUserId = null; },
    clearError:  (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    // fetchTags
    builder
      .addCase(fetchTags.pending,   (state) => { state.loading = true; state.error = null; })
      .addCase(fetchTags.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchTags.rejected,  (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Error al cargar tags';
      });

    // fetchTagEvents
    builder
      .addCase(fetchTagEvents.pending,   (state) => { state.eventsLoading = true; })
      .addCase(fetchTagEvents.fulfilled, (state, action) => {
        state.eventsLoading = false;
        state.events = action.payload.events;
        state.eventsUserId = action.payload.userId;
      })
      .addCase(fetchTagEvents.rejected,  (state, action) => {
        state.eventsLoading = false;
        state.error = action.error.message ?? 'Error al cargar historial';
      });

    // suspendTag
    builder
      .addCase(suspendTag.pending,   (state) => { state.submitting = true; state.error = null; })
      .addCase(suspendTag.fulfilled, (state, action) => {
        state.submitting = false;
        state.items = state.items.map((t) => (t.id === action.payload.id ? action.payload : t));
      })
      .addCase(suspendTag.rejected,  (state, action) => {
        state.submitting = false;
        state.error = action.error.message ?? 'Error al suspender la tag';
      });

    // reactivateTag
    builder
      .addCase(reactivateTag.pending,   (state) => { state.submitting = true; state.error = null; })
      .addCase(reactivateTag.fulfilled, (state, action) => {
        state.submitting = false;
        state.items = state.items.map((t) => (t.id === action.payload.id ? action.payload : t));
      })
      .addCase(reactivateTag.rejected,  (state, action) => {
        state.submitting = false;
        state.error = action.error.message ?? 'Error al reactivar la tag';
      });
  },
});

export const { clearEvents, clearError } = tagsSlice.actions;
export default tagsSlice.reducer;
