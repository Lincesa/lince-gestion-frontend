import { api } from './client';
import type {
  Campaign,
  CampaignLog,
  CampaignPreviewItem,
  CampaignRecipient,
  CampaignWave,
  CreateCampaignPayload,
  DirectMessage,
  YCloudTemplate,
} from '@/types/marketing.types';

export const getTemplates = () =>
  api.get<YCloudTemplate[]>('/marketing/templates');

export const getCampaigns = () =>
  api.get<Campaign[]>('/marketing/campaigns');

export const getCampaign = (id: string) =>
  api.get<Campaign>(`/marketing/campaigns/${id}`);

export const createCampaign = (payload: CreateCampaignPayload) =>
  api.post<Campaign>('/marketing/campaigns', payload);

export const executeCampaign = (id: string) =>
  api.post<Campaign>(`/marketing/campaigns/${id}/execute`, {});

export const getCampaignPreview = (id: string) =>
  api.get<CampaignPreviewItem[]>(`/marketing/campaigns/${id}/preview`);

export const previewByFilter = (filter: { siguiendo?: string[]; estado?: string[]; producto?: string[] }) =>
  api.post<CampaignPreviewItem[]>('/marketing/campaigns/preview', filter);

export const getCampaignRecipients = (id: string) =>
  api.get<CampaignRecipient[]>(`/marketing/campaigns/${id}/recipients`);

export const deleteCampaign = (id: string) =>
  api.delete<void>(`/marketing/campaigns/${id}`);

export interface SendSinglePayload {
  phone: string;
  templateName: string;
  templateLanguage: string;
  advisor: 'EZEQUIEL' | 'DENIS' | 'MARTIN' | 'JULIAN';
  templateHeaderImageUrl?: string;
}

export const sendSingle = (payload: SendSinglePayload) =>
  api.post<{ messageId: string; to: string }>('/marketing/send-single', payload);

export const getDirectMessages = () =>
  api.get<DirectMessage[]>('/marketing/direct-messages');

export const getFilterOptions = () =>
  api.get<{ productos: string[] }>('/marketing/filter-options');

export const configureWaves = (
  campaignId: string,
  waves: { scheduledAt: string; recipientCount: number }[],
) => api.post<Campaign>(`/marketing/campaigns/${campaignId}/waves`, { waves });

export const getCampaignWaves = (campaignId: string) =>
  api.get<CampaignWave[]>(`/marketing/campaigns/${campaignId}/waves`);

export const rescheduleWave = (campaignId: string, waveNumber: number, scheduledAt: string) =>
  api.patch<Campaign>(`/marketing/campaigns/${campaignId}/waves/${waveNumber}/reschedule`, { scheduledAt });

export const reconfigureScheduledWaves = (
  campaignId: string,
  waves: { scheduledAt: string; recipientCount: number }[],
) => api.patch<Campaign>(`/marketing/campaigns/${campaignId}/waves/reconfigure`, { waves });

export const getCampaignLogs = (campaignId: string) =>
  api.get<CampaignLog[]>(`/marketing/campaigns/${campaignId}/logs`);

export const retryRecipient = (campaignId: string, recipientId: string) =>
  api.post<void>(`/marketing/campaigns/${campaignId}/recipients/${recipientId}/retry`, {});

export const updateRecipientPhone = (campaignId: string, recipientId: string, phone: string) =>
  api.patch<void>(`/marketing/campaigns/${campaignId}/recipients/${recipientId}/phone`, { phone });
