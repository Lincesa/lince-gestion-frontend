import { GlobalRole } from '@/types/auth.types';

export interface ComplianceAbilities {
  /** Office (non-field) users see the cross-transport dashboard. */
  isOffice: boolean;
  /** Logística EDITOR or above, or global ADMIN/SUPERADMIN; never field profiles. */
  canApprove: boolean;
  /** Logística ADMIN, or global ADMIN/SUPERADMIN; never field profiles. */
  canConfigureTypes: boolean;
}

/**
 * Mirrors the backend LogisticsAccess rules. `canEdit`/`canAdmin` come from useCanPerform(LOGISTICA),
 * which already grants SUPERADMIN everything; global ADMIN is added here as the backend does.
 */
export function complianceAbilities(input: {
  isField: boolean;
  globalRole: GlobalRole | undefined;
  canEdit: boolean;
  canAdmin: boolean;
}): ComplianceAbilities {
  if (input.isField) return { isOffice: false, canApprove: false, canConfigureTypes: false };
  const globalAdmin = input.globalRole === GlobalRole.ADMIN || input.globalRole === GlobalRole.SUPERADMIN;
  return {
    isOffice: true,
    canApprove: globalAdmin || input.canEdit,
    canConfigureTypes: globalAdmin || input.canAdmin,
  };
}
