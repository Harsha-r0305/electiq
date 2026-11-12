'use client';
import { useState } from 'react';
import { api, useApi, Loading, Notice, useAction, Tabs, lpa } from '@/components/ui';
import SeniorDashboard from '@/components/SeniorDashboard';

function ReviewForm({ e, onSaved }) {
  const [f, setF] = useState({ difficulty: 3, workload: 3, usefulness: 4, review_text: '' });
  const [s, run] = useAction();
  const n = (k) => (ev) => setF({ ...f, [k]: ev.target.value });
  return (
    <form className="card" onSubmit={(ev) => { ev.preventDefault(); run(async () => { await api('/api/feedback', { method: 'POST', body: { enrollment_id: e.enrollment_id, ...f } }); onSaved(); }, 'Review published anonymously.'); }}>
      <h3>{e.title} <span className="small muted">{e.term} · grade {e.grade_points ?? 'pending'}</span></h3>
      <div className="row">
        {[['difficulty', 'Difficulty'], ['workload', 'Workload'], ['usefulness', 'Usefulness']].map(([k, l]) => (
          <div key={k}><label>{l} (1-5)<input type="number" min="1" max="5" value={f[k]} onChange={n(k)} /></label></div>))}
      </div>
      <div className="field"><label>What should juniors know?<textarea value={f.review_text} onChange={n('review_text')} placeholder="Exams, projects, resources, what came up in interviews..." /></label></div>
      <Notice error={s.error} ok={s.ok} />
      <button className="btn" disabled={s.busy}>Publish review</button>
    </form>
  );
}

function PlacementForm({ lookups, onSaved }) {
  const empty = { company_id: '', role_id: '', type: 'full_time', package_lpa: '', year: new Date().getFullYear(), questions: [], activities: [] };
  const [f, setF] = useState(empty);
  const [s, run] = useAction();
  const upd = (list, i, k, v) => setF({ ...f, [list]: f[list].map((x, j) => (j === i ? { ...x, [k]: v } : x)) });
  const courses = lookups.courses ?? [];
  return (
    <form className="card" onSubmit={(ev) => { ev.preventDefault(); run(async () => { await api('/api/placements', { method: 'POST', body: f }); setF(empty); onSaved(); }, 'Saved. The placement, questions and prep logs were stored together.'); }}>
      <h3>Record a placement or internship</h3>
      <div className="row">
        <div><label>Company<select required value={f.company_id} onChange={(e) => setF({ ...f, company_id: e.target.value })}><option value="">Select...</option>{(lookups.companies ?? []).map((c) => <option key={c.company_id} value={c.company_id}>{c.name}</option>)}</select></label></div>
        <div><label>Role<select required value={f.role_id} onChange={(e) => setF({ ...f, role_id: e.target.value })}><option value="">Select...</option>{(lookups.roles ?? []).map((c) => <option key={c.role_id} value={c.role_id}>{c.title}</option>)}</select></label></div>
        <div><label>Type<select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="full_time">Full-time</option><option value="internship">Internship</option></select></label></div>
        <div><label>Package (LPA)<input required type="number" step="0.25" min="0.25" value={f.package_lpa} onChange={(e) => setF({ ...f, package_lpa: e.target.value })} /></label></div>
        <div><label>Year<input required type="number" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} /></label></div>
      </div>
      <h3 style={{ marginTop: '1rem' }}>Interview questions you were asked</h3>
      {f.questions.map((q, i) => (<div key={i} className="row"><div><select aria-label="Course for question" value={q.course_id} onChange={(e) => upd('questions', i, 'course_id', e.target.value)}><option value="">Course...</option>{courses.map((c) => <option key={c.course_id} value={c.course_id}>{c.title}</option>)}</select></div><div style={{ flex: '3 1 300px' }}><input aria-label="Interview question text" placeholder="Question" value={q.text} onChange={(e) => upd('questions', i, 'text', e.target.value)} /></div></div>))}
      <button type="button" className="btn ghost small" onClick={() => setF({ ...f, questions: [...f.questions, { course_id: '', text: '', round: 'technical', difficulty: 3 }] })}>Add a question</button>
      <h3 style={{ marginTop: '1rem' }}>Preparation you did alongside your electives</h3>
      {f.activities.map((a, i) => (<div key={i} className="row"><div><select aria-label="Course for preparation" value={a.course_id} onChange={(e) => upd('activities', i, 'course_id', e.target.value)}><option value="">Course...</option>{courses.map((c) => <option key={c.course_id} value={c.course_id}>{c.title}</option>)}</select></div>
        <div><select aria-label="Preparation type" value={a.type} onChange={(e) => upd('activities', i, 'type', e.target.value)}><option value="practice">Practice</option><option value="course">Course</option><option value="certification">Certification</option></select></div>
        <div><input aria-label="Preparation platform" placeholder="Platform (e.g. LeetCode)" value={a.platform} onChange={(e) => upd('activities', i, 'platform', e.target.value)} /></div>
        <div><input aria-label="Hours spent" type="number" min="0" placeholder="Hours" value={a.hours} onChange={(e) => upd('activities', i, 'hours', e.target.value)} /></div></div>))}
      <button type="button" className="btn ghost small" onClick={() => setF({ ...f, activities: [...f.activities, { course_id: '', type: 'practice', platform: '', hours: '' }] })}>Add preparation</button>
      <Notice error={s.error} ok={s.ok} />
      <div style={{ marginTop: '1rem' }}><button className="btn" disabled={s.busy}>Save placement</button></div>
    </form>
  );
}

function StandaloneQuestionForm({ lookups, onSaved }) {
  const [f, setF] = useState({ course_id: '', text: '', round: 'technical', difficulty: 3 });
  const [s, run] = useAction();
  const courses = lookups.courses ?? [];
  return (
    <form className="card" onSubmit={(e) => {
      e.preventDefault();
      run(async () => {
        await api('/api/questions', { method: 'POST', body: f });
        setF({ course_id: '', text: '', round: 'technical', difficulty: 3 });
        onSaved();
      }, 'Interview question submitted.');
    }}>
      <h3>Add an interview question</h3>
      <p className="small muted">Share technical or coding questions asked by recruiters for specific courses.</p>
      <div className="row">
        <div>
          <label>Course
            <select required value={f.course_id} onChange={(e) => setF({ ...f, course_id: e.target.value })}>
              <option value="">Select course...</option>
              {courses.map((c) => <option key={c.course_id} value={c.course_id}>{c.title}</option>)}
            </select>
          </label>
        </div>
        <div>
          <label>Round
            <select value={f.round} onChange={(e) => setF({ ...f, round: e.target.value })}>
              <option value="technical">Technical</option>
              <option value="coding">Coding</option>
              <option value="hr-technical">HR-Technical</option>
              <option value="managerial">Managerial</option>
            </select>
          </label>
        </div>
        <div>
          <label>Difficulty (1-5)
            <input type="number" min="1" max="5" value={f.difficulty} onChange={(e) => setF({ ...f, difficulty: e.target.value })} />
          </label>
        </div>
      </div>
      <div className="field">
        <label>Question text
          <textarea required rows={4} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} placeholder="e.g. Implement LRU cache with O(1) get and put, or explain B-tree node splitting." />
        </label>
      </div>
      <Notice error={s.error} ok={s.ok} />
      <button className="btn" disabled={s.busy}>Submit question</button>
    </form>
  );
}

function StandaloneActivityForm({ lookups, onSaved }) {
  const [f, setF] = useState({ course_id: '', type: 'practice', platform: '', hours: '' });
  const [s, run] = useAction();
  const courses = lookups.courses ?? [];
  return (
    <form className="card" onSubmit={(e) => {
      e.preventDefault();
      run(async () => {
        await api('/api/activities', { method: 'POST', body: f });
        setF({ course_id: '', type: 'practice', platform: '', hours: '' });
        onSaved();
      }, 'Preparation activity logged.');
    }}>
      <h3>Log preparation activity</h3>
      <p className="small muted">Record independent practice, MOOCs, or certifications completed alongside courses.</p>
      <div className="row">
        <div>
          <label>Course
            <select required value={f.course_id} onChange={(e) => setF({ ...f, course_id: e.target.value })}>
              <option value="">Select course...</option>
              {courses.map((c) => <option key={c.course_id} value={c.course_id}>{c.title}</option>)}
            </select>
          </label>
        </div>
        <div>
          <label>Type
            <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
              <option value="practice">Practice</option>
              <option value="course">Online course</option>
              <option value="certification">Certification</option>
            </select>
          </label>
        </div>
        <div>
          <label>Platform
            <input required placeholder="e.g. LeetCode, Coursera, Kaggle" value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })} />
          </label>
        </div>
        <div>
          <label>Hours spent
            <input required type="number" min="0.5" step="0.5" max="2000" placeholder="Hours" value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} />
          </label>
        </div>
      </div>
      <Notice error={s.error} ok={s.ok} />
      <button className="btn" disabled={s.busy}>Save activity</button>
    </form>
  );
}

function ProjectForm({ lookups, onSaved }) {
  const [f, setF] = useState({ course_id: '', title: '', skill_ids: [] });
  const [s, run] = useAction();
  const projects = useApi('/api/projects');
  const courses = lookups.courses ?? [];
  const skills = lookups.skills ?? [];
  const toggleSkill = (id) => {
    setF((prev) => ({
      ...prev,
      skill_ids: prev.skill_ids.includes(id) ? prev.skill_ids.filter((x) => x !== id) : [...prev.skill_ids, id],
    }));
  };
  return (
    <div>
      <form className="card" onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          await api('/api/projects', { method: 'POST', body: f });
          setF({ course_id: '', title: '', skill_ids: [] });
          projects.reload();
          onSaved();
        }, 'Project saved.');
      }}>
        <h3>Add course project</h3>
        <p className="small muted">Document capstone, mini-projects or course assignments along with the skills demonstrated.</p>
        <div className="row">
          <div>
            <label>Course
              <select required value={f.course_id} onChange={(e) => setF({ ...f, course_id: e.target.value })}>
                <option value="">Select course...</option>
                {courses.map((c) => <option key={c.course_id} value={c.course_id}>{c.title}</option>)}
              </select>
            </label>
          </div>
          <div style={{ flex: '2 1 280px' }}>
            <label>Project Title
              <input required placeholder="e.g. Distributed Consensus Engine" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
            </label>
          </div>
        </div>
        <div style={{ marginTop: '0.8rem' }}>
          <label>Skills demonstrated (click to toggle):</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.4rem', maxHeight: 180, overflowY: 'auto' }}>
            {skills.map((sk) => {
              const active = f.skill_ids.includes(sk.skill_id);
              return (
                <button
                  type="button"
                  key={sk.skill_id}
                  className={`tag ${active ? 'rose' : 'grey'}`}
                  style={{ cursor: 'pointer', border: 'none' }}
                  onClick={() => toggleSkill(sk.skill_id)}
                >
                  {active ? '✓ ' : '+ '}{sk.name}
                </button>
              );
            })}
          </div>
        </div>
        <Notice error={s.error} ok={s.ok} />
        <div style={{ marginTop: '1rem' }}><button className="btn" disabled={s.busy}>Save project</button></div>
      </form>
      <Loading state={projects} />
      {projects.data && projects.data.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h3>Your projects</h3>
          <div className="tablewrap">
            <table>
              <thead><tr><th>Course</th><th>Project Title</th><th>Skills</th></tr></thead>
              <tbody>
                {projects.data.map((p) => (
                  <tr key={p.project_id}>
                    <td><b>{p.title}</b></td>
                    <td>{p.title}</td>
                    <td>{(p.skills ?? []).map((sk) => <span key={sk} className="tag">{sk}</span>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Contribute() {
  const me = useApi('/api/auth/me');
  const [tab, setTab] = useState('review');
  const mine = useApi('/api/my/enrollments');
  const lookups = useApi('/api/lookups');
  const act = useApi('/api/my/activity');
  const projects = useApi('/api/projects');

  if (me.loading) return <Loading state={me} />;
  if (me.data?.role === 'senior') {
    return <SeniorDashboard />;
  }

  const pending = (mine.data ?? []).filter((e) => !e.reviewed);
  const reloadAll = () => { act.reload(); projects.reload(); };

  return (
    <div>
      <h1>Share your experience</h1>
      <p className="muted">Reviews are anonymous. You can review a course only after your grade has been posted.</p>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          ['review', 'Review a course'],
          ['placement', 'Placement package'],
          ['question', 'Interview question'],
          ['activity', 'Preparation log'],
          ['project', 'Course project'],
          ['records', 'My records'],
        ]}
      />
      {tab === 'review' && (<>
        <Loading state={mine} />
        {mine.data && pending.length === 0 && <p className="muted">You have reviewed every enrolled course.</p>}
        {pending.map((e) => <ReviewForm key={e.enrollment_id} e={e} onSaved={mine.reload} />)}
      </>)}
      {tab === 'placement' && lookups.data && <PlacementForm lookups={lookups.data} onSaved={reloadAll} />}
      {tab === 'question' && lookups.data && <StandaloneQuestionForm lookups={lookups.data} onSaved={reloadAll} />}
      {tab === 'activity' && lookups.data && <StandaloneActivityForm lookups={lookups.data} onSaved={reloadAll} />}
      {tab === 'project' && lookups.data && <ProjectForm lookups={lookups.data} onSaved={reloadAll} />}
      {tab === 'records' && (<>
        <Loading state={act} />
        {act.data && (<>
          <h3>Placements</h3>
          <div className="tablewrap"><table><thead><tr><th>Company</th><th>Role</th><th>Type</th><th className="num">Package</th><th className="num">Year</th></tr></thead>
            <tbody>{act.data.placements.map((p) => <tr key={p.placement_id}><td>{p.company}</td><td>{p.role}</td><td>{p.type}</td><td className="num">{lpa(p.package_lpa)}</td><td className="num">{p.year}</td></tr>)}</tbody></table></div>
          <h3 style={{ marginTop: '1rem' }}>Preparation logs</h3>
          <div className="tablewrap"><table><thead><tr><th>Course</th><th>Type</th><th>Platform</th><th className="num">Hours</th></tr></thead>
            <tbody>{act.data.activities.map((p) => <tr key={p.activity_id}><td>{p.title || p.platform}</td><td>{p.type}</td><td>{p.platform}</td><td className="num">{p.hours_spent}</td></tr>)}</tbody></table></div>
        </>)}
        <h3 style={{ marginTop: '1rem' }}>Projects</h3>
        <Loading state={projects} />
        {projects.data && (
          <div className="tablewrap">
            <table>
              <thead><tr><th>Course</th><th>Project Title</th><th>Skills</th></tr></thead>
              <tbody>
                {projects.data.map((p) => (
                  <tr key={p.project_id}>
                    <td><b>{p.code}</b></td>
                    <td>{p.title}</td>
                    <td>{(p.skills ?? []).map((sk) => <span key={sk} className="tag">{sk}</span>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>)}
    </div>
  );
}
