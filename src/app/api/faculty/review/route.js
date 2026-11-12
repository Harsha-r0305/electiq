import { handler } from '@/lib/route';
import { httpError } from '@/lib/errors';
import { str, int } from '@/lib/validate';

export const GET = handler(['faculty', 'admin'], async ({ session, db }) => {
  return await db(async (c) => {
    // 1. Get faculty details
    const facRes = await c.query(`
      SELECT f.faculty_id, f.name, f.dept_id, d.name AS dept_name
      FROM faculty f
      JOIN departments d ON d.dept_id = f.dept_id
      WHERE f.user_id = $1
    `, [session.uid]);
    const faculty = facRes.rows[0];
    const deptId = faculty?.dept_id || null;

    // 2. Pending academic profiles from seniors in this department
    const profilesSql = `
      SELECT
        sp.student_id,
        sp.senior_code,
        sp.status,
        sp.display_name,
        sp.headline,
        sp.specialization,
        sp.advice_for_juniors,
        sp.submitted_at,
        sp.faculty_notes,
        sp.faculty_reviewed_at,
        s.name AS student_name,
        s.srn,
        s.batch_year,
        ROUND(COALESCE(s_cgpa.cgpa, 8.5)::numeric, 2) AS cgpa,
        pl.company_name,
        pl.role_title,
        pl.package_lpa,
        pl.verification_status,
        COALESCE(el.elective_count, 0) AS elective_count,
        COALESCE(el.elective_titles, '[]'::json) AS elective_titles
      FROM senior_profiles sp
      JOIN students s ON s.student_id = sp.student_id
      LEFT JOIN LATERAL (
        SELECT ROUND(AVG(e.grade_points)::numeric, 2) AS cgpa
        FROM enrollments e
        WHERE e.student_id = sp.student_id AND e.grade_points IS NOT NULL
      ) s_cgpa ON TRUE
      LEFT JOIN LATERAL (
        SELECT p.package_lpa, p.verification_status, cmp.name AS company_name, jr.title AS role_title
        FROM placements p
        LEFT JOIN companies cmp ON cmp.company_id = p.company_id
        LEFT JOIN job_roles jr ON jr.role_id = p.role_id
        WHERE p.student_id = sp.student_id AND p.type = 'full_time'
        ORDER BY p.package_lpa DESC NULLS LAST LIMIT 1
      ) pl ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          COUNT(e.enrollment_id) AS elective_count,
          json_agg(json_build_object('title', c.title, 'slot', c.elective_slot, 'grade', e.grade_points)) AS elective_titles
        FROM enrollments e
        JOIN courses c ON c.course_id = e.course_id
        WHERE e.student_id = sp.student_id AND c.is_elective = true
      ) el ON TRUE
      WHERE ($1::int IS NULL OR s.dept_id = $1)
      ORDER BY
        CASE sp.status
          WHEN 'submitted' THEN 1
          WHEN 'under_review' THEN 2
          WHEN 'changes_requested' THEN 3
          WHEN 'faculty_approved' THEN 4
          WHEN 'published' THEN 5
          ELSE 6
        END,
        sp.submitted_at DESC NULLS LAST
    `;
    const profilesRes = await c.query(profilesSql, [deptId]);

    // 3. Pending course feedback for courses in this department
    const feedbackSql = `
      SELECT
        f.feedback_id,
        f.enrollment_id,
        f.difficulty,
        f.workload,
        f.usefulness,
        f.review_text,
        f.placement_help,
        f.advice_for_juniors,
        f.recommended_resources,
        f.moderation_status,
        f.faculty_notes,
        f.created_at,
        c.course_id,
        c.title AS elective_name,
        c.elective_slot,
        sp.senior_code,
        s.name AS student_name,
        s.srn
      FROM feedback f
      JOIN enrollments e ON e.enrollment_id = f.enrollment_id
      JOIN courses c ON c.course_id = e.course_id
      JOIN students s ON s.student_id = e.student_id
      LEFT JOIN senior_profiles sp ON sp.student_id = s.student_id
      WHERE ($1::int IS NULL OR c.dept_id = $1)
      ORDER BY
        CASE f.moderation_status
          WHEN 'pending' THEN 1
          WHEN 'changes_requested' THEN 2
          WHEN 'approved' THEN 3
          ELSE 4
        END,
        f.created_at DESC
    `;
    const feedbackRes = await c.query(feedbackSql, [deptId]);

    // 4. Pending past examination questions submitted by seniors for courses in this department
    const questionsSql = `
      SELECT
        eq.exam_question_id,
        eq.course_id,
        eq.exam_type,
        eq.year,
        eq.semester,
        eq.marks,
        eq.difficulty,
        eq.question_text,
        eq.answer_text,
        eq.topic,
        eq.status,
        eq.review_comment,
        eq.created_at,
        c.title AS elective_name,
        c.elective_slot,
        s.name AS contributor_name,
        s.srn AS contributor_srn,
        sp.senior_code
      FROM exam_questions eq
      JOIN courses c ON c.course_id = eq.course_id
      LEFT JOIN students s ON s.student_id = eq.contributor_id
      LEFT JOIN senior_profiles sp ON sp.student_id = s.student_id
      WHERE ($1::int IS NULL OR c.dept_id = $1)
      ORDER BY
        CASE eq.status
          WHEN 'pending' THEN 1
          WHEN 'changes_requested' THEN 2
          WHEN 'approved' THEN 3
          ELSE 4
        END,
        eq.created_at DESC
    `;
    const questionsRes = await c.query(questionsSql, [deptId]);

    const allProfiles = profilesRes.rows;
    const pendingProfiles = allProfiles.filter(p => p.status === 'submitted' || p.status === 'under_review');
    const endorsedProfiles = allProfiles.filter(p => p.status === 'faculty_approved' || p.status === 'published');
    const changesProfiles = allProfiles.filter(p => p.status === 'changes_requested');

    const pendingFeedback = feedbackRes.rows.filter(f => f.moderation_status === 'pending');
    const pendingQuestions = questionsRes.rows.filter(q => q.status === 'pending');

    return {
      department: faculty?.dept_name || 'All Departments',
      metrics: {
        pendingProfilesCount: pendingProfiles.length,
        endorsedProfilesCount: endorsedProfiles.length,
        changesProfilesCount: changesProfiles.length,
        pendingFeedbackCount: pendingFeedback.length,
        pendingQuestionsCount: pendingQuestions.length,
      },
      profiles: allProfiles,
      pendingProfiles,
      endorsedProfiles,
      feedbackList: feedbackRes.rows,
      pendingFeedback,
      questionsList: questionsRes.rows,
      pendingQuestions,
    };
  });
});

export const POST = handler(['faculty', 'admin'], async ({ session, body, db }) => {
  return await db(async (c) => {
    const { action, studentId, seniorCode, feedbackId, questionId, notes } = body;

    // 1. Endorse Senior Academic Profile (Moves to Admin Queue)
    if (action === 'endorse_profile') {
      const sid = int(studentId, 'Student ID');
      await c.query(`
        UPDATE senior_profiles
        SET status = CASE WHEN status IN ('submitted', 'under_review') THEN 'faculty_approved' ELSE status END,
            faculty_reviewed_by = $1,
            faculty_reviewed_at = now(),
            faculty_notes = $2,
            updated_at = now()
        WHERE student_id = $3
      `, [session.uid, notes || 'Academic trajectory, course selections, and foundation grades endorsed by department faculty.', sid]);

      return { ok: true, message: 'Endorsement recorded. The administrator makes the final publish decision.' };
    }

    // 2. Request Changes on Profile
    if (action === 'request_changes_profile') {
      const sid = int(studentId, 'Student ID');
      const reason = str(notes, 'Correction notes', { min: 4 });

      await c.query(`
        UPDATE senior_profiles
        SET status = CASE WHEN status IN ('submitted', 'under_review', 'faculty_approved') THEN 'changes_requested' ELSE status END,
            faculty_reviewed_by = $1,
            faculty_reviewed_at = now(),
            faculty_notes = $2,
            updated_at = now()
        WHERE student_id = $3
      `, [session.uid, reason, sid]);

      // Record in returned_items
      await c.query(`
        INSERT INTO returned_items (student_id, title, notes, reviewer_role, reviewer_id)
        VALUES ($1, 'Academic Trajectory & Course Selection Feedback', $2, 'faculty', $3)
      `, [sid, reason, session.uid]);

      return { ok: true, message: 'Correction note sent to the senior and the admin.' };
    }

    // 3. Moderate Feedback
    if (action === 'approve_feedback') {
      const fid = int(feedbackId, 'Feedback ID');
      await c.query(`
        UPDATE feedback
        SET faculty_notes = $1
        WHERE feedback_id = $2
      `, [notes || 'Verified authentic elective course feedback.', fid]);
      return { ok: true, message: 'Endorsement recorded. The administrator approves what students see.' };
    }

    if (action === 'request_changes_feedback') {
      const fid = int(feedbackId, 'Feedback ID');
      const reason = str(notes, 'Correction note', { min: 4 });
      await c.query(`
        UPDATE feedback
        SET moderation_status = 'changes_requested',
            faculty_notes = $1,
            reviewed_by = $2,
            reviewed_at = now()
        WHERE feedback_id = $3
      `, [reason, session.uid, fid]);
      return { ok: true, message: 'Feedback marked for revision.' };
    }

    if (action === 'reject_feedback') {
      const fid = int(feedbackId, 'Feedback ID');
      await c.query(`
        UPDATE feedback
        SET moderation_status = 'rejected',
            faculty_notes = $1,
            reviewed_by = $2,
            reviewed_at = now()
        WHERE feedback_id = $3
      `, [notes || 'Rejected by department faculty.', session.uid, fid]);
      return { ok: true, message: 'Feedback rejected.' };
    }

    // 4. Moderate Exam Question
    if (action === 'approve_exam_question') {
      const qid = int(questionId, 'Exam Question ID');
      await c.query(`
        UPDATE exam_questions
        SET review_comment = $1
        WHERE exam_question_id = $2
      `, [notes || 'Verified accurate examination question solution.', qid]);
      return { ok: true, message: 'Endorsement recorded. The administrator approves what students see.' };
    }

    if (action === 'request_changes_exam_question') {
      const qid = int(questionId, 'Exam Question ID');
      const reason = str(notes, 'Correction notes', { min: 4 });
      await c.query(`
        UPDATE exam_questions
        SET status = 'changes_requested',
            reviewed_by = $1,
            reviewed_at = now(),
            review_comment = $2
        WHERE exam_question_id = $3
      `, [session.uid, reason, qid]);
      return { ok: true, message: 'Question marked for correction.' };
    }

    if (action === 'reject_exam_question') {
      const qid = int(questionId, 'Exam Question ID');
      await c.query(`
        UPDATE exam_questions
        SET status = 'rejected',
            reviewed_by = $1,
            reviewed_at = now(),
            review_comment = $2
        WHERE exam_question_id = $3
      `, [session.uid, notes || 'Rejected by department faculty.', qid]);
      return { ok: true, message: 'Exam question rejected.' };
    }

    throw httpError(400, 'Unknown review action.');
  });
});

export const dynamic = 'force-dynamic';

