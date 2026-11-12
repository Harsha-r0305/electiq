import { handler } from '@/lib/route';
import { int, str } from '@/lib/validate';
import { httpError } from '@/lib/errors';

export const GET = handler(['admin'], async ({ query, db }) => {
  const page = Math.max(1, parseInt(query.page || '1', 10));
  const limit = Math.max(1, Math.min(100, parseInt(query.limit || '20', 10)));
  const offset = (page - 1) * limit;
  const params = [];
  const where = [];
  if (query.status) { params.push(query.status); where.push(`e.status = $${params.length}`); }
  if (query.q) { params.push(`%${query.q}%`); where.push(`(s.srn ILIKE $${params.length} OR s.name ILIKE $${params.length} OR c.code ILIKE $${params.length})`); }
  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  return db(async (c) => {
    const total = parseInt((await c.query(
      `SELECT count(*)::int AS count FROM enrollments e JOIN students s ON s.student_id = e.student_id JOIN courses c ON c.course_id = e.course_id ${whereClause}`, params)).rows[0].count, 10);
    const rows = (await c.query(
      `SELECT e.enrollment_id, s.srn, s.name, c.code, c.title, e.term, e.status, e.grade_points
         FROM enrollments e JOIN students s ON s.student_id = e.student_id JOIN courses c ON c.course_id = e.course_id
        ${whereClause}
        ORDER BY (e.grade_points IS NULL) DESC, e.enrollment_id DESC LIMIT ${limit} OFFSET ${offset}`, params)).rows;
    return { rows, total, page, limit, pages: Math.ceil(total / limit) };
  });
});

export const POST = handler(['admin'], async ({ body, db }) => {
  const srn = str(body.srn, 'SRN', { max: 15 }).toUpperCase();
  const course = int(body.course_id, 'Course', { min: 1 });
  const term = str(body.term, 'Term', { max: 10 });
  return db(async (c) => {
    const s = (await c.query('SELECT student_id FROM students WHERE srn = $1', [srn])).rows[0];
    if (!s) throw httpError(404, `No student with SRN ${srn}.`);
    await c.query('INSERT INTO enrollments(student_id, course_id, term) VALUES ($1,$2,$3)', [s.student_id, course, term]);
    return { ok: true };
  });
});

export const DELETE = handler(['admin'], async ({ query, db }) => {
  const id = int(query.id, 'Enrollment', { min: 1 });
  return db(async (c) => { await c.query('DELETE FROM enrollments WHERE enrollment_id = $1', [id]); return { ok: true }; });
});

export const dynamic = 'force-dynamic';
