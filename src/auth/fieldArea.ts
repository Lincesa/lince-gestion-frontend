/** Áreas de usuarios de campo (watcher/app). Backend ModuleGuard ya trata ambas. */
const FIELD_AREAS = new Set(['TAG', 'TRANSPORTE']);

export function isFieldArea(area: string | null | undefined): boolean {
  if (!area) return false;
  return FIELD_AREAS.has(area.toUpperCase());
}
