import { handler } from '@/lib/route';
import { int } from '@/lib/validate';

// Senior elective feedback, with placement outcomes and full-text search
export const GET = handler(null, async ({ params, query, db }) => {
  const id = int(params.id, 'Course id', { min: 1 });
  const q = (query.q ?? '').trim().slice(0, 100);
  return db(async (c) => {
    if (q) {
      return (await c.query(
        `SELECT feedback_id, difficulty, workload, usefulness, review_text, batch_year, created_at,
                student_name, senior_code, display_name, grade_points, placement_help,
                extra_prep_needed, recommended_resources, advice_for_juniors,
                company_name, package_lpa, role_title,
                ts_rank(review_tsv, websearch_to_tsquery('english', $2)) AS rank
           FROM v_course_feedback
          WHERE course_id = $1 AND review_tsv @@ websearch_to_tsquery('english', $2)
          ORDER BY rank DESC, created_at DESC LIMIT 30`, [id, q])).rows;
    }
    return (await c.query(
      `SELECT feedback_id, difficulty, workload, usefulness, review_text, batch_year, created_at,
              student_name, senior_code, display_name, grade_points, placement_help,
              extra_prep_needed, recommended_resources, advice_for_juniors,
              company_name, package_lpa, role_title
         FROM v_course_feedback WHERE course_id = $1 AND (review_text IS NOT NULL OR advice_for_juniors IS NOT NULL)
        ORDER BY created_at DESC LIMIT 30`, [id])).rows;
  });
});

export const dynamic = 'force-dynamic';
