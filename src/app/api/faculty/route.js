import { handler } from '@/lib/route';
import { int, str } from '@/lib/validate';

// Courses taught by the signed-in faculty member, with their own rating (RLS)
export const GET = handler(['faculty'], async ({ db }) => db(async (c) => (await c.query(
  `SELECT v.course_id, v.code, v.title, v.feedback_count, v.avg_difficulty, v.avg_usefulness, v.placed_students, v.avg_package,
          fr.relevance, fr.future_scope, fr.comment
     FROM v_course_summary v
     LEFT JOIN faculty_reviews fr ON fr.course_id = v.course_id AND fr.faculty_id = fn_current_faculty_id()
    WHERE v.course_id IN (SELECT course_id FROM courses WHERE faculty_id = fn_current_faculty_id())
    ORDER BY v.code`)).rows));

// Insert or update the rating. RLS ensures faculty can only rate their own courses.
export const POST = handler(['faculty'], async ({ body, db }) => {
  const course = int(body.course_id, 'Course', { min: 1 });
  const rel = int(body.relevance, 'Relevance', { min: 1, max: 5 });
  const fut = int(body.future_scope, 'Future scope', { min: 1, max: 5 });
  const comment = str(body.comment, 'Comment', { max: 600, optional: true });
  return db(async (c) => {
    await c.query(
      `INSERT INTO faculty_reviews(faculty_id, course_id, relevance, future_scope, comment)
       VALUES (fn_current_faculty_id(), $1,$2,$3,$4)
       ON CONFLICT (faculty_id, course_id) DO UPDATE SET relevance = EXCLUDED.relevance,
         future_scope = EXCLUDED.future_scope, comment = EXCLUDED.comment`, [course, rel, fut, comment]);
    return { ok: true };
  });
});

export const dynamic = 'force-dynamic';
