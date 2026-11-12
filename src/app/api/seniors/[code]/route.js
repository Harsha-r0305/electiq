import { handler } from '@/lib/route';
import { httpError } from '@/lib/errors';

export const GET = handler(['student', 'admin', 'faculty', 'senior'], async ({ params, session, db }) => {
  const code = params.code;
  return await db(async (c) => {
    // 1. Get senior profile and student metadata
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
        ROUND(COALESCE(s_cgpa.cgpa, sp.cgpa)::numeric, 2) AS cgpa,
        sp.show_grades, sp.show_placements, sp.show_internships, sp.show_projects, sp.show_prep, sp.show_publications, sp.show_hackathons
      FROM senior_profiles sp
      JOIN students s ON s.student_id = sp.student_id
      JOIN departments d ON d.dept_id = s.dept_id
      LEFT JOIN LATERAL (
        SELECT ROUND(AVG(e.grade_points)::numeric, 2) AS cgpa
        FROM enrollments e
        WHERE e.student_id = sp.student_id AND e.grade_points IS NOT NULL
      ) s_cgpa ON TRUE
      WHERE sp.senior_code = $1
    `, [code]);

    const senior = seniorRes.rows[0];
    if (!senior) {
      throw httpError(404, 'Senior profile not found or has not been published yet.');
    }

    const sid = senior.student_id;
    const myStudentId = (await c.query(`SELECT fn_current_student_id() AS sid`)).rows[0]?.sid;
    const isOwnProfile = myStudentId && (myStudentId === senior.student_id);
    const isStaff = (session.role === 'admin' || session.role === 'faculty');
    const isPreview = (isOwnProfile || isStaff) && senior.status !== 'published';
    // Students only ever see admin-approved items, and only sections the senior chose to show.
    const approved = (col = 'moderation_status') => (isPreview ? 'TRUE' : `COALESCE(${col}, 'approved') = 'approved'`);
    const hideFor = (flag) => (!isPreview && !isOwnProfile && senior[flag] === false);

    if ((senior.status !== 'published' || senior.consent !== true) && !isOwnProfile && !isStaff) {
      throw httpError(404, 'Senior profile not found or has not been published yet.');
    }

    // Increment profile views safely via SECURITY DEFINER function
    // SAVEPOINT so a failure here can never abort the surrounding transaction
    try {
      await c.query('SAVEPOINT views');
      await c.query(`SELECT fn_increment_senior_views($1)`, [code]);
      await c.query('RELEASE SAVEPOINT views');
    } catch {
      await c.query('ROLLBACK TO SAVEPOINT views').catch(() => {});
    }

    // 2. Electives Taken + Feedback for each elective (Strictly no codes, purely names & attributes)
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
        f.difficulty AS difficulty_rating,
        f.usefulness AS usefulness_rating,
        f.workload AS workload_rating,
        f.review_text AS feedback_text,
        f.placement_help,
        f.extra_prep_needed,
        f.recommended_resources,
        f.advice_for_juniors AS elective_advice,
        COALESCE(sk.skills_taught, '[]'::json) AS skills_taught
      FROM enrollments e
      JOIN courses c ON c.course_id = e.course_id
      LEFT JOIN feedback f ON f.enrollment_id = e.enrollment_id
        AND (${isPreview ? 'TRUE' : "COALESCE(f.moderation_status, 'approved') = 'approved' AND NOT f.is_hidden"})
      LEFT JOIN LATERAL (
        SELECT json_agg(s.name ORDER BY cs.depth DESC, s.name) AS skills_taught
        FROM course_skills cs
        JOIN skills s ON s.skill_id = cs.skill_id
        WHERE cs.course_id = c.course_id
      ) sk ON TRUE
      WHERE e.student_id = $1 AND c.is_elective = true
      ORDER BY c.elective_slot ASC, c.semester ASC, c.title ASC
    `, [sid]);

    // 3. Extra Preparation (Certifications, online platforms, coding practice)
    const extraPrepRes = await c.query(`
      SELECT
        ea.activity_id,
        ea.type,
        ea.platform,
        ea.hours_spent,
        ea.title,
        ea.skills_covered,
        ea.certificate_obtained,
        ea.resource_url,
        c.title AS related_elective
      FROM extra_activities ea
      LEFT JOIN courses c ON c.course_id = ea.course_id
      WHERE ea.student_id = $1 AND ${approved('ea.moderation_status')}
      ORDER BY ea.hours_spent DESC
    `, [sid]);

    // 4. Placements (Full time)
    const placementsRes = await c.query(`
      SELECT
        p.placement_id,
        p.package_lpa,
        p.year,
        p.location,
        p.is_remote,
        p.tech_stack,
        p.work_description,
        p.ppo_received,
        p.placement_mode,
        p.verified,
        p.verification_status,
        p.evidence_text,
        cmp.name AS company_name,
        cmp.tier AS company_tier,
        jr.title AS role_title
      FROM placements p
      JOIN companies cmp ON cmp.company_id = p.company_id
      JOIN job_roles jr ON jr.role_id = p.role_id
      WHERE p.student_id = $1 AND p.type = 'full_time'
        ${!isPreview ? "AND p.verified = true AND COALESCE(p.verification_status, 'verified') = 'verified'" : ""}
      ORDER BY p.package_lpa DESC
    `, [sid]);

    // 5. Internships
    const internshipsRes = await c.query(`
      SELECT
        p.placement_id,
        p.duration_months,
        p.stipend_monthly,
        p.year,
        p.location,
        p.is_remote,
        p.tech_stack,
        p.work_description,
        p.ppo_received,
        p.placement_mode,
        p.verified,
        p.verification_status,
        p.evidence_text,
        cmp.name AS company_name,
        cmp.tier AS company_tier,
        jr.title AS role_title
      FROM placements p
      JOIN companies cmp ON cmp.company_id = p.company_id
      JOIN job_roles jr ON jr.role_id = p.role_id
      WHERE p.student_id = $1 AND p.type = 'internship'
        ${!isPreview ? "AND p.verified = true AND COALESCE(p.verification_status, 'verified') = 'verified'" : ""}
      ORDER BY p.year DESC
    `, [sid]);

    // 6. Projects
    const projectsRes = await c.query(`
      SELECT
        p.project_id,
        p.title,
        p.brief,
        p.problem_statement,
        p.tech_stack,
        p.repo_link,
        p.live_demo_link,
        p.outcome,
        p.helped_in_placement,
        p.is_completed,
        c.title AS elective_name,
        COALESCE(array_agg(s.name) FILTER (WHERE s.name IS NOT NULL), '{}') AS skills
      FROM projects p
      LEFT JOIN courses c ON c.course_id = p.course_id
      LEFT JOIN project_skills ps ON ps.project_id = p.project_id
      LEFT JOIN skills s ON s.skill_id = ps.skill_id
      WHERE p.student_id = $1 AND ${approved('p.moderation_status')}
      GROUP BY p.project_id, c.title
      ORDER BY p.project_id DESC
    `, [sid]);

    // 7. Research Publications
    const pubsRes = await c.query(`
      SELECT
        pub_id,
        title,
        venue,
        type,
        year,
        status,
        topic,
        doi,
        abstract,
        link
      FROM publications
      WHERE student_id = $1 AND ${approved()}
      ORDER BY year DESC, pub_id DESC
    `, [sid]);

    // 8. Events & Hackathons
    const hackathonsRes = await c.query(`
      SELECT
        achievement_id,
        event_name,
        role_status,
        position,
        organizer,
        project_presented,
        year
      FROM achievements
      WHERE student_id = $1 AND ${approved()}
      ORDER BY year DESC, achievement_id DESC
    `, [sid]);

    // 9. Structured Interview Preparation
    const interviewPrepRes = await c.query(`
      SELECT
        prep_id,
        strategy,
        weeks,
        resources,
        tips,
        dsa_strategy,
        languages_used,
        core_subjects_revised,
        mock_interviews,
        platforms_used,
        hr_prep,
        company_prep,
        mistakes_to_avoid
      FROM interview_prep
      WHERE student_id = $1 AND ${approved()}
      ORDER BY prep_id DESC
      LIMIT 1
    `, [sid]);

    // 10. Recruiter Interview Questions
    const questionsRes = await c.query(`
      SELECT
        iq.question_id,
        iq.question_text,
        iq.round,
        iq.difficulty,
        c.title AS elective_name,
        c.elective_slot
      FROM interview_questions iq
      JOIN courses c ON c.course_id = iq.course_id
      JOIN placements p ON p.placement_id = iq.placement_id
      WHERE p.student_id = $1
      ORDER BY c.elective_slot ASC, iq.question_id ASC
    `, [sid]);

    return {
      academicProfile: {
        senior_code: senior.senior_code,
        display_name: senior.display_name || `Senior ${senior.senior_code}`,
        dept_name: senior.dept_name,
        batch_year: senior.batch_year,
        cgpa: hideFor('show_grades') ? null : senior.cgpa,
        specialization: senior.specialization || null,
        headline: senior.headline,
        linkedin_url: senior.linkedin_url,
        github_url: senior.github_url,
        advice_for_juniors: senior.advice_for_juniors,
        status: senior.status,
        is_preview: isPreview,
        profile_views: senior.profile_views || 0,
      },
      electives: electivesRes.rows,
      extraPreparation: hideFor('show_prep') ? [] : extraPrepRes.rows,
      placements: hideFor('show_placements') ? [] : placementsRes.rows,
      internships: hideFor('show_internships') ? [] : internshipsRes.rows,
      projects: hideFor('show_projects') ? [] : projectsRes.rows,
      publications: hideFor('show_publications') ? [] : pubsRes.rows,
      hackathons: hideFor('show_hackathons') ? [] : hackathonsRes.rows,
      interviewPreparation: hideFor('show_prep') ? null : (interviewPrepRes.rows[0] || null),
      interviewQuestions: questionsRes.rows,
    };
  });
});

export const dynamic = 'force-dynamic';
