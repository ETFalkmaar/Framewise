import { NextResponse } from 'next/server';
import { endSession } from '@/lib/auth';

export async function POST(): Promise<NextResponse> {
  await endSession();
  return NextResponse.json({ ok: true }, { status: 200 });
}
