import { handler } from '@/lib/route';
import { httpError } from '@/lib/errors';

export const GET = handler(null, async ({ query, db }) => {
  const ids = Array.from(new Set(
    String(query.ids ?? '')
      .split(',')
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0)
  ));

  if (ids.length < 1 || ids.length > 4) {
    throw httpError(400, 'Pick between 1 and 4 electives to inspect and compare.');
  }

  return db(async (client) => {
    const sql = `
      SELECT
        c.course_id,
        c.code,
        c.title,
        c.vertical,
        c.level,
        c.credits,
        c.semester,
        c.elective_slot,
        c.is_elective,
        c.advisor_scope_outlook,
        COALESCE(fb.avg_difficulty, 0) AS avg_difficulty,
        COALESCE(fb.avg_workload, 0) AS avg_workload,
        COALESCE(fb.avg_usefulness, 0) AS avg_usefulness,
        COALESCE(fb.feedback_count, 0) AS feedback_count,
        COALESCE(res.resource_list, '[]'::json) AS resources,
        COALESCE(res.resource_count, 0) AS resource_count,
        COALESCE(sk.skills, '[]'::json) AS skills,
        COALESCE(pr.prerequisites, '[]'::json) AS prerequisites,
        COALESCE(fb_quotes.quotes, '[]'::json) AS senior_feedback,
        COALESCE(prep.recommendations, '[]'::json) AS recommended_preparation,
        COALESCE(proj.project_list, '[]'::json) AS relevant_projects,
        COALESCE(roles.role_list, '[]'::json) AS career_roles,
        COALESCE(sen.seniors_count, 0) AS seniors_taken_count,
        COALESCE(pl.placed_count, 0) AS placed_students,
        pl.avg_package,
        COALESCE(sen_list.seniors_list, '[]'::json) AS verified_seniors
      FROM courses c
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) AS feedback_count,
          ROUND(AVG(f.difficulty)::numeric, 1) AS avg_difficulty,
          ROUND(AVG(f.workload)::numeric, 1) AS avg_workload,
          ROUND(AVG(f.usefulness)::numeric, 1) AS avg_usefulness
        FROM feedback f
        JOIN enrollments e ON e.enrollment_id = f.enrollment_id
        WHERE e.course_id = c.course_id
      ) fb ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) AS resource_count,
          json_agg(json_build_object('title', r.title, 'type', r.type, 'url', r.url)) AS resource_list
        FROM resources r
        WHERE r.course_id = c.course_id
      ) res ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          json_agg(json_build_object('name', s.name, 'depth', cs.depth) ORDER BY cs.depth DESC, s.name) AS skills
        FROM course_skills cs
        JOIN skills s ON s.skill_id = cs.skill_id
        WHERE cs.course_id = c.course_id
      ) sk ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          json_agg(p.title ORDER BY p.title) AS prerequisites
        FROM course_prerequisites cp
        JOIN courses p ON p.course_id = cp.prereq_id
        WHERE cp.course_id = c.course_id
      ) pr ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          json_agg(json_build_object(
            'text', f.review_text,
            'difficulty', f.difficulty,
            'usefulness', f.usefulness,
            'placement_help', f.placement_help,
            'advice', f.advice_for_juniors
          )) AS quotes
        FROM (
          SELECT f.review_text, f.difficulty, f.usefulness, f.placement_help, f.advice_for_juniors
          FROM feedback f
          JOIN enrollments e ON e.enrollment_id = f.enrollment_id
          LEFT JOIN senior_profiles sp ON sp.student_id = e.student_id
          WHERE e.course_id = c.course_id
            AND COALESCE(f.moderation_status, 'approved') = 'approved' AND NOT f.is_hidden AND sp.status = 'published' AND sp.consent = true
            AND (f.review_text IS NOT NULL OR f.advice_for_juniors IS NOT NULL)
          ORDER BY f.created_at DESC
          LIMIT 5
        ) f
      ) fb_quotes ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          json_agg(DISTINCT f.recommended_resources) AS recommendations
        FROM feedback f
        JOIN enrollments e ON e.enrollment_id = f.enrollment_id
        WHERE e.course_id = c.course_id AND f.recommended_resources IS NOT NULL AND f.recommended_resources <> ''
      ) prep ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          json_agg(json_build_object(
            'title', p.title,
            'problem_statement', p.problem_statement,
            'tech_stack', p.tech_stack
          )) AS project_list
        FROM (
          SELECT p.title, p.problem_statement, p.tech_stack
          FROM projects p
          WHERE p.course_id = c.course_id
          LIMIT 4
        ) p
      ) proj ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          json_agg(DISTINCT jr.title ORDER BY jr.title) AS role_list
        FROM role_elective_paths rc
        JOIN job_roles jr ON jr.role_id = rc.role_id
        WHERE rc.course_id = c.course_id
      ) roles ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          COUNT(DISTINCT sp.student_id) AS seniors_count
        FROM senior_profiles sp
        JOIN enrollments e ON e.student_id = sp.student_id
        WHERE e.course_id = c.course_id AND e.status = 'completed'
          AND sp.status = 'published' AND sp.consent = true
      ) sen ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          COUNT(DISTINCT p.placement_id) AS placed_count,
          ROUND(AVG(p.package_lpa)::numeric, 1) AS avg_package
        FROM placements p
        JOIN enrollments e ON e.student_id = p.student_id
        JOIN senior_profiles sp ON sp.student_id = p.student_id
        WHERE e.course_id = c.course_id AND p.type = 'full_time'
          AND p.verified = true AND COALESCE(p.verification_status, 'verified') = 'verified'
          AND sp.status = 'published' AND sp.consent = true
      ) pl ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          json_agg(json_build_object(
            'senior_code', sp.senior_code,
            'display_name', COALESCE(sp.display_name, 'Senior #' || sp.senior_code),
            'company_name', cmp.name,
            'role_title', jr.title,
            'package_lpa', sp.package_lpa
          ) ORDER BY sp.package_lpa DESC NULLS LAST) AS seniors_list
        FROM (
          SELECT DISTINCT ON (sp.student_id)
            sp.senior_code, sp.display_name, p.company_id, p.role_id, p.package_lpa
          FROM senior_profiles sp
          JOIN enrollments e ON e.student_id = sp.student_id
          LEFT JOIN placements p ON p.student_id = sp.student_id AND p.type = 'full_time'
            AND (p.verification_status IS NULL OR p.verification_status != 'rejected')
          WHERE e.course_id = c.course_id AND sp.status = 'published' AND sp.consent = true
          ORDER BY sp.student_id, (p.verified = true OR p.verification_status = 'verified') DESC, p.package_lpa DESC NULLS LAST
          LIMIT 8
        ) sp
        LEFT JOIN companies cmp ON cmp.company_id = sp.company_id
        LEFT JOIN job_roles jr ON jr.role_id = sp.role_id
      ) sen_list ON TRUE
      WHERE c.course_id = ANY($1::int[])
        AND c.is_elective = true
      ORDER BY c.title
    `;
    const res = await client.query(sql, [ids]);
    return res.rows;
  });
});

export const dynamic = 'force-dynamic';
