import { api } from './client';
import type { TagsModule, TagStatusDto, TagStatusEventDto } from '@/types/tags.types';

const base = (module: TagsModule) => `/${module}/tags`;

/** Lista de tags (usuarios area=TAG) con estado de suspensión, para el módulo dado. */
export function getTags(module: TagsModule): Promise<TagStatusDto[]> {
  return api.get<TagStatusDto[]>(base(module));
}

/** Historial completo de eventos de una tag, más reciente primero. */
export function getTagEvents(module: TagsModule, userId: string): Promise<TagStatusEventDto[]> {
  return api.get<TagStatusEventDto[]>(`${base(module)}/${userId}/events`);
}

/** Suspende manualmente una tag. */
export function suspendTag(module: TagsModule, userId: string, reason?: string): Promise<TagStatusDto> {
  return api.post<TagStatusDto>(`${base(module)}/${userId}/suspend`, { reason });
}

/** Reactiva manualmente una tag suspendida. */
export function reactivateTag(module: TagsModule, userId: string, note?: string): Promise<TagStatusDto> {
  return api.post<TagStatusDto>(`${base(module)}/${userId}/reactivate`, { note });
}
