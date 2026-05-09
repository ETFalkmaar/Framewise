import { NextResponse } from 'next/server';
import { getCurrentUserWithTenants, toPublicUser } from '@/lib/auth';

export async function GET(): Promise<NextResponse> {
  const ctx = await getCurrentUserWithTenants();
  if (!ctx) {
    return NextResponse.json({ user: null, tenants: [] }, { status: 401 });
  }
  return NextResponse.json({ user: toPublicUser(ctx.user), tenants: ctx.tenants }, { status: 200 });
}
