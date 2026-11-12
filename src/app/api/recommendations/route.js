import { handler } from '@/lib/route';

// Personal recommendations: prerequisite unlocks + CGPA-boost (own profile only)
export const GET = handler(['student', 'senior'], async ({ db }) => db(async (c) => {
  const sid = (await c.query('SELECT fn_current_student_id() AS sid')).rows[0].sid;
  const cg = (await c.query('SELECT * FROM fn_my_cgpa()')).rows[0] ?? { cgpa: null, courses_graded: 0 };
  return {
    cgpa: cg.cgpa, coursesGraded: cg.courses_graded,
    nextElectives: (await c.query('SELECT * FROM fn_next_electives($1)', [sid])).rows,
    cgpaBoost: (await c.query('SELECT * FROM fn_cgpa_boost($1)', [sid])).rows,
  };
}));

export const dynamic = 'force-dynamic';
