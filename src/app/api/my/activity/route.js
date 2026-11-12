import { handler } from '@/lib/route';

// A senior's own placements and preparation logs (RLS: own rows only)
export const GET = handler(['senior'], async ({ db }) => db(async (c) => ({
  placements: (await c.query(
    `SELECT p.placement_id, co.name AS company, r.title AS role, p.type, p.package_lpa, p.year
       FROM placements p JOIN companies co ON co.company_id = p.company_id JOIN job_roles r ON r.role_id = p.role_id
      ORDER BY p.year DESC, p.type`)).rows,
  activities: (await c.query(
    `SELECT a.activity_id, c.code, a.type, a.platform, a.hours_spent
       FROM extra_activities a JOIN courses c ON c.course_id = a.course_id ORDER BY a.activity_id DESC`)).rows,
})));

export const dynamic = 'force-dynamic';
