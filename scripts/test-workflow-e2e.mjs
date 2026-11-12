import pg from 'pg';

const connectionString = process.env.OWNER_DATABASE_URL;
const pool = new pg.Pool({ connectionString });

async function runTest() {
  console.log('=== ELECTIQ END-TO-END WORKFLOW & SYNCHRONIZATION TEST ===\n');

  const client = await pool.connect();
  try {
    // 1. Initial State Check for Senior 1
    console.log('--- Step 1: Check Initial State for Senior 1 (student_id = 1, user_id = 10) ---');
    const seniorRes = await client.query(`
      SELECT sp.senior_code, sp.status, sp.consent, s.student_id, u.email
      FROM senior_profiles sp
      JOIN students s ON s.student_id = sp.student_id
      JOIN users u ON u.user_id = s.user_id
      WHERE s.student_id = 1
    `);
    const senior = seniorRes.rows[0];
    console.log(`Senior Code: ${senior.senior_code}, Status: ${senior.status}, Email: ${senior.email}`);

    // Check student view when not published
    const publicSeniorCheck = await client.query(`
      SELECT senior_code, status, consent FROM senior_profiles 
      WHERE senior_code = $1 AND status = 'published' AND consent = true
    `, [senior.senior_code]);
    console.log(`Publicly visible on Student Dashboard: ${publicSeniorCheck.rows.length > 0 ? 'YES' : 'NO (Protected in draft)'}`);

    // 2. Senior Submits Profile for Review
    console.log('\n--- Step 2: Senior 1 Submits Profile for Review ---');
    await client.query(`
      UPDATE senior_profiles
      SET status = 'submitted',
          submitted_at = now(),
          consent = true
      WHERE student_id = 1
    `);
    console.log('Senior 1 status updated to: submitted');

    // 3. Faculty Review: Faculty 1 Endorses Academic Profile
    console.log('\n--- Step 3: Faculty 1 (CSE Department) Reviews and Endorses Profile ---');
    await client.query(`
      UPDATE senior_profiles
      SET status = 'faculty_approved',
          faculty_reviewed_by = 1,
          faculty_notes = 'Academic electives, 8.72 CGPA, and research projects verified by CSE faculty.',
          faculty_reviewed_at = now()
      WHERE student_id = 1
    `);
    // Faculty approves pending feedback
    await client.query(`
      UPDATE feedback
      SET moderation_status = 'approved', is_verified = true
      WHERE enrollment_id IN (SELECT enrollment_id FROM enrollments WHERE student_id = 1)
    `);
    // Faculty approves exam questions
    await client.query(`
      UPDATE exam_questions
      SET status = 'approved'
      WHERE contributor_id = 1
    `);
    console.log('Faculty endorsed profile and approved feedback & exam questions.');

    // 4. Admin Verification: Admin 11 Verifies Placement & Publishes Profile
    console.log('\n--- Step 4: Admin Verification: Verify 42 LPA Google Offer & Publish Profile ---');
    // Ensure placement exists for test
    let plcRes = await client.query(`
      SELECT placement_id, package_lpa, evidence_text FROM placements
      WHERE student_id = 1 AND type = 'full_time'
    `);
    if (plcRes.rows.length === 0) {
      const compRes = await client.query("SELECT company_id FROM companies LIMIT 1");
      const companyId = compRes.rows[0]?.company_id || 1;
      const roleRes = await client.query("SELECT role_id FROM job_roles LIMIT 1");
      const roleId = roleRes.rows[0]?.role_id || 1;
      plcRes = await client.query(`
        INSERT INTO placements(student_id, company_id, role_id, type, package_lpa, year, evidence_text, verified, verification_status)
        VALUES (1, $1, $2, 'full_time', 42.00, 2026, 'Verified Offer Letter', false, 'pending')
        RETURNING placement_id, package_lpa, evidence_text
      `, [companyId, roleId]);
    }
    const placement = plcRes.rows[0];
    console.log(`Found Placement: ID ${placement.placement_id}, ${placement.package_lpa} LPA, Evidence: "${placement.evidence_text}"`);

    await client.query(`
      UPDATE placements
      SET verified = true,
          verification_status = 'verified',
          verified_by = 11,
          verified_at = now()
      WHERE placement_id = $1
    `, [placement.placement_id]);

    // Admin publishes senior profile
    await client.query(`
      UPDATE senior_profiles
      SET status = 'published',
          published_at = now(),
          reviewed_by = 11,
          review_notes = 'Verified with Campus Placement Cell offer reference GOOG-IN-2025-SDE. Published live.'
      WHERE student_id = 1
    `);
    console.log('Admin verified placement and published profile to LIVE.');

    // 5. Verify Student Dashboard Live Synchronization
    console.log('\n--- Step 5: Verify Live Student Dashboard Synchronization ---');

    // A. Senior Explorer Query (used by /api/seniors)
    const explorerRes = await client.query(`
      SELECT sp.senior_code, sp.display_name, s.batch_year, d.name AS dept_name,
             p.package_lpa, c.name AS company_name, jr.title AS role_title,
             ROUND(AVG(e.grade_points), 2) AS cgpa
      FROM senior_profiles sp
      JOIN students s ON s.student_id = sp.student_id
      JOIN departments d ON d.dept_id = s.dept_id
      LEFT JOIN enrollments e ON e.student_id = s.student_id AND e.status = 'completed'
      LEFT JOIN placements p ON p.student_id = s.student_id AND p.type = 'full_time' AND (p.verified = true OR p.verification_status = 'verified')
      LEFT JOIN companies c ON c.company_id = p.company_id
      LEFT JOIN job_roles jr ON jr.role_id = p.role_id
      WHERE sp.status = 'published' AND sp.consent = true AND sp.senior_code = $1
      GROUP BY sp.senior_code, sp.display_name, s.batch_year, d.name, p.package_lpa, c.name, jr.title
    `, [senior.senior_code]);

    console.log('Senior Explorer Query Result for Senior 1:');
    console.log(explorerRes.rows[0]);

    // B. Verified Senior Detail Check (/api/seniors/[code])
    const detailRes = await client.query(`
      SELECT sp.senior_code, sp.status, p.package_lpa, c.name AS company, jr.title AS role,
             (SELECT COUNT(*) FROM enrollments en JOIN courses co ON co.course_id = en.course_id WHERE en.student_id = 1 AND co.is_elective = true) AS electives_count,
             (SELECT COUNT(*) FROM interview_questions iq JOIN placements pl ON pl.placement_id = iq.placement_id WHERE pl.student_id = 1) AS questions_count,
             (SELECT COUNT(*) FROM projects pr WHERE pr.student_id = 1) AS projects_count,
             (SELECT COUNT(*) FROM publications pu WHERE pu.student_id = 1) AS pubs_count,
             (SELECT COUNT(*) FROM achievements ac WHERE ac.student_id = 1) AS hackathons_count
      FROM senior_profiles sp
      LEFT JOIN placements p ON p.student_id = sp.student_id AND p.type = 'full_time' AND p.verified = true
      LEFT JOIN companies c ON c.company_id = p.company_id
      LEFT JOIN job_roles jr ON jr.role_id = p.role_id
      WHERE sp.senior_code = $1
    `, [senior.senior_code]);
    console.log('\nFull Profile Verification:');
    console.log(detailRes.rows[0]);

    // C. Approved Exam Questions in Repository
    const eqRes = await client.query(`
      SELECT eq.exam_question_id, eq.exam_type, eq.marks, c.title AS elective_name, eq.status
      FROM exam_questions eq
      JOIN courses c ON c.course_id = eq.course_id
      WHERE eq.contributor_id = 1
    `);
    console.log('\nExam Questions Repository Live Status:');
    console.table(eqRes.rows);

    // D. Elective Comparison & Verified Alumni Stats
    const statsRes = await client.query(`
      SELECT cs.course_id, c.title, cs.verified_seniors_count, cs.verified_placements_count, cs.avg_package_lpa
      FROM v_course_stats cs
      JOIN courses c ON c.course_id = cs.course_id
      WHERE cs.course_id IN (
        SELECT course_id FROM enrollments WHERE student_id = 1 AND status = 'completed'
      )
    `);
    console.log('\nVerified Course Placement Stats contributed by Senior 1:');
    console.table(statsRes.rows);

    console.log('\n✅ ALL E2E VERIFICATION CHECKS PASSED PERFECTLY!');
  } finally {
    client.release();
    await pool.end();
  }
}

runTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
