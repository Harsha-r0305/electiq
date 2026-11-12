'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useApi, Loading, Ruler, lpa, fmt, Pagination, Tabs } from '@/components/ui';

export default function Courses() {
  const [tab, setTab] = useState('electives'); // 'electives' | 'core'
  const [f, setF] = useState({ q: '', dept: '', level: '', slot: '', vertical: '', sort: 'code' });
  const [picked, setPicked] = useState([]);
  const [page, setPage] = useState(1);
  const pageSize = 12;

  // Build query string ensuring electives and core courses are completely separate
  const params = { ...f, type: tab === 'core' ? 'core' : 'elective' };
  if (tab === 'core') {
    delete params.slot;
    delete params.vertical;
  }
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
  const list = useApi(`/api/courses?${qs}`);
  const lookups = useApi('/api/lookups');

  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < 3 ? [...p, id] : p));
  const updateFilter = (newF) => { setF(newF); setPage(1); };
  const switchTab = (newTab) => {
    setTab(newTab);
    setF({ q: '', dept: '', level: '', slot: '', vertical: '', sort: 'code' });
    setPage(1);
  };

  const allItems = list.data ?? [];
  const totalPages = Math.ceil(allItems.length / pageSize);
  const pageItems = allItems.slice((page - 1) * pageSize, page * pageSize);

  const SLOTS = ['Elective I', 'Elective II', 'Elective III', 'Elective IV'];
  const VERTICALS = [
    { label: 'AAML Vertical', val: 'AAML' },
    { label: 'AII Vertical', val: 'AII' },
    { label: 'CSCS Vertical', val: 'CSCS' },
    { label: 'NICE', val: 'NICE' },
    { label: 'SPaSE', val: 'SPaSE' }
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Electives & Curriculum Explorer</h1>
          <p className="muted">
            Explore and plan your B.Tech course registrations. Electives and Core Foundation subjects are kept strictly separate.
          </p>
        </div>
        {picked.length >= 2 && <Link className="btn" href={`/compare?ids=${picked.join(',')}`}>Compare {picked.length} courses</Link>}
      </div>

      {/* Primary Section Tabs: Electives vs Core Foundation */}
      <Tabs
        value={tab}
        onChange={switchTab}
        tabs={[
          ['electives', 'Elective Courses (Slots I – IV)'],
          ['core', 'Core Foundation Subjects (Prerequisites)']
        ]}
      />

      <div style={{ height: '0.8rem' }} />

      {tab === 'electives' ? (
        <>
          {/* Elective Filters */}
          <div className="card row" style={{ flexWrap: 'wrap', gap: '0.8rem' }}>
            <div style={{ flex: '1 1 180px' }}>
              <label htmlFor="q">Search Electives</label>
              <input
                id="q"
                placeholder="Search by elective name or vertical..."
                value={f.q}
                onChange={(e) => updateFilter({ ...f, q: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="slot">Elective Slot</label>
              <select id="slot" value={f.slot} onChange={(e) => updateFilter({ ...f, slot: e.target.value })}>
                <option value="">All Elective Slots</option>
                {SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="vert">Vertical</label>
              <select id="vert" value={f.vertical} onChange={(e) => updateFilter({ ...f, vertical: e.target.value })}>
                <option value="">All Verticals</option>
                {VERTICALS.map((v) => <option key={v.val} value={v.val}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="d">Department</label>
              <select id="d" value={f.dept} onChange={(e) => updateFilter({ ...f, dept: e.target.value })}>
                <option value="">All Depts</option>
                {(lookups.data?.departments ?? []).map((d) => <option key={d.dept_id} value={d.dept_id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="s">Sort by</label>
              <select id="s" value={f.sort} onChange={(e) => updateFilter({ ...f, sort: e.target.value })}>
                <option value="code">Title</option>
                <option value="scope">Outlook / Scope</option>
                <option value="difficulty">Difficulty</option>
                <option value="package">Placed Package</option>
                <option value="useful">Usefulness</option>
              </select>
            </div>
          </div>

          <div style={{ height: '0.8rem' }} />
          <Loading state={list} />

          {list.data && (list.data.length === 0 ? (
            <p className="muted">No electives match these filters. Clear a filter to see more.</p>
          ) : (
            <>
              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th aria-label="Select for comparison" style={{ width: 40 }}></th>
                      <th>Elective Name</th>
                      <th>Slot & Vertical</th>
                      <th>Outlook</th>
                      <th>Difficulty</th>
                      <th className="num">Usefulness</th>
                      <th className="num">Placed</th>
                      <th className="num">Avg Package</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((c) => (
                      <tr key={c.course_id}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Compare ${c.title}`}
                            checked={picked.includes(c.course_id)}
                            onChange={() => toggle(c.course_id)}
                            style={{ width: 'auto' }}
                          />
                        </td>
                        <td>
                          <Link href={`/courses/${c.course_id}`} style={{ fontWeight: 600 }}>{c.title}</Link>
                          <div className="small muted">
                            {c.department} · {c.feedback_count || 0} reviews
                          </div>
                        </td>
                        <td>
                          {c.elective_slot && (
                            <span className="tag" style={{ background: '#e0e7ff', color: '#3730a3', marginRight: 4, fontWeight: 600 }}>
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
                          {c.advisor_scope_outlook ? (
                            <span style={{ fontWeight: 600, color: c.advisor_scope_outlook >= 4 ? '#059669' : '#4b5563' }}>
                              ★ {fmt(c.advisor_scope_outlook, 1)}/5
                            </span>
                          ) : '—'}
                        </td>
                        <td><Ruler value={c.avg_difficulty} /></td>
                        <td className="num">{fmt(c.avg_usefulness)}</td>
                        <td className="num">{c.placed_students}</td>
                        <td className="num">{lpa(c.avg_package)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </>
          ))}
          <p className="small muted" style={{ marginTop: '0.6rem' }}>Tick up to three electives to compare them side by side.</p>
        </>
      ) : (
        <>
          {/* Core Foundation Subjects Section */}
          <div className="card" style={{ marginBottom: '1rem', background: '#f8fafc', borderLeft: '4px solid #0284c7' }}>
            <h3 style={{ margin: '0 0 0.3rem 0' }}>Core Foundation Curriculum</h3>
            <p className="small muted" style={{ margin: 0 }}>
              Mandatory engineering subjects across Computer Science, Electronics, and Mathematics. These courses build core fundamental knowledge and serve as prerequisite foundations required before enrolling in advanced Electives I–IV.
            </p>
          </div>

          <div className="card row" style={{ gap: '0.8rem', marginBottom: '0.8rem' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label htmlFor="qc">Search Core Subjects</label>
              <input
                id="qc"
                placeholder="Search core subject title or keywords..."
                value={f.q}
                onChange={(e) => updateFilter({ ...f, q: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="dc">Department</label>
              <select id="dc" value={f.dept} onChange={(e) => updateFilter({ ...f, dept: e.target.value })}>
                <option value="">All Depts</option>
                {(lookups.data?.departments ?? []).map((d) => <option key={d.dept_id} value={d.dept_id}>{d.name}</option>)}
              </select>
            </div>
          </div>

          <Loading state={list} />

          {list.data && (
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Core Subject Name</th>
                    <th>Department</th>
                    <th>Credits & Level</th>
                    <th>Difficulty</th>
                    <th>Electives Unlocked by This Subject</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((c) => (
                    <tr key={c.course_id}>
                      <td>
                        <Link href={`/courses/${c.course_id}`} style={{ fontWeight: 600 }}>{c.title}</Link>
                      </td>
                      <td>{c.department}</td>
                      <td>
                        <span className="tag grey" style={{ marginRight: 4 }}>{c.credits} Credits</span>
                        <span className="tag teal">{c.level}</span>
                      </td>
                      <td><Ruler value={c.avg_difficulty} /></td>
                      <td>
                        {c.unlocks && c.unlocks.length > 0 ? (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {c.unlocks.map((u) => (
                              <Link
                                key={u.course_id}
                                href={`/courses/${u.course_id}`}
                                className="tag"
                                style={{ background: '#e0e7ff', color: '#1e40af', fontSize: '0.74rem' }}
                                title={u.title}
                              >
                                {u.title} ({u.slot})
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <span className="small muted">Foundation breadth subject</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
