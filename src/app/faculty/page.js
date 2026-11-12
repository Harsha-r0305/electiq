'use client';
import { useState } from 'react';
import { api, useApi, Loading, Notice, useAction, fmt } from '@/components/ui';

function RatingForm({ c, onSaved }) {
  const [f, setF] = useState({ relevance: c.relevance ?? 4, future_scope: c.future_scope ?? 4, comment: c.comment ?? '' });
  const [s, run] = useAction();
  return (
    <form className="card" onSubmit={(e) => { e.preventDefault(); run(async () => { await api('/api/faculty', { method: 'POST', body: { course_id: c.course_id, ...f } }); onSaved(); }, 'Rating saved.'); }}>
      <h3>{c.title}</h3>
      <p className="small muted">{c.feedback_count} senior reviews · difficulty {fmt(c.avg_difficulty)} · usefulness {fmt(c.avg_usefulness)} · {c.placed_students} placed students</p>
      <div className="row">
        <div><label>Relevance to industry (1-5)<input type="number" min="1" max="5" value={f.relevance} onChange={(e) => setF({ ...f, relevance: e.target.value })} /></label></div>
        <div><label>Future scope (1-5)<input type="number" min="1" max="5" value={f.future_scope} onChange={(e) => setF({ ...f, future_scope: e.target.value })} /></label></div>
      </div>
      <div className="field"><label>Advice for students<textarea value={f.comment} onChange={(e) => setF({ ...f, comment: e.target.value })} /></label></div>
      <Notice error={s.error} ok={s.ok} />
      <button className="btn" disabled={s.busy}>Save rating</button>
    </form>
  );
}

export default function Faculty() {
  const list = useApi('/api/faculty');
  return (
    <div>
      <h1>Faculty ratings</h1>
      <p className="muted">Rate the electives you teach. Students see your rating and advice on the course page.</p>
      <Loading state={list} />
      {list.data?.length === 0 && <p className="muted">No courses are assigned to your account yet.</p>}
      {list.data?.map((c) => <RatingForm key={c.course_id} c={c} onSaved={list.reload} />)}
    </div>
  );
}
