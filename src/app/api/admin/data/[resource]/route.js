import { handler } from '@/lib/route';
import { httpError } from '@/lib/errors';
import { syncGraph } from '@/lib/graph-sync.mjs';
import { tryGraph } from '@/lib/neo.mjs';

// Generic admin CRUD over whitelisted master-data tables (INSERT / UPDATE / DELETE / SELECT).
const R = {
  courses: { pk: ['course_id'], cols: ['code', 'title', 'dept_id', 'faculty_id', 'credits', 'semester', 'level', 'is_active'], order: 'code', mirror: true },
  skills: { pk: ['skill_id'], cols: ['name', 'category'], order: 'name', mirror: true },
  job_roles: { pk: ['role_id'], cols: ['title'], order: 'title', mirror: true },
  course_skills: { pk: ['course_id', 'skill_id'], cols: ['course_id', 'skill_id', 'depth'], order: 'course_id, skill_id', mirror: true },
  role_skills: { pk: ['role_id', 'skill_id'], cols: ['role_id', 'skill_id', 'importance'], order: 'role_id, skill_id', mirror: true },
  course_prerequisites: { pk: ['course_id', 'prereq_id'], cols: ['course_id', 'prereq_id'], order: 'course_id, prereq_id', mirror: true },
  market_demand: { pk: ['demand_id'], cols: ['skill_id', 'year', 'postings_count', 'demand_score'], order: 'year DESC, skill_id' },
  companies: { pk: ['company_id'], cols: ['name', 'sector'], order: 'name' },
  resources: { pk: ['resource_id'], cols: ['course_id', 'type', 'title', 'url'], order: 'course_id, type' },
  departments: { pk: ['dept_id'], cols: ['name'], order: 'name' },
  faculty: { pk: ['faculty_id'], cols: ['dept_id', 'name', 'designation'], order: 'name' },
};
const cfg = (p) => R[p.resource] ?? (() => { throw httpError(404, 'Unknown resource.'); })();
const clean = (v) => (v === '' ? null : v);

async function resync(db, r) {
  if (!r.mirror) return {};
  const done = await tryGraph(() => db((c) => syncGraph(c)));
  return { graphSynced: done !== null };
}

export const GET = handler(['admin'], async ({ params, db }) => {
  const r = cfg(params);
  return db(async (c) => (await c.query(`SELECT * FROM ${params.resource} ORDER BY ${r.order} LIMIT 500`)).rows);
});

export const POST = handler(['admin'], async ({ params, body, db }) => {
  const r = cfg(params);
  const cols = r.cols.filter((k) => body[k] !== undefined);
  if (!cols.length) throw httpError(400, 'No values supplied.');
  await db((c) => c.query(`INSERT INTO ${params.resource}(${cols.join(',')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')})`, cols.map((k) => clean(body[k]))));
  return { ok: true, ...(await resync(db, r)) };
});

export const PUT = handler(['admin'], async ({ params, body, db }) => {
  const r = cfg(params);
  const sets = r.cols.filter((k) => body[k] !== undefined && !r.pk.includes(k));
  if (!sets.length) throw httpError(400, 'Nothing to update.');
  const vals = [...sets.map((k) => clean(body[k])), ...r.pk.map((k) => body[k])];
  const sql = `UPDATE ${params.resource} SET ${sets.map((k, i) => `${k} = $${i + 1}`).join(', ')} WHERE ${r.pk.map((k, i) => `${k} = $${sets.length + i + 1}`).join(' AND ')}`;
  const n = await db(async (c) => (await c.query(sql, vals)).rowCount);
  if (!n) throw httpError(404, 'Record not found.');
  return { ok: true, ...(await resync(db, r)) };
});

export const DELETE = handler(['admin'], async ({ params, query, body, db }) => {
  const r = cfg(params);
  const src = Object.keys(query).length ? query : body;
  const vals = r.pk.map((k) => { if (src[k] === undefined) throw httpError(400, `${k} is required.`); return src[k]; });
  const n = await db(async (c) => (await c.query(`DELETE FROM ${params.resource} WHERE ${r.pk.map((k, i) => `${k} = $${i + 1}`).join(' AND ')}`, vals)).rowCount);
  if (!n) throw httpError(404, 'Record not found.');
  return { ok: true, ...(await resync(db, r)) };
});

export const dynamic = 'force-dynamic';
