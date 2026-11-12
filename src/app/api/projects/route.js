import { handler } from '@/lib/route';
import { int, str } from '@/lib/validate';

// Projects and skill tags.
export const GET = handler(null, async ({ query, db }) => {
  const courseId = query.course ? Number(query.course) : null;
  const params = [];
  let where = '';
  if (courseId) {
    params.push(courseId);
    where = 'WHERE p.course_id = $1';
  }
  return db(async (c) => {
    const sql = `
      SELECT p.project_id, p.student_id, p.course_id, c.code, c.title AS course_title, p.title,
             COALESCE(json_agg(json_build_object('skill_id', s.skill_id, 'name', s.name)) FILTER (WHERE s.skill_id IS NOT NULL), '[]'::json) AS skills
        FROM projects p
        JOIN courses c ON c.course_id = p.course_id
        LEFT JOIN project_skills ps ON ps.project_id = p.project_id
        LEFT JOIN skills s ON s.skill_id = ps.skill_id
       ${where}
       GROUP BY p.project_id, p.student_id, p.course_id, c.code, c.title
       ORDER BY p.project_id DESC LIMIT 100
    `;
    return (await c.query(sql, params)).rows;
  });
});

export const POST = handler(['senior'], async ({ body, db }) => {
  const courseId = int(body.course_id, 'Course', { min: 1 });
  const title = str(body.title, 'Project title', { min: 3, max: 150 });
  const skillIds = Array.isArray(body.skill_ids) ? body.skill_ids.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];

  return db(async (c) => {
    const { rows } = await c.query(
      'INSERT INTO projects(student_id, course_id, title) VALUES (fn_current_student_id(), $1, $2) RETURNING project_id',
      [courseId, title]
    );
    const projectId = rows[0].project_id;
    for (const sid of skillIds) {
      await c.query(
        'INSERT INTO project_skills(project_id, skill_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [projectId, sid]
      );
    }
    return { ok: true, project_id: projectId, message: 'Project and skill tags recorded.' };
  });
});

export const dynamic = 'force-dynamic';
