import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC = ['/login', '/register', '/api/auth/login', '/api/auth/register', '/api/departments'];
// Page-level role guard (the API and the database enforce the same rules again).
const GUARDS = { '/admin': ['admin'], '/faculty': ['faculty', 'admin'], '/contribute': ['senior', 'admin'], '/for-you': ['student', 'senior'] };

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p)) return NextResponse.next();
  const token = req.cookies.get('electiq_session')?.value;
  let session = null;
  if (token) {
    try { session = (await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET ?? ''))).payload; } catch {}
  }
  if (!session) {
    if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
    return NextResponse.redirect(new URL('/login', req.url));
  }
  const guard = Object.entries(GUARDS).find(([p]) => pathname === p || pathname.startsWith(p + '/'));
  if (guard && !guard[1].includes(session.role)) return NextResponse.redirect(new URL('/', req.url));
  return NextResponse.next();
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
