import { handler } from '@/lib/route';

export const GET = handler(null, async ({ session, db }) => {
  return await db(async (c) => {
    let extra = {};
    if (session.role === 'student' || session.role === 'senior') {
      const { rows } = await c.query(`
        SELECT s.student_id, s.srn, s.name, s.batch_year, d.dept_id, d.name AS dept_name,
               sp.senior_code, sp.headline, sp.status AS profile_status, sp.consent
        FROM students s
        JOIN departments d ON d.dept_id = s.dept_id
        LEFT JOIN senior_profiles sp ON sp.student_id = s.student_id
        WHERE s.user_id = $1
      `, [session.uid]);
      if (rows[0]) extra = rows[0];
    } else if (session.role === 'faculty') {
      const { rows } = await c.query(`
        SELECT f.faculty_id, f.name, f.designation, d.dept_id, d.name AS dept_name
        FROM faculty f
        JOIN departments d ON d.dept_id = f.dept_id
        WHERE f.user_id = $1
      `, [session.uid]);
      if (rows[0]) extra = rows[0];
    }

    return {
      uid: session.uid,
      role: session.role,
      name: session.name,
      ...extra
    };
  });
});

export const dynamic = 'force-dynamic';
