import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { logisticaApi, type ListRemitosParams, type MapaRemitosParams } from '@/api/logistica';
import type { PaginatedRemitos, RemitoDetalle, RemitoLogistica } from '@/types/logistica.types';

interface RemitosLogisticaState {
  list: RemitoLogistica[];
  mapaItems: RemitoLogistica[];
  selected: RemitoDetalle | null;
  loading: boolean;
  mapaLoading: boolean;
  detailLoading: boolean;
  error: string | null;
  pagination: Pick<PaginatedRemitos, 'page' | 'total' | 'pages' | 'limit'>;
}

const initialState: RemitosLogisticaState = {
  list:          [],
  mapaItems:     [],
  selected:      null,
  loading:       false,
  mapaLoading:   false,
  detailLoading: false,
  error:         null,
  pagination:    { page: 1, total: 0, pages: 0, limit: 20 },
};

export const fetchRemitos = createAsyncThunk(
  'remitosLogistica/fetchAll',
  (params: ListRemitosParams = {}) => logisticaApi.listRemitos(params),
);

export const fetchMapaRemitos = createAsyncThunk(
  'remitosLogistica/fetchMapa',
  (params: MapaRemitosParams = {}) => logisticaApi.getMapaRemitos(params),
);

export const fetchRemitoDetalle = createAsyncThunk(
  'remitosLogistica/fetchDetalle',
  (id: string) => logisticaApi.getRemito(id),
);


const remitosSlice = createSlice({
  name: 'remitosLogistica',
  initialState,
  reducers: {
    clearSelectedRemito(state) {
      state.selected = null;
    },
    removeRemitoFromList(state, action: { payload: string }) {
      const id = action.payload;
      state.list      = state.list.filter(r => r.id !== id);
      state.mapaItems = state.mapaItems.filter(r => r.id !== id);
      state.pagination.total = Math.max(0, state.pagination.total - 1);
      if (state.selected?.id === id) state.selected = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchRemitos
      .addCase(fetchRemitos.pending, (state) => {
        state.loading = true;
        state.error   = null;
      })
      .addCase(fetchRemitos.fulfilled, (state, action) => {
        state.loading    = false;
        state.list       = action.payload.items;
        state.pagination = {
          page:  action.payload.page,
          total: action.payload.total,
          pages: action.payload.pages,
          limit: action.payload.limit,
        };
      })
      .addCase(fetchRemitos.rejected, (state, action) => {
        state.loading = false;
        state.error   = action.error.message ?? 'Error al cargar remitos';
      })

      // fetchMapaRemitos
      .addCase(fetchMapaRemitos.pending, (state) => {
        state.mapaLoading = true;
      })
      .addCase(fetchMapaRemitos.fulfilled, (state, action) => {
        state.mapaLoading = false;
        state.mapaItems   = action.payload;
      })
      .addCase(fetchMapaRemitos.rejected, (state) => {
        state.mapaLoading = false;
      })

      // fetchRemitoDetalle
      .addCase(fetchRemitoDetalle.pending, (state) => {
        state.detailLoading = true;
      })
      .addCase(fetchRemitoDetalle.fulfilled, (state, action) => {
        state.detailLoading = false;
        state.selected      = action.payload;
      })
      .addCase(fetchRemitoDetalle.rejected, (state) => {
        state.detailLoading = false;
      })

  },
});

export const { clearSelectedRemito, removeRemitoFromList } = remitosSlice.actions;
export default remitosSlice.reducer;
