'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api, Notice } from './ui';

const PLACEHOLDER = 'I want an elective that helps me learn how to build intelligent chatbots and language models.';

export default function SemanticElectiveSearch() {
  const [query, setQuery] = useState('');
  const [state, setState] = useState({ busy: false, error: null, data: null });

  const submit = async (e) => {
    e?.preventDefault();
    const q = query.trim();
    if (q.length < 3) { setState({ busy: false, error: 'Please describe what you want to learn (at least 3 characters).', data: null }); return; }
    setState({ busy: true, error: null, data: null });
    try {
      const data = await api('/api/semantic-search', { method: 'POST', body: { query: q, limit: 8 } });
      setState({ busy: false, error: null, data });
    } catch (err) {
      setState({ busy: false, error: err.message, data: null });
    }
  };

  const results = state.data?.results || [];

  return (
    <section className="card" style={{ marginBottom: '1.5rem' }} aria-labelledby="ai-discover-title">
      <h2 id="ai-discover-title" style={{ marginTop: 0 }}>Discover Electives with AI</h2>
      <p className="muted">Describe what you want to learn, and discover electives based on your interests.</p>

      <form onSubmit={submit}>
        <div className="row" style={{ gap: '0.75rem', alignItems: 'stretch', flexWrap: 'wrap' }}>
          <textarea
            rows={2}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={PLACEHOLDER}
            aria-label="Describe what you want to learn"
            maxLength={500}
            style={{ flex: '1 1 320px', minWidth: 0 }}
          />
          <button type="submit" className="btn" disabled={state.busy} style={{ alignSelf: 'flex-start', flex: '0 0 auto' }}>
            {state.busy ? 'Searching…' : 'Search'}
          </button>
        </div>
      </form>

      <p className="small muted" style={{ marginTop: '0.75rem' }}>
        These electives were identified using semantic similarity. Results are ranked according to how closely their course content matches your search.
      </p>

      <Notice error={state.error} />
      {state.busy && <p className="muted" role="status">Finding the best matches…</p>}

      {state.data?.fallback && (
        <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', color: '#92400e', padding: '0.65rem 0.9rem', borderRadius: '6px', fontSize: '0.85rem', marginTop: '0.75rem', marginBottom: '0.75rem' }}>
          ℹ️ <b>Search Service Notice:</b> {state.data.fallbackNotice}
        </div>
      )}

      {state.data && results.length === 0 && (
        <p className="muted">No electives matched closely enough. Try describing your interest in different words, for example the topic, tools or career you have in mind.</p>
      )}

      {results.length > 0 && (
        <div className="grid g2" style={{ marginTop: '1rem' }}>
          {results.map((r) => (
            <div key={r.course_id} className="card" style={{ margin: 0 }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                <div>
                  <div className="small muted">{r.code}{r.vertical ? ` · ${r.vertical}` : ''}</div>
                  <h3 style={{ margin: '0.15rem 0 0.4rem' }}>{r.title}</h3>
                </div>
                <span className="tag" title="Cosine similarity between your search and this course's content">{r.similarityPercent}% match</span>
              </div>
              {r.description && (
                <p className="small" style={{ margin: '0 0 0.5rem' }}>
                  {r.description}
                  {r.description_is_synthetic && <span className="muted"> (Auto-generated summary, not official course text.)</span>}
                </p>
              )}
              {r.skills_taught?.length > 0 && <p className="small" style={{ margin: '0 0 0.35rem' }}><b>Skills:</b> {r.skills_taught.join(', ')}</p>}
              {r.topics?.length > 0 && r.topics.join('|') !== (r.skills_taught || []).join('|') && <p className="small" style={{ margin: '0 0 0.6rem' }}><b>Topics:</b> {r.topics.join(', ')}</p>}
              <Link href={`/courses/${r.course_id}`} className="btn ghost small">View course details →</Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
