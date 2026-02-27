'use client'

import { useMemo } from 'react'
import { useAuth } from './useAuth'
import { useUIStore } from '@/store/uiStore'

/**
 * Returns the effective organization ID for data queries.
 *
 * - super_admin: uses selectedOrgId from UI store (if set), otherwise null (sees all)
 * - Other roles: always uses their own orgId from auth
 */
export function useOrgContext() {
  const { orgId, isSuperAdmin, organizacion } = useAuth()
  const selectedOrgId = useUIStore((s) => s.selectedOrgId)

  return useMemo(() => {
    // For super_admin: use selected org if set, otherwise null (global view)
    const effectiveOrgId = isSuperAdmin ? selectedOrgId : orgId

    return {
      /** The org_id to filter queries by. null means "show all" (super_admin global view). */
      effectiveOrgId,
      /** Whether we're filtering by a specific org */
      isOrgFiltered: effectiveOrgId !== null,
      /** Whether this is a super_admin viewing in global mode */
      isGlobalView: isSuperAdmin && selectedOrgId === null,
      /** The user's own org (from auth, not the selected one) */
      ownOrgId: orgId,
      /** The user's own org info */
      ownOrganizacion: organizacion,
    }
  }, [orgId, isSuperAdmin, selectedOrgId, organizacion])
}
