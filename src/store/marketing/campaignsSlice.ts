import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as marketingApi from '@/api/marketing';
import type {
  Campaign,
  CampaignRecipient,
  CreateCampaignPayload,
  DirectMessage,
  MarketingDashboard,
  TemplateAnalyticsPayload,
  YCloudTemplate,
  YCloudTemplateAnalytics,
} from '@/types/marketing.types';

interface MarketingState {
  campaigns: Campaign[];
  currentCampaign: Campaign | null;
  recipients: CampaignRecipient[];
  templates: YCloudTemplate[];
  directMessages: DirectMessage[];
  filterOptions: { productos: string[] };
  dashboard: MarketingDashboard | null;
  templateAnalytics: YCloudTemplateAnalytics | null;
  loadingCampaigns: boolean;
  loadingCurrent: boolean;
  loadingRecipients: boolean;
  loadingTemplates: boolean;
  loadingDirectMessages: boolean;
  loadingFilterOptions: boolean;
  loadingDashboard: boolean;
  loadingAnalytics: boolean;
  submitting: boolean;
  error: string | null;
}

const initialState: MarketingState = {
  campaigns: [],
  currentCampaign: null,
  recipients: [],
  templates: [],
  directMessages: [],
  filterOptions: { productos: [] },
  dashboard: null,
  templateAnalytics: null,
  loadingCampaigns: false,
  loadingCurrent: false,
  loadingRecipients: false,
  loadingTemplates: false,
  loadingDirectMessages: false,
  loadingFilterOptions: false,
  loadingDashboard: false,
  loadingAnalytics: false,
  submitting: false,
  error: null,
};

export const fetchDashboard = createAsyncThunk('marketing/fetchDashboard', () =>
  marketingApi.getDashboard(),
);

export const fetchTemplateAnalytics = createAsyncThunk(
  'marketing/fetchTemplateAnalytics',
  (payload: TemplateAnalyticsPayload) => marketingApi.getTemplateAnalytics(payload),
);

export const fetchTemplates = createAsyncThunk('marketing/fetchTemplates', () =>
  marketingApi.getTemplates(),
);

export const fetchCampaigns = createAsyncThunk('marketing/fetchCampaigns', () =>
  marketingApi.getCampaigns(),
);

export const fetchCampaign = createAsyncThunk('marketing/fetchCampaign', (id: string) =>
  marketingApi.getCampaign(id),
);

export const fetchRecipients = createAsyncThunk('marketing/fetchRecipients', (id: string) =>
  marketingApi.getCampaignRecipients(id),
);

export const createCampaign = createAsyncThunk(
  'marketing/createCampaign',
  (payload: CreateCampaignPayload) => marketingApi.createCampaign(payload),
);

export const executeCampaign = createAsyncThunk('marketing/executeCampaign', (id: string) =>
  marketingApi.executeCampaign(id),
);

export const deleteCampaign = createAsyncThunk('marketing/deleteCampaign', (id: string) =>
  marketingApi.deleteCampaign(id).then(() => id),
);

export const fetchDirectMessages = createAsyncThunk('marketing/fetchDirectMessages', () =>
  marketingApi.getDirectMessages(),
);

export const fetchFilterOptions = createAsyncThunk('marketing/fetchFilterOptions', () =>
  marketingApi.getFilterOptions(),
);

const campaignsSlice = createSlice({
  name: 'marketing',
  initialState,
  reducers: {
    clearCurrentCampaign(state) {
      state.currentCampaign = null;
      state.recipients = [];
    },
    clearTemplateAnalytics(state) {
      state.templateAnalytics = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboard.pending, (state) => {
        state.loadingDashboard = true;
        state.error = null;
      })
      .addCase(fetchDashboard.fulfilled, (state, action) => {
        state.loadingDashboard = false;
        state.dashboard = action.payload;
      })
      .addCase(fetchDashboard.rejected, (state, action) => {
        state.loadingDashboard = false;
        state.error = action.error.message ?? 'Error al cargar dashboard';
      })

      .addCase(fetchTemplateAnalytics.pending, (state) => {
        state.loadingAnalytics = true;
      })
      .addCase(fetchTemplateAnalytics.fulfilled, (state, action) => {
        state.loadingAnalytics = false;
        state.templateAnalytics = action.payload;
      })
      .addCase(fetchTemplateAnalytics.rejected, (state) => {
        state.loadingAnalytics = false;
      })

      // templates
      .addCase(fetchTemplates.pending, (state) => { state.loadingTemplates = true; state.error = null; })
      .addCase(fetchTemplates.fulfilled, (state, action) => {
        state.loadingTemplates = false;
        state.templates = action.payload;
      })
      .addCase(fetchTemplates.rejected, (state, action) => {
        state.loadingTemplates = false;
        state.error = action.error.message ?? 'Error al cargar plantillas';
      })

      // campaigns list
      .addCase(fetchCampaigns.pending, (state) => { state.loadingCampaigns = true; state.error = null; })
      .addCase(fetchCampaigns.fulfilled, (state, action) => {
        state.loadingCampaigns = false;
        state.campaigns = action.payload;
      })
      .addCase(fetchCampaigns.rejected, (state, action) => {
        state.loadingCampaigns = false;
        state.error = action.error.message ?? 'Error al cargar campañas';
      })

      // single campaign
      .addCase(fetchCampaign.pending, (state) => { state.loadingCurrent = true; state.error = null; })
      .addCase(fetchCampaign.fulfilled, (state, action) => {
        state.loadingCurrent = false;
        state.currentCampaign = action.payload;
      })
      .addCase(fetchCampaign.rejected, (state, action) => {
        state.loadingCurrent = false;
        state.error = action.error.message ?? 'Error al cargar campaña';
      })

      // recipients
      .addCase(fetchRecipients.pending, (state) => { state.loadingRecipients = true; })
      .addCase(fetchRecipients.fulfilled, (state, action) => {
        state.loadingRecipients = false;
        state.recipients = action.payload;
      })
      .addCase(fetchRecipients.rejected, (state) => { state.loadingRecipients = false; })

      // create
      .addCase(createCampaign.pending, (state) => { state.submitting = true; state.error = null; })
      .addCase(createCampaign.fulfilled, (state, action) => {
        state.submitting = false;
        state.campaigns.unshift(action.payload);
      })
      .addCase(createCampaign.rejected, (state, action) => {
        state.submitting = false;
        state.error = action.error.message ?? 'Error al crear campaña';
      })

      // execute
      .addCase(executeCampaign.pending, (state) => { state.submitting = true; })
      .addCase(executeCampaign.fulfilled, (state, action) => {
        state.submitting = false;
        state.currentCampaign = action.payload;
        const idx = state.campaigns.findIndex((c) => c.id === action.payload.id);
        if (idx !== -1) state.campaigns[idx] = action.payload;
      })
      .addCase(executeCampaign.rejected, (state) => { state.submitting = false; })

      // delete
      .addCase(deleteCampaign.pending, (state) => { state.submitting = true; })
      .addCase(deleteCampaign.fulfilled, (state, action) => {
        state.submitting = false;
        state.campaigns = state.campaigns.filter((c) => c.id !== action.payload);
      })
      .addCase(deleteCampaign.rejected, (state) => { state.submitting = false; })

      // direct messages
      .addCase(fetchDirectMessages.pending, (state) => { state.loadingDirectMessages = true; })
      .addCase(fetchDirectMessages.fulfilled, (state, action) => {
        state.loadingDirectMessages = false;
        state.directMessages = action.payload;
      })
      .addCase(fetchDirectMessages.rejected, (state) => { state.loadingDirectMessages = false; })

      // filter options
      .addCase(fetchFilterOptions.pending, (state) => { state.loadingFilterOptions = true; })
      .addCase(fetchFilterOptions.fulfilled, (state, action) => {
        state.loadingFilterOptions = false;
        state.filterOptions = action.payload;
      })
      .addCase(fetchFilterOptions.rejected, (state) => { state.loadingFilterOptions = false; });
  },
});

export const { clearCurrentCampaign, clearTemplateAnalytics } = campaignsSlice.actions;
export default campaignsSlice.reducer;
