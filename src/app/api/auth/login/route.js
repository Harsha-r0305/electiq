import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { asLogin } from '@/lib/db';
import { signSession, COOKIE, cookieOptions } from '@/lib/auth';
import { str } from '@/lib/validate';
import { mapError } from '@/lib/errors';
import { checkCsrf } from '@/lib/route';

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);   // keeps timing similar for unknown emails

export async function POST(req) {
  try {
    checkCsrf(req);
    const body = await req.json().catch(() => ({}));
    const email = str(body.email, 'Email', { max: 120 }).toLowerCase();
    const password = str(body.password, 'Password', { max: 72 });
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';

    const isLocked = await asLogin(async (c) => {
      const { rows } = await c.query('SELECT fn_check_login_lockout($1, $2) AS locked', [ip, email]);
      return rows[0]?.locked;
    });
    if (isLocked) {
      return NextResponse.json({ error: 'Too many failed login attempts. Account temporarily locked for 15 minutes.' }, { status: 429 });
    }

    const { rows } = await asLogin((c) => c.query('SELECT * FROM fn_get_login($1)', [email]));
    const u = rows[0];
    const ok = await bcrypt.compare(password, u ? u.password_hash : DUMMY_HASH);
    if (!u || !ok) {
      await asLogin((c) => c.query('SELECT fn_record_login_attempt($1, $2, false)', [ip, email]));
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    await asLogin((c) => c.query('SELECT fn_record_login_attempt($1, $2, true)', [ip, email]));
    const token = await signSession({ uid: u.user_id, role: u.role, name: u.name });
    const res = NextResponse.json({ ok: true, role: u.role, name: u.name });
    res.cookies.set(COOKIE, token, cookieOptions);
    return res;
  } catch (e) {
    const [status, message] = mapError(e);
    return NextResponse.json({ error: message }, { status });
  }
}

export const dynamic = 'force-dynamic';
