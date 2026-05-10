import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import {
  ConnectorError,
  FlowAbortedError,
  InvalidCredentialsError,
  ProviderNotFoundError,
  StateValidationError,
  UnsupportedFlowError,
  getConnector,
  handleOAuthCallback,
  OAUTH_FLOW_COOKIE,
} from '@/lib/connectors';

/**
 * OAuth callback handler. The provider redirects the browser back
 * here with `?state=...&code=...&providerId=...`. We validate the
 * cookie state, exchange the code (mocked in step 14), persist the
 * credentials and redirect to /account/connections.
 *
 * On error we redirect to /account/connections/add?error=<code> so
 * the UI can surface a translated message.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const state = url.searchParams.get('state') ?? '';
  const code = url.searchParams.get('code');
  const providerId = url.searchParams.get('providerId') ?? '';
  const error = url.searchParams.get('error');

  const origin = url.origin;
  const successRedirect = `${origin}/account/connections`;
  const failureRedirect = (errCode: string, providerHint?: string) => {
    const target = new URL(`${origin}/account/connections/add`);
    target.searchParams.set('error', errCode);
    if (providerHint) target.searchParams.set('providerId', providerHint);
    return target.toString();
  };

  if (error) {
    return redirectAndClear(failureRedirect('FLOW_ABORTED', providerId));
  }

  const connector = getConnector(providerId);
  if (!connector) {
    const e = new ProviderNotFoundError(providerId);
    return redirectAndClear(failureRedirect(e.code));
  }

  const cookieStore = await cookies();
  const flowStateCookie = cookieStore.get(OAUTH_FLOW_COOKIE)?.value;

  try {
    const result = await handleOAuthCallback({
      state,
      code,
      flowStateCookie,
      connector,
    });
    if (!result.success) {
      return redirectAndClear(failureRedirect('UNKNOWN', providerId));
    }
    return redirectAndClear(successRedirect);
  } catch (err) {
    if (
      err instanceof StateValidationError ||
      err instanceof FlowAbortedError ||
      err instanceof InvalidCredentialsError ||
      err instanceof UnsupportedFlowError ||
      err instanceof ConnectorError
    ) {
      return redirectAndClear(failureRedirect(err.code, providerId));
    }
    return redirectAndClear(failureRedirect('UNKNOWN', providerId));
  }
}

function redirectAndClear(target: string): Response {
  const response = NextResponse.redirect(target, { status: 303 });
  response.cookies.set({
    name: OAUTH_FLOW_COOKIE,
    value: '',
    maxAge: 0,
    path: '/',
  });
  return response;
}
