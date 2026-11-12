'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useApi, Loading, Ruler, lpa, fmt, Tabs, LoadMore, Notice, api } from '@/components/ui';
import MindMap from '@/components/MindMap';
import ReportModal from '@/components/ReportModal';
import SeniorProfileModal from '@/components/SeniorProfileModal';

export default function CourseDetail() {
  const { id } = useParams();
  const d = useApi(`/api/courses/${id}`);
  const map = useApi(`/api/courses/${id}/mindmap`);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('overview');
  const [reviewLimit, setReviewLimit] = useState(5);
  const [enrollMsg, setEnrollMsg] = useState(null);
  const [enrollBusy, setEnrollBusy] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [viewSeniorCode, setViewSeniorCode] = useState(null);
  const fb = useApi(`/api/courses/${id}/feedback?q=${encodeURIComponent(q)}`);
  const exams = useApi(tab === 'exams' ? `/api/exam-questions?course=${id}` : null);

  const enroll = async () => {
    setEnrollBusy(true); setEnrollMsg(null);
    try {
      const res = await api('/api/my/enrollments', { method: 'POST', body: { course_id: id } });
      setEnrollMsg({ ok: res.message || 'Enrolled successfully!' });
    } catch (e) {
      setEnrollMsg({ err: e.message });
    } finally {
      setEnrollBusy(false);
    }
  };

  if (d.loading || d.error) return <Loading state={d} />;
  const s = d.data.summary;
  const spread = [1, 2, 3, 4, 5].map((r) => d.data.ratingSpread.find((x) => x.rating === r)?.votes ?? 0);
  const maxVotes = Math.max(1, ...spread);
  const reviews = fb.data ?? [];
  const visibleReviews = reviews.slice(0, reviewLimit);

  return (
    <div>
      <p className="small"><Link href="/courses">All courses</Link></p>
      <div className="page-head">
        <div>
          <h1>{s.title}</h1>
          <p className="muted">
            {s.department} · {s.credits} credits · semester {s.semester}
            {s.elective_slot ? ` · ${s.elective_slot}` : ''}
            {s.vertical ? ` · ${s.vertical} Vertical` : ''}
            {s.faculty_name ? ` · ${s.faculty_name}` : ''}
          </p>
        </div>
        <div className="row" style={{ alignItems: 'center' }}>
          <span className={`tag ${s.level === 'advanced' ? 'rose' : s.level === 'intermediate' ? 'amber' : 'teal'}`}>{s.level}</span>
          <button type="button" className="btn small" disabled={enrollBusy} onClick={enroll} title="Self-enroll for the current term">
            {enrollBusy ? 'Enrolling...' : 'Self-enroll'}
          </button>
        </div>
      </div>
      {enrollMsg && <Notice ok={enrollMsg.ok} error={enrollMsg.err} />}
      <div className="grid g4">
        <div className="card stat"><b>{fmt(d.data.difficultyScore)}</b><span>Difficulty score (1-5), {s.feedback_count} reviews</span><Ruler value={d.data.difficultyScore} /></div>
        <div className="card stat"><b>{fmt(s.avg_usefulness)}</b><span>Usefulness for careers (1-5)</span><Ruler value={s.avg_usefulness} invert /></div>
        <div className="card stat"><b>{d.data.resources?.length ?? s.resource_count}</b><span>Learning resources</span></div>
        <div className="card stat"><b>{lpa(d.data.placement?.avg_package)}</b><span>Average package of {d.data.placement?.placed_count ?? 0} placed students</span></div>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[['overview', 'Overview'], ['skills', 'Skills map'], ['reviews', 'Senior reviews'], ['prep', 'Preparation and interviews'], ['exams', 'ISA and ESA questions']]} />

      {tab === 'overview' && (<div className="grid g2">
        <div className="card">
          <h3>Before you take it (Foundational Prerequisites)</h3>
          {d.data.prerequisiteChain.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ padding: '0.35rem 0.75rem', borderRadius: 6, background: '#f1f5f9', color: '#0f172a', fontWeight: 600, fontSize: '0.85rem', border: '1px solid #cbd5e1' }}>
                  Programming in Python / C++
                </span>
                <span style={{ padding: '0.35rem 0.75rem', borderRadius: 6, background: '#f1f5f9', color: '#0f172a', fontWeight: 600, fontSize: '0.85rem', border: '1px solid #cbd5e1' }}>
                  Mathematics &amp; Linear Algebra
                </span>
                <span style={{ padding: '0.35rem 0.75rem', borderRadius: 6, background: '#f1f5f9', color: '#0f172a', fontWeight: 600, fontSize: '0.85rem', border: '1px solid #cbd5e1' }}>
                  Data Structures &amp; Algorithms
                </span>
              </div>
              <p className="small muted" style={{ margin: 0 }}>
                Solid conceptual grasp of Python, Linear Algebra, and basic algorithmic complexity is strongly recommended.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                {d.data.prerequisiteChain.map((p) => (
                  <Link
                    key={p.course_id}
                    href={`/courses/${p.course_id}`}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: 6,
                      background: '#f1f5f9',
                      color: '#0f172a',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      textDecoration: 'none',
                      border: '1px solid #cbd5e1',
                    }}
                  >
                    {p.title.replace(' (core)', '')}
                  </Link>
                ))}
              </div>
              <p className="small muted" style={{ margin: 0 }}>
                Strong foundation in {d.data.prerequisiteChain.map(p => p.title.replace(' (core)', '')).join(', ')} is recommended prior to taking this elective.
              </p>
            </div>
          )}
          <h3 style={{ marginTop: '1.25rem' }}>What it unlocks</h3>
          {d.data.unlocks.length === 0 ? <p className="muted">No later elective explicitly requires this course as a hard prerequisite.</p> : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {d.data.unlocks.map((u) => (
                <Link
                  key={u.course_id}
                  href={`/courses/${u.course_id}`}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: 6,
                    background: '#f0fdf4',
                    color: '#047857',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    textDecoration: 'none',
                    border: '1px solid #bbf7d0',
                  }}
                >
                  {u.title}
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <h3>How hard seniors found it</h3>
          {spread.map((v, i) => (<div key={i} className="row" style={{ alignItems: 'center', marginBottom: 4 }}><span className="shrink small" style={{ width: 70 }}>Rated {i + 1}</span><div className="meter"><span style={{ width: `${(v / maxVotes) * 100}%` }} /></div><span className="shrink small" style={{ width: 28 }}>{v}</span></div>))}
          <p className="small muted">Workload average: {fmt(s.avg_workload)} / 5</p>
        </div>
        <div className="card">
          <h3>Faculty view &amp; Academic Scope</h3>
          {d.data.facultyReviews.length === 0 ? <p className="muted">No faculty rating yet.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {d.data.facultyReviews.map((r, i) => (
                <div key={i} style={{ padding: '0.75rem 0.95rem', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                    <b style={{ color: '#0f172a', fontSize: '0.9rem' }}>{r.faculty_name}</b>
                    <span style={{ fontSize: '0.78rem', color: '#0284c7', fontWeight: 700 }}>
                      Relevance {r.relevance}/5 &bull; Scope {r.future_scope}/5
                    </span>
                  </div>
                  {r.comment && <p className="muted" style={{ margin: 0, fontSize: '0.84rem', lineHeight: 1.5 }}>&ldquo;{r.comment}&rdquo;</p>}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <h3>Learning Resources ({d.data.resources?.length || 0})</h3>
          {(!d.data.resources || d.data.resources.length === 0) ? <p className="muted">No resources logged yet.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {d.data.resources.map((r) => {
                const isSeniorRec = r.type === 'senior recommendation' || r.source === 'senior_feedback';
                return (
                  <div key={r.resource_id} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.6rem 0.85rem', background: isSeniorRec ? '#fdf4ff' : '#f8fafc', borderRadius: 6, border: `1px solid ${isSeniorRec ? '#f0abfc' : '#e2e8f0'}` }}>
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      padding: '0.15rem 0.45rem',
                      borderRadius: 4,
                      background: isSeniorRec ? '#fae8ff' : r.type === 'book' ? '#fef3c7' : r.type === 'video' ? '#fee2e2' : r.type === 'notes' ? '#e0f2fe' : '#ecfdf5',
                      color: isSeniorRec ? '#a21caf' : r.type === 'book' ? '#b45309' : r.type === 'video' ? '#b91c1c' : r.type === 'notes' ? '#0369a1' : '#047857'
                    }}>
                      {isSeniorRec ? '⭐ Senior Recommended' : r.type}
                    </span>
                    {r.url ? (
                      <a href={r.url} target="_blank" rel="noreferrer" style={{ fontSize: '0.86rem', fontWeight: 600, color: '#0284c7', textDecoration: 'none' }}>
                        {r.title} &rarr;
                      </a>
                    ) : (
                      <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#0f172a' }}>{r.title}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>)}

      {tab === 'skills' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card">
            <h3 style={{ margin: '0 0 0.5rem 0' }}>Interactive Radial Skill Architecture</h3>
            <p className="muted" style={{ margin: '0 0 1rem 0', fontSize: '0.88rem' }}>
              Central elective node with concentric taught competencies, capstone application skills, and industry graph linkages.
            </p>
            <Loading state={map} />
            {map.data && <MindMap data={map.data} />}
          </div>

          {/* Structured Competency Matrix */}
          <div className="card">
            <h3 style={{ margin: '0 0 1rem 0' }}>Syllabus Skill Breakdown &amp; Mastery Depths</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
              <div>
                <h4 style={{ fontSize: '0.88rem', color: '#0284c7', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: '0.65rem' }}>
                  Advanced Mastery (Depth 3)
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {(d.data.skills || []).filter(k => k.depth === 3).map((k) => (
                    <div key={k.skill_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', borderRadius: 6, background: '#f0f9ff', border: '1px solid #bae6fd' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0369a1' }}>{k.name}</span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '0.15rem 0.45rem', borderRadius: 4, background: '#0284c7', color: '#fff' }}>Mastery</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '0.88rem', color: '#059669', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: '0.65rem' }}>
                  Practical Engineering Skills (Depth 2)
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {(d.data.skills || []).filter(k => k.depth === 2).map((k) => (
                    <div key={k.skill_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', borderRadius: 6, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#065f46' }}>{k.name}</span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: 4, background: '#10b981', color: '#fff' }}>Practical</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '0.88rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: '0.65rem' }}>
                  Foundational Principles (Depth 1)
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {(d.data.skills || []).filter(k => k.depth === 1).map((k) => (
                    <div key={k.skill_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', borderRadius: 6, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#334155' }}>{k.name}</span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.15rem 0.45rem', borderRadius: 4, background: '#94a3b8', color: '#fff' }}>Theory</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'reviews' && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <label htmlFor="rq" style={{ fontWeight: 600 }}>Search Senior Reviews &amp; Recommendations</label>
              <input id="rq" placeholder="e.g. project, interview, math, Google" value={q} onChange={(e) => { setQ(e.target.value); setReviewLimit(5); }} style={{ minWidth: 280 }} />
            </div>
            <div className="small muted">
              Showing {visibleReviews.length} of {reviews.length} verified senior elective reviews
            </div>
          </div>
          <div style={{ height: '0.6rem' }} />
          <Loading state={fb} />
          {reviews.length === 0 && <p className="muted">No reviews match. Try a different search keyword.</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {visibleReviews.map((r) => (
              <div key={r.feedback_id} className="review" style={{ padding: '1.1rem 1.25rem', background: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                {/* Header row: Senior Identity, Placement, Grade, Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '0.65rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {r.senior_code ? (
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => setViewSeniorCode(r.senior_code)}
                        style={{ fontSize: '1rem', fontWeight: 700, color: '#1e40af', padding: 0, cursor: 'pointer', textAlign: 'left', textDecoration: 'underline' }}
                        title="Click to view full verified senior profile"
                      >
                        Senior #{r.senior_code} {r.display_name && r.display_name !== `Senior #${r.senior_code}` ? `· ${r.display_name}` : (r.student_name ? `· ${r.student_name}` : '')}
                      </button>
                    ) : (
                      <span style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                        {r.display_name || r.student_name || 'Senior Alumnus'}
                      </span>
                    )}

                    {r.company_name && (
                      <span className="tag green" style={{ fontWeight: 700, fontSize: '0.78rem' }}>
                        {lpa(r.package_lpa)} · {r.company_name} {r.role_title ? `(${r.role_title})` : ''}
                      </span>
                    )}

                    {r.grade_points != null && (
                      <span className="tag blue" style={{ fontWeight: 600, fontSize: '0.78rem' }}>
                        Grade: {fmt(r.grade_points, 1)} / 10
                      </span>
                    )}

                    {r.placement_help && (
                      <span className="tag purple" style={{ fontWeight: 600, fontSize: '0.78rem' }}>
                        ✓ Directly Helped in Interviews
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span className="small muted">Batch of {r.batch_year}</span>
                    <button className="link-btn small" style={{ color: 'var(--amber, #ecc94b)' }} onClick={() => setReportTarget({ type: 'feedback', id: r.feedback_id })}>
                      Report misleading
                    </button>
                  </div>
                </div>

                {/* Ratings metric row */}
                <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'center', padding: '0.4rem 0.75rem', background: '#f8fafc', borderRadius: 6, marginBottom: '0.75rem', fontSize: '0.82rem' }}>
                  <span><b>Difficulty:</b> {r.difficulty}/5</span>
                  <span style={{ color: '#cbd5e1' }}>|</span>
                  <span><b>Workload:</b> {r.workload}/5</span>
                  <span style={{ color: '#cbd5e1' }}>|</span>
                  <span><b>Placement Usefulness:</b> {r.usefulness}/5</span>
                </div>

                {/* Review Text */}
                {r.review_text && (
                  <p style={{ margin: '0.4rem 0 0.6rem', fontSize: '0.92rem', lineHeight: 1.6, color: '#1e293b' }}>
                    &ldquo;{r.review_text}&rdquo;
                  </p>
                )}

                {/* Senior's Authentic Advice for Juniors */}
                {r.advice_for_juniors && (
                  <div style={{ marginTop: '0.6rem', padding: '0.65rem 0.85rem', background: '#eff6ff', borderRadius: 8, borderLeft: '4px solid #3b82f6' }}>
                    <span style={{ fontSize: '0.76rem', fontWeight: 800, textTransform: 'uppercase', color: '#1d4ed8', display: 'block', marginBottom: '0.2rem' }}>
                      💡 Senior Advice for Juniors
                    </span>
                    <span style={{ fontSize: '0.86rem', color: '#1e3a8a', lineHeight: 1.5 }}>
                      {r.advice_for_juniors}
                    </span>
                  </div>
                )}

                {/* Senior's Recommended Preparation */}
                {r.extra_prep_needed && (
                  <div style={{ marginTop: '0.5rem', padding: '0.65rem 0.85rem', background: '#f0fdf4', borderRadius: 8, borderLeft: '4px solid #10b981' }}>
                    <span style={{ fontSize: '0.76rem', fontWeight: 800, textTransform: 'uppercase', color: '#047857', display: 'block', marginBottom: '0.2rem' }}>
                      ⚡ Recommended Extra Preparation
                    </span>
                    <span style={{ fontSize: '0.86rem', color: '#064e3b', lineHeight: 1.5 }}>
                      {r.extra_prep_needed}
                    </span>
                  </div>
                )}

                {/* Senior's Recommended Resources */}
                {r.recommended_resources && (
                  <div style={{ marginTop: '0.5rem', padding: '0.65rem 0.85rem', background: '#fdf4ff', borderRadius: 8, borderLeft: '4px solid #a855f7' }}>
                    <span style={{ fontSize: '0.76rem', fontWeight: 800, textTransform: 'uppercase', color: '#7e22ce', display: 'block', marginBottom: '0.2rem' }}>
                      📚 Recommended Books &amp; Resources
                    </span>
                    <span style={{ fontSize: '0.86rem', color: '#581c87', lineHeight: 1.5 }}>
                      {r.recommended_resources}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ height: '0.8rem' }} />
          <LoadMore
            hasMore={reviews.length > reviewLimit}
            onLoadMore={() => setReviewLimit((l) => l + 5)}
            count={visibleReviews.length}
            total={reviews.length}
          />
        </div>
      )}

      {tab === 'prep' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Senior Preparation Activities */}
          <div className="card">
            <h3 style={{ margin: '0 0 0.5rem 0' }}>Senior Preparation &amp; Parallel Upskilling</h3>
            <p className="muted" style={{ margin: '0 0 1rem 0', fontSize: '0.88rem' }}>
              Specific learning platforms, competitive programming, and technical certifications undertaken alongside this elective.
            </p>
            {d.data.seniorActivities && d.data.seniorActivities.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '0.85rem' }}>
                {d.data.seniorActivities.map((act) => (
                  <div key={act.activity_id} style={{ padding: '0.85rem 1rem', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="tag grey" style={{ fontSize: '0.72rem', textTransform: 'capitalize' }}>{act.type.replace('_', ' ')}</span>
                      {act.hours_spent && <span className="small muted">~{fmt(act.hours_spent, 0)} hours</span>}
                    </div>
                    <b style={{ fontSize: '0.92rem', color: '#0f172a' }}>{act.title || act.platform}</b>
                    <span className="small muted">Platform: {act.platform}</span>
                    {act.skills_covered && (
                      <div className="small" style={{ color: '#0284c7', background: '#f0f9ff', padding: '0.35rem 0.55rem', borderRadius: 4 }}>
                        <b>Skills:</b> {act.skills_covered}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.3rem', paddingTop: '0.35rem', borderTop: '1px solid #f1f5f9' }}>
                      {act.senior_code ? (
                        <button type="button" className="link-btn small" onClick={() => setViewSeniorCode(act.senior_code)} style={{ fontWeight: 600, color: '#1e40af' }}>
                          #{act.senior_code} {act.display_name}
                        </button>
                      ) : (
                        <span className="small muted">{act.display_name}</span>
                      )}
                      {act.company_name && (
                        <span className="tag green small" style={{ fontWeight: 700 }}>
                          {lpa(act.package_lpa)} · {act.company_name}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : d.data.preparation && d.data.preparation.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                {d.data.preparation.map((p, i) => (
                  <div key={i} style={{ padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
                    <span className="tag grey" style={{ marginRight: '0.5rem' }}>{p.type}</span>
                    <b>{p.platform}</b> &bull; {p.seniors} seniors (~{fmt(p.avg_hours, 0)} hrs)
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No preparation records logged yet for this elective.</p>
            )}
          </div>

          {/* Senior Interview Roadmaps & Strategies */}
          {d.data.seniorPrepAdvice && d.data.seniorPrepAdvice.length > 0 && (
            <div className="card">
              <h3 style={{ margin: '0 0 0.5rem 0' }}>Placed Senior Interview Strategies &amp; Roadmaps</h3>
              <p className="muted" style={{ margin: '0 0 1rem 0', fontSize: '0.88rem' }}>
                Authentic preparation advice, core subjects revised, and common mistakes to avoid from placed seniors who completed this elective.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1rem' }}>
                {d.data.seniorPrepAdvice.map((spa) => (
                  <div key={spa.prep_id} style={{ padding: '1rem', background: '#ffffff', borderRadius: 8, border: '1px solid #cbd5e1', boxShadow: '0 1px 2px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {spa.senior_code ? (
                        <button type="button" className="link-btn" onClick={() => setViewSeniorCode(spa.senior_code)} style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e40af' }}>
                          Senior #{spa.senior_code} · {spa.display_name}
                        </button>
                      ) : (
                        <b style={{ fontSize: '0.95rem' }}>{spa.display_name}</b>
                      )}
                      {spa.company_name && (
                        <span className="tag green" style={{ fontWeight: 700 }}>
                          {lpa(spa.package_lpa)} · {spa.company_name}
                        </span>
                      )}
                    </div>

                    {spa.strategy && (
                      <div>
                        <b className="small" style={{ color: '#0f172a', display: 'block', marginBottom: '0.2rem' }}>Preparation Strategy:</b>
                        <p className="small" style={{ margin: 0, color: '#334155', lineHeight: 1.5 }}>{spa.strategy}</p>
                      </div>
                    )}

                    {spa.core_subjects_revised && (
                      <div style={{ padding: '0.45rem 0.65rem', background: '#f1f5f9', borderRadius: 6 }}>
                        <b className="small" style={{ color: '#0369a1', display: 'block', marginBottom: '0.15rem' }}>Core Subjects Revised:</b>
                        <p className="small" style={{ margin: 0, color: '#1e293b' }}>{spa.core_subjects_revised}</p>
                      </div>
                    )}

                    {spa.mistakes_to_avoid && (
                      <div style={{ padding: '0.45rem 0.65rem', background: '#fff1f2', borderRadius: 6, borderLeft: '3px solid #f43f5e' }}>
                        <b className="small" style={{ color: '#be123c', display: 'block', marginBottom: '0.15rem' }}>Mistakes to Avoid:</b>
                        <p className="small" style={{ margin: 0, color: '#881337' }}>{spa.mistakes_to_avoid}</p>
                      </div>
                    )}

                    {spa.tips && (
                      <p className="small muted" style={{ margin: 0, fontStyle: 'italic' }}>
                        &ldquo;{spa.tips}&rdquo;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Interview Questions encountered from this course */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ margin: '0 0 0.25rem 0' }}>Real Placement &amp; Recruiter Questions ({d.data.questions?.length || 0})</h3>
                <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                  Interview and recruiter questions encountered by students who completed this elective course.
                </p>
              </div>
              <Link href="/questions" className="btn small secondary">Search All Interview Questions &rarr;</Link>
            </div>

            {d.data.questions.length === 0 ? (
              <p className="muted">No interview questions logged yet for this course.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {d.data.questions.map((x) => (
                  <div key={x.question_id} style={{ padding: '0.85rem 1rem', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <p style={{ margin: 0, fontWeight: 600, color: '#0f172a', lineHeight: 1.5, flex: 1 }}>{x.question_text}</p>
                      <button className="link-btn small shrink" style={{ color: 'var(--amber, #ecc94b)' }} onClick={() => setReportTarget({ type: 'interview_question', id: x.question_id })}>
                        Report
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.6rem' }}>
                      <span className="tag grey small">{x.round || 'Technical Round'}</span>
                      <span className="tag amber small">Difficulty: {x.difficulty}/5</span>
                      {x.company_name && (
                        <span className="tag green small" style={{ fontWeight: 700 }}>
                          {lpa(x.package_lpa)} · {x.company_name}
                        </span>
                      )}
                      {x.senior_code && (
                        <button type="button" className="link-btn small" onClick={() => setViewSeniorCode(x.senior_code)} style={{ color: '#1e40af', marginLeft: 'auto', fontWeight: 600 }}>
                          #{x.senior_code} {x.senior_name} &rarr;
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'exams' && (
        <div>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3>ISA and ESA question bank</h3>
            <p className="muted">Questions asked in in-semester and end-semester assessments for this course, shared anonymously by students.</p>
            <div className="row" style={{ marginTop: '0.5rem', gap: '0.5rem', flexWrap: 'wrap' }}>
              {(d.data.examSummary ?? []).length === 0 ? (
                <span className="small muted">No questions logged yet.</span>
              ) : (
                (d.data.examSummary ?? []).map((es) => (
                  <span key={es.exam_type} className="tag teal">
                    <b>{es.exam_type}</b>: {es.n} questions
                  </span>
                ))
              )}
            </div>
          </div>

          <Loading state={exams} />

          {exams.data && exams.data.length === 0 && (
            <div className="card">
              <p className="muted">No ISA or ESA questions shared for this course yet.</p>
            </div>
          )}

          {['ISA1', 'ISA2', 'ESA'].map((type) => {
            const list = (exams.data ?? []).filter((item) => item.exam_type === type);
            if (list.length === 0) return null;
            const typeLabel = type === 'ISA1' ? 'In-Semester Assessment 1 (ISA 1)' : type === 'ISA2' ? 'In-Semester Assessment 2 (ISA 2)' : 'End-Semester Assessment (ESA)';
            return (
              <div key={type} style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ marginBottom: '0.6rem' }}>{typeLabel} <span className="small muted">({list.length})</span></h3>
                <div className="grid g2">
                  {list.map((item) => (
                    <div key={item.exam_question_id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <p style={{ margin: 0, fontWeight: 500, lineHeight: 1.5 }}>{item.question_text}</p>
                      <div className="small muted" style={{ marginTop: '0.8rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span className="tag grey">{item.exam_type}</span>
                        {item.marks != null && <span className="tag">{item.marks} marks</span>}
                        {item.topic && <span className="tag teal">{item.topic}</span>}
                        <span className="tag amber">Diff: {item.difficulty}/5</span>
                        <span style={{ marginLeft: 'auto' }}>{item.term}</span>
                        <button className="link-btn small" style={{ color: 'var(--amber, #ecc94b)' }} onClick={() => setReportTarget({ type: 'exam_question', id: item.exam_question_id })}>
                          Report
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {reportTarget && (
        <ReportModal
          contentType={reportTarget.type}
          contentId={reportTarget.id}
          onClose={() => setReportTarget(null)}
        />
      )}

      {viewSeniorCode && (
        <SeniorProfileModal
          seniorCode={viewSeniorCode}
          onClose={() => setViewSeniorCode(null)}
        />
      )}
    </div>
  );
}
