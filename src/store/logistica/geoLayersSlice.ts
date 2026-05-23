import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { logisticaApi } from '@/api/logistica';
import type { GeoLayer, GeoPoint } from '@/types/logistica.types';

const VISIBILITY_KEY = 'lince-geo-layers-visibility';

function loadVisibility(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(VISIBILITY_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function saveVisibility(v: Record<string, boolean>) {
  try {
    localStorage.setItem(VISIBILITY_KEY, JSON.stringify(v));
  } catch {
    // ignore storage errors
  }
}

interface GeoLayersState {
  layers: GeoLayer[];
  visibility: Record<string, boolean>;
  loading: boolean;
  error: string | null;
  editingPoint: GeoPoint | null;
  isCreating: boolean;
  submitting: boolean;
}

const initialState: GeoLayersState = {
  layers: [],
  visibility: loadVisibility(),
  loading: false,
  error: null,
  editingPoint: null,
  isCreating: false,
  submitting: false,
};

export const fetchGeoLayers = createAsyncThunk(
  'geoLayers/fetchAll',
  () => logisticaApi.getGeoLayers(),
);

export const createGeoPoint = createAsyncThunk(
  'geoLayers/create',
  (data: Omit<GeoPoint, 'id' | 'orden' | 'createdAt' | 'updatedAt'>) =>
    logisticaApi.createGeoPoint(data),
);

export const updateGeoPoint = createAsyncThunk(
  'geoLayers/update',
  ({ id, data }: { id: string; data: Partial<Omit<GeoPoint, 'id' | 'orden' | 'createdAt' | 'updatedAt'>> }) =>
    logisticaApi.updateGeoPoint(id, data),
);

export const deleteGeoPoint = createAsyncThunk(
  'geoLayers/delete',
  async (id: string) => {
    await logisticaApi.deleteGeoPoint(id);
    return id;
  },
);

const geoLayersSlice = createSlice({
  name: 'geoLayers',
  initialState,
  reducers: {
    toggleLayerVisibility(state, action: PayloadAction<string>) {
      const carpeta = action.payload;
      const current = state.visibility[carpeta] ?? true;
      state.visibility[carpeta] = !current;
      saveVisibility(state.visibility);
    },
    setAllLayersVisible(state, action: PayloadAction<boolean>) {
      for (const layer of state.layers) {
        state.visibility[layer.carpeta] = action.payload;
      }
      saveVisibility(state.visibility);
    },
    openEditPoint(state, action: PayloadAction<GeoPoint>) {
      state.editingPoint = action.payload;
      state.isCreating = false;
    },
    openCreatePoint(state) {
      state.editingPoint = null;
      state.isCreating = true;
    },
    closeModal(state) {
      state.editingPoint = null;
      state.isCreating = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchGeoLayers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchGeoLayers.fulfilled, (state, action) => {
        state.loading = false;
        state.layers = action.payload;
        // Default all new layers to hidden
        for (const layer of action.payload) {
          if (!(layer.carpeta in state.visibility)) {
            state.visibility[layer.carpeta] = false;
          }
        }
        saveVisibility(state.visibility);
      })
      .addCase(fetchGeoLayers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Error al cargar capas';
      })

      .addCase(createGeoPoint.pending, (state) => { state.submitting = true; })
      .addCase(createGeoPoint.fulfilled, (state, action) => {
        state.submitting = false;
        state.isCreating = false;
        const point = action.payload;
        const layer = state.layers.find((l) => l.carpeta === point.carpeta);
        if (layer) {
          layer.points.push(point);
        } else {
          state.layers.push({ carpeta: point.carpeta, iconFile: point.iconFile, points: [point] });
        }
      })
      .addCase(createGeoPoint.rejected, (state) => { state.submitting = false; })

      .addCase(updateGeoPoint.pending, (state) => { state.submitting = true; })
      .addCase(updateGeoPoint.fulfilled, (state, action) => {
        state.submitting = false;
        state.editingPoint = null;
        const updated = action.payload;
        for (const layer of state.layers) {
          const idx = layer.points.findIndex((p) => p.id === updated.id);
          if (idx !== -1) {
            layer.points[idx] = updated;
            break;
          }
        }
      })
      .addCase(updateGeoPoint.rejected, (state) => { state.submitting = false; })

      .addCase(deleteGeoPoint.pending, (state) => { state.submitting = true; })
      .addCase(deleteGeoPoint.fulfilled, (state, action) => {
        state.submitting = false;
        state.editingPoint = null;
        const id = action.payload;
        for (const layer of state.layers) {
          const idx = layer.points.findIndex((p) => p.id === id);
          if (idx !== -1) {
            layer.points.splice(idx, 1);
            break;
          }
        }
      })
      .addCase(deleteGeoPoint.rejected, (state) => { state.submitting = false; });
  },
});

export const {
  toggleLayerVisibility,
  setAllLayersVisible,
  openEditPoint,
  openCreatePoint,
  closeModal,
} = geoLayersSlice.actions;

export default geoLayersSlice.reducer;
