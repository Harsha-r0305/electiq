import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function testSeniorsQuery() {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query('SET LOCAL ROLE app_student');
    await c.query("SELECT set_config('app.user_id', '70', true), set_config('app.role', 'student', true)");

    // Filters: above_50, has_publications=true, won_hackathon=true
    const conditions = ["sp.status = 'published'", "sp.consent = true"];
    const params = [];
    let idx = 1;

    conditions.push(`pl.package_lpa >= $${idx++}`);
    params.push(50.0);

    conditions.push(`(SELECT COUNT(*) FROM publications pub WHERE pub.student_id = sp.student_id) > 0`);
    conditions.push(`(SELECT COUNT(*) FROM achievements ach WHERE ach.student_id = sp.student_id AND ach.role_status = 'won') > 0`);

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const seniorsSql = `
      SELECT
        sp.student_id,
        sp.senior_code,
        sp.display_name,
        sp.headline,
        sp.specialization,
        sp.advice_for_juniors,
        d.name AS dept_name,
        s.batch_year,
        ROUND(COALESCE(s_cgpa.cgpa, 8.5)::numeric, 2) AS cgpa,
        pl.package_lpa AS highest_package_lpa,
        cmp.name AS company_name,
        cmp.tier AS company_tier,
        jr.title AS role_title,
        pl.location AS job_location,
        pl.ppo_received,
        COALESCE(el.elective_list, '[]'::json) AS elective_list,
        COALESCE(counts.internships, 0) AS internship_count,
        COALESCE(counts.projects, 0) AS project_count,
        COALESCE(counts.papers, 0) AS paper_count,
        COALESCE(counts.hackathons, 0) AS hackathon_wins
      FROM senior_profiles sp
      JOIN students s ON s.student_id = sp.student_id
      JOIN departments d ON d.dept_id = s.dept_id
      LEFT JOIN LATERAL (
        SELECT ROUND(AVG(e.grade_points)::numeric, 2) AS cgpa
        FROM enrollments e
        WHERE e.student_id = sp.student_id AND e.grade_points IS NOT NULL
      ) s_cgpa ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          p.package_lpa,
          p.company_id,
          p.role_id,
          p.location,
          p.ppo_received
        FROM placements p
        WHERE p.student_id = sp.student_id AND p.type = 'full_time'
        ORDER BY p.package_lpa DESC NULLS LAST
        LIMIT 1
      ) pl ON TRUE
      LEFT JOIN companies cmp ON cmp.company_id = pl.company_id
      LEFT JOIN job_roles jr ON jr.role_id = pl.role_id
      LEFT JOIN LATERAL (
        SELECT
          json_agg(json_build_object('course_id', c.course_id, 'title', c.title, 'vertical', c.vertical) ORDER BY c.title) AS elective_list
        FROM enrollments e
        JOIN courses c ON c.course_id = e.course_id
        WHERE e.student_id = sp.student_id AND c.is_elective = true
      ) el ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          (SELECT COUNT(*) FROM placements WHERE student_id = sp.student_id AND type = 'internship') AS internships,
          (SELECT COUNT(*) FROM projects WHERE student_id = sp.student_id) AS projects,
          (SELECT COUNT(*) FROM publications WHERE student_id = sp.student_id) AS papers,
          (SELECT COUNT(*) FROM achievements WHERE student_id = sp.student_id AND role_status = 'won') AS hackathons
      ) counts ON TRUE
      ${whereClause}
      ORDER BY pl.package_lpa DESC NULLS LAST
    `;

    console.log('Running seniorsSql...');
    const res = await c.query(seniorsSql, params);
    console.log('Result count:', res.rows.length);

    await c.query('ROLLBACK');
  } catch (err) {
    console.error('Error running seniorsSql:', err.code, err.message, err);
  } finally {
    c.release();
    pool.end();
  }
}
testSeniorsQuery();

