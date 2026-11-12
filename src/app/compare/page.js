'use client';
import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import { api, useApi, Notice, Ruler, lpa, fmt } from '@/components/ui';

const SLOTS = ['Elective I', 'Elective II', 'Elective III', 'Elective IV'];

export default function ComparePage() {
  const lookups = useApi('/api/lookups');
  const [mode, setMode] = useState('direct'); // 'direct' or 'slot'
  const [selectedSlot, setSelectedSlot] = useState('Elective I');
  
  // Selected IDs for comparison (up to 3)
  const [selectedIds, setSelectedIds] = useState(['', '', '']);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');

  // Extract pure electives (no core)
  const allElectives = useMemo(() => {
    return (lookups.data?.electives || []).filter((c) => c.is_elective !== false);
  }, [lookups.data]);

  // Electives filtered by slot
  const slotElectives = useMemo(() => {
    return allElectives.filter((c) => c.elective_slot === selectedSlot);
  }, [allElectives, selectedSlot]);

  // Parse initial query params
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const p = new URLSearchParams(window.location.search).get('ids');
    if (p) {
      const parts = p.split(',').filter(Boolean);
      setSelectedIds([parts[0] || '', parts[1] || '', parts[2] || '']);
    }
  }, []);

  // When slot changes in slot mode, preselect first 2 electives of that slot
  useEffect(() => {
    if (mode === 'slot' && slotElectives.length >= 2) {
      setSelectedIds([String(slotElectives[0].course_id), String(slotElectives[1].course_id), '']);
    }
  }, [mode, selectedSlot, slotElectives]);

  // Fetch comparison data whenever selectedIds change
  useEffect(() => {
    const validIds = selectedIds.filter(Boolean);
    if (validIds.length < 1) {
      setData(null);
      setErr(null);
      return;
    }
    setLoading(true);
    api(`/api/compare?ids=${validIds.join(',')}`)
      .then((res) => {
        setData(res);
        setErr(null);
      })
      .catch((e) => {
        setErr(e.message);
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [selectedIds]);

  const updateSelectedId = (index, val) => {
    const next = [...selectedIds];
    next[index] = val;
    setSelectedIds(next);
  };

  const filteredElectiveOptions = useMemo(() => {
    if (!searchFilter.trim()) return allElectives;
    const q = searchFilter.toLowerCase();
    return allElectives.filter(
      (c) => c.title.toLowerCase().includes(q) || (c.vertical && c.vertical.toLowerCase().includes(q))
    );
  }, [allElectives, searchFilter]);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: '3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>Elective Comparison</h1>
          <p className="muted" style={{ margin: 0, fontSize: '0.95rem' }}>
            Compare academic rigor, senior feedback, industry relevance, and placement outcomes across university electives.
          </p>
        </div>
        <div style={{ display: 'flex', background: 'var(--bg-card, #f1f5f9)', padding: 4, borderRadius: 8 }}>
          <button
            type="button"
            onClick={() => setMode('direct')}
            className="btn"
            style={{
              padding: '0.5rem 1rem',
              fontWeight: mode === 'direct' ? 600 : 400,
              background: mode === 'direct' ? 'var(--blue-deep, #0284c7)' : 'transparent',
              color: mode === 'direct' ? '#fff' : 'inherit',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer'
            }}
          >
            Direct Elective Selection
          </button>
          <button
            type="button"
            onClick={() => setMode('slot')}
            className="btn"
            style={{
              padding: '0.5rem 1rem',
              fontWeight: mode === 'slot' ? 600 : 400,
              background: mode === 'slot' ? 'var(--blue-deep, #0284c7)' : 'transparent',
              color: mode === 'slot' ? '#fff' : 'inherit',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer'
            }}
          >
            Slot-Based Comparison
          </button>
        </div>
      </div>

      {/* Mode Navigation & Selectors */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem', border: '1px solid var(--border)' }}>
        {mode === 'slot' ? (
          <div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>Select Elective Slot</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {SLOTS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSelectedSlot(s)}
                    style={{
                      padding: '0.45rem 1.1rem',
                      borderRadius: 20,
                      border: '1px solid ' + (selectedSlot === s ? 'var(--blue-deep, #0284c7)' : 'var(--border)'),
                      background: selectedSlot === s ? 'rgba(2, 132, 199, 0.1)' : 'transparent',
                      color: selectedSlot === s ? 'var(--blue-deep, #0284c7)' : 'inherit',
                      fontWeight: selectedSlot === s ? 600 : 500,
                      cursor: 'pointer'
                    }}
                  >
                    {s} ({allElectives.filter((c) => c.elective_slot === s).length} courses)
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
              {[0, 1, 2].map((idx) => (
                <div key={idx}>
                  <label htmlFor={`slot_c_${idx}`} style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Elective {idx + 1} {idx === 2 ? '(Optional)' : ''}
                  </label>
                  <select
                    id={`slot_c_${idx}`}
                    value={selectedIds[idx]}
                    onChange={(e) => updateSelectedId(idx, e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: 6, border: '1px solid var(--border)' }}
                  >
                    <option value="">-- Choose an elective from {selectedSlot} --</option>
                    {slotElectives.map((c) => (
                      <option key={c.course_id} value={c.course_id}>
                        {c.title} {c.vertical ? `(${c.vertical})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: '1rem' }}>Select Elective</span>
                <span className="muted" style={{ marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                  Choose any elective across all 41 curriculum offerings
                </span>
              </div>
              <input
                type="text"
                placeholder="Search by elective name or vertical..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                style={{ padding: '0.4rem 0.8rem', borderRadius: 6, border: '1px solid var(--border)', minWidth: 260, fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
              {[0, 1, 2].map((idx) => (
                <div key={idx} style={{ background: 'var(--bg-subtle, #fafafa)', padding: '0.75rem 1rem', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <label htmlFor={`direct_c_${idx}`} style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                    Elective {idx === 0 ? 'A' : idx === 1 ? 'B' : 'C (Optional)'}
                  </label>
                  <select
                    id={`direct_c_${idx}`}
                    value={selectedIds[idx]}
                    onChange={(e) => updateSelectedId(idx, e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: 6, border: '1px solid var(--border)', background: '#fff' }}
                  >
                    <option value="">-- Choose any elective ({filteredElectiveOptions.length} available) --</option>
                    {filteredElectiveOptions.map((c) => (
                      <option key={c.course_id} value={c.course_id}>
                        {c.title} {c.vertical ? `[${c.vertical}]` : ''}
                      </option>
                    ))}
                  </select>
                  {selectedIds[idx] && (
                    <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => updateSelectedId(idx, '')}
                        style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}
                      >
                        Remove from comparison
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Notice error={err} />
      {loading && <p className="muted" style={{ textAlign: 'center', padding: '2rem 0' }}>Loading comparison details...</p>}

      {/* Comparison Grid & Side-by-Side Tables */}
      {data && data.length > 0 && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Header Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${data.length}, 1fr)`, gap: '1.25rem' }}>
            {data.map((item) => (
              <div
                key={item.course_id}
                className="card"
                style={{
                  padding: '1.25rem',
                  borderTop: '4px solid var(--blue-deep, #0284c7)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--blue-deep, #0284c7)' }}>
                    {item.elective_slot} &bull; {item.vertical || 'Cross-Track'}
                  </span>
                  <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem', borderRadius: 12, background: item.level === 'advanced' ? '#fee2e2' : item.level === 'intermediate' ? '#fef3c7' : '#e0f2fe', color: item.level === 'advanced' ? '#b91c1c' : item.level === 'intermediate' ? '#d97706' : '#0369a1', fontWeight: 600 }}>
                    {item.level}
                  </span>
                </div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, lineHeight: 1.35 }}>
                  <Link href={`/courses/${item.course_id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    {item.title}
                  </Link>
                </h3>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem', fontSize: '0.85rem' }}>
                  <span><b>{item.credits}</b> Credits</span>
                  <span>&bull;</span>
                  <span>Semester <b>{item.semester}</b></span>
                  <span>&bull;</span>
                  <span><b>{item.seniors_taken_count}</b> Verified Seniors</span>
                </div>
              </div>
            ))}
          </div>

          {/* Section 1: Core Metrics & Ratings */}
          <div className="card" style={{ padding: '1.25rem', overflowX: 'auto' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
              Academic & Placement Metrics
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '0.75rem', width: '22%', color: 'var(--muted)' }}>Metric</th>
                  {data.map((item) => (
                    <th key={item.course_id} style={{ padding: '0.75rem', fontWeight: 700 }}>
                      {item.title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 600 }}>Difficulty Rating (1–5)</td>
                  {data.map((item) => (
                    <td key={item.course_id} style={{ padding: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{fmt(item.avg_difficulty)}</span>
                        <div style={{ width: 90 }}><Ruler value={item.avg_difficulty} /></div>
                      </div>
                    </td>
                  ))}
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 600 }}>Student Usefulness Rating</td>
                  {data.map((item) => (
                    <td key={item.course_id} style={{ padding: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#059669' }}>{fmt(item.avg_usefulness)}</span>
                        <div style={{ width: 90 }}><Ruler value={item.avg_usefulness} invert /></div>
                      </div>
                    </td>
                  ))}
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 600 }}>Weekly Workload Rating</td>
                  {data.map((item) => (
                    <td key={item.course_id} style={{ padding: '0.75rem' }}>
                      <span style={{ fontWeight: 600 }}>{fmt(item.avg_workload)} / 5</span>
                    </td>
                  ))}
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 600 }}>Student Reviews Count</td>
                  {data.map((item) => (
                    <td key={item.course_id} style={{ padding: '0.75rem' }}>
                      <b>{item.feedback_count}</b> verified student reviews
                    </td>
                  ))}
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 600 }}>Average Placement Package</td>
                  {data.map((item) => (
                    <td key={item.course_id} style={{ padding: '0.75rem' }}>
                      <span style={{ fontWeight: 700, color: 'var(--blue-deep, #0284c7)' }}>
                        {item.avg_package ? lpa(item.avg_package) : 'N/A'}
                      </span>
                      <div className="muted" style={{ fontSize: '0.8rem' }}>{item.placed_students} seniors placed</div>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td style={{ padding: '0.75rem', fontWeight: 600 }}>Industry Outlook Score</td>
                  {data.map((item) => (
                    <td key={item.course_id} style={{ padding: '0.75rem' }}>
                      <span style={{ fontWeight: 700 }}>{item.advisor_scope_outlook || '8.5'} / 10</span>
                      <div className="muted" style={{ fontSize: '0.8rem' }}>Faculty advisor relevance</div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 2: Skills & Prerequisites */}
          <div className="card" style={{ padding: '1.25rem', overflowX: 'auto' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
              Skills Taught & Prerequisites
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '0.75rem', width: '22%', color: 'var(--muted)' }}>Attribute</th>
                  {data.map((item) => (
                    <th key={item.course_id} style={{ padding: '0.75rem', fontWeight: 700 }}>
                      {item.title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 600 }}>Skills Taught</td>
                  {data.map((item) => (
                    <td key={item.course_id} style={{ padding: '0.75rem' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {Array.isArray(item.skills) && item.skills.length > 0 ? (
                          item.skills.map((s, i) => (
                            <span
                              key={i}
                              style={{
                                display: 'inline-block',
                                padding: '0.25rem 0.6rem',
                                borderRadius: 14,
                                background: 'rgba(2, 132, 199, 0.08)',
                                color: 'var(--blue-deep, #0284c7)',
                                fontSize: '0.8rem',
                                fontWeight: 500
                              }}
                            >
                              {s.name} {s.depth > 1 ? `(Adv)` : ''}
                            </span>
                          ))
                        ) : (
                          <span className="muted">Curriculum skills mapped</span>
                        )}
                      </div>
                    </td>
                  ))}
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 600 }}>Prerequisites</td>
                  {data.map((item) => (
                    <td key={item.course_id} style={{ padding: '0.75rem' }}>
                      {Array.isArray(item.prerequisites) && item.prerequisites.length > 0 ? (
                        <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.9rem' }}>
                          {item.prerequisites.map((p, idx) => (
                            <li key={idx} style={{ marginBottom: '0.25rem' }}>
                              <b>{p}</b>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span style={{ color: '#059669', fontWeight: 500, fontSize: '0.9rem' }}>
                          No mandatory prerequisites (Direct entry)
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr style={{ verticalAlign: 'top' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 600 }}>Target Industry Roles</td>
                  {data.map((item) => (
                    <td key={item.course_id} style={{ padding: '0.75rem' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {Array.isArray(item.career_roles) && item.career_roles.length > 0 ? (
                          item.career_roles.map((r, i) => (
                            <span
                              key={i}
                              style={{
                                display: 'inline-block',
                                padding: '0.2rem 0.55rem',
                                borderRadius: 6,
                                background: '#f1f5f9',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                border: '1px solid #e2e8f0'
                              }}
                            >
                              {r}
                            </span>
                          ))
                        ) : (
                          <span className="muted">Cross-functional Engineering</span>
                        )}
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 3: Senior Feedback, Advice & Preparation */}
          <div className="card" style={{ padding: '1.25rem', overflowX: 'auto' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
              Senior Experience, Resources & Projects
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '0.75rem', width: '22%', color: 'var(--muted)' }}>Category</th>
                  {data.map((item) => (
                    <th key={item.course_id} style={{ padding: '0.75rem', fontWeight: 700 }}>
                      {item.title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 600 }}>Senior Feedback & Advice</td>
                  {data.map((item) => (
                    <td key={item.course_id} style={{ padding: '0.75rem' }}>
                      {Array.isArray(item.senior_feedback) && item.senior_feedback.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                          {item.senior_feedback.slice(0, 2).map((fb, idx) => (
                            <div
                              key={idx}
                              style={{
                                padding: '0.6rem',
                                borderRadius: 6,
                                background: '#f8fafc',
                                borderLeft: '3px solid var(--blue-deep, #0284c7)',
                                fontSize: '0.85rem'
                              }}
                            >
                              {fb.text && <p style={{ margin: '0 0 0.35rem 0', fontStyle: 'italic' }}>&ldquo;{fb.text}&rdquo;</p>}
                              {fb.advice && (
                                <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.8rem' }}>
                                  <b>Advice:</b> {fb.advice}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="muted">No written feedback submitted yet</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 600 }}>Recommended Preparation</td>
                  {data.map((item) => (
                    <td key={item.course_id} style={{ padding: '0.75rem', fontSize: '0.85rem' }}>
                      {Array.isArray(item.recommended_preparation) && item.recommended_preparation.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          {item.recommended_preparation.map((prep, idx) => (
                            <div key={idx}>&bull; {prep}</div>
                          ))}
                        </div>
                      ) : (
                        <span className="muted">Self-study of foundation concepts before semester starts</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 600 }}>Learning Resources ({item => item.resource_count})</td>
                  {data.map((item) => (
                    <td key={item.course_id} style={{ padding: '0.75rem', fontSize: '0.85rem' }}>
                      {Array.isArray(item.resources) && item.resources.length > 0 ? (
                        <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                          {item.resources.slice(0, 3).map((r, idx) => (
                            <li key={idx} style={{ marginBottom: '0.25rem' }}>
                              <b>[{r.type}]</b> {r.title}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="muted">Standard lecture slides and university portal materials</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr style={{ verticalAlign: 'top' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 600 }}>Completed Projects</td>
                  {data.map((item) => (
                    <td key={item.course_id} style={{ padding: '0.75rem' }}>
                      {Array.isArray(item.relevant_projects) && item.relevant_projects.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {item.relevant_projects.map((p, idx) => (
                            <div key={idx} style={{ fontSize: '0.85rem', padding: '0.4rem', background: '#f8fafc', borderRadius: 4 }}>
                              <div style={{ fontWeight: 600 }}>{p.title}</div>
                              {p.tech_stack && <div className="muted" style={{ fontSize: '0.75rem' }}>Tech: {p.tech_stack}</div>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="muted">Course term projects</span>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
            <Link href="/seniors" className="btn" style={{ padding: '0.65rem 1.5rem', background: 'var(--blue-deep, #0284c7)', color: '#fff', borderRadius: 6, textDecoration: 'none', fontWeight: 600 }}>
              Explore Seniors Who Took These Electives &rarr;
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
