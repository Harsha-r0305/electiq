'use client';
import Link from 'next/link';
import { useApi, Loading, lpa, fmt } from '@/components/ui';

export default function MarketTrendsPage() {
  const trendsApi = useApi('/api/market-trends');
  const d = trendsApi.data;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Industry & Job-Market Trends</h1>
          <p className="muted">
            Real-time industry hiring pulses, skill demands, and wage distributions cross-referenced with university course offerings.
          </p>
        </div>
      </div>

      <Loading state={trendsApi} />

      {d && (
        <>
          {/* Freshness Badge */}
          <div className="card" style={{ marginBottom: '1.25rem', background: 'rgba(56, 178, 172, 0.08)', borderColor: 'var(--teal)' }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="tag green" style={{ marginRight: '0.6rem' }}>VERIFIED QUARTERLY PULSE</span>
                <b>{d.freshnessLabel}</b>
              </div>
              <Link href="/career" className="btn small">
                Career path simulator &rarr;
              </Link>
            </div>
          </div>

          {/* Data Provenance & Methodology Notice */}
          <div className="card" style={{ marginBottom: '2rem', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '1rem 1.25rem' }}>
            <h4 style={{ margin: '0 0 0.35rem 0', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📊</span> Data Provenance & Calibration Transparency
            </h4>
            <p className="small muted" style={{ margin: 0, lineHeight: 1.5 }}>
              Market demand metrics represent a synthesis of verified external reports (LinkedIn Economic Graph, NASSCOM Tech Hiring Indices) and university campus placement benchmarks. Where quarterly hiring aggregates are modeled, they are calibrated against real verified campus placement records to ensure transparent guidance for student elective decisions.
            </p>
          </div>

          {/* Top In-Demand Roles This Quarter */}
          <h2>Top in-demand roles this quarter</h2>
          <div className="tablewrap" style={{ marginBottom: '2rem' }}>
            <table>
              <thead>
                <tr>
                  <th>Job Role</th>
                  <th>Quarter</th>
                  <th className="num">Postings count</th>
                  <th className="num">Demand score (0-10)</th>
                  <th className="num">Avg salary range</th>
                  <th>Hiring momentum</th>
                  <th>Data source</th>
                </tr>
              </thead>
              <tbody>
                {d.roles.map((r) => {
                  const isRising = r.trend_indicator === 'rising';
                  const isFalling = r.trend_indicator === 'falling';
                  return (
                    <tr key={r.role_demand_id}>
                      <td><b>{r.role_title}</b></td>
                      <td>{r.quarter}</td>
                      <td className="num">{Number(r.postings_count).toLocaleString()}</td>
                      <td className="num">
                        <span className="tag green"><b>{fmt(r.demand_score, 1)}</b>/10</span>
                      </td>
                      <td className="num">{lpa(r.avg_salary_lpa)}</td>
                      <td>
                        <span className={`tag ${isRising ? 'green' : isFalling ? 'red' : 'blue'}`}>
                          {isRising ? '▲ Rising' : isFalling ? '▼ Falling' : '● Stable'}
                        </span>
                      </td>
                      <td>
                        <a href={r.source_link} target="_blank" rel="noopener noreferrer" className="small">
                          {r.source_name}
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Quarterly Trend Breakdown per Role */}
          <h2>Quarterly hiring momentum per role</h2>
          <div className="grid g3" style={{ marginBottom: '2rem' }}>
            {d.roleTrends.map((rt) => (
              <div key={rt.role_id} className="card">
                <h3>{rt.role_title}</h3>
                <div style={{ marginTop: '0.8rem' }}>
                  {rt.data.map((q) => (
                    <div key={q.quarter} style={{ marginBottom: '0.6rem' }}>
                      <div className="row" style={{ justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span><b>{q.quarter}</b></span>
                        <span>{q.postings.toLocaleString()} postings · {fmt(q.demand)}/10</span>
                      </div>
                      <div className="meter" style={{ height: 6, margin: '0.3rem 0' }}>
                        <span style={{ width: `${(q.demand / 10) * 100}%`, background: 'var(--teal)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Campus Hiring vs. Market Demand */}
          <h2>Campus hiring vs. market demand</h2>
          <p className="small muted" style={{ marginTop: '-0.3rem', marginBottom: '0.8rem' }}>
            Compares market postings and demand with university alumni placements for each engineering role.
          </p>
          <div className="tablewrap" style={{ marginBottom: '2rem' }}>
            <table>
              <thead>
                <tr>
                  <th>Job role</th>
                  <th className="num">Market postings</th>
                  <th className="num">Market demand score</th>
                  <th className="num">Market avg salary</th>
                  <th className="num">Campus placements</th>
                  <th className="num">Campus avg package</th>
                </tr>
              </thead>
              <tbody>
                {d.campusVsMarket.map((cm) => (
                  <tr key={cm.role_id}>
                    <td><b>{cm.role_title}</b></td>
                    <td className="num">{cm.market_postings?.toLocaleString() || '-'}</td>
                    <td className="num">{fmt(cm.market_demand_score, 1)} / 10</td>
                    <td className="num">{lpa(cm.market_avg_salary)}</td>
                    <td className="num"><b>{cm.campus_placed_count}</b> alumni</td>
                    <td className="num">{lpa(cm.campus_avg_pkg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Top In-Demand Skills & Uncovered Skills */}
          <h2>Skills in highest demand & uncovered gaps</h2>
          <div className="grid g2" style={{ marginBottom: '2rem' }}>
            <div className="card">
              <h3>Top skills in demand</h3>
              <p className="small muted">Skills with the highest demand scores across tech job postings.</p>
              <div className="tablewrap">
                <table>
                  <thead><tr><th>Skill</th><th>Category</th><th className="num">Score</th><th>Electives</th></tr></thead>
                  <tbody>
                    {d.topSkills.map((sk) => (
                      <tr key={sk.skill_id}>
                        <td><b>{sk.name}</b></td>
                        <td>{sk.category}</td>
                        <td className="num"><b>{fmt(sk.demand_score, 1)}</b>/10</td>
                        <td>{sk.uncovered ? <span className="tag amber">no elective</span> : `${sk.courses_teaching} courses`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <h3>Uncovered skills gap</h3>
              <p className="small muted">Skills actively demanded by employers, but not yet covered by university electives.</p>
              {d.uncoveredSkills.length === 0 ? <p className="muted small">All required skills are covered in curriculum.</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.6rem' }}>
                  {d.uncoveredSkills.map((sk) => (
                    <div key={sk.skill_id} style={{ background: 'rgba(237, 137, 54, 0.08)', border: '1px solid var(--amber)', padding: '0.6rem 0.8rem', borderRadius: 4 }}>
                      <div className="row" style={{ justifyContent: 'space-between' }}>
                        <b>{sk.name}</b>
                        <span className="tag amber">Demand {fmt(sk.demand_score, 1)}/10</span>
                      </div>
                      <p className="small muted" style={{ margin: '0.2rem 0 0' }}>
                        Category: {sk.category} · {sk.postings_count} active job postings
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

