import pg from 'pg';
import { httpError } from './errors';

const g = globalThis;
export const pool = g.__electiqPool ?? (g.__electiqPool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 }));

// Role names come from a fixed whitelist, never from user input.
const ROLE_MAP = { student: 'app_student', senior: 'app_senior', faculty: 'app_faculty', admin: 'app_admin' };

/**
 * Runs fn(client) inside ONE transaction as the caller's PostgreSQL role.
 * Pooled connections are shared, so identity is set with SET LOCAL / set_config(..., true):
 * both revert automatically at COMMIT/ROLLBACK, so nothing leaks to the next request.
 * Row-Level Security policies read app.user_id through fn_current_user_id().
 */
export async function withUser(session, fn) {
  const dbRole = ROLE_MAP[session.role];
  if (!dbRole) throw httpError(403, 'Unknown role.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL ROLE ${dbRole}`);
    await client.query("SELECT set_config('app.user_id', $1, true), set_config('app.role', $2, true)", [String(session.uid), session.role]);
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    throw e;
  } finally {
    client.release();
  }
}

// Pre-login operations (fn_get_login, fn_register_student, departments list). app_login has no other privileges.
export async function asLogin(fn) {
  const client = await pool.connect();
  try { return await fn(client); } finally { client.release(); }
}
