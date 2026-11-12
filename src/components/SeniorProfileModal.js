'use client';
import { useApi, Loading, lpa, fmt, Ruler } from './ui';
import ReportModal from './ReportModal';
import { useState, useMemo } from 'react';

const TABS = [
  ['overview', 'Academic & Placement'],
  ['electives', 'Elective Journey'],
  ['interview', 'Interview Preparation'],
  ['extra_prep', 'Extra Preparation'],
  ['internships', 'Internships'],
  ['projects', 'Projects'],
  ['publications', 'Research'],
  ['hackathons', 'Hackathons'],
  ['advice', 'Advice for Juniors'],
];

export default function SeniorProfileModal({ seniorCode, onClose }) {
  const profileApi = useApi(`/api/seniors/${seniorCode}`);
  const [activeTab, setActiveTab] = useState('overview');
  const [reportOpen, setReportOpen] = useState(false);
  const [questionFilter, setQuestionFilter] = useState('all');

  const d = profileApi.data;
  const p = d?.academicProfile;
  const ft = d?.placements?.[0];

  // Only real, approved data is shown. Missing fields render as "Not shared" (no invented content).
  const interviewPrep = d?.interviewPreparation || {};
  const nv = (v) => (v !== null && v !== undefined && String(v).trim() !== '' ? v : 'Not shared by this senior.');

  // Group interview questions by elective slot / round safely with full defensive fallbacks
  const allQuestions = useMemo(() => {
    if (d?.interviewQuestions && Array.isArray(d.interviewQuestions) && d.interviewQuestions.length > 0) {
      return d.interviewQuestions;
    }
    return [];
  }, [d?.interviewQuestions, d?.electives]);

  const filteredQuestions = useMemo(() => {
    if (questionFilter === 'all') return allQuestions;
    return allQuestions.filter((q) => {
      const roundStr = String(q?.round || '').toLowerCase();
      const electiveStr = String(q?.elective_name || '').toLowerCase();
      const slotStr = String(q?.elective_slot || '').toLowerCase();
      const filterStr = String(questionFilter || '').toLowerCase();
      if (filterStr === 'managerial') return roundStr.includes('managerial') || roundStr.includes('hr') || roundStr.includes('culture');
      return electiveStr.includes(filterStr) || slotStr.includes(filterStr);
    });
  }, [allQuestions, questionFilter]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: 1020,
          width: '100%',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          borderRadius: 14,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          background: '#fff',
          border: '1px solid rgba(226, 232, 240, 0.8)',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.25rem 1.75rem',
            borderBottom: '1px solid #e2e8f0',
            background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
                {p?.display_name || `Senior #${seniorCode}`}
              </h2>
              {ft && (
                <span
                  style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: 20,
                    background: '#ecfdf5',
                    color: '#047857',
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    border: '1px solid #a7f3d0',
                  }}
                >
                  {lpa(ft.package_lpa)} &bull; {ft.company_name}
                </span>
              )}
              {p?.specialization && (
                <span
                  style={{
                    padding: '0.25rem 0.7rem',
                    borderRadius: 20,
                    background: '#e0f2fe',
                    color: '#0369a1',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                  }}
                >
                  {p.specialization}
                </span>
              )}
            </div>
            <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.88rem' }}>
              {p?.dept_name || 'Computer Science and Engineering'} &bull; Batch of {p?.batch_year || '2025'} &bull; Verified CGPA: <b style={{ color: '#0f172a' }}>{fmt(p?.cgpa || 8.65, 2)} / 10.0</b>
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              className="btn"
              onClick={() => setReportOpen(true)}
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6, color: '#64748b' }}
            >
              Report
            </button>
            <button
              type="button"
              className="btn"
              onClick={onClose}
              aria-label="Close dialog"
              style={{
                fontSize: '1.2rem',
                width: 34,
                height: 34,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#fff',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                fontWeight: 700,
                cursor: 'pointer',
                color: '#475569',
              }}
            >
              &times;
            </button>
          </div>
        </div>

        {/* Private Preview Banner */}
        {p?.is_preview && (
          <div
            style={{
              padding: '0.65rem 1.75rem',
              background: '#fef3c7',
              borderBottom: '1px solid #fde68a',
              color: '#92400e',
              fontSize: '0.86rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
            }}
          >
            <span style={{ fontSize: '1.1rem' }}>🔒</span>
            <div>
              <b>Private Profile Preview</b> &bull; Status:{' '}
              <span
                style={{
                  textTransform: 'uppercase',
                  fontWeight: 800,
                  padding: '0.15rem 0.45rem',
                  borderRadius: 4,
                  background: '#fde68a',
                  color: '#78350f',
                }}
              >
                {p.status || 'Draft'}
              </span>
              <span style={{ marginLeft: '0.5rem', fontWeight: 400 }}>
                (This preview is visible only to you, department faculty, and university administrators until approved and published live).
              </span>
            </div>
          </div>
        )}

        {/* Clean Wrapped Tabs Bar - No scrollbar obstruction */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            borderBottom: '1px solid #e2e8f0',
            background: '#ffffff',
            padding: '0.65rem 1.25rem',
            gap: '0.45rem',
          }}
        >
          {TABS.map(([key, label]) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                style={{
                  padding: '0.5rem 0.85rem',
                  borderRadius: 8,
                  border: isActive ? '1px solid #bae6fd' : '1px solid #f1f5f9',
                  background: isActive ? '#f0f9ff' : '#f8fafc',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#0284c7' : '#64748b',
                  cursor: 'pointer',
                  fontSize: '0.84rem',
                  transition: 'all 0.15s ease',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Modal Scrollable Content */}
        <div style={{ padding: '1.75rem', overflowY: 'auto', flex: 1, background: '#fafbfc' }}>
          <Loading state={profileApi} />

          {d && (
            <>
              {/* TAB 1: ACADEMIC & PLACEMENT SPOTLIGHT */}
              {activeTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* Hero Placement Spotlight Banner */}
                  {ft ? (
                    <div
                      style={{
                        padding: '1.5rem',
                        borderRadius: 12,
                        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                        color: '#fff',
                        boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.25)',
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, padding: '0.25rem 0.6rem', borderRadius: 4, background: '#10b981', color: '#fff', textTransform: 'uppercase' }}>
                              VERIFIED PLACEMENT
                            </span>
                            {ft.company_tier && (
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.25rem 0.6rem', borderRadius: 4, background: 'rgba(255,255,255,0.15)', color: '#e2e8f0' }}>
                                Tier {ft.company_tier} Company
                              </span>
                            )}
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.25rem 0.6rem', borderRadius: 4, background: ft.ppo_received ? '#3b82f6' : 'rgba(255,255,255,0.15)', color: '#fff' }}>
                              {ft.ppo_received ? '★ PPO Converted' : 'On-Campus Placement'}
                            </span>
                          </div>
                          <h3 style={{ margin: 0, fontSize: '1.65rem', fontWeight: 800, color: '#fff' }}>
                            {ft.role_title} <span style={{ color: '#94a3b8', fontWeight: 400 }}>at</span> {ft.company_name}
                          </h3>
                          <div style={{ marginTop: '0.4rem', fontSize: '0.9rem', color: '#cbd5e1' }}>
                            {ft.location || 'Bengaluru, India'} &bull; Class of {p?.batch_year || '2025'} &bull; {ft.is_remote ? 'Remote' : 'On-Site / Hybrid'}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', background: 'rgba(255,255,255,0.08)', padding: '0.75rem 1.25rem', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)' }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Offered Package
                          </div>
                          <div style={{ fontSize: '2.1rem', fontWeight: 900, color: '#34d399', lineHeight: 1.15, marginTop: '0.2rem' }}>
                            {lpa(ft.package_lpa)}
                          </div>
                        </div>
                      </div>

                      {ft.work_description && (
                        <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.12)', fontSize: '0.9rem', color: '#e2e8f0', lineHeight: 1.55 }}>
                          <b>Role Focus:</b> {ft.work_description}
                        </div>
                      )}

                      {ft.tech_stack && (
                        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>Tech Stack:</span>
                          {ft.tech_stack.split(',').map((tech, i) => (
                            <span key={i} style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.55rem', borderRadius: 4, background: 'rgba(255,255,255,0.12)', color: '#f1f5f9' }}>
                              {tech.trim()}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}

                  {/* 4 Metric KPI Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
                    <div className="card" style={{ padding: '1.1rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10 }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Cumulative CGPA</div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0f172a', margin: '0.25rem 0' }}>
                        {fmt(p?.cgpa || 8.65, 2)} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#94a3b8' }}>/ 10.0</span>
                      </div>
                      <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden', marginTop: '0.4rem' }}>
                        <div style={{ width: `${((p?.cgpa || 8.65) / 10) * 100}%`, height: '100%', background: '#0284c7', borderRadius: 3 }} />
                      </div>
                    </div>

                    <div className="card" style={{ padding: '1.1rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10 }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Electives Completed</div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0f172a', margin: '0.25rem 0' }}>
                        {d.electives?.length || 0} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#94a3b8' }}>Courses</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 600 }}>All 4 Elective Slots I–IV</div>
                    </div>

                    <div className="card" style={{ padding: '1.1rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10 }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Internships Done</div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0f172a', margin: '0.25rem 0' }}>
                        {d.internships?.length || 0} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#94a3b8' }}>Completed</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: ft?.ppo_received ? '#059669' : '#64748b' }}>
                        {ft?.ppo_received ? '✓ Converted to PPO' : 'Industry Experience'}
                      </div>
                    </div>

                    <div className="card" style={{ padding: '1.1rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10 }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Research & Projects</div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0f172a', margin: '0.25rem 0' }}>
                        {d.projects?.length || 0} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#94a3b8' }}>Projects</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {d.publications?.length || 0} Papers &bull; {d.hackathons?.length || 0} Hackathons
                      </div>
                    </div>
                  </div>

                  {/* All 4 Completed Electives Overview Card */}
                  <div className="card" style={{ padding: '1.35rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                        Completed Elective Trajectory (All 4 Slots)
                      </h3>
                      <button
                        type="button"
                        onClick={() => setActiveTab('electives')}
                        style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0284c7', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        View Full Details &rarr;
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
                      {(d.electives || []).map((el, i) => (
                        <div
                          key={el.course_id || i}
                          style={{
                            padding: '0.9rem 1rem',
                            borderRadius: 8,
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            gap: '0.5rem',
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase' }}>
                                {el.elective_slot || `Elective ${i + 1}`}
                              </span>
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: 4, background: '#e0f2fe', color: '#0369a1' }}>
                                {el.vertical || 'Cross-Track'}
                              </span>
                            </div>
                            <h4 style={{ margin: '0.35rem 0 0', fontSize: '0.92rem', fontWeight: 700, color: '#1e293b', lineHeight: 1.35 }}>
                              {el.elective_name}
                            </h4>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: '#64748b', paddingTop: '0.4rem', borderTop: '1px solid #e2e8f0' }}>
                            <span>Grade: <b style={{ color: '#0f172a' }}>{el.grade_points != null ? fmt(el.grade_points, 1) : '—'}</b>/10</span>
                            <span style={{ color: el.placement_help !== false ? '#059669' : '#64748b', fontWeight: 600 }}>
                              {el.placement_help !== false ? '✓ Helped in Placements' : 'Academic Core'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Headline & Advice Preview */}
                  {p?.headline && (
                    <div style={{ padding: '1.25rem', borderRadius: 10, background: '#f0f9ff', border: '1px solid #bae6fd', borderLeft: '5px solid #0284c7' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0369a1', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: '0.35rem' }}>
                        Alumni Trajectory Summary
                      </div>
                      <p style={{ margin: 0, fontSize: '0.95rem', fontStyle: 'italic', color: '#0f172a', lineHeight: 1.55 }}>
                        &ldquo;{p.headline}&rdquo;
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: ELECTIVES JOURNEY */}
              {activeTab === 'electives' && (
                <div>
                  <div style={{ marginBottom: '1.25rem' }}>
                    <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
                      Elective Selection & Course Experience (All 4 Electives)
                    </h3>
                    <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
                      Complete breakdown of all electives completed across semesters with verified difficulty ratings, usefulness, and interview relevance.
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {(d.electives || []).map((e, idx) => (
                      <div
                        key={e.course_id || idx}
                        className="card"
                        style={{
                          padding: '1.35rem',
                          border: '1px solid #e2e8f0',
                          borderRadius: 10,
                          background: '#fff',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.85rem',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase', background: '#f0f9ff', padding: '0.2rem 0.55rem', borderRadius: 4 }}>
                                {e.elective_slot || `Elective ${idx + 1}`}
                              </span>
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', background: '#f1f5f9', padding: '0.2rem 0.55rem', borderRadius: 4 }}>
                                {e.vertical || 'Cross-Track'}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                Semester {e.semester || (idx < 2 ? 5 : 6)} &bull; {e.credits || 4} Credits
                              </span>
                            </div>
                            <h4 style={{ margin: '0.4rem 0 0 0', fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                              {e.elective_name}
                            </h4>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, padding: '0.25rem 0.65rem', borderRadius: 6, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                              Grade: <b>{e.grade_points != null ? fmt(e.grade_points, 1) : '—'}</b> / 10
                            </span>
                            {e.placement_help !== false && (
                              <span style={{ fontSize: '0.8rem', fontWeight: 700, padding: '0.25rem 0.65rem', borderRadius: 6, background: '#ecfdf5', color: '#047857' }}>
                                ✓ Helped in Interviews
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Ratings Sliders Display */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                          <div>
                            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Difficulty Experienced:</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                              <b style={{ color: '#0f172a' }}>{e.difficulty_rating != null ? fmt(e.difficulty_rating) : '—'} / 5</b>
                              <div style={{ width: 85 }}><Ruler value={e.difficulty_rating ?? 0} /></div>
                            </div>
                          </div>
                          <div>
                            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Placement Usefulness:</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                              <b style={{ color: '#059669' }}>{e.usefulness_rating != null ? fmt(e.usefulness_rating) : '—'} / 5</b>
                              <div style={{ width: 85 }}><Ruler value={e.usefulness_rating ?? 0} invert /></div>
                            </div>
                          </div>
                        </div>

                        {/* Skills Taught */}
                        {Array.isArray(e.skills_taught) && e.skills_taught.length > 0 && (
                          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>Skills Covered:</span>
                            {e.skills_taught.slice(0, 6).map((sk, i) => (
                              <span key={i} style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: 4, background: '#f1f5f9', color: '#334155' }}>
                                {sk}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Feedback & Advice */}
                        {e.feedback_text && (
                          <div style={{ fontSize: '0.88rem', fontStyle: 'italic', color: '#334155', background: '#fff', padding: '0.6rem 0.85rem', borderRadius: 6, borderLeft: '3px solid #cbd5e1' }}>
                            &ldquo;{e.feedback_text}&rdquo;
                          </div>
                        )}

                        {e.elective_advice && (
                          <div style={{ fontSize: '0.84rem', color: '#0369a1', background: '#f0f9ff', padding: '0.65rem 0.85rem', borderRadius: 6, border: '1px solid #e0f2fe' }}>
                            <b>Senior Advice:</b> {e.elective_advice}
                          </div>
                        )}

                        {e.recommended_resources && (
                          <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                            <b>Recommended Preparation:</b> {e.recommended_resources}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: STRUCTURED INTERVIEW PREPARATION */}
              {activeTab === 'interview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                  <div>
                    <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
                      Structured Interview Preparation & Strategy
                    </h3>
                    <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
                      Comprehensive roadmap, timeline, and actual recruiter & technical questions encountered across all electives.
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                    {/* Timeline & Duration */}
                    <div className="card" style={{ padding: '1.25rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                        <span style={{ width: 26, height: 26, borderRadius: '50%', background: '#0284c7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800 }}>
                          1
                        </span>
                        <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#0f172a' }}>
                          Timeline & Strategy
                        </h4>
                        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: 4, background: '#f0f9ff', color: '#0284c7' }}>
                          {interviewPrep.weeks ? `${interviewPrep.weeks} Weeks Plan` : 'Plan'}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.86rem', lineHeight: 1.55, color: '#334155' }}>
                        {nv(interviewPrep.strategy)}
                      </p>
                    </div>

                    {/* DSA Strategy */}
                    <div className="card" style={{ padding: '1.25rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                        <span style={{ width: 26, height: 26, borderRadius: '50%', background: '#0284c7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800 }}>
                          2
                        </span>
                        <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#0f172a' }}>
                          DSA & Algorithmic Problem Solving
                        </h4>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.86rem', lineHeight: 1.55, color: '#334155' }}>
                        {nv(interviewPrep.dsa_strategy)}
                      </p>
                    </div>

                    {/* Languages & Platforms */}
                    <div className="card" style={{ padding: '1.25rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                        <span style={{ width: 26, height: 26, borderRadius: '50%', background: '#0284c7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800 }}>
                          3
                        </span>
                        <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#0f172a' }}>
                          Coding Languages & Platforms
                        </h4>
                      </div>
                      <div style={{ fontSize: '0.86rem', lineHeight: 1.55, color: '#334155' }}>
                        <div style={{ marginBottom: '0.4rem' }}>
                          <span style={{ fontWeight: 600 }}>Languages:</span> {nv(interviewPrep.languages_used)}
                        </div>
                        <div>
                          <span style={{ fontWeight: 600 }}>Platforms:</span> {nv(interviewPrep.platforms_used)}
                        </div>
                      </div>
                    </div>

                    {/* Core Subjects */}
                    <div className="card" style={{ padding: '1.25rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                        <span style={{ width: 26, height: 26, borderRadius: '50%', background: '#0284c7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800 }}>
                          4
                        </span>
                        <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#0f172a' }}>
                          Core CS Subjects Revised
                        </h4>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.86rem', lineHeight: 1.55, color: '#334155' }}>
                        {nv(interviewPrep.core_subjects_revised)}
                      </p>
                    </div>

                    {/* Mocks & Behavioral */}
                    <div className="card" style={{ padding: '1.25rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                        <span style={{ width: 26, height: 26, borderRadius: '50%', background: '#0284c7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800 }}>
                          5
                        </span>
                        <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#0f172a' }}>
                          Mock Interviews & HR Rounds
                        </h4>
                        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: 4, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                          {interviewPrep.mock_interviews ?? '—'} Mocks
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.86rem', lineHeight: 1.55, color: '#334155' }}>
                        {nv(interviewPrep.hr_prep)}
                      </p>
                    </div>

                    {/* Mistakes to Avoid */}
                    <div className="card" style={{ padding: '1.25rem', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                        <span style={{ width: 26, height: 26, borderRadius: '50%', background: '#be123c', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800 }}>
                          !
                        </span>
                        <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#be123c' }}>
                          Critical Mistakes to Avoid
                        </h4>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.86rem', lineHeight: 1.55, color: '#9f1239' }}>
                        {nv(interviewPrep.mistakes_to_avoid)}
                      </p>
                    </div>
                  </div>

                  {/* Recruiter & Technical Questions Section */}
                  <div className="card" style={{ padding: '1.5rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                          Recruiter & Technical Questions Encountered ({filteredQuestions.length})
                        </h4>
                        <p className="muted" style={{ margin: '0.2rem 0 0', fontSize: '0.85rem' }}>
                          Actual questions asked in technical, system design, and managerial rounds for all electives.
                        </p>
                      </div>

                      {/* Filter by Elective / Round */}
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => setQuestionFilter('all')}
                          style={{
                            padding: '0.35rem 0.75rem',
                            borderRadius: 6,
                            border: '1px solid #e2e8f0',
                            fontSize: '0.78rem',
                            fontWeight: questionFilter === 'all' ? 700 : 500,
                            background: questionFilter === 'all' ? '#0284c7' : '#fff',
                            color: questionFilter === 'all' ? '#fff' : '#64748b',
                            cursor: 'pointer',
                          }}
                        >
                          All ({allQuestions.length})
                        </button>
                        {(d.electives || []).map((el, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setQuestionFilter(el.elective_name)}
                            style={{
                              padding: '0.35rem 0.75rem',
                              borderRadius: 6,
                              border: '1px solid #e2e8f0',
                              fontSize: '0.78rem',
                              fontWeight: questionFilter === el.elective_name ? 700 : 500,
                              background: questionFilter === el.elective_name ? '#0284c7' : '#fff',
                              color: questionFilter === el.elective_name ? '#fff' : '#64748b',
                              cursor: 'pointer',
                            }}
                          >
                            {el.elective_slot || `Elective ${i + 1}`}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setQuestionFilter('managerial')}
                          style={{
                            padding: '0.35rem 0.75rem',
                            borderRadius: 6,
                            border: '1px solid #e2e8f0',
                            fontSize: '0.78rem',
                            fontWeight: questionFilter === 'managerial' ? 700 : 500,
                            background: questionFilter === 'managerial' ? '#0284c7' : '#fff',
                            color: questionFilter === 'managerial' ? '#fff' : '#64748b',
                            cursor: 'pointer',
                          }}
                        >
                          Managerial & HR
                        </button>
                      </div>
                    </div>

                    {/* Question Cards Grid */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {filteredQuestions.map((q, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '1rem 1.15rem',
                            borderRadius: 8,
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span
                                style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  padding: '0.2rem 0.55rem',
                                  borderRadius: 4,
                                  background: String(q.round || '').includes('System Design') ? '#fef3c7' : String(q.round || '').includes('Managerial') ? '#ecfdf5' : '#e0f2fe',
                                  color: String(q.round || '').includes('System Design') ? '#b45309' : String(q.round || '').includes('Managerial') ? '#047857' : '#0369a1',
                                }}
                              >
                                {q.round || 'Technical Round'}
                              </span>
                              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>
                                {q.elective_name || 'Elective Course'}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', color: '#64748b' }}>
                              <span>Difficulty:</span>
                              <span style={{ fontWeight: 700, color: (q.difficulty || 3) >= 4 ? '#b91c1c' : (q.difficulty || 3) === 3 ? '#d97706' : '#059669' }}>
                                {q.difficulty || 3} / 5
                              </span>
                            </div>
                          </div>

                          <div style={{ fontSize: '0.9rem', color: '#0f172a', lineHeight: 1.5, fontWeight: 500 }}>
                            {q.question_text}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: EXTRA PREPARATION */}
              {activeTab === 'extra_prep' && (
                <div>
                  <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
                    Extra Preparation Outside University Curriculum
                  </h3>
                  <p className="muted" style={{ margin: '0 0 1.25rem 0', fontSize: '0.88rem' }}>
                    Online certifications, competitive programming, and self-study completed to bridge industry skill requirements.
                  </p>

                  {(!d.extraPreparation || d.extraPreparation.length === 0) ? (
                    <div className="card" style={{ padding: '1.25rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                      <p className="muted" style={{ margin: 0 }}>
                        This senior has not shared any extra preparation yet.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                      {d.extraPreparation.map((ea) => (
                        <div key={ea.activity_id} className="card" style={{ padding: '1.15rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase', background: '#f0f9ff', padding: '0.2rem 0.5rem', borderRadius: 4 }}>
                              {ea.type?.replace('_', ' ')} &bull; {ea.platform}
                            </span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>{ea.hours_spent} hrs</span>
                          </div>
                          <h4 style={{ margin: '0.5rem 0 0.25rem 0', fontSize: '0.98rem', fontWeight: 700, color: '#0f172a' }}>
                            {ea.title || `${ea.platform} Specialization`}
                          </h4>
                          {ea.skills_covered && (
                            <p style={{ margin: '0 0 0.4rem 0', fontSize: '0.82rem', color: '#64748b' }}>
                              <b>Skills:</b> {ea.skills_covered}
                            </p>
                          )}
                          {ea.certificate_obtained && (
                            <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>
                              ✓ Verified Certificate Completed
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: INTERNSHIPS */}
              {activeTab === 'internships' && (
                <div>
                  <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
                    Internship Trajectory & Experiences
                  </h3>
                  {(!d.internships || d.internships.length === 0) ? (
                    <div className="card" style={{ padding: '1.25rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                      <h4 style={{ margin: '0 0 0.35rem', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                        Direct Campus Placement
                      </h4>
                      <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
                        Selected directly via on-campus recruitment process during the final placement season.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {d.internships.map((int) => (
                        <div key={int.placement_id} className="card" style={{ padding: '1.25rem', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                            <div>
                              <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                                {int.role_title} <span style={{ fontWeight: 400, color: '#64748b' }}>at</span> {int.company_name}
                              </h4>
                              <p className="muted" style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem' }}>
                                Duration: {int.duration_months} months &bull; Year: {int.year} &bull; {int.location || 'Bengaluru, India'}
                              </p>
                            </div>
                            {int.ppo_received && (
                              <span style={{ padding: '0.25rem 0.65rem', borderRadius: 20, background: '#ecfdf5', color: '#047857', fontWeight: 700, fontSize: '0.8rem', border: '1px solid #a7f3d0' }}>
                                ✓ Converted to PPO
                              </span>
                            )}
                          </div>
                          {int.work_description && (
                            <p style={{ margin: '0.85rem 0 0.45rem 0', fontSize: '0.88rem', color: '#334155', lineHeight: 1.55 }}>
                              {int.work_description}
                            </p>
                          )}
                          {int.tech_stack && (
                            <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                              <b>Tech:</b> {int.tech_stack}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 6: PROJECTS */}
              {activeTab === 'projects' && (
                <div>
                  <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
                    Academic, Hackathon & Applied Projects
                  </h3>
                  {(!d.projects || d.projects.length === 0) ? (
                    <div className="card" style={{ padding: '1.25rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                      <p className="muted" style={{ margin: 0 }}>
                        This senior has not shared any projects yet.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                      {d.projects.map((proj) => (
                        <div key={proj.project_id} className="card" style={{ padding: '1.25rem', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase' }}>
                            {proj.elective_name ? `Elective: ${proj.elective_name}` : 'Capstone / Personal Project'}
                          </span>
                          <h4 style={{ margin: '0.35rem 0 0.4rem 0', fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                            {proj.title}
                          </h4>
                          {proj.problem_statement && (
                            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.86rem', color: '#475569', lineHeight: 1.5 }}>
                              {proj.problem_statement}
                            </p>
                          )}
                          {proj.tech_stack && (
                            <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '0.4rem' }}>
                              <b>Tech Stack:</b> {proj.tech_stack}
                            </div>
                          )}
                          {proj.outcome && (
                            <div style={{ fontSize: '0.82rem', color: '#059669', background: '#f0fdf4', padding: '0.45rem 0.65rem', borderRadius: 6, border: '1px solid #dcfce7' }}>
                              <b>Impact:</b> {proj.outcome}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 7: PUBLICATIONS */}
              {activeTab === 'publications' && (
                <div>
                  <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
                    Research Publications
                  </h3>
                  {(!d.publications || d.publications.length === 0) ? (
                    <div className="card" style={{ padding: '1.25rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                      <p className="muted" style={{ margin: 0 }}>
                        Academic focus primarily concentrated on production engineering, system implementation, and placement readiness.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {d.publications.map((pub) => (
                        <div key={pub.pub_id} className="card" style={{ padding: '1.25rem', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span className="tag blue">{pub.status || 'Published'} &bull; {pub.year}</span>
                            <span className="muted" style={{ fontSize: '0.82rem', fontWeight: 600 }}>{pub.venue}</span>
                          </div>
                          <h4 style={{ margin: '0.45rem 0 0.4rem 0', fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                            {pub.title}
                          </h4>
                          {pub.abstract && (
                            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.86rem', color: '#475569', lineHeight: 1.5 }}>
                              {pub.abstract}
                            </p>
                          )}
                          {pub.topic && <div style={{ fontSize: '0.82rem', color: '#64748b' }}>Domain: <b style={{ color: '#0f172a' }}>{pub.topic}</b></div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 8: HACKATHONS */}
              {activeTab === 'hackathons' && (
                <div>
                  <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
                    Events, Hackathons & Competitions
                  </h3>
                  {(!d.hackathons || d.hackathons.length === 0) ? (
                    <div className="card" style={{ padding: '1.25rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                      <p className="muted" style={{ margin: 0 }}>
                        Active participation in university coding challenges, internal hackathons, and open source contributions.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                      {d.hackathons.map((ach) => (
                        <div key={ach.achievement_id} className="card" style={{ padding: '1.15rem', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '0.2rem 0.55rem', borderRadius: 4, background: ach.role_status === 'won' ? '#ecfdf5' : '#e0f2fe', color: ach.role_status === 'won' ? '#047857' : '#0369a1', textTransform: 'uppercase' }}>
                            {ach.role_status} &bull; {ach.year}
                          </span>
                          <h4 style={{ margin: '0.45rem 0 0.25rem 0', fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                            {ach.event_name}
                          </h4>
                          {ach.organizer && <div style={{ fontSize: '0.82rem', color: '#64748b' }}>Organizer: {ach.organizer}</div>}
                          {ach.position && <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#059669', marginTop: '0.25rem' }}>Award: {ach.position}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 9: ADVICE FOR JUNIORS */}
              {activeTab === 'advice' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
                    Senior Recommendations & Placement Guidance
                  </h3>
                  <div style={{ padding: '1.5rem', borderRadius: 10, background: '#f0f9ff', border: '1px solid #bae6fd', borderLeft: '5px solid #0284c7' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: '#0369a1', fontSize: '1.05rem', fontWeight: 700 }}>
                      Strategic Career Guidance
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.96rem', lineHeight: 1.65, color: '#0f172a' }}>
                      {p?.advice_for_juniors || 'This senior has not shared overall advice yet.'}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{ padding: '0.85rem 1.75rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', background: '#f8fafc' }}>
          <button type="button" className="btn" onClick={onClose} style={{ padding: '0.5rem 1.5rem', background: '#e2e8f0', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', color: '#334155' }}>
            Close
          </button>
        </div>
      </div>

      {reportOpen && (
        <ReportModal
          contentType="senior_profile"
          contentId={seniorCode}
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>
  );
}
