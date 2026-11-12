import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.OWNER_DATABASE_URL });

async function check() {
  const c = await pool.connect();
  try {
    const userRes = await c.query("SELECT * FROM users WHERE email = 'student1@electiq.dev'");
    const user = userRes.rows[0];
    console.log('Testing as user:', user.email, 'id:', user.user_id, 'role:', user.role);

    // Test with app_student role
    await c.query("BEGIN");
    await c.query("SET LOCAL ROLE app_student");
    await c.query(`SELECT set_config('app.current_user_id', '${user.user_id}', true)`);

    const tables = [
      'courses', 'departments', 'senior_profiles', 'students',
      'placements', 'job_roles', 'companies', 'feedback', 'projects',
      'publications', 'achievements', 'extra_activities', 'interview_prep',
      'interview_questions', 'exam_questions', 'returned_items', 'academic_correction_requests',
      'course_prerequisites', 'course_skills', 'skills', 'student_course_history'
    ];

    for (const t of tables) {
      await c.query("SAVEPOINT sp");
      try {
        await c.query(`SELECT * FROM ${t} LIMIT 1`);
        console.log(`✓ SELECT ON ${t}: OK`);
        await c.query("RELEASE SAVEPOINT sp");
      } catch (e) {
        console.error(`✗ SELECT ON ${t}: FAILED (${e.code} - ${e.message})`);
        await c.query("ROLLBACK TO SAVEPOINT sp");
      }
    }

    // Now test views
    const views = [
      'v_course_placements', 'v_course_feedback', 'v_seniors_explorer', 'v_course_stats', 'v_exam_questions_bank'
    ];
    for (const v of views) {
      await c.query("SAVEPOINT sp");
      try {
        await c.query(`SELECT * FROM ${v} LIMIT 1`);
        console.log(`✓ SELECT ON view ${v}: OK`);
        await c.query("RELEASE SAVEPOINT sp");
      } catch (e) {
        console.error(`✗ SELECT ON view ${v}: FAILED (${e.code} - ${e.message})`);
        await c.query("ROLLBACK TO SAVEPOINT sp");
      }
    }

    await c.query("ROLLBACK");
  } catch (err) {
    console.error('Fatal check error:', err);
  } finally {
    c.release();
    pool.end();
  }
}
check();
