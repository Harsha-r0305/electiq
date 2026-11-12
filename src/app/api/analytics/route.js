import { handler } from '@/lib/route';

export const GET = handler(null, async ({ session, db }) => db(async (c) => {
  const q = async (s) => (await c.query(s)).rows;
  return {
    placement: await q('SELECT * FROM v_placement_analytics ORDER BY avg_package DESC NULLS LAST, code'),
    skillGap: await q('SELECT * FROM v_skill_gap ORDER BY uncovered DESC, demand_score DESC'),
    departments: ['faculty', 'admin'].includes(session.role) ? await q('SELECT * FROM v_department_dashboard ORDER BY department') : null,
  };
}));

export const dynamic = 'force-dynamic';
