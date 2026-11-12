import { handler } from '@/lib/route';
import { int } from '@/lib/validate';

// Moderation: admins can read and remove reviews
export const GET = handler(['admin'], async ({ query, db }) => {
  const page = Math.max(1, parseInt(query.page || '1', 10));
  const limit = Math.max(1, Math.min(100, parseInt(query.limit || '15', 10)));
  const offset = (page - 1) * limit;
  return db(async (c) => {
    const total = parseInt((await c.query(`SELECT count(*)::int AS count FROM feedback`)).rows[0].count, 10);
    const rows = (await c.query(
      `SELECT f.feedback_id, c.code, f.difficulty, f.workload, f.usefulness, f.review_text, f.created_at
         FROM feedback f JOIN enrollments e ON e.enrollment_id = f.enrollment_id JOIN courses c ON c.course_id = e.course_id
        ORDER BY f.feedback_id DESC LIMIT ${limit} OFFSET ${offset}`)).rows;
    return { rows, total, page, limit, pages: Math.ceil(total / limit) };
  });
});

export const DELETE = handler(['admin'], async ({ query, db }) => {
  const id = int(query.id, 'Feedback', { min: 1 });
  return db(async (c) => { await c.query('DELETE FROM feedback WHERE feedback_id = $1', [id]); return { ok: true }; });
});

export const dynamic = 'force-dynamic';
