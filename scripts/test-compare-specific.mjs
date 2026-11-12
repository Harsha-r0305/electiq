import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function testCompareSpecific() {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query('SET LOCAL ROLE app_student');
    await c.query("SELECT set_config('app.user_id', '70', true), set_config('app.role', 'student', true)");

    const electives = await c.query("SELECT course_id, title FROM courses WHERE title ILIKE '%Deep Learning for Life Sciences%' OR title ILIKE '%Chip level Photonics%' OR title ILIKE '%Block Chain%'");
    console.log('Found courses:', electives.rows);
    const ids = electives.rows.map(r => r.course_id);

    // Now test the exact query from compare/route.js
    const sql = `
      SELECT
        c.course_id,
        c.code,
        c.title,
        c.vertical,
        c.level,
        c.credits,
        c.semester,
        c.elective_slot,
        c.is_elective,
        c.advisor_scope_outlook,
        COALESCE(fb.avg_difficulty, 0) AS avg_difficulty,
        COALESCE(fb.avg_workload, 0) AS avg_workload,
        COALESCE(fb.avg_usefulness, 0) AS avg_usefulness,
        COALESCE(fb.feedback_count, 0) AS feedback_count,
        COALESCE(res.resource_list, '[]'::json) AS resources,
        COALESCE(res.resource_count, 0) AS resource_count,
        COALESCE(sk.skills, '[]'::json) AS skills,
        COALESCE(pr.prerequisites, '[]'::json) AS prerequisites,
        COALESCE(fb_quotes.quotes, '[]'::json) AS senior_feedback,
        COALESCE(prep.recommendations, '[]'::json) AS recommended_preparation,
        COALESCE(proj.project_list, '[]'::json) AS relevant_projects,
        COALESCE(roles.role_list, '[]'::json) AS career_roles,
        COALESCE(sen.seniors_count, 0) AS seniors_taken_count,
        COALESCE(pl.placed_count, 0) AS placed_students,
        pl.avg_package
      FROM courses c
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) AS feedback_count,
          ROUND(AVG(f.difficulty)::numeric, 1) AS avg_difficulty,
          ROUND(AVG(f.workload)::numeric, 1) AS avg_workload,
          ROUND(AVG(f.usefulness)::numeric, 1) AS avg_usefulness
        FROM feedback f
        JOIN enrollments e ON e.enrollment_id = f.enrollment_id
        WHERE e.course_id = c.course_id
      ) fb ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) AS resource_count,
          json_agg(json_build_object('title', r.title, 'type', r.type, 'url', r.url)) AS resource_list
        FROM resources r
        WHERE r.course_id = c.course_id
      ) res ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          json_agg(json_build_object('name', s.name, 'depth', cs.depth) ORDER BY cs.depth DESC, s.name) AS skills
        FROM course_skills cs
        JOIN skills s ON s.skill_id = cs.skill_id
        WHERE cs.course_id = c.course_id
      ) sk ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          json_agg(p.title ORDER BY p.title) AS prerequisites
        FROM course_prerequisites cp
        JOIN courses p ON p.course_id = cp.prereq_id
        WHERE cp.course_id = c.course_id
      ) pr ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          json_agg(json_build_object(
            'text', f.review_text,
            'difficulty', f.difficulty,
            'usefulness', f.usefulness,
            'placement_help', f.placement_help,
            'advice', f.advice_for_juniors
          )) AS quotes
        FROM (
          SELECT f.review_text, f.difficulty, f.usefulness, f.placement_help, f.advice_for_juniors
          FROM feedback f
          JOIN enrollments e ON e.enrollment_id = f.enrollment_id
          WHERE e.course_id = c.course_id AND (f.review_text IS NOT NULL OR f.advice_for_juniors IS NOT NULL)
          LIMIT 5
        ) f
      ) fb_quotes ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          json_agg(DISTINCT f.recommended_resources) AS recommendations
        FROM feedback f
        JOIN enrollments e ON e.enrollment_id = f.enrollment_id
        WHERE e.course_id = c.course_id AND f.recommended_resources IS NOT NULL AND f.recommended_resources <> ''
      ) prep ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          json_agg(json_build_object(
            'title', p.title,
            'problem_statement', p.problem_statement,
            'tech_stack', p.tech_stack
          )) AS project_list
        FROM (
          SELECT p.title, p.problem_statement, p.tech_stack
          FROM projects p
          WHERE p.course_id = c.course_id
          LIMIT 4
        ) p
      ) proj ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          json_agg(DISTINCT jr.title ORDER BY jr.title) AS role_list
        FROM role_elective_paths rc
        JOIN job_roles jr ON jr.role_id = rc.role_id
        WHERE rc.course_id = c.course_id
      ) roles ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          COUNT(DISTINCT sp.student_id) AS seniors_count
        FROM senior_profiles sp
        JOIN enrollments e ON e.student_id = sp.student_id
        WHERE e.course_id = c.course_id AND e.status = 'completed'
      ) sen ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          COUNT(DISTINCT p.placement_id) AS placed_count,
          ROUND(AVG(p.package_lpa)::numeric, 1) AS avg_package
        FROM placements p
        JOIN enrollments e ON e.student_id = p.student_id
        WHERE e.course_id = c.course_id AND p.type = 'full_time'
      ) pl ON TRUE
      WHERE c.course_id = ANY($1::int[])
        AND c.is_elective = true
      ORDER BY c.title
    `;
    const res = await c.query(sql, [ids]);
    console.log('Query success! Returned', res.rows.length, 'rows');

    await c.query('ROLLBACK');
  } catch (err) {
    console.error('testCompareSpecific failed:', err.code, err.message);
  } finally {
    c.release();
    pool.end();
  }
}
testCompareSpecific();

