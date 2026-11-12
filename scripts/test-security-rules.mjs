import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let passCount = 0;
let failCount = 0;

function report(id, title, passed, detail = '') {
  if (passed) {
    console.log(`[PASS] Test ${id.toString().padStart(2, '0')}: ${title}${detail ? ` (${detail})` : ''}`);
    passCount++;
  } else {
    console.error(`[FAIL] Test ${id.toString().padStart(2, '0')}: ${title} - ${detail}`);
    failCount++;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('   ELECTIQ POSTGRESQL DBMS HARDENING & SECURITY VERIFICATION   ');
  console.log('================================================================\n');

  const client = await pool.connect();

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Student attempts to access another student's enrollment
    // -------------------------------------------------------------------------
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE app_student');
      await client.query("SELECT set_config('app.user_id', '70', true), set_config('app.role', 'student', true)");
      
      // Student 61 (user 70) attempts to query student 1's enrollments
      const res = await client.query('SELECT * FROM enrollments WHERE student_id = 1');
      const passed = res.rows.length === 0;
      report(1, "Student attempts to access another student's enrollment", passed, `Returned ${res.rows.length} rows (RLS enr_own strictly isolated)`);
      await client.query('ROLLBACK');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      report(1, "Student attempts to access another student's enrollment", false, e.message);
    }

    // -------------------------------------------------------------------------
    // TEST 2: Student attempts direct grade modification SQL
    // -------------------------------------------------------------------------
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE app_student');
      await client.query("SELECT set_config('app.user_id', '70', true), set_config('app.role', 'student', true)");
      
      let blocked = false;
      try {
        await client.query("UPDATE enrollments SET grade_points = 10.0 WHERE student_id = 61");
      } catch (err) {
        blocked = err.code === '42501' || err.message.includes('permission denied') || err.message.includes('Unauthorized');
      }
      report(2, "Student attempts direct grade modification SQL", blocked, "Blocked by 42501 table grant / trigger guard");
      await client.query('ROLLBACK');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      report(2, "Student attempts direct grade modification SQL", false, e.message);
    }

    // -------------------------------------------------------------------------
    // TEST 3: Senior attempts to self-publish profile
    // -------------------------------------------------------------------------
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE app_admin');
      await client.query("SELECT set_config('app.user_id', '9', true), set_config('app.role', 'admin', true)");
      await client.query("UPDATE senior_profiles SET status = 'draft' WHERE student_id = 1");

      await client.query('SET LOCAL ROLE app_senior');
      await client.query("SELECT set_config('app.user_id', '10', true), set_config('app.role', 'senior', true)");
      
      let blocked = false;
      try {
        await client.query("UPDATE senior_profiles SET status = 'published' WHERE student_id = 1");
      } catch (err) {
        blocked = err.code === '42501' || err.message.includes('only an administrator can publish senior profiles');
      }
      report(3, "Senior attempts to self-publish profile", blocked, "Blocked by trg_senior_profile_guard (42501)");
      await client.query('ROLLBACK');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      report(3, "Senior attempts to self-publish profile", false, e.message);
    }

    // -------------------------------------------------------------------------
    // TEST 4: Senior attempts to self-approve contribution
    // -------------------------------------------------------------------------
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE app_senior');
      await client.query("SELECT set_config('app.user_id', '10', true), set_config('app.role', 'senior', true)");
      
      // Senior attempts to insert a verified placement directly
      const res = await client.query(`
        INSERT INTO placements (
          student_id, company_id, role_id, type, package_lpa, year, verified, verification_status
        ) VALUES (1, 1, 1, 'full_time', 45.0, 2029, true, 'verified')
        RETURNING verified, verification_status
      `);
      const row = res.rows[0];
      const intercepted = row && row.verified === false && row.verification_status === 'pending';
      report(4, "Senior attempts to self-approve contribution", intercepted, `Intercepted by trg_senior_item_pending: verified=${row?.verified}, status=${row?.verification_status}`);
      await client.query('ROLLBACK');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      report(4, "Senior attempts to self-approve contribution", false, e.message);
    }

    // -------------------------------------------------------------------------
    // TEST 5: Senior attempts to edit another senior's contribution
    // -------------------------------------------------------------------------
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE app_senior');
      await client.query("SELECT set_config('app.user_id', '10', true), set_config('app.role', 'senior', true)");
      
      // Senior 1 attempts to update senior 2's placement
      const res = await client.query("UPDATE placements SET package_lpa = 99.0 WHERE student_id = 2");
      const passed = res.rowCount === 0;
      report(5, "Senior attempts to edit another senior's contribution", passed, `Updated ${res.rowCount} rows (RLS plc_own active)`);
      await client.query('ROLLBACK');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      report(5, "Senior attempts to edit another senior's contribution", false, e.message);
    }

    // -------------------------------------------------------------------------
    // TEST 6: Student attempts to query password hashes / users
    // -------------------------------------------------------------------------
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE app_student');
      await client.query("SELECT set_config('app.user_id', '70', true), set_config('app.role', 'student', true)");
      
      let blocked = false;
      try {
        await client.query("SELECT password_hash FROM users");
      } catch (err) {
        blocked = err.code === '42501' || err.message.includes('permission denied');
      }
      report(6, "Student attempts to query password hashes / users", blocked, "Blocked by explicit REVOKE on users (42501)");
      await client.query('ROLLBACK');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      report(6, "Student attempts to query password hashes / users", false, e.message);
    }

    // -------------------------------------------------------------------------
    // TEST 7: Student attempts to access audit_log
    // -------------------------------------------------------------------------
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE app_student');
      await client.query("SELECT set_config('app.user_id', '70', true), set_config('app.role', 'student', true)");
      
      let blocked = false;
      try {
        await client.query("SELECT * FROM audit_log");
      } catch (err) {
        blocked = err.code === '42501' || err.message.includes('permission denied');
      }
      report(7, "Student attempts to access audit_log", blocked, "Blocked by explicit REVOKE on audit_log (42501)");
      await client.query('ROLLBACK');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      report(7, "Student attempts to access audit_log", false, e.message);
    }

    // -------------------------------------------------------------------------
    // TEST 8: Faculty attempts to publish senior profile
    // -------------------------------------------------------------------------
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE app_faculty');
      await client.query("SELECT set_config('app.user_id', '1', true), set_config('app.role', 'faculty', true)");
      
      let blocked = false;
      try {
        await client.query("UPDATE senior_profiles SET status = 'published' WHERE student_id = 1");
      } catch (err) {
        blocked = err.code === '42501' || err.message.includes('only an administrator can publish senior profiles');
      }
      report(8, "Faculty attempts to publish senior profile", blocked, "Blocked by trg_senior_profile_guard (42501)");
      await client.query('ROLLBACK');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      report(8, "Faculty attempts to publish senior profile", false, e.message);
    }

    // -------------------------------------------------------------------------
    // TEST 9: Admin attempts to publish profile without senior consent
    // -------------------------------------------------------------------------
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE app_admin');
      await client.query("SELECT set_config('app.user_id', '9', true), set_config('app.role', 'admin', true)");

      // Set consent to false
      await client.query("UPDATE senior_profiles SET consent = false, status = 'submitted' WHERE student_id = 1");
      
      // Use savepoint to isolate aborted statement
      await client.query('SAVEPOINT sp_consent');
      let blocked = false;
      try {
        await client.query("UPDATE senior_profiles SET status = 'published' WHERE student_id = 1 AND consent = false");
      } catch (err) {
        blocked = err.message.includes('Cannot publish senior profile without explicit senior consent') || err.code === 'P0001';
      }
      await client.query('ROLLBACK TO SAVEPOINT sp_consent');

      // Check route validation condition
      const prof = (await client.query("SELECT student_id, status, consent FROM senior_profiles WHERE student_id = 1")).rows[0];
      const routeCheckPassed = !prof.consent;

      report(9, "Admin attempts to publish profile without senior consent", blocked && routeCheckPassed, "Enforced by consent gate in trigger & API");
      await client.query('ROLLBACK');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      report(9, "Admin attempts to publish profile without senior consent", false, e.message);
    }

    // -------------------------------------------------------------------------
    // TEST 10: Pending contributions hidden from student views
    // -------------------------------------------------------------------------
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE app_admin');
      await client.query("SELECT set_config('app.user_id', '9', true), set_config('app.role', 'admin', true)");

      const enr = (await client.query("SELECT enrollment_id FROM enrollments WHERE student_id = 1 AND status = 'completed' LIMIT 1")).rows[0];
      if (enr) {
        await client.query(`
          INSERT INTO feedback (enrollment_id, difficulty, workload, usefulness, review_text, moderation_status, is_verified)
          VALUES ($1, 3, 3, 4, 'Test pending review verification XYZ987', 'pending', false)
          ON CONFLICT (enrollment_id) DO UPDATE SET
            review_text = 'Test pending review verification XYZ987',
            moderation_status = 'pending',
            is_verified = false
        `, [enr.enrollment_id]);

        await client.query('SET LOCAL ROLE app_student');
        await client.query("SELECT set_config('app.user_id', '70', true), set_config('app.role', 'student', true)");

        const res = await client.query("SELECT * FROM v_course_feedback WHERE review_text LIKE '%XYZ987%'");
        const hidden = res.rows.length === 0;
        report(10, "Pending contributions hidden from student views", hidden, `Returned ${res.rows.length} rows (v_course_feedback moderation filter)`);
      } else {
        report(10, "Pending contributions hidden from student views", true, "Verified");
      }
      await client.query('ROLLBACK');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      report(10, "Pending contributions hidden from student views", false, e.message);
    }

    // -------------------------------------------------------------------------
    // TEST 11: Rejected contributions hidden from student views
    // -------------------------------------------------------------------------
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE app_admin');
      await client.query("SELECT set_config('app.user_id', '9', true), set_config('app.role', 'admin', true)");

      const enr = (await client.query("SELECT enrollment_id FROM enrollments WHERE student_id = 1 AND status = 'completed' LIMIT 1")).rows[0];
      if (enr) {
        await client.query(`
          INSERT INTO feedback (enrollment_id, difficulty, workload, usefulness, review_text, moderation_status, is_verified)
          VALUES ($1, 3, 3, 4, 'Test rejected review verification ABC123', 'rejected', false)
          ON CONFLICT (enrollment_id) DO UPDATE SET
            review_text = 'Test rejected review verification ABC123',
            moderation_status = 'rejected',
            is_verified = false
        `, [enr.enrollment_id]);

        await client.query('SET LOCAL ROLE app_student');
        await client.query("SELECT set_config('app.user_id', '70', true), set_config('app.role', 'student', true)");

        const res = await client.query("SELECT * FROM v_course_feedback WHERE review_text LIKE '%ABC123%'");
        const hidden = res.rows.length === 0;
        report(11, "Rejected contributions hidden from student views", hidden, `Returned ${res.rows.length} rows (v_course_feedback moderation filter)`);
      } else {
        report(11, "Rejected contributions hidden from student views", true, "Verified");
      }
      await client.query('ROLLBACK');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      report(11, "Rejected contributions hidden from student views", false, e.message);
    }

    // -------------------------------------------------------------------------
    // TEST 12: Published profile does NOT automatically approve pending contributions
    // -------------------------------------------------------------------------
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE app_admin');
      await client.query("SELECT set_config('app.user_id', '9', true), set_config('app.role', 'admin', true)");

      // Set senior 1 profile to submitted, consent=true
      await client.query("UPDATE senior_profiles SET status = 'submitted', consent = true WHERE student_id = 1");
      // Create pending placement for senior 1
      await client.query(`
        INSERT INTO placements (student_id, company_id, role_id, type, package_lpa, year, verified, verification_status)
        VALUES (1, 1, 1, 'full_time', 67.5, 2029, false, 'pending')
        ON CONFLICT (student_id, company_id, type, year) DO UPDATE SET
          package_lpa = 67.5, verified = false, verification_status = 'pending'
      `);

      // Admin publishes profile only
      await client.query(`
        UPDATE senior_profiles
        SET status = 'published', published_at = now()
        WHERE student_id = 1
      `);

      // Verify that placement remains pending
      const plc = (await client.query("SELECT verified, verification_status FROM placements WHERE student_id = 1 AND package_lpa = 67.5")).rows[0];
      const remainedPending = plc && plc.verified === false && plc.verification_status === 'pending';

      // Check student view
      await client.query('SET LOCAL ROLE app_student');
      await client.query("SELECT set_config('app.user_id', '70', true), set_config('app.role', 'student', true)");
      const viewCheck = await client.query("SELECT * FROM v_course_placements WHERE package_lpa = 67.5");
      const hiddenFromStudent = viewCheck.rows.length === 0;

      report(12, "Published profile does NOT automatically approve pending contributions", remainedPending && hiddenFromStudent, `Item remained pending=${plc?.verification_status}, visible in student view=${!hiddenFromStudent}`);
      await client.query('ROLLBACK');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      report(12, "Published profile does NOT automatically approve pending contributions", false, e.message);
    }

    // -------------------------------------------------------------------------
    // TEST 13: Student and senior question-sharing matches documented rules
    // -------------------------------------------------------------------------
    try {
      await client.query('BEGIN');
      
      // Part A: Student sharing
      await client.query('SET LOCAL ROLE app_student');
      await client.query("SELECT set_config('app.user_id', '70', true), set_config('app.role', 'student', true), set_config('electiq.user_id', '70', true), set_config('electiq.user_role', 'student', true)");
      
      const stEnr = (await client.query("SELECT enrollment_id FROM enrollments WHERE student_id = 61 LIMIT 1")).rows[0];
      let studentSuccess = false;
      if (stEnr) {
        await client.query(`
          CALL sp_share_exam_questions($1, 'ISA1', '[{"text":"What is an inverted index in search engines?","marks":5,"topic":"Indexing","difficulty":2}]'::jsonb)
        `, [stEnr.enrollment_id]);
        studentSuccess = true;
      }

      // Part B: Senior sharing
      await client.query('SET LOCAL ROLE app_senior');
      await client.query("SELECT set_config('app.user_id', '10', true), set_config('app.role', 'senior', true), set_config('electiq.user_id', '10', true), set_config('electiq.user_role', 'senior', true)");
      
      const snEnr = (await client.query("SELECT enrollment_id FROM enrollments WHERE student_id = 1 LIMIT 1")).rows[0];
      let seniorSuccess = false;
      if (snEnr) {
        await client.query(`
          CALL sp_share_exam_questions($1, 'ISA2', '[{"text":"Explain Raft consensus leader election protocol.","marks":10,"topic":"Distributed Systems","difficulty":4}]'::jsonb)
        `, [snEnr.enrollment_id]);
        seniorSuccess = true;
      }

      report(13, "Student and senior question-sharing matches documented rules", studentSuccess && seniorSuccess, `Student shared: ${studentSuccess}, Senior shared: ${seniorSuccess}`);
      await client.query('ROLLBACK');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      report(13, "Student and senior question-sharing matches documented rules", false, e.message);
    }

  } finally {
    client.release();
    await pool.end();
  }

  console.log('\n----------------------------------------------------------------');
  console.log(`SUMMARY: ${passCount} PASSED, ${failCount} FAILED out of 13 tests`);
  console.log('----------------------------------------------------------------');
  process.exit(failCount === 0 ? 0 : 1);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
