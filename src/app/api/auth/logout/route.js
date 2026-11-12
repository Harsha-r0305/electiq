import { NextResponse } from 'next/server';
import { COOKIE } from '@/lib/auth';
import { checkCsrf } from '@/lib/route';
import { mapError } from '@/lib/errors';

export async function POST(req) {
  try {
    checkCsrf(req);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
    return res;
  } catch (e) {
    const [status, message] = mapError(e);
    return NextResponse.json({ error: message }, { status });
  }
}

export const dynamic = 'force-dynamic';
