'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useApi, Loading, lpa, fmt, Ruler, Notice } from './ui';
import SeniorProfileModal from './SeniorProfileModal';
import SemanticElectiveSearch from './SemanticElectiveSearch';

export default function StudentDashboard() {
  const dashApi = useApi('/api/student/dashboard');
  const lookups = useApi('/api/lookups');

  const d = dashApi.data;
  const s = d?.student;

  const [viewSeniorCode, setViewSeniorCode] = useState(null);

  // Elective Senior Experience State
  const allElectives = useMemo(() => {
    return (lookups.data?.electives || []).filter((c) => c.is_elective !== false);
  }, [lookups.data]);

  const [selectedElectiveId, setSelectedElectiveId] = useState('');
  const electiveExperienceApi = useApi(selectedElectiveId ? `/api/compare?ids=${selectedElectiveId}` : null);
  const electiveData = electiveExperienceApi.data?.[0] || null;

  // Elective Exam Questions State
  const [examCourseId, setExamCourseId] = useState('');
  const [examTab, setExamTab] = useState('ISA1');
  const examQuestionsApi = useApi(examCourseId ? `/api/exam-questions?course=${examCourseId}&type=${examTab}` : null);
  const questionsList = examQuestionsApi.data || [];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: '3rem' }}>
      {/* 1.1 Welcome Header */}
      <div className="page-head" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 700, margin: '0 0 0.4rem 0' }}>
            Welcome, {s?.name || 'Student'}
          </h1>
          <p className="muted" style={{ margin: 0, fontSize: '0.95rem' }}>
            SRN: <b>{s?.srn}</b> &bull; Department: <b>{s?.department}</b> &bull; Batch of <b>{s?.batch_year}</b>
          </p>
        </div>
      </div>

      <Loading state={dashApi} />

      {d && (
        <>
          {/* Quick Metrics Bar */}
          <div className="grid g3" style={{ marginBottom: '1.75rem' }}>
            <div className="card stat" style={{ padding: '1.25rem' }}>
              <b style={{ fontSize: '1.6rem', color: d.cgpa ? '#059669' : '#64748b' }}>
                {d.cgpa ? `${fmt(d.cgpa, 2)} / 10.0` : 'N/A'}
              </b>
              <span>
                {d.cgpa
                  ? `Current Cumulative CGPA (${d.coursesGraded} graded course${d.coursesGraded === 1 ? '' : 's'})`
                  : 'No graded courses yet'}
              </span>
            </div>
            <div className="card stat" style={{ padding: '1.25rem' }}>
              <b style={{ fontSize: '1.6rem', color: 'var(--blue-deep, #0284c7)' }}>
                {d.completedCredits ?? 0} Credits
              </b>
              <span>Completed Core Foundation Credits</span>
            </div>
            <div className="card stat" style={{ padding: '1.25rem' }}>
              <b style={{ fontSize: '1.6rem', color: d.academicStanding?.rank ? '#7c3aed' : '#64748b' }}>
                {d.academicStanding?.rank
                  ? `Rank #${d.academicStanding.rank}${d.academicStanding.total ? ` of ${d.academicStanding.total}` : ''}`
                  : (d.cgpa ? 'Ranked' : 'Not Ranked Yet')}
              </b>
              <span>
                {d.academicStanding?.label || (d.cgpa ? 'Academic Standing' : 'Awaiting graded course completions')}
              </span>
            </div>
          </div>

          {/* Feature Navigation Grid */}
          <div className="grid g3" style={{ marginBottom: '2.5rem' }}>
            <Link href="/courses" className="card" style={{ color: 'inherit', textDecoration: 'none', padding: '1.25rem', border: '1px solid var(--border)' }}>
              <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1.1rem' }}>Course Explorer &rarr;</h3>
              <p className="small muted" style={{ margin: 0 }}>
                Browse Elective I&ndash;IV slots, vertical tracks, learning outcomes, and student review metrics.
              </p>
            </Link>
            <Link href="/compare" className="card" style={{ color: 'inherit', textDecoration: 'none', padding: '1.25rem', border: '1px solid var(--border)' }}>
              <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1.1rem' }}>Elective Comparison &rarr;</h3>
              <p className="small muted" style={{ margin: 0 }}>
                Compare any two electives side-by-side with 15 rich academic, placement, and skill parameters.
              </p>
            </Link>
            <Link href="/career" className="card" style={{ color: 'inherit', textDecoration: 'none', padding: '1.25rem', border: '1px solid var(--border)' }}>
              <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1.1rem' }}>Career Path Simulator &rarr;</h3>
              <p className="small muted" style={{ margin: 0 }}>
                Target one of 27 industry engineering roles and visualize the optimal multi-hop elective pathway.
              </p>
            </Link>
            <Link href="/seniors" className="card" style={{ color: 'inherit', textDecoration: 'none', padding: '1.25rem', border: '1px solid var(--border)' }}>
              <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1.1rem' }}>Senior Explorer &rarr;</h3>
              <p className="small muted" style={{ margin: 0 }}>
                Discover alumni placement trajectories across 8 salary ranges with verified package LPA values.
              </p>
            </Link>
            <Link href="/market-trends" className="card" style={{ color: 'inherit', textDecoration: 'none', padding: '1.25rem', border: '1px solid var(--border)' }}>
              <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1.1rem' }}>Market Trends &rarr;</h3>
              <p className="small muted" style={{ margin: 0 }}>
                Track industry hiring momentum, salary trends, and in-demand tech skills across quarters.
              </p>
            </Link>
            <Link href="/exam-questions" className="card" style={{ color: 'inherit', textDecoration: 'none', padding: '1.25rem', border: '1px solid var(--border)' }}>
              <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1.1rem' }}>Exam Question Repository &rarr;</h3>
              <p className="small muted" style={{ margin: 0 }}>
                Search full-text ISA 1, ISA 2, and ESA past examination questions with detailed answer solutions.
              </p>
            </Link>
          </div>

          {/* AI-powered semantic elective search (new, independent section) */}
          <SemanticElectiveSearch />

          {/* ======================================================== */}
          {/* SECTION A: ELECTIVE SENIOR EXPERIENCE (SYNCHRONIZATION)   */}
          {/* ======================================================== */}
          <div className="card" style={{ padding: '1.5rem', marginBottom: '2.5rem', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 0.25rem 0' }}>
                  Elective Senior Experience
                </h2>
                <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                  Direct synchronization with verified senior alumni databases. Select any elective to inspect authentic placement outcomes and advice.
                </p>
              </div>

              <div style={{ minWidth: 300 }}>
                <select
                  value={selectedElectiveId}
                  onChange={(e) => setSelectedElectiveId(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: 6, border: '1px solid var(--border)', fontWeight: 600, background: '#fff' }}
                >
                  <option value="">-- Choose an Elective to Inspect Senior Data --</option>
                  {allElectives.map((el) => (
                    <option key={el.course_id} value={el.course_id}>
                      {el.title} {el.vertical ? `[${el.vertical}]` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Loading state={electiveExperienceApi} />

            {electiveData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Metrics Banner */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div>
                    <div className="muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Placement Package</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#059669', marginTop: '0.15rem' }}>
                      {electiveData.avg_package ? lpa(electiveData.avg_package) : 'N/A'}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                      <b>{electiveData.placed_students}</b> alumni placed
                    </div>
                  </div>

                  <div>
                    <div className="muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Difficulty Experienced</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.15rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{fmt(electiveData.avg_difficulty)} / 5</span>
                      <div style={{ width: 75 }}><Ruler value={electiveData.avg_difficulty} /></div>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                      Workload: <b>{fmt(electiveData.avg_workload)}/5</b>
                    </div>
                  </div>

                  <div>
                    <div className="muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Usefulness for Placements</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.15rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#059669' }}>{fmt(electiveData.avg_usefulness)} / 5</span>
                      <div style={{ width: 75 }}><Ruler value={electiveData.avg_usefulness} invert /></div>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                      Industry relevance: <b>{electiveData.advisor_scope_outlook || '8.5'}/10</b>
                    </div>
                  </div>

                  <div>
                    <div className="muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Verified Alumni</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: '0.15rem' }}>
                      {electiveData.seniors_taken_count} Seniors
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                      Completed & reviewed
                    </div>
                  </div>
                </div>

                {/* Senior Reviews & Advice */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                  <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', fontWeight: 700, color: 'var(--blue-deep, #0284c7)' }}>
                      Senior Feedback & Advice
                    </h4>
                    {Array.isArray(electiveData.senior_feedback) && electiveData.senior_feedback.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        {electiveData.senior_feedback.slice(0, 2).map((fb, idx) => (
                          <div key={idx} style={{ fontSize: '0.85rem' }}>
                            {fb.text && <p style={{ margin: '0 0 0.25rem 0', fontStyle: 'italic' }}>&ldquo;{fb.text}&rdquo;</p>}
                            {fb.advice && <p style={{ margin: 0, color: '#0369a1', fontSize: '0.8rem' }}><b>Advice:</b> {fb.advice}</p>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>Reviews logged by student cohort.</p>
                    )}
                  </div>

                  <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', fontWeight: 700, color: 'var(--blue-deep, #0284c7)' }}>
                      Recommended Preparation & Resources
                    </h4>
                    {Array.isArray(electiveData.recommended_preparation) && electiveData.recommended_preparation.length > 0 ? (
                      <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem' }}>
                        {electiveData.recommended_preparation.map((prep, idx) => (
                          <li key={idx} style={{ marginBottom: '0.25rem' }}>{prep}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>Review foundation concepts and algorithmic fundamentals.</p>
                    )}
                  </div>
                </div>

                {/* Completed Projects for this elective */}
                {Array.isArray(electiveData.relevant_projects) && electiveData.relevant_projects.length > 0 && (
                  <div>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', fontWeight: 700 }}>
                      Projects Completed by Seniors for this Elective
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
                      {electiveData.relevant_projects.map((p, idx) => (
                        <div key={idx} style={{ padding: '0.6rem 0.8rem', borderRadius: 6, background: '#f1f5f9', fontSize: '0.85rem' }}>
                          <div style={{ fontWeight: 600 }}>{p.title}</div>
                          {p.tech_stack && <div className="muted" style={{ fontSize: '0.75rem' }}>Tech: {p.tech_stack}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Verified Alumni List */}
                {Array.isArray(electiveData.verified_seniors) && electiveData.verified_seniors.length > 0 && (
                  <div style={{ marginTop: '0.25rem' }}>
                    <h4 style={{ margin: '0 0 0.6rem 0', fontSize: '0.95rem', fontWeight: 700 }}>
                      Verified Alumni who completed {electiveData.title} ({electiveData.verified_seniors.length})
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                      {electiveData.verified_seniors.map((sr, idx) => (
                        <div
                          key={idx}
                          onClick={() => setViewSeniorCode(sr.senior_code)}
                          style={{
                            padding: '0.75rem 1rem',
                            borderRadius: 8,
                            background: '#fff',
                            border: '1px solid var(--border)',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.25rem',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <b style={{ fontSize: '0.9rem', color: '#0f172a' }}>{sr.display_name}</b>
                            {sr.package_lpa && (
                              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#059669', background: '#ecfdf5', padding: '0.15rem 0.45rem', borderRadius: 4 }}>
                                {lpa(sr.package_lpa)}
                              </span>
                            )}
                          </div>
                          {sr.company_name && (
                            <div className="muted" style={{ fontSize: '0.78rem' }}>
                              {sr.company_name} {sr.role_title ? `&bull; ${sr.role_title}` : ''}
                            </div>
                          )}
                          <div style={{ fontSize: '0.75rem', color: '#0284c7', fontWeight: 600, marginTop: '0.2rem' }}>
                            Inspect Profile &rarr;
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Link to Senior Explorer filtered by this elective */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
                  <Link
                    href={`/seniors?elective=${encodeURIComponent(electiveData.title)}`}
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: 'var(--blue-deep, #0284c7)',
                      textDecoration: 'none',
                    }}
                  >
                    View All Seniors Placed with {electiveData.title} &rarr;
                  </Link>
                </div>
              </div>
            ) : (
              !electiveExperienceApi.loading && (
                <p className="muted" style={{ margin: 0, textAlign: 'center', padding: '1.5rem 0' }}>
                  Select an elective from the dropdown above to view real alumni ratings, packages, and recommendations.
                </p>
              )
            )}
          </div>

          {/* ======================================================== */}
          {/* SECTION B: ELECTIVE EXAM QUESTIONS (ISA 1 / ISA 2 / ESA) */}
          {/* ======================================================== */}
          <div className="card" style={{ padding: '1.5rem', marginBottom: '2.5rem', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 0.25rem 0' }}>
                  Elective Examination Questions
                </h2>
                <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                  Shared repository organized by elective. Practice authentic questions from ISA 1, ISA 2, and ESA assessments.
                </p>
              </div>

              <div style={{ minWidth: 280 }}>
                <select
                  value={examCourseId}
                  onChange={(e) => setExamCourseId(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: 6, border: '1px solid var(--border)', fontWeight: 600, background: '#fff' }}
                >
                  <option value="">-- Choose Elective Course --</option>
                  {allElectives.map((el) => (
                    <option key={el.course_id} value={el.course_id}>
                      {el.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Assessment Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              {['ISA1', 'ISA2', 'ESA'].map((typeKey) => (
                <button
                  key={typeKey}
                  type="button"
                  onClick={() => setExamTab(typeKey)}
                  style={{
                    padding: '0.45rem 1rem',
                    borderRadius: 6,
                    border: 'none',
                    background: examTab === typeKey ? 'var(--blue-deep, #0284c7)' : 'transparent',
                    color: examTab === typeKey ? '#fff' : 'var(--muted)',
                    fontWeight: examTab === typeKey ? 700 : 500,
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                  }}
                >
                  {typeKey === 'ISA1' ? 'ISA 1' : typeKey === 'ISA2' ? 'ISA 2' : 'ESA (End Semester)'}
                </button>
              ))}
            </div>

            <Loading state={examQuestionsApi} />

            {questionsList.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {questionsList.map((q) => (
                  <div
                    key={q.exam_question_id}
                    style={{
                      padding: '1.25rem',
                      borderRadius: 8,
                      background: '#f8fafc',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.6rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="tag blue" style={{ fontWeight: 700 }}>
                          {q.exam_type === 'ISA1' ? 'ISA 1' : q.exam_type === 'ISA2' ? 'ISA 2' : 'ESA'}
                        </span>
                        {q.topic && <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)' }}>Topic: {q.topic}</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, padding: '0.2rem 0.5rem', borderRadius: 4, background: '#fff', border: '1px solid var(--border)' }}>
                          {q.marks || 10} Marks
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                          Difficulty: {q.difficulty} / 5
                        </span>
                      </div>
                    </div>

                    <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 500, lineHeight: 1.5, color: '#0f172a' }}>
                      {q.question_text}
                    </p>

                    {q.answer_text && (
                      <div style={{ padding: '0.75rem', borderRadius: 6, background: '#f0f9ff', borderLeft: '3px solid #0284c7', fontSize: '0.85rem', color: '#0c4a6e' }}>
                        <div style={{ fontWeight: 700, marginBottom: '0.2rem' }}>Model Solution Outline:</div>
                        {q.answer_text}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--muted)', paddingTop: '0.25rem' }}>
                      <span>Semester {q.semester || 5} &bull; Year {q.year || 2025}</span>
                      <span>Contributed by {q.contributor_code ? `Senior #${q.contributor_code}` : 'Verified Alumni'}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              !examQuestionsApi.loading && (
                <p className="muted" style={{ margin: 0, textAlign: 'center', padding: '1.5rem 0' }}>
                  {examCourseId
                    ? `No ${examTab} questions currently logged for this elective. Try switching between ISA 1, ISA 2, or ESA.`
                    : 'Choose an elective course above to load practice exam questions.'}
                </p>
              )
            )}
          </div>

          {/* Semester-wise Grade Progression */}
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>Semester-Wise Grade Progression</h2>
          {d.gradeTrend?.length === 0 ? (
            <p className="muted small">No graded semesters completed yet.</p>
          ) : (
            <div className="card" style={{ marginBottom: '2rem', padding: '1.25rem' }}>
              <div className="row" style={{ alignItems: 'flex-end', gap: '2rem', height: 160, padding: '1rem 0' }}>
                {d.gradeTrend.map((t) => {
                  const heightPct = Math.max(15, (t.gpa / 10) * 100);
                  return (
                    <div key={t.term} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                      <span style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.4rem', color: 'var(--teal)' }}>
                        {fmt(t.gpa, 2)}
                      </span>
                      <div style={{ width: '100%', maxWidth: 48, background: 'rgba(255,255,255,0.06)', borderRadius: 4, height: 100, display: 'flex', alignItems: 'flex-end' }}>
                        <div style={{ width: '100%', height: `${heightPct}%`, background: 'var(--teal)', borderRadius: 4 }} />
                      </div>
                      <span className="small muted" style={{ marginTop: '0.5rem', fontWeight: 600 }}>{t.term}</span>
                      <span className="small muted" style={{ fontSize: '0.75rem' }}>{t.courses} courses ({t.credits} cr)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* My Enrollments Table (Clean: Strictly No Course Codes) */}
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>My Course Enrollments</h2>
          <div className="tablewrap" style={{ marginBottom: '2rem' }}>
            <table>
              <thead>
                <tr>
                  <th>Elective / Course Name</th>
                  <th>Term</th>
                  <th>Level</th>
                  <th>Credits</th>
                  <th>Status</th>
                  <th className="num">Grade points</th>
                </tr>
              </thead>
              <tbody>
                {d.enrollments.map((e) => (
                  <tr key={e.enrollment_id}>
                    <td>
                      <Link href={`/courses/${e.course_id}`} style={{ fontWeight: 600 }}>
                        {e.title}
                      </Link>
                    </td>
                    <td>{e.term}</td>
                    <td><span className="tag">{e.level}</span></td>
                    <td>{e.credits}</td>
                    <td>
                      <span className={`tag ${e.status === 'completed' ? 'green' : e.status === 'dropped' ? 'red' : 'blue'}`}>
                        {e.status}
                      </span>
                    </td>
                    <td className="num">
                      {e.grade_points !== null ? <b>{fmt(e.grade_points, 1)} / 10</b> : <span className="muted">Pending</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
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
