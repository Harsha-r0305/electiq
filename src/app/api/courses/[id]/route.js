import { handler } from '@/lib/route';
import { int } from '@/lib/validate';
import { httpError } from '@/lib/errors';

// Everything the course detail page needs, in one transaction
export const GET = handler(null, async ({ params, db }) => {
  const id = int(params.id, 'Course id', { min: 1 });
  return db(async (c) => {
    const q = async (sql, p = [id]) => (await c.query(sql, p)).rows;
    const [summary] = await q('SELECT * FROM v_course_summary WHERE course_id = $1');
    if (!summary) throw httpError(404, 'Course not found.');
    const [difficulty] = await q('SELECT fn_course_difficulty($1) AS score');
    const [stats] = await q('SELECT * FROM fn_placement_stats($1)');
    return {
      summary, difficultyScore: difficulty.score, placement: stats,
      prerequisiteChain: await q('SELECT * FROM fn_prereq_chain($1)'),
      unlocks: await q('SELECT c.course_id, c.code, c.title FROM course_prerequisites cp JOIN courses c ON c.course_id = cp.course_id WHERE cp.prereq_id = $1 ORDER BY c.code'),
      resources: await q(`
        SELECT resource_id, type, title, url, 'curriculum' AS source
        FROM resources WHERE course_id = $1 AND COALESCE(moderation_status, 'approved') = 'approved'
        UNION ALL
        SELECT (9000 + row_number() over())::int AS resource_id,
               'senior recommendation' AS type,
               f.recommended_resources AS title,
               NULL AS url,
               'senior_feedback' AS source
        FROM (
          SELECT DISTINCT recommended_resources
          FROM v_course_feedback
          WHERE course_id = $1 AND recommended_resources IS NOT NULL AND trim(recommended_resources) <> ''
        ) f
        ORDER BY type, title
      `),
      skills: await q('SELECT s.skill_id, s.name, s.category, cs.depth FROM course_skills cs JOIN skills s ON s.skill_id = cs.skill_id WHERE cs.course_id = $1 ORDER BY cs.depth DESC, s.name'),
      facultyReviews: await q('SELECT faculty_name, relevance, future_scope, comment FROM v_faculty_reviews WHERE course_id = $1'),
      preparation: await q('SELECT type, platform, seniors, avg_hours FROM v_course_preparation WHERE course_id = $1 ORDER BY seniors DESC'),
      ratingSpread: await q('SELECT difficulty AS rating, COUNT(*)::int AS votes FROM v_course_feedback WHERE course_id = $1 GROUP BY difficulty ORDER BY difficulty'),
      questions: await q(`
        SELECT iq.question_id, iq.question_text, iq.round, iq.difficulty,
               cmp.name AS company_name, pl.package_lpa, sp.senior_code,
               COALESCE(NULLIF(sp.display_name, ''), 'Senior ' || sp.senior_code) AS senior_name
        FROM interview_questions iq
        LEFT JOIN placements pl ON pl.placement_id = iq.placement_id
        LEFT JOIN companies cmp ON cmp.company_id = pl.company_id
        LEFT JOIN students s ON s.student_id = pl.student_id
        LEFT JOIN senior_profiles sp ON sp.student_id = s.student_id
        WHERE iq.course_id = $1 AND NOT iq.is_hidden
        ORDER BY iq.difficulty DESC, pl.package_lpa DESC NULLS LAST
        LIMIT 15
      `),
      seniorPrepAdvice: await q(`
        SELECT ip.prep_id, ip.strategy, ip.tips, ip.dsa_strategy, ip.core_subjects_revised, ip.mistakes_to_avoid,
               COALESCE(NULLIF(sp.display_name, ''), 'Senior ' || sp.senior_code) AS student_name, sp.senior_code, COALESCE(NULLIF(sp.display_name, ''), 'Senior ' || sp.senior_code) AS display_name,
               pl.company_name, pl.package_lpa, pl.role_title
        FROM interview_prep ip
        JOIN enrollments e ON e.student_id = ip.student_id AND e.course_id = $1
        JOIN students s ON s.student_id = ip.student_id
        LEFT JOIN senior_profiles sp ON sp.student_id = s.student_id
        LEFT JOIN LATERAL (
          SELECT p.package_lpa, cmp.name AS company_name, jr.title AS role_title
          FROM placements p
          JOIN companies cmp ON cmp.company_id = p.company_id
          JOIN job_roles jr ON jr.role_id = p.role_id
          WHERE p.student_id = s.student_id AND p.type = 'full_time'
            AND p.verified = true AND COALESCE(p.verification_status, 'verified') = 'verified'
          ORDER BY p.package_lpa DESC NULLS LAST LIMIT 1
        ) pl ON true
        WHERE COALESCE(ip.moderation_status, 'approved') = 'approved' AND sp.status = 'published' AND sp.consent = true
        ORDER BY pl.package_lpa DESC NULLS LAST
        LIMIT 6
      `),
      seniorActivities: await q(`
        SELECT ea.activity_id, ea.type, ea.platform, ea.title, ea.hours_spent, ea.skills_covered, ea.certificate_obtained,
               COALESCE(NULLIF(sp.display_name, ''), 'Senior ' || sp.senior_code) AS student_name, sp.senior_code, COALESCE(NULLIF(sp.display_name, ''), 'Senior ' || sp.senior_code) AS display_name,
               pl.company_name, pl.package_lpa, pl.role_title
        FROM extra_activities ea
        JOIN students s ON s.student_id = ea.student_id
        LEFT JOIN senior_profiles sp ON sp.student_id = s.student_id
        LEFT JOIN LATERAL (
          SELECT p.package_lpa, cmp.name AS company_name, jr.title AS role_title
          FROM placements p
          JOIN companies cmp ON cmp.company_id = p.company_id
          JOIN job_roles jr ON jr.role_id = p.role_id
          WHERE p.student_id = s.student_id AND p.type = 'full_time'
            AND p.verified = true AND COALESCE(p.verification_status, 'verified') = 'verified'
          ORDER BY p.package_lpa DESC NULLS LAST LIMIT 1
        ) pl ON true
        WHERE ea.course_id = $1 AND COALESCE(ea.moderation_status, 'approved') = 'approved' AND sp.status = 'published' AND sp.consent = true
        ORDER BY ea.hours_spent DESC
        LIMIT 10
      `),
      examSummary: await q('SELECT exam_type, COUNT(*)::int AS n FROM v_exam_questions WHERE course_id = $1 GROUP BY exam_type ORDER BY exam_type'),
    };
  });
});

export const dynamic = 'force-dynamic';
