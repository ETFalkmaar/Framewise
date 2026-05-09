import { NextResponse } from 'next/server';
import { z } from 'zod';
import { startSession, toPublicUser, verifyCredentials } from '@/lib/auth';
import { rateLimit } from '@/lib/auth/rate-limit';

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

export async function POST(request: Request): Promise<NextResponse> {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';
  const limit = rateLimit({
    key: `login:${ip}`,
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.' },
      { status: 429, headers: { 'retry-after': String(limit.retryAfterSeconds) } }
    );
  }

  let body: { email: string; password: string };
  try {
    const json: unknown = await request.json();
    body = bodySchema.parse(json);
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const user = await verifyCredentials(body.email, body.password);
  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  await startSession(user.id);
  return NextResponse.json({ user: toPublicUser(user) }, { status: 200 });
}
