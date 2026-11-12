import { NextResponse } from 'next/server';
import { getSession } from './auth';
import { withUser } from './db';
import { httpError, mapError } from './errors';

export const json = (data, status = 200) => NextResponse.json(data, { status });

export function checkCsrf(req) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;
  const secFetchSite = req.headers.get('sec-fetch-site');
  if (secFetchSite === 'cross-site') {
    throw httpError(403, 'Cross-site request forgery detected.');
  }
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        throw httpError(403, 'Cross-site request forgery detected.');
      }
    } catch {
      throw httpError(403, 'Invalid Origin header.');
    }
  }
}

/**
 * Wraps a route handler: checks the session and role, parses the JSON body,
 * runs the handler, and converts errors into safe JSON responses.
 *   handler(['admin'], async ({ session, query, body, params, req }) => data)
 * Pass `tx: true` to get a ready-made `db` that runs inside withUser().
 */
export function handler(roles, fn) {
  return async (req, ctx) => {
    try {
      checkCsrf(req);
      const session = await getSession();
      if (!session) throw httpError(401, 'Please sign in.');
      if (roles && !roles.includes(session.role)) throw httpError(403, 'Your role cannot access this resource.');
      const query = Object.fromEntries(new URL(req.url).searchParams);
      let body = {};
      if (!['GET', 'HEAD'].includes(req.method)) body = await req.json().catch(() => ({}));
      const db = (f) => withUser(session, f);
      const out = await fn({ req, session, query, body, params: ctx?.params ?? {}, db });
      return json(out ?? { ok: true });
    } catch (e) {
      const [status, message] = mapError(e);
      return json({ error: message }, status);
    }
  };
}
