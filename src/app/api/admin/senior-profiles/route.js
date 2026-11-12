import { handler } from '@/lib/route';
import { str, int } from '@/lib/validate';
import { httpError } from '@/lib/errors';

export const GET = handler(['admin'], async ({ query, db }) => {
  return await db(async (c) => {
    // 1. System Metrics Overview Bar
    const metricsRes = await c.query(`
      SELECT
        (SELECT COUNT(*) FROM senior_profiles WHERE status = 'submitted') AS submitted_count,
        (SELECT COUNT(*) FROM senior_profiles WHERE status = 'faculty_approved') AS faculty_approved_count,
        (SELECT COUNT(*) FROM senior_profiles WHERE status = 'published') AS published_count,
        (SELECT COUNT(*) FROM senior_profiles WHERE status = 'changes_requested') AS changes_requested_count,
        (SELECT COUNT(*) FROM placements WHERE verification_status = 'pending') AS pending_placements_count,
        (SELECT COUNT(*) FROM feedback WHERE moderation_status = 'pending') AS pending_feedback_count,
        (SELECT COUNT(*) FROM exam_questions WHERE status = 'pending') AS pending_questions_count
    `);
    const metrics = metricsRes.rows[0];

    // 2. Comprehensive Profile Approval Queue
    const seniorsRes = await c.query(`
      SELECT
        sp.student_id,
        sp.senior_code,
        sp.status AS profile_status,
        sp.consent,
        sp.headline,
        sp.specialization,
        sp.submitted_at,
        sp.published_at,
        sp.faculty_notes,
        sp.faculty_reviewed_at,
        sp.review_notes AS admin_notes,
        (SELECT COUNT(*) FROM placements x WHERE x.student_id = sp.student_id AND COALESCE(x.verification_status,'verified') = 'pending')
         + (SELECT COUNT(*) FROM feedback x JOIN enrollments en ON en.enrollment_id = x.enrollment_id WHERE en.student_id = sp.student_id AND x.moderation_status = 'pending')
         + (SELECT COUNT(*) FROM projects x WHERE x.student_id = sp.student_id AND x.moderation_status = 'pending')
         + (SELECT COUNT(*) FROM interview_prep x WHERE x.student_id = sp.student_id AND x.moderation_status = 'pending') AS pending_items,
        s.name AS student_name,
        s.srn,
        s.batch_year,
        d.name AS dept_name,
        ROUND(COALESCE(s_cgpa.cgpa, sp.cgpa)::numeric, 2) AS cgpa,
        pl.placement_id,
        pl.company_name,
        pl.role_title,
        pl.package_lpa,
        pl.verified AS placement_verified,
        pl.verification_status,
        pl.evidence_text
      FROM senior_profiles sp
      JOIN students s ON s.student_id = sp.student_id
      LEFT JOIN departments d ON d.dept_id = s.dept_id
      LEFT JOIN LATERAL (
        SELECT ROUND(AVG(e.grade_points)::numeric, 2) AS cgpa
        FROM enrollments e
        WHERE e.student_id = sp.student_id AND e.grade_points IS NOT NULL
      ) s_cgpa ON TRUE
      LEFT JOIN LATERAL (
        SELECT p.placement_id, p.package_lpa, p.verified, p.verification_status, p.evidence_text,
               cmp.name AS company_name, jr.title AS role_title
        FROM placements p
        LEFT JOIN companies cmp ON cmp.company_id = p.company_id
        LEFT JOIN job_roles jr ON jr.role_id = p.role_id
        WHERE p.student_id = sp.student_id AND p.type = 'full_time'
        ORDER BY p.package_lpa DESC NULLS LAST LIMIT 1
      ) pl ON TRUE
      ORDER BY
        CASE sp.status
          WHEN 'submitted' THEN 1
          WHEN 'faculty_approved' THEN 2
          WHEN 'changes_requested' THEN 3
          WHEN 'published' THEN 4
          ELSE 5
        END,
        sp.submitted_at DESC NULLS LAST
    `);

    // 3. Dedicated Placement Verification Queue
    const placementsQueueRes = await c.query(`
      SELECT
        p.placement_id,
        p.student_id,
        p.package_lpa,
        p.type,
        p.year,
        p.location,
        p.tech_stack,
        p.work_description,
        p.ppo_received,
        p.placement_mode,
        p.verified,
        p.verification_status,
        p.evidence_text,
        p.review_notes,
        cmp.name AS company_name,
        jr.title AS role_title,
        sp.senior_code,
        s.name AS student_name,
        s.srn,
        d.name AS dept_name
      FROM placements p
      JOIN students s ON s.student_id = p.student_id
      LEFT JOIN senior_profiles sp ON sp.student_id = s.student_id
      LEFT JOIN departments d ON d.dept_id = s.dept_id
      LEFT JOIN companies cmp ON cmp.company_id = p.company_id
      LEFT JOIN job_roles jr ON jr.role_id = p.role_id
      ORDER BY
        CASE p.verification_status
          WHEN 'pending' THEN 1
          WHEN 'changes_requested' THEN 2
          WHEN 'verified' THEN 3
          ELSE 4
        END,
        p.package_lpa DESC NULLS LAST
    `);

    // 4. Pending feedback queue
    const feedbackQueueRes = await c.query(`
      SELECT
        f.feedback_id, f.difficulty, f.usefulness, f.workload, f.review_text,
        f.moderation_status, f.faculty_notes, f.created_at,
        c.title AS elective_name, sp.senior_code, s.name AS student_name
      FROM feedback f
      JOIN enrollments e ON e.enrollment_id = f.enrollment_id
      JOIN courses c ON c.course_id = e.course_id
      JOIN students s ON s.student_id = e.student_id
      LEFT JOIN senior_profiles sp ON sp.student_id = s.student_id
      ORDER BY (f.moderation_status = 'pending') DESC, f.created_at DESC
      LIMIT 20
    `);

    // 5. Pending exam questions queue
    const questionsQueueRes = await c.query(`
      SELECT
        eq.exam_question_id, eq.exam_type, eq.marks, eq.question_text, eq.answer_text,
        eq.status, eq.created_at,
        c.title AS elective_name, s.name AS contributor_name, sp.senior_code
      FROM exam_questions eq
      JOIN courses c ON c.course_id = eq.course_id
      LEFT JOIN students s ON s.student_id = eq.contributor_id
      LEFT JOIN senior_profiles sp ON sp.student_id = s.student_id
      ORDER BY (eq.status = 'pending') DESC, eq.created_at DESC
      LIMIT 20
    `);

    // 6. Recent moderation actions
    const historyRes = await c.query(`
      SELECT ma.action_id, ma.content_type, ma.action, ma.reason, ma.created_at, COALESCE(st.name, u.email, 'Admin') AS admin_name
      FROM moderation_actions ma
      LEFT JOIN users u ON u.user_id = ma.admin_id
      LEFT JOIN students st ON st.user_id = u.user_id
      ORDER BY ma.created_at DESC
      LIMIT 25
    `);

    return {
      metrics,
      seniorProfiles: seniorsRes.rows,
      placementsQueue: placementsQueueRes.rows,
      feedbackQueue: feedbackQueueRes.rows,
      questionsQueue: questionsQueueRes.rows,
      moderationHistory: historyRes.rows,
    };
  });
});

export const POST = handler(['admin'], async ({ session, body, db }) => {
  return await db(async (c) => {
    const { action, data = {} } = body;

    // 1. Verify Placement Offer (Dedicated Queue)
    if (action === 'verify_placement') {
      const placementId = int(data.placement_id, 'Placement ID');
      await c.query(`
        UPDATE placements
        SET verified = true,
            verification_status = 'verified',
            verified_by = $1,
            verified_at = now(),
            review_notes = $2
        WHERE placement_id = $3
      `, [session.uid, data.notes || 'Official offer letter & CTC package verified against campus placement records.', placementId]);

      await c.query(`
        INSERT INTO moderation_actions (admin_id, content_type, content_id, action, reason)
        VALUES ($1, 'placement', $2, 'verify', $3)
      `, [session.uid, placementId, 'Verified official placement package']);

      return { ok: true, message: 'Placement package verified! Synchronized with Student Dashboard and Senior Explorer.' };
    }

    if (action === 'reject_placement') {
      const placementId = int(data.placement_id, 'Placement ID');
      const reason = str(data.reason, 'Reason for rejection', { min: 3 });
      await c.query(`
        UPDATE placements
        SET verified = false,
            verification_status = 'rejected',
            verified_by = $1,
            verified_at = now(),
            review_notes = $2
        WHERE placement_id = $3
      `, [session.uid, reason, placementId]);

      return { ok: true, message: 'Placement package rejected.' };
    }

    if (action === 'request_placement_correction') {
      const placementId = int(data.placement_id, 'Placement ID');
      const reason = str(data.reason, 'Reason for correction', { min: 4 });
      await c.query(`
        UPDATE placements
        SET verified = false,
            verification_status = 'changes_requested',
            review_notes = $1
        WHERE placement_id = $2
      `, [reason, placementId]);

      return { ok: true, message: 'Placement correction requested.' };
    }

    // 2. Publish Senior Profile (admin is the single publisher; faculty endorsement is optional)
    if (action === 'publish') {
      const seniorCode = str(data.senior_code, 'Senior code');
      const prof = (await c.query(
        `SELECT sp.student_id, sp.status, sp.consent, s.user_id FROM senior_profiles sp JOIN students s ON s.student_id = sp.student_id WHERE sp.senior_code = $1`,
        [seniorCode])).rows[0];
      if (!prof) throw httpError(404, 'Senior profile not found.');
      if (!['submitted', 'under_review', 'faculty_approved', 'approved', 'published'].includes(prof.status)) {
        throw httpError(400, `This profile is "${prof.status}". Only profiles the senior has submitted for review can be published.`);
      }
      if (!prof.consent) {
        throw httpError(400, 'Cannot publish senior profile without explicit senior consent.');
      }
      const sid = prof.student_id;
      const note = data.notes || 'Approved and published by administrator.';

      await c.query(`
        UPDATE senior_profiles
        SET status = 'published', published_at = COALESCE(published_at, now()),
            reviewed_by = $1, review_notes = $2, updated_at = now()
        WHERE student_id = $3
      `, [session.uid, note, sid]);

      await c.query(`
        INSERT INTO moderation_actions (admin_id, content_type, content_id, action, reason, details)
        VALUES ($1, 'senior_profile', $2, 'verify', $3, $4)
      `, [session.uid, sid, `Published senior profile ${seniorCode}`, JSON.stringify({ senior_code: seniorCode })]);

      return { ok: true, message: `${seniorCode} profile is now published.` };
    }

    // 2b. Reject a submission outright (kept hidden; senior can fix and resubmit)
    if (action === 'reject_profile') {
      const seniorCode = str(data.senior_code, 'Senior code');
      const reason = str(data.reason, 'Reason for rejection', { min: 4 });
      const r = await c.query(`UPDATE senior_profiles SET status = 'rejected', review_notes = $1, reviewed_by = $2, updated_at = now()
                               WHERE senior_code = $3 RETURNING student_id`, [reason, session.uid, seniorCode]);
      if (!r.rows[0]) throw httpError(404, 'Senior profile not found.');
      await c.query(`INSERT INTO returned_items (student_id, title, notes, reviewer_role, reviewer_id)
                     VALUES ($1, 'Administrator Review: Profile Rejected', $2, 'admin', $3)`, [r.rows[0].student_id, reason, session.uid]);
      await c.query(`INSERT INTO moderation_actions (admin_id, content_type, content_id, action, reason, details)
                     VALUES ($1, 'senior_profile', $2, 'reject', $3, $4)`, [session.uid, r.rows[0].student_id, reason, JSON.stringify({ senior_code: seniorCode })]);
      return { ok: true, message: `Profile ${seniorCode} rejected.` };
    }

    // 3. Takedown Profile to Draft
    if (action === 'takedown') {
      const seniorCode = str(data.senior_code, 'Senior code');
      const reason = str(data.reason, 'Reason for takedown', { min: 3 });

      await c.query("UPDATE senior_profiles SET status = 'draft', updated_at = now() WHERE senior_code = $1", [seniorCode]);
      await c.query(`
        INSERT INTO moderation_actions (admin_id, content_type, content_id, action, reason, details)
        VALUES ($1, 'senior_profile', 0, 'hide', $2, $3)
      `, [session.uid, reason, JSON.stringify({ senior_code: seniorCode })]);

      return { ok: true, message: `Senior profile ${seniorCode} taken down to draft.` };
    }

    // 4. Request Changes on Profile
    if (action === 'request_changes_profile') {
      const seniorCode = str(data.senior_code, 'Senior code');
      const reason = str(data.reason, 'Reason for changes', { min: 4 });

      const profRes = await c.query('SELECT student_id FROM senior_profiles WHERE senior_code = $1', [seniorCode]);
      const sid = profRes.rows[0]?.student_id;

      await c.query(`
        UPDATE senior_profiles
        SET status = 'changes_requested',
            review_notes = $1,
            reviewed_by = $2,
            updated_at = now()
        WHERE senior_code = $3
      `, [reason, session.uid, seniorCode]);

      if (sid) {
        await c.query(`
          INSERT INTO returned_items (student_id, title, notes, reviewer_role, reviewer_id)
          VALUES ($1, 'Administrator Review: Profile Revisions Required', $2, 'admin', $3)
        `, [sid, reason, session.uid]);
      }

      return { ok: true, message: `Correction request sent to senior ${seniorCode}.` };
    }

    // 5. Moderate Feedback
    if (action === 'moderate_feedback') {
      const fid = int(data.feedback_id, 'Feedback ID');
      const status = str(data.status, 'Status'); // approved, rejected
      await c.query(`
        UPDATE feedback
        SET moderation_status = $1::varchar,
            is_verified = ($1::text = 'approved'),
            reviewed_by = $2,
            reviewed_at = now()
        WHERE feedback_id = $3
      `, [status, session.uid, fid]);
      return { ok: true, message: `Feedback ${status}.` };
    }

    // 6. Moderate Exam Question
    if (action === 'moderate_exam_question') {
      const qid = int(data.question_id, 'Exam Question ID');
      const status = str(data.status, 'Status'); // approved, rejected
      await c.query(`
        UPDATE exam_questions
        SET status = $1,
            reviewed_by = $2,
            reviewed_at = now()
        WHERE exam_question_id = $3
      `, [status, session.uid, qid]);
      return { ok: true, message: `Exam question ${status}.` };
    }

    throw httpError(400, 'Unknown admin action.');
  });
});

export const dynamic = 'force-dynamic';
