import { handler } from '@/lib/route';

// Small reference lists for dropdowns
export const GET = handler(null, async ({ db }) => db(async (c) => {
  const q = async (s) => (await c.query(s)).rows;
  return {
    courses: await q('SELECT course_id, code, title, level, elective_slot, is_elective, vertical FROM courses WHERE is_active ORDER BY title'),
    electives: await q('SELECT course_id, code, title, level, elective_slot, vertical FROM courses WHERE is_active AND is_elective = true ORDER BY title'),
    core: await q('SELECT course_id, code, title, level FROM courses WHERE is_active AND is_elective = false ORDER BY title'),
    roles: await q('SELECT role_id, title FROM job_roles ORDER BY title'),
    companies: await q('SELECT company_id, name, tier FROM companies ORDER BY name'),
    skills: await q('SELECT skill_id, name, category FROM skills ORDER BY name'),
    departments: await q('SELECT dept_id, name FROM departments ORDER BY name'),
    faculty: await q('SELECT faculty_id, name, designation, dept_id FROM faculty ORDER BY name'),
  };
}));

export const dynamic = 'force-dynamic';
