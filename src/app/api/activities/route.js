import { handler } from '@/lib/route';
import { int, num, str } from '@/lib/validate';

export const POST = handler(['senior'], async ({ body, db }) => {
  const course = int(body.course_id, 'Course', { min: 1 });
  const type = str(body.type, 'Type', { max: 20 });
  const platform = str(body.platform, 'Platform', { max: 40 });
  const hours = num(body.hours, 'Hours', { min: 0, max: 2000 });
  return db(async (c) => {
    await c.query('INSERT INTO extra_activities(student_id, course_id, type, platform, hours_spent) VALUES (fn_current_student_id(), $1,$2,$3,$4)', [course, type, platform, hours]);
    return { ok: true };
  });
});

export const dynamic = 'force-dynamic';
