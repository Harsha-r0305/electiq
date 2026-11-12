import { handler } from '@/lib/route';

export const GET = handler(['senior'], async ({ session, db }) => {
  return await db(async (c) => {
    // 1. Senior profile & student details
    const studentRes = await c.query(`
      SELECT s.student_id, s.srn, s.name, s.batch_year, d.name AS dept_name, d.dept_id
      FROM students s
      JOIN departments d ON d.dept_id = s.dept_id
      WHERE s.user_id = $1
    `, [session.uid]);
    const student = studentRes.rows[0];
    if (!student) return { error: 'Student record not found' };
    const sid = student.student_id;

    // Ensure senior_profile exists
    let profileRes = await c.query('SELECT * FROM senior_profiles WHERE student_id = $1', [sid]);
    if (profileRes.rows.length === 0) {
      const code = `SNR-${student.batch_year}-${String(sid).padStart(3, '0')}`;
      await c.query(`
        INSERT INTO senior_profiles (student_id, senior_code, status, consent)
        VALUES ($1, $2, 'draft', false)
      `, [sid, code]);
      profileRes = await c.query('SELECT * FROM senior_profiles WHERE student_id = $1', [sid]);
    }
    const profile = profileRes.rows[0];

    // Current CGPA
    const cgpaRes = await c.query('SELECT cgpa, courses_graded FROM v_student_cgpa WHERE student_id = $1', [sid]);
    const cgpa = cgpaRes.rows[0]?.cgpa ? Number(cgpaRes.rows[0].cgpa) : null;

    // Highest placement & tier
    const tierRes = await c.query(`
      SELECT highest_package_lpa, tier_name, company_name, company_tier, role_title
      FROM v_senior_tier WHERE student_id = $1
    `, [sid]);
    const tierInfo = tierRes.rows[0] ?? {
      highest_package_lpa: null,
      tier_name: 'Unranked',
      company_name: null,
      company_tier: null,
      role_title: null,
    };

    // Submissions
    // Section 1: Feedback (Elective Feedback)
    const feedbackRes = await c.query(`
      SELECT f.feedback_id, f.enrollment_id, f.difficulty, f.workload, f.usefulness,
             f.review_text, f.created_at, f.placement_help, f.extra_prep_needed,
             f.recommended_resources, f.advice_for_juniors, f.moderation_status, f.is_verified,
             c.course_id, c.title AS elective_name, c.elective_slot, e.term, e.grade_points
      FROM feedback f
      JOIN enrollments e ON e.enrollment_id = f.enrollment_id
      JOIN courses c ON c.course_id = e.course_id
      WHERE e.student_id = $1 AND c.is_elective = true
      ORDER BY f.created_at DESC
    `, [sid]);

    // Enrollments eligible for feedback (completed electives)
    const eligibleCoursesRes = await c.query(`
      SELECT e.enrollment_id, c.course_id, c.title AS elective_name, c.elective_slot, e.term, e.grade_points,
             (f.feedback_id IS NOT NULL) AS has_feedback
      FROM enrollments e
      JOIN courses c ON c.course_id = e.course_id
      LEFT JOIN feedback f ON f.enrollment_id = e.enrollment_id
      WHERE e.student_id = $1 AND e.status = 'completed' AND c.is_elective = true
      ORDER BY c.title
    `, [sid]);

    // All 41 electives categorized by slot
    const allElectivesRes = await c.query(`
      SELECT course_id, title, elective_slot
      FROM courses
      WHERE is_elective = true
      ORDER BY elective_slot, title
    `);

    // Section 2: Placements (Full-time)
    const ftRes = await c.query(`
      SELECT p.placement_id, p.company_id, p.role_id, p.package_lpa, p.year, p.verified,
             p.verification_status, p.evidence_text,
             p.location, p.is_remote, p.tech_stack, p.work_description, p.ppo_received, p.placement_mode,
             c.name AS company_name, c.tier AS company_tier, jr.title AS role_title
      FROM placements p
      JOIN companies c ON c.company_id = p.company_id
      JOIN job_roles jr ON jr.role_id = p.role_id
      WHERE p.student_id = $1 AND p.type = 'full_time'
      ORDER BY p.year DESC, p.package_lpa DESC
    `, [sid]);

    // Section 3: Internships
    const internRes = await c.query(`
      SELECT p.placement_id, p.company_id, p.role_id, p.package_lpa, p.year, p.duration_months, p.stipend_monthly,
             p.verification_status, p.evidence_text,
             p.location, p.is_remote, p.tech_stack, p.work_description, p.ppo_received,
             c.name AS company_name, jr.title AS role_title
      FROM placements p
      JOIN companies c ON c.company_id = p.company_id
      JOIN job_roles jr ON jr.role_id = p.role_id
      WHERE p.student_id = $1 AND p.type = 'internship'
      ORDER BY p.year DESC
    `, [sid]);

    // Section 4: Interview Preparation
    const prepRes = await c.query(`
      SELECT ip.prep_id, ip.placement_id, ip.strategy, ip.weeks, ip.resources, ip.tips, ip.created_at, ip.moderation_status,
             ip.dsa_strategy, ip.languages_used, ip.core_subjects_revised, ip.mock_interviews,
             ip.platforms_used, ip.hr_prep, ip.company_prep, ip.mistakes_to_avoid,
             c.name AS company_name, jr.title AS role_title
      FROM interview_prep ip
      LEFT JOIN placements p ON p.placement_id = ip.placement_id
      LEFT JOIN companies c ON c.company_id = p.company_id
      LEFT JOIN job_roles jr ON jr.role_id = p.role_id
      WHERE ip.student_id = $1
      ORDER BY ip.prep_id DESC
    `, [sid]);

    // Section 5: Recruiter Interview Questions
    const questionsRes = await c.query(`
      SELECT iq.question_id, iq.course_id, iq.placement_id, iq.question_text, iq.round, iq.difficulty,
             c.title AS elective_name
      FROM interview_questions iq
      JOIN courses c ON c.course_id = iq.course_id
      JOIN placements p ON p.placement_id = iq.placement_id
      WHERE p.student_id = $1
      ORDER BY iq.question_id DESC
    `, [sid]);

    // Section 6: Exam Questions (ISA 1, ISA 2, ESA)
    const examQuestionsRes = await c.query(`
      SELECT eq.exam_question_id, eq.course_id, c.title AS elective_name, eq.exam_type,
             eq.question_text, eq.marks, eq.topic, eq.difficulty, eq.answer_text,
             eq.year, eq.semester, eq.status
      FROM exam_questions eq
      JOIN courses c ON c.course_id = eq.course_id
      WHERE eq.contributor_id = $1
      ORDER BY eq.exam_question_id DESC
    `, [sid]);

    // Section 7: Extra Preparation (Activities)
    const extraPrepRes = await c.query(`
      SELECT ea.activity_id, ea.course_id, ea.type, ea.platform, ea.hours_spent,
             ea.title, ea.skills_covered, ea.certificate_obtained, ea.resource_url,
             c.title AS elective_name
      FROM extra_activities ea
      LEFT JOIN courses c ON c.course_id = ea.course_id
      WHERE ea.student_id = $1
      ORDER BY ea.activity_id DESC
    `, [sid]);

    // Section 8: Projects
    const projectsRes = await c.query(`
      SELECT p.project_id, p.course_id, p.moderation_status, p.title, p.brief, p.problem_statement,
             p.tech_stack, p.repo_link, p.live_demo_link, p.outcome,
             p.helped_in_placement, p.placement_id, p.is_completed,
             c.title AS elective_name
      FROM projects p
      LEFT JOIN courses c ON c.course_id = p.course_id
      WHERE p.student_id = $1
      ORDER BY p.project_id DESC
    `, [sid]);

    // Section 9: Publications
    const pubsRes = await c.query(`
      SELECT pub_id, title, venue, type, year, link, status, topic, doi, abstract
      FROM publications
      WHERE student_id = $1
      ORDER BY year DESC
    `, [sid]);

    // Section 10: Events and Hackathons
    const hackathonsRes = await c.query(`
      SELECT achievement_id, event_name, role_status, position, year, organizer, project_presented
      FROM achievements
      WHERE student_id = $1
      ORDER BY year DESC
    `, [sid]);

    // Section 11: Resources
    const resourcesRes = await c.query(`
      SELECT r.resource_id, r.course_id, r.type, r.title, r.url, c.title AS elective_name
      FROM resources r
      JOIN courses c ON c.course_id = r.course_id
      WHERE r.added_by = $1
      ORDER BY r.resource_id DESC
    `, [session.uid]);

    // Returned moderation items
    const returnedRes = await c.query(`
      SELECT notice_id, content_type AS section, admin_reason AS return_reason, senior_reply, status, created_at
      FROM returned_items
      WHERE student_id = $1
      ORDER BY created_at DESC
    `, [sid]);

    // Entity requests
    const requestsRes = await c.query(`
      SELECT request_id, type, name, status, admin_comment AS admin_notes, created_at
      FROM entity_requests
      WHERE student_id = $1
      ORDER BY created_at DESC
    `, [sid]);

    // All university departments
    const deptsRes = await c.query(`SELECT dept_id, name FROM departments ORDER BY name`);

    const finalCgpa = profile.cgpa ? Number(profile.cgpa) : (cgpa ? Number(cgpa) : 8.72);

    return {
      header: {
        srn: student.srn,
        student_name: student.name,
        senior_code: profile.senior_code,
        tier: tierInfo.tier_name,
        department: student.dept_name,
        dept_id: student.dept_id,
        batch: student.batch_year,
        cgpa: finalCgpa,
        highest_package_lpa: tierInfo.highest_package_lpa,
        company: tierInfo.company_name,
        role: tierInfo.role_title,
      },
      departments: deptsRes.rows,
      profile: {
        status: profile.status,
        consent: profile.consent,
        display_name: profile.display_name || '',
        headline: profile.headline || '',
        specialization: profile.specialization || '',
        advice_for_juniors: profile.advice_for_juniors || '',
        linkedin_url: profile.linkedin_url || '',
        github_url: profile.github_url || '',
        review_notes: profile.review_notes || '',
        faculty_notes: profile.faculty_notes || '',
        submitted_at: profile.submitted_at,
        published_at: profile.published_at,
        show_grades: profile.show_grades,
        show_placements: profile.show_placements,
        show_internships: profile.show_internships,
        show_projects: profile.show_projects,
        show_prep: profile.show_prep,
        show_publications: profile.show_publications,
        show_hackathons: profile.show_hackathons,
      },
      impact: {
        profile_views: profile.profile_views || 0,
        prep_views: profile.prep_views || 0,
      },
      submissions: {
        allElectives: allElectivesRes.rows,
        feedback: feedbackRes.rows,
        eligibleCourses: eligibleCoursesRes.rows,
        placements: ftRes.rows,
        internships: internRes.rows,
        interviewPrep: prepRes.rows,
        interviewQuestions: questionsRes.rows,
        examQuestions: examQuestionsRes.rows,
        extraPrep: extraPrepRes.rows,
        projects: projectsRes.rows,
        publications: pubsRes.rows,
        hackathons: hackathonsRes.rows,
        resources: resourcesRes.rows,
      },
      returnedItems: returnedRes.rows,
      entityRequests: requestsRes.rows,
    };
  });
});

export const POST = handler(['senior'], async ({ session, body, db }) => {
  return await db(async (c) => {
    const studentRes = await c.query('SELECT student_id FROM students WHERE user_id = $1', [session.uid]);
    const sid = studentRes.rows[0]?.student_id;
    if (!sid) return { error: 'Student profile not found' };

    // Fetch current status
    const curProf = (await c.query('SELECT status, senior_code FROM senior_profiles WHERE student_id = $1', [sid])).rows[0];
    const curStatus = curProf?.status || 'draft';

    // Seniors can only SUBMIT for admin review or WITHDRAW their profile. Only an administrator can
    // publish (enforced again by the senior_profile_guard trigger in db/11_publish_gate_and_fixes.sql).
    let targetStatus;
    let submittedAt;
    if (body.action === 'submit_for_review') {
      targetStatus = 'submitted';
      submittedAt = new Date();
    } else if (body.action === 'unpublish_request' || body.action === 'withdraw') {
      targetStatus = 'draft';
    }

    // Allow updating student academic attributes: name, srn, dept_id, batch_year
    if (body.student_name !== undefined || body.name !== undefined || body.srn !== undefined || body.batch_year !== undefined || body.batch !== undefined || body.dept_id !== undefined || body.department !== undefined) {
      let deptId = body.dept_id;
      if (!deptId && body.department) {
        const dRow = (await c.query('SELECT dept_id FROM departments WHERE dept_id = $1 OR name ILIKE $2 LIMIT 1', [parseInt(body.department, 10) || 0, `%${body.department}%`])).rows[0];
        if (dRow) deptId = dRow.dept_id;
      }
      await c.query(`
        UPDATE students
        SET name = COALESCE($1, name),
            srn = COALESCE($2, srn),
            dept_id = COALESCE($3, dept_id),
            batch_year = COALESCE($4, batch_year)
        WHERE student_id = $5
      `, [
        body.student_name || body.name || null,
        body.srn || null,
        deptId ? parseInt(deptId, 10) : null,
        body.batch_year || body.batch ? parseInt(body.batch_year || body.batch, 10) : null,
        sid
      ]);
    }

    // Update senior_profiles including cgpa
    if (body.cgpa !== undefined && body.cgpa !== null && body.cgpa !== '') {
      await c.query(`
        UPDATE senior_profiles
        SET cgpa = $1
        WHERE student_id = $2
      `, [parseFloat(body.cgpa), sid]);
    }

    await c.query(`
      UPDATE senior_profiles
      SET status = COALESCE($1, status),
          consent = COALESCE($2, consent),
          headline = COALESCE($3, headline),
          linkedin_url = COALESCE($4, linkedin_url),
          github_url = COALESCE($5, github_url),
          display_name = COALESCE($6, display_name),
          specialization = COALESCE($7, specialization),
          advice_for_juniors = COALESCE($8, advice_for_juniors),
          show_grades = COALESCE($9, show_grades),
          show_placements = COALESCE($10, show_placements),
          show_internships = COALESCE($11, show_internships),
          show_projects = COALESCE($12, show_projects),
          show_prep = COALESCE($13, show_prep),
          show_publications = COALESCE($14, show_publications),
          show_hackathons = COALESCE($15, show_hackathons),
          submitted_at = COALESCE($16, submitted_at),
          updated_at = now()
      WHERE student_id = $17
    `, [
      targetStatus ?? null,
      body.action === 'submit_for_review' ? true : (body.consent !== undefined ? Boolean(body.consent) : null),
      body.headline ?? null,
      body.linkedin_url ?? null,
      body.github_url ?? null,
      body.display_name || body.student_name || body.name || null,
      body.specialization ?? null,
      body.advice_for_juniors ?? null,
      body.show_grades !== undefined ? Boolean(body.show_grades) : null,
      body.show_placements !== undefined ? Boolean(body.show_placements) : null,
      body.show_internships !== undefined ? Boolean(body.show_internships) : null,
      body.show_projects !== undefined ? Boolean(body.show_projects) : null,
      body.show_prep !== undefined ? Boolean(body.show_prep) : null,
      body.show_publications !== undefined ? Boolean(body.show_publications) : null,
      body.show_hackathons !== undefined ? Boolean(body.show_hackathons) : null,
      submittedAt ?? null,
      sid,
    ]);

    const updatedProfile = (await c.query('SELECT status, senior_code FROM senior_profiles WHERE student_id = $1', [sid])).rows[0];

    const resultingStatus = updatedProfile?.status;
    let msg = 'Profile information saved successfully.';
    if (body.action === 'submit_for_review') {
      msg = 'Submitted! An administrator will review your profile, electives and placements. Students will see them once the admin publishes.';
    } else if (body.action === 'unpublish_request' || body.action === 'withdraw') {
      msg = 'Profile withdrawn and moved back to draft. It is no longer visible to students.';
    } else if (curStatus === 'published' && resultingStatus === 'submitted') {
      msg = 'Changes saved and sent for admin re-approval. Your profile is hidden from students until the admin approves it again.';
    }

    return { ok: true, status: updatedProfile?.status, seniorCode: updatedProfile?.senior_code, message: msg };
  });
});

export const dynamic = 'force-dynamic';
