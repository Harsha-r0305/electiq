import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { asLogin } from '@/lib/db';
import { str, int, password, EMAIL_RE } from '@/lib/validate';
import { httpError, mapError } from '@/lib/errors';
import { rateLimit } from '@/lib/ratelimit';
import { checkCsrf } from '@/lib/route';

// Self-registration ALWAYS creates a student. Any "role" in the body is ignored,
// and fn_register_student() has no role parameter at all.
export async function POST(req) {
  try {
    checkCsrf(req);
    const b = await req.json().catch(() => ({}));
    const ip = req.headers.get('x-forwarded-for') ?? 'local';
    if (!rateLimit(`register:${ip}`, 5, 60_000)) throw httpError(429, 'Too many attempts. Wait a minute.');
    const email = str(b.email, 'Email', { max: 120 }).toLowerCase();
    if (!EMAIL_RE.test(email)) throw httpError(400, 'Enter a valid email address.');
    const pw = password(b.password);
    const name = str(b.name, 'Name', { min: 2, max: 100 });
    const srn = str(b.srn, 'SRN', { min: 4, max: 15 });
    const dept = int(b.dept_id, 'Department', { min: 1 });
    const batch = int(b.batch_year, 'Batch year', { min: 2000, max: 2100 });
    const hash = await bcrypt.hash(pw, 12);
    await asLogin((c) => c.query('SELECT fn_register_student($1,$2,$3,$4,$5,$6)', [email, hash, srn, name, dept, batch]));
    return NextResponse.json({ ok: true });
  } catch (e) {
    const [status, message] = mapError(e);
    return NextResponse.json({ error: message }, { status });
  }
}

export const dynamic = 'force-dynamic';
