'use client';
import { useState } from 'react';
import { useApi, Loading, Pagination } from '@/components/ui';

export default function Questions() {
  const [q, setQ] = useState('');
  const [course, setCourse] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const lookups = useApi('/api/lookups');
  const list = useApi(`/api/questions?q=${encodeURIComponent(q)}${course ? `&course=${course}` : ''}`);

  const handleSearchChange = (val) => { setQ(val); setPage(1); };
  const handleCourseChange = (val) => { setCourse(val); setPage(1); };

  const allQuestions = list.data ?? [];
  const totalPages = Math.ceil(allQuestions.length / pageSize);
  const pageQuestions = allQuestions.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div>
      <h1>Interview question bank</h1>
      <p className="muted">Real questions that seniors were asked, tagged to the course that prepared them.</p>
      <div className="card row">
        <div>
          <label htmlFor="q">Search questions</label>
          <input id="q" placeholder="e.g. index, transformer, graph" value={q} onChange={(e) => handleSearchChange(e.target.value)} />
        </div>
        <div>
          <label htmlFor="c">Course</label>
          <select id="c" value={course} onChange={(e) => handleCourseChange(e.target.value)}>
            <option value="">All courses</option>
            {(lookups.data?.courses ?? []).map((c) => (
              <option key={c.course_id} value={c.course_id}>{c.title}</option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ height: '1rem' }} />
      <Loading state={list} />
      {list.data?.length === 0 && <p className="muted">No questions found. Try fewer or different words.</p>}
      {pageQuestions.map((x) => (
        <div key={x.question_id} className="card" style={{ marginBottom: '0.8rem' }}>
          <p style={{ margin: 0, fontWeight: 500 }}>{x.question_text}</p>
          <p className="small muted" style={{ margin: '.4rem 0 0', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span className="tag blue">{x.title}</span>
            <span className="tag grey">{x.round}</span>
            <span>Difficulty: {x.difficulty}/5</span>
          </p>
        </div>
      ))}
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
