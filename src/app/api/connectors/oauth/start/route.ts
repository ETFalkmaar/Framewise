import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  ConnectorError,
  ProviderNotFoundError,
  UnsupportedFlowError,
  getConnector,
  initiateOAuthFlow,
  OAUTH_FLOW_COOKIE,
  FLOW_STATE_TTL_MS,
} from '@/lib/connectors';
import {
  assertCanManageTenant,
  getActiveTenantForUser,
  isUserSuperAdmin,
  requireCurrentUser,
} from '@/lib/auth';

const bodySchema = z.object({
  providerId: z.string().min(1).max(80),
});

export async function POST(request: Request): Promise<NextResponse> {
  let body: { providerId: string };
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

  const url = new URL(request.url);
  const callbackUrl = `${url.origin}/api/connectors/oauth/callback?providerId=${encodeURIComponent(connector.id)}`;

  try {
    const result = await initiateOAuthFlow({
      connector,
      context: { tenantId: tenant.id, userId: user.id },
      callbackUrl,
    });
    const response = NextResponse.json({ authorizeUrl: result.authorizeUrl }, { status: 200 });
    response.cookies.set({
      name: OAUTH_FLOW_COOKIE,
      value: result.flowStateCookie,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: Math.floor(FLOW_STATE_TTL_MS / 1000),
    });
    return response;
  } catch (err) {
    if (err instanceof UnsupportedFlowError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    if (err instanceof ConnectorError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to start OAuth flow' }, { status: 500 });
  }
}
