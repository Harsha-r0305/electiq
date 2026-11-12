import { handler } from '@/lib/route';
import { int, str } from '@/lib/validate';

// Own enrollments (RLS limits rows to the signed-in student). Seniors also see whether they already reviewed.
export const GET = handler(['student', 'senior'], async ({ session, db }) => db(async (c) => {
  const sql = session.role === 'senior'
    ? `SELECT e.enrollment_id, c.code, c.title, e.term, e.status, e.grade_points,
              (f.feedback_id IS NOT NULL) AS reviewed
         FROM enrollments e JOIN courses c ON c.course_id = e.course_id
         LEFT JOIN feedback f ON f.enrollment_id = e.enrollment_id
        ORDER BY e.term DESC, c.code`
    : `SELECT e.enrollment_id, c.code, c.title, e.term, e.status, e.grade_points, false AS reviewed
         FROM enrollments e JOIN courses c ON c.course_id = e.course_id
        ORDER BY e.term DESC, c.code`;
  return (await c.query(sql)).rows;
}));

export const POST = handler(['student', 'senior'], async ({ body, db }) => {
  const courseId = int(body.course_id, 'Course', { min: 1 });
  const term = str(body.term ?? '2026-ODD', 'Term', { max: 10 });
  await db((c) => c.query('CALL sp_enroll_student($1, $2)', [courseId, term]));
  return { ok: true, message: 'Enrolled successfully.' };
});

export const dynamic = 'force-dynamic';
