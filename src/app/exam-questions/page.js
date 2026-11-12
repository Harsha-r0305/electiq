'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api, useApi, Loading, Notice, useAction } from '@/components/ui';

function QuestionCard({ idx, q, total, onChange, onRemove }) {
  return (
    <div className="card" style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.1)', marginBottom: '0.75rem' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <h4 style={{ margin: 0 }}>Question {idx + 1}</h4>
        {total > 1 && (
          <button
            type="button"
            className="btn ghost small"
            style={{ color: '#f87171' }}
            onClick={() => onRemove(idx)}
            title="Remove this question"
          >
            ✕ Remove
          </button>
        )}
      </div>

      <div className="field">
        <label>
          Question text (10–800 chars)
          <textarea
            required
            rows={3}
            placeholder="e.g. Explain the difference between optimistic and pessimistic concurrency control with real-world scenarios."
            value={q.text}
            onChange={(e) => onChange(idx, 'text', e.target.value)}
          />
        </label>
        <span className="small muted" style={{ display: 'block', textAlign: 'right' }}>
          {q.text.length} / 800
        </span>
      </div>

      <div className="row">
        <div>
          <label>
            Topic (optional)
            <input
              type="text"
              placeholder="e.g. Concurrency Control"
              value={q.topic}
              onChange={(e) => onChange(idx, 'topic', e.target.value)}
            />
          </label>
        </div>
        <div>
          <label>
            Marks (1–100)
            <input
              type="number"
              min="1"
              max="100"
              value={q.marks}
              onChange={(e) => onChange(idx, 'marks', e.target.value)}
            />
          </label>
        </div>
        <div>
          <label>
            Difficulty (1–5)
            <select
              value={q.difficulty}
              onChange={(e) => onChange(idx, 'difficulty', Number(e.target.value))}
            >
              <option value={1}>1 - Very Easy</option>
              <option value={2}>2 - Easy</option>
              <option value={3}>3 - Medium</option>
              <option value={4}>4 - Hard</option>
              <option value={5}>5 - Very Hard</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}

function ShareExamQuestionsForm({ onSaved }) {
  const myEnrollments = useApi('/api/my/enrollments');
  const activeEnrollments = (myEnrollments.data ?? []).filter((e) => e.status !== 'dropped');

  const [enrollmentId, setEnrollmentId] = useState('');
  const [examType, setExamType] = useState('ISA1');
  const [questions, setQuestions] = useState([
    { text: '', marks: 5, topic: '', difficulty: 3 },
  ]);
  const [actionState, run] = useAction();

  useEffect(() => {
    if (activeEnrollments.length > 0 && !enrollmentId) {
      setEnrollmentId(String(activeEnrollments[0].enrollment_id));
    }
  }, [activeEnrollments, enrollmentId]);

  const updateQuestion = (idx, field, value) => {
    setQuestions((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  };

  const addQuestion = () => {
    if (questions.length < 10) {
      setQuestions((prev) => [
        ...prev,
        { text: '', marks: 5, topic: '', difficulty: 3 },
      ]);
    }
  };

  const removeQuestion = (idx) => {
    if (questions.length > 1) {
      setQuestions((prev) => prev.filter((_, i) => i !== idx));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!enrollmentId) return;

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (q.text.trim().length < 10) {
        alert(`Question ${i + 1} must be at least 10 characters long.`);
        return;
      }
    }

    run(async () => {
      await api('/api/exam-questions', {
        method: 'POST',
        body: {
          enrollment_id: Number(enrollmentId),
          exam_type: examType,
          questions: questions.map((q) => ({
            text: q.text.trim(),
            marks: q.marks ? Number(q.marks) : null,
            topic: q.topic ? q.topic.trim() : null,
            difficulty: Number(q.difficulty) || 3,
          })),
        },
      });
      setQuestions([{ text: '', marks: 5, topic: '', difficulty: 3 }]);
      onSaved();
    }, `Shared ${questions.length} exam question${questions.length > 1 ? 's' : ''} anonymously!`);
  };

  if (myEnrollments.loading) return <p className="muted">Loading your enrolled courses...</p>;
  if (myEnrollments.error) return <Notice error={myEnrollments.error} />;

  if (activeEnrollments.length === 0) {
    return (
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3>Share exam questions</h3>
        <p className="muted">
          You don&apos;t have any active course enrollments to share questions for right now. Enroll in a course or check your profile.
        </p>
      </div>
    );
  }

  return (
    <form className="card" onSubmit={handleSubmit} style={{ marginBottom: '2.5rem' }}>
      <div className="page-head" style={{ marginBottom: '1rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>Share exam questions</h2>
          <p className="muted" style={{ margin: '0.25rem 0 0' }}>
            Help your peers and juniors by sharing questions asked in your recent ISA or ESA. All submissions are strictly anonymous.
          </p>
        </div>
        <span className="tag teal">Anonymous</span>
      </div>

      <div className="row" style={{ marginBottom: '1rem' }}>
        <div style={{ flex: 2 }}>
          <label htmlFor="enr_select">Course enrollment</label>
          <select
            id="enr_select"
            required
            value={enrollmentId}
            onChange={(e) => setEnrollmentId(e.target.value)}
          >
            {activeEnrollments.map((enr) => (
              <option key={enr.enrollment_id} value={enr.enrollment_id}>
                {enr.title} ({enr.term}, {enr.status})
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: 1 }}>
          <label htmlFor="exam_type_select">Exam assessment</label>
          <select
            id="exam_type_select"
            value={examType}
            onChange={(e) => setExamType(e.target.value)}
          >
            <option value="ISA1">In-Semester Assessment 1 (ISA 1)</option>
            <option value="ISA2">In-Semester Assessment 2 (ISA 2)</option>
            <option value="ESA">End-Semester Assessment (ESA)</option>
          </select>
        </div>
      </div>

      <div style={{ marginTop: '1.25rem', marginBottom: '1rem' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0 }}>Questions ({questions.length} of 10)</h3>
          {questions.length < 10 && (
            <button
              type="button"
              className="btn ghost small"
              onClick={addQuestion}
            >
              + Add another question
            </button>
          )}
        </div>

        {questions.map((q, idx) => (
          <QuestionCard
            key={idx}
            idx={idx}
            q={q}
            total={questions.length}
            onChange={updateQuestion}
            onRemove={removeQuestion}
          />
        ))}
      </div>

      <Notice error={actionState.error} ok={actionState.ok} />

      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
        <span className="small muted">
          Batch transaction: all questions save together or fail together.
        </span>
        <button type="submit" className="btn" disabled={actionState.busy}>
          {actionState.busy ? 'Submitting...' : `Submit ${questions.length} question${questions.length > 1 ? 's' : ''}`}
        </button>
      </div>
    </form>
  );
}

export default function ExamQuestionsPage() {
  const me = useApi('/api/auth/me');
  const lookups = useApi('/api/lookups');

  const [q, setQ] = useState('');
  const [course, setCourse] = useState('');
  const [type, setType] = useState('');
  const [offset, setOffset] = useState(0);

  const queryParams = new URLSearchParams();
  if (q.trim()) queryParams.set('q', q.trim());
  if (course) queryParams.set('course', course);
  if (type) queryParams.set('type', type);
  if (offset > 0) queryParams.set('offset', String(offset));

  const list = useApi(`/api/exam-questions?${queryParams.toString()}`);

  const handleSearchChange = (val) => {
    setQ(val);
    setOffset(0);
  };
  const handleCourseChange = (val) => {
    setCourse(val);
    setOffset(0);
  };
  const handleTypeChange = (val) => {
    setType(val);
    setOffset(0);
  };

  const isContributor = me.data?.role === 'senior' || me.data?.role === 'student';
  const questions = list.data ?? [];

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>ISA and ESA question bank</h1>
          <p className="muted">
            Search real exam questions shared by enrolled students across ISA1, ISA2, and ESA assessments.
          </p>
        </div>
      </div>

      {isContributor && (
        <ShareExamQuestionsForm onSaved={() => list.reload()} />
      )}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginTop: 0 }}>Browse and search questions</h3>
        <div className="row" style={{ gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '2 1 240px' }}>
            <label htmlFor="search_q">Full-text search</label>
            <input
              id="search_q"
              placeholder="e.g. dynamic programming, semaphore, normalization"
              value={q}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
          <div style={{ flex: '2 1 200px' }}>
            <label htmlFor="filter_c">Filter by elective</label>
            <select
              id="filter_c"
              value={course}
              onChange={(e) => handleCourseChange(e.target.value)}
            >
              <option value="">All electives</option>
              {(lookups.data?.courses ?? []).filter((c) => c.is_elective).map((c) => (
                <option key={c.course_id} value={c.course_id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: '1 1 140px' }}>
            <label htmlFor="filter_t">Exam assessment</label>
            <select
              id="filter_t"
              value={type}
              onChange={(e) => handleTypeChange(e.target.value)}
            >
              <option value="">All exams</option>
              <option value="ISA1">ISA 1</option>
              <option value="ISA2">ISA 2</option>
              <option value="ESA">ESA</option>
            </select>
          </div>
        </div>
      </div>

      <Loading state={list} />

      {list.data && questions.length === 0 && (
        <div className="card">
          <p className="muted">No questions found matching your criteria. Try adjusting the search filters.</p>
        </div>
      )}

      <div className="grid g2">
        {questions.map((item) => (
          <div
            key={item.exam_question_id}
            className="card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
            }}
          >
            <div>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
                <Link
                  href={`/courses/${item.course_id}`}
                  className="tag teal"
                  style={{ textDecoration: 'none' }}
                >
                  {item.elective_name || item.course_title}
                </Link>
                <span
                  className={`tag ${
                    item.exam_type === 'ESA' ? 'rose' : item.exam_type === 'ISA2' ? 'amber' : 'grey'
                  }`}
                >
                  {item.exam_type}
                </span>
              </div>
              <p style={{ margin: '0.5rem 0', fontWeight: 500, lineHeight: 1.5, fontSize: '0.95rem' }}>
                {item.question_text}
              </p>
              {item.answer_text && (
                <div style={{ marginTop: '0.5rem', padding: '0.6rem 0.8rem', borderRadius: 6, background: '#f0f9ff', color: '#0369a1', fontSize: '0.85rem' }}>
                  <b>Solution:</b> {item.answer_text}
                </div>
              )}
            </div>

            <div
              className="small muted"
              style={{
                marginTop: '1rem',
                paddingTop: '0.5rem',
                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                display: 'flex',
                gap: '0.4rem',
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              {item.marks != null && <span className="tag">{item.marks} marks</span>}
              {item.topic && <span className="tag grey">{item.topic}</span>}
              <span className="tag amber">Diff: {item.difficulty}/5</span>
              <span style={{ marginLeft: 'auto' }}>{item.term}</span>
            </div>
          </div>
        ))}
      </div>

      {questions.length >= 60 && (
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <button
            type="button"
            className="btn ghost"
            onClick={() => setOffset((prev) => prev + 60)}
          >
            Load next 60 questions →
          </button>
        </div>
      )}
    </div>
  );
}
