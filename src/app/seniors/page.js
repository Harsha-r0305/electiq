'use client';
import { useState, useMemo } from 'react';
import { useApi, Loading, lpa, fmt, Notice } from '@/components/ui';
import SeniorProfileModal from '@/components/SeniorProfileModal';

const SALARY_RANGES = [
  { id: 'all', label: 'All Ranges' },
  { id: 'above_50', label: 'Above 50 LPA' },
  { id: '30_50', label: '30–50 LPA' },
  { id: '20_30', label: '20–30 LPA' },
  { id: '15_20', label: '15–20 LPA' },
  { id: '12_15', label: '12–15 LPA' },
  { id: '8_12', label: '8–12 LPA' },
  { id: '5_8', label: '5–8 LPA' },
  { id: 'below_5', label: 'Below 5 LPA' },
];

export default function SeniorExplorerPage() {
  const [selectedRange, setSelectedRange] = useState('all');
  const [deptId, setDeptId] = useState('');
  const [batchYear, setBatchYear] = useState('');
  const [minCgpa, setMinCgpa] = useState('');
  const [maxCgpa, setMaxCgpa] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [selectedElective, setSelectedElective] = useState('');
  const [hasPubs, setHasPubs] = useState(false);
  const [wonHackathon, setWonHackathon] = useState(false);
  const [sortBy, setSortBy] = useState('package');
  const [viewSeniorCode, setViewSeniorCode] = useState(null);

  // Lookups
  const lookups = useApi('/api/lookups');

  // Query string build
  const queryParams = new URLSearchParams();
  if (selectedRange && selectedRange !== 'all') queryParams.set('salary_range', selectedRange);
  if (deptId) queryParams.set('dept_id', deptId);
  if (batchYear) queryParams.set('batch_year', batchYear);
  if (minCgpa) queryParams.set('min_cgpa', minCgpa);
  if (maxCgpa) queryParams.set('max_cgpa', maxCgpa);
  if (company) queryParams.set('company', company);
  if (role) queryParams.set('role', role);
  if (selectedElective) queryParams.set('elective', selectedElective);
  if (hasPubs) queryParams.set('has_publications', 'true');
  if (wonHackathon) queryParams.set('won_hackathon', 'true');
  if (sortBy) queryParams.set('sort', sortBy);

  const seniorsApi = useApi(`/api/seniors?${queryParams.toString()}`);
  const data = seniorsApi.data;
  const rangeCounts = data?.rangeCounts || {};
  const seniors = data?.seniors || [];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: '3rem' }}>
      <div className="page-head" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>Senior Explorer</h1>
          <p className="muted" style={{ margin: 0, fontSize: '0.95rem' }}>
            Explore verified placement experiences, elective trajectories, interview strategies, and salary packages shared by alumni.
          </p>
        </div>
      </div>

      {/* Salary Range Filter Buttons */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.5rem' }}>
          FILTER BY SALARY RANGE (ACTUAL PACKAGE LPA):
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {SALARY_RANGES.map((rng) => {
            const count = rangeCounts[rng.id] ?? 0;
            const isSelected = selectedRange === rng.id;
            return (
              <button
                key={rng.id}
                type="button"
                onClick={() => setSelectedRange(rng.id)}
                style={{
                  padding: '0.45rem 0.9rem',
                  borderRadius: 20,
                  border: '1px solid ' + (isSelected ? 'var(--blue-deep, #0284c7)' : 'var(--border)'),
                  background: isSelected ? 'var(--blue-deep, #0284c7)' : '#fff',
                  color: isSelected ? '#fff' : 'inherit',
                  fontWeight: isSelected ? 700 : 500,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: isSelected ? '0 2px 6px rgba(2, 132, 199, 0.25)' : 'none',
                }}
              >
                <span>{rng.label}</span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.1rem 0.45rem',
                    borderRadius: 10,
                    background: isSelected ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
                    color: isSelected ? '#fff' : 'var(--muted)',
                    fontWeight: 600,
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter and Search Card */}
      <div className="card" style={{ marginBottom: '1.75rem', padding: '1.25rem', border: '1px solid var(--border)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
              Company
            </label>
            <input
              placeholder="Search company (e.g. Google)..."
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.85rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
              Job Role
            </label>
            <input
              placeholder="Search role (e.g. ML Engineer)..."
              value={role}
              onChange={(e) => setRole(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.85rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
              Filter by Elective Taken
            </label>
            <select
              value={selectedElective}
              onChange={(e) => setSelectedElective(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.85rem' }}
            >
              <option value="">All Electives</option>
              {(lookups.data?.electives ?? []).map((el) => (
                <option key={el.course_id} value={el.title}>
                  {el.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
              Graduation Year
            </label>
            <select
              value={batchYear}
              onChange={(e) => setBatchYear(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.85rem' }}
            >
              <option value="">All Graduation Years</option>
              <option value="2025">Class of 2025</option>
              <option value="2024">Class of 2024</option>
              <option value="2023">Class of 2023</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
              Department
            </label>
            <select
              value={deptId}
              onChange={(e) => setDeptId(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.85rem' }}
            >
              <option value="">All Departments</option>
              {(lookups.data?.departments ?? []).map((d) => (
                <option key={d.dept_id} value={d.dept_id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
              Sort Results By
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.85rem' }}
            >
              <option value="package">Salary Package (Highest First)</option>
              <option value="cgpa">CGPA (Highest First)</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1.25rem', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
            <input type="checkbox" checked={hasPubs} onChange={(e) => setHasPubs(e.target.checked)} />
            Has Research Publications
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
            <input type="checkbox" checked={wonHackathon} onChange={(e) => setWonHackathon(e.target.checked)} />
            Won a Hackathon / Competition
          </label>
        </div>
      </div>

      <Loading state={seniorsApi} />

      {/* Senior List Cards */}
      {seniors.length === 0 && !seniorsApi.loading && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <p className="muted" style={{ margin: 0 }}>
            No senior placement records match your active search filters. Try selecting &ldquo;All Ranges&rdquo; or clearing specific filters.
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
        {seniors.map((s) => (
          <div
            key={s.student_id}
            className="card"
            style={{
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              borderRadius: 10,
              border: '1px solid var(--border)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              transition: 'transform 0.15s, box-shadow 0.15s',
              cursor: 'pointer',
              background: '#fff',
            }}
            onClick={() => setViewSeniorCode(s.senior_code)}
          >
            <div>
              {/* Header: Code/Name + Package */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                    {s.display_name || `Senior #${s.senior_code}`}
                  </h3>
                  <p className="muted" style={{ margin: '0.2rem 0 0', fontSize: '0.8rem' }}>
                    {s.dept_name} &bull; Class of {s.batch_year}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#059669' }}>
                    {s.highest_package_lpa ? lpa(s.highest_package_lpa) : 'N/A'}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                    CGPA: <b>{fmt(s.cgpa, 2)}</b>
                  </span>
                </div>
              </div>

              {/* Company & Role Box */}
              <div
                style={{
                  background: 'var(--bg-subtle, #f8fafc)',
                  padding: '0.6rem 0.8rem',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  marginBottom: '0.75rem',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                  {s.company_name} &bull; <span style={{ fontWeight: 500 }}>{s.role_title || 'Software Development Engineer'}</span>
                </div>
                {s.job_location && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.15rem' }}>
                    {s.job_location} {s.ppo_received ? '&bull; PPO Conversion' : ''}
                  </div>
                )}
              </div>

              {/* Electives Taken (Names ONLY, no codes) */}
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.35rem' }}>
                  ELECTIVES COMPLETED:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {Array.isArray(s.electives) && s.electives.length > 0 ? (
                    s.electives.map((el, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.2rem 0.5rem',
                          borderRadius: 4,
                          background: '#f1f5f9',
                          color: '#334155',
                          fontWeight: 500,
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        {el.title}
                      </span>
                    ))
                  ) : (
                    <span className="muted" style={{ fontSize: '0.75rem' }}>Electives logged in portal</span>
                  )}
                </div>
              </div>

              {/* Senior Advice excerpt if available */}
              {s.advice_for_juniors && (
                <div style={{ fontSize: '0.8rem', fontStyle: 'italic', color: '#475569', background: '#f0f9ff', padding: '0.5rem 0.75rem', borderRadius: 6, marginBottom: '0.75rem' }}>
                  &ldquo;{s.advice_for_juniors.length > 90 ? s.advice_for_juniors.slice(0, 90) + '...' : s.advice_for_juniors}&rdquo;
                </div>
              )}
            </div>

            {/* Footer Stats & Button */}
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderTop: '1px solid var(--border)',
                  paddingTop: '0.6rem',
                  fontSize: '0.75rem',
                  color: 'var(--muted)',
                  marginBottom: '0.75rem',
                }}
              >
                <span>{s.internship_count} Internships</span>
                <span>{s.project_count} Projects</span>
                <span>{s.paper_count} Papers</span>
                <span>{s.hackathon_wins} Wins</span>
              </div>

              <button
                type="button"
                className="btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setViewSeniorCode(s.senior_code);
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: 'var(--blue-deep, #0284c7)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                View Full Experience &rarr;
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Senior Profile Modal */}
      {viewSeniorCode && (
        <SeniorProfileModal
          seniorCode={viewSeniorCode}
          onClose={() => setViewSeniorCode(null)}
        />
      )}
    </div>
  );
}
