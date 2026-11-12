import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function runTest() {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query('SET LOCAL ROLE app_student');
    await c.query("SELECT set_config('app.user_id', '70', true), set_config('app.role', 'student', true)");

    console.log('Testing step 1: seniorRes');
    const seniorRes = await c.query(`
      SELECT
        sp.student_id,
        sp.senior_code,
        sp.display_name,
        sp.headline,
        sp.specialization,
        sp.advice_for_juniors,
        sp.linkedin_url,
        sp.github_url,
        sp.status,
        sp.consent,
        sp.profile_views,
        d.name AS dept_name,
        s.batch_year,
        ROUND(COALESCE(s_cgpa.cgpa, 8.5)::numeric, 2) AS cgpa
      FROM senior_profiles sp
      JOIN students s ON s.student_id = sp.student_id
      JOIN departments d ON d.dept_id = s.dept_id
      LEFT JOIN LATERAL (
        SELECT ROUND(AVG(e.grade_points)::numeric, 2) AS cgpa
        FROM enrollments e
        WHERE e.student_id = sp.student_id AND e.grade_points IS NOT NULL
      ) s_cgpa ON TRUE
      WHERE sp.senior_code = 'S-056AA0'
    `);
    console.log('Step 1 OK, found:', seniorRes.rows[0]);

    console.log('Testing step 2: fn_increment_senior_views');
    try {
      await c.query(`SELECT fn_increment_senior_views('S-056AA0')`);
      console.log('Step 2 OK');
    } catch (e) {
      console.error('Step 2 fn_increment_senior_views error:', e.code, e.message);
    }

    const sid = seniorRes.rows[0]?.student_id || 1;

    console.log('Testing step 3: electivesRes');
    try {
      const electivesRes = await c.query(`
        SELECT
          c.course_id,
          c.title AS elective_name,
          c.vertical,
          c.level,
          c.credits,
          c.semester,
          c.elective_slot,
          e.term,
          e.grade_points,
          COALESCE(f.difficulty, 3) AS difficulty_rating,
          COALESCE(f.usefulness, 4) AS usefulness_rating,
          COALESCE(f.workload, 3) AS workload_rating,
          f.review_text AS feedback_text,
          f.placement_help,
          f.extra_prep_needed,
          f.recommended_resources,
          f.advice_for_juniors AS elective_advice,
          COALESCE(sk.skills_taught, '[]'::json) AS skills_taught
        FROM enrollments e
        JOIN courses c ON c.course_id = e.course_id
        LEFT JOIN feedback f ON f.enrollment_id = e.enrollment_id
        LEFT JOIN LATERAL (
          SELECT json_agg(s.name ORDER BY cs.depth DESC, s.name) AS skills_taught
          FROM course_skills cs
          JOIN skills s ON s.skill_id = cs.skill_id
          WHERE cs.course_id = c.course_id
        ) sk ON TRUE
        WHERE e.student_id = $1 AND c.is_elective = true
        ORDER BY c.elective_slot ASC, c.semester ASC, c.title ASC
      `, [sid]);
      console.log('Step 3 OK, electives:', electivesRes.rows.length);
    } catch (e) {
      console.error('Step 3 electives error:', e.code, e.message);
    }

    console.log('Testing step 4: extraPrepRes');
    try {
      await c.query(`SELECT * FROM extra_activities WHERE student_id = $1`, [sid]);
      console.log('Step 4 OK');
    } catch (e) {
      console.error('Step 4 error:', e.code, e.message);
    }

    console.log('Testing step 5: placements');
    try {
      await c.query(`
        SELECT p.*, cmp.name, jr.title
        FROM placements p
        JOIN companies cmp ON cmp.company_id = p.company_id
        JOIN job_roles jr ON jr.role_id = p.role_id
        WHERE p.student_id = $1
      `, [sid]);
      console.log('Step 5 OK');
    } catch (e) {
      console.error('Step 5 error:', e.code, e.message);
    }

    console.log('Testing step 6: projects');
    try {
      await c.query(`
        SELECT p.*, c.title, COALESCE(array_agg(s.name) FILTER (WHERE s.name IS NOT NULL), '{}') AS skills
        FROM projects p
        LEFT JOIN courses c ON c.course_id = p.course_id
        LEFT JOIN project_skills ps ON ps.project_id = p.project_id
        LEFT JOIN skills s ON s.skill_id = ps.skill_id
        WHERE p.student_id = $1
        GROUP BY p.project_id, c.title
      `, [sid]);
      console.log('Step 6 OK');
    } catch (e) {
      console.error('Step 6 error:', e.code, e.message);
    }

    console.log('Testing step 7: interview_questions');
    try {
      await c.query(`
        SELECT iq.*, c.title
        FROM interview_questions iq
        JOIN courses c ON c.course_id = iq.course_id
        JOIN placements p ON p.placement_id = iq.placement_id
        WHERE p.student_id = $1
      `, [sid]);
      console.log('Step 7 OK');
    } catch (e) {
      console.error('Step 7 error:', e.code, e.message);
    }

    await c.query('ROLLBACK');
  } catch (err) {
    console.error('Global err:', err.code, err.message);
  } finally {
    c.release();
    pool.end();
  }
}
runTest();
