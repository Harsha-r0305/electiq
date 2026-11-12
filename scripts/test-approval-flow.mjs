// End-to-end test of: Senior submits -> hidden from students -> Admin publishes -> visible to students.
// Usage: node scripts/test-approval-flow.mjs [baseUrl]   (needs seeded DB + running app)
const BASE = process.argv[2] || 'http://localhost:3000';
const PW = 'Password@123';
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
async function login(email) {
  const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PW }) });
  return r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
}
const call = async (cookie, path, method = 'GET', body) => {
  const r = await fetch(BASE + path, { method, headers: { cookie, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json().catch(() => ({})) };
};
const senior = await login('senior1@electiq.dev'), admin = await login('admin@electiq.dev'), student = await login('student1@electiq.dev');
const dash = (await call(senior, '/api/seniors/my-dashboard')).data;
const code = dash.profile?.senior_code ?? dash.senior_code ?? dash.header?.senior_code;
console.log('Senior code under test:', code, '| current status:', dash.profile?.status);

// 0. take the profile down so we start from draft
await call(admin, '/api/admin/senior-profiles', 'POST', { action: 'takedown', data: { senior_code: code, reason: 'test reset' } });
ok((await call(student, `/api/seniors/${code}`)).status === 404, 'draft profile is invisible to students');

// 1. senior tries to self-publish in every way
let r = await call(senior, '/api/seniors/my-dashboard', 'POST', { action: 'publish_direct' });
let st = (await call(senior, '/api/seniors/my-dashboard')).data.profile?.status;
ok(st !== 'published', `senior publish_direct is refused (status stays "${st}")`);
r = await call(senior, '/api/seniors/my-dashboard', 'POST', { status: 'published' });
st = (await call(senior, '/api/seniors/my-dashboard')).data.profile?.status;
ok(st !== 'published', `senior cannot force status:"published" (status "${st}")`);

// 2. senior edits headline + submits for review
await call(senior, '/api/seniors/my-dashboard', 'POST', { action: 'submit_for_review', headline: 'E2E test headline' });
st = (await call(senior, '/api/seniors/my-dashboard')).data.profile?.status;
ok(st === 'submitted', 'senior can submit for review (status "submitted")');
ok((await call(student, `/api/seniors/${code}`)).status === 404, 'submitted profile is still hidden from students');

// 3. admin sees it in the queue and publishes
const q = (await call(admin, '/api/admin/senior-profiles')).data;
ok(q.seniorProfiles?.some((p) => p.senior_code === code && p.profile_status === 'submitted'), 'admin queue lists the submission');
r = await call(admin, '/api/admin/senior-profiles', 'POST', { action: 'publish', data: { senior_code: code } });
ok(r.status === 200 && r.data.ok, 'admin publishes: ' + (r.data.message || r.data.error));

// 4. now visible to students, with the new headline
const pub = await call(student, `/api/seniors/${code}`);
ok(pub.status === 200 && pub.data.academicProfile?.headline === 'E2E test headline', 'student now sees the published profile with the senior\'s edits');
const list = (await call(student, '/api/seniors?limit=500')).data.seniors || [];
ok(list.some((s) => s.senior_code === code), 'profile appears in the Senior Explorer list');

// 5. a published senior edits text -> sent back to review automatically
await call(senior, '/api/seniors/my-dashboard', 'POST', { action: 'save_profile', headline: 'Edited after publish' });
st = (await call(senior, '/api/seniors/my-dashboard')).data.profile?.status;
ok(st === 'submitted', 'editing a published profile triggers re-approval');
ok((await call(student, `/api/seniors/${code}`)).status === 404, 'edited profile is hidden until admin re-approves');
await call(admin, '/api/admin/senior-profiles', 'POST', { action: 'publish', data: { senior_code: code } });

// 6. admin refuses to publish a draft
await call(admin, '/api/admin/senior-profiles', 'POST', { action: 'takedown', data: { senior_code: code, reason: 'test' } });
r = await call(admin, '/api/admin/senior-profiles', 'POST', { action: 'publish', data: { senior_code: code } });
ok(r.status === 400, 'admin cannot publish a draft the senior never submitted');

// 7. faculty input is advisory: it must never hide or publish a live profile
const faculty = await login('faculty1@electiq.dev');
await call(senior, '/api/seniors/my-dashboard', 'POST', { action: 'submit_for_review' });
await call(admin, '/api/admin/senior-profiles', 'POST', { action: 'publish', data: { senior_code: code } });
const sidRow = (await call(faculty, '/api/faculty/review')).data;
const sid = (sidRow.profiles || sidRow.seniorProfiles || []).find((p) => p.senior_code === code)?.student_id;
if (sid) {
  await call(faculty, '/api/faculty/review', 'POST', { action: 'endorse_profile', studentId: sid, notes: 'looks good' });
  await call(faculty, '/api/faculty/review', 'POST', { action: 'request_changes_profile', studentId: sid, notes: 'please fix typos' });
  ok((await call(student, `/api/seniors/${code}`)).status === 200, 'faculty endorse / request-changes does not hide a published profile');
} else console.log('SKIP faculty test (profile not in faculty queue payload)');

// restore for other tests
await call(senior, '/api/seniors/my-dashboard', 'POST', { action: 'submit_for_review' });
await call(admin, '/api/admin/senior-profiles', 'POST', { action: 'publish', data: { senior_code: code } });
console.log(fails ? `\n${fails} FAILED` : '\nAll approval-flow checks passed');
process.exit(fails ? 1 : 0);
