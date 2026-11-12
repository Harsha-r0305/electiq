import { handler } from '@/lib/route';
import { int, num } from '@/lib/validate';

// Stored procedure: row lock (SELECT ... FOR UPDATE), validation, grade + completion in one step
export const POST = handler(['admin'], async ({ body, db }) => {
  const id = int(body.enrollment_id, 'Enrollment', { min: 1 });
  const grade = num(body.grade, 'Grade', { min: 0, max: 10 });
  return db(async (c) => { await c.query('CALL sp_post_grade($1,$2)', [id, grade]); return { ok: true }; });
});

export const dynamic = 'force-dynamic';
