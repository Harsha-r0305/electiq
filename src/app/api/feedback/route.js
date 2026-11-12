import { handler } from '@/lib/route';
import { int, str } from '@/lib/validate';

// Calls the stored procedure; the gating trigger rejects reviews before the grade is posted.
export const POST = handler(['senior'], async ({ body, db }) => {
  const e = int(body.enrollment_id, 'Enrollment', { min: 1 });
  const d = int(body.difficulty, 'Difficulty', { min: 1, max: 5 });
  const w = int(body.workload, 'Workload', { min: 1, max: 5 });
  const u = int(body.usefulness, 'Usefulness', { min: 1, max: 5 });
  const t = str(body.review_text, 'Review', { max: 1000, optional: true });
  return db(async (c) => { await c.query('CALL sp_submit_feedback($1,$2,$3,$4,$5)', [e, d, w, u, t]); return { ok: true }; });
});

export const dynamic = 'force-dynamic';
