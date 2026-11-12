import bcrypt from 'bcryptjs';
import { handler } from '@/lib/route';
import { str, int, oneOf, password, EMAIL_RE } from '@/lib/validate';
import { httpError } from '@/lib/errors';

export const GET = handler(['admin'], async ({ db }) => db(async (c) => (await c.query(
  `SELECT u.user_id, u.email, u.role, u.created_at,
          COALESCE(s.name, f.name, 'Administrator') AS name, s.srn, s.batch_year
     FROM users u LEFT JOIN students s ON s.user_id = u.user_id LEFT JOIN faculty f ON f.user_id = u.user_id
    ORDER BY u.role, u.user_id LIMIT 300`)).rows));

// Faculty and admin accounts exist ONLY because an admin creates them here.
export const POST = handler(['admin'], async ({ body, db }) => {
  const role = oneOf(body.role, 'Role', ['faculty', 'admin']);
  const email = str(body.email, 'Email', { max: 120 }).toLowerCase();
  if (!EMAIL_RE.test(email)) throw httpError(400, 'Enter a valid email address.');
  const hash = await bcrypt.hash(password(body.password), 12);
  const name = str(body.name, 'Name', { min: 2, max: 100 });
  const dept = role === 'faculty' ? int(body.dept_id, 'Department', { min: 1 }) : null;
  return db(async (c) => {
    const uid = (await c.query('INSERT INTO users(email, password_hash, role) VALUES ($1,$2,$3) RETURNING user_id', [email, hash, role])).rows[0].user_id;
    if (role === 'faculty') await c.query('INSERT INTO faculty(user_id, dept_id, name, designation) VALUES ($1,$2,$3,$4)', [uid, dept, name, body.designation || 'Assistant Professor']);
    return { ok: true, user_id: uid };
  });
});

// Promote a verified student to senior (or demote). Only users.role can be updated (column-level grant).
export const PATCH = handler(['admin'], async ({ body, db }) => {
  const uid = int(body.user_id, 'User', { min: 1 });
  const role = oneOf(body.role, 'Role', ['student', 'senior']);
  const n = await db(async (c) => (await c.query("UPDATE users SET role = $2 WHERE user_id = $1 AND role IN ('student','senior')", [uid, role])).rowCount);
  if (!n) throw httpError(404, 'Only student and senior accounts can be changed here.');
  return { ok: true };
});

export const dynamic = 'force-dynamic';
