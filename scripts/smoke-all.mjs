// Logs in as every role and hits every page / GET API. Usage: node scripts/smoke-all.mjs [baseUrl]
const BASE = process.argv[2] || 'http://localhost:3000';
const PW = 'Password@123';
const accounts = { student: 'student1@electiq.dev', senior: 'senior1@electiq.dev', faculty: 'faculty1@electiq.dev', admin: 'admin@electiq.dev' };
async function login(email) {
  const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PW }) });
  if (!r.ok) throw new Error(`login ${email}: ${r.status} ${await r.text()}`);
  return r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
}
const common = ['/api/auth/me', '/api/courses', '/api/courses/1', '/api/courses/1/feedback', '/api/courses/1/mindmap', '/api/departments', '/api/lookups',
  '/api/compare?ids=1,2', '/api/career', '/api/market-trends', '/api/recommendations', '/api/exam-questions', '/api/questions', '/api/seniors', '/api/analytics', '/api/faculty', '/api/projects', '/api/placements', '/api/feedback'];
const per = {
  student: ['/api/student/dashboard', '/api/my/enrollments', '/api/my/activity', '/api/activities'],
  senior: ['/api/seniors/my-dashboard', '/api/seniors/contributions', '/api/my/enrollments', '/api/my/activity', '/api/activities'],
  faculty: ['/api/faculty/dashboard', '/api/faculty/review'],
  admin: ['/api/admin/dashboard', '/api/admin/audit', '/api/admin/companies', '/api/admin/designer', '/api/admin/enrollments', '/api/admin/feedback', '/api/admin/graph', '/api/admin/market-data', '/api/admin/moderation', '/api/admin/senior-profiles', '/api/admin/settings', '/api/admin/users', '/api/admin/data/courses', '/api/admin/data/skills'],
};
const pages = ['/', '/courses', '/courses/1', '/compare', '/career', '/contribute', '/exam-questions', '/for-you', '/market-trends', '/questions', '/seniors', '/analytics', '/faculty', '/admin'];
let bad = 0;
for (const [role, email] of Object.entries(accounts)) {
  const cookie = await login(email);
  for (const p of [...common, ...per[role]]) {
    const r = await fetch(BASE + p, { headers: { cookie } }); const t = await r.text();
    const flag = r.status >= 500 || r.status === 404 || r.status === 401; // 400 (missing params), 403 (role rules) and 405 (POST-only) are expected here if (flag) { bad++; console.log(`[${role}] API ${r.status} ${p} :: ${t.slice(0, 140)}`); }
  }
  for (const p of pages) {
    const r = await fetch(BASE + p, { headers: { cookie }, redirect: 'manual' });
    if (r.status >= 500) { bad++; console.log(`[${role}] PAGE ${r.status} ${p}`); }
  }
}
console.log(bad ? `\n${bad} failing request(s)` : '\nAll requests OK');
process.exit(bad ? 1 : 0);
