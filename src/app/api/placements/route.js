import { handler } from '@/lib/route';
import { int, num, str, oneOf } from '@/lib/validate';

// One atomic stored procedure: placement + interview questions + preparation logs (all or nothing).
export const POST = handler(['senior'], async ({ body, db }) => {
  const company = int(body.company_id, 'Company', { min: 1 });
  const role = int(body.role_id, 'Role', { min: 1 });
  const type = oneOf(body.type, 'Type', ['internship', 'full_time']);
  const pkg = num(body.package_lpa, 'Package (LPA)', { min: 0.1, max: 500 });
  const year = int(body.year, 'Year', { min: 2015, max: 2100 });
  const questions = (body.questions ?? []).filter((x) => x?.text).slice(0, 10).map((x) => ({
    course_id: int(x.course_id, 'Question course', { min: 1 }), text: str(x.text, 'Question', { min: 10, max: 600 }),
    round: x.round || 'technical', difficulty: int(x.difficulty ?? 3, 'Difficulty', { min: 1, max: 5 }),
  }));
  const activities = (body.activities ?? []).filter((x) => x?.platform).slice(0, 10).map((x) => ({
    course_id: int(x.course_id, 'Activity course', { min: 1 }), type: str(x.type, 'Activity type', { max: 20 }),
    platform: str(x.platform, 'Platform', { max: 40 }), hours: num(x.hours ?? 0, 'Hours', { min: 0, max: 2000 }),
  }));
  return db(async (c) => {
    const r = await c.query('CALL sp_record_placement($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,NULL::int)',
      [company, role, type, pkg, year, JSON.stringify(questions), JSON.stringify(activities)]);
    return { ok: true, placement_id: r.rows[0]?.p_placement_id };
  });
});

export const dynamic = 'force-dynamic';
