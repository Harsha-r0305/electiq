import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

export const COOKIE = 'electiq_session';
const secret = () => new TextEncoder().encode(process.env.JWT_SECRET ?? '');

export async function signSession(payload) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be set (32+ characters).');
  return new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('8h').sign(secret());
}
export async function verifySession(token) {
  try { return (await jwtVerify(token, secret())).payload; } catch { return null; }
}
export async function getSession() {
  const t = cookies().get(COOKIE)?.value;
  return t ? verifySession(t) : null;
}
export const cookieOptions = {
  httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 8,
  secure: process.env.COOKIE_SECURE === 'true',
};
