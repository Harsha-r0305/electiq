import { handler } from '@/lib/route';
import { oneOf } from '@/lib/validate';

const SORTS = {
  code: 'code',
  difficulty: 'avg_difficulty DESC NULLS LAST',
  package: 'avg_package DESC NULLS LAST',
  useful: 'avg_usefulness DESC NULLS LAST',
  resources: 'resource_count DESC',
  scope: 'advisor_scope_outlook DESC NULLS LAST'
};

// Course explorer: search + filters over v_course_summary view
export const GET = handler(null, async ({ query, db }) => {
  const sort = SORTS[oneOf(query.sort ?? 'code', 'sort', Object.keys(SORTS))];
  const params = [];
  const where = ['is_active'];

  if (query.q) {
    params.push(`%${query.q}%`);
    where.push(`(title ILIKE $${params.length} OR code ILIKE $${params.length})`);
  }
  if (query.dept) {
    params.push(Number(query.dept));
    where.push(`dept_id = $${params.length}`);
  }
  if (query.level) {
    params.push(query.level);
    where.push(`level = $${params.length}`);
  }
  if (query.slot) {
    params.push(query.slot);
    where.push(`elective_slot = $${params.length}`);
    where.push('is_elective = true');
  } else if (query.type === 'core' || query.is_elective === 'false') {
    where.push('is_elective = false');
  } else if (query.type === 'elective' || query.is_elective === 'true') {
    where.push('is_elective = true');
  }
  if (query.vertical) {
    params.push(`%${query.vertical}%`);
    where.push(`vertical ILIKE $${params.length}`);
  }

  return db(async (c) => {
    const rows = (await c.query(`
      SELECT s.*,
             COALESCE((
               SELECT json_agg(json_build_object('course_id', cr.course_id, 'code', cr.code, 'title', cr.title, 'slot', cr.elective_slot))
               FROM course_prerequisites cp
               JOIN courses cr ON cr.course_id = cp.course_id
               WHERE cp.prereq_id = s.course_id
             ), '[]'::json) AS unlocks
      FROM v_course_summary s
      WHERE ${where.join(' AND ')}
      ORDER BY ${sort}, code
    `, params)).rows;
    return rows;
  });
});

export const dynamic = 'force-dynamic';
