'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useApi, api, Loading, Notice, useAction, fmt, lpa, Tabs } from './ui';
import ReportModal from './ReportModal';
import SeniorProfileModal from './SeniorProfileModal';

export default function FacultyDashboard() {
  const [tab, setTab] = useState('overview');
  const [reviewSubTab, setReviewSubTab] = useState('profiles');
  const facApi = useApi('/api/faculty/dashboard');
  const reviewApi = useApi('/api/faculty/review');
  const [reportTarget, setReportTarget] = useState(null); // { type, id }
  const [inspectSeniorCode, setInspectSeniorCode] = useState(null);
  const [s, run] = useAction();

  // Rating form state
  const [ratingCourseId, setRatingCourseId] = useState('');
  const [rel, setRel] = useState(4);
  const [scope, setScope] = useState(4);
  const [comment, setComment] = useState('');

  // Feedback search & filter
  const [fbSearch, setFbSearch] = useState('');
  const [fbTerm, setFbTerm] = useState('');
  const [fbMinRating, setFbMinRating] = useState('');

  const d = facApi.data;
  const faculty = d?.faculty;
  const courses = d?.courses || [];
  const peer = d?.peerComparison;

  const handleSelectCourseToRate = (course) => {
    setRatingCourseId(course.course_id);
    setRel(course.relevance || 4);
    setScope(course.future_scope || 4);
    setComment(course.faculty_comment || '');
    setTab('rate');
  };

  const pendingTotal =
    (reviewApi.data?.metrics?.pendingProfilesCount || 0) +
    (reviewApi.data?.metrics?.pendingFeedbackCount || 0) +
    (reviewApi.data?.metrics?.pendingQuestionsCount || 0);

  return (
    <div>
      {/* 3.1 Overview Header: Name, designation, department */}
      <div className="page-head">
        <div>
          <h1>{faculty?.name || 'Faculty Portal'}</h1>
          <p className="muted">
            <b>{faculty?.designation || 'Faculty Member'}</b> · Department of <b>{faculty?.dept_name}</b>
          </p>
        </div>
        <div className="row" style={{ gap: '0.5rem' }}>
          <Link href="/market-trends" className="btn ghost small">
            View market trends &rarr;
          </Link>
        </div>
      </div>

      <Notice error={s.error} ok={s.ok} />
      <Loading state={facApi} />

      <Tabs
        tabs={[
          ['overview', 'Overview & course cards'],
          ['senior_reviews', `Senior Submissions (${pendingTotal}) — advisory`],
          ['rate', 'Rate my courses'],
          ['feedback', 'Student feedback on my courses'],
        ]}
        value={tab}
        onChange={setTab}
      />

      {/* 3.1 Overview Tab */}
      {d && tab === 'overview' && (
        <div style={{ marginTop: '1.5rem' }}>
          {/* Pending actions notification */}
          {d.pendingActions?.unratedCount > 0 && (
            <div className="card" style={{ background: 'rgba(237, 137, 54, 0.08)', borderColor: 'var(--amber)', marginBottom: '1.5rem' }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0, color: 'var(--amber)' }}>Pending course evaluation</h4>
                  <p className="small muted" style={{ margin: '0.2rem 0 0' }}>
                    You have <b>{d.pendingActions.unratedCount}</b> course{d.pendingActions.unratedCount > 1 ? 's' : ''} awaiting your faculty relevance and future-scope rating.
                  </p>
                </div>
                <button className="btn small" onClick={() => setTab('rate')}>
                  Complete rating now &rarr;
                </button>
              </div>
            </div>
          )}

          {/* Course Summary Cards Grid */}
          <div className="grid g3">
            {courses.map((c) => (
              <div key={c.course_id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <span className="tag blue">{c.code}</span>
                    <span className="tag">{c.level}</span>
                  </div>
                  <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.15rem' }}>{c.title}</h3>
                  <p className="small muted" style={{ margin: '0 0 0.75rem 0' }}>
                    Semester {c.semester} &bull; {c.credits} Credits &bull; {c.enrollment_count} Active Enrolled ({c.completed_count} Completed)
                  </p>

                  <div className="grid g2" style={{ gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <div style={{ padding: '0.5rem', background: 'var(--bg-subtle)', borderRadius: 6 }}>
                      <span className="small muted" style={{ display: 'block' }}>Difficulty</span>
                      <b>{fmt(c.avg_difficulty)} / 5</b>
                    </div>
                    <div style={{ padding: '0.5rem', background: 'var(--bg-subtle)', borderRadius: 6 }}>
                      <span className="small muted" style={{ display: 'block' }}>Usefulness</span>
                      <b style={{ color: '#059669' }}>{fmt(c.avg_usefulness)} / 5</b>
                    </div>
                  </div>

                  {c.placed_students > 0 && (
                    <p className="small muted" style={{ margin: 0 }}>
                      <b>{c.placed_students}</b> alumni placed &bull; Avg <b>{lpa(c.avg_package)}</b>
                    </p>
                  )}
                </div>

                <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                  <button className="btn ghost small" style={{ width: '100%' }} onClick={() => handleSelectCourseToRate(c)}>
                    {c.relevance ? 'Update Evaluation' : 'Evaluate Course'} &rarr;
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'senior_reviews' && (
        <>
        <div className="card" style={{ marginTop: '1.5rem', background: 'rgba(2, 132, 199, 0.06)' }}>
          <b>Your review is advisory.</b>{' '}
          <span className="small muted">Endorse items or request corrections here. Only the administrator can publish senior content to students.</span>
        </div>
        <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Header & Metrics Bar */}
          <div className="card" style={{ padding: '1.25rem', background: '#fff', borderTop: '4px solid var(--blue-deep, #0284c7)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800 }}>Senior Submissions &amp; Academic Review</h2>
                <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
                  Review academic trajectories, elective experiences, and past exam questions submitted by graduating seniors of <b>{reviewApi.data?.department || faculty?.dept_name}</b>.
                </p>
              </div>
              <button
                type="button"
                className="btn ghost small"
                onClick={() => reviewApi.reload()}
                style={{ fontSize: '0.82rem' }}
              >
                Refresh Queue
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div style={{ padding: '0.75rem 1rem', borderRadius: 8, background: '#f0f9ff', border: '1px solid #bae6fd' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase' }}>Profiles Pending Review</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0284c7', marginTop: '0.15rem' }}>
                  {reviewApi.data?.metrics?.pendingProfilesCount || 0}
                </div>
              </div>
              <div style={{ padding: '0.75rem 1rem', borderRadius: 8, background: '#fef3c7', border: '1px solid #fde68a' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase' }}>Elective Feedback</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#d97706', marginTop: '0.15rem' }}>
                  {reviewApi.data?.metrics?.pendingFeedbackCount || 0}
                </div>
              </div>
              <div style={{ padding: '0.75rem 1rem', borderRadius: 8, background: '#f5f3ff', border: '1px solid #ddd6fe' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6d28d9', textTransform: 'uppercase' }}>Exam Questions</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#7c3aed', marginTop: '0.15rem' }}>
                  {reviewApi.data?.metrics?.pendingQuestionsCount || 0}
                </div>
              </div>
              <div style={{ padding: '0.75rem 1rem', borderRadius: 8, background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#065f46', textTransform: 'uppercase' }}>Faculty Endorsed</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#059669', marginTop: '0.15rem' }}>
                  {reviewApi.data?.metrics?.endorsedProfilesCount || 0}
                </div>
              </div>
            </div>
          </div>

          {/* Sub Navigation Bar */}
          <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
            <button
              type="button"
              className={`btn ${reviewSubTab === 'profiles' ? 'primary' : 'ghost'} small`}
              onClick={() => setReviewSubTab('profiles')}
            >
              Academic Profiles &amp; Trajectories ({reviewApi.data?.profiles?.length || 0})
            </button>
            <button
              type="button"
              className={`btn ${reviewSubTab === 'feedback' ? 'primary' : 'ghost'} small`}
              onClick={() => setReviewSubTab('feedback')}
            >
              Elective Feedback &amp; Ratings ({reviewApi.data?.feedbackList?.length || 0})
            </button>
            <button
              type="button"
              className={`btn ${reviewSubTab === 'questions' ? 'primary' : 'ghost'} small`}
              onClick={() => setReviewSubTab('questions')}
            >
              Examination Questions ({reviewApi.data?.questionsList?.length || 0})
            </button>
          </div>

          <Loading state={reviewApi} />

          {/* Sub-Tab 1: Academic Profiles */}
          {reviewSubTab === 'profiles' && (
            <div className="card" style={{ padding: '1.25rem' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.15rem', fontWeight: 700 }}>
                Senior Academic Profiles &amp; Elective Selections
              </h3>
              {(!reviewApi.data?.profiles || reviewApi.data.profiles.length === 0) ? (
                <p className="muted" style={{ margin: 0, textAlign: 'center', padding: '2rem 0' }}>
                  No senior submissions currently awaiting faculty review in this department.
                </p>
              ) : (
                <div className="tablewrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Senior</th>
                        <th>SRN &amp; Batch</th>
                        <th className="num">CGPA</th>
                        <th>Placement Offer</th>
                        <th>Completed Electives</th>
                        <th>Status</th>
                        <th>Review Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reviewApi.data.profiles.map((p) => (
                        <tr key={p.student_id}>
                          <td>
                            <b>#{p.senior_code}</b>
                            <div style={{ fontSize: '0.85rem', color: '#334155' }}>{p.student_name}</div>
                            {p.headline && <div className="muted" style={{ fontSize: '0.78rem' }}>{p.headline}</div>}
                          </td>
                          <td>
                            <div>{p.srn}</div>
                            <div className="muted" style={{ fontSize: '0.78rem' }}>Class of {p.batch_year}</div>
                          </td>
                          <td className="num">
                            <b style={{ color: '#059669', fontSize: '1rem' }}>{fmt(p.cgpa, 2)}</b>
                          </td>
                          <td>
                            {p.company_name ? (
                              <div>
                                <b>{p.company_name}</b> {p.package_lpa ? `(${lpa(p.package_lpa)})` : ''}
                                <div className="muted" style={{ fontSize: '0.78rem' }}>{p.role_title}</div>
                              </div>
                            ) : (
                              <span className="muted">None recorded</span>
                            )}
                          </td>
                          <td>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{p.elective_count} Electives</div>
                            <div className="muted" style={{ fontSize: '0.75rem', maxWidth: 220 }}>
                              {Array.isArray(p.elective_titles) ? p.elective_titles.map((el) => el.title).join(', ') : ''}
                            </div>
                          </td>
                          <td>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '0.2rem 0.55rem',
                                borderRadius: 12,
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                background:
                                  p.status === 'published' ? '#dcfce7' :
                                  p.status === 'faculty_approved' ? '#e0f2fe' :
                                  p.status === 'submitted' ? '#fef3c7' :
                                  p.status === 'changes_requested' ? '#fee2e2' : '#f1f5f9',
                                color:
                                  p.status === 'published' ? '#15803d' :
                                  p.status === 'faculty_approved' ? '#0369a1' :
                                  p.status === 'submitted' ? '#b45309' :
                                  p.status === 'changes_requested' ? '#b91c1c' : '#475569',
                              }}
                            >
                              {p.status}
                            </span>
                            {p.faculty_notes && (
                              <div className="muted" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                                Notes: {p.faculty_notes}
                              </div>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                              <button
                                type="button"
                                className="btn ghost small"
                                onClick={() => setInspectSeniorCode(p.senior_code)}
                                style={{ padding: '0.25rem 0.55rem', fontSize: '0.78rem' }}
                              >
                                Inspect Full Profile
                              </button>
                              {p.status !== 'faculty_approved' && p.status !== 'published' && (
                                <button
                                  type="button"
                                  className="btn small"
                                  onClick={() => run(async () => {
                                    await api('/api/faculty/review', {
                                      method: 'POST',
                                      body: {
                                        action: 'endorse_profile',
                                        studentId: p.student_id,
                                        seniorCode: p.senior_code,
                                        notes: 'Academic trajectory and course selections verified by faculty.'
                                      }
                                    });
                                    reviewApi.reload();
                                  }, `Endorsed ${p.senior_code}! Advanced to Admin Publication Queue.`)}
                                  style={{ padding: '0.25rem 0.55rem', fontSize: '0.78rem', background: '#059669', color: '#fff', border: 'none' }}
                                >
                                  Endorse Academic Profile &rarr;
                                </button>
                              )}
                              {p.status !== 'changes_requested' && (
                                <button
                                  type="button"
                                  className="btn danger ghost small"
                                  onClick={() => {
                                    const notes = prompt(`Correction notes for Senior #${p.senior_code}:`, 'Please revise elective difficulty reflections and provide additional project details.');
                                    if (notes) {
                                      run(async () => {
                                        await api('/api/faculty/review', {
                                          method: 'POST',
                                          body: { action: 'request_changes_profile', studentId: p.student_id, seniorCode: p.senior_code, notes }
                                        });
                                        reviewApi.reload();
                                      }, 'Requested revisions from senior.');
                                    }
                                  }}
                                  style={{ padding: '0.25rem 0.55rem', fontSize: '0.78rem' }}
                                >
                                  Request Corrections
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Sub-Tab 2: Elective Feedback */}
          {reviewSubTab === 'feedback' && (
            <div className="card" style={{ padding: '1.25rem' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.15rem', fontWeight: 700 }}>
                Elective Reviews &amp; Course Feedback Moderation
              </h3>
              {(!reviewApi.data?.feedbackList || reviewApi.data.feedbackList.length === 0) ? (
                <p className="muted" style={{ margin: 0, textAlign: 'center', padding: '2rem 0' }}>
                  No feedback items logged for courses in your department.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {reviewApi.data.feedbackList.map((fb) => (
                    <div
                      key={fb.feedback_id}
                      style={{
                        padding: '1rem 1.25rem',
                        borderRadius: 8,
                        background: '#f8fafc',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.6rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div>
                          <b style={{ fontSize: '1.05rem', color: '#0f172a' }}>{fb.elective_name}</b> &bull; <span className="tag blue">{fb.elective_slot}</span>
                          <span className="muted" style={{ marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                            by Senior #{fb.senior_code} ({fb.student_name})
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontSize: '0.85rem' }}>Difficulty: <b>{fb.difficulty}/5</b></span>
                          <span style={{ fontSize: '0.85rem', color: '#059669' }}>Usefulness: <b>{fb.usefulness}/5</b></span>
                          <span
                            style={{
                              padding: '0.15rem 0.5rem',
                              borderRadius: 10,
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              background: fb.moderation_status === 'approved' ? '#dcfce7' : fb.moderation_status === 'pending' ? '#fef3c7' : '#fee2e2',
                              color: fb.moderation_status === 'approved' ? '#15803d' : fb.moderation_status === 'pending' ? '#b45309' : '#b91c1c',
                            }}
                          >
                            {fb.moderation_status}
                          </span>
                        </div>
                      </div>

                      {fb.review_text && (
                        <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.5, color: '#334155' }}>
                          &ldquo;{fb.review_text}&rdquo;
                        </p>
                      )}
                      {fb.advice_for_juniors && (
                        <div style={{ fontSize: '0.84rem', color: '#0369a1' }}>
                          <b>Advice for Juniors:</b> {fb.advice_for_juniors}
                        </div>
                      )}
                      {fb.recommended_resources && (
                        <div style={{ fontSize: '0.82rem', color: '#475569' }}>
                          <b>Resources:</b> {fb.recommended_resources}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                        {fb.moderation_status !== 'approved' && (
                          <button
                            type="button"
                            className="btn small"
                            onClick={() => run(async () => {
                              await api('/api/faculty/review', {
                                method: 'POST',
                                body: { action: 'approve_feedback', feedbackId: fb.feedback_id }
                              });
                              reviewApi.reload();
                            }, 'Feedback approved and published live.')}
                            style={{ background: '#059669', color: '#fff', border: 'none', padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                          >
                            Endorse Feedback
                          </button>
                        )}
                        {fb.moderation_status !== 'rejected' && (
                          <button
                            type="button"
                            className="btn danger small"
                            onClick={() => run(async () => {
                              await api('/api/faculty/review', {
                                method: 'POST',
                                body: { action: 'reject_feedback', feedbackId: fb.feedback_id }
                              });
                              reviewApi.reload();
                            }, 'Feedback rejected.')}
                            style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                          >
                            Reject
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sub-Tab 3: Past Exam Questions */}
          {reviewSubTab === 'questions' && (
            <div className="card" style={{ padding: '1.25rem' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.15rem', fontWeight: 700 }}>
                Past Examination Questions Verification
              </h3>
              {(!reviewApi.data?.questionsList || reviewApi.data.questionsList.length === 0) ? (
                <p className="muted" style={{ margin: 0, textAlign: 'center', padding: '2rem 0' }}>
                  No examination questions pending review.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {reviewApi.data.questionsList.map((eq) => (
                    <div
                      key={eq.exam_question_id}
                      style={{
                        padding: '1.1rem 1.25rem',
                        borderRadius: 8,
                        background: '#f8fafc',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.6rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ padding: '0.2rem 0.5rem', borderRadius: 4, background: '#e0f2fe', color: '#0369a1', fontWeight: 700, fontSize: '0.78rem' }}>
                            {eq.exam_type} &bull; {eq.year}
                          </span>
                          <b style={{ fontSize: '1rem', color: '#0f172a' }}>{eq.elective_name}</b>
                          {eq.topic && <span className="muted" style={{ fontSize: '0.82rem' }}>({eq.topic})</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.82rem' }}>Marks: <b>{eq.marks || 10}</b></span>
                          <span
                            style={{
                              padding: '0.15rem 0.5rem',
                              borderRadius: 10,
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              background: eq.status === 'approved' ? '#dcfce7' : eq.status === 'pending' ? '#fef3c7' : '#fee2e2',
                              color: eq.status === 'approved' ? '#15803d' : eq.status === 'pending' ? '#b45309' : '#b91c1c',
                            }}
                          >
                            {eq.status}
                          </span>
                        </div>
                      </div>

                      <div style={{ fontSize: '0.9rem', color: '#1e293b', fontWeight: 600 }}>
                        Q: {eq.question_text}
                      </div>
                      {eq.answer_text && (
                        <div style={{ padding: '0.75rem', borderRadius: 6, background: '#fff', border: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#334155', lineHeight: 1.55 }}>
                          <b>Model Solution / Answer Key:</b>
                          <div style={{ marginTop: '0.25rem' }}>{eq.answer_text}</div>
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                        {eq.status !== 'approved' && (
                          <button
                            type="button"
                            className="btn small"
                            onClick={() => run(async () => {
                              await api('/api/faculty/review', {
                                method: 'POST',
                                body: { action: 'approve_exam_question', questionId: eq.exam_question_id }
                              });
                              reviewApi.reload();
                            }, 'Exam question approved and published to student repository.')}
                            style={{ background: '#059669', color: '#fff', border: 'none', padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                          >
                            Endorse Question
                          </button>
                        )}
                        {eq.status !== 'rejected' && (
                          <button
                            type="button"
                            className="btn danger small"
                            onClick={() => run(async () => {
                              await api('/api/faculty/review', {
                                method: 'POST',
                                body: { action: 'reject_exam_question', questionId: eq.exam_question_id }
                              });
                              reviewApi.reload();
                            }, 'Question rejected.')}
                            style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                          >
                            Reject
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        </>
      )}

      {/* 3.3 Rate Course Tab */}
      {d && tab === 'rate' && (
        <div style={{ marginTop: '1.5rem', maxWidth: 650 }}>
          <div className="card">
            <h3>Course Evaluation &amp; Relevance</h3>
            <p className="small muted">
              Your feedback is displayed on the elective page and guides students in choosing electives aligned with industry standards.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await api('/api/faculty/dashboard', {
                    method: 'POST',
                    body: {
                      course_id: ratingCourseId,
                      relevance: rel,
                      future_scope: scope,
                      comment,
                    },
                  });
                  facApi.reload();
                  setTab('overview');
                }, 'Course evaluation saved successfully!');
              }}
            >
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Select Course
                </label>
                <select
                  value={ratingCourseId}
                  onChange={(e) => {
                    const c = courses.find((x) => x.course_id === Number(e.target.value));
                    if (c) handleSelectCourseToRate(c);
                  }}
                  required
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }}
                >
                  <option value="">Select a course...</option>
                  {courses.map((c) => (
                    <option key={c.course_id} value={c.course_id}>
                      {c.code} - {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Industry Relevance: {rel} / 5
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={rel}
                  onChange={(e) => setRel(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Future Career Scope: {scope} / 5
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={scope}
                  onChange={(e) => setScope(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Faculty Commentary &amp; Prerequisites Advice
                </label>
                <textarea
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share recommendations on foundational preparation, industry alignment, and expected workload..."
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }}
                />
              </div>

              <button type="submit" className="btn" disabled={!ratingCourseId}>
                Save Evaluation
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 3.4 Student Feedback Tab */}
      {d && tab === 'feedback' && (
        <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card" style={{ padding: '1rem' }}>
            <div className="row" style={{ gap: '1rem', flexWrap: 'wrap' }}>
              <input
                placeholder="Search feedback text..."
                value={fbSearch}
                onChange={(e) => setFbSearch(e.target.value)}
                style={{ flex: 1, minWidth: 200, padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border)' }}
              />
              <select
                value={fbTerm}
                onChange={(e) => setFbTerm(e.target.value)}
                style={{ padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border)' }}
              >
                <option value="">All Terms</option>
                <option value="2024-Fall">2024-Fall</option>
                <option value="2024-Spr">2024-Spr</option>
              </select>
            </div>
          </div>

          {courses.map((c) => {
            const fbs = (c.feedback || []).filter((fb) => {
              if (fbSearch && !fb.review_text?.toLowerCase().includes(fbSearch.toLowerCase())) return false;
              if (fbTerm && fb.term !== fbTerm) return false;
              return true;
            });
            if (fbs.length === 0) return null;

            return (
              <div key={c.course_id} className="card">
                <h3 style={{ margin: '0 0 0.75rem 0' }}>{c.title} ({fbs.length} reviews)</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {fbs.map((fb) => (
                    <div key={fb.feedback_id} style={{ padding: '0.75rem', background: 'var(--bg-subtle)', borderRadius: 6 }}>
                      <div className="row" style={{ justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                        <span className="small muted">Term: {fb.term} &bull; Difficulty: {fb.difficulty}/5 &bull; Usefulness: {fb.usefulness}/5</span>
                        <button
                          type="button"
                          className="btn ghost small"
                          onClick={() => setReportTarget({ type: 'feedback', id: fb.feedback_id })}
                          style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem' }}
                        >
                          Report inappropriate
                        </button>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.9rem' }}>{fb.review_text}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
