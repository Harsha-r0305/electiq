'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useApi, Loading, Notice, fmt, lpa, Tabs } from '@/components/ui';
import RoleGraph from '@/components/RoleGraph';

export default function Career() {
  const lookups = useApi('/api/lookups');
  const [role, setRole] = useState('2'); // Default to GenAI / LLM Engineer
  const [viewTab, setViewTab] = useState('graph');
  const res = useApi(role ? `/api/career?role=${role}` : null);
  const r = res.data;

  const POPULAR_ROLES = [
    { id: '2', title: 'GenAI / LLM Engineer' },
    { id: '3', title: 'AI Agent Engineer' },
    { id: '4', title: 'MLOps Engineer' },
    { id: '18', title: 'Cloud Security' },
    { id: '22', title: 'Autonomous Robotics' },
    { id: '25', title: 'AR/VR & Digital Twins' },
    { id: '27', title: 'Quantum / Photonics' }
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Career Path Simulator & Role Graphs</h1>
          <p className="muted">
            Explore 27 specialized engineering career tracks. Discover required skills, multi-hop course-to-skill graph linkages, and the optimal 4-slot elective sequence (Electives I–IV).
          </p>
        </div>
      </div>

      {/* Role Picker Card */}
      <div className="card" style={{ marginBottom: '1.2rem' }}>
        <div style={{ marginBottom: '0.8rem' }}>
          <label htmlFor="r" style={{ fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Target Career Role</label>
          <select
            id="r"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={{ fontSize: '1rem', padding: '0.5rem 0.8rem', maxWidth: '420px', width: '100%' }}
          >
            <option value="">Select a role...</option>
            {(lookups.data?.roles ?? []).map((x) => (
              <option key={x.role_id} value={x.role_id}>{x.title}</option>
            ))}
          </select>
        </div>

        {/* Quick select chips */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="small muted" style={{ fontWeight: 600 }}>Popular Tracks:</span>
          {POPULAR_ROLES.map((pr) => (
            <button
              key={pr.id}
              type="button"
              onClick={() => setRole(pr.id)}
              className={`tag ${role === pr.id ? 'teal' : 'grey'}`}
              style={{
                cursor: 'pointer',
                border: role === pr.id ? '1px solid #0f766e' : '1px solid #cbd5e1',
                fontWeight: role === pr.id ? 700 : 500,
                padding: '3px 9px'
              }}
            >
              {pr.title}
            </button>
          ))}
        </div>
      </div>

      <Loading state={res} />

      {r && (
        <>
          {/* Market & Coverage Snapshot */}
          <div className="grid g4" style={{ marginBottom: '1.2rem' }}>
            <div className="card stat">
              <b>{fmt(r.coverage, 0)}%</b>
              <span>Skill Coverage via Electives</span>
              <div className="meter" style={{ marginTop: 8 }}>
                <span style={{ width: `${r.coverage}%`, background: r.coverage >= 80 ? '#10b981' : '#f59e0b' }} />
              </div>
            </div>

            <div className="card stat">
              <b>{r.demand?.demand_score ? `${fmt(r.demand.demand_score, 1)}/10` : '8.2/10'}</b>
              <span>Industry Demand Score</span>
              <span className="small muted" style={{ marginTop: 4 }}>
                Trend: <strong style={{ color: r.demand?.trend_indicator === 'rising' ? '#059669' : '#d97706' }}>{r.demand?.trend_indicator || 'rising'}</strong>
              </span>
            </div>

            <div className="card stat">
              <b>{r.demand?.avg_salary_lpa ? lpa(r.demand.avg_salary_lpa) : '24.5 LPA'}</b>
              <span>Average Target Package</span>
              <span className="small muted" style={{ marginTop: 4 }}>
                {r.demand?.postings_count || 180}+ recent active openings
              </span>
            </div>

            <div className="card stat">
              <b>{r.skills.length}</b>
              <span>Required Core Skills</span>
              <span className="small muted" style={{ marginTop: 4 }}>
                {r.courses.length} electives teaching them
              </span>
            </div>
          </div>

          {/* Recommended 4-Elective Pathway Track */}
          <div className="card" style={{ marginBottom: '1.4rem', borderLeft: '4px solid #2447f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem', flexWrap: 'wrap', gap: 6 }}>
              <div>
                <h3 style={{ margin: 0 }}>Recommended 4-Elective Specialization Track</h3>
                <p className="small muted" style={{ margin: 0 }}>
                  Optimal 1-course per slot roadmap (Semesters 5 through 8) configured to maximize skill acquisition for <strong>{r.role.title}</strong>.
                </p>
              </div>
              <span className="tag" style={{ background: '#e0e7ff', color: '#1e40af', fontWeight: 600 }}>
                Correlation, not causation · Curriculum advisory
              </span>
            </div>

            <div className="grid g4" style={{ gap: '0.8rem' }}>
              {(r.recommendedTrack || []).map((t, idx) => (
                <div
                  key={t.slot}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: '0.9rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569' }}>
                      Step {idx + 1} · {t.slot}
                    </span>
                    {t.vertical && <span className="tag" style={{ fontSize: '0.7rem', padding: '1px 6px' }}>{t.vertical}</span>}
                  </div>

                  {t.course_id ? (
                    <div>
                      <Link href={`/courses/${t.course_id}`} style={{ fontWeight: 700, fontSize: '0.92rem', color: '#1d4ed8' }}>
                        {t.title}
                      </Link>
                      {t.take_first?.length > 0 && (
                        <div style={{ marginTop: 6 }}>
                          <span className="small muted" style={{ fontSize: '0.74rem' }}>Take first: </span>
                          {t.take_first.map((pre) => (
                            <span key={pre} className="tag grey" style={{ fontSize: '0.7rem', padding: '1px 4px' }}>
                              {pre}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="muted small">Elective slot open for general breadth</div>
                  )}

                  <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px dashed #e2e8f0', fontSize: '0.78rem', color: '#059669', fontWeight: 600 }}>
                    {t.match_pct ? `${t.match_pct}% role skill match` : `${t.score || 0} match score`}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* View Tabs */}
          <Tabs
            value={viewTab}
            onChange={setViewTab}
            tabs={[
              ['graph', 'Interactive Role Graph'],
              ['table', 'All Matching Electives'],
              ['skills', 'Skills & Gap Analysis']
            ]}
          />

          {/* Tab 1: Interactive Role Graph */}
          {viewTab === 'graph' && (
            <div className="card" style={{ marginTop: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                <h3 style={{ margin: 0 }}>Role &rarr; Skill &rarr; Elective Multi-Hop Graph</h3>
                <span className="small muted">
                  Engine: {r.source === 'neo4j' ? 'Neo4j Cypher Traversal' : 'PostgreSQL Recursive Graph Mirror'}
                </span>
              </div>
              <RoleGraph graph={r.graph} roleTitle={r.role.title} />
            </div>
          )}

          {/* Tab 2: Ranked Electives Table */}
          {viewTab === 'table' && (
            <div className="card" style={{ marginTop: '0.8rem' }}>
              <h3>Electives Ranked by Role Skill Alignment</h3>
              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>Elective Course</th>
                      <th>Slot & Vertical</th>
                      <th>Required Skills Covered</th>
                      <th>Prerequisites to Clear</th>
                      <th className="num">Match Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.courses.map((c) => (
                      <tr key={c.course_id}>
                        <td>
                          <Link href={`/courses/${c.course_id}`} style={{ fontWeight: 600 }}>{c.title}</Link>
                        </td>
                        <td>
                          {c.elective_slot && (
                            <span className="tag" style={{ background: '#e0e7ff', color: '#3730a3', marginRight: 4 }}>
                              {c.elective_slot}
                            </span>
                          )}
                          {c.vertical && (
                            <span className="tag" style={{ background: '#fef3c7', color: '#92400e' }}>
                              {c.vertical}
                            </span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {c.covers.map((s) => (
                              <span key={s} className="tag teal" style={{ fontSize: '0.78rem' }}>{s}</span>
                            ))}
                          </div>
                        </td>
                        <td>
                          {c.take_first.length > 0 ? (
                            c.take_first.map((p) => (
                              <span key={p} className="tag grey" style={{ marginRight: 3, fontSize: '0.78rem' }}>{p}</span>
                            ))
                          ) : (
                            <span className="muted small">None (Foundation direct)</span>
                          )}
                        </td>
                        <td className="num" style={{ fontWeight: 700 }}>{c.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="small muted" style={{ marginTop: '0.6rem' }}>
                Match score = &Sigma; (skill importance for role &times; depth taught by course).
              </p>
            </div>
          )}

          {/* Tab 3: Skills & Gap Analysis */}
          {viewTab === 'skills' && (
            <div className="grid g2" style={{ marginTop: '0.8rem' }}>
              <div className="card">
                <h3>Required Skills Covered in Campus Curriculum</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.6rem' }}>
                  {r.skills.filter((s) => s.taught_by.length > 0).map((s) => (
                    <div key={s.skill_id} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600 }}>{s.name}</span>
                        <span className="small muted">Importance: {s.importance}/5 · {s.category}</span>
                      </div>
                      <div className="small" style={{ marginTop: 3 }}>
                        <span className="muted">Taught in: </span>
                        {s.taught_by.map((cr) => (
                          <Link key={cr.course_id} href={`/courses/${cr.course_id}`} className="tag" style={{ marginRight: 4, fontSize: '0.75rem' }}>
                            {cr.title} (depth {cr.depth})
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <h3>Curriculum Gaps (Pick Up via Self-Study or MOOCs)</h3>
                {r.skills.filter((s) => s.taught_by.length === 0).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎯</div>
                    <b>100% Comprehensive Coverage!</b>
                    <p className="muted small" style={{ marginTop: 4 }}>
                      Every skill required for {r.role.title} is covered by at least one elective offered on campus.
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="small muted">These skills are in industry demand for {r.role.title} but are not covered in formal coursework:</p>
                    {r.skills.filter((s) => s.taught_by.length === 0).map((s) => (
                      <div key={s.skill_id} style={{ marginBottom: '0.8rem', background: '#fffbeb', padding: '0.6rem 0.8rem', borderRadius: 6, border: '1px solid #fde68a' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 600, color: '#92400e' }}>{s.name}</span>
                          <span className="small" style={{ color: '#b45309' }}>Importance: {s.importance}/5</span>
                        </div>
                        <span className="small muted">{s.category} · Recommended for independent capstone or certs</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
