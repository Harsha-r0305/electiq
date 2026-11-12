// Item-level gate: a PUBLISHED senior adds a placement + elective feedback -> hidden until admin approves.
const BASE = process.argv[2] || 'http://localhost:3000';
let fails = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const login = async (e) => (await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: e, password: 'Password@123' }) })).headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
const call = async (cookie, path, method = 'GET', body) => { const r = await fetch(BASE + path, { method, headers: { cookie, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, data: await r.json().catch(() => ({})) }; };
const senior = await login('senior2@electiq.dev'), admin = await login('admin@electiq.dev'), student = await login('student1@electiq.dev');
const dash = (await call(senior, '/api/seniors/my-dashboard')).data;
const code = dash.header?.senior_code; const lk = (await call(senior, '/api/lookups')).data;
console.log('Senior:', code, dash.profile?.status);
const PKG = 60 + Math.floor(Math.random() * 3000) / 100; // unique per run
const studentSees = async () => ((await call(student, `/api/seniors/${code}`)).data.placements || []).some((p) => Number(p.package_lpa) === PKG);
const company = lk.companies?.[0]?.company_id, role = lk.roles?.[0]?.role_id;
let r = await call(senior, '/api/seniors/contributions', 'POST', { section: 'placement', action: 'create', data: { company_id: company, role_id: role, package_lpa: PKG, year: 2020 + Math.floor(Math.random() * 9), type: 'full_time' } });
ok(r.status === 200 && !r.data.error, 'senior adds a placement: ' + (r.data.message || r.data.error));
ok(!/live/i.test(r.data.message || ''), 'message does not claim it is live');
ok(!(await studentSees()), 'new placement is NOT visible to students while pending');
const queue = (await call(admin, '/api/admin/senior-profiles')).data.placementsQueue || [];
const pend = queue.find((p) => p.verification_status === 'pending' && Number(p.package_lpa) === PKG);
ok(!!pend, 'placement shows in admin verification queue as pending');
r = await call(admin, '/api/admin/senior-profiles', 'POST', { action: 'verify_placement', data: { placement_id: pend?.placement_id } });
ok(r.status === 200, 'admin verifies placement');
ok(await studentSees(), 'placement now visible to students');
// elective feedback
const el = (dash.submissions?.eligibleCourses?.[0] ?? dash.submissions?.feedback?.[0]);
if (el) {
  r = await call(senior, '/api/seniors/contributions', 'POST', { section: 'feedback', action: 'create', data: { course_id: el.course_id, difficulty: 2, usefulness: 5, workload: 2, review_text: 'E2E unique review text xyzzy', grade_points: 9 } });
  ok(r.status === 200 && !r.data.error, 'senior adds elective feedback: ' + (r.data.message || r.data.error));
  const seen = async () => JSON.stringify((await call(student, `/api/courses/${el.course_id}/feedback`)).data).includes('xyzzy');
  ok(!(await seen()), 'new review hidden from students while pending');
  // Profile publish must NOT automatically approve unreviewed contributions (strictly independent)
  await call(admin, '/api/admin/senior-profiles', 'POST', { action: 'publish', data: { senior_code: code } });
  ok(!(await seen()), 'review remains hidden after profile publish (independent contribution approval)');

  // Admin explicitly approves the specific feedback item in the moderation queue
  const adminDash = (await call(admin, '/api/admin/senior-profiles')).data;
  const fb = (adminDash.feedbackQueue || []).find((f) => f.review_text?.includes('xyzzy'));
  if (fb) {
    const modRes = await call(admin, '/api/admin/senior-profiles', 'POST', { action: 'moderate_feedback', data: { feedback_id: fb.feedback_id, status: 'approved' } });
    ok(modRes.status === 200, 'admin moderates and approves feedback item');
    ok(await seen(), 'review visible after dedicated admin feedback approval');
  } else {
    ok(false, 'Feedback item xyzzy not found in admin moderation queue');
  }
} else console.log('SKIP feedback test (no eligible course in payload)');
console.log(fails ? `\n${fails} FAILED` : '\nAll item-level checks passed'); process.exit(fails ? 1 : 0);
