import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  ConnectorError,
  InvalidCredentialsError,
  MissingFieldError,
  ProviderNotFoundError,
  UnsupportedFlowError,
  getConnector,
  submitApiKeyCredentials,
} from '@/lib/connectors';
import {
  assertCanManageTenant,
  getActiveTenantForUser,
  isUserSuperAdmin,
  requireCurrentUser,
} from '@/lib/auth';

const bodySchema = z.object({
  providerId: z.string().min(1).max(80),
  credentials: z.record(z.string(), z.string()),
});

export async function POST(request: Request): Promise<NextResponse> {
  let body: { providerId: string; credentials: Record<string, string> };
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

  const connector = getConnector(body.providerId);
  if (!connector) {
    const e = new ProviderNotFoundError(body.providerId);
    return NextResponse.json({ error: e.message, code: e.code }, { status: 404 });
  }

  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      null;
    const result = await submitApiKeyCredentials({
      connector,
      credentials: body.credentials,
      context: { tenantId: tenant.id, userId: user.id, ipAddress: ip },
    });
    return NextResponse.json(
      {
        success: true,
        connectionId: result.connectionId,
        metadata: result.metadata ?? null,
      },
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof MissingFieldError) {
      return NextResponse.json(
        { error: err.message, code: err.code, details: err.details },
        { status: 400 }
      );
    }
    if (err instanceof InvalidCredentialsError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 422 });
    }
    if (err instanceof UnsupportedFlowError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    if (err instanceof ConnectorError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to submit credentials' }, { status: 500 });
  }
}
