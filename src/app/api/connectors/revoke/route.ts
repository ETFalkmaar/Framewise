import { NextResponse } from 'next/server';
import { z } from 'zod';

import { connectionsRepo } from '@/lib/data';
import { revokeCredentials } from '@/lib/connectors';
import {
  assertCanManageTenant,
  getActiveTenantForUser,
  isUserSuperAdmin,
  requireCurrentUser,
} from '@/lib/auth';

const bodySchema = z.object({
  connectionId: z.string().min(1).max(80),
});

export async function POST(request: Request): Promise<NextResponse> {
  let body: { connectionId: string };
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const user = await requireCurrentUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const tenant = await getActiveTenantForUser();
  if (!tenant) {
    return NextResponse.json({ error: 'No active tenant' }, { status: 400 });
  }
  if (!isUserSuperAdmin(user.id)) {
    try {
      await assertCanManageTenant(user.id, tenant.id);
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // Tenant scoping: only revoke connections that belong to the current tenant.
  const owned = await connectionsRepo.listByTenant(tenant.id);
  const conn = owned.find((c) => c.id === body.connectionId);
  if (!conn) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
  }

  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      null;
    await revokeCredentials(conn.id, {
      tenantId: tenant.id,
      userId: user.id,
      ipAddress: ip,
    });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Failed to revoke connection' }, { status: 500 });
  }
}
