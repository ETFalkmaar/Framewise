'use client';

import { useEffect } from 'react';

import { recordTenantVisitAction } from '@/app/(i18n)/[locale]/(auth-required)/admin/actions';

export interface TenantVisitRecorderProps {
  tenantId: string;
}

/**
 * Fire-and-forget client island that pings the server action to
 * record a tenant visit in the LRU cookie (step 38). Rendered on
 * the per-tenant dashboard so the switcher's "Recent bezocht"
 * section reflects what the super-admin has actually viewed.
 */
export function TenantVisitRecorder({ tenantId }: TenantVisitRecorderProps) {
  useEffect(() => {
    void recordTenantVisitAction(tenantId);
  }, [tenantId]);
  return null;
}
