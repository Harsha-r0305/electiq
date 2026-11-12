'use client';
import { useState } from 'react';
import { api, useApi, Loading, Notice, useAction, Pagination, fmt, lpa, Tabs } from './ui';
import SeniorProfileModal from './SeniorProfileModal';

const Sel = ({ label, value, onChange, options, placeholder = 'Select...' }) => (
  <div><label>{label}<select value={value} onChange={(e) => onChange(e.target.value)} required><option value="">{placeholder}</option>{options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label></div>
);
const Inp = ({ label, ...p }) => <div><label>{label}<input {...p} /></label></div>;

/* ==================== 4.1 Admin Overview Panel ==================== */
export function AdminOverviewPanel() {
  const dash = useApi('/api/admin/dashboard');
  const d = dash.data;

  return (
    <div>
      <Loading state={dash} />
      {d && (
        <>
          {/* System Totals */}
          <div className="grid g4" style={{ marginBottom: '1.5rem' }}>
            <div className="card stat">
              <b>{d.totals.users.student ?? 0}</b>
              <span>Students · {d.totals.users.senior ?? 0} Seniors</span>
            </div>
            <div className="card stat">
              <b>{d.totals.courses.active} / {d.totals.courses.total}</b>
              <span>Active courses · {d.totals.users.faculty ?? 0} Faculty</span>
            </div>
            <div className="card stat">
              <b>{d.totals.enrollments}</b>
              <span>Enrollments · {d.totals.feedback} Reviews</span>
            </div>
            <div className="card stat">
              <b>{d.totals.publishedSeniors}</b>
              <span>Published senior trajectories</span>
            </div>
          </div>

          {/* Senior approvals waiting for the admin (primary queue) */}
          <div className="card" style={{ marginBottom: '1.5rem', borderColor: d.pendingQueue.pendingSeniors?.length ? 'var(--amber)' : undefined }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Senior profiles awaiting your approval</h3>
              <span className="tag amber">{d.pendingQueue.pendingSeniors?.length ?? 0} pending</span>
            </div>
            <p className="small muted">Seniors' profiles, electives feedback and placements reach students only after you publish them in the <b>Senior Approvals</b> tab.</p>
            {(d.pendingQueue.pendingSeniors || []).length === 0 ? <p className="small muted">Nothing waiting for review.</p> : (
              <table>
                <thead><tr><th>Senior</th><th>Headline</th><th>Submitted</th></tr></thead>
                <tbody>
                  {d.pendingQueue.pendingSeniors.map((p) => (
                    <tr key={p.senior_code}>
                      <td><b>{p.display_name}</b> <span className="small muted">({p.senior_code})</span></td>
                      <td className="small">{p.headline || '—'}</td>
                      <td className="small">{p.submitted_at ? new Date(p.submitted_at).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pending Queue */}
          <div className="grid g2" style={{ marginBottom: '2rem' }}>
            <div className="card">
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>Flagged Reports Queue</h3>
                <span className="tag amber">{d.pendingQueue.flaggedReports.length} pending</span>
              </div>
              <p className="small muted">Reports submitted by students or faculty on misleading items.</p>
              {d.pendingQueue.flaggedReports.length === 0 ? <p className="small muted">Queue is clear.</p> : (
                <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {d.pendingQueue.flaggedReports.map((r) => (
                    <div key={r.report_id} style={{ background: 'rgba(255,255,255,0.03)', padding: '0.6rem', borderRadius: 4 }}>
                      <div className="row" style={{ justifyContent: 'space-between' }}>
                        <b>{r.content_type.toUpperCase()} #{r.content_id}</b>
                        <span className="small muted">{new Date(r.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="small" style={{ margin: '0.2rem 0' }}>{r.reason}</p>
                      <span className="small muted">Flagged by: {r.reporter_email} ({r.reporter_role})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>Senior Entity Requests</h3>
                <span className="tag blue">{d.pendingQueue.entityRequests.length} pending</span>
              </div>
              <p className="small muted">Requests from seniors to register new recruiting companies or skills.</p>
              {d.pendingQueue.entityRequests.length === 0 ? <p className="small muted">No requests pending.</p> : (
                <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {d.pendingQueue.entityRequests.map((eq) => (
                    <div key={eq.request_id} style={{ background: 'rgba(255,255,255,0.03)', padding: '0.6rem', borderRadius: 4 }}>
                      <div className="row" style={{ justifyContent: 'space-between' }}>
                        <b>New {eq.type}: {eq.name}</b>
                        <span className="tag small">{eq.senior_code || 'Senior'}</span>
                      </div>
                      <p className="small" style={{ margin: '0.2rem 0' }}>{eq.details || 'No additional domain details'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Department Dashboard */}
          <h2>Department Dashboard (v_department_dashboard)</h2>
          <div className="tablewrap" style={{ marginBottom: '2rem' }}>
            <table>
              <thead>
                <tr>
                  <th>Department</th>
                  <th className="num">Students</th>
                  <th className="num">Courses</th>
                  <th className="num">Enrollments</th>
                  <th className="num">Average Grade</th>
                  <th className="num">Placements</th>
                  <th className="num">Average Package</th>
                </tr>
              </thead>
              <tbody>
                {d.departments.map((dept) => (
                  <tr key={dept.dept_id}>
                    <td><b>{dept.department}</b></td>
                    <td className="num">{dept.students}</td>
                    <td className="num">{dept.courses}</td>
                    <td className="num">{dept.enrollments}</td>
                    <td className="num"><b>{fmt(dept.avg_grade, 2)}</b> / 10</td>
                    <td className="num">{dept.fulltime_placements}</td>
                    <td className="num"><b>{lpa(dept.avg_package)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Graph Sync Status & Recent Audit Trail */}
          <div className="grid g2" style={{ marginBottom: '2rem' }}>
            <div className="card">
              <h3>Graph Database Status</h3>
              {d.graphSync.reachable ? (
                <>
                  <p className="small muted">
                    PostgreSQL courses: <b>{d.graphSync.pgCourses}</b> · Neo4j courses: <b>{d.graphSync.neoCourses}</b>
                  </p>
                  {d.graphSync.mismatch ? (
                    <Notice warn="Course counts differ between PostgreSQL and Neo4j. Run the graph sync from the Skill Graph tab." />
                  ) : (
                    <p className="small" style={{ color: 'var(--teal)' }}>✓ Neo4j is connected and course counts match.</p>
                  )}
                </>
              ) : (
                <p className="small muted">
                  Neo4j is not connected, so skill relationships use the built-in PostgreSQL fallback. Everything keeps working; start Neo4j and run the sync to enable graph queries.
                </p>
              )}
            </div>

            <div className="card">
              <h3>Recent Audit Log Entries</h3>
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                <table>
                  <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Table</th></tr></thead>
                  <tbody>
                    {d.recentAudit.map((a) => (
                      <tr key={a.log_id}>
                        <td className="small">{new Date(a.logged_at).toLocaleTimeString()}</td>
                        <td>{a.user_email || (a.user_id ? `User #${a.user_id}` : 'System')}</td>
                        <td><span className="tag small">{a.action}</span></td>
                        <td>{a.table_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ==================== 4.3 Enrollments and Grades ==================== */
export function GradesPanel() {
  const [status, setStatus] = useState('enrolled');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const list = useApi(`/api/admin/enrollments?status=${status}&q=${encodeURIComponent(q)}&page=${page}&limit=15`);
  const lookups = useApi('/api/lookups');
  const [grades, setGrades] = useState({});
  const [s, run] = useAction();
  const [nf, setNf] = useState({ srn: '', course_id: '', term: '2026-ODD' });
  const items = Array.isArray(list.data) ? list.data : (list.data?.rows ?? []);

  return (
    <div>
      <Notice error={s.error} ok={s.ok} />
      <form className="card row" onSubmit={(e) => { e.preventDefault(); run(async () => { await api('/api/admin/enrollments', { method: 'POST', body: nf }); list.reload(); }, 'Enrollment created.'); }}>
        <Inp label="Student SRN" required value={nf.srn} onChange={(e) => setNf({ ...nf, srn: e.target.value })} />
        <Sel label="Course" value={nf.course_id} onChange={(v) => setNf({ ...nf, course_id: v })} options={(lookups.data?.courses ?? []).map((c) => [c.course_id, c.title])} />
        <Inp label="Term" required value={nf.term} onChange={(e) => setNf({ ...nf, term: e.target.value })} />
        <div className="shrink"><button className="btn">Enroll student</button></div>
      </form>
      <div className="row" style={{ margin: '1rem 0' }}>
        <div><label>Show<select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="enrolled">Waiting for a grade</option><option value="completed">Graded</option><option value="">All</option></select></label></div>
        <Inp label="Search student or course" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
      </div>
      <Loading state={list} />
      {items.length > 0 && (
        <div className="tablewrap">
          <table>
            <thead><tr><th>Student</th><th>Course</th><th>Term</th><th>Status</th><th className="num">Grade</th><th></th></tr></thead>
            <tbody>{items.map((e) => (<tr key={e.enrollment_id}><td>{e.name}<div className="small muted">{e.srn}</div></td><td>{e.title}</td><td>{e.term}</td><td>{e.status}</td>
              <td className="num"><input style={{ width: 80 }} type="number" step="0.5" min="0" max="10" placeholder={e.grade_points ?? '0-10'} value={grades[e.enrollment_id] ?? ''} onChange={(ev) => setGrades({ ...grades, [e.enrollment_id]: ev.target.value })} aria-label={`Grade for ${e.name}`} /></td>
              <td><button className="btn small" onClick={() => run(async () => { await api('/api/admin/grade', { method: 'POST', body: { enrollment_id: e.enrollment_id, grade: grades[e.enrollment_id] } }); setGrades({ ...grades, [e.enrollment_id]: '' }); list.reload(); }, 'Grade posted via sp_post_grade with row lock.')}>{e.grade_points === null ? 'Post grade' : 'Correct grade'}</button>{' '}
                <button className="btn danger small" onClick={() => confirm('Delete this enrollment?') && run(async () => { await api(`/api/admin/enrollments?id=${e.enrollment_id}`, { method: 'DELETE' }); list.reload(); }, 'Enrollment deleted.')}>Drop</button></td></tr>))}</tbody>
          </table>
        </div>
      )}
      {list.data && <Pagination page={list.data.page ?? page} totalPages={list.data.pages ?? 1} onPageChange={setPage} />}
    </div>
  );
}

/* ==================== 4.2 Companies Management (Tier 1/2/3 & Merge) ==================== */
export function CompaniesPanel() {
  const companiesApi = useApi('/api/admin/companies');
  const [s, run] = useAction();
  const [nc, setNc] = useState({ name: '', sector: 'Technology', tier: 2 });
  const [merge, setMerge] = useState({ keep_company_id: '', duplicate_company_id: '' });
  const companies = companiesApi.data || [];

  return (
    <div>
      <Notice error={s.error} ok={s.ok} />

      {/* Add Company with Tier */}
      <form className="card" onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          await api('/api/admin/companies', { method: 'POST', body: { action: 'create', data: nc } });
          setNc({ name: '', sector: 'Technology', tier: 2 });
          companiesApi.reload();
        }, 'Company added.');
      }}>
        <h3>Add recruiting company</h3>
        <p className="small muted">Assign company tier 1 / 2 / 3 to categorize recruiting companies for senior explorer.</p>
        <div className="row">
          <Inp label="Company name" required value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} />
          <Inp label="Industry sector" required value={nc.sector} onChange={(e) => setNc({ ...nc, sector: e.target.value })} />
          <Sel label="Company Tier" value={nc.tier} onChange={(v) => setNc({ ...nc, tier: parseInt(v, 10) })} options={[[1, 'Tier 1 (FAANG / Core Product)'], [2, 'Tier 2 (Growth Tech / Unicorns)'], [3, 'Tier 3 (IT Services / Enterprise)']]} />
          <div className="shrink"><button className="btn">Add company</button></div>
        </div>
      </form>

      {/* Merge Duplicate Companies Tool (e.g. TCS and Tata Consultancy) */}
      <form className="card" style={{ marginTop: '1.5rem', background: 'rgba(237, 137, 54, 0.05)', borderColor: 'var(--amber)' }} onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          await api('/api/admin/companies', { method: 'POST', body: { action: 'merge', data: merge } });
          setMerge({ keep_company_id: '', duplicate_company_id: '' });
          companiesApi.reload();
        }, 'Companies merged and duplicate record cleanly eliminated.');
      }}>
        <h3>Merge duplicate companies</h3>
        <p className="small muted">
          Merge duplicates (e.g. &ldquo;TCS&rdquo; and &ldquo;Tata Consultancy&rdquo;). All placements will be safely re-linked to the target company.
        </p>
        <div className="row">
          <Sel label="Company to keep (canonical)" value={merge.keep_company_id} onChange={(v) => setMerge({ ...merge, keep_company_id: v })} options={companies.map((c) => [c.company_id, `${c.name} (Tier ${c.tier || 2})`])} />
          <Sel label="Duplicate to eliminate" value={merge.duplicate_company_id} onChange={(v) => setMerge({ ...merge, duplicate_company_id: v })} options={companies.map((c) => [c.company_id, `${c.name} (Tier ${c.tier || 2})`])} />
          <div className="shrink"><button className="btn danger">Merge duplicates</button></div>
        </div>
      </form>

      {/* Companies Table */}
      <h3 style={{ marginTop: '1.5rem' }}>Registered companies ({companies.length})</h3>
      <Loading state={companiesApi} />
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Company Name</th>
              <th>Sector</th>
              <th>Assigned Tier</th>
              <th className="num">Placements</th>
              <th className="num">Avg Package</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.company_id}>
                <td><b>{c.name}</b></td>
                <td>{c.sector}</td>
                <td>
                  <span className={`tag ${c.tier === 1 ? 'green' : c.tier === 2 ? 'blue' : 'grey'}`}>
                    Tier {c.tier || 2}
                  </span>
                </td>
                <td className="num">{c.placement_count}</td>
                <td className="num">{lpa(c.avg_package)}</td>
                <td>
                  <button className="btn ghost small" onClick={() => {
                    const newTier = prompt(`Enter new tier (1, 2, or 3) for ${c.name}:`, c.tier || 2);
                    if (newTier && ['1', '2', '3'].includes(newTier)) {
                      run(async () => {
                        await api('/api/admin/companies', {
                          method: 'POST',
                          body: { action: 'update', data: { company_id: c.company_id, name: c.name, sector: c.sector, tier: parseInt(newTier, 10) } }
                        });
                        companiesApi.reload();
                      }, 'Tier updated.');
                    }
                  }}>
                    Change tier
                  </button>{' '}
                  <button className="btn danger small" onClick={() => confirm(`Delete company ${c.name}?`) && run(async () => {
                    await api('/api/admin/companies', { method: 'POST', body: { action: 'delete', data: { company_id: c.company_id } } });
                    companiesApi.reload();
                  }, 'Company deleted.')}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ==================== 4.5 Senior Profile Management ==================== */
export function SeniorProfilesPanel() {
  const adminSeniorApi = useApi('/api/admin/senior-profiles');
  const [s, run] = useAction();
  const [activeQueue, setActiveQueue] = useState('profiles');
  const [inspectSeniorCode, setInspectSeniorCode] = useState(null);

  const d = adminSeniorApi.data;
  const metrics = d?.metrics || {};
  const profiles = d?.seniorProfiles || [];
  const placements = d?.placementsQueue || [];
  const feedbackList = d?.feedbackQueue || [];
  const questionsList = d?.questionsQueue || [];
  const historyList = d?.moderationHistory || [];
  const requests = d?.entityRequests || [];
  const tiers = d?.packageTiers || [];

  return (
    <div>
      <Notice error={s.error} ok={s.ok} />
      <Loading state={adminSeniorApi} />

      {/* Overview Metrics Bar */}
      <div className="card" style={{ marginBottom: '1.5rem', borderTop: '4px solid var(--blue-deep, #0284c7)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800 }}>Senior Profiles &amp; Placement Verification Center</h2>
            <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
              Verify official CTC packages, approve graduating senior profiles, and moderate student cohort contributions.
            </p>
          </div>
          <button
            type="button"
            className="btn ghost small"
            onClick={() => adminSeniorApi.reload()}
          >
            Refresh Queues
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem' }}>
          <div style={{ padding: '0.75rem 1rem', borderRadius: 8, background: '#fef3c7', border: '1px solid #fde68a' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase' }}>Awaiting Your Approval</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#b45309', marginTop: '0.15rem' }}>
              {Number(metrics.submitted_count || 0) + Number(metrics.faculty_approved_count || 0)}
            </div>
          </div>
          <div style={{ padding: '0.75rem 1rem', borderRadius: 8, background: '#e0f2fe', border: '1px solid #bae6fd' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase' }}>Faculty Endorsed</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0284c7', marginTop: '0.15rem' }}>
              {metrics.faculty_approved_count || 0}
            </div>
          </div>
          <div style={{ padding: '0.75rem 1rem', borderRadius: 8, background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#065f46', textTransform: 'uppercase' }}>Published Live</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#059669', marginTop: '0.15rem' }}>
              {metrics.published_count || 0}
            </div>
          </div>
          <div style={{ padding: '0.75rem 1rem', borderRadius: 8, background: '#fff1f2', border: '1px solid #fecdd3' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9f1239', textTransform: 'uppercase' }}>Pending Placements</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#e11d48', marginTop: '0.15rem' }}>
              {metrics.pending_placements_count || 0}
            </div>
          </div>
          <div style={{ padding: '0.75rem 1rem', borderRadius: 8, background: '#f5f3ff', border: '1px solid #ddd6fe' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6d28d9', textTransform: 'uppercase' }}>Pending Feedback</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#7c3aed', marginTop: '0.15rem' }}>
              {metrics.pending_feedback_count || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Queue Switcher Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
        <button
          type="button"
          className={`btn ${activeQueue === 'profiles' ? 'primary' : 'ghost'} small`}
          onClick={() => setActiveQueue('profiles')}
        >
          Profile Approval Queue ({profiles.length})
        </button>
        <button
          type="button"
          className={`btn ${activeQueue === 'placements' ? 'primary' : 'ghost'} small`}
          onClick={() => setActiveQueue('placements')}
        >
          Dedicated Placement Verification ({placements.length})
        </button>
        <button
          type="button"
          className={`btn ${activeQueue === 'feedback' ? 'primary' : 'ghost'} small`}
          onClick={() => setActiveQueue('feedback')}
        >
          Feedback Moderation ({feedbackList.length})
        </button>
        <button
          type="button"
          className={`btn ${activeQueue === 'questions' ? 'primary' : 'ghost'} small`}
          onClick={() => setActiveQueue('questions')}
        >
          Exam Questions ({questionsList.length})
        </button>
        <button
          type="button"
          className={`btn ${activeQueue === 'requests' ? 'primary' : 'ghost'} small`}
          onClick={() => setActiveQueue('requests')}
        >
          Catalog Requests ({requests.length})
        </button>
        <button
          type="button"
          className={`btn ${activeQueue === 'history' ? 'primary' : 'ghost'} small`}
          onClick={() => setActiveQueue('history')}
        >
          Audit Trail ({historyList.length})
        </button>
      </div>

      {/* 1. Profile Approval Queue */}
      {activeQueue === 'profiles' && (
        <div className="card">
          <h3 style={{ margin: '0 0 1rem 0' }}>Profile Approval &amp; Publication Queue ({profiles.length})</h3>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Senior</th>
                  <th>Department &amp; Batch</th>
                  <th className="num">CGPA</th>
                  <th>Highest Placement Offer</th>
                  <th>Pending Items</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((sp) => (
                  <tr key={sp.student_id}>
                    <td>
                      <b>#{sp.senior_code}</b>
                      <div style={{ fontSize: '0.85rem', color: '#334155' }}>{sp.student_name}</div>
                      <div className="muted" style={{ fontSize: '0.78rem' }}>SRN: {sp.srn}</div>
                    </td>
                    <td>
                      <div>{sp.dept_name}</div>
                      <div className="muted" style={{ fontSize: '0.78rem' }}>Class of {sp.batch_year}</div>
                    </td>
                    <td className="num">
                      <b style={{ color: '#059669', fontSize: '1rem' }}>{fmt(sp.cgpa, 2)}</b>
                    </td>
                    <td>
                      {sp.company_name ? (
                        <div>
                          <b>{sp.company_name}</b> {sp.package_lpa && <span style={{ color: '#0284c7', fontWeight: 700 }}>({lpa(sp.package_lpa)})</span>}
                          <div className="muted" style={{ fontSize: '0.78rem' }}>{sp.role_title}</div>
                          <span className={`tag small ${sp.verification_status === 'verified' ? 'green' : 'amber'}`}>
                            {sp.verification_status || 'pending'}
                          </span>
                        </div>
                      ) : (
                        <span className="muted">No offer recorded</span>
                      )}
                    </td>
                    <td>
                      {Number(sp.pending_items) > 0 ? (
                        <span className="tag amber small">{sp.pending_items} awaiting approval</span>
                      ) : (
                        <span className="muted" style={{ fontSize: '0.8rem' }}>None</span>
                      )}
                      {sp.faculty_notes && (
                        <div style={{ fontSize: '0.78rem', color: '#0369a1', maxWidth: 200, marginTop: 4 }}>Faculty note: &ldquo;{sp.faculty_notes}&rdquo;</div>
                      )}
                    </td>
                    <td>
                      <span
                        className={`tag ${
                          sp.profile_status === 'published' ? 'green' :
                          sp.profile_status === 'faculty_approved' ? 'blue' :
                          sp.profile_status === 'submitted' ? 'amber' : 'red'
                        }`}
                      >
                        {sp.profile_status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <button
                          type="button"
                          className="btn ghost small"
                          onClick={() => setInspectSeniorCode(sp.senior_code)}
                          style={{ padding: '0.25rem 0.55rem', fontSize: '0.78rem' }}
                        >
                          Inspect Full Profile
                        </button>
                        {(['submitted', 'under_review', 'faculty_approved'].includes(sp.profile_status) || (sp.profile_status === 'published' && Number(sp.pending_items) > 0)) && (
                          <button
                            type="button"
                            className="btn small"
                            onClick={() => run(async () => {
                              await api('/api/admin/senior-profiles', {
                                method: 'POST',
                                body: { action: 'publish', data: { senior_code: sp.senior_code } }
                              });
                              adminSeniorApi.reload();
                            }, `${sp.senior_code} approved: it is now visible on the Student Dashboard.`)}
                            style={{ padding: '0.25rem 0.55rem', fontSize: '0.78rem', background: '#059669', color: '#fff', border: 'none' }}
                          >
                            {sp.profile_status === 'published' ? `Approve ${sp.pending_items} pending item(s)` : <>Approve &amp; Publish &rarr;</>}
                          </button>
                        )}
                        {sp.profile_status === 'published' && (
                          <button
                            type="button"
                            className="btn danger ghost small"
                            onClick={() => {
                              const reason = prompt('Mandatory reason for unpublishing (takedown):', 'Profile revision requested by department administration.');
                              if (reason) {
                                run(async () => {
                                  await api('/api/admin/senior-profiles', {
                                    method: 'POST',
                                    body: { action: 'takedown', data: { senior_code: sp.senior_code, reason } }
                                  });
                                  adminSeniorApi.reload();
                                }, 'Profile reverted to draft mode.');
                              }
                            }}
                            style={{ padding: '0.25rem 0.55rem', fontSize: '0.78rem' }}
                          >
                            Takedown to Draft
                          </button>
                        )}
                        {sp.profile_status !== 'changes_requested' && sp.profile_status !== 'published' && (
                          <button
                            type="button"
                            className="btn danger ghost small"
                            onClick={() => {
                              const reason = prompt(`Correction notes for Senior #${sp.senior_code}:`, 'Please revise offer letter evidence and detailed preparation strategy.');
                              if (reason) {
                                run(async () => {
                                  await api('/api/admin/senior-profiles', {
                                    method: 'POST',
                                    body: { action: 'request_changes_profile', data: { senior_code: sp.senior_code, reason } }
                                  });
                                  adminSeniorApi.reload();
                                }, 'Correction request sent.');
                              }
                            }}
                            style={{ padding: '0.25rem 0.55rem', fontSize: '0.78rem' }}
                          >
                            Request Changes
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. Dedicated Placement Verification Queue */}
      {activeQueue === 'placements' && (
        <div className="card">
          <h3 style={{ margin: '0 0 1rem 0' }}>Dedicated Placement &amp; Salary Package Verification ({placements.length})</h3>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Senior / Candidate</th>
                  <th>Company &amp; Role</th>
                  <th className="num">Package LPA</th>
                  <th>Hiring Details</th>
                  <th>Verification Evidence</th>
                  <th>Status</th>
                  <th>Verification Actions</th>
                </tr>
              </thead>
              <tbody>
                {placements.map((p) => (
                  <tr key={p.placement_id}>
                    <td>
                      <b>#{p.senior_code}</b>
                      <div style={{ fontSize: '0.85rem' }}>{p.student_name}</div>
                      <div className="muted" style={{ fontSize: '0.78rem' }}>{p.dept_name} &bull; {p.srn}</div>
                    </td>
                    <td>
                      <b>{p.company_name}</b>
                      <div className="muted" style={{ fontSize: '0.85rem' }}>{p.role_title}</div>
                      <span className="tag small">{p.type}</span>
                    </td>
                    <td className="num">
                      <b style={{ fontSize: '1.1rem', color: '#059669' }}>{lpa(p.package_lpa)}</b>
                    </td>
                    <td>
                      <div>Location: {p.location || 'Bengaluru'}</div>
                      <div className="muted" style={{ fontSize: '0.78rem' }}>Mode: {p.placement_mode} {p.ppo_received ? '· PPO' : ''}</div>
                    </td>
                    <td>
                      <div style={{ maxWidth: 220, fontSize: '0.82rem', color: '#1e293b', background: '#f8fafc', padding: '0.4rem 0.6rem', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                        {p.evidence_text || 'Placement cell offer letter on record.'}
                      </div>
                    </td>
                    <td>
                      <span className={`tag ${p.verification_status === 'verified' ? 'green' : p.verification_status === 'pending' ? 'amber' : 'red'}`}>
                        {p.verification_status || 'pending'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {p.verification_status !== 'verified' && (
                          <button
                            type="button"
                            className="btn small"
                            onClick={() => run(async () => {
                              await api('/api/admin/senior-profiles', {
                                method: 'POST',
                                body: {
                                  action: 'verify_placement',
                                  data: { placement_id: p.placement_id, notes: 'Verified against university placement records.' }
                                }
                              });
                              adminSeniorApi.reload();
                            }, `Verified ${lpa(p.package_lpa)} offer at ${p.company_name}!`)}
                            style={{ background: '#059669', color: '#fff', border: 'none', padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}
                          >
                            Verify Package &rarr;
                          </button>
                        )}
                        {p.verification_status !== 'rejected' && (
                          <button
                            type="button"
                            className="btn danger small"
                            onClick={() => {
                              const reason = prompt('Reason for rejecting placement offer:', 'Offer documentation unverified.');
                              if (reason) {
                                run(async () => {
                                  await api('/api/admin/senior-profiles', {
                                    method: 'POST',
                                    body: { action: 'reject_placement', data: { placement_id: p.placement_id, reason } }
                                  });
                                  adminSeniorApi.reload();
                                }, 'Placement offer rejected.');
                              }
                            }}
                            style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}
                          >
                            Reject Offer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Feedback Moderation Queue */}
      {activeQueue === 'feedback' && (
        <div className="card">
          <h3 style={{ margin: '0 0 1rem 0' }}>Elective Course Feedback Moderation ({feedbackList.length})</h3>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Senior</th>
                  <th className="num">Ratings</th>
                  <th>Review Text</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {feedbackList.map((fb) => (
                  <tr key={fb.feedback_id}>
                    <td><b>{fb.elective_name}</b></td>
                    <td>#{fb.senior_code} ({fb.student_name})</td>
                    <td className="num">
                      <div>Diff: <b>{fb.difficulty}/5</b></div>
                      <div style={{ color: '#059669' }}>Use: <b>{fb.usefulness}/5</b></div>
                    </td>
                    <td>
                      <p style={{ margin: 0, fontSize: '0.86rem', maxWidth: 280 }}>&ldquo;{fb.review_text}&rdquo;</p>
                    </td>
                    <td><span className={`tag ${fb.moderation_status === 'approved' ? 'green' : 'amber'}`}>{fb.moderation_status}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        {fb.moderation_status !== 'approved' && (
                          <button
                            type="button"
                            className="btn small"
                            onClick={() => run(async () => {
                              await api('/api/admin/senior-profiles', {
                                method: 'POST',
                                body: { action: 'moderate_feedback', data: { feedback_id: fb.feedback_id, status: 'approved' } }
                              });
                              adminSeniorApi.reload();
                            }, 'Feedback approved.')}
                            style={{ background: '#059669', color: '#fff', border: 'none', padding: '0.25rem 0.55rem', fontSize: '0.78rem' }}
                          >
                            Approve
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn danger small"
                          onClick={() => run(async () => {
                            await api('/api/admin/senior-profiles', {
                              method: 'POST',
                              body: { action: 'moderate_feedback', data: { feedback_id: fb.feedback_id, status: 'rejected' } }
                            });
                            adminSeniorApi.reload();
                          }, 'Feedback rejected.')}
                          style={{ padding: '0.25rem 0.55rem', fontSize: '0.78rem' }}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Exam Questions Queue */}
      {activeQueue === 'questions' && (
        <div className="card">
          <h3 style={{ margin: '0 0 1rem 0' }}>Examination Questions Moderation ({questionsList.length})</h3>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Contributor</th>
                  <th>Type &amp; Marks</th>
                  <th>Question &amp; Answer</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {questionsList.map((eq) => (
                  <tr key={eq.exam_question_id}>
                    <td><b>{eq.elective_name}</b></td>
                    <td>#{eq.senior_code} ({eq.contributor_name})</td>
                    <td><span className="tag blue">{eq.exam_type}</span> {eq.marks}m</td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.86rem', maxWidth: 300 }}>Q: {eq.question_text}</div>
                      {eq.answer_text && <div className="muted" style={{ fontSize: '0.78rem', maxWidth: 300 }}>Ans: {eq.answer_text.slice(0, 100)}…</div>}
                    </td>
                    <td><span className={`tag ${eq.status === 'approved' ? 'green' : 'amber'}`}>{eq.status}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        {eq.status !== 'approved' && (
                          <button
                            type="button"
                            className="btn small"
                            onClick={() => run(async () => {
                              await api('/api/admin/senior-profiles', {
                                method: 'POST',
                                body: { action: 'moderate_exam_question', data: { question_id: eq.exam_question_id, status: 'approved' } }
                              });
                              adminSeniorApi.reload();
                            }, 'Question approved.')}
                            style={{ background: '#059669', color: '#fff', border: 'none', padding: '0.25rem 0.55rem', fontSize: '0.78rem' }}
                          >
                            Approve
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn danger small"
                          onClick={() => run(async () => {
                            await api('/api/admin/senior-profiles', {
                              method: 'POST',
                              body: { action: 'moderate_exam_question', data: { question_id: eq.exam_question_id, status: 'rejected' } }
                            });
                            adminSeniorApi.reload();
                          }, 'Question rejected.')}
                          style={{ padding: '0.25rem 0.55rem', fontSize: '0.78rem' }}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Senior Entity Requests */}
      {activeQueue === 'requests' && (
        <div className="card">
          <h3 style={{ margin: '0 0 1rem 0' }}>Company and Skill Requests from Seniors</h3>
          {requests.length === 0 ? <p className="small muted">No requests pending.</p> : (
            <div className="tablewrap">
              <table>
                <thead><tr><th>Type</th><th>Requested Name</th><th>Details</th><th>Submitted By</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.request_id}>
                      <td><span className="tag">{r.type}</span></td>
                      <td><b>{r.name}</b></td>
                      <td>{r.details || '-'}</td>
                      <td>{r.senior_code} ({r.student_name})</td>
                      <td><span className={`tag ${r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'red' : 'amber'}`}>{r.status}</span></td>
                      <td>
                        {r.status === 'pending' && (
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            <button className="btn small" onClick={() => run(async () => {
                              await api('/api/admin/senior-profiles', {
                                method: 'POST',
                                body: { action: 'request_decision', data: { request_id: r.request_id, status: 'approved', auto_create: true } }
                              });
                              adminSeniorApi.reload();
                            }, 'Request approved & added to catalog.')}>Approve &amp; Create</button>
                            <button className="btn danger small" onClick={() => run(async () => {
                              await api('/api/admin/senior-profiles', {
                                method: 'POST',
                                body: { action: 'request_decision', data: { request_id: r.request_id, status: 'rejected' } }
                              });
                              adminSeniorApi.reload();
                            }, 'Request rejected.')}>Reject</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 6. Audit Trail */}
      {activeQueue === 'history' && (
        <div className="card">
          <h3 style={{ margin: '0 0 1rem 0' }}>Moderation &amp; Verification Audit Log</h3>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Content Type</th>
                  <th>Action</th>
                  <th>Reason / Details</th>
                  <th>Admin / Reviewer</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {historyList.map((h, idx) => (
                  <tr key={idx}>
                    <td><span className="tag">{h.content_type}</span></td>
                    <td><b>{h.action}</b></td>
                    <td>{h.reason || '-'}</td>
                    <td>{h.admin_name || 'System Admin'}</td>
                    <td className="muted" style={{ fontSize: '0.8rem' }}>{new Date(h.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Inspect Senior Profile Modal */}
      {inspectSeniorCode && (
        <SeniorProfileModal
          seniorCode={inspectSeniorCode}
          onClose={() => setInspectSeniorCode(null)}
        />
      )}
    </div>
  );
}

/* ==================== 4.6 Moderation and Control ==================== */
export function ModerationControlPanel() {
  const modApi = useApi('/api/admin/moderation');
  const [s, run] = useAction();
  const d = modApi.data;
  const queue = d?.flaggedQueue || [];
  const history = d?.actionHistory || [];

  return (
    <div>
      <Notice error={s.error} ok={s.ok} />
      <Loading state={modApi} />

      {/* Flagged Items Queue */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3>4.6 Flagged Content Queue ({queue.length})</h3>
        <p className="small muted">
          Review reported items. In accordance with policy, review text cannot be rewritten — hide, return to senior, correct factual fields, or delete.
        </p>

        {queue.length === 0 ? <p className="small muted">No flagged items in moderation queue.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            {queue.map((item) => (
              <div key={item.report_id} className="card" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span className="tag amber">{item.content_type.toUpperCase()} #{item.content_id}</span>
                    <span className="small muted" style={{ marginLeft: '0.6rem' }}>
                      Reported by {item.reporter_email} ({item.reporter_role}) on {new Date(item.created_at).toLocaleString()}
                    </span>
                  </div>
                  <button className="btn ghost small" onClick={() => run(async () => {
                    await api('/api/admin/moderation', {
                      method: 'POST',
                      body: { action: 'dismiss_report', report_id: item.report_id, reason: 'Dismissed by admin review' }
                    });
                    modApi.reload();
                  }, 'Report dismissed.')}>Dismiss flag</button>
                </div>

                <p className="small" style={{ margin: '0.4rem 0', color: 'var(--amber)' }}>
                  <b>Report reason:</b> {item.reason}
                </p>

                {item.content && (
                  <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.6rem', borderRadius: 4, margin: '0.4rem 0' }}>
                    <p className="small muted" style={{ margin: 0 }}>Content snippet:</p>
                    <p className="small" style={{ margin: '0.2rem 0' }}>
                      {item.content.review_text || item.content.question_text || item.content.brief || `Company: ${item.content.company_name}`}
                    </p>
                  </div>
                )}

                {/* Moderation Actions Table */}
                <div className="row" style={{ gap: '0.5rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
                  <button className="btn small" onClick={() => {
                    const reason = prompt('Mandatory reason for Hide:');
                    if (reason) run(async () => {
                      await api('/api/admin/moderation', {
                        method: 'POST',
                        body: { action: 'hide', content_type: item.content_type, content_id: item.content_id, report_id: item.report_id, reason }
                      });
                      modApi.reload();
                    }, 'Item hidden from student views.');
                  }}>
                    Hide from students
                  </button>

                  <button className="btn ghost small" onClick={() => {
                    const reason = prompt('Correction message for senior ("Please correct: reason"):');
                    if (reason) run(async () => {
                      await api('/api/admin/moderation', {
                        method: 'POST',
                        body: { action: 'return', content_type: item.content_type, content_id: item.content_id, report_id: item.report_id, reason }
                      });
                      modApi.reload();
                    }, 'Returned to senior with correction prompt.');
                  }}>
                    Return to senior
                  </button>

                  <button className="btn ghost small" onClick={() => {
                    run(async () => {
                      await api('/api/admin/moderation', {
                        method: 'POST',
                        body: { action: 'verify', content_type: item.content_type, content_id: item.content_id, report_id: item.report_id, reason: 'Verified proof provided' }
                      });
                      modApi.reload();
                    }, 'Item marked as verified.');
                  }}>
                    Verify ("Verified" badge)
                  </button>

                  <button className="btn danger small" onClick={() => {
                    const reason = prompt('Mandatory reason for Delete:');
                    if (reason) run(async () => {
                      await api('/api/admin/moderation', {
                        method: 'POST',
                        body: { action: 'delete', content_type: item.content_type, content_id: item.content_id, report_id: item.report_id, reason }
                      });
                      modApi.reload();
                    }, 'Item deleted.');
                  }}>
                    Delete row
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Moderation Actions History */}
      <h3>Moderation Action History (moderation_actions)</h3>
      <div className="tablewrap">
        <table>
          <thead><tr><th>Time</th><th>Admin</th><th>Target</th><th>Action</th><th>Reason</th></tr></thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.action_id}>
                <td className="small">{new Date(h.created_at).toLocaleString()}</td>
                <td>{h.admin_email}</td>
                <td><b>{h.content_type} #{h.content_id}</b></td>
                <td><span className={`tag ${h.action === 'delete' ? 'red' : h.action === 'verify' ? 'green' : 'blue'}`}>{h.action}</span></td>
                <td>{h.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ==================== 4.7 Dashboard Designer ==================== */
export function DashboardDesignerPanel() {
  const [role, setRole] = useState('senior');
  const designerApi = useApi(`/api/admin/designer?role=${role}`);
  const [s, run] = useAction();
  const [nq, setNq] = useState({ section: 'feedback', label: '', field_key: '', custom_type: 'text', is_required: false });
  const fields = designerApi.data || [];

  return (
    <div>
      <Notice error={s.error} ok={s.ok} />
      <Loading state={designerApi} />

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3>4.7 Dashboard Designer</h3>
        <p className="small muted">
          Configure visible fields, required constraints, and custom questions per role. Hiding a field never deletes data.
        </p>
        <div className="row" style={{ alignItems: 'center', gap: '1rem' }}>
          <span>Configure role dashboard:</span>
          <button className={`btn small ${role === 'senior' ? '' : 'ghost'}`} onClick={() => setRole('senior')}>Senior Contribution Forms</button>
          <button className={`btn small ${role === 'student' ? '' : 'ghost'}`} onClick={() => setRole('student')}>Student Views</button>
          <button className={`btn small ${role === 'faculty' ? '' : 'ghost'}`} onClick={() => setRole('faculty')}>Faculty Forms</button>
        </div>
      </div>

      {/* Form Fields Configuration Table */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3>Form Fields & Visibility</h3>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Section</th>
                <th>Field Key</th>
                <th>Display Label</th>
                <th>Visible</th>
                <th>Required</th>
                <th>Order</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((f) => (
                <tr key={f.config_id}>
                  <td><span className="tag">{f.section}</span></td>
                  <td><code>{f.field_key}</code></td>
                  <td>
                    <input
                      value={f.label}
                      onChange={(e) => {
                        f.label = e.target.value;
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={f.is_visible}
                      onChange={(e) => {
                        run(async () => {
                          await api('/api/admin/designer', {
                            method: 'POST',
                            body: { action: 'update_field', config: { config_id: f.config_id, is_visible: e.target.checked } }
                          });
                          designerApi.reload();
                        }, 'Visibility updated.');
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={f.is_required}
                      onChange={(e) => {
                        run(async () => {
                          await api('/api/admin/designer', {
                            method: 'POST',
                            body: { action: 'update_field', config: { config_id: f.config_id, is_required: e.target.checked } }
                          });
                          designerApi.reload();
                        }, 'Requirement updated.');
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      style={{ width: 60 }}
                      value={f.display_order}
                      onChange={(e) => {
                        f.display_order = parseInt(e.target.value, 10);
                      }}
                    />
                  </td>
                  <td>
                    <button className="btn ghost small" onClick={() => run(async () => {
                      await api('/api/admin/designer', {
                        method: 'POST',
                        body: { action: 'update_field', config: f }
                      });
                      designerApi.reload();
                    }, 'Field saved.')}>Save</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Custom Question to Senior Forms */}
      <form className="card" onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          await api('/api/admin/designer', {
            method: 'POST',
            body: { action: 'add_custom_question', config: { ...nq, role } }
          });
          setNq({ section: 'feedback', label: '', field_key: '', custom_type: 'text', is_required: false });
          designerApi.reload();
        }, 'Custom question added.');
      }}>
        <h3>Add custom question to forms</h3>
        <p className="small muted">Add custom fields (text, number, rating, yes/no) without code deployment.</p>
        <div className="row">
          <Sel label="Target section" value={nq.section} onChange={(v) => setNq({ ...nq, section: v })} options={[['feedback', 'Course Feedback'], ['placements', 'Placements'], ['projects', 'Projects'], ['interview_prep', 'Interview Prep']]} />
          <Inp label="Question label" required placeholder="e.g. Coding round duration in minutes" value={nq.label} onChange={(e) => setNq({ ...nq, label: e.target.value })} />
          <Inp label="Field key (slug)" required placeholder="coding_duration" value={nq.field_key} onChange={(e) => setNq({ ...nq, field_key: e.target.value })} />
          <Sel label="Input type" value={nq.custom_type} onChange={(v) => setNq({ ...nq, custom_type: v })} options={[['text', 'Text'], ['number', 'Number'], ['rating', 'Rating (1-5)'], ['boolean', 'Yes / No']]} />
          <div className="shrink"><button className="btn">Add question</button></div>
        </div>
      </form>
    </div>
  );
}

/* ==================== 4.8 Market and Industry Data ==================== */
export function MarketDataPanel() {
  const marketApi = useApi('/api/admin/market-data');
  const [s, run] = useAction();
  const [rd, setRd] = useState({
    role_id: '', year: 2026, quarter: '2026-Q3', postings_count: '', demand_score: '',
    avg_salary_lpa: '', trend_indicator: 'rising', source_name: 'LinkedIn Economic Graph', source_link: 'https://economicgraph.linkedin.com'
  });
  const d = marketApi.data;
  const roles = d?.roles || [];
  const roleDemands = d?.roleDemand || [];
  const skillGaps = d?.skillGap || [];
  const facultyRatings = d?.facultyRatings || [];

  return (
    <div>
      <Notice error={s.error} ok={s.ok} />
      <Loading state={marketApi} />

      {/* Enter Role Demand (new in 4.8 with source name & link required) */}
      <form className="card" onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          await api('/api/admin/market-data', {
            method: 'POST',
            body: { action: 'save_role_demand', data: rd }
          });
          marketApi.reload();
        }, 'Role demand recorded.');
      }}>
        <h3>Record quarterly job role demand</h3>
        <p className="small muted">
          Source name and source link are strictly required for verifiable market analytics.
        </p>
        <div className="row">
          <Sel label="Job role" value={rd.role_id} onChange={(v) => setRd({ ...rd, role_id: v })} options={roles.map((r) => [r.role_id, r.title])} />
          <Inp label="Quarter" required value={rd.quarter} onChange={(e) => setRd({ ...rd, quarter: e.target.value })} />
          <Inp label="Year" type="number" required value={rd.year} onChange={(e) => setRd({ ...rd, year: e.target.value })} />
          <Inp label="Postings count" type="number" required value={rd.postings_count} onChange={(e) => setRd({ ...rd, postings_count: e.target.value })} />
          <Inp label="Demand (0-10)" type="number" step="0.1" min="0" max="10" required value={rd.demand_score} onChange={(e) => setRd({ ...rd, demand_score: e.target.value })} />
          <Inp label="Avg salary (LPA)" type="number" step="0.5" value={rd.avg_salary_lpa} onChange={(e) => setRd({ ...rd, avg_salary_lpa: e.target.value })} />
          <Sel label="Momentum" value={rd.trend_indicator} onChange={(v) => setRd({ ...rd, trend_indicator: v })} options={[['rising', 'Rising'], ['stable', 'Stable'], ['falling', 'Falling']]} />
        </div>
        <div className="row" style={{ marginTop: '0.8rem' }}>
          <div style={{ flex: 1 }}>
            <Inp label="Source name (Required)" required value={rd.source_name} onChange={(e) => setRd({ ...rd, source_name: e.target.value })} />
          </div>
          <div style={{ flex: 2 }}>
            <Inp label="Source link / URL (Required)" required type="url" value={rd.source_link} onChange={(e) => setRd({ ...rd, source_link: e.target.value })} />
          </div>
          <div className="shrink" style={{ alignSelf: 'flex-end' }}>
            <button className="btn">Save role demand</button>
          </div>
        </div>
      </form>

      {/* Role Demand Table */}
      <h3 style={{ marginTop: '1.5rem' }}>Quarterly role demands recorded ({roleDemands.length})</h3>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Role</th><th>Quarter</th><th className="num">Postings</th><th className="num">Demand</th><th className="num">Avg Salary</th><th>Trend</th><th>Source</th>
            </tr>
          </thead>
          <tbody>
            {roleDemands.map((r) => (
              <tr key={r.role_demand_id}>
                <td><b>{r.role_title}</b></td>
                <td>{r.quarter}</td>
                <td className="num">{Number(r.postings_count).toLocaleString()}</td>
                <td className="num"><b>{fmt(r.demand_score, 1)}</b> / 10</td>
                <td className="num">{lpa(r.avg_salary_lpa)}</td>
                <td><span className={`tag ${r.trend_indicator === 'rising' ? 'green' : 'blue'}`}>{r.trend_indicator}</span></td>
                <td><a href={r.source_link} target="_blank" rel="noopener noreferrer" className="small">{r.source_name}</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Faculty Course Ratings Cross-Reference */}
      <h3 style={{ marginTop: '2rem' }}>Faculty relevance & scope ratings across courses</h3>
      <div className="tablewrap">
        <table>
          <thead><tr><th>Course</th><th>Faculty Name</th><th className="num">Relevance</th><th className="num">Future Scope</th><th>Advice</th></tr></thead>
          <tbody>
            {facultyRatings.map((fr) => (
              <tr key={fr.review_id}>
                <td><b>{fr.title}</b></td>
                <td>{fr.faculty_name}</td>
                <td className="num"><b>{fr.relevance}</b>/5</td>
                <td className="num"><b>{fr.future_scope}</b>/5</td>
                <td className="small">{fr.comment || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ==================== 4.12 System Settings & Database Health ==================== */
export function SystemSettingsPanel() {
  const setApi = useApi('/api/admin/settings');
  const [s, run] = useAction();
  const d = setApi.data;
  const settings = d?.settings || {};
  const [term, setTerm] = useState('');
  const [acadYear, setAcadYear] = useState('');

  return (
    <div>
      <Notice error={s.error} ok={s.ok} />
      <Loading state={setApi} />

      {/* Academic Term & Year Settings */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3>Academic Term and Year</h3>
        <div className="row">
          <Inp label="Current academic term" placeholder={settings.current_term || '2026-ODD'} value={term} onChange={(e) => setTerm(e.target.value)} />
          <Inp label="Academic year" placeholder={settings.academic_year || '2026-2027'} value={acadYear} onChange={(e) => setAcadYear(e.target.value)} />
          <div className="shrink" style={{ alignSelf: 'flex-end' }}>
            <button className="btn" onClick={() => run(async () => {
              if (term) await api('/api/admin/settings', { method: 'POST', body: { key: 'current_term', value: term } });
              if (acadYear) await api('/api/admin/settings', { method: 'POST', body: { key: 'academic_year', value: acadYear } });
              setApi.reload();
            }, 'System settings updated.')}>Update settings</button>
          </div>
        </div>
      </div>

      {/* Data Export (CSV) for Reports */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3>Data Export (CSV) for Reports</h3>
        <p className="small muted">Export database datasets for academic reporting and analytics.</p>
        <div className="row" style={{ gap: '0.6rem', flexWrap: 'wrap' }}>
          {['courses', 'placements', 'feedback', 'skills', 'role_demand', 'v_department_dashboard', 'audit_log'].map((tbl) => (
            <button
              key={tbl}
              className="btn ghost small"
              onClick={async () => {
                const res = await api(`/api/admin/settings?export_table=${tbl}`);
                if (res?.exportData) {
                  const blob = new Blob([JSON.stringify(res.exportData, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `electiq_${tbl}_export.json`;
                  a.click();
                }
              }}
            >
              Export {tbl}
            </button>
          ))}
        </div>
      </div>

      {/* Database Health Notes (Index scan vs seq scan) */}
      <div className="card">
        <h3>Database Health: Table Scan Performance</h3>
        <p className="small muted">Evaluates index scan efficiency vs sequential scans across relational tables.</p>
        <div className="tablewrap">
          <table>
            <thead><tr><th>Table</th><th className="num">Seq Scans</th><th className="num">Index Scans</th><th className="num">Index Hit Rate</th></tr></thead>
            <tbody>
              {d?.dbHealth?.indexUsage?.map((idx) => (
                <tr key={idx.table_name}>
                  <td><code>{idx.table_name}</code></td>
                  <td className="num">{idx.seq_scan}</td>
                  <td className="num">{idx.idx_scan}</td>
                  <td className="num">
                    <span className={`tag ${idx.idx_pct > 80 ? 'green' : 'blue'}`}>
                      {idx.idx_pct ? `${idx.idx_pct}%` : 'N/A'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---------- Course resources ---------- */
function CourseResourcesSection({ lookups }) {
  const res = useApi('/api/admin/data/resources');
  const [s, run] = useAction();
  const [nr, setNr] = useState({ course_id: '', type: 'notes', title: '', url: '' });
  const L = lookups.data;
  return (
    <div className="card" style={{ marginTop: '1.5rem' }}>
      <h3>Course resources</h3>
      <p className="small muted">Add links to textbooks, video lectures, lecture notes, or practice material.</p>
      <Notice error={s.error} ok={s.ok} />
      <form onSubmit={(e) => { e.preventDefault(); run(async () => { await api('/api/admin/data/resources', { method: 'POST', body: nr }); setNr({ course_id: '', type: 'notes', title: '', url: '' }); res.reload(); }, 'Resource added.'); }}>
        <div className="row">
          <Sel label="Course" value={nr.course_id} onChange={(v) => setNr({ ...nr, course_id: v })} options={(L?.courses ?? []).map((c) => [c.course_id, c.title])} />
          <Sel label="Type" value={nr.type} onChange={(v) => setNr({ ...nr, type: v })} options={[['book', 'Book'], ['video', 'Video'], ['notes', 'Notes'], ['practice', 'Practice']]} />
          <Inp label="Title" required value={nr.title} onChange={(e) => setNr({ ...nr, title: e.target.value })} />
          <Inp label="URL" type="url" required value={nr.url} onChange={(e) => setNr({ ...nr, url: e.target.value })} />
          <div className="shrink"><button className="btn">Add resource</button></div>
        </div>
      </form>
      <Loading state={res} />
      {res.data && (
        <div style={{ maxHeight: 260, overflowY: 'auto', marginTop: '1rem' }}>
          <table>
            <thead><tr><th>Course</th><th>Type</th><th>Title</th><th>URL</th><th></th></tr></thead>
            <tbody>
              {res.data.map((r) => {
                const courseTitle = L?.courses.find((c) => c.course_id === r.course_id)?.title ?? r.course_id;
                return (
                  <tr key={r.resource_id}>
                    <td><b>{courseTitle}</b></td>
                    <td><span className="tag">{r.type}</span></td>
                    <td>{r.title}</td>
                    <td><a href={r.url} target="_blank" rel="noopener noreferrer" className="small">{r.url}</a></td>
                    <td>
                      <button className="btn danger small" onClick={() => run(async () => { await api(`/api/admin/data/resources?resource_id=${r.resource_id}`, { method: 'DELETE' }); res.reload(); }, 'Resource deleted.')}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------- Departments ---------- */
function DepartmentsSection({ lookups }) {
  const depts = useApi('/api/admin/data/departments');
  const [s, run] = useAction();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState({});
  return (
    <div className="card" style={{ marginTop: '1.5rem' }}>
      <h3>Departments</h3>
      <p className="small muted">Academic departments offering electives and programs.</p>
      <Notice error={s.error} ok={s.ok} />
      <form onSubmit={(e) => { e.preventDefault(); run(async () => { await api('/api/admin/data/departments', { method: 'POST', body: { name } }); setName(''); depts.reload(); lookups.reload(); }, 'Department created.'); }}>
        <div className="row">
          <Inp label="Department name" required value={name} onChange={(e) => setName(e.target.value)} />
          <div className="shrink"><button className="btn">Add department</button></div>
        </div>
      </form>
      <Loading state={depts} />
      {depts.data && (
        <div style={{ maxHeight: 220, overflowY: 'auto', marginTop: '1rem' }}>
          <table>
            <thead><tr><th>ID</th><th>Department Name</th><th>Actions</th></tr></thead>
            <tbody>
              {depts.data.map((d) => (
                <tr key={d.dept_id}>
                  <td style={{ width: 60 }}>{d.dept_id}</td>
                  <td>
                    <input value={editing[d.dept_id] ?? d.name} onChange={(e) => setEditing({ ...editing, [d.dept_id]: e.target.value })} />
                  </td>
                  <td style={{ width: 160 }}>
                    <button className="btn ghost small" onClick={() => run(async () => { await api('/api/admin/data/departments', { method: 'PUT', body: { dept_id: d.dept_id, name: editing[d.dept_id] ?? d.name } }); depts.reload(); lookups.reload(); }, 'Department updated.')}>Rename</button>{' '}
                    <button className="btn danger small" onClick={() => confirm(`Delete department ${d.name}?`) && run(async () => { await api(`/api/admin/data/departments?dept_id=${d.dept_id}`, { method: 'DELETE' }); depts.reload(); lookups.reload(); }, 'Department deleted.')}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------- Courses and prerequisites ---------- */
export function CoursesPanel() {
  const courses = useApi('/api/admin/data/courses');
  const prereqs = useApi('/api/admin/data/course_prerequisites');
  const lookups = useApi('/api/lookups');
  const [s, run] = useAction();
  const [nc, setNc] = useState({ code: '', title: '', dept_id: '', faculty_id: '', credits: 4, semester: 5, level: 'intermediate' });
  const [pp, setPp] = useState({ course_id: '', prereq_id: '' });
  const L = lookups.data;
  const code = (id) => L?.courses.find((c) => c.course_id === id)?.code ?? id;
  const msg = (r, t) => (r?.graphSynced === false ? `${t} Neo4j is offline: run npm run sync-graph later.` : t);
  return (
    <div>
      <Notice error={s.error} ok={s.ok} />
      <form className="card" onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await api('/api/admin/data/courses', { method: 'POST', body: nc }); courses.reload(); lookups.reload(); return r; }, (r) => msg(r, 'Course added.')); }}>
        <h3>Add a course</h3>
        <div className="row">
          <Inp label="Code" required value={nc.code} onChange={(e) => setNc({ ...nc, code: e.target.value })} />
          <Inp label="Title" required value={nc.title} onChange={(e) => setNc({ ...nc, title: e.target.value })} />
          <Sel label="Department" value={nc.dept_id} onChange={(v) => setNc({ ...nc, dept_id: v })} options={(L?.departments ?? []).map((d) => [d.dept_id, d.name])} />
          <Sel label="Faculty" value={nc.faculty_id} onChange={(v) => setNc({ ...nc, faculty_id: v })} options={(L?.faculty ?? []).map((f) => [f.faculty_id, `${f.name} (${f.designation})`])} placeholder="Select faculty (optional)..." />
          <Inp label="Credits" type="number" min="1" max="6" value={nc.credits} onChange={(e) => setNc({ ...nc, credits: e.target.value })} />
          <Inp label="Semester" type="number" min="1" max="8" value={nc.semester} onChange={(e) => setNc({ ...nc, semester: e.target.value })} />
          <Sel label="Level" value={nc.level} onChange={(v) => setNc({ ...nc, level: v })} options={[['foundation', 'Foundation'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']]} />
          <div className="shrink"><button className="btn">Add course</button></div>
        </div>
      </form>
      <form className="card" onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await api('/api/admin/data/course_prerequisites', { method: 'POST', body: pp }); prereqs.reload(); return r; }, (r) => msg(r, 'Prerequisite added.')); }}>
        <h3>Add a prerequisite</h3>
        <p className="small muted">Circular chains are rejected by a database trigger. Try adding the reverse of an existing link.</p>
        <div className="row">
          <Sel label="Course" value={pp.course_id} onChange={(v) => setPp({ ...pp, course_id: v })} options={(L?.courses ?? []).map((c) => [c.course_id, c.title])} />
          <Sel label="Requires" value={pp.prereq_id} onChange={(v) => setPp({ ...pp, prereq_id: v })} options={(L?.courses ?? []).map((c) => [c.course_id, c.title])} />
          <div className="shrink"><button className="btn">Add prerequisite</button></div>
        </div>
        <p style={{ marginTop: '.8rem' }}>{(prereqs.data ?? []).map((p) => (<span key={`${p.course_id}-${p.prereq_id}`} className="tag">{code(p.course_id)} requires {code(p.prereq_id)} <button className="link-btn" style={{ color: 'inherit' }} aria-label="Remove prerequisite" onClick={() => run(async () => { const r = await api(`/api/admin/data/course_prerequisites?course_id=${p.course_id}&prereq_id=${p.prereq_id}`, { method: 'DELETE' }); prereqs.reload(); return r; }, (r) => msg(r, 'Prerequisite removed.'))}>x</button></span>))}</p>
      </form>
      <Loading state={courses} />
      {courses.data && (<div className="tablewrap"><table><thead><tr><th>Code</th><th>Title</th><th>Faculty</th><th>Level</th><th className="num">Sem</th><th>Status</th><th></th></tr></thead>
        <tbody>{courses.data.map((c) => (<tr key={c.course_id}><td>{c.code}</td><td>{c.title}</td>
          <td>
            <select style={{ maxWidth: 170 }} value={c.faculty_id ?? ''} onChange={(e) => run(async () => { await api('/api/admin/data/courses', { method: 'PUT', body: { course_id: c.course_id, faculty_id: e.target.value || null } }); courses.reload(); lookups.reload(); }, 'Faculty assigned.')}>
              <option value="">Unassigned</option>
              {(L?.faculty ?? []).map((f) => <option key={f.faculty_id} value={f.faculty_id}>{f.name}</option>)}
            </select>
          </td>
          <td>{c.level}</td><td className="num">{c.semester}</td><td>{c.is_active ? 'Active' : 'Hidden'}</td>
          <td><button className="btn ghost small" onClick={() => run(async () => { await api('/api/admin/data/courses', { method: 'PUT', body: { course_id: c.course_id, is_active: !c.is_active } }); courses.reload(); lookups.reload(); }, 'Course updated.')}>{c.is_active ? 'Hide' : 'Show'}</button>{' '}
            <button className="btn danger small" onClick={() => confirm(`Delete ${c.code}? Enrollments and reviews for it are deleted too.`) && run(async () => { const r = await api(`/api/admin/data/courses?course_id=${c.course_id}`, { method: 'DELETE' }); courses.reload(); lookups.reload(); return r; }, (r) => msg(r, 'Course deleted.'))}>Delete</button></td></tr>))}</tbody></table></div>)}
      <CourseResourcesSection lookups={lookups} />
      <DepartmentsSection lookups={lookups} />
    </div>
  );
}

/* ---------- Skills Panel ---------- */
function LinkTable({ resource, title, aId, aLabel, aOptions, valueKey, valueLabel, valueMax, nameOf, skillName }) {
  const rows = useApi(`/api/admin/data/${resource}`);
  const [s, run] = useAction();
  const [f, setF] = useState({ [aId]: '', skill_id: '', [valueKey]: 2 });
  const skills = useApi('/api/lookups');
  return (
    <div className="card">
      <h3>{title}</h3>
      <Notice error={s.error} ok={s.ok} />
      <div className="row">
        <Sel label={aLabel} value={f[aId]} onChange={(v) => setF({ ...f, [aId]: v })} options={aOptions} />
        <Sel label="Skill" value={f.skill_id} onChange={(v) => setF({ ...f, skill_id: v })} options={(skills.data?.skills ?? []).map((k) => [k.skill_id, k.name])} />
        <Inp label={valueLabel} type="number" min="1" max={valueMax} value={f[valueKey]} onChange={(e) => setF({ ...f, [valueKey]: e.target.value })} />
        <div className="shrink"><button className="btn" onClick={() => run(async () => { const r = await api(`/api/admin/data/${resource}`, { method: 'POST', body: f }); rows.reload(); return r; }, (r) => (r?.graphSynced === false ? 'Saved. Neo4j is offline: run npm run sync-graph later.' : 'Link saved and mirrored to Neo4j.'))}>Add link</button></div>
      </div>
      <div style={{ maxHeight: 220, overflowY: 'auto', marginTop: '.8rem' }}>
        {(rows.data ?? []).map((r) => (<span key={`${r[aId]}-${r.skill_id}`} className="tag">{nameOf(r[aId])} → {skillName(r.skill_id)} ({r[valueKey]}) <button className="link-btn" style={{ color: 'inherit' }} aria-label="Remove link" onClick={() => run(async () => { const x = await api(`/api/admin/data/${resource}?${aId}=${r[aId]}&skill_id=${r.skill_id}`, { method: 'DELETE' }); rows.reload(); return x; }, 'Link removed.')}>x</button></span>))}
      </div>
    </div>
  );
}

function JobRolesSection({ lookups }) {
  const roles = useApi('/api/admin/data/job_roles');
  const [s, run] = useAction();
  const [title, setTitle] = useState('');
  const [editing, setEditing] = useState({});
  return (
    <div className="card" style={{ marginTop: '1.5rem' }}>
      <h3>Job roles</h3>
      <p className="small muted">Target roles for placements and career pathways (mirrored to Neo4j).</p>
      <Notice error={s.error} ok={s.ok} />
      <form onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await api('/api/admin/data/job_roles', { method: 'POST', body: { title } }); setTitle(''); roles.reload(); lookups.reload(); return r; }, (r) => (r?.graphSynced === false ? 'Job role created. Neo4j offline.' : 'Job role created and mirrored to Neo4j.')); }}>
        <div className="row">
          <Inp label="Role title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="shrink"><button className="btn">Add job role</button></div>
        </div>
      </form>
      <Loading state={roles} />
      {roles.data && (
        <div style={{ maxHeight: 220, overflowY: 'auto', marginTop: '1rem' }}>
          <table>
            <thead><tr><th>ID</th><th>Role Title</th><th>Actions</th></tr></thead>
            <tbody>
              {roles.data.map((r) => (
                <tr key={r.role_id}>
                  <td style={{ width: 60 }}>{r.role_id}</td>
                  <td>
                    <input value={editing[r.role_id] ?? r.title} onChange={(e) => setEditing({ ...editing, [r.role_id]: e.target.value })} />
                  </td>
                  <td style={{ width: 160 }}>
                    <button className="btn ghost small" onClick={() => run(async () => { const x = await api('/api/admin/data/job_roles', { method: 'PUT', body: { role_id: r.role_id, title: editing[r.role_id] ?? r.title } }); roles.reload(); lookups.reload(); return x; }, 'Role renamed.')}>Rename</button>{' '}
                    <button className="btn danger small" onClick={() => confirm(`Delete role ${r.title}?`) && run(async () => { const x = await api(`/api/admin/data/job_roles?role_id=${r.role_id}`, { method: 'DELETE' }); roles.reload(); lookups.reload(); return x; }, 'Role deleted.')}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function SkillsPanel() {
  const L = useApi('/api/lookups');
  const [s, run] = useAction();
  const [ns, setNs] = useState({ name: '', category: '' });
  const [md, setMd] = useState({ skill_id: '', year: 2026, postings_count: '', demand_score: '' });
  const skillName = (id) => L.data?.skills.find((k) => k.skill_id === id)?.name ?? id;
  if (!L.data) return <Loading state={L} />;
  return (
    <div>
      <Notice error={s.error} ok={s.ok} />
      <form className="card" onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await api('/api/admin/data/skills', { method: 'POST', body: ns }); L.reload(); setNs({ name: '', category: '' }); return r; }, (r) => (r?.graphSynced === false ? 'Skill added. Neo4j is offline: run npm run sync-graph later.' : 'Skill added and mirrored to Neo4j.')); }}>
        <h3>Add a skill</h3>
        <div className="row"><Inp label="Name" required value={ns.name} onChange={(e) => setNs({ ...ns, name: e.target.value })} /><Inp label="Category" required value={ns.category} onChange={(e) => setNs({ ...ns, category: e.target.value })} /><div className="shrink"><button className="btn">Add skill</button></div></div>
      </form>
      <LinkTable resource="course_skills" title="Skills taught by each course" aId="course_id" aLabel="Course" aOptions={L.data.courses.map((c) => [c.course_id, c.title])} valueKey="depth" valueLabel="Depth (1-3)" valueMax="3" nameOf={(id) => L.data.courses.find((c) => c.course_id === id)?.title ?? id} skillName={skillName} />
      <LinkTable resource="role_skills" title="Skills each job role requires" aId="role_id" aLabel="Role" aOptions={L.data.roles.map((r) => [r.role_id, r.title])} valueKey="importance" valueLabel="Importance (1-5)" valueMax="5" nameOf={(id) => L.data.roles.find((r) => r.role_id === id)?.title ?? id} skillName={skillName} />
      <form className="card" onSubmit={(e) => { e.preventDefault(); run(() => api('/api/admin/data/market_demand', { method: 'POST', body: md }), 'Market demand saved.'); }}>
        <h3>Record job-market demand</h3>
        <div className="row"><Sel label="Skill" value={md.skill_id} onChange={(v) => setMd({ ...md, skill_id: v })} options={L.data.skills.map((k) => [k.skill_id, k.name])} />
          <Inp label="Year" type="number" required value={md.year} onChange={(e) => setMd({ ...md, year: e.target.value })} />
          <Inp label="Job postings" type="number" min="0" required value={md.postings_count} onChange={(e) => setMd({ ...md, postings_count: e.target.value })} />
          <Inp label="Demand score (0-10)" type="number" step="0.1" min="0" max="10" required value={md.demand_score} onChange={(e) => setMd({ ...md, demand_score: e.target.value })} />
          <div className="shrink"><button className="btn">Save</button></div></div>
      </form>
      <JobRolesSection lookups={L} />
    </div>
  );
}

/* ---------- Neo4j Graph Panel ---------- */
export function GraphPanel() {
  const g = useApi('/api/admin/graph');
  const L = useApi('/api/lookups');
  const [s, run] = useAction();
  const [rl, setRl] = useState({ a: '', b: '', strength: 2 });
  const [cl, setCl] = useState('');
  const [mv, setMv] = useState({ skill_id: '', cluster: '' });
  const [edit, setEdit] = useState({});
  const skills = (L.data?.skills ?? []).map((k) => [k.skill_id, k.name]);
  if (g.loading) return <Loading state={g} />;
  if (g.error) return <Notice error={g.error} />;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <p className="muted" style={{ margin: 0 }}>
          Graph database synchronization for courses, skills, and prerequisite pathways.
        </p>
        <span className="tag green" style={{ fontWeight: 700 }}>
          ✓ {g.data?.mode === 'neo4j' ? 'Neo4j Bolt Active' : 'Integrated Graph Engine Active'}
        </span>
      </div>
      <Notice error={s.error} ok={s.ok} />
      <div className="row" style={{ marginBottom: '1rem' }}>
        <div className="shrink"><button className="btn" onClick={() => run(async () => { const r = await api('/api/admin/graph/sync', { method: 'POST', body: {} }); g.reload(); return r; }, (r) => `Synchronized: ${r.result.courses} courses, ${r.result.skills} skills, ${r.result.prerequisites} prerequisites.`)}>Sync from PostgreSQL</button></div>
        <div className="shrink"><button className="btn ghost" onClick={() => run(async () => { const r = await api('/api/admin/graph/sync', { method: 'POST', body: { seed: true } }); g.reload(); return r; }, 'Synchronized and seeded related links and clusters.')}>Sync and seed related links</button></div>
      </div>
      {g.data?.available && (<div className="grid g2">
        <div className="card">
          <h3>Related skills</h3>
          <div className="row"><Sel label="Skill" value={rl.a} onChange={(v) => setRl({ ...rl, a: v })} options={skills} /><Sel label="Related to" value={rl.b} onChange={(v) => setRl({ ...rl, b: v })} options={skills} /><Inp label="Strength (1-10)" type="number" min="1" max="10" value={rl.strength} onChange={(e) => setRl({ ...rl, strength: e.target.value })} /></div>
          <button className="btn small" style={{ margin: '.6rem 0' }} onClick={() => run(async () => { const r = await api('/api/admin/graph', { method: 'POST', body: { type: 'related', ...rl } }); g.reload(); return r; }, 'Related link saved.')}>Add link</button>
          <div style={{ maxHeight: 300, overflowY: 'auto' }}><table><tbody>{g.data.related.map((r) => (<tr key={`${r.a_id}-${r.b_id}`}><td>{r.a} ↔ {r.b}</td>
            <td style={{ width: 70 }}><input aria-label="Strength" type="number" min="1" max="10" value={edit[`${r.a_id}-${r.b_id}`] ?? r.strength} onChange={(e) => setEdit({ ...edit, [`${r.a_id}-${r.b_id}`]: e.target.value })} /></td>
            <td style={{ width: 140 }}><button className="btn ghost small" onClick={() => run(async () => { const x = await api('/api/admin/graph', { method: 'PUT', body: { a: r.a_id, b: r.b_id, strength: edit[`${r.a_id}-${r.b_id}`] ?? r.strength } }); g.reload(); return x; }, 'Strength updated.')}>Update</button>{' '}
              <button className="btn danger small" onClick={() => run(async () => { const x = await api(`/api/admin/graph?type=related&a=${r.a_id}&b=${r.b_id}`, { method: 'DELETE' }); g.reload(); return x; }, 'Link removed.')}>Remove</button></td></tr>))}</tbody></table></div>
        </div>
        <div className="card">
          <h3>Skill clusters</h3>
          <div className="row"><Inp label="New cluster" value={cl} onChange={(e) => setCl(e.target.value)} /><div className="shrink"><button className="btn small" onClick={() => run(async () => { const r = await api('/api/admin/graph', { method: 'POST', body: { type: 'cluster', name: cl } }); setCl(''); g.reload(); return r; }, 'Cluster created.')}>Create</button></div></div>
          <div className="row" style={{ marginTop: '.6rem' }}><Sel label="Move skill" value={mv.skill_id} onChange={(v) => setMv({ ...mv, skill_id: v })} options={skills} /><Sel label="Into cluster" value={mv.cluster} onChange={(v) => setMv({ ...mv, cluster: v })} options={g.data.clusters.map((c) => [c.name, c.name])} />
            <div className="shrink"><button className="btn small" onClick={() => run(async () => { const r = await api('/api/admin/graph', { method: 'POST', body: { type: 'in_cluster', ...mv } }); g.reload(); return r; }, 'Skill moved.')}>Move</button></div></div>
          <div style={{ maxHeight: 300, overflowY: 'auto', marginTop: '.8rem' }}>{g.data.clusters.map((c) => (<div key={c.name} className="review"><b>{c.name}</b> <button className="link-btn" style={{ color: 'var(--rose)' }} onClick={() => confirm(`Delete cluster ${c.name}?`) && run(async () => { const r = await api(`/api/admin/graph?type=cluster&name=${encodeURIComponent(c.name)}`, { method: 'DELETE' }); g.reload(); return r; }, 'Cluster deleted.')}>delete</button><br />{c.skills.map((k) => <span key={k} className="tag grey">{k}</span>)}</div>))}</div>
        </div>
      </div>)}
    </div>
  );
}

/* ==================== 4.4 Accounts ==================== */
export function AccountsPanel() {
  const users = useApi('/api/admin/users');
  const lookups = useApi('/api/lookups');
  const [s, run] = useAction();
  const [nu, setNu] = useState({ role: 'faculty', name: '', email: '', password: '', dept_id: '' });
  return (
    <div>
      <Notice error={s.error} ok={s.ok} />
      <form className="card" onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await api('/api/admin/users', { method: 'POST', body: nu }); users.reload(); return r; }, 'Account created.'); }}>
        <h3>Create a faculty or admin account</h3>
        <p className="small muted">Self-registration only creates students, so these roles can be granted only here.</p>
        <div className="row">
          <Sel label="Role" value={nu.role} onChange={(v) => setNu({ ...nu, role: v })} options={[['faculty', 'Faculty'], ['admin', 'Administrator']]} />
          <Inp label="Full name" required value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} />
          <Inp label="Email" type="email" required value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} />
          <Inp label="Temporary password" type="password" required value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} />
          {nu.role === 'faculty' && <Sel label="Department" value={nu.dept_id} onChange={(v) => setNu({ ...nu, dept_id: v })} options={(lookups.data?.departments ?? []).map((d) => [d.dept_id, d.name])} />}
          <div className="shrink"><button className="btn">Create</button></div>
        </div>
      </form>
      <Loading state={users} />
      {users.data && (<div className="tablewrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>SRN</th><th></th></tr></thead>
        <tbody>{users.data.map((u) => (<tr key={u.user_id}><td>{u.name}</td><td>{u.email}</td><td><span className={`tag ${u.role === 'admin' ? 'rose' : u.role === 'faculty' ? 'amber' : u.role === 'senior' ? 'teal' : ''}`}>{u.role}</span></td><td>{u.srn ?? '-'}</td>
          <td>{u.role === 'student' && <button className="btn ghost small" onClick={() => run(async () => { await api('/api/admin/users', { method: 'PATCH', body: { user_id: u.user_id, role: 'senior' } }); users.reload(); }, `${u.name} is now a senior. They need to sign in again.`)}>Promote to senior</button>}
            {u.role === 'senior' && <button className="btn ghost small" onClick={() => run(async () => { await api('/api/admin/users', { method: 'PATCH', body: { user_id: u.user_id, role: 'student' } }); users.reload(); }, 'Changed back to student.')}>Make student</button>}</td></tr>))}</tbody></table></div>)}
    </div>
  );
}

/* ==================== 4.11 Audit Log ==================== */
export function AuditPanel() {
  const [table, setTable] = useState('');
  const [page, setPage] = useState(1);
  const log = useApi(`/api/admin/audit?page=${page}&limit=20${table ? `&table=${table}` : ''}`);
  const items = Array.isArray(log.data) ? log.data : (log.data?.rows ?? []);
  return (
    <div>
      <p className="muted">
        4.11 Audit log viewer (read-only): user, action, table, row, old and new values, time.
        In accordance with 4.13, editing or deleting audit log rows is strictly prohibited (only SECURITY DEFINER triggers write).
      </p>
      <div className="row"><div><label>Filter by Table<select value={table} onChange={(e) => { setTable(e.target.value); setPage(1); }}><option value="">All tables</option><option>enrollments</option><option>feedback</option><option>placements</option><option>users</option></select></label></div></div>
      <Loading state={log} />
      {items.length > 0 && (<div className="tablewrap" style={{ marginTop: '1rem' }}><table><thead><tr><th>When</th><th>User</th><th>Action</th><th>Table</th><th>Row</th><th>Change</th></tr></thead>
        <tbody>{items.map((l) => (<tr key={l.log_id}><td className="small">{new Date(l.logged_at).toLocaleString()}</td><td>{l.user_id ?? 'system'}</td><td><span className="tag small">{l.action}</span></td><td>{l.table_name}</td><td>{l.row_pk}</td>
          <td className="small muted" style={{ maxWidth: 360, wordBreak: 'break-word' }}>{l.action === 'UPDATE' ? Object.keys(l.new_value).filter((k) => JSON.stringify(l.new_value[k]) !== JSON.stringify(l.old_value[k])).map((k) => `${k}: ${l.old_value[k]} → ${l.new_value[k]}`).join('; ') : (l.new_value ? 'created' : 'deleted')}</td></tr>))}</tbody></table></div>)}
      {log.data && <Pagination page={log.data.page ?? page} totalPages={log.data.pages ?? 1} onPageChange={setPage} />}
    </div>
  );
}
