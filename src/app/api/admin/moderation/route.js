import { handler } from '@/lib/route';
import { str, int } from '@/lib/validate';

export const GET = handler(['admin'], async ({ query, db }) => {
  return await db(async (c) => {
    // 1. Pending flagged queue with filters
    const conditions = [];
    const params = [];
    let idx = 1;

    if (query.content_type) {
      conditions.push(`mr.content_type = $${idx++}`);
      params.push(query.content_type);
    }
    if (query.status) {
      conditions.push(`mr.status = $${idx++}`);
      params.push(query.status);
    } else {
      conditions.push("mr.status = 'pending'");
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const reportsRes = await c.query(`
      SELECT mr.report_id, mr.content_type, mr.content_id, mr.reason, mr.status, mr.created_at,
             u.email AS reporter_email, u.role AS reporter_role
      FROM moderation_reports mr
      JOIN users u ON u.user_id = mr.reporter_id
      ${whereClause}
      ORDER BY mr.created_at DESC
    `, params);

    // 2. Fetch content details for each flagged item
    const reportsWithContent = await Promise.all(reportsRes.rows.map(async (r) => {
      let contentData = null;
      try {
        if (r.content_type === 'feedback') {
          const res = await c.query(`
            SELECT f.feedback_id, f.difficulty, f.workload, f.usefulness, f.review_text,
                   f.is_hidden, f.is_verified, f.admin_edited, c.code, c.title, e.term
            FROM feedback f
            JOIN enrollments e ON e.enrollment_id = f.enrollment_id
            JOIN courses c ON c.course_id = e.course_id
            WHERE f.feedback_id = $1
          `, [r.content_id]);
          contentData = res.rows[0];
        } else if (r.content_type === 'interview_question') {
          const res = await c.query(`
            SELECT iq.question_id, iq.question_text, iq.round, iq.difficulty, iq.is_hidden, iq.is_verified,
                   c.code, c.title
            FROM interview_questions iq
            JOIN courses c ON c.course_id = iq.course_id
            WHERE iq.question_id = $1
          `, [r.content_id]);
          contentData = res.rows[0];
        } else if (r.content_type === 'placement') {
          const res = await c.query(`
            SELECT p.placement_id, p.type, p.package_lpa, p.year, p.verified,
                   c.name AS company_name, jr.title AS role_title, s.student_id, sp.senior_code
            FROM placements p
            JOIN companies c ON c.company_id = p.company_id
            JOIN job_roles jr ON jr.role_id = p.role_id
            JOIN students s ON s.student_id = p.student_id
            LEFT JOIN senior_profiles sp ON sp.student_id = s.student_id
            WHERE p.placement_id = $1
          `, [r.content_id]);
          contentData = res.rows[0];
        } else if (r.content_type === 'project') {
          const res = await c.query(`
            SELECT p.project_id, p.title, p.brief, p.repo_link, p.helped_in_placement,
                   c.code, c.title AS course_title, sp.senior_code
            FROM projects p
            JOIN courses c ON c.course_id = p.course_id
            JOIN students s ON s.student_id = p.student_id
            LEFT JOIN senior_profiles sp ON sp.student_id = s.student_id
            WHERE p.project_id = $1
          `, [r.content_id]);
          contentData = res.rows[0];
        }
      } catch {}
      return { ...r, content: contentData };
    }));

    // 3. Action history (moderation_actions)
    const historyRes = await c.query(`
      SELECT ma.action_id, ma.content_type, ma.content_id, ma.action, ma.reason, ma.details, ma.created_at,
             u.email AS admin_email
      FROM moderation_actions ma
      JOIN users u ON u.user_id = ma.admin_id
      ORDER BY ma.created_at DESC
      LIMIT 25
    `);

    return {
      flaggedQueue: reportsWithContent,
      actionHistory: historyRes.rows
    };
  });
});

export const POST = handler(['admin'], async ({ session, body, db }) => {
  return await db(async (c) => {
    const action = str(body.action, 'Action'); // hide, return, correct, delete, verify, dismiss_report
    const reason = str(body.reason, 'Reason', { min: 3 });
    const contentType = body.content_type;
    const contentId = parseInt(body.content_id, 10);
    const reportId = body.report_id ? parseInt(body.report_id, 10) : null;

    if (action === 'dismiss_report') {
      if (reportId) {
        await c.query("UPDATE moderation_reports SET status = 'dismissed' WHERE report_id = $1", [reportId]);
      }
      return { ok: true, message: 'Report dismissed.' };
    }

    // 1. Hide: Disappears from student-facing views, stays in the table
    if (action === 'hide') {
      if (contentType === 'feedback') {
        await c.query('UPDATE feedback SET is_hidden = true WHERE feedback_id = $1', [contentId]);
      } else if (contentType === 'interview_question') {
        await c.query('UPDATE interview_questions SET is_hidden = true WHERE question_id = $1', [contentId]);
      }
    }

    // 2. Return to senior: Hidden; senior sees "Please correct: reason"
    if (action === 'return') {
      let studentId = body.student_id;
      if (!studentId) {
        if (contentType === 'feedback') {
          const res = await c.query('SELECT e.student_id FROM feedback f JOIN enrollments e ON e.enrollment_id = f.enrollment_id WHERE f.feedback_id = $1', [contentId]);
          studentId = res.rows[0]?.student_id;
          await c.query('UPDATE feedback SET is_hidden = true WHERE feedback_id = $1', [contentId]);
        } else if (contentType === 'placement') {
          const res = await c.query('SELECT student_id FROM placements WHERE placement_id = $1', [contentId]);
          studentId = res.rows[0]?.student_id;
        } else if (contentType === 'project') {
          const res = await c.query('SELECT student_id FROM projects WHERE project_id = $1', [contentId]);
          studentId = res.rows[0]?.student_id;
        }
      }
      if (studentId) {
        await c.query(`
          INSERT INTO returned_items (student_id, content_type, content_id, admin_reason, status)
          VALUES ($1, $2, $3, $4, 'open')
        `, [studentId, contentType, contentId, reason]);
      }
    }

    // 3. Correct (admin edit for factual errors) - row shows "edited by admin"
    if (action === 'correct') {
      if (contentType === 'feedback') {
        // Enforce: Review text is hidden, returned or deleted, NEVER rewritten!
        // Admin edits are for factual fields only (difficulty, workload, usefulness)
        const diff = body.difficulty ? parseInt(body.difficulty, 10) : null;
        const work = body.workload ? parseInt(body.workload, 10) : null;
        const use = body.usefulness ? parseInt(body.usefulness, 10) : null;
        await c.query(`
          UPDATE feedback
          SET difficulty = COALESCE($1, difficulty),
              workload = COALESCE($2, workload),
              usefulness = COALESCE($3, usefulness),
              admin_edited = true
          WHERE feedback_id = $4
        `, [diff, work, use, contentId]);
      } else if (contentType === 'placement') {
        const pkg = body.package_lpa ? parseFloat(body.package_lpa) : null;
        const year = body.year ? parseInt(body.year, 10) : null;
        await c.query(`
          UPDATE placements
          SET package_lpa = COALESCE($1, package_lpa),
              year = COALESCE($2, year)
          WHERE placement_id = $3
        `, [pkg, year, contentId]);
      }
    }

    // 4. Delete: Row removed with confirmation and reason
    if (action === 'delete') {
      if (contentType === 'feedback') {
        await c.query('DELETE FROM feedback WHERE feedback_id = $1', [contentId]);
      } else if (contentType === 'interview_question') {
        await c.query('DELETE FROM interview_questions WHERE question_id = $1', [contentId]);
      } else if (contentType === 'placement') {
        await c.query('DELETE FROM placements WHERE placement_id = $1', [contentId]);
      } else if (contentType === 'project') {
        await c.query('DELETE FROM projects WHERE project_id = $1', [contentId]);
      } else if (contentType === 'senior_profile') {
        await c.query("UPDATE senior_profiles SET status = 'draft' WHERE senior_code = $1", [body.senior_code]);
      }
    }

    // 5. Verify: Marked as checked; "Verified" badge
    if (action === 'verify') {
      if (contentType === 'feedback') {
        await c.query('UPDATE feedback SET is_verified = true WHERE feedback_id = $1', [contentId]);
      } else if (contentType === 'interview_question') {
        await c.query('UPDATE interview_questions SET is_verified = true WHERE question_id = $1', [contentId]);
      } else if (contentType === 'placement') {
        await c.query('UPDATE placements SET verified = true WHERE placement_id = $1', [contentId]);
      }
    }

    // Record in moderation_actions history
    await c.query(`
      INSERT INTO moderation_actions (admin_id, content_type, content_id, action, reason, details)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [session.uid, contentType, contentId, action, reason, JSON.stringify(body.details || {})]);

    // Update report status if associated
    if (reportId) {
      await c.query("UPDATE moderation_reports SET status = 'reviewed' WHERE report_id = $1", [reportId]);
    }

    return { ok: true, message: `Moderation action "${action}" completed.` };
  });
});

export const dynamic = 'force-dynamic';

